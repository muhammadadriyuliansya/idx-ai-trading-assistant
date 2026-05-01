/**
 * Central orchestrator for the unified analysis pipeline
 * Coordinates data fetching, indicator calculation, and agent execution
 */

import type {
  AnalysisPipeline,
  MarketData,
  IndicatorSet,
  ScannerResult,
  RiskResult,
  ContextResult,
  DebateResult,
  DecisionResult,
} from './types'
import type { AISettings } from '@/lib/types'
import { applyHardFilters, DEFAULT_FILTERS } from './filters'
import { calculateSetupScore } from '@/lib/calc'
import { computeRisk } from '@/lib/calc'
import { ema, rsi, macd, atr, vwap, rollingVwap, avgVolume, swingLevels, classifyTrend, describeMacd, describeStochastic } from '@/lib/indicators'
import { Bar } from '@/lib/indicators'
import { fetch as fetchQuote } from '@/lib/quote'

/**
 * Run full analysis pipeline for a ticker
 */
export async function runFullAnalysis(
  ticker: string,
  settings: AISettings
): Promise<AnalysisPipeline> {
  try {
    // 1. Fetch market data
    const marketData = await fetchMarketData(ticker)

    // 2. Calculate indicators
    const indicators = calculateIndicators(marketData)

    // 3. Apply hard filters
    const filterResult = applyHardFilters(marketData, indicators)
    if (!filterResult.passed) {
      return createRejectedPipeline(ticker, marketData, indicators, filterResult.reason)
    }

    // 4. Run scanner agent
    const scanner = await runScannerAgent(marketData, indicators, settings)

    // 5. Run risk agent
    const risk = await runRiskAgent(marketData, indicators, scanner, settings)

    // 6. Run context agent
    const context = await runContextAgent(marketData, indicators, settings)

    // 7. Run debate agent
    const debate = await runDebateAgent(scanner, risk, context, settings)

    // 8. Run decision agent
    const decision = await runDecisionAgent(scanner, risk, context, debate, settings)

    // 9. Calculate final score
    const finalScore = calculateFinalScore(scanner, risk, context, debate, decision)

    return {
      ticker,
      timestamp: Date.now(),
      marketData,
      indicators,
      scanner,
      risk,
      context,
      debate,
      decision,
      finalScore,
      confidence: scanner.confidence,
      status: scanner.status,
    }
  } catch (error) {
    console.error(`Analysis failed for ${ticker}:`, error)
    throw error
  }
}

/**
 * Fetch market data for a ticker
 */
export async function fetchMarketData(ticker: string): Promise<MarketData> {
  const quote = await fetchQuote(ticker)

  if (!quote || !quote.data) {
    throw new Error(`Failed to fetch data for ${ticker}`)
  }

  const data = quote.data
  const meta = quote.meta

  return {
    ticker: data.ticker,
    currentPrice: parseFloat(data.currentPrice),
    open: parseFloat(data.open),
    high: parseFloat(data.high),
    low: parseFloat(data.low),
    previousClose: parseFloat(data.previousClose),
    todayVolume: parseFloat(data.todayVolume),
    avgVolume20d: parseFloat(data.avgVolume20d),
    support: parseFloat(data.support),
    resistance: parseFloat(data.resistance),
    atr: parseFloat(data.atr),
    fetchedAt: Date.now(),
  }
}

/**
 * Calculate all technical indicators from market data
 */
export function calculateIndicators(marketData: MarketData): IndicatorSet {
  // For now, return simplified indicators
  // In production, this would use actual OHLCV data

  const ema20 = marketData.currentPrice * 0.95 // Placeholder
  const ema50 = marketData.currentPrice * 0.90 // Placeholder
  const ema200 = marketData.currentPrice * 0.85 // Placeholder
  const vwap = marketData.currentPrice * 0.98 // Placeholder
  const rsi = 55 // Placeholder
  const volumeRatio = marketData.todayVolume / marketData.avgVolume20d

  // Determine trend
  let trend: IndicatorSet['trend'] = 'sideways'
  if (marketData.currentPrice > ema20 && ema20 > ema50) {
    trend = 'bullish'
  } else if (marketData.currentPrice < ema20 && ema20 < ema50) {
    trend = 'bearish'
  }

  return {
    ema20,
    ema50,
    ema200,
    vwap,
    rsi,
    macd: {
      macd: 0,
      signal: 0,
      histogram: 0,
      label: 'netral',
    },
    stochastic: {
      k: 50,
      d: 50,
      label: 'neutral',
    },
    trend,
    volumeRatio,
  }
}

