import { describe, it, expect } from "vitest";
import {
  detectDataFlags,
  computeFacts,
  analyzeAirQualityData,
} from "./flags-and-facts";
import type { NormalizedRow } from "./table-parser";

describe("Flags & Verifiable Facts Engine", () => {
  it("detects missing, impossible, duplicate, and stuck sensor values", () => {
    const mockRows: NormalizedRow[] = [
      {
        sourceRowIndex: 1,
        station: "Ward 1",
        timestamp: "08:00",
        values: { "PM2.5": 50, "PM10": 90 },
        calculatedAqi: 90,
        dominantPollutant: "PM10",
        cpcbCategory: "Satisfactory",
        rawValues: { Station: "Ward 1", Timestamp: "08:00", "PM2.5": "50", "PM10": "90" },
      },
      // Row 2: Impossible negative PM2.5
      {
        sourceRowIndex: 2,
        station: "Ward 1",
        timestamp: "09:00",
        values: { "PM2.5": -12, "PM10": 110 },
        calculatedAqi: 110,
        dominantPollutant: "PM10",
        cpcbCategory: "Moderate",
        rawValues: { Station: "Ward 1", Timestamp: "09:00", "PM2.5": "-12", "PM10": "110" },
      },
      // Row 3: Impossible high PM2.5 (2200 ug/m3)
      {
        sourceRowIndex: 3,
        station: "Ward 2",
        timestamp: "08:00",
        values: { "PM2.5": 2200, "PM10": 300 },
        calculatedAqi: 500,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Severe",
        rawValues: { Station: "Ward 2", Timestamp: "08:00", "PM2.5": "2200", "PM10": "300" },
      },
      // Row 4: Duplicate timestamp for Ward 1 (08:00 already occurred at row 1)
      {
        sourceRowIndex: 4,
        station: "Ward 1",
        timestamp: "08:00",
        values: { "PM2.5": 60, "PM10": 100 },
        calculatedAqi: 100,
        dominantPollutant: "PM10",
        cpcbCategory: "Satisfactory",
        rawValues: { Station: "Ward 1", Timestamp: "08:00", "PM2.5": "60", "PM10": "100" },
      },
      // Rows 5, 6, 7: Sensor stuck at exact identical reading 78.4 on Ward 3
      {
        sourceRowIndex: 5,
        station: "Ward 3",
        timestamp: "08:00",
        values: { "PM2.5": 78.4 },
        calculatedAqi: 165,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Moderate",
        rawValues: { Station: "Ward 3", Timestamp: "08:00", "PM2.5": "78.4" },
      },
      {
        sourceRowIndex: 6,
        station: "Ward 3",
        timestamp: "09:00",
        values: { "PM2.5": 78.4 },
        calculatedAqi: 165,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Moderate",
        rawValues: { Station: "Ward 3", Timestamp: "09:00", "PM2.5": "78.4" },
      },
      {
        sourceRowIndex: 7,
        station: "Ward 3",
        timestamp: "10:00",
        values: { "PM2.5": 78.4 },
        calculatedAqi: 165,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Moderate",
        rawValues: { Station: "Ward 3", Timestamp: "10:00", "PM2.5": "78.4" },
      },
      // Row 8: Missing pollutant value (null) with raw header "PM2.5 (ug/m3)"
      {
        sourceRowIndex: 8,
        station: "Ward 4",
        timestamp: "10:00",
        values: { "PM2.5": null },
        calculatedAqi: null,
        dominantPollutant: null,
        cpcbCategory: null,
        rawValues: { Station: "Ward 4", Timestamp: "10:00", "PM2.5 (ug/m3)": "" },
      },
    ];

    const flags = detectDataFlags(mockRows);

    const impossibleNegative = flags.find((f) => f.sourceRowIndex === 2 && f.type === "impossible");
    expect(impossibleNegative).toBeDefined();
    expect(impossibleNegative?.description).toContain("negative");

    const impossibleHigh = flags.find((f) => f.sourceRowIndex === 3 && f.type === "impossible");
    expect(impossibleHigh).toBeDefined();

    const duplicateFlag = flags.find((f) => f.sourceRowIndex === 4 && f.type === "duplicate");
    expect(duplicateFlag).toBeDefined();
    expect(duplicateFlag?.description).toContain("Duplicate timestamp");

    const stuckFlag = flags.find((f) => f.type === "stuck_value" && f.station === "Ward 3");
    expect(stuckFlag).toBeDefined();
    expect(stuckFlag?.rawValue).toBe("78.4");

    const missingFlag = flags.find((f) => f.sourceRowIndex === 8 && f.type === "missing");
    expect(missingFlag).toBeDefined();
  });

  it("detects stuck values even if sensor recovers on a subsequent row", () => {
    const rowsWithRecovery: NormalizedRow[] = [
      {
        sourceRowIndex: 1,
        station: "Sensor A",
        timestamp: "01:00",
        values: { "PM2.5": 45 },
        calculatedAqi: 75,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Satisfactory",
        rawValues: { Station: "Sensor A", "PM2.5 (ug/m3)": "45" },
      },
      {
        sourceRowIndex: 2,
        station: "Sensor A",
        timestamp: "02:00",
        values: { "PM2.5": 45 },
        calculatedAqi: 75,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Satisfactory",
        rawValues: { Station: "Sensor A", "PM2.5 (ug/m3)": "45" },
      },
      {
        sourceRowIndex: 3,
        station: "Sensor A",
        timestamp: "03:00",
        values: { "PM2.5": 45 },
        calculatedAqi: 75,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Satisfactory",
        rawValues: { Station: "Sensor A", "PM2.5 (ug/m3)": "45" },
      },
      // Row 4: Sensor recovers and reports 80
      {
        sourceRowIndex: 4,
        station: "Sensor A",
        timestamp: "04:00",
        values: { "PM2.5": 80 },
        calculatedAqi: 150,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Moderate",
        rawValues: { Station: "Sensor A", "PM2.5 (ug/m3)": "80" },
      },
    ];

    const flags = detectDataFlags(rowsWithRecovery);
    const stuckFlag = flags.find((f) => f.type === "stuck_value" && f.station === "Sensor A");
    expect(stuckFlag).toBeDefined();
    expect(stuckFlag?.rawValue).toBe("45");
  });

  it("computes verifiable Fact IDs (F1..Fn) with accurate source row tracking", () => {
    const cleanRows: NormalizedRow[] = [
      {
        sourceRowIndex: 1,
        station: "Zone North",
        timestamp: "06:00",
        values: { "PM2.5": 40, "AQI": 75 },
        calculatedAqi: 75,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Satisfactory",
        rawValues: { Station: "Zone North", AQI: "75" },
      },
      {
        sourceRowIndex: 2,
        station: "Zone South",
        timestamp: "06:00",
        values: { "PM2.5": 290, "AQI": 420 },
        calculatedAqi: 420,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Severe",
        rawValues: { Station: "Zone South", AQI: "420" },
      },
      {
        sourceRowIndex: 3,
        station: "Zone East",
        timestamp: "12:00",
        values: { "PM2.5": 110, "AQI": 240 },
        calculatedAqi: 240,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Poor",
        rawValues: { Station: "Zone East", AQI: "240" },
      },
    ];

    const flags = detectDataFlags(cleanRows);
    const facts = computeFacts(cleanRows, flags);

    // Verify IDs are sequential F1, F2...
    expect(facts.length).toBeGreaterThan(3);
    expect(facts[0]?.id).toBe("F1");
    expect(facts[1]?.id).toBe("F2");

    // Fact categories
    const avgFact = facts.find((f) => f.category === "average" && f.station === "All Stations");
    expect(avgFact).toBeDefined();
    expect(avgFact?.sourceRowIndices).toEqual([1, 2, 3]);
    // Avg of 75, 420, 240 is 245
    expect(avgFact?.value).toBe(245);
    expect(avgFact?.cpcbCategory).toBe("Poor");

    // Hotspot Fact
    const hotspotFact = facts.find((f) => f.category === "hotspot");
    expect(hotspotFact).toBeDefined();
    expect(hotspotFact?.station).toBe("Zone South");
    expect(hotspotFact?.value).toBe(420);
    expect(hotspotFact?.sourceRowIndices).toEqual([2]);

    // Cleanest Zone Fact
    const cleanestFact = facts.find((f) => f.category === "cleanest_zone");
    expect(cleanestFact).toBeDefined();
    expect(cleanestFact?.station).toBe("Zone North");
    expect(cleanestFact?.value).toBe(75);
    expect(cleanestFact?.sourceRowIndices).toEqual([1]);

    // Exceedance fact
    const severeFact = facts.find((f) => f.category === "standard_exceedance" && f.cpcbCategory === "Severe");
    expect(severeFact).toBeDefined();
    expect(severeFact?.sourceRowIndices).toEqual([2]);
  });

  it("produces full analysis output with summary metadata", () => {
    const rows: NormalizedRow[] = [
      {
        sourceRowIndex: 1,
        station: "School Alpha",
        timestamp: "08:00",
        values: { "PM2.5": 160 },
        calculatedAqi: 330,
        dominantPollutant: "PM2.5",
        cpcbCategory: "Very Poor",
        rawValues: {},
      },
    ];

    const analysis = analyzeAirQualityData(rows);
    expect(analysis.summary.totalRows).toBe(1);
    expect(analysis.summary.peakAqi).toBe(330);
    expect(analysis.summary.peakStation).toBe("School Alpha");
    expect(analysis.summary.peakRowIndex).toBe(1);
  });
});
