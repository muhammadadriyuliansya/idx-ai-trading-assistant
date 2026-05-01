/**
 * Unified Analysis Pipeline
 *
 * This is the ONLY source of truth for all trading analysis.
 * All modules should be display-only - they render data from this pipeline.
 */

import type {
  QuoteResult,
  RiskCalcResult,
  SetupScoreBreakdown,
} from "./types";
import {
  calculateRiskReward,
  calculateSetupScore,
  computeRisk,
  volumeRatio,
} from "./calc";
import { toNumber } from "./utils";

const LOT_SIZE = 100;

/**
 * Market regime based on IHSG trend and foreign flow
 */
export type MarketRegime = "AGGRESSIVE" | "NORMAL" | "DEFENSIVE";

/**
 * Final verdict for a trade
 */
export type TradeVerdict = "BUY_NOW" | "WAIT" | "WATCHLIST" | "REJECT";

/**
 * Unified analysis result - the single source of truth
 */
export interface AnalysisResult {
  ticker: string;
  fetchedAt: number;

  // Raw market data
  marketData: {
    currentPrice: number;
    open: number;
    high: number;
    low: number;
    previousClose: number;
    todayVolume: number;
    avgVolume20d: number;
    ema20: number;
    ema50: number;
    ema200: number;
    vwap: number;
    rsi: number;
    macd: string;
    stochastic: string;
    support: number;
    resistance: number;
    atr: number;
  };

  // Scanner analysis
  scanner: {
    setupScore: SetupScoreBreakdown;
    volumeRatio: number | null;
    trend: "bullish" | "sideways" | "bearish";
  };

  // Risk analysis
  risk: {
    calc: RiskCalcResult | null;
    rr: number;
  };

  // Market context
  context: {
    ihsgTrend: "bullish" | "sideways" | "bearish" | "unknown";
    ihsgChange1d?: number;
    ihsgChange5d?: number;
    regime: MarketRegime;
  };

  // Final decision
  decision: {
    verdict: TradeVerdict;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    reasoning: string;
  };

  // Summary
  summary: {
    verdict: TradeVerdict;
    score: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
  };
}

/**
 * Input for running full analysis
 */
export interface AnalysisInput {
  ticker: string;
  capital: number;
  riskPerTrade: number;
  // Optional manual overrides
  manualContext?: {
    foreignFlow?: string;
    usMarket?: string;
    commodityTrend?: string;
    interestRate?: string;
    usdIdr?: number;
    sector?: string;
    sectorStrength?: string;
  };
}

/**
 * Run full analysis pipeline
 *
 * This is the ONLY function that should be used to analyze a ticker.
 * It fetches data, calculates everything, and returns a unified result.
 */
export async function runFullAnalysis(
  input: AnalysisInput,
): Promise<AnalysisResult> {
  // Step 1: Fetch market data
  const quote = await fetchQuoteData(input.ticker);

  // Step 2: Parse market data
  const marketData = parseMarketData(quote);

  // Step 3: Calculate scanner analysis
  const scanner = calculateScannerAnalysis(marketData, quote);

  // Step 4: Calculate risk analysis
  const risk = calculateRiskAnalysis(marketData, input.capital, input.riskPerTrade);

  // Step 5: Calculate market context
  const context = calculateMarketContext(quote, input.manualContext);

  // Step 6: Calculate final decision
  const decision = calculateFinalDecision(scanner, risk, context);

  // Step 7: Build summary
  const summary = {
    verdict: decision.verdict,
    score: scanner.setupScore.total,
    confidence: decision.confidence,
  };

  return {
    ticker: input.ticker.toUpperCase(),
    fetchedAt: Date.now(),
    marketData,
    scanner,
    risk,
    context,
    decision,
    summary,
  };
}

/**
 * Fetch quote data from API
 */
async function fetchQuoteData(ticker: string): Promise<QuoteResult> {
  const res = await fetch(
    `/api/quote?ticker=${encodeURIComponent(ticker)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch ${ticker}`);
  }

  return res.json() as Promise<QuoteResult>;
}

/**
 * Parse market data from quote result
 */
function parseMarketData(quote: QuoteResult) {
  const s = quote.scanner;
  const r = quote.risk;

  return {
    currentPrice: toNumber(s.currentPrice),
    open: toNumber(s.open),
    high: toNumber(s.high),
    low: toNumber(s.low),
    previousClose: toNumber(s.previousClose),
    todayVolume: toNumber(s.todayVolume),
    avgVolume20d: toNumber(s.avgVolume20d),
    ema20: toNumber(s.ema20),
    ema50: toNumber(s.ema50),
    ema200: toNumber(s.ema200),
    vwap: toNumber(s.vwap),
    rsi: toNumber(s.rsi),
    macd: s.macd || "",
    stochastic: s.stochastic || "",
    support: toNumber(s.support),
    resistance: toNumber(s.resistance),
    atr: toNumber(r.atr),
  };
}

/**
 * Calculate scanner analysis
 */
