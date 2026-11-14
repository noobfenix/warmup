import { NextResponse } from "next/server";
import { generateCivicBrief, type GenerateBriefRequest } from "@/lib/gemini-brief.server";
import { apiRateLimiter, getClientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

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
    const body = (await req.json()) as GenerateBriefRequest;

    if (!body || !Array.isArray(body.facts) || body.facts.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'facts' array must contain at least one computed fact." },
        { status: 400 }
      );
    }

    if (!body.audience) {
      body.audience = "ward_officer";
    }
    if (!body.language) {
      body.language = "en";
    }
    if (!body.readingLevel) {
      body.readingLevel = "standard";
    }

    // Support optional server-side session header override
    const headerApiKey = req.headers.get("x-gemini-api-key");
    if (headerApiKey) {
      body.customApiKey = headerApiKey;
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate briefing.",
      },
      { status: 500 }
    );
  }
}
