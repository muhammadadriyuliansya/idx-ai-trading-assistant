import { describe, expect, it } from "vitest";
import { runTechnicalSkill } from "@/pipeline/skills/technical-analyst-skill";
import { runFundamentalSkill } from "@/pipeline/skills/fundamental-analyst-skill";
import { runRiskManagerSkill } from "@/pipeline/skills/risk-manager-skill";
import { runMacroSkill } from "@/pipeline/skills/macro-analyst-skill";
import { runThesisDebaterSkill } from "@/pipeline/skills/thesis-debater-skill";
import type {
  ContextResult,
  FundamentalEnrichment,
  FundamentalSnapshot,
  IndicatorSet,
  MarketBar,
  MarketData,
  RiskResult,
} from "@/pipeline/types";

function buildBars(): MarketBar[] {
  return Array.from({ length: 60 }, (_, index) => {
    const base = 900 + index * 6;
    return {
      timestamp: Date.UTC(2026, 0, index + 1),
      open: base - 5,
      high: base + 15,
      low: base - 15,
      close: base + (index % 5 === 0 ? 8 : 2),
      volume: 1_000_000 + index * 20_000,
    };
  });
}

const marketData: MarketData = {
  ticker: "BBRI.JK",
  currentPrice: 1260,
  open: 1245,
  high: 1275,
  low: 1230,
  previousClose: 1240,
  todayVolume: 2_100_000,
  avgVolume20d: 1_500_000,
  support: 1210,
  resistance: 1310,
  atr: 22,
  fetchedAt: Date.now(),
};

const indicators: IndicatorSet = {
  ema20: 1225,
  ema50: 1180,
  ema200: 1080,
  vwap: 1248,
  rsi: 61,
  macd: { macd: 1, signal: 0.4, histogram: 0.6, label: "bullish cross" },
  stochastic: { k: 74, d: 68, label: "neutral" },
  trend: "bullish",
  volumeRatio: 1.4,
};

const risk: RiskResult = {
  ticker: "BBRI.JK",
  currentPrice: 1260,
  support: 1210,
  resistance: 1310,
  capital: 10_000_000,
  riskPerTrade: 0.5,
  riskBudget: 50_000,
  entryZone: "1260 - 1273",
  stopLoss: "1199",
  stopReason: "Below support with ATR buffer",
  tp1: "1335",
  tp1Reason: "range",
  tp2: "1386",
  tp2Reason: "extension",
  rr1: 1.23,
  rr2: 2.07,
  positionSize: {
    lots: 8,
    shares: 800,
    maxLoss: 48_800,
    positionValue: 1_008_000,
  },
  verdict: "ADJUST",
  reasoning: "Marginal RR",
};

const context: ContextResult = {
  marketRegime: "NORMAL",
  riskStance: "NEUTRAL",
  sectorTake: "stable",
  flowRead: "balanced",
  keyRisks: ["rotation"],
  strategyBias: "Balanced approach",
  reasoning: "Neutral market backdrop",
};