/**
 * Run scanner agent
 */
async function runScannerAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  settings: AISettings
): Promise<ScannerResult> {
  // Calculate setup score
  const setupScore = calculateSetupScore(
    {
      ticker: marketData.ticker,
      currentPrice: marketData.currentPrice.toString(),
      open: marketData.open.toString(),
      high: marketData.high.toString(),
      low: marketData.low.toString(),
      previousClose: marketData.previousClose.toString(),
      todayVolume: marketData.todayVolume.toString(),
      avgVolume20d: marketData.avgVolume20d.toString(),
      ema20: indicators.ema20.toString(),
      ema50: indicators.ema50.toString(),
      ema200: indicators.ema200.toString(),
      vwap: indicators.vwap.toString(),
      rsi: indicators.rsi.toString(),
      macd: indicators.macd.label,
      stochastic: indicators.stochastic.label,
      foreignFlow: '',
      brokerAccumulation: '',
      ihsgTrend: indicators.trend,
      sectorStrength: '',
      support: marketData.support.toString(),
      resistance: marketData.resistance.toString(),
    },
    calculateRiskReward(marketData.currentPrice, marketData.support, marketData.resistance)
  )

  // Determine confidence and status
  let confidence: ScannerResult['confidence'] = 'LOW'
  if (setupScore.total >= 75) confidence = 'HIGH'
  else if (setupScore.total >= 55) confidence = 'MEDIUM'

  // Determine setup type based on indicators
  let setupType: ScannerResult['setupType'] = 'no_setup'
  if (indicators.trend === 'bullish' && indicators.volumeRatio > 1.5) {
    setupType = 'breakout'
  } else if (indicators.trend === 'bullish' && indicators.rsi >= 40 && indicators.rsi <= 60) {
    setupType = 'pullback'
  } else if (indicators.trend === 'bearish' && indicators.rsi < 30) {
    setupType = 'reversal'
  }

  return {
    setupType,
    setupScore: setupScore.total,
    confidence,
    status: setupScore.status,
    keyReads: [
      `Trend: ${indicators.trend}`,
      `Volume: ${indicators.volumeRatio.toFixed(2)}x average`,
      `RSI: ${indicators.rsi.toFixed(1)}`,
      `Price vs EMA20: ${marketData.currentPrice > indicators.ema20 ? 'Above' : 'Below'}`,
    ],
    warnings: [],
    actionPlan: 'Monitor for confirmation',
    reasoning: `Setup score ${setupScore.total}/100 based on trend, momentum, and volume analysis.`,
  }
}

/**
 * Run risk agent
 */
async function runRiskAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  scanner: ScannerResult,
  settings: AISettings
): Promise<RiskResult> {
  // Calculate risk parameters
  const riskCalc = computeRisk({
    ticker: marketData.ticker,
    currentPrice: marketData.currentPrice.toString(),
    support: marketData.support.toString(),
    resistance: marketData.resistance.toString(),
    atr: marketData.atr.toString(),
    capital: '100000000', // Default 100M
    riskPerTrade: '1',
  })

  if (!riskCalc) {
    throw new Error('Failed to calculate risk parameters')
  }

  // Determine verdict
  let verdict: RiskResult['verdict'] = 'REJECT'
  if (riskCalc.riskReward1 >= 2.0) {
    verdict = 'ACCEPT'
  } else if (riskCalc.riskReward1 >= 1.5) {
    verdict = 'ADJUST'
  }

  return {
    entryZone: `${riskCalc.entry.toFixed(0)} - ${(riskCalc.entry * 1.01).toFixed(0)}`,
    stopLoss: riskCalc.stopLoss.toFixed(0),
    stopReason: 'Below support with ATR buffer',
    tp1: riskCalc.takeProfit1.toFixed(0),
    tp1Reason: '60% of range to resistance',
    tp2: riskCalc.takeProfit2.toFixed(0),
    tp2Reason: 'Full range to resistance',
    rr1: riskCalc.riskReward1,
    rr2: riskCalc.riskReward2,
    positionSize: {
      lots: riskCalc.lots,
      shares: riskCalc.shares,
      maxLoss: riskCalc.maxLoss,
      positionValue: riskCalc.positionValue,
    },
    verdict,
    reasoning: `RR ${riskCalc.riskReward1.toFixed(2)} meets minimum requirements. Position sized for 1% risk.`,
  }
}

