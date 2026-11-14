import { NextResponse } from "next/server";
import { generateCivicBrief, type GenerateBriefRequest } from "@/lib/gemini-brief.server";
import {
  apiRateLimiter,
  getClientIp,
  parseJsonWithLimit,
  validateBriefParameters,
  validateApiKeyFormat,
  BRIEF_MAX_BODY_BYTES,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const rateLimit = apiRateLimiter.check(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment before requesting another briefing." },
      { status: 429 }
    );
  }

  try {
    const parseResult = await parseJsonWithLimit<GenerateBriefRequest>(req, BRIEF_MAX_BODY_BYTES);
    if (parseResult.error || !parseResult.data) {
      return NextResponse.json(
        { error: parseResult.error || "Invalid request body." },
        { status: parseResult.status || 400 }
      );
    }

    const body = parseResult.data;

    if (!body || !Array.isArray(body.facts) || body.facts.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'facts' array must contain at least one computed fact." },
        { status: 400 }
      );
    }

    // Guard against excessive array lengths (DoS / LLM context flooding)
    if (body.facts.length > 50) {
      return NextResponse.json(
        { error: "Payload exceeds maximum allowed facts limit of 50." },
        { status: 400 }
      );
    }

    if (body.flags && Array.isArray(body.flags) && body.flags.length > 100) {
      return NextResponse.json(
        { error: "Payload exceeds maximum allowed flags limit of 100." },
        { status: 400 }
      );
    }

    // Validate dissemination parameters against strict allowlists (anti-prompt-injection)
    const paramValidation = validateBriefParameters({
      audience: body.audience,
      language: body.language,
      readingLevel: body.readingLevel,
    });

    if (!paramValidation.valid || !paramValidation.params) {
      return NextResponse.json(
        { error: paramValidation.error || "Invalid brief parameters." },
        { status: 400 }
      );
    }

    body.audience = paramValidation.params.audience;
    body.language = paramValidation.params.language;
    body.readingLevel = paramValidation.params.readingLevel;

    // Support optional server-side session header override with strict format validation
    const headerApiKey = req.headers.get("x-gemini-api-key");
    if (headerApiKey) {
      const cleanHeaderKey = headerApiKey.trim();
      if (!validateApiKeyFormat(cleanHeaderKey)) {
        return NextResponse.json(
          { error: "Invalid API key format provided in x-gemini-api-key header." },
          { status: 400 }
        );
      }
      body.customApiKey = cleanHeaderKey;
    }

    const auditedResult = await generateCivicBrief(body);

    const activeModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const fallbackList = (process.env.GEMINI_FALLBACK_MODELS || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...auditedResult.brief,
          modelUsed: activeModel,
          fallbackModels: fallbackList,
        },
        audit: {
          groundingScore: auditedResult.groundingScore,
          passedAuditing: auditedResult.passedAuditing,
          rejectedFindingsCount: auditedResult.rejectedFindings.length,
          rejectedFindings: auditedResult.rejectedFindings,
          allCitedFactIds: auditedResult.allCitedFactIds,
          modelUsed: activeModel,
          fallbackModels: fallbackList,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Generate brief API error:", error);
    // Sanitize error message to prevent accidental key or internal url leakage
    const rawMsg = error instanceof Error ? error.message : "Failed to generate briefing.";
    const safeMsg = rawMsg.replace(/AIza[0-9A-Za-z-_]{35}/g, "<REDACTED_KEY>");

    return NextResponse.json(
      { error: safeMsg },
      { status: 500 }
    );
  }
}
