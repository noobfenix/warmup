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
import {
  sanitizePromptText,
  validateApiKeyFormat,
  type AllowedAudience,
  type AllowedLanguage,
  type AllowedReadingLevel,
} from "./security";

export interface GenerateBriefRequest {
  facts: ComputedFact[];
  flags: DataFlag[];
  summary: AnalysisOutput["summary"];
  audience: AllowedAudience;
  language: AllowedLanguage;
  readingLevel: AllowedReadingLevel;
  diff?: AirQualityDiff | null;
  customApiKey?: string;
}

const AUDIENCE_NAMES: Record<AllowedAudience, string> = {
  ward_officer: "Ward Officers & Municipal Administration",
  housing_society: "Housing Society Managing Committee & Residents",
  school: "School Principals, Physical Education Teachers & Parents",
};

// Concrete levers each audience controls, so prioritized actions differ by audience.
export const AUDIENCE_ACTION_FOCUS: Record<AllowedAudience, string> = {
  ward_officer:
    "Municipal levers only: road dust suppression (water sprinkling, mechanical sweeping), construction and demolition site checks, waste-burning enforcement, traffic diversion at hotspot stations, sensor maintenance tickets for flagged rows, and public announcements.",
  housing_society:
    "Society-committee levers only: diesel generator scheduling and servicing, gate and parking traffic, basement ventilation, closing or opening common areas and play areas, resident notices on WhatsApp or notice boards, and requesting sensor checks from the vendor.",
  school:
    "School levers only: moving morning assembly and physical education indoors, adjusting arrival and dismissal times, bus idling rules at the gate, classroom ventilation and air purifiers, parent communication, and reporting faulty campus sensors.",
};

const LANGUAGE_NAMES: Record<AllowedLanguage, string> = {
  en: "English",
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  ta: "Tamil (தமிழ்)",
};

