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
import { calculateSetupScore, computeRisk, calculateRiskReward } from '@/lib/calc'

/**
 * Run full analysis pipeline for a ticker (AI optional)
 */
export async function runFullAnalysis(
  ticker: string,
  settings?: AISettings
): Promise<AnalysisPipeline> {
  try {
    // 1. Fetch market data and indicators from API
    const { marketData, indicators } = await fetchMarketDataWithIndicators(ticker)

    // 2. Apply hard filters
    const filterResult = applyHardFilters(marketData, indicators)
    if (!filterResult.passed) {
      return createRejectedPipeline(ticker, marketData, indicators, filterResult.reason || 'Failed hard filters')
    }

    // 3. Run scanner agent (deterministic, no AI required)
    const scanner = runScannerAgent(marketData, indicators)

    // 4. Run risk agent (deterministic, no AI required)
    const risk = runRiskAgent(marketData, indicators, scanner)

    // 5. Run context agent (deterministic, no AI required)
    const context = runContextAgent(marketData, indicators)

    // 6. Run debate agent (deterministic, no AI required)
    const debate = runDebateAgent(scanner, risk, context)

    // 7. Run decision agent (deterministic, no AI required)
    const decision = runDecisionAgent(scanner, risk, context, debate)

    // 8. Calculate final score
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
 * Fetch market data for a ticker from Yahoo Finance API
 */
export async function fetchMarketData(ticker: string): Promise<MarketData> {
  const normalisedTicker = ticker.trim().toUpperCase()
  const symbol = normalisedTicker.includes('.') ? normalisedTicker : `${normalisedTicker}.JK`

  const response = await fetch(`/api/quote?ticker=${encodeURIComponent(symbol)}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.error || `Failed to fetch data for ${ticker}`)
  }

  const data = await response.json()

  return {
    ticker: data.ticker,
    currentPrice: parseFloat(data.scanner.currentPrice),
    open: parseFloat(data.scanner.open),
    high: parseFloat(data.scanner.high),
    low: parseFloat(data.scanner.low),
    previousClose: parseFloat(data.scanner.previousClose),
    todayVolume: parseFloat(data.scanner.todayVolume),
    avgVolume20d: parseFloat(data.scanner.avgVolume20d),
    support: parseFloat(data.scanner.support),
    resistance: parseFloat(data.scanner.resistance),
    atr: parseFloat(data.risk.atr),
    fetchedAt: Date.now(),
  }
}

/**
 * Fetch market data with indicators from Yahoo Finance API
 */
export async function fetchMarketDataWithIndicators(
  ticker: string
): Promise<{ marketData: MarketData; indicators: IndicatorSet }> {
  const normalisedTicker = ticker.trim().toUpperCase()
  const symbol = normalisedTicker.includes('.') ? normalisedTicker : `${normalisedTicker}.JK`

  const response = await fetch(`/api/quote?ticker=${encodeURIComponent(symbol)}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.error || `Failed to fetch data for ${ticker}`)
  }

  const data = await response.json()

  const marketData: MarketData = {
    ticker: data.ticker,
    currentPrice: parseFloat(data.scanner.currentPrice),
    open: parseFloat(data.scanner.open),
    high: parseFloat(data.scanner.high),
    low: parseFloat(data.scanner.low),
    previousClose: parseFloat(data.scanner.previousClose),
    todayVolume: parseFloat(data.scanner.todayVolume),
    avgVolume20d: parseFloat(data.scanner.avgVolume20d),
    support: parseFloat(data.scanner.support),
    resistance: parseFloat(data.scanner.resistance),
    atr: parseFloat(data.risk.atr),
    fetchedAt: Date.now(),
  }

  const indicators: IndicatorSet = {
    ema20: parseFloat(data.scanner.ema20),
    ema50: parseFloat(data.scanner.ema50),
    ema200: parseFloat(data.scanner.ema200),
    vwap: parseFloat(data.scanner.vwap),
    rsi: parseFloat(data.scanner.rsi),
    macd: {
      macd: 0, // Not provided by API, calculated from label
      signal: 0,
      histogram: 0,
      label: data.scanner.macd || 'netral',
    },
    stochastic: {
      k: 50, // Not provided by API, calculated from label
      d: 50,
      label: data.scanner.stochastic || 'neutral',
    },
    trend: data.meta.trend,
    volumeRatio: data.meta.volRatio,
  }

  return { marketData, indicators }
}

/**
 * Run scanner agent (deterministic, no AI required)
 */
function runScannerAgent(
  marketData: MarketData,
  indicators: IndicatorSet
): ScannerResult {
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

  // Generate warnings
  const warnings: string[] = []
  if (indicators.rsi > 80) warnings.push('RSI overbought (>80)')
  if (indicators.rsi < 20) warnings.push('RSI oversold (<20)')
  if (indicators.volumeRatio < 1) warnings.push('Volume below average')
  if (indicators.macd.label.includes('bearish')) warnings.push('MACD bearish')

  // Generate key reads
  const keyReads: string[] = [
    `Trend: ${indicators.trend}`,
    `Volume: ${indicators.volumeRatio.toFixed(2)}x average`,
    `RSI: ${indicators.rsi.toFixed(1)}`,
    `Price vs EMA20: ${marketData.currentPrice > indicators.ema20 ? 'Above' : 'Below'}`,
    `MACD: ${indicators.macd.label}`,
  ]

  // Generate action plan
  let actionPlan = 'Monitor for confirmation'
  if (setupType === 'breakout') {
    actionPlan = 'Wait for pullback or volume confirmation'
  } else if (setupType === 'pullback') {
    actionPlan = 'Enter on pullback to support/EMA20'
  } else if (setupType === 'reversal') {
    actionPlan = 'Wait for trend reversal confirmation'
  }

  return {
    setupType,
    setupScore: setupScore.total,
    confidence,
    status: setupScore.status,
    keyReads,
    warnings,
    actionPlan,
    reasoning: `Setup score ${setupScore.total}/100 based on trend (${setupScore.trend}/30), momentum (${setupScore.momentum}/20), volume (${setupScore.volume}/20), context (${setupScore.context}/20), and RR quality (${setupScore.rrQuality}/10).`,
  }
}

/**
 * Run risk agent (deterministic, no AI required)
 */
function runRiskAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  scanner: ScannerResult
): RiskResult {
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

  // Generate reasoning
  let reasoning = `RR ${riskCalc.riskReward1.toFixed(2)} meets minimum requirements. Position sized for 1% risk.`
  if (verdict === 'REJECT') {
    reasoning = `RR ${riskCalc.riskReward1.toFixed(2)} below minimum 2.0. Consider adjusting entry or waiting for better setup.`
  } else if (verdict === 'ADJUST') {
    reasoning = `RR ${riskCalc.riskReward1.toFixed(2)} marginal. Consider reducing position size or waiting for better entry.`
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
    reasoning,
  }
}

