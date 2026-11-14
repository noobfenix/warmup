import { getAqiCategory, type AqiCategoryName, type StandardPollutant } from "./cpcb";
import type { NormalizedRow } from "./table-parser";

export type FlagType = "missing" | "impossible" | "duplicate" | "stuck_value";
export type FlagSeverity = "warning" | "error";

export interface DataFlag {
  id: string; // e.g., "FL1", "FL2"
  type: FlagType;
  severity: FlagSeverity;
  station: string;
  sourceRowIndex: number; // 1-based index
  column: string;
  rawValue: string;
  description: string;
}

export type FactCategory =
  | "average"
  | "hotspot"
  | "trend"
  | "cleanest_zone"
  | "standard_exceedance"
  | "data_integrity";

export interface ComputedFact {
  id: string; // e.g., "F1", "F2"
  category: FactCategory;
  title: string;
  statement: string;
  sourceRowIndices: number[]; // 1-based row indices
  station: string;
  metric: string;
  value: number | string;
  unit: string;
  cpcbCategory?: AqiCategoryName;
}

export interface AnalysisOutput {
  normalizedRows: NormalizedRow[];
  flags: DataFlag[];
  facts: ComputedFact[];
  summary: {
    totalRows: number;
    flaggedRowsCount: number;
    overallAverageAqi: number | null;
    overallCategory: AqiCategoryName | null;
    peakAqi: number | null;
    peakStation: string | null;
    peakRowIndex: number | null;
    cleanestAqi: number | null;
    cleanestStation: string | null;
  };
}

// Physical upper plausibility bounds
const IMPOSSIBLE_MAX_LIMITS: Record<string, number> = {
  "PM2.5": 1500, // ug/m3
  "PM10": 2500,  // ug/m3
  "NO2": 1000,   // ug/m3
  "SO2": 2000,   // ug/m3
  "CO": 100,     // mg/m3
  "O3": 1000,    // ug/m3
  "AQI": 1000,   // Index
};

/**
 * Deterministically checks for sensor quality flags:
 * - missing: null or empty values in rows
 * - impossible: negative values or values exceeding physical reality
 * - duplicate: exact same station + timestamp or identical record
 * - stuck_value: sensor repeating identical non-zero reading for >= 3 consecutive entries
 */
export function detectDataFlags(rows: NormalizedRow[]): DataFlag[] {
  const flags: DataFlag[] = [];
  let flagCounter = 1;

  // Track seen (station + timestamp) for duplicate check
  const seenTimestamps = new Map<string, number>();

  // Track consecutive values per station and pollutant for stuck_value check
  // Map key: `${station}::${pollutant}` -> array of { value, rowIndex }
  const consecutiveTracker = new Map<
    string,
    { value: number; rowIndex: number }[]
  >();

  // Track completed stuck streaks
  const recordedStuckStreaks: {
    station: string;
    pollutant: string;
    value: number;
    rows: number[];
  }[] = [];

  const flushStreakIfStuck = (key: string, history: { value: number; rowIndex: number }[]) => {
    if (history.length >= 3) {
      const [stationName, pollutant] = key.split("::");
      recordedStuckStreaks.push({
        station: stationName,
        pollutant,
        value: history[0].value,
        rows: history.map((h) => h.rowIndex),
      });
    }
  };

  for (const row of rows) {
    const { sourceRowIndex, station, timestamp, values, rawValues, mappedColumns } = row;

    // Check missing station
    if (!station || station.trim() === "" || station.startsWith("Station-")) {
      flags.push({
        id: `FL${flagCounter++}`,
        type: "missing",
        severity: "warning",
        station: station || "Unknown",
        sourceRowIndex,
        column: "Station",
        rawValue: station || "",
        description: `Missing or auto-generated station name on source row ${sourceRowIndex}.`,
      });
    }

    // Check duplicate timestamp for station
    if (timestamp && station) {
      const timeKey = `${station.toLowerCase()}::${timestamp.trim()}`;
      if (seenTimestamps.has(timeKey)) {
        const prevRow = seenTimestamps.get(timeKey)!;
        flags.push({
          id: `FL${flagCounter++}`,
          type: "duplicate",
          severity: "error",
          station,
          sourceRowIndex,
          column: "Timestamp",
          rawValue: timestamp,
          description: `Duplicate timestamp "${timestamp}" for station "${station}". Matches source row ${prevRow}.`,
        });
      } else {
        seenTimestamps.set(timeKey, sourceRowIndex);
      }
    }

    // Determine which columns were monitored in this dataset
    const columnsToCheck: { standardKey: keyof typeof values; displayHeader: string }[] = [];

    if (mappedColumns && mappedColumns.length > 0) {
      for (const col of mappedColumns) {
        columnsToCheck.push({
          standardKey: col.standardPollutant as keyof typeof values,
          displayHeader: col.sourceColumn,
        });
      }
    } else {
      // Fallback for mock fixtures
      const checkedKeys: (keyof typeof values)[] = [
        "PM2.5",
        "PM10",
        "NO2",
        "SO2",
        "CO",
        "O3",
        "AQI",
      ];
      for (const key of checkedKeys) {
        // Find matching header in rawValues
        const matchingRawHeader = Object.keys(rawValues).find(
          (h) => h === key || h.toLowerCase().includes(key.toLowerCase())
        );
        if (matchingRawHeader) {
          columnsToCheck.push({
            standardKey: key,
            displayHeader: matchingRawHeader,
          });
        }
      }
    }

    let allMissing = columnsToCheck.length > 0;

    for (const col of columnsToCheck) {
      const val = values[col.standardKey];
      const rawVal = rawValues[col.displayHeader] ?? "";

      if (val === undefined || val === null) {
        flags.push({
          id: `FL${flagCounter++}`,
          type: "missing",
          severity: "warning",
          station,
          sourceRowIndex,
          column: col.displayHeader,
          rawValue: rawVal,
          description: `Missing or non-numeric value for "${col.displayHeader}" on row ${sourceRowIndex}.`,
        });
      } else {
        allMissing = false;

        // Impossible check: negative
        if (val < 0) {
          flags.push({
            id: `FL${flagCounter++}`,
            type: "impossible",
            severity: "error",
            station,
            sourceRowIndex,
            column: col.displayHeader,
            rawValue: String(val),
            description: `Impossible negative reading (${val}) for "${col.displayHeader}" on row ${sourceRowIndex}. Physical concentrations cannot be negative.`,
          });
        }

        // Impossible check: exceeding upper physical threshold
        const maxLimit = IMPOSSIBLE_MAX_LIMITS[col.standardKey];
        if (maxLimit && val > maxLimit) {
          flags.push({
            id: `FL${flagCounter++}`,
            type: "impossible",
            severity: "error",
            station,
            sourceRowIndex,
            column: col.displayHeader,
            rawValue: String(val),
            description: `Unrealistically high reading (${val}) for "${col.displayHeader}" on row ${sourceRowIndex} exceeds maximum plausible sensor bound (${maxLimit}).`,
          });
        }

        // Stuck values tracker
        const trackerKey = `${station}::${col.standardKey}`;
        const history = consecutiveTracker.get(trackerKey) || [];

        if (history.length > 0 && history[history.length - 1].value === val && val > 0) {
          history.push({ value: val, rowIndex: sourceRowIndex });
        } else {
          // If previous sequence reached >= 3 before breaking, record it now!
          flushStreakIfStuck(trackerKey, history);
          consecutiveTracker.set(trackerKey, [{ value: val, rowIndex: sourceRowIndex }]);
        }
      }
    }

    if (allMissing && columnsToCheck.length > 0) {
      flags.push({
        id: `FL${flagCounter++}`,
        type: "missing",
        severity: "error",
        station,
        sourceRowIndex,
        column: "All Pollutants",
        rawValue: "Empty row",
        description: `Source row ${sourceRowIndex} contains no measurable pollutant data.`,
      });
    }
  }

  // Flush remaining stuck streaks at end of telemetry stream
  for (const [key, history] of consecutiveTracker.entries()) {
    flushStreakIfStuck(key, history);
  }

  // Deduplicate and emit stuck flags
  const emittedStuckKeys = new Set<string>();
  for (const streak of recordedStuckStreaks) {
    const streakKey = `${streak.station}::${streak.pollutant}::${streak.value}::${streak.rows.join("-")}`;
    if (!emittedStuckKeys.has(streakKey)) {
      emittedStuckKeys.add(streakKey);
      flags.push({
        id: `FL${flagCounter++}`,
        type: "stuck_value",
        severity: "error",
        station: streak.station,
        sourceRowIndex: streak.rows[streak.rows.length - 1],
        column: streak.pollutant,
        rawValue: String(streak.value),
        description: `Sensor for "${streak.station}" stuck at identical reading ${streak.value} across ${streak.rows.length} consecutive rows (${streak.rows.join(", ")}). Possible frozen transducer or communication loop.`,
      });
    }
  }

  return flags;
}

