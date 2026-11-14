import type { AnalysisOutput, ComputedFact } from "./flags-and-facts";
import type { AqiCategoryName } from "./cpcb";

export interface AirQualityDiff {
  hasPrevious: boolean;
  status: "worsened" | "improved" | "stable" | "first_run";
  timeElapsedDescription?: string;
  previousTimestamp?: string;
  currentTimestamp?: string;
  avgAqiDelta: number | null;
  avgAqiPctChange: number | null;
  previousAvgAqi: number | null;
  currentAvgAqi: number | null;
  previousCategory: AqiCategoryName | null;
  currentCategory: AqiCategoryName | null;
  categoryChanged: boolean;
  hotspotShift: {
    previousStation: string | null;
    previousAqi: number | null;
    currentStation: string | null;
    currentAqi: number | null;
    changed: boolean;
  };
  flagDelta: {
    previousCount: number;
    currentCount: number;
    difference: number;
  };
  ruleBasedNarrative: string;
}

/**
 * Deterministically computes mathematical and categorical deltas between two air quality analyses.
 */
export function computeAirQualityDiff(
  current: AnalysisOutput,
  previous?: AnalysisOutput | null,
  previousGeneratedAt?: string
): AirQualityDiff {
  if (!previous || !previous.summary) {
    return {
      hasPrevious: false,
      status: "first_run",
      avgAqiDelta: null,
      avgAqiPctChange: null,
      previousAvgAqi: null,
      currentAvgAqi: current.summary.overallAverageAqi,
      previousCategory: null,
      currentCategory: current.summary.overallCategory,
      categoryChanged: false,
      hotspotShift: {
        previousStation: null,
        previousAqi: null,
        currentStation: current.summary.peakStation,
        currentAqi: current.summary.peakAqi,
        changed: false,
      },
      flagDelta: {
        previousCount: 0,
        currentCount: current.flags.length,
        difference: current.flags.length,
      },
      ruleBasedNarrative:
        "Initial baseline civic briefing. No previous briefing recorded for comparative telemetry.",
    };
  }

  const prevAvg = previous.summary.overallAverageAqi;
  const currAvg = current.summary.overallAverageAqi;

  let avgAqiDelta: number | null = null;
  let avgAqiPctChange: number | null = null;
  let status: "worsened" | "improved" | "stable" = "stable";

  if (prevAvg !== null && currAvg !== null) {
    avgAqiDelta = Math.round((currAvg - prevAvg) * 10) / 10;
    avgAqiPctChange =
      prevAvg > 0 ? Math.round(((currAvg - prevAvg) / prevAvg) * 1000) / 10 : 0;

    if (avgAqiDelta >= 5) {
      status = "worsened";
    } else if (avgAqiDelta <= -5) {
      status = "improved";
    } else {
      status = "stable";
    }
  }

  const prevCat = previous.summary.overallCategory;
  const currCat = current.summary.overallCategory;
  const categoryChanged = prevCat !== currCat && !!prevCat && !!currCat;

  const hotspotShift = {
    previousStation: previous.summary.peakStation,
    previousAqi: previous.summary.peakAqi,
    currentStation: current.summary.peakStation,
    currentAqi: current.summary.peakAqi,
    changed:
      previous.summary.peakStation !== current.summary.peakStation ||
      previous.summary.peakAqi !== current.summary.peakAqi,
  };

  const flagDelta = {
    previousCount: previous.flags.length,
    currentCount: current.flags.length,
    difference: current.flags.length - previous.flags.length,
  };

  // Construct precise factual narrative
  const narrativeParts: string[] = [];

  if (avgAqiDelta !== null) {
    if (avgAqiDelta > 0) {
      narrativeParts.push(
        `Average AQI worsened by +${avgAqiDelta} points (${avgAqiPctChange}%) from ${prevAvg} (${prevCat}) to ${currAvg} (${currCat}).`
      );
    } else if (avgAqiDelta < 0) {
      narrativeParts.push(
        `Average AQI improved by ${Math.abs(avgAqiDelta)} points (${Math.abs(
          avgAqiPctChange || 0
        )}%) from ${prevAvg} (${prevCat}) to ${currAvg} (${currCat}).`
      );
    } else {
      narrativeParts.push(
        `Average AQI remained stable at ${currAvg} (${currCat}).`
      );
    }
  }

  if (hotspotShift.changed && hotspotShift.currentStation) {
    narrativeParts.push(
      `Peak hotspot shifted to "${hotspotShift.currentStation}" at ${hotspotShift.currentAqi} AQI (previously "${hotspotShift.previousStation}" at ${hotspotShift.previousAqi} AQI).`
    );
  }

  if (flagDelta.difference > 0) {
    narrativeParts.push(
      `Detected ${flagDelta.difference} new sensor data flags (total ${flagDelta.currentCount}), requiring inspection.`
    );
  } else if (flagDelta.difference < 0) {
    narrativeParts.push(
      `Sensor anomalies decreased by ${Math.abs(flagDelta.difference)} (${flagDelta.currentCount} remaining flags).`
    );
  }

  return {
    hasPrevious: true,
    status,
    timeElapsedDescription: previousGeneratedAt
      ? `Compared against briefing from ${new Date(previousGeneratedAt).toLocaleTimeString()}`
      : undefined,
    previousTimestamp: previousGeneratedAt,
    currentTimestamp: new Date().toISOString(),
    avgAqiDelta,
    avgAqiPctChange,
    previousAvgAqi: prevAvg,
    currentAvgAqi: currAvg,
    previousCategory: prevCat,
    currentCategory: currCat,
    categoryChanged,
    hotspotShift,
    flagDelta,
    ruleBasedNarrative: narrativeParts.join(" "),
  };
}
