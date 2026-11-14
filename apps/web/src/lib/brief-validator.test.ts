import { describe, it, expect } from "vitest";
import { validateAndEnforceFactIds, type CivicBriefResponse } from "./brief-validator";
import type { ComputedFact } from "./flags-and-facts";

describe("Brief Grounding & Fact ID Rejection Suite", () => {
  const allowedFacts: ComputedFact[] = [
    {
      id: "F1",
      category: "average",
      title: "Average AQI",
      statement: "Network average AQI is 195.",
      sourceRowIndices: [1, 2],
      station: "All Stations",
      metric: "AQI",
      value: 195,
      unit: "Index",
    },
    {
      id: "F2",
      category: "hotspot",
      title: "Peak Hotspot",
      statement: "Sector 4 hit peak AQI 380.",
      sourceRowIndices: [2],
      station: "Sector 4",
      metric: "AQI",
      value: 380,
      unit: "Index",
    },
  ];

  const mockBrief: CivicBriefResponse = {
    title: "Ward 4 Civic Advisory",
    audience: "ward_officer",
    language: "en",
    readingLevel: "executive",
    executiveSummary: "Air quality in Ward 4 requires immediate municipal dust control.",
    findings: [
      {
        factIds: ["F1"],
        finding: "Average air quality across the ward remains within the Moderate/Poor boundary.",
        severity: "warning",
      },
      {
        factIds: ["F2"],
        finding: "Sector 4 represents an acute localized hotspot breaching 380 AQI.",
        severity: "critical",
      },
      // Hallucinated / Unknown fact citation: F99
      {
        factIds: ["F99"],
        finding: "Unverified rumor that Sector 9 recorded AQI 900.",
        severity: "critical",
      },
      // Partially unknown: F1 and F42
      {
        factIds: ["F1", "F42"],
        finding: "Combined statement relying partly on phantom fact F42.",
        severity: "warning",
      },
    ],
    prioritizedActions: [
      {
        priority: "Immediate (1-2 Hours)",
        action: "Deploy water misting cannons along Sector 4 corridor.",
        targetGroup: "Municipal Sanitation Team",
        rationaleFactIds: ["F2", "F999"], // F999 is unknown
      },
    ],
    internalBriefingNote: "Ward Officer should coordinate with traffic police.",
    citizenAdvisory: {
      generalPublic: "Limit morning outdoor jogs.",
      vulnerableGroups: {
        children: "Suspend outdoor playground sessions.",
        olderAdults: "Remain indoors in filtered areas.",
        sensitivePeople: "Keep rescue inhalers accessible as advised by personal physicians.",
      },
    },
    medicalDisclaimer: "Not medical advice.",
  };

  it("strictly REJECTS findings that cite unknown Fact IDs", () => {
    const result = validateAndEnforceFactIds(mockBrief, allowedFacts);

    // Two findings cited unknown IDs: F99 and [F1, F42]
    expect(result.rejectedFindings.length).toBe(2);
    expect(result.rejectedFindings[0].unknownFactIds).toEqual(["F99"]);
    expect(result.rejectedFindings[1].unknownFactIds).toEqual(["F42"]);

    // Only valid findings remain in the brief
    expect(result.brief.findings.length).toBe(2);
    expect(result.brief.findings[0].factIds).toEqual(["F1"]);
    expect(result.brief.findings[1].factIds).toEqual(["F2"]);

    // Action rationale cleaned
    expect(result.brief.prioritizedActions[0].rationaleFactIds).toEqual(["F2"]);

    expect(result.passedAuditing).toBe(false);
    expect(result.groundingScore).toBe(50); // 2 of 4 accepted = 50%
  });

  it("approves briefs where all citations are known", () => {
    const cleanBrief: CivicBriefResponse = {
      ...mockBrief,
      findings: [
        {
          factIds: ["F1"],
          finding: "Verified finding on regional average.",
          severity: "info",
        },
        {
          factIds: ["F2"],
          finding: "Verified finding on hotspot.",
          severity: "critical",
        },
      ],
      prioritizedActions: [
        {
          priority: "Immediate (1-2 Hours)",
          action: "Deploy mist cannons.",
          targetGroup: "Sanitation",
          rationaleFactIds: ["F2"],
        },
      ],
    };

    const result = validateAndEnforceFactIds(cleanBrief, allowedFacts);
    expect(result.rejectedFindings.length).toBe(0);
    expect(result.brief.findings.length).toBe(2);
    expect(result.passedAuditing).toBe(true);
    expect(result.groundingScore).toBe(100);
  });
});