/**
 * Rows that are allowed to contribute to facts: they have a computable AQI and
 * no "impossible" or "duplicate" flag. Flagged rows are still shown, never hidden.
 */
export function getFactEligibleRows(rows: NormalizedRow[], flags: DataFlag[]): NormalizedRow[] {
  const excluded = new Set(
    flags
      .filter((fl) => fl.type === "impossible" || fl.type === "duplicate")
      .map((fl) => fl.sourceRowIndex)
  );
  return rows.filter(
    (r) => r.calculatedAqi !== null && !isNaN(r.calculatedAqi) && !excluded.has(r.sourceRowIndex)
  );
}

/**
 * Computes deterministic fact statements with IDs (F1..Fn).
 * Strictly groundable to source rows.
 */
export function computeFacts(rows: NormalizedRow[], flags: DataFlag[]): ComputedFact[] {
  const facts: ComputedFact[] = [];
  let factCounter = 1;

  // Filter valid rows with AQI. Rows carrying an impossible or duplicate flag
  // stay visible in the flags panel but are excluded from computed facts.
  const validAqiRows = getFactEligibleRows(rows, flags);

  if (validAqiRows.length === 0) {
    facts.push({
      id: `F${factCounter++}`,
      category: "data_integrity",
      title: "Insufficient Valid Air Quality Data",
      statement: `Analyzed ${rows.length} rows, but no valid AQI or pollutant values could be calculated.`,
      sourceRowIndices: rows.map((r) => r.sourceRowIndex),
      station: "All Stations",
      metric: "AQI",
      value: 0,
      unit: "Index",
    });
    return facts;
  }

  // 1. Overall Average AQI Fact
  const aqiSum = validAqiRows.reduce((sum, r) => sum + (r.calculatedAqi || 0), 0);
  const avgAqi = Math.round((aqiSum / validAqiRows.length) * 10) / 10;
  const avgCategory = getAqiCategory(avgAqi);

  facts.push({
    id: `F${factCounter++}`,
    category: "average",
    title: "Overall Network Average AQI",
    statement: `The network-wide average AQI across ${validAqiRows.length} valid measurements is ${avgAqi}, placing the regional air quality in the "${avgCategory.name}" category.`,
    sourceRowIndices: validAqiRows.map((r) => r.sourceRowIndex),
    station: "All Stations",
    metric: "AQI",
    value: avgAqi,
    unit: "Index",
    cpcbCategory: avgCategory.name,
  });

  // 2. Station-wise Averages
  const stationGroups = new Map<string, NormalizedRow[]>();
  for (const r of validAqiRows) {
    const list = stationGroups.get(r.station) || [];
    list.push(r);
    stationGroups.set(r.station, list);
  }

  for (const [stName, stRows] of stationGroups.entries()) {
    const stAqiSum = stRows.reduce((s, r) => s + (r.calculatedAqi || 0), 0);
    const stAvgAqi = Math.round((stAqiSum / stRows.length) * 10) / 10;
    const stCategory = getAqiCategory(stAvgAqi);

    facts.push({
      id: `F${factCounter++}`,
      category: "average",
      title: `Average AQI for ${stName}`,
      statement: `Station "${stName}" averaged an AQI of ${stAvgAqi} (${stCategory.name}) across ${stRows.length} observations.`,
      sourceRowIndices: stRows.map((r) => r.sourceRowIndex),
      station: stName,
      metric: "AQI",
      value: stAvgAqi,
      unit: "Index",
      cpcbCategory: stCategory.name,
    });
  }

  // 3. Hotspot Fact (Max AQI)
  const sortedByAqi = [...validAqiRows].sort(
    (a, b) => (b.calculatedAqi || 0) - (a.calculatedAqi || 0)
  );
  const peakRow = sortedByAqi[0];
  const peakCategory = getAqiCategory(peakRow.calculatedAqi!);

  facts.push({
    id: `F${factCounter++}`,
    category: "hotspot",
    title: `Peak Pollution Hotspot at ${peakRow.station}`,
    statement: `The highest recorded AQI was ${peakRow.calculatedAqi} (${peakCategory.name}) observed at "${peakRow.station}"${
      peakRow.timestamp ? ` at ${peakRow.timestamp}` : ""
    }, driven primarily by ${peakRow.dominantPollutant || "PM2.5"}.`,
    sourceRowIndices: [peakRow.sourceRowIndex],
    station: peakRow.station,
    metric: "AQI",
    value: peakRow.calculatedAqi!,
    unit: "Index",
    cpcbCategory: peakCategory.name,
  });

  // 4. Cleanest Zone Fact (Min AQI)
  const cleanestRow = sortedByAqi[sortedByAqi.length - 1];
  const cleanestCategory = getAqiCategory(cleanestRow.calculatedAqi!);

  facts.push({
    id: `F${factCounter++}`,
    category: "cleanest_zone",
    title: `Lowest Pollution Zone at ${cleanestRow.station}`,
    statement: `The cleanest air quality was recorded at "${cleanestRow.station}"${
      cleanestRow.timestamp ? ` at ${cleanestRow.timestamp}` : ""
    } with an AQI of ${cleanestRow.calculatedAqi} (${cleanestCategory.name}).`,
    sourceRowIndices: [cleanestRow.sourceRowIndex],
    station: cleanestRow.station,
    metric: "AQI",
    value: cleanestRow.calculatedAqi!,
    unit: "Index",
    cpcbCategory: cleanestCategory.name,
  });

  // 5. CPCB Standard Exceedance Facts (PM2.5 > 60 ug/m3 24-hr standard or AQI > 200 Poor)
  const severeRows = validAqiRows.filter((r) => (r.calculatedAqi || 0) >= 401);
  if (severeRows.length > 0) {
    facts.push({
      id: `F${factCounter++}`,
      category: "standard_exceedance",
      title: "CPCB Severe Category Threshold Exceedances",
      statement: `${severeRows.length} out of ${validAqiRows.length} observations (${Math.round(
        (severeRows.length / validAqiRows.length) * 100
      )}%) breached the CPCB "Severe" emergency benchmark (AQI >= 401).`,
      sourceRowIndices: severeRows.map((r) => r.sourceRowIndex),
      station: "Severe Zones",
      metric: "Severe Count",
      value: severeRows.length,
      unit: "occurrences",
      cpcbCategory: "Severe",
    });
  }

  const poorOrWorseRows = validAqiRows.filter((r) => (r.calculatedAqi || 0) >= 201);
  if (poorOrWorseRows.length > 0 && poorOrWorseRows.length !== severeRows.length) {
    facts.push({
      id: `F${factCounter++}`,
      category: "standard_exceedance",
      title: "Poor to Severe Category Exceedance",
      statement: `${poorOrWorseRows.length} observations (${Math.round(
        (poorOrWorseRows.length / validAqiRows.length) * 100
      )}%) fell into "Poor", "Very Poor", or "Severe" categories (AQI >= 201).`,
      sourceRowIndices: poorOrWorseRows.map((r) => r.sourceRowIndex),
      station: "All Stations",
      metric: "Exceedance Count",
      value: poorOrWorseRows.length,
      unit: "occurrences",
      cpcbCategory: "Poor",
    });
  }

  // 6. Chronological Trend Facts: compare first vs last reading within the SAME station
  for (const [stName, stRows] of stationGroups.entries()) {
    const timed = stRows.filter((r) => !!r.timestamp);
    if (timed.length < 2) continue;
    const firstRow = timed[0];
    const lastRow = timed[timed.length - 1];
    const firstAqi = firstRow.calculatedAqi!;
    const lastAqi = lastRow.calculatedAqi!;
    const delta = lastAqi - firstAqi;
    const pctChange = Math.round(firstAqi > 0 ? (delta / firstAqi) * 100 : 0);
    const direction = delta > 0 ? "increased" : delta < 0 ? "decreased" : "remained unchanged";

    facts.push({
      id: `F${factCounter++}`,
      category: "trend",
      title: `AQI Trend at ${stName}`,
      statement: `At "${stName}", AQI ${direction} by ${Math.abs(delta)} points (${Math.abs(pctChange)}%) from ${firstAqi} at ${firstRow.timestamp} to ${lastAqi} at ${lastRow.timestamp}.`,
      sourceRowIndices: [firstRow.sourceRowIndex, lastRow.sourceRowIndex],
      station: stName,
      metric: "AQI Delta",
      value: delta,
      unit: "points",
    });
  }

  // 7. Data Quality & Sensor Reliability Fact
  const flaggedRowIndices = Array.from(new Set(flags.map((fl) => fl.sourceRowIndex))).sort((a, b) => a - b);
  const dataQualityRate = Math.round(
    ((rows.length - flaggedRowIndices.length) / (rows.length || 1)) * 100
  );

  facts.push({
    id: `F${factCounter++}`,
    category: "data_integrity",
    title: "Data Integrity & Sensor Telemetry Audit",
    statement: `Audited ${rows.length} total rows: ${flags.length} data flags were detected across ${flaggedRowIndices.length} rows (${dataQualityRate}% clean sensor data rate). Flagged data is retained and surfaced for civic audit.`,
    sourceRowIndices: flaggedRowIndices.length > 0 ? flaggedRowIndices : rows.map((r) => r.sourceRowIndex),
    station: "Telemetry Audit",
    metric: "Clean Data Rate",
    value: dataQualityRate,
    unit: "%",
  });

  return facts;
}

