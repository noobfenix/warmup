import { NextResponse } from "next/server";
import { generateJsonWithGemini } from "@/lib/gemini.server";
import { heuristicMapColumns, type ColumnUnitMappingResult } from "@/lib/table-parser";
import {
  apiRateLimiter,
  getClientIp,
  parseJsonWithLimit,
  sanitizePromptText,
  DEFAULT_MAX_BODY_BYTES,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface MapColumnsRequest {
  headers: string[];
  sampleRows?: Record<string, string>[];
}

const COLUMN_MAPPING_PROMPT_SYSTEM = `You are a specialized atmospheric chemistry & environmental data parsing agent.
Given a list of column headers and optional sample data rows from an air quality monitoring table, your task is to map each column to its standardized pollutant, detected measurement unit, and conversion factor to standard units.

Standard Pollutants & Standard Units:
- PM2.5 (ug/m3)
- PM10 (ug/m3)
- NO2 (ug/m3) - if input is ppb, factor is 1.88; if ppm, factor is 1880
- SO2 (ug/m3) - if input is ppb, factor is 2.62; if ppm, factor is 2620
- CO (mg/m3) - if input is ppm, factor is 1.145
- O3 (ug/m3) - if input is ppb, factor is 1.96; if ppm, factor is 1960
- AQI (index) - factor is 1.0
- UNKNOWN (if column is something else like temperature, humidity, wind, or unrecognized)

You must also identify:
- stationColumn: header name identifying location, ward, school, or sensor
- timestampColumn: header name identifying date, time, or session hour (if present)

Return JSON adhering strictly to:
{
  "stationColumn": string,
  "timestampColumn": string | null,
  "mappings": [
    {
      "sourceColumn": string,
      "standardPollutant": "PM2.5" | "PM10" | "NO2" | "SO2" | "CO" | "O3" | "AQI" | "UNKNOWN",
      "detectedUnit": string,
      "conversionFactor": number,
      "confidence": number
    }
  ]
}`;

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const rateLimit = apiRateLimiter.check(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429 }
    );
  }

  try {
    const parseResult = await parseJsonWithLimit<MapColumnsRequest>(req, DEFAULT_MAX_BODY_BYTES);
    if (parseResult.error || !parseResult.data) {
      return NextResponse.json(
        { error: parseResult.error || "Invalid request body." },
        { status: parseResult.status || 400 }
      );
    }

    const body = parseResult.data;
    if (!body || !Array.isArray(body.headers) || body.headers.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'headers' array is required." },
        { status: 400 }
      );
    }

    // Guard against excessive array lengths (DoS)
    if (body.headers.length > 50) {
      return NextResponse.json(
        { error: "Payload exceeds maximum allowed headers count of 50." },
        { status: 400 }
      );
    }

    const sanitizedHeaders = body.headers
      .slice(0, 50)
      .map((h) => sanitizePromptText(h, 60))
      .filter(Boolean);

    if (sanitizedHeaders.length === 0) {
      return NextResponse.json(
        { error: "No valid headers provided after sanitization." },
        { status: 400 }
      );
    }

    const sampleRows = Array.isArray(body.sampleRows) ? body.sampleRows.slice(0, 5) : [];
    const apiKey = process.env.GEMINI_API_KEY;

    // If Gemini API is configured, attempt intelligent mapping
    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      try {
        const userPrompt = `Headers: ${JSON.stringify(sanitizedHeaders)}\nSample Rows:\n${JSON.stringify(
          sampleRows.slice(0, 3)
        )}`;

        const geminiResult = await generateJsonWithGemini<ColumnUnitMappingResult>({
          prompt: userPrompt,
          systemInstruction: COLUMN_MAPPING_PROMPT_SYSTEM,
          temperature: 0.1,
          timeoutMs: 15000,
        });

        if (geminiResult && geminiResult.stationColumn && Array.isArray(geminiResult.mappings)) {
          return NextResponse.json({
            source: "gemini",
            mapping: geminiResult,
          });
        }
      } catch (geminiErr) {
        console.warn("Gemini column mapping fallback:", geminiErr);
      }
    }

    // Deterministic heuristic fallback
    const heuristicResult = heuristicMapColumns(sanitizedHeaders);
    return NextResponse.json({
      source: "heuristic",
      mapping: heuristicResult,
    });
  } catch (error) {
    console.error("Column mapping endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to map table columns." },
      { status: 500 }
    );
  }
}