function calculateScannerAnalysis(
  marketData: ReturnType<typeof parseMarketData>,
  quote: QuoteResult,
) {
  const scannerInput = {
    ticker: quote.ticker,
    currentPrice: String(marketData.currentPrice),
    open: String(marketData.open),
    high: String(marketData.high),
    low: String(marketData.low),
    previousClose: String(marketData.previousClose),
    todayVolume: String(marketData.todayVolume),
    avgVolume20d: String(marketData.avgVolume20d),
    ema20: String(marketData.ema20),
    ema50: String(marketData.ema50),
    ema200: String(marketData.ema200),
    vwap: String(marketData.vwap),
    rsi: String(marketData.rsi),
    macd: marketData.macd,
    stochastic: marketData.stochastic,
    foreignFlow: "",
    brokerAccumulation: "",
    ihsgTrend: quote.meta.ihsgTrend,
    sectorStrength: "",
    support: String(marketData.support),
    resistance: String(marketData.resistance),
  };

  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance,
  );

  const setupScore = calculateSetupScore(scannerInput, rr);
  const volRatio = volumeRatio(scannerInput);

  return {
    setupScore,
    volumeRatio: volRatio,
    trend: quote.meta.trend,
  };
}

/**
 * Calculate risk analysis
 */
function calculateRiskAnalysis(
  marketData: ReturnType<typeof parseMarketData>,
  capital: number,
  riskPerTrade: number,
) {
  const riskInput = {
    ticker: "",
    currentPrice: String(marketData.currentPrice),
    support: String(marketData.support),
    resistance: String(marketData.resistance),
    atr: String(marketData.atr),
    capital: String(capital),
    riskPerTrade: String(riskPerTrade),
  };

  const calc = computeRisk(riskInput);
  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance,
  );

  return {
    calc,
    rr,
  };
}

/**
 * Calculate market context
 */
function calculateMarketContext(
  quote: QuoteResult,
  manual?: AnalysisInput["manualContext"],
) {
  const ihsgTrend = quote.meta.ihsgTrend;
  const ihsgChange1d = quote.meta.ihsgChange1d;
  const ihsgChange5d = quote.meta.ihsgChange5d;

  // Determine regime based on IHSG trend
  let regime: MarketRegime = "NORMAL";
  if (ihsgTrend === "bullish" && (ihsgChange5d ?? 0) > 0) {
    regime = "AGGRESSIVE";
  } else if (ihsgTrend === "bearish" || (ihsgChange5d ?? 0) < -1) {
    regime = "DEFENSIVE";
  }

  return {
    ihsgTrend,
    ihsgChange1d,
    ihsgChange5d,
    regime,
  };
}

/**
 * Calculate final decision
 */
function calculateFinalDecision(
  scanner: ReturnType<typeof calculateScannerAnalysis>,
  risk: ReturnType<typeof calculateRiskAnalysis>,
  context: ReturnType<typeof calculateMarketContext>,
) {
  const score = scanner.setupScore.total;
  const rr = risk.rr;
  const regime = context.regime;

  let verdict: TradeVerdict = "REJECT";
  let confidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let reasoning = "";

  // Decision logic
  if (score >= 75 && rr >= 2) {
    if (regime === "AGGRESSIVE") {
      verdict = "BUY_NOW";
      confidence = "HIGH";
      reasoning = "Strong setup with good RR in aggressive market";
    } else if (regime === "NORMAL") {
      verdict = "BUY_NOW";
      confidence = "MEDIUM";
      reasoning = "Good setup with acceptable RR";
    } else {
      verdict = "WAIT";
      confidence = "MEDIUM";
      reasoning = "Good setup but defensive market - wait for better entry";
    }
  } else if (score >= 60) {
    verdict = "WATCHLIST";
    confidence = "MEDIUM";
    reasoning = "Decent setup worth monitoring";
  } else if (score >= 45) {
    verdict = "WAIT";
    confidence = "LOW";
    reasoning = "Weak setup - wait for confirmation";
  } else {
    verdict = "REJECT";
    confidence = "HIGH";
    reasoning = "Poor setup - avoid";
  }

  // Adjust for low RR
  if (rr < 1.5 && verdict !== "REJECT") {
    verdict = "REJECT";
    confidence = "HIGH";
    reasoning = "RR below minimum threshold (1.5)";
  }

  return {
    verdict,
    confidence,
    reasoning,
  };
}

/**
 * Format analysis result for display
 */
export function formatAnalysisResult(result: AnalysisResult) {
  return {
    ticker: result.ticker,
    verdict: result.decision.verdict,
    score: result.summary.score,
    confidence: result.summary.confidence,
    rr: result.risk.rr,
    entry: result.risk.calc?.entry,
    stopLoss: result.risk.calc?.stopLoss,
    takeProfit1: result.risk.calc?.takeProfit1,
    takeProfit2: result.risk.calc?.takeProfit2,
    lots: result.risk.calc?.lots,
    maxLoss: result.risk.calc?.maxLoss,
    regime: result.context.regime,
    trend: result.scanner.trend,
    volumeRatio: result.scanner.volumeRatio,
  };
}
