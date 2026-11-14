import { analyzeAirQualityData, type AnalysisOutput } from "./flags-and-facts";
import { heuristicMapColumns, normalizeTableData, parseRawTableInput } from "./table-parser";

/**
 * Full deterministic pipeline: raw CSV/TSV/JSON text -> parsed table -> mapped and
 * normalized rows -> flags and facts. Returns null when no headers or rows can be parsed.
 */
export function analyzeRawTable(rawText: string): AnalysisOutput | null {
  const parsed = parseRawTableInput(rawText);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return null;
  }
  const mapping = heuristicMapColumns(parsed.headers);
  return analyzeAirQualityData(normalizeTableData(parsed, mapping));
}

export interface DatasetStats {
  rowCount: number;
  flagCount: number;
  stations: string[];
  averageAqi: number | null;
  category: AnalysisOutput["summary"]["overallCategory"];
}

/** Summary numbers shown on dataset cards, computed from the data rather than hand-written. */
export function computeDatasetStats(rawText: string): DatasetStats | null {
  const analysis = analyzeRawTable(rawText);
  if (!analysis) return null;
  const stations = Array.from(
    new Set(analysis.normalizedRows.map((r) => r.station).filter((s): s is string => Boolean(s)))
  );
  return {
    rowCount: analysis.summary.totalRows,
    flagCount: analysis.flags.length,
    stations,
    averageAqi: analysis.summary.overallAverageAqi,
    category: analysis.summary.overallCategory,
  };
}
