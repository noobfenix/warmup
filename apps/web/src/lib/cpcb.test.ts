import { describe, it, expect } from "vitest";
import {
  calculateSubIndex,
  getAqiCategory,
  calculateRowAqi,
} from "./cpcb";

describe("CPCB AQI & Breakpoint Engine", () => {
  it("computes PM2.5 sub-indices accurately across breakpoints", () => {
    // 0 ug/m3 -> 0
    expect(calculateSubIndex("PM2.5", 0)).toBe(0);

    // 30 ug/m3 -> boundary of Good (50)
    expect(calculateSubIndex("PM2.5", 30)).toBe(50);

    // 60 ug/m3 -> boundary of Satisfactory (100)
    expect(calculateSubIndex("PM2.5", 60)).toBe(100);

    // 45 ug/m3 -> midpoint of 31-60 (approx 76)
    const midSat = calculateSubIndex("PM2.5", 45);
    expect(midSat).toBeGreaterThan(70);
    expect(midSat).toBeLessThan(85);

    // 90 ug/m3 -> Moderate boundary (200)
    expect(calculateSubIndex("PM2.5", 90)).toBe(200);

    // 120 ug/m3 -> Poor boundary (300)
    expect(calculateSubIndex("PM2.5", 120)).toBe(300);

    // 250 ug/m3 -> Very Poor boundary (400)
    expect(calculateSubIndex("PM2.5", 250)).toBe(400);

    // 380 ug/m3 -> Severe boundary (500)
    expect(calculateSubIndex("PM2.5", 380)).toBe(500);

    // Out of range negative -> null
    expect(calculateSubIndex("PM2.5", -5)).toBeNull();
  });

  it("computes PM10 sub-indices accurately", () => {
    expect(calculateSubIndex("PM10", 50)).toBe(50);
    expect(calculateSubIndex("PM10", 100)).toBe(100);
    expect(calculateSubIndex("PM10", 250)).toBe(200);
  });

  it("correctly identifies CPCB categories", () => {
    expect(getAqiCategory(25).name).toBe("Good");
    expect(getAqiCategory(50).name).toBe("Good");
    expect(getAqiCategory(51).name).toBe("Satisfactory");
    expect(getAqiCategory(100).name).toBe("Satisfactory");
    expect(getAqiCategory(101).name).toBe("Moderate");
    expect(getAqiCategory(200).name).toBe("Moderate");
    expect(getAqiCategory(250).name).toBe("Poor");
    expect(getAqiCategory(350).name).toBe("Very Poor");
    expect(getAqiCategory(450).name).toBe("Severe");
    expect(getAqiCategory(600).name).toBe("Severe");
  });

  it("calculates overall AQI as max sub-index", () => {
    const result = calculateRowAqi({
      "PM2.5": 90, // Sub-index 200 (Moderate boundary)
      "PM10": 50,  // Sub-index 50 (Good)
      "NO2": 20,   // Sub-index 25 (Good)
    });

    expect(result.aqi).toBe(200);
    expect(result.dominantPollutant).toBe("PM2.5");
    expect(result.subIndices["PM2.5"]).toBe(200);
    expect(result.subIndices["PM10"]).toBe(50);
  });
});
