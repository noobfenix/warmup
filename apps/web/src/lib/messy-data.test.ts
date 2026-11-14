import { describe, it, expect } from "vitest";
import { parseRawTableInput, heuristicMapColumns, normalizeTableData } from "./table-parser";
import { analyzeAirQualityData } from "./flags-and-facts";
import { SAMPLE_DATASETS } from "../config/sample-datasets";

function analyze(text: string) {
  const parsed = parseRawTableInput(text);
  return analyzeAirQualityData(normalizeTableData(parsed, heuristicMapColumns(parsed.headers)));
}

const MESSY = `Ward / Site ; Recorded At ; PM 2.5 µg/m³ ; PM10 ; NO2 (ppb) ; O3
"Ward 12, Shivaji Nagar";2026-11-14 07:00;95;180;40;50
Ward 12, Shivaji Nagar;2026-11-14 07:00;400;500;40;50
;2026-11-14 08:00;NA;--;;
Ward 7;2026-11-14 09:00;abc;9999;20;-3
Ward 7;2026-11-14 10:00;45;80;20;30`;

describe("Messy real-world input", () => {
  const result = analyze(MESSY);

  it("parses semicolons, quoted commas, unicode units and ppb conversion", () => {
    expect(result.normalizedRows).toHaveLength(5);
    expect(result.normalizedRows[0].station).toBe("Ward 12, Shivaji Nagar");
    expect(result.normalizedRows[0].values.NO2).toBeCloseTo(75.2); // 40 ppb * 1.88
  });

  it("raises every flag type with exact 1-based source rows", () => {
    const byType = (t: string) => result.flags.filter((f) => f.type === t).map((f) => f.sourceRowIndex);
    expect(byType("duplicate")).toEqual([2]);
    expect(byType("missing")).toContain(3);
    expect(byType("missing")).toContain(4); // "abc" is non-numeric
    expect(byType("impossible")).toEqual([4, 4]); // PM10 9999 and O3 -3
  });

  it("keeps flagged rows visible but excludes impossible/duplicate rows from facts", () => {
    // Row 4 (PM10 = 9999) would compute AQI 500 and become a fake hotspot.
    const hotspot = result.facts.find((f) => f.category === "hotspot")!;
    expect(hotspot.sourceRowIndices).not.toContain(4);
    expect(hotspot.sourceRowIndices).not.toContain(2);
    for (const fact of result.facts.filter((f) => f.category !== "data_integrity")) {
      expect(fact.sourceRowIndices).not.toContain(2);
      expect(fact.sourceRowIndices).not.toContain(4);
    }
    expect(result.summary.peakRowIndex).toBe(1);
    expect(result.normalizedRows.map((r) => r.sourceRowIndex)).toEqual([1, 2, 3, 4, 5]);
  });

  it("lists data-integrity source rows in ascending order", () => {
    const integrity = result.facts.find((f) => f.category === "data_integrity")!;
    const rows = integrity.sourceRowIndices;
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
  });
});

describe("Trend facts", () => {
  it("never compares readings from two different stations", () => {
    for (const sample of SAMPLE_DATASETS) {
      const { facts, normalizedRows } = analyze(sample.data);
      for (const trend of facts.filter((f) => f.category === "trend")) {
        const stations = trend.sourceRowIndices.map(
          (i) => normalizedRows.find((r) => r.sourceRowIndex === i)!.station
        );
        expect(new Set(stations).size).toBe(1);
        expect(trend.station).toBe(stations[0]);
      }
    }
  });

  it("reports the per-station change for Delhi's Anand Vihar (435 -> 385)", () => {
    const { facts } = analyze(SAMPLE_DATASETS[0].data);
    const anand = facts.find((f) => f.category === "trend" && f.station === "Anand Vihar")!;
    expect(anand.value).toBe(-50);
    expect(anand.sourceRowIndices).toEqual([1, 2]);
  });
});

describe("Every fact is grounded in real rows", () => {
  it("cites only existing source rows for every sample dataset", () => {
    for (const sample of SAMPLE_DATASETS) {
      const { facts, normalizedRows } = analyze(sample.data);
      const rowIds = new Set(normalizedRows.map((r) => r.sourceRowIndex));
      facts.forEach((f, i) => {
        expect(f.id).toBe(`F${i + 1}`);
        expect(f.sourceRowIndices.length).toBeGreaterThan(0);
        f.sourceRowIndices.forEach((idx) => expect(rowIds.has(idx)).toBe(true));
      });
    }
  });
});