const READING_LEVEL_INSTRUCTIONS: Record<AllowedReadingLevel, string> = {
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
 * Builds the strict grounded system instruction and user prompt for Gemini with defensive sanitization.
 */
export function buildBriefPrompt(req: GenerateBriefRequest): { systemInstruction: string; prompt: string } {
  // Use strictly mapped dictionaries to prevent prompt injection via unvalidated parameters
  const audienceLabel = AUDIENCE_NAMES[req.audience] || AUDIENCE_NAMES.ward_officer;
  const langLabel = LANGUAGE_NAMES[req.language] || LANGUAGE_NAMES.en;
  const readingLevelGuide = READING_LEVEL_INSTRUCTIONS[req.readingLevel] || READING_LEVEL_INSTRUCTIONS.standard;

  const systemInstruction = `You are the Lead Environmental AI Analyst for the Civic Air Quality Briefing Studio.
Your role is to produce high-integrity, audience-targeted, and actionable civic briefings based EXCLUSIVELY on verified tabular facts.

CRITICAL INVARIANTS & ETHICAL GUARDRAILS:
1. ZERO HALLUCINATION: You must NEVER invent numbers, locations, dates, or measurements. You may ONLY state findings that directly cite the provided Fact IDs (e.g. ["F1"], ["F2"]).
2. STRICT FACT CITATION: Every item in "findings" MUST include "factIds" referencing existing Fact IDs from the provided facts table. Citing an unknown Fact ID will cause immediate rejection by our automated auditing pipeline.
3. ABSOLUTELY NO MEDICAL ADVICE: You must NEVER give medical diagnoses, drug prescriptions, dosage instructions, or clinical treatment advice. Formulate public health guidance strictly in terms of civic operational advisories (e.g. stay indoors, wear particulate filter masks such as N95, run HEPA air purifiers, seal windows, postpone vigorous physical exertion, and advise citizens with symptoms to consult certified physicians).
4. AUDIENCE SPECIALIZATION: Tailor prioritized actions and internal briefing note specifically for ${audienceLabel}. ${AUDIENCE_ACTION_FOCUS[req.audience] || AUDIENCE_ACTION_FOCUS.ward_officer} Do not propose actions this audience cannot carry out.
5. LINGUISTIC LOCALIZATION: Output all textual content in ${langLabel}.
6. READING LEVEL: Follow the reading level tone: ${readingLevelGuide}.
7. SENSITIVE ADVISORIES: Provide explicit citizen guidance partitioned for:
   - General public
   - Children (e.g. outdoor playtime, school transit)
   - Older adults (e.g. morning walks, ventilation)
   - Sensitive individuals with pre-existing cardiopulmonary conditions.
8. NEVER HIDE FLAGGED DATA: If telemetry flags exist in the input, acknowledge them as open data quality observations.
9. RETURN VALID JSON: Conforming strictly to the requested schema.`;

  // Defensively bound and sanitize facts to prevent context explosion and streamline LLM token budget
  const factsListText = (req.facts || [])
    .slice(0, 35)
    .map((f) => {
      const cleanId = sanitizePromptText(f.id, 10);
      const cleanCat = sanitizePromptText(f.category, 20).toUpperCase();
      const cleanStation = sanitizePromptText(f.station, 60);
      const cleanStmt = sanitizePromptText(f.statement, 250);
      const cleanCpcb = f.cpcbCategory ? `/${sanitizePromptText(f.cpcbCategory, 20)}` : "";
      const cleanRows = Array.isArray(f.sourceRowIndices)
        ? f.sourceRowIndices.slice(0, 20).join(", ")
        : "";

      return `[${cleanId}] [${cleanCat}${cleanCpcb}] "${cleanStation}": ${cleanStmt} (Rows: ${cleanRows})`;
    })
    .join("\n");

  // Defensively bound and sanitize flags with streamlined formatting
  const flagsListText = (req.flags || [])
    .slice(0, 50)
    .map((fl) => {
      const cleanId = sanitizePromptText(fl.id, 10);
      const cleanType = sanitizePromptText(fl.type, 20).toUpperCase();
      const cleanStation = sanitizePromptText(fl.station, 60);
      const cleanCol = sanitizePromptText(fl.column, 30);
      const cleanRaw = sanitizePromptText(fl.rawValue, 30);
      const cleanDesc = sanitizePromptText(fl.description, 200);

      return `[${cleanId}] [${cleanType}] "${cleanStation}" Row ${fl.sourceRowIndex} (${cleanCol}='${cleanRaw}'): ${cleanDesc}`;
    })
    .join("\n");

  let diffText = "No previous briefing comparison available. Baseline briefing cycle.";
  if (req.diff && req.diff.hasPrevious) {
    const cleanDiffStatus = sanitizePromptText(req.diff.status, 20).toUpperCase();
    const cleanPrevCat = sanitizePromptText(req.diff.previousCategory, 20);
    const cleanCurrCat = sanitizePromptText(req.diff.currentCategory, 20);
    const cleanPrevStation = sanitizePromptText(req.diff.hotspotShift?.previousStation, 60);
    const cleanCurrStation = sanitizePromptText(req.diff.hotspotShift?.currentStation, 60);
    const cleanNarrative = sanitizePromptText(req.diff.ruleBasedNarrative, 300);

    diffText = `Previous Briefing Comparison:
- Status: ${cleanDiffStatus}
- Average AQI Delta: ${req.diff.avgAqiDelta} points (${req.diff.previousAvgAqi} -> ${req.diff.currentAvgAqi})
- Category: ${cleanPrevCat} -> ${cleanCurrCat}
- Peak Hotspot: ${cleanPrevStation} (${req.diff.hotspotShift?.previousAqi} AQI) -> ${cleanCurrStation} (${req.diff.hotspotShift?.currentAqi} AQI)
- Flags Delta: ${req.diff.flagDelta?.difference ?? 0} flags
- Rule-based summary: ${cleanNarrative}`;
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
 * Orchestrates live brief generation with Gemini,
 * schema enforcement, and strict Fact ID grounding validation.
 */
export interface GeneratedCivicBrief extends ValidationEnforcementResult {
  /** The Gemini model that actually produced the brief (may be a fallback). */
  modelUsed: string;
}

export async function generateCivicBrief(
  req: GenerateBriefRequest
): Promise<GeneratedCivicBrief> {
  const apiKey = req.customApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Please configure GEMINI_API_KEY in apps/web/.env or pass it securely in the server request header."
    );
  }

  if (!validateApiKeyFormat(apiKey)) {
    throw new Error("Invalid API key format.");
  }

  const { systemInstruction, prompt } = buildBriefPrompt(req);
  const client = createGeminiClient(apiKey);

  const { data: parsedBrief, model } = await generateJsonWithGemini<CivicBriefResponse>(
    {
      prompt,
      systemInstruction,
      responseSchema: CIVIC_BRIEF_JSON_SCHEMA,
      temperature: 0.1, // low temperature for rigorous factual adherence
      timeoutMs: 25000,
      // Strict Zod schema enforcement; a malformed answer triggers the next fallback model.
      parse: (raw) => CivicBriefResponseSchema.parse(raw),
    },
    client
  );

  // Validate and reject findings citing unknown fact IDs
  return { ...validateAndEnforceFactIds(parsedBrief, req.facts), modelUsed: model };
}
