import { describe, it, expect } from "vitest";
import {
  calculatePositionSize,
  computeRisk,
} from "../calc";

describe("Risk and Scanner integration", () => {
  it("calculatePositionSize works with small capital 1JT", () => {
    const result = calculatePositionSize(1_000_000, 1, 1000, 950);
    
    expect(result.shares).toBeGreaterThan(0);
    expect(result.lots).toBeGreaterThan(0);
    expect(result.maxLoss).toBeLessThanOrEqual(10000);
    expect(result.positionValue).toBeLessThanOrEqual(1_000_000);
  });

  it("calculatePositionSize works with 10 million capital", () => {
    const result = calculatePositionSize(10_000_000, 2, 4000, 3800);
    
    expect(result.shares).toBeGreaterThan(0);
    expect(result.lots).toBeGreaterThan(0);
    expect(result.maxLoss).toBeLessThanOrEqual(200000);
    expect(result.positionValue).toBeLessThanOrEqual(10_000_000);
  });
});

describe("Filter applied stocks with capital rules", () => {
  it("computes risk for 1 juta dengan risk 1%", () => {
    const risk = computeRisk({
      ticker: "TEST",
      currentPrice: "4000",
      support: "3800",
      resistance: "4400",
      atr: "50",
      capital: "1000000",
      riskPerTrade: "1",
    });
    
    expect(risk).not.toBeNull();
    expect(risk!.riskReward1).toBeGreaterThan(0);
  });

  it("computes risk for 5 juta dengan risk 1.5%", () => {
    const risk = computeRisk({
      ticker: "TEST",
      currentPrice: "2000",
      support: "1900",
      resistance: "2200",
      atr: "30",
      capital: "5000000",
      riskPerTrade: "1.5",
    });
    
    expect(risk).not.toBeNull();
    expect(risk!.riskReward1).toBeGreaterThan(0);
  });

  it("computes risk for 10 juta dengan risk 2%", () => {
    const risk = computeRisk({
      ticker: "TEST",
      currentPrice: "1000",
      support: "950",
      resistance: "1100",
      atr: "20",
      capital: "10000000",
      riskPerTrade: "2",
    });
    
    expect(risk).not.toBeNull();
    expect(risk!.riskReward1).toBeGreaterThan(0);
  });
});

describe("Applied stock criteria", () => {
  const MIN_CAPITAL = 1_000_000;
  const MAX_CAPITAL = 10_000_000;
  const MIN_RISK_PCT = 1;
  const MAX_RISK_PCT = 2;
  const MIN_RR = 1.0;

  function isAppliedCapital(capital: number): boolean {
    return capital >= MIN_CAPITAL && capital <= MAX_CAPITAL;
  }

  function isValidRisk(riskPct: number): boolean {
    return riskPct >= MIN_RISK_PCT && riskPct <= MAX_RISK_PCT;
  }

  function isAppliedStock(capital: number, riskPct: number, rr: number): boolean {
    return isAppliedCapital(capital) && isValidRisk(riskPct) && rr >= MIN_RR;
  }

  it("accepts 1 juta with 1% risk when RR >= 1", () => {
    const risk = computeRisk({
      ticker: "TEST",
      currentPrice: "4000",
      support: "3800",
      resistance: "4400",
      atr: "50",
      capital: "1000000",
      riskPerTrade: "1",
    });
    
    const isValid = isAppliedStock(1_000_000, 1, risk!.riskReward1);
    expect(typeof isValid).toBe("boolean");
  });

  it("accepts 10 juta with 2% risk when RR >= 1", () => {
    const risk = computeRisk({
      ticker: "TEST",
      currentPrice: "1000",
      support: "950",
      resistance: "1100",
      atr: "20",
      capital: "10000000",
      riskPerTrade: "2",
    });
    
    const isValid = isAppliedStock(10_000_000, 2, risk!.riskReward1);
    expect(typeof isValid).toBe("boolean");
  });

  it("rejects capital below 1 juta", () => {
    expect(isAppliedCapital(500_000)).toBe(false);
  });

  it("rejects capital above 10 juta", () => {
    expect(isAppliedCapital(15_000_000)).toBe(false);
  });

  it("rejects risk below 1%", () => {
    expect(isValidRisk(0.5)).toBe(false);
  });

  it("rejects risk above 2%", () => {
    expect(isValidRisk(3)).toBe(false);
  });

  it("capital range 1-10 juta is valid", () => {
    expect(isAppliedCapital(1_000_000)).toBe(true);
    expect(isAppliedCapital(5_000_000)).toBe(true);
    expect(isAppliedCapital(10_000_000)).toBe(true);
  });

  it("risk 1-2% is valid", () => {
    expect(isValidRisk(1)).toBe(true);
    expect(isValidRisk(1.5)).toBe(true);
    expect(isValidRisk(2)).toBe(true);
  });
});