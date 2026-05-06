import { describe, it, expect } from "vitest";
import {
  calculateRiskReward,
  calculatePositionSize,
  computeRisk,
  calculateSetupScore,
  volumeRatio,
} from "../calc";
import type { ScannerInput, RiskInput } from "../types";

describe("calculateRiskReward", () => {
  it("calculates basic RR", () => {
    expect(calculateRiskReward(100, 90, 120)).toBe(2);
  });

  it("returns 0 when risk is 0", () => {
    expect(calculateRiskReward(100, 100, 120)).toBe(0);
  });

  it("handles entry below stop loss", () => {
    expect(calculateRiskReward(100, 110, 120)).toBeCloseTo(2);
  });

  it("handles target below entry", () => {
    const rr = calculateRiskReward(100, 90, 95);
    expect(rr).toBeCloseTo(0.5);
  });

  it("returns 0 when both risk and reward are 0", () => {
    expect(calculateRiskReward(100, 100, 100)).toBe(0);
  });
});

describe("calculatePositionSize", () => {
  it("calculates correct position size", () => {
    const result = calculatePositionSize(10_000_000, 1, 1000, 950);
    // riskBudget = 100000, riskPerShare = 50, rawShares = 2000, lots = 20
    expect(result.lots).toBe(20);
    expect(result.shares).toBe(2000);
    expect(result.maxLoss).toBe(100_000);
    expect(result.positionValue).toBe(2_000_000);
  });

  it("returns zeros when risk per share is 0", () => {
    const result = calculatePositionSize(10_000_000, 1, 1000, 1000);
    expect(result.shares).toBe(0);
    expect(result.lots).toBe(0);
    expect(result.maxLoss).toBe(0);
    expect(result.positionValue).toBe(0);
  });

  it("returns zeros when capital is 0", () => {
    const result = calculatePositionSize(0, 1, 1000, 950);
    expect(result.shares).toBe(0);
  });

  it("returns zeros when risk budget is 0", () => {
    const result = calculatePositionSize(10_000_000, 0, 1000, 950);
    expect(result.shares).toBe(0);
  });

  it("returns zeros when entry is 0", () => {
    const result = calculatePositionSize(10_000_000, 1, 0, 950);
    expect(result.shares).toBe(0);
  });

  it("rounds down to nearest lot", () => {
    const result = calculatePositionSize(10_000_000, 1, 1000, 999);
    // riskBudget = 100000, riskPerShare = 1, rawShares = 100000, lots = 1000
    expect(result.lots).toBe(1000);
    expect(result.shares).toBe(100_000);
  });
});

describe("computeRisk", () => {
  const validInput: RiskInput = {
    ticker: "BBRI",
    currentPrice: "4000",
    support: "3800",
    resistance: "4400",
    atr: "80",
    capital: "10000000",
    riskPerTrade: "1",
  };

  it("returns null when prices are invalid", () => {
    expect(computeRisk({ ...validInput, currentPrice: "abc" })).toBeNull();
  });

  it("returns null when capital is 0", () => {
    expect(computeRisk({ ...validInput, capital: "0" })).toBeNull();
  });

  it("returns null when support is 0", () => {
    expect(computeRisk({ ...validInput, support: "0" })).toBeNull();
  });

  it("calculates risk correctly with valid input", () => {
    const result = computeRisk(validInput);
    expect(result).not.toBeNull();
    expect(result!.entry).toBe(4000);
    expect(result!.stopLoss).toBeLessThan(4000);
    expect(result!.takeProfit1).toBeGreaterThan(4000);
    expect(result!.takeProfit2).toBeGreaterThan(result!.takeProfit1);
    expect(result!.riskReward1).toBeGreaterThan(0);
    expect(result!.riskReward2).toBeGreaterThan(result!.riskReward1);
  });

  it("uses ATR fallback when ATR is not provided", () => {
    const result = computeRisk({ ...validInput, atr: "" });
    expect(result).not.toBeNull();
  });
});

describe("calculateSetupScore", () => {
  const baseInput: ScannerInput = {
    ticker: "BBRI",
    currentPrice: "4000",
    open: "3950",
    high: "4050",
    low: "3920",
    previousClose: "3980",
    todayVolume: "5000000",
    avgVolume20d: "3000000",
    ema20: "3950",
    ema50: "3900",
    ema200: "3800",
    vwap: "3980",
    rsi: "55",
    macd: "bullish",
    stochastic: "K 55 / D 50 (neutral)",
    foreignFlow: "",
    brokerAccumulation: "",
    ihsgTrend: "bullish",
    sectorStrength: "strong",
    resistance: "4200",
    support: "3800",
  };

  it("returns a score between 0 and 100", () => {
    const result = calculateSetupScore(baseInput, 2.5);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("gives higher trend score when price > EMA20", () => {
    const above = calculateSetupScore(baseInput, 2);
    const below = calculateSetupScore(
      { ...baseInput, currentPrice: "3900" },
      2,
    );
    expect(above.trend).toBeGreaterThanOrEqual(below.trend);
  });

  it("gives higher momentum for RSI 50-70", () => {
    const good = calculateSetupScore(baseInput, 2);
    const low = calculateSetupScore({ ...baseInput, rsi: "30" }, 2);
    expect(good.momentum).toBeGreaterThanOrEqual(low.momentum);
  });

  it("gives higher volume score for higher volume ratio", () => {
    const high = calculateSetupScore(baseInput, 2);
    const low = calculateSetupScore(
      { ...baseInput, todayVolume: "1000000", avgVolume20d: "5000000" },
      2,
    );
    expect(high.volume).toBeGreaterThanOrEqual(low.volume);
  });

  it("marks VALID for high scores", () => {
    const result = calculateSetupScore(baseInput, 3);
    expect(["VALID", "WATCHLIST"]).toContain(result.status);
  });

  it("marks REJECT for low scores", () => {
    const result = calculateSetupScore(
      {
        ...baseInput,
        currentPrice: "3500",
        ema20: "4000",
        ema50: "4200",
        ema200: "4500",
        vwap: "4100",
        rsi: "25",
        macd: "bearish",
        ihsgTrend: "bearish",
        sectorStrength: "weak",
      },
      0.5,
    );
    expect(result.status).toBe("REJECT");
  });
});

describe("volumeRatio", () => {
  it("returns ratio when inputs are valid", () => {
    const result = volumeRatio({
      ticker: "BBRI",
      currentPrice: "4000",
      todayVolume: "5000000",
      avgVolume20d: "2500000",
    } as ScannerInput);
    expect(result).toBe(2);
  });

  it("returns null when avg volume is 0", () => {
    const result = volumeRatio({
      ticker: "BBRI",
      todayVolume: "5000000",
      avgVolume20d: "0",
    } as ScannerInput);
    expect(result).toBeNull();
  });

  it("returns null when inputs are missing", () => {
    const result = volumeRatio({
      ticker: "BBRI",
    } as ScannerInput);
    expect(result).toBeNull();
  });
});
