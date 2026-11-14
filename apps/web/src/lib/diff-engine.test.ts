import { describe, it, expect } from "vitest";
import { computeAirQualityDiff } from "./diff-engine";
import type { AnalysisOutput } from "./flags-and-facts";

describe("Chronological Diff Engine", () => {
  const baseAnalysis: AnalysisOutput = {
    normalizedRows: [],
    flags: [],
    facts: [],
    summary: {
      totalRows: 5,
      flaggedRowsCount: 0,
      overallAverageAqi: 120,
      overallCategory: "Moderate",
      peakAqi: 180,
      peakStation: "North Ward",
      peakRowIndex: 1,
      cleanestAqi: 65,
      cleanestStation: "East Ward",
    },
  };

  it("handles first run without previous briefing gracefully", () => {
    const diff = computeAirQualityDiff(baseAnalysis, null);
    expect(diff.hasPrevious).toBe(false);
    expect(diff.status).toBe("first_run");
    expect(diff.currentAvgAqi).toBe(120);
    expect(diff.ruleBasedNarrative).toContain("Initial baseline");
  });

  it("accurately computes delta when air quality worsens", () => {
    const worseAnalysis: AnalysisOutput = {
      ...baseAnalysis,
      flags: [
        {
          id: "FL1",
          type: "missing",
          severity: "warning",
          station: "North Ward",
          sourceRowIndex: 2,
          column: "PM10",
          rawValue: "",
          description: "Missing",
        },
      ],
      summary: {
        totalRows: 5,
        flaggedRowsCount: 1,
        overallAverageAqi: 240, // Increased from 120
        overallCategory: "Poor", // Transitioned from Moderate to Poor
        peakAqi: 310,
        peakStation: "Industrial Sector", // Hotspot shifted
        peakRowIndex: 3,
        cleanestAqi: 110,
        cleanestStation: "East Ward",
      },
    };

    const diff = computeAirQualityDiff(worseAnalysis, baseAnalysis);
    expect(diff.hasPrevious).toBe(true);
    expect(diff.status).toBe("worsened");
    expect(diff.avgAqiDelta).toBe(120);
    expect(diff.avgAqiPctChange).toBe(100);
    expect(diff.previousCategory).toBe("Moderate");
    expect(diff.currentCategory).toBe("Poor");
    expect(diff.categoryChanged).toBe(true);
    expect(diff.hotspotShift.changed).toBe(true);
    expect(diff.hotspotShift.currentStation).toBe("Industrial Sector");
    expect(diff.flagDelta.difference).toBe(1);
    expect(diff.ruleBasedNarrative).toContain("worsened by +120 points");
    expect(diff.ruleBasedNarrative).toContain("Industrial Sector");
  });

  it("accurately computes delta when air quality improves", () => {
    const improvedAnalysis: AnalysisOutput = {
      ...baseAnalysis,
      summary: {
        totalRows: 5,
        flaggedRowsCount: 0,
        overallAverageAqi: 70, // Decreased from 120
        overallCategory: "Satisfactory",
        peakAqi: 90,
        peakStation: "North Ward",
        peakRowIndex: 1,
        cleanestAqi: 50,
        cleanestStation: "East Ward",
      },
    };

    const diff = computeAirQualityDiff(improvedAnalysis, baseAnalysis);
    expect(diff.hasPrevious).toBe(true);
    expect(diff.status).toBe("improved");
    expect(diff.avgAqiDelta).toBe(-50);
    expect(diff.ruleBasedNarrative).toContain("improved by 50 points");
  });
});
