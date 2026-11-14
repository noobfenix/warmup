import "server-only";
import { generateJsonWithGemini, createGeminiClient } from "./gemini.server";
import {
  CivicBriefResponseSchema,
  validateAndEnforceFactIds,
  type CivicBriefResponse,
  type ValidationEnforcementResult,
} from "./brief-validator";
import type { ComputedFact, DataFlag, AnalysisOutput } from "./flags-and-facts";
import type { AirQualityDiff } from "./diff-engine";

export interface GenerateBriefRequest {
  facts: ComputedFact[];
  flags: DataFlag[];
  summary: AnalysisOutput["summary"];
  audience: "ward_officer" | "housing_society" | "school";
  language: "en" | "hi" | "mr" | "ta";
  readingLevel: "executive" | "standard" | "accessible";
  diff?: AirQualityDiff | null;
  customApiKey?: string;
}

const AUDIENCE_NAMES: Record<string, string> = {
  ward_officer: "Ward Officers & Municipal Administration",
  housing_society: "Housing Society Managing Committee & Residents",
  school: "School Principals, Physical Education Teachers & Parents",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  ta: "Tamil (தமிழ்)",
};

const READING_LEVEL_INSTRUCTIONS: Record<string, string> = {
  executive: "Direct, high-impact, actionable bullet points emphasizing operational urgency, key metrics, and administrative directives.",
  standard: "Balanced civic briefing with contextual clarity, civic rationale, and structured public guidance.",
  accessible: "Plain language, simple conversational vocabulary, clear explanations without technical jargon, highly understandable for all community members.",
};

export const CIVIC_BRIEF_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    audience: { type: "string" },
    language: { type: "string" },
    readingLevel: { type: "string" },
    executiveSummary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          factIds: {
            type: "array",
            items: { type: "string" },
            description: "Must ONLY contain valid Fact IDs (e.g. ['F1', 'F2']) from the provided facts table.",
          },
          finding: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
        },
        required: ["factIds", "finding", "severity"],
      },
    },
    prioritizedActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: {
            type: "string",
            enum: [
              "Immediate (1-2 Hours)",
              "Short-term (Today)",
              "Preventive (24-48 Hours)",
            ],
          },
          action: { type: "string" },
          targetGroup: { type: "string" },
          rationaleFactIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["priority", "action", "targetGroup", "rationaleFactIds"],
      },
    },
    internalBriefingNote: { type: "string" },
    citizenAdvisory: {
      type: "object",
      properties: {
        generalPublic: { type: "string" },
        vulnerableGroups: {
          type: "object",
          properties: {
            children: { type: "string" },
            olderAdults: { type: "string" },
            sensitivePeople: { type: "string" },
          },
          required: ["children", "olderAdults", "sensitivePeople"],
        },
      },
      required: ["generalPublic", "vulnerableGroups"],
    },
    medicalDisclaimer: {
      type: "string",
      description: "Explicit non-medical disclaimer confirming this is a civic operational advisory.",
    },
    diffNarrative: { type: "string" },
  },
  required: [
    "title",
    "audience",
    "language",
    "readingLevel",
    "executiveSummary",
    "findings",
    "prioritizedActions",
    "internalBriefingNote",
    "citizenAdvisory",
    "medicalDisclaimer",
  ],
};

/**
 * Builds the strict grounded system instruction and user prompt for Gemini.
 */
