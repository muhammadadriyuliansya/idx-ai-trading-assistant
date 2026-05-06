import { describe, it, expect } from "vitest";
import {
  isValidCapital,
  isValidRiskPct,
  isValidProfitPct,
  validateTradingConfig,
  analyzeStockForApplied,
  getAppliedOnly,
  getRejectedOnly,
  sortByRR,
  sortByProfit,
  DEFAULT_SMALL_CAPITAL_CONFIG,
  DEFAULT_MEDIUM_CAPITAL_CONFIG,
  DEFAULT_LARGE_CAPITAL_CONFIG,
} from "../stock-filter";
import type { ScannerInput } from "../types";

describe("Stock Filter - Capital Validation", () => {
  it("accepts 1 juta as minimum valid capital", () => {
    expect(isValidCapital(1_000_000)).toBe(true);
  });

  it("accepts 10 juta as maximum valid capital", () => {
    expect(isValidCapital(10_000_000)).toBe(true);
  });

  it("accepts 5 juta as middle valid capital", () => {
    expect(isValidCapital(5_000_000)).toBe(true);
  });

  it("rejects below 1 juta", () => {
    expect(isValidCapital(500_000)).toBe(false);
  });

  it("rejects above 10 juta", () => {
    expect(isValidCapital(15_000_000)).toBe(false);
  });
});

describe("Stock Filter - Risk Validation", () => {
  it("accepts 1% as minimum valid risk", () => {
    expect(isValidRiskPct(1)).toBe(true);
  });

  it("accepts 2% as maximum valid risk", () => {
    expect(isValidRiskPct(2)).toBe(true);
  });

  it("accepts 1.5% as middle valid risk", () => {
    expect(isValidRiskPct(1.5)).toBe(true);
  });

  it("rejects below 1%", () => {
    expect(isValidRiskPct(0.5)).toBe(false);
  });

  it("rejects above 2%", () => {
    expect(isValidRiskPct(3)).toBe(false);
  });
});

describe("Stock Filter - Profit Validation", () => {
  it("accepts 1-2% profit range", () => {
    expect(isValidProfitPct(1)).toBe(true);
    expect(isValidProfitPct(1.5)).toBe(true);
    expect(isValidProfitPct(2)).toBe(true);
  });

  it("rejects outside range", () => {
    expect(isValidProfitPct(0.5)).toBe(false);
    expect(isValidProfitPct(3)).toBe(false);
  });
});

describe("Stock Filter - Config Validation", () => {
  it("accepts valid small capital config", () => {
    const result = validateTradingConfig(DEFAULT_SMALL_CAPITAL_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts valid medium capital config", () => {
    const result = validateTradingConfig(DEFAULT_MEDIUM_CAPITAL_CONFIG);
    expect(result.valid).toBe(true);
  });

  it("accepts valid large capital config", () => {
    const result = validateTradingConfig(DEFAULT_LARGE_CAPITAL_CONFIG);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid capital", () => {
    const result = validateTradingConfig({
      capital: 500_000,
      riskPerTrade: 1,
      targetProfit: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Capital must be between 1-10 million IDR");
  });

  it("rejects invalid risk", () => {
    const result = validateTradingConfig({
      capital: 1_000_000,
      riskPerTrade: 5,
      targetProfit: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Risk per trade must be between 1-2%");
  });
});

describe("Stock Filter - Applied Analysis", () => {
  const validScanner: ScannerInput = {
    ticker: "BBRI",
    currentPrice: "4000",
    open: "3950",
    high: "4100",
    low: "3900",
    previousClose: "3980",
    todayVolume: "5000000",
    avgVolume20d: "3000000",
    ema20: "3950",
    ema50: "3900",
    ema200: "3800",
    vwap: "3980",
    rsi: "55",
    macd: "bullish",
    stochastic: "neutral",
    foreignFlow: "",
    brokerAccumulation: "",
    ihsgTrend: "bullish",
    sectorStrength: "strong",
    resistance: "4400",
    support: "3800",
  };

  it("analyzes valid stock as applied", () => {
    const result = analyzeStockForApplied("BBRI", validScanner, DEFAULT_SMALL_CAPITAL_CONFIG);
    
    expect(result.isApplied).toBe(true);
    expect(result.riskResult).not.toBeNull();
    expect(result.rr).toBeGreaterThan(0);
    expect(result.setupScore).toBeGreaterThan(0);
  });

  it("calculates position size correctly", () => {
    const result = analyzeStockForApplied("BBRI", validScanner, DEFAULT_MEDIUM_CAPITAL_CONFIG);
    
    expect(result.lotSize).toBeGreaterThan(0);
    expect(result.positionValue).toBeGreaterThan(0);
    expect(result.maxLoss).toBeGreaterThan(0);
  });

  it("calculates estimated profit", () => {
    const result = analyzeStockForApplied("BBRI", validScanner, DEFAULT_LARGE_CAPITAL_CONFIG);
    
    expect(result.estimatedProfit).toBeGreaterThan(0);
  });
});

describe("Stock Filter - Filter Results", () => {
  interface MockResult {
    ticker: string;
    isApplied: boolean;
    rr: number;
    estimatedProfit: number;
  }

  const mockResults: MockResult[] = [
    { ticker: "BBRI", isApplied: true, rr: 2.0, estimatedProfit: 50000 },
    { ticker: "TLKM", isApplied: false, rr: 0.8, estimatedProfit: 0 },
    { ticker: "BMRI", isApplied: true, rr: 1.5, estimatedProfit: 30000 },
    { ticker: "ASII", isApplied: false, rr: 0.5, estimatedProfit: 0 },
  ];

  it("filters applied stocks only", () => {
    const applied = getAppliedOnly(mockResults);
    expect(applied).toHaveLength(2);
    expect(applied.map((r) => r.ticker)).toContain("BBRI");
    expect(applied.map((r) => r.ticker)).toContain("BMRI");
  });

  it("filters rejected stocks only", () => {
    const rejected = getRejectedOnly(mockResults);
    expect(rejected).toHaveLength(2);
  });

  it("sorts by RR descending", () => {
    const sorted = sortByRR(mockResults);
    expect(sorted[0].rr).toBe(2.0);
    expect(sorted[1].rr).toBe(1.5);
  });

  it("sorts by profit descending", () => {
    const sorted = sortByProfit(mockResults);
    expect(sorted[0].estimatedProfit).toBe(50000);
  });
});