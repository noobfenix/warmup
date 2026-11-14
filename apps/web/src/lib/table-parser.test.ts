import { describe, it, expect } from "vitest";
import {
  parseRawTableInput,
  heuristicMapColumns,
  normalizeTableData,
} from "./table-parser";

describe("Table Parser & Normalizer", () => {
  const sampleCsv = `Station,Timestamp,PM2.5 (ug/m3),PM10,NO2,AQI
Connaught Place,2026-11-14 08:00,145.5,230,45,320
Anand Vihar,2026-11-14 08:00,280.0,410,85,420
Lodhi Road,2026-11-14 08:00,42.0,80,25,85`;

  it("parses CSV lines and identifies headers and records", () => {
    const parsed = parseRawTableInput(sampleCsv);
    expect(parsed.headers).toEqual(["Station", "Timestamp", "PM2.5 (ug/m3)", "PM10", "NO2", "AQI"]);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.rows[0]["Station"]).toBe("Connaught Place");
    expect(parsed.rows[1]["PM2.5 (ug/m3)"]).toBe("280.0");
  });

  it("heuristically identifies station, timestamp, pollutants, and units", () => {
    const parsed = parseRawTableInput(sampleCsv);
    const mapping = heuristicMapColumns(parsed.headers);

    expect(mapping.stationColumn).toBe("Station");
    expect(mapping.timestampColumn).toBe("Timestamp");
    expect(mapping.mappings.length).toBe(4);

    const pm25Map = mapping.mappings.find((m) => m.standardPollutant === "PM2.5");
    expect(pm25Map).toBeDefined();
    expect(pm25Map?.detectedUnit).toBe("ug/m3");

    const aqiMap = mapping.mappings.find((m) => m.standardPollutant === "AQI");
    expect(aqiMap).toBeDefined();
  });

  it("normalizes records into structured data with 1-based sourceRowIndex and CPCB categories", () => {
    const parsed = parseRawTableInput(sampleCsv);
    const mapping = heuristicMapColumns(parsed.headers);
    const normalized = normalizeTableData(parsed, mapping);

    expect(normalized.length).toBe(3);
    expect(normalized[0].sourceRowIndex).toBe(1);
    expect(normalized[0].station).toBe("Connaught Place");
    expect(normalized[0].values["PM2.5"]).toBe(145.5);
    expect(normalized[0].calculatedAqi).toBe(320); // From AQI column
    expect(normalized[0].cpcbCategory).toBe("Very Poor");

    expect(normalized[1].sourceRowIndex).toBe(2);
    expect(normalized[1].station).toBe("Anand Vihar");
    expect(normalized[1].calculatedAqi).toBe(420);
    expect(normalized[1].cpcbCategory).toBe("Severe");

    expect(normalized[2].sourceRowIndex).toBe(3);
    expect(normalized[2].station).toBe("Lodhi Road");
    expect(normalized[2].calculatedAqi).toBe(85);
    expect(normalized[2].cpcbCategory).toBe("Satisfactory");
  });

  it("handles JSON input format transparently", () => {
    const sampleJson = JSON.stringify([
      { "Ward Name": "Ward A", "Recorded At": "10:00", "PM2.5": 55 },
      { "Ward Name": "Ward B", "Recorded At": "10:00", "PM2.5": 115 },
    ]);
    const parsed = parseRawTableInput(sampleJson);
    expect(parsed.delimiter).toBe("json");
    expect(parsed.rows.length).toBe(2);

    const mapping = heuristicMapColumns(parsed.headers);
    expect(mapping.stationColumn).toBe("Ward Name");
    expect(mapping.timestampColumn).toBe("Recorded At");

    const normalized = normalizeTableData(parsed, mapping);
    expect(normalized[0].station).toBe("Ward A");
    expect(normalized[0].values["PM2.5"]).toBe(55);
  });
});