function buildBriefPrompt(req: GenerateBriefRequest): { systemInstruction: string; prompt: string } {
  const audienceLabel = AUDIENCE_NAMES[req.audience] || req.audience;
  const langLabel = LANGUAGE_NAMES[req.language] || req.language;
  const readingLevelGuide = READING_LEVEL_INSTRUCTIONS[req.readingLevel] || req.readingLevel;

  const systemInstruction = `You are the Lead Environmental AI Analyst for the Civic Air Quality Briefing Studio.
Your role is to produce high-integrity, audience-targeted, and actionable civic briefings based EXCLUSIVELY on verified tabular facts.

CRITICAL INVARIANTS & ETHICAL GUARDRAILS:
1. ZERO HALLUCINATION: You must NEVER invent numbers, locations, dates, or measurements. You may ONLY state findings that directly cite the provided Fact IDs (e.g. ["F1"], ["F2"]).
2. STRICT FACT CITATION: Every item in "findings" MUST include "factIds" referencing existing Fact IDs from the provided facts table. Citing an unknown Fact ID will cause immediate rejection by our automated auditing pipeline.
3. ABSOLUTELY NO MEDICAL ADVICE: You must NEVER give medical diagnoses, drug prescriptions, dosage instructions, or clinical treatment advice. Formulate public health guidance strictly in terms of civic operational advisories (e.g. stay indoors, wear particulate filter masks such as N95, run HEPA air purifiers, seal windows, postpone vigorous physical exertion, and advise citizens with symptoms to consult certified physicians).
4. AUDIENCE SPECIALIZATION: Tailor prioritized actions and internal briefing note specifically for ${audienceLabel}.
5. LINGUISTIC LOCALIZATION: Output all textual content in ${langLabel}.
6. READING LEVEL: Follow the reading level tone: ${readingLevelGuide}.
7. SENSITIVE ADVISORIES: Provide explicit citizen guidance partitioned for:
   - General public
   - Children (e.g. outdoor playtime, school transit)
   - Older adults (e.g. morning walks, ventilation)
   - Sensitive individuals with pre-existing cardiopulmonary conditions.
8. NEVER HIDE FLAGGED DATA: If telemetry flags exist in the input, acknowledge them as open data quality observations.
9. RETURN VALID JSON: Conforming strictly to the requested schema.`;

  const factsListText = req.facts
    .map(
      (f) =>
        `[${f.id}] (${f.category.toUpperCase()}) Station: "${f.station}" | Metric: ${f.metric}=${f.value} ${f.unit} ${
          f.cpcbCategory ? `(CPCB: ${f.cpcbCategory})` : ""
        } -> Statement: "${f.statement}" (Source Rows: ${f.sourceRowIndices.join(", ")})`
    )
    .join("\n");

  const flagsListText = req.flags
    .map(
      (fl) =>
        `[${fl.id}] (${fl.type.toUpperCase()}) Station: "${fl.station}" | Row ${fl.sourceRowIndex} (${fl.column}='${fl.rawValue}'): ${fl.description}`
    )
    .join("\n");

  let diffText = "No previous briefing comparison available. Baseline briefing cycle.";
  if (req.diff && req.diff.hasPrevious) {
    diffText = `Previous Briefing Comparison:
- Status: ${req.diff.status.toUpperCase()}
- Average AQI Delta: ${req.diff.avgAqiDelta} points (${req.diff.previousAvgAqi} -> ${req.diff.currentAvgAqi})
- Category: ${req.diff.previousCategory} -> ${req.diff.currentCategory}
- Peak Hotspot: ${req.diff.hotspotShift.previousStation} (${req.diff.hotspotShift.previousAqi} AQI) -> ${req.diff.hotspotShift.currentStation} (${req.diff.hotspotShift.currentAqi} AQI)
- Flags Delta: ${req.diff.flagDelta.difference} flags
- Rule-based summary: ${req.diff.ruleBasedNarrative}`;
  }

  const prompt = `TARGET AUDIENCE: ${audienceLabel}
TARGET LANGUAGE: ${langLabel}
READING LEVEL: ${req.readingLevel}

COMPUTED VERIFIED FACTS TABLE (You may ONLY cite these Fact IDs):
${factsListText}

DATA QUALITY & SENSOR FLAGS (Retained and surfaced for transparency):
${flagsListText || "No flags detected. 100% clean telemetry."}

CHRONOLOGICAL DIFF CONTEXT:
${diffText}

Generate the structured civic air quality briefing JSON object following the required schema. Ensure every finding strictly cites valid Fact IDs.`;

  return { systemInstruction, prompt };
}

/**
 * Orchestrates live brief generation with Gemini 2.5 Flash,
 * schema enforcement, and strict Fact ID grounding validation.
 */
export async function generateCivicBrief(
  req: GenerateBriefRequest
): Promise<ValidationEnforcementResult> {
  const apiKey = req.customApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Please configure GEMINI_API_KEY in apps/web/.env or pass it securely in the server request header."
    );
  }

  const { systemInstruction, prompt } = buildBriefPrompt(req);
  const client = createGeminiClient(apiKey);

  const rawBrief = await generateJsonWithGemini<CivicBriefResponse>(
    {
      prompt,
      systemInstruction,
      responseSchema: CIVIC_BRIEF_JSON_SCHEMA,
      temperature: 0.1, // low temperature for rigorous factual adherence
      timeoutMs: 25000,
    },
    client
  );

  // Strictly enforce response schema via Zod
  const parsedBrief = CivicBriefResponseSchema.parse(rawBrief);

  // Validate and reject findings citing unknown fact IDs
  const audited = validateAndEnforceFactIds(parsedBrief, req.facts);

  return audited;
}
