import cpcbConfig from "../config/cpcb-breakpoints.json";

export type StandardPollutant = "PM2.5" | "PM10" | "NO2" | "SO2" | "CO" | "O3";

export type AqiCategoryName =
  | "Good"
  | "Satisfactory"
  | "Moderate"
  | "Poor"
  | "Very Poor"
  | "Severe";

export interface AqiCategoryInfo {
  name: AqiCategoryName;
  minAqi: number;
  maxAqi: number;
  color: string;
  textColor: string;
  healthStatement: string;
  civicAdvisory: string;
}

export interface BreakpointRange {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

export const CPCB_CATEGORIES: AqiCategoryInfo[] = cpcbConfig.categories as AqiCategoryInfo[];

export function getAqiCategory(aqi: number): AqiCategoryInfo {
  const rounded = Math.round(aqi);
  for (const cat of CPCB_CATEGORIES) {
    if (rounded >= cat.minAqi && rounded <= cat.maxAqi) {
      return cat;
    }
  }
  if (rounded > 500) {
    return CPCB_CATEGORIES[CPCB_CATEGORIES.length - 1]; // Severe
  }
  return CPCB_CATEGORIES[0]; // Good fallback
}

/**
 * Computes the CPCB sub-index for a specific pollutant using linear interpolation:
 * Ip = [ (I_hi - I_lo) / (B_hi - B_lo) ] * (Cp - B_lo) + I_lo
 */
export function calculateSubIndex(
  pollutant: StandardPollutant,
  concentration: number
): number | null {
  if (concentration < 0 || isNaN(concentration)) {
    return null;
  }

  const polConfig = (cpcbConfig.pollutants as Record<string, { breakpoints: BreakpointRange[] }>)[pollutant];
  if (!polConfig || !polConfig.breakpoints) {
    return null;
  }

  const breakpoints = polConfig.breakpoints;
  // If concentration is 0
  if (concentration === 0) {
    return 0;
  }

  for (const bp of breakpoints) {
    if (concentration >= bp.cLow && concentration <= bp.cHigh) {
      if (bp.cHigh === bp.cLow) {
        return bp.iLow;
      }
      const subIndex =
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (concentration - bp.cLow) +
        bp.iLow;
      return Math.round(subIndex);
    }
  }

  // If concentration exceeds the highest breakpoint, extrapolate up to max 500
  const highestBp = breakpoints[breakpoints.length - 1];
  if (concentration > highestBp.cHigh) {
    return 500;
  }

  return null;
}

export interface PollutantValues {
  "PM2.5"?: number | null;
  "PM10"?: number | null;
  "NO2"?: number | null;
  "SO2"?: number | null;
  "CO"?: number | null;
  "O3"?: number | null;
  "AQI"?: number | null;
}

/**
 * Calculates overall AQI:
 * Per CPCB guidelines, AQI is max(sub-index) across monitored pollutants,
 * typically requiring at least PM10 or PM2.5.
 * If direct AQI is already provided in data, returns provided or computed max.
 */
export function calculateRowAqi(values: PollutantValues): {
  aqi: number | null;
  dominantPollutant: string | null;
  subIndices: Record<string, number>;
} {
  const subIndices: Record<string, number> = {};
  let maxSubIndex = -1;
  let dominant: string | null = null;

  const pollutants: StandardPollutant[] = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"];

  for (const p of pollutants) {
    const val = values[p];
    if (val !== undefined && val !== null && !isNaN(val)) {
      const sub = calculateSubIndex(p, val);
      if (sub !== null) {
        subIndices[p] = sub;
        if (sub > maxSubIndex) {
          maxSubIndex = sub;
          dominant = p;
        }
      }
    }
  }

  if (values.AQI !== undefined && values.AQI !== null && !isNaN(values.AQI)) {
    return {
      aqi: Math.round(values.AQI),
      dominantPollutant: dominant ?? "AQI",
      subIndices,
    };
  }

  if (maxSubIndex >= 0) {
    return {
      aqi: maxSubIndex,
      dominantPollutant: dominant,
      subIndices,
    };
  }

  return {
    aqi: null,
    dominantPollutant: null,
    subIndices,
  };
}
