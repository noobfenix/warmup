import { GoogleGenAI } from "@google/genai";
import "server-only";

export interface GenerateJsonOptions {
  model?: string;
  fallbackModels?: string[];
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  timeoutMs?: number;
  temperature?: number;
}

const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function getFallbackModels(): string[] {
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
  options: GenerateJsonOptions,
  client?: GoogleGenAI
): Promise<T> {
  const {
    model: requestedModel,
    fallbackModels = getFallbackModels(),
    prompt,
    systemInstruction,
    responseSchema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    temperature = 0.2,
  } = options;

  const primaryModel = requestedModel || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const modelChain = Array.from(new Set([primaryModel, ...fallbackModels]));

  const ai = client ?? createGeminiClient();

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature,
  };

  if (responseSchema) {
    config.responseSchema = responseSchema;
  }

  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  let lastError: unknown;

  for (const currentModel of modelChain) {
    try {
      const executeOnce = async (): Promise<string | null> => {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config,
          });

          return response.text ?? null;
        } finally {
          clearTimeout(timeoutHandle);
        }
      };

      const text = await executeOnce();
      if (!text) {
        throw new Error(`Model ${currentModel} returned an empty response`);
      }

      const parsed = JSON.parse(text) as T;
      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(
        `Gemini attempt with model "${currentModel}" failed: ${
          err instanceof Error ? err.message : String(err)
        }. Trying next fallback model...`
      );
      // Brief 300ms pause before trying next fallback model
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  throw new Error(
    `Gemini request failed across all models (${modelChain.join(", ")}): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
