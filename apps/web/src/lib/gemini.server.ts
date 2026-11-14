import { GoogleGenAI } from "@google/genai";
import "server-only";

export interface GenerateJsonOptions<T = unknown> {
  model?: string;
  fallbackModels?: string[];
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  timeoutMs?: number;
  temperature?: number;
  /**
   * Validates/parses the raw JSON. If it throws, the response is treated as a
   * failure and the next fallback model is tried.
   */
  parse?: (raw: unknown) => T;
}

export interface GeminiJsonResult<T> {
  data: T;
  /** The model that actually produced `data` (may be a fallback). */
  model: string;
}

const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export function getFallbackModels(): string[] {
  const envFallbacks = process.env.GEMINI_FALLBACK_MODELS;
  if (envFallbacks) {
    return envFallbacks
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash"];
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not set or contains default placeholder in environment variables");
  }
  return apiKey;
}

export function createGeminiClient(apiKey?: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey: apiKey || getApiKey() });
}

export async function generateJsonWithGemini<T = unknown>(
  options: GenerateJsonOptions<T>,
  client?: GoogleGenAI
): Promise<GeminiJsonResult<T>> {
  const {
    model: requestedModel,
    fallbackModels = getFallbackModels(),
    prompt,
    systemInstruction,
    responseSchema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    temperature = 0.2,
    parse = (raw: unknown) => raw as T,
  } = options;

  const primaryModel = requestedModel || DEFAULT_MODEL;
  const modelChain = Array.from(new Set([primaryModel, ...fallbackModels]));

  const ai = client ?? createGeminiClient();

  let lastError: unknown;

  for (const currentModel of modelChain) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature,
          abortSignal: controller.signal,
          ...(responseSchema ? { responseSchema } : {}),
          ...(systemInstruction ? { systemInstruction } : {}),
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error(`Model ${currentModel} returned an empty response`);
      }

      // Parse + validate inside the loop so a malformed answer falls through to the next model.
      return { data: parse(JSON.parse(text)), model: currentModel };
    } catch (err) {
      lastError = controller.signal.aborted
        ? new Error(`Model ${currentModel} timed out after ${timeoutMs}ms`)
        : err;
      console.warn(
        `Gemini attempt with model "${currentModel}" failed: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }. Trying next fallback model...`
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error(
    `Gemini request failed across all models (${modelChain.join(", ")}): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
