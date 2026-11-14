import { calculateRowAqi, getAqiCategory, type StandardPollutant, type PollutantValues, type AqiCategoryName } from "./cpcb";

export interface ColumnMappingItem {
  sourceColumn: string;
  standardPollutant: StandardPollutant | "AQI" | "UNKNOWN";
  detectedUnit: string;
  conversionFactor: number;
  confidence: number;
}

export interface ColumnUnitMappingResult {
  stationColumn: string;
  timestampColumn?: string;
  mappings: ColumnMappingItem[];
}

export interface NormalizedRow {
  sourceRowIndex: number; // 1-indexed relative to raw data (excluding header)
  station: string;
  timestamp?: string;
  values: PollutantValues;
  calculatedAqi: number | null;
  dominantPollutant: string | null;
  cpcbCategory: AqiCategoryName | null;
  rawValues: Record<string, string>;
  mappedColumns?: {
    sourceColumn: string;
    standardPollutant: StandardPollutant | "AQI";
  }[];
}

export interface ParsedRawTable {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

/**
 * Splits CSV/TSV line respecting quotes.
 */
function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (insideQuote && line[i + 1] === char) {
        current += char;
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === delimiter && !insideQuote) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detects delimiter (comma, tab, semicolon, pipe)
 */
function detectDelimiter(firstLine: string): string {
  const counts = {
    "\t": (firstLine.match(/\t/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "|": (firstLine.match(/\|/g) || []).length,
  };

  let maxDelim = ",";
  let maxCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxDelim = delim;
    }
  }
  return maxDelim;
}

/**
 * Parses raw tabular input (CSV, TSV, or JSON)
 */
export function parseRawTableInput(rawText: string): ParsedRawTable {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { headers: [], rows: [], delimiter: "," };
  }

  // Attempt JSON parse
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const arrayData = Array.isArray(parsedJson)
        ? parsedJson
        : parsedJson.data && Array.isArray(parsedJson.data)
        ? parsedJson.data
        : [parsedJson];

      if (arrayData.length > 0 && typeof arrayData[0] === "object") {
        const headers: string[] = Array.from(
          new Set(arrayData.flatMap((obj: Record<string, unknown>) => Object.keys(obj)))
        );
        const rows = arrayData.map((obj: Record<string, unknown>) => {
          const row: Record<string, string> = {};
          for (const h of headers) {
            row[h] = obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : "";
          }
          return row;
        });
        return { headers, rows, delimiter: "json" };
      }
    } catch {
      // Continue to tabular parsing if JSON parsing fails
    }
  }

  // Delimited tabular parsing
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: "," };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map((h) =>
    h.replace(/^["']|["']$/g, "").trim()
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitDelimitedLine(lines[i], delimiter);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = (values[index] ?? "").replace(/^["']|["']$/g, "").trim();
    });
    rows.push(rowObj);
  }

  return { headers, rows, delimiter };
}

/**
 * Deterministic heuristic column & unit mapper.
 * Used when Gemini is offline or as immediate instant mapping.
 */
export function heuristicMapColumns(headers: string[]): ColumnUnitMappingResult {
  let stationColumn = "";
  let timestampColumn: string | undefined = undefined;
  const mappings: ColumnMappingItem[] = [];

  for (const header of headers) {
    const lower = header.toLowerCase();

    // Check station / location
    if (!stationColumn && (lower.includes("station") || lower.includes("location") || lower.includes("ward") || lower.includes("site") || lower.includes("area") || lower.includes("sensor"))) {
      stationColumn = header;
      continue;
    }

    // Check timestamp / date / record
    if (!timestampColumn && (lower.includes("time") || lower.includes("date") || lower.includes("hour") || lower.includes("day") || lower.includes("recorded") || lower.includes("timestamp") || lower.includes("datetime"))) {
      timestampColumn = header;
      continue;
    }

    // Check Pollutants & Units
    let standardPollutant: StandardPollutant | "AQI" | "UNKNOWN" = "UNKNOWN";
    let detectedUnit = "ug/m3";
    let conversionFactor = 1.0;
    let confidence = 0.5;

    if (/pm\s*2\.?5/i.test(header) || /fine\s*particulate/i.test(header)) {
      standardPollutant = "PM2.5";
      detectedUnit = "ug/m3";
      confidence = 0.95;
    } else if (/pm\s*10/i.test(header) || /respirable\s*particulate/i.test(header)) {
      standardPollutant = "PM10";
      detectedUnit = "ug/m3";
      confidence = 0.95;
    } else if (/\bno2\b/i.test(header) || /nitrogen\s*dioxide/i.test(header)) {
      standardPollutant = "NO2";
      detectedUnit = lower.includes("ppb") ? "ppb" : lower.includes("ppm") ? "ppm" : "ug/m3";
      conversionFactor = detectedUnit === "ppb" ? 1.88 : detectedUnit === "ppm" ? 1880 : 1.0;
      confidence = 0.9;
    } else if (/\bso2\b/i.test(header) || /sulphur\s*dioxide|sulfur\s*dioxide/i.test(header)) {
      standardPollutant = "SO2";
      detectedUnit = lower.includes("ppb") ? "ppb" : lower.includes("ppm") ? "ppm" : "ug/m3";
      conversionFactor = detectedUnit === "ppb" ? 2.62 : detectedUnit === "ppm" ? 2620 : 1.0;
      confidence = 0.9;
    } else if (/\bco\b/i.test(header) || /carbon\s*monoxide/i.test(header)) {
      standardPollutant = "CO";
      detectedUnit = lower.includes("ppm") ? "ppm" : "mg/m3";
      conversionFactor = detectedUnit === "ppm" ? 1.145 : 1.0; // ppm to mg/m3
      confidence = 0.9;
    } else if (/\bo3\b/i.test(header) || /ozone/i.test(header)) {
      standardPollutant = "O3";
      detectedUnit = lower.includes("ppb") ? "ppb" : lower.includes("ppm") ? "ppm" : "ug/m3";
      conversionFactor = detectedUnit === "ppb" ? 1.96 : detectedUnit === "ppm" ? 1960 : 1.0;
      confidence = 0.9;
    } else if (/\baqi\b/i.test(header) || /air\s*quality\s*index/i.test(header)) {
      standardPollutant = "AQI";
      detectedUnit = "index";
      confidence = 0.98;
    }

    if (standardPollutant !== "UNKNOWN") {
      mappings.push({
        sourceColumn: header,
        standardPollutant,
        detectedUnit,
        conversionFactor,
        confidence,
      });
    }
  }

  // Fallback for stationColumn if none matched
  if (!stationColumn && headers.length > 0) {
    // If first column isn't mapped as a pollutant, assume it's station/identifier
    const firstHeader = headers[0];
    const isMapped = mappings.some((m) => m.sourceColumn === firstHeader);
    if (!isMapped) {
      stationColumn = firstHeader;
    }
  }

  return {
    stationColumn: stationColumn || "Location",
    timestampColumn,
    mappings,
  };
}

/**
 * Normalizes parsed rows into structured numerical records.
 */
export function normalizeTableData(
  parsed: ParsedRawTable,
  mapping: ColumnUnitMappingResult
): NormalizedRow[] {
  const normalized: NormalizedRow[] = [];

  parsed.rows.forEach((row, index) => {
    const sourceRowIndex = index + 1; // 1-based index (header is line 0)
    const station = row[mapping.stationColumn] || `Station-${sourceRowIndex}`;
    const timestamp = mapping.timestampColumn ? row[mapping.timestampColumn] : undefined;

    const values: PollutantValues = {};

    for (const mapItem of mapping.mappings) {
      if (mapItem.standardPollutant === "UNKNOWN") continue;

      const rawValStr = row[mapItem.sourceColumn];
      if (rawValStr !== undefined && rawValStr.trim() !== "") {
        // Parse float, stripping non-numeric except minus and dot
        const cleanStr = rawValStr.replace(/[^0-9.-]/g, "");
        const parsedNum = parseFloat(cleanStr);
        if (!isNaN(parsedNum)) {
          const converted = parsedNum * mapItem.conversionFactor;
          values[mapItem.standardPollutant as keyof PollutantValues] =
            Math.round(converted * 100) / 100;
        } else {
          values[mapItem.standardPollutant as keyof PollutantValues] = null;
        }
      } else {
        values[mapItem.standardPollutant as keyof PollutantValues] = null;
      }
    }

    const aqiCalc = calculateRowAqi(values);
    const categoryInfo = aqiCalc.aqi !== null ? getAqiCategory(aqiCalc.aqi) : null;

    const activeMappedColumns = mapping.mappings
      .filter((m) => m.standardPollutant !== "UNKNOWN")
      .map((m) => ({
        sourceColumn: m.sourceColumn,
        standardPollutant: m.standardPollutant as StandardPollutant | "AQI",
      }));

    normalized.push({
      sourceRowIndex,
      station,
      timestamp,
      values,
      calculatedAqi: aqiCalc.aqi,
      dominantPollutant: aqiCalc.dominantPollutant,
      cpcbCategory: categoryInfo ? categoryInfo.name : null,
      rawValues: row,
      mappedColumns: activeMappedColumns,
    });
  });

  return normalized;
}