describe("internal skill layer", () => {
  it("builds a structured technical skill report", () => {
    const report = runTechnicalSkill({
      marketData,
      indicators,
      recentBars: buildBars(),
    });

    expect(report.primaryTrend).toBe("bullish");
    expect(report.technicalScore).toBeGreaterThanOrEqual(1);
    expect(report.technicalScore).toBeLessThanOrEqual(10);
    expect(report.supportLevels.length).toBeGreaterThan(0);
    expect(report.momentum.macd.signal).toBe("bullish");
  });

  it("keeps fundamental output honest when history is missing", () => {
    const fundamental: FundamentalSnapshot = {
      per: 11,
      pbv: 1.9,
      dividendYield: 0.04,
      marketCap: 500_000_000_000,
      roe: 0.18,
      der: 85,
      revenueGrowth: 0.07,
      earningsGrowth: 0.1,
      eps: 120,
    };
    const enrichment: FundamentalEnrichment = {
      source: "fallback",
      sector: "Banking",
      industry: "Regional Banks",
      netProfitMargin: null,
      dividendYield: 0.04,
      forwardPe: null,
      priceToBook: 1.9,
      historical: [],
      industryBenchmark: { per: 13, pbv: 2.0, label: "IDX Banking" },
      gaps: ["3-year income history unavailable"],
    };

    const report = runFundamentalSkill({
      ticker: "BBRI.JK",
      fundamental,
      enrichment,
    });

    expect(report.redFlags).toContain("3-year income history unavailable");
    expect(report.fundamentalScore).toBeGreaterThanOrEqual(1);
    expect(report.valuationOpinion).toBe("undervalued");
  });

  it("flags arb execution risk in the risk skill", () => {
    const report = runRiskManagerSkill({
      marketData: {
        ...marketData,
        currentPrice: 945,
        previousClose: 1240,
      },
      risk,
    });

    expect(report.arbWarning).toBe(true);
    expect(report.overallRiskRating).toBe("high");
  });

  it("marks missing macro feeds without blocking output", () => {
    const report = runMacroSkill({
      ticker: "BBRI.JK",
      sector: "Banking",
      macroSignals: {
        source: "derived",
        biRate: null,
        inflation: null,
        usdIdr: null,
        sp500Change1d: null,
        dxyProxy: null,
        commodityBias: null,
        policyCatalyst: null,
        keyDrivers: [{ factor: "IHSG 5d +1.2%", impact: "positive" }],
        gaps: ["BI rate not connected yet", "Inflation feed not connected yet"],
      },
      context,
    });

    expect(report.missingData.length).toBeGreaterThan(0);
    expect(report.macroSentimentScore).toBeGreaterThanOrEqual(1);
  });

  it("shows advisory conflict when skill likes a setup but guard says no trade", () => {
    const technical = runTechnicalSkill({
      marketData,
      indicators,
      recentBars: buildBars(),
    });
    const fundamental = runFundamentalSkill({
      ticker: "BBRI.JK",
      fundamental: {
        per: 11,
        pbv: 1.8,
        dividendYield: 0.04,
        marketCap: 1,
        roe: 0.18,
        der: 80,
        revenueGrowth: 0.06,
        earningsGrowth: 0.08,
        eps: 120,
      },
      enrichment: {
        source: "yahoo",
        sector: "Banking",
        industry: "Regional Banks",
        netProfitMargin: 0.22,
        dividendYield: 0.04,
        forwardPe: 10,
        priceToBook: 1.8,
        historical: [
          { year: "2025", revenue: 130, netIncome: 55 },
          { year: "2024", revenue: 118, netIncome: 47 },
          { year: "2023", revenue: 110, netIncome: 40 },
        ],
        industryBenchmark: { per: 13, pbv: 2, label: "IDX Banking" },
        gaps: [],
      },
    });
    const macro = runMacroSkill({
      ticker: "BBRI.JK",
      sector: "Banking",
      macroSignals: {
        source: "derived",
        biRate: null,
        inflation: null,
        usdIdr: null,
        sp500Change1d: null,
        dxyProxy: null,
        commodityBias: null,
        policyCatalyst: null,
        keyDrivers: [{ factor: "IHSG 5d +1.2%", impact: "positive" }],
        gaps: [],
      },
      context,
    });
    const riskSkill = runRiskManagerSkill({ marketData, risk: { ...risk, rr1: 2.1, verdict: "ACCEPT" } });

    const thesis = runThesisDebaterSkill({
      ticker: "BBRI.JK",
      technical,
      fundamental,
      macro,
      riskSkill,
      risk: { ...risk, rr1: 2.1, verdict: "ACCEPT" },
      decision: {
        finalDecision: "NO_TRADE",
        confidenceScore: 60,
        successProbability: 48,
        keyEdge: "trend",
        keyRisk: "guard",
        bullishScenario: "up",
        bearishScenario: "down",
        executionNotes: "review only",
        reasoning: "blocked",
        riskLevel: "HIGH",
        urgency: "monitor",
      },
      riskGovernor: {
        mode: "swing",
        status: "NO_TRADE",
        canOpenNewTrade: true,
        entryAllowed: false,
        dailyTargetPct: 1,
        dailyHardStopPct: -0.75,
        fullStopProfitPct: 2,
        maxTrades: 3,
        realizedPnl: 0,
        realizedPct: 0,
        tradesTaken: 0,
        remainingDailyRisk: 50_000,
        requestedRiskPerTrade: 0.5,
        baseRiskPerTrade: 0.5,
        effectiveRiskPerTrade: 0,
        recommendedRiskPerTrade: 0,
        riskQualifiedForScaleUp: false,
        gates: [],
        notes: [],
        noTradeReason: "Daily guard review only",
      },
    });

    expect(thesis.advisoryConflict).toContain("daily guard");
    expect(thesis.recommendedSetup).toBe("stay_away");
  });
});