/**
 * High-level analysis pipeline coordinating flags and fact generation.
 */
export function analyzeAirQualityData(rows: NormalizedRow[]): AnalysisOutput {
  const flags = detectDataFlags(rows);
  const facts = computeFacts(rows, flags);

  const validAqiRows = getFactEligibleRows(rows, flags);
  const aqiSum = validAqiRows.reduce((sum, r) => sum + (r.calculatedAqi || 0), 0);
  const overallAvg =
    validAqiRows.length > 0 ? Math.round((aqiSum / validAqiRows.length) * 10) / 10 : null;
  const overallCat = overallAvg !== null ? getAqiCategory(overallAvg).name : null;

  const sorted = [...validAqiRows].sort(
    (a, b) => (b.calculatedAqi || 0) - (a.calculatedAqi || 0)
  );
  const peak = sorted[0];
  const cleanest = sorted[sorted.length - 1];

  const flaggedRowsSet = new Set(flags.map((f) => f.sourceRowIndex));

  return {
    normalizedRows: rows,
    flags,
    facts,
    summary: {
      totalRows: rows.length,
      flaggedRowsCount: flaggedRowsSet.size,
      overallAverageAqi: overallAvg,
      overallCategory: overallCat,
      peakAqi: peak ? peak.calculatedAqi : null,
      peakStation: peak ? peak.station : null,
      peakRowIndex: peak ? peak.sourceRowIndex : null,
      cleanestAqi: cleanest ? cleanest.calculatedAqi : null,
      cleanestStation: cleanest ? cleanest.station : null,
    },
  };
}