/**
 * Run context agent
 */
async function runContextAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  settings: AISettings
): Promise<ContextResult> {
  // Simplified context analysis
  let marketRegime: ContextResult['marketRegime'] = 'NORMAL'
  let riskStance: ContextResult['riskStance'] = 'NEUTRAL'

  if (indicators.trend === 'bullish' && indicators.volumeRatio > 1.5) {
    marketRegime = 'AGGRESSIVE'
    riskStance = 'RISK-ON'
  } else if (indicators.trend === 'bearish') {
    marketRegime = 'DEFENSIVE'
    riskStance = 'RISK-OFF'
  }

  return {
    marketRegime,
    riskStance,
    sectorTake: 'Analyze sector rotation',
    flowRead: 'Monitor foreign flow',
    keyRisks: [
      'Market volatility',
      'Sector rotation',
      'Foreign outflow risk',
    ],
    strategyBias: marketRegime === 'AGGRESSIVE' ? 'Can be selective aggressive' : 'Stay defensive',
    reasoning: `Market regime ${marketRegime} based on trend ${indicators.trend} and volume ${indicators.volumeRatio.toFixed(2)}x.`,
  }
}

/**
 * Run debate agent
 */
async function runDebateAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  settings: AISettings
): Promise<DebateResult> {
  const bullishArguments: string[] = []
  const bearishArguments: string[] = []

  // Generate arguments based on analysis
  if (scanner.setupScore >= 70) {
    bullishArguments.push(`Strong setup score ${scanner.setupScore}/100`)
  }
  if (risk.rr1 >= 2.0) {
    bullishArguments.push(`Excellent risk/reward ${risk.rr1.toFixed(2)}`)
  }
  if (context.marketRegime === 'AGGRESSIVE') {
    bullishArguments.push('Favorable market regime')
  }

  if (scanner.warnings.length > 0) {
    bearishArguments.push(...scanner.warnings)
  }
  if (risk.verdict === 'REJECT') {
    bearishArguments.push('Poor risk parameters')
  }
  if (context.marketRegime === 'DEFENSIVE') {
    bearishArguments.push('Defensive market conditions')
  }

  // Determine consensus
  let consensus: DebateResult['consensus'] = 'NEUTRAL'
  if (bullishArguments.length > bearishArguments.length) {
    consensus = 'BULLISH'
  } else if (bearishArguments.length > bullishArguments.length) {
    consensus = 'BEARISH'
  }

  const confidence = Math.min(100, Math.max(0, scanner.setupScore))

  return {
    bullishArguments,
    bearishArguments,
    consensus,
    confidence,
    keyFactors: [
      `Setup quality: ${scanner.setupScore}/100`,
      `Risk/reward: ${risk.rr1.toFixed(2)}`,
      `Market regime: ${context.marketRegime}`,
    ],
    reasoning: `${bullishArguments.length} bullish vs ${bearishArguments.length} bearish arguments. Consensus: ${consensus}.`,
  }
}

/**
 * Run decision agent
 */
