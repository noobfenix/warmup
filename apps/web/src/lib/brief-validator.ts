import { z } from "zod";
import type { ComputedFact } from "./flags-and-facts";

export const BriefFindingSchema = z.object({
  factIds: z.array(z.string()).min(1, "Each finding must cite at least one Fact ID"),
  finding: z.string().min(5),
  severity: z.enum(["info", "warning", "critical"]),
});

export const PrioritizedActionSchema = z.object({
  priority: z.enum([
    "Immediate (1-2 Hours)",
    "Short-term (Today)",
    "Preventive (24-48 Hours)",
  ]),
  action: z.string().min(5),
  targetGroup: z.string().min(2),
  rationaleFactIds: z.array(z.string()).default([]),
});

export const CitizenAdvisorySchema = z.object({
  generalPublic: z.string().min(10),
  vulnerableGroups: z.object({
    children: z.string().min(10),
    olderAdults: z.string().min(10),
    sensitivePeople: z.string().min(10),
  }),
});

export const CivicBriefResponseSchema = z.object({
  title: z.string().min(3),
  audience: z.string(),
  language: z.string(),
  readingLevel: z.string(),
  executiveSummary: z.string().min(10),
  findings: z.array(BriefFindingSchema),
  prioritizedActions: z.array(PrioritizedActionSchema),
  internalBriefingNote: z.string().min(15),
  citizenAdvisory: CitizenAdvisorySchema,
  medicalDisclaimer: z.string().min(10),
  diffNarrative: z.string().optional(),
  modelUsed: z.string().optional(),
  fallbackModels: z.array(z.string()).optional(),
});

export type CivicBriefResponse = z.infer<typeof CivicBriefResponseSchema>;
export type BriefFinding = z.infer<typeof BriefFindingSchema>;
export type PrioritizedAction = z.infer<typeof PrioritizedActionSchema>;

export interface RejectedFindingRecord {
  finding: BriefFinding;
  unknownFactIds: string[];
  reason: string;
}

export interface ValidationEnforcementResult {
  brief: CivicBriefResponse;
  rejectedFindings: RejectedFindingRecord[];
  allCitedFactIds: string[];
  groundingScore: number; // percentage 0-100
  passedAuditing: boolean;
}

export interface BriefAuditInfo {
  groundingScore: number;
  passedAuditing: boolean;
  rejectedFindingsCount: number;
  rejectedFindings?: RejectedFindingRecord[];
  allCitedFactIds?: string[];
  modelUsed?: string;
  fallbackModels?: string[];
}

/**
 * Validates brief findings against computed Fact IDs.
 * Strictly REJECTS findings that cite unknown or hallucinatory Fact IDs.
 * Sanitizes actions to only retain known Fact IDs.
 */
export function validateAndEnforceFactIds(
  brief: CivicBriefResponse,
  allowedFacts: ComputedFact[]
): ValidationEnforcementResult {
  const allowedFactIdSet = new Set(allowedFacts.map((f) => f.id));
  const acceptedFindings: BriefFinding[] = [];
  const rejectedFindings: RejectedFindingRecord[] = [];
  const allCitedFactIds = new Set<string>();

  for (const finding of brief.findings) {
    const unknownIds = finding.factIds.filter((id) => !allowedFactIdSet.has(id));

    if (unknownIds.length > 0) {
      // REJECT finding citing unknown fact IDs
      rejectedFindings.push({
        finding,
        unknownFactIds: unknownIds,
        reason: `Rejected: Finding references unverified Fact IDs [${unknownIds.join(
          ", "
        )}] not present in computed facts table (${Array.from(allowedFactIdSet).join(", ")}).`,
      });
    } else {
      acceptedFindings.push(finding);
      finding.factIds.forEach((id) => allCitedFactIds.add(id));
    }
  }

  // Validate rationale fact IDs in actions
  const sanitizedActions = brief.prioritizedActions.map((action) => {
    const validRationales = action.rationaleFactIds.filter((id) =>
      allowedFactIdSet.has(id)
    );
    validRationales.forEach((id) => allCitedFactIds.add(id));
    return {
      ...action,
      rationaleFactIds: validRationales,
    };
  });

  const totalRawFindings = brief.findings.length;
  const groundingScore =
    totalRawFindings > 0
      ? Math.round((acceptedFindings.length / totalRawFindings) * 100)
      : 100;

  // Enforce mandatory non-medical disclaimer
  const medicalDisclaimer =
    brief.medicalDisclaimer &&
    brief.medicalDisclaimer.toLowerCase().includes("not medical advice")
      ? brief.medicalDisclaimer
      : "PUBLIC HEALTH & CIVIC ADVISORY ONLY - This briefing does not provide clinical diagnoses, medical treatment, or pharmaceutical prescriptions. Individuals experiencing severe acute respiratory symptoms should seek immediate guidance from certified healthcare professionals.";

  const validatedBrief: CivicBriefResponse = {
    ...brief,
    findings: acceptedFindings,
    prioritizedActions: sanitizedActions,
    medicalDisclaimer,
  };

  return {
    brief: validatedBrief,
    rejectedFindings,
    allCitedFactIds: Array.from(allCitedFactIds),
    groundingScore,
    passedAuditing: rejectedFindings.length === 0,
  };
}
