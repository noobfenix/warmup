import { describe, it, expect, vi } from "vitest";
import type { GoogleGenAI } from "@google/genai";

vi.mock("server-only", () => ({}));

import { calculateSubIndex, getAqiCategory } from "./cpcb";
import { generateJsonWithGemini } from "./gemini.server";
import { analyzeRawTable, computeDatasetStats } from "./analyze-table";
import { SAMPLE_DATASETS } from "../config/sample-datasets";

describe("CPCB decimal readings between published bands", () => {
  it.each([
    ["PM2.5", 30.5],
    ["PM2.5", 60.4],
    ["PM2.5", 90.7],
    ["PM10", 100.5],
    ["NO2", 80.5],
    ["SO2", 380.5],
    ["CO", 1.05],
    ["O3", 168.5],
  ] as const)("%s at %d gets a sub-index", (pollutant, value) => {
    expect(calculateSubIndex(pollutant, value)).not.toBeNull();
  });

  it("interpolates across the gap monotonically", () => {
    const below = calculateSubIndex("PM2.5", 30)!;
    const gap = calculateSubIndex("PM2.5", 30.5)!;
    const above = calculateSubIndex("PM2.5", 31)!;
    expect(gap).toBeGreaterThanOrEqual(below);
    expect(gap).toBeLessThanOrEqual(above);
    expect(getAqiCategory(calculateSubIndex("PM2.5", 60.4)!).name).toBe("Satisfactory");
  });
});

type GenerateContent = GoogleGenAI["models"]["generateContent"];

function fakeClient(impl: (args: Parameters<GenerateContent>[0]) => Promise<{ text?: string }>) {
  const generateContent = vi.fn(impl);
  return { client: { models: { generateContent } } as unknown as GoogleGenAI, generateContent };
}

describe("generateJsonWithGemini fallback chain", () => {
  it("reports the model that actually answered", async () => {
    const { client } = fakeClient(async ({ model }) => {
      if (model === "primary") throw new Error("503 UNAVAILABLE");
      return { text: JSON.stringify({ ok: true }) };
    });
    const result = await generateJsonWithGemini<{ ok: boolean }>(
      { model: "primary", fallbackModels: ["backup"], prompt: "p" },
      client
    );
    expect(result).toEqual({ data: { ok: true }, model: "backup" });
  });

  it("falls back when the response fails validation", async () => {
    const { client, generateContent } = fakeClient(async ({ model }) => ({
      text: JSON.stringify(model === "primary" ? { wrong: 1 } : { ok: true }),
    }));
    const result = await generateJsonWithGemini(
      {
        model: "primary",
        fallbackModels: ["backup"],
        prompt: "p",
        parse: (raw) => {
          if (!(raw as { ok?: boolean }).ok) throw new Error("schema mismatch");
          return raw as { ok: boolean };
        },
      },
      client
    );
    expect(result.model).toBe("backup");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("passes an abort signal that fires on timeout, then tries the next model", async () => {
    const { client } = fakeClient(({ model, config }) => {
      if (model === "backup") return Promise.resolve({ text: "{\"ok\":true}" });
      return new Promise((_, reject) => {
        config?.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const result = await generateJsonWithGemini(
      { model: "slow", fallbackModels: ["backup"], prompt: "p", timeoutMs: 20 },
      client
    );
    expect(result.model).toBe("backup");
  });

  it("throws with every model named when all fail", async () => {
    const { client } = fakeClient(async () => {
      throw new Error("down");
    });
    await expect(
      generateJsonWithGemini({ model: "a", fallbackModels: ["b"], prompt: "p" }, client)
    ).rejects.toThrow(/a, b/);
  });
});

describe("dataset card stats come from the data", () => {
  it.each(SAMPLE_DATASETS.map((s) => [s.id, s.data] as const))(
    "%s stats match the full analysis",
    (_id, data) => {
      const stats = computeDatasetStats(data)!;
      const analysis = analyzeRawTable(data)!;
      expect(stats.rowCount).toBe(analysis.normalizedRows.length);
      expect(stats.flagCount).toBe(analysis.flags.length);
      for (const station of stats.stations) {
        expect(analysis.normalizedRows.some((r) => r.station === station)).toBe(true);
      }
    }
  );

  it("returns null for unparseable input", () => {
    expect(computeDatasetStats("")).toBeNull();
  });
});
