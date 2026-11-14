import { describe, it, expect } from "vitest";
import {
  calculateSubIndex,
  getAqiCategory,
  calculateRowAqi,
  CPCB_CATEGORIES,
  type StandardPollutant,
} from "./cpcb";

describe("CPCB NAQI Comprehensive Mathematical Verification Suite", () => {
  describe("Breakpoint Sub-Index Calculation Across All 6 Standard Pollutants", () => {
    // PM2.5 Breakpoints: 0-30 (0-50), 31-60 (51-100), 61-90 (101-200), 91-120 (201-300), 121-250 (301-400), 250+ (401-500)
    it("calculates PM2.5 sub-indices accurately at all boundaries and midpoints", () => {
      expect(calculateSubIndex("PM2.5", 0)).toBe(0);
      expect(calculateSubIndex("PM2.5", 30)).toBe(50);
      expect(calculateSubIndex("PM2.5", 60)).toBe(100);
      expect(calculateSubIndex("PM2.5", 90)).toBe(200);
      expect(calculateSubIndex("PM2.5", 120)).toBe(300);
      expect(calculateSubIndex("PM2.5", 250)).toBe(400);
      // Midpoint in Moderate band: 75 ug/m3 -> 149
      expect(calculateSubIndex("PM2.5", 75)).toBe(149);
      // Beyond highest breakpoint
      expect(calculateSubIndex("PM2.5", 500)).toBe(500);
    });

    // PM10 Breakpoints: 0-50 (0-50), 51-100 (51-100), 101-250 (101-200), 251-350 (201-300), 351-430 (301-400), 430+ (401-500)
    it("calculates PM10 sub-indices accurately at all boundaries and midpoints", () => {
      expect(calculateSubIndex("PM10", 0)).toBe(0);
      expect(calculateSubIndex("PM10", 50)).toBe(50);
      expect(calculateSubIndex("PM10", 100)).toBe(100);
      expect(calculateSubIndex("PM10", 250)).toBe(200);
      expect(calculateSubIndex("PM10", 350)).toBe(300);
      expect(calculateSubIndex("PM10", 430)).toBe(400);
      // Midpoint in Satisfactory: 75 -> 75
      expect(calculateSubIndex("PM10", 75)).toBe(75);
      // Beyond highest breakpoint
      expect(calculateSubIndex("PM10", 600)).toBe(500);
    });

    // NO2 Breakpoints: 0-40 (0-50), 41-80 (51-100), 81-180 (101-200), 181-280 (201-300), 281-400 (301-400), 400+ (401-500)
    it("calculates NO2 sub-indices accurately across all NAQI bands", () => {
      expect(calculateSubIndex("NO2", 0)).toBe(0);
      expect(calculateSubIndex("NO2", 40)).toBe(50);
      expect(calculateSubIndex("NO2", 80)).toBe(100);
      expect(calculateSubIndex("NO2", 180)).toBe(200);
      expect(calculateSubIndex("NO2", 280)).toBe(300);
      expect(calculateSubIndex("NO2", 400)).toBe(400);
      expect(calculateSubIndex("NO2", 500)).toBe(500);
    });

    // SO2 Breakpoints: 0-40 (0-50), 41-80 (51-100), 81-380 (101-200), 381-800 (201-300), 801-1600 (301-400), 1600+ (401-500)
    it("calculates SO2 sub-indices accurately across all NAQI bands", () => {
      expect(calculateSubIndex("SO2", 0)).toBe(0);
      expect(calculateSubIndex("SO2", 40)).toBe(50);
      expect(calculateSubIndex("SO2", 80)).toBe(100);
      expect(calculateSubIndex("SO2", 380)).toBe(200);
      expect(calculateSubIndex("SO2", 800)).toBe(300);
      expect(calculateSubIndex("SO2", 1600)).toBe(400);
      expect(calculateSubIndex("SO2", 2000)).toBe(500);
    });

    // CO Breakpoints (mg/m3): 0-1.0 (0-50), 1.1-2.0 (51-100), 2.1-10.0 (101-200), 10.1-17.0 (201-300), 17.1-34.0 (301-400), 34.0+ (401-500)
    it("calculates CO sub-indices accurately across all NAQI bands", () => {
      expect(calculateSubIndex("CO", 0)).toBe(0);
      expect(calculateSubIndex("CO", 1.0)).toBe(50);
      expect(calculateSubIndex("CO", 2.0)).toBe(100);
      expect(calculateSubIndex("CO", 10.0)).toBe(200);
      expect(calculateSubIndex("CO", 17.0)).toBe(300);
      expect(calculateSubIndex("CO", 34.0)).toBe(400);
      expect(calculateSubIndex("CO", 40.0)).toBe(438);
      expect(calculateSubIndex("CO", 50.0)).toBe(500);
      expect(calculateSubIndex("CO", 60.0)).toBe(500);
    });

    // O3 Breakpoints: 0-50 (0-50), 51-100 (51-100), 101-168 (101-200), 169-208 (201-300), 209-748 (301-400), 748+ (401-500)
    it("calculates O3 sub-indices accurately across all NAQI bands", () => {
      expect(calculateSubIndex("O3", 0)).toBe(0);
      expect(calculateSubIndex("O3", 50)).toBe(50);
      expect(calculateSubIndex("O3", 100)).toBe(100);
      expect(calculateSubIndex("O3", 168)).toBe(200);
      expect(calculateSubIndex("O3", 208)).toBe(300);
      expect(calculateSubIndex("O3", 748)).toBe(400);
      expect(calculateSubIndex("O3", 900)).toBe(461);
      expect(calculateSubIndex("O3", 1000)).toBe(500);
      expect(calculateSubIndex("O3", 1200)).toBe(500);
    });

    it("rejects invalid inputs by returning null", () => {
      expect(calculateSubIndex("PM2.5", -10)).toBeNull();
      expect(calculateSubIndex("PM10", NaN)).toBeNull();
      expect(calculateSubIndex("UNKNOWN" as any, 50)).toBeNull();
    });
  });

  describe("CPCB Category Classification", () => {
    it("maps all AQI bands to the correct CPCB official category", () => {
      expect(getAqiCategory(0).name).toBe("Good");
      expect(getAqiCategory(50).name).toBe("Good");
      expect(getAqiCategory(51).name).toBe("Satisfactory");
      expect(getAqiCategory(100).name).toBe("Satisfactory");
      expect(getAqiCategory(101).name).toBe("Moderate");
      expect(getAqiCategory(200).name).toBe("Moderate");
      expect(getAqiCategory(201).name).toBe("Poor");
      expect(getAqiCategory(300).name).toBe("Poor");
      expect(getAqiCategory(301).name).toBe("Very Poor");
      expect(getAqiCategory(400).name).toBe("Very Poor");
      expect(getAqiCategory(401).name).toBe("Severe");
      expect(getAqiCategory(500).name).toBe("Severe");
      expect(getAqiCategory(850).name).toBe("Severe");
    });

    it("ensures all 6 official CPCB categories have health statements and colors", () => {
      expect(CPCB_CATEGORIES.length).toBe(6);
      for (const cat of CPCB_CATEGORIES) {
        expect(cat.name).toBeDefined();
        expect(cat.minAqi).toBeGreaterThanOrEqual(0);
        expect(cat.maxAqi).toBeGreaterThanOrEqual(cat.minAqi);
        expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(cat.healthStatement.length).toBeGreaterThan(10);
        expect(cat.civicAdvisory.length).toBeGreaterThan(10);
      }
    });
  });

  describe("Dominant Pollutant & Row Aggregation", () => {
    it("determines overall AQI by taking max sub-index and identifies dominant pollutant", () => {
      // Row with PM2.5 = 60 (sub=100), PM10 = 250 (sub=200), NO2 = 40 (sub=50)
      const res = calculateRowAqi({
        "PM2.5": 60,
        "PM10": 250,
        "NO2": 40,
      });

      expect(res.aqi).toBe(200);
      expect(res.dominantPollutant).toBe("PM10");
      expect(res.subIndices["PM2.5"]).toBe(100);
      expect(res.subIndices["PM10"]).toBe(200);
      expect(res.subIndices["NO2"]).toBe(50);
    });

    it("respects direct AQI column if provided in source data", () => {
      const res = calculateRowAqi({
        "PM2.5": 30,
        "AQI": 185,
      });
      expect(res.aqi).toBe(185);
    });

    it("enforces official CPCB NAQI criteria: requires >=3 pollutants including PM2.5 or PM10", () => {
      // 3 pollutants with PM2.5 -> meets criteria
      const validNaqi = calculateRowAqi({
        "PM2.5": 60,
        "NO2": 40,
        "SO2": 25,
      });
      expect(validNaqi.isOfficialNaqi).toBe(true);
      expect(validNaqi.criteriaNote).toContain("Meets CPCB NAQI reporting criteria");

      // 2 pollutants only -> sub-index only
      const twoPollutants = calculateRowAqi({
        "PM2.5": 60,
        "NO2": 40,
      });
      expect(twoPollutants.isOfficialNaqi).toBe(false);
      expect(twoPollutants.criteriaNote).toContain("Sub-index only");

      // 3 pollutants but missing both PM2.5 and PM10 -> sub-index only
      const noParticulate = calculateRowAqi({
        "NO2": 40,
        "SO2": 25,
        "CO": 1.2,
      });
      expect(noParticulate.isOfficialNaqi).toBe(false);
      expect(noParticulate.criteriaNote).toContain("missing PM2.5/PM10");
    });

    it("handles rows with missing or zero pollutant values gracefully", () => {
      const res = calculateRowAqi({});
      expect(res.aqi).toBeNull();
      expect(res.dominantPollutant).toBeNull();
    });
  });
});