async function runDecisionAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult,
  settings: AISettings
): Promise<DecisionResult> {
  // Determine final decision
  let finalDecision: DecisionResult['finalDecision'] = 'REJECT'

  if (scanner.status === 'VALID' && risk.verdict === 'ACCEPT' && debate.consensus === 'BULLISH') {
    finalDecision = 'BUY_NOW'
  } else if (scanner.status === 'WATCHLIST' || risk.verdict === 'ADJUST') {
    finalDecision = 'WATCHLIST'
  } else if (debate.consensus === 'NEUTRAL') {
    finalDecision = 'WAIT'
  }

  const confidenceScore = scanner.setupScore
  const successProbability = Math.min(95, Math.max(30, scanner.setupScore + 10))

  return {
    finalDecision,
    confidenceScore,
    successProbability,
    keyEdge: debate.bullishArguments[0] || 'Strong technical setup',
    keyRisk: debate.bearishArguments[0] || 'Market volatility',
    bullishScenario: `Price targets ${risk.tp1} (TP1) and ${risk.tp2} (TP2) with RR ${risk.rr1.toFixed(2)}`,
    bearishScenario: `Stop loss at ${risk.stopLoss} with max loss ${formatCurrency(risk.positionSize.maxLoss)}`,
    executionNotes: context.marketRegime === 'AGGRESSIVE' ? 'Can enter on pullback' : 'Wait for confirmation',
    reasoning: `Final decision ${finalDecision} based on scanner ${scanner.status}, risk ${risk.verdict}, and debate ${debate.consensus}.`,
  }
}

/**
 * Calculate final score from all agent results
 */
function calculateFinalScore(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult,
  decision: DecisionResult
): number {
  let score = 0

  // Scanner contribution (40%)
  score += scanner.setupScore * 0.4

  // Risk contribution (25%)
  if (risk.verdict === 'ACCEPT') {
    score += 25
  } else if (risk.verdict === 'ADJUST') {
    score += 15
  }

  // Context contribution (15%)
  if (context.marketRegime === 'AGGRESSIVE') {
    score += 15
  } else if (context.marketRegime === 'NORMAL') {
    score += 10
  }

  // Debate contribution (10%)
  if (debate.consensus === 'BULLISH') {
    score += 10
  } else if (debate.consensus === 'NEUTRAL') {
    score += 5
  }

  // Decision confidence (10%)
  score += (decision.confidenceScore / 100) * 10

  return Math.round(Math.min(100, Math.max(0, score)))
}

/**
 * Create rejected pipeline result
 */
function createRejectedPipeline(
  ticker: string,
  marketData: MarketData,
  indicators: IndicatorSet,
  reason: string
): AnalysisPipeline {
  return {
    ticker,
    timestamp: Date.now(),
    marketData,
    indicators,
    scanner: {
      setupType: 'no_setup',
      setupScore: 0,
      confidence: 'LOW',
      status: 'REJECT',
      keyReads: [],
      warnings: [reason],
      actionPlan: 'Skip this setup',
      reasoning: `Rejected by hard filters: ${reason}`,
    },
    risk: {
      entryZone: 'N/A',
      stopLoss: 'N/A',
      stopReason: 'N/A',
      tp1: 'N/A',
      tp1Reason: 'N/A',
      tp2: 'N/A',
      tp2Reason: 'N/A',
      rr1: 0,
      rr2: 0,
      positionSize: { lots: 0, shares: 0, maxLoss: 0, positionValue: 0 },
      verdict: 'REJECT',
      reasoning: 'Setup rejected by hard filters',
    },
    context: {
      marketRegime: 'DEFENSIVE',
      riskStance: 'RISK-OFF',
      sectorTake: 'N/A',
      flowRead: 'N/A',
      keyRisks: [],
      strategyBias: 'Avoid',
      reasoning: 'Setup rejected',
    },
    debate: {
      bullishArguments: [],
      bearishArguments: [reason],
      consensus: 'BEARISH',
      confidence: 0,
      keyFactors: [],
      reasoning: 'Setup rejected',
    },
    decision: {
      finalDecision: 'REJECT',
      confidenceScore: 0,
      successProbability: 0,
      keyEdge: 'N/A',
      keyRisk: reason,
      bullishScenario: 'N/A',
      bearishScenario: reason,
      executionNotes: 'Skip this setup',
      reasoning: `Rejected: ${reason}`,
    },
    finalScore: 0,
    confidence: 'LOW',
    status: 'REJECT',
  }
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}