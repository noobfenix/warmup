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

function interpolate(c: number, cLow: number, cHigh: number, iLow: number, iHigh: number): number {
  return ((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow;
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

  let previous: BreakpointRange | null = null;
  for (const bp of breakpoints) {
    if (concentration >= bp.cLow && concentration <= bp.cHigh) {
      if (bp.cHigh === bp.cLow) {
        return bp.iLow;
      }
      return Math.round(interpolate(concentration, bp.cLow, bp.cHigh, bp.iLow, bp.iHigh));
    }
    // CPCB bands are published with integer gaps (e.g. PM2.5 30 | 31). Decimal readings that fall
    // between bands are interpolated across the gap so they still receive a sub-index.
    if (previous && concentration > previous.cHigh && concentration < bp.cLow) {
      return Math.round(interpolate(concentration, previous.cHigh, bp.cLow, previous.iHigh, bp.iLow));
    }
    previous = bp;
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

export interface RowAqiResult {
  aqi: number | null;
  dominantPollutant: string | null;
  subIndices: Record<string, number>;
  isOfficialNaqi: boolean;
  criteriaNote: string;
}

/**
 * Calculates overall AQI:
 * Per official CPCB NAQI guidelines, official AQI reporting requires:
 * 1. At least 3 monitored pollutants with valid sub-indices.
 * 2. At least one must be a particulate matter (PM2.5 or PM10).
 * If direct AQI is provided in data, returns provided AQI.
 */
export function calculateRowAqi(values: PollutantValues): RowAqiResult {
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

  const monitoredPollutants = Object.keys(subIndices);
  const hasParticulate = Boolean(
    subIndices["PM2.5"] !== undefined || subIndices["PM10"] !== undefined
  );
  const meetsCpcbCriteria = monitoredPollutants.length >= 3 && hasParticulate;

  if (values.AQI !== undefined && values.AQI !== null && !isNaN(values.AQI)) {
    return {
      aqi: Math.round(values.AQI),
      dominantPollutant: dominant ?? "AQI",
      subIndices,
      isOfficialNaqi: true,
      criteriaNote: "Direct AQI provided from certified instrument",
    };
  }

  if (maxSubIndex >= 0) {
    return {
      aqi: maxSubIndex,
      dominantPollutant: dominant,
      subIndices,
      isOfficialNaqi: meetsCpcbCriteria,
      criteriaNote: meetsCpcbCriteria
        ? "Meets CPCB NAQI reporting criteria (>=3 pollutants with PM2.5 or PM10)"
        : `Sub-index only (${monitoredPollutants.length}/3 pollutants, ${
            hasParticulate ? "has PM" : "missing PM2.5/PM10"
          }): does not meet full CPCB NAQI protocol`,
    };
  }

  return {
    aqi: null,
    dominantPollutant: null,
    subIndices,
    isOfficialNaqi: false,
    criteriaNote: "No measurable pollutant concentrations",
  };
}