/**
 * Run context agent (deterministic, no AI required)
 */
function runContextAgent(
  marketData: MarketData,
  indicators: IndicatorSet
): ContextResult {
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

  // Generate key risks
  const keyRisks: string[] = [
    'Market volatility',
    'Sector rotation',
    'Foreign outflow risk',
  ]

  if (indicators.rsi > 70) keyRisks.push('Overbought conditions')
  if (indicators.rsi < 30) keyRisks.push('Oversold bounce risk')
  if (indicators.volumeRatio < 1) keyRisks.push('Low volume participation')

  // Generate strategy bias
  let strategyBias = 'Stay defensive'
  if (marketRegime === 'AGGRESSIVE') {
    strategyBias = 'Can be selective aggressive'
  } else if (marketRegime === 'NORMAL') {
    strategyBias = 'Balanced approach with caution'
  }

  return {
    marketRegime,
    riskStance,
    sectorTake: 'Analyze sector rotation',
    flowRead: 'Monitor foreign flow',
    keyRisks,
    strategyBias,
    reasoning: `Market regime ${marketRegime} based on trend ${indicators.trend} and volume ${indicators.volumeRatio.toFixed(2)}x. Risk stance: ${riskStance}.`,
  }
}

/**
 * Run debate agent (deterministic, no AI required)
 */
function runDebateAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult
): DebateResult {
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
  if (scanner.setupType === 'breakout' || scanner.setupType === 'pullback') {
    bullishArguments.push(`Clear ${scanner.setupType} setup`)
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
  if (scanner.confidence === 'LOW') {
    bearishArguments.push('Low confidence in setup')
  }

  // Determine consensus
  let consensus: DebateResult['consensus'] = 'NEUTRAL'
  if (bullishArguments.length > bearishArguments.length) {
    consensus = 'BULLISH'
  } else if (bearishArguments.length > bullishArguments.length) {
    consensus = 'BEARISH'
  }

  const confidence = Math.min(100, Math.max(0, scanner.setupScore))

  // Generate key factors
  const keyFactors: string[] = [
    `Setup quality: ${scanner.setupScore}/100`,
    `Risk/reward: ${risk.rr1.toFixed(2)}`,
    `Market regime: ${context.marketRegime}`,
    `Setup type: ${scanner.setupType}`,
  ]

  return {
    bullishArguments,
    bearishArguments,
    consensus,
    confidence,
    keyFactors,
    reasoning: `${bullishArguments.length} bullish vs ${bearishArguments.length} bearish arguments. Consensus: ${consensus}.`,
  }
}

/**
 * Run decision agent (deterministic, no AI required)
 */
function runDecisionAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult
): DecisionResult {
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

  // Determine risk level
  let riskLevel: DecisionResult['riskLevel'] = 'MEDIUM'
  if (risk.rr1 >= 3 && scanner.setupScore >= 75) {
    riskLevel = 'LOW'
  } else if (risk.rr1 < 1.5 || scanner.setupScore < 50) {
    riskLevel = 'HIGH'
  }

  // Determine urgency
  let urgency: DecisionResult['urgency'] = 'monitor'
  if (finalDecision === 'BUY_NOW' && scanner.setupType === 'breakout') {
    urgency = 'immediate'
  } else if (finalDecision === 'BUY_NOW') {
    urgency = 'soon'
  }

  // Generate reasoning
  const reasoning = `Final decision ${finalDecision} based on scanner ${scanner.status} (${scanner.setupScore}/100), risk ${risk.verdict} (RR ${risk.rr1.toFixed(2)}), market regime ${context.marketRegime}, and debate consensus ${debate.consensus}.`

  // Generate action items
  const actionItems: string[] = []
  if (finalDecision === 'BUY_NOW') {
    actionItems.push(`Enter near ${risk.entryZone}`)
    actionItems.push(`Set stop loss at ${risk.stopLoss}`)
    actionItems.push(`Target TP1 at ${risk.tp1} and TP2 at ${risk.tp2}`)
    actionItems.push(`Position size: ${risk.positionSize.lots} lots`)
  } else if (finalDecision === 'WATCHLIST') {
    actionItems.push('Add to watchlist')
    actionItems.push('Monitor for better entry')
    actionItems.push('Wait for volume confirmation')
  } else if (finalDecision === 'WAIT') {
    actionItems.push('Wait for clearer signals')
    actionItems.push('Monitor market conditions')
    actionItems.push('Re-evaluate after market close')
  } else {
    actionItems.push('Skip this setup')
    actionItems.push('Look for better opportunities')
  }

  return {
    finalDecision,
    confidenceScore,
    successProbability,
    keyEdge: debate.bullishArguments[0] || 'Strong technical setup',
    keyRisk: debate.bearishArguments[0] || 'Market volatility',
    bullishScenario: `Price targets ${risk.tp1} (TP1) and ${risk.tp2} (TP2) with RR ${risk.rr1.toFixed(2)}`,
    bearishScenario: `Stop loss at ${risk.stopLoss} with max loss ${formatCurrency(risk.positionSize.maxLoss)}`,
    executionNotes: context.marketRegime === 'AGGRESSIVE' ? 'Can enter on pullback' : 'Wait for confirmation',
    reasoning,
    riskLevel,
    urgency,
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
      riskLevel: 'HIGH',
      urgency: 'monitor',
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