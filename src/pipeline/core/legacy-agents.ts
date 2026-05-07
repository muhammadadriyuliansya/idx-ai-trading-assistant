import { calculateSetupScore, calculateRiskReward, computeRisk } from '@/lib/calc'
import { formatCurrency } from '@/lib/utils'
import type {
  ContextResult,
  DebateResult,
  DecisionResult,
  IndicatorSet,
  MarketData,
  RiskResult,
  ScannerResult,
} from '@/pipeline/types'

export function runScannerAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  ihsgTrend: 'bullish' | 'sideways' | 'bearish' | 'unknown',
): ScannerResult {
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
      ihsgTrend,
      sectorStrength: '',
      support: marketData.support.toString(),
      resistance: marketData.resistance.toString(),
    },
    calculateRiskReward(marketData.currentPrice, marketData.support, marketData.resistance),
  )

  let confidence: ScannerResult['confidence'] = 'LOW'
  if (setupScore.total >= 75) confidence = 'HIGH'
  else if (setupScore.total >= 55) confidence = 'MEDIUM'

  let setupType: ScannerResult['setupType'] = 'no_setup'
  if (indicators.trend === 'bullish' && indicators.volumeRatio > 1.5) {
    setupType = 'breakout'
  } else if (indicators.trend === 'bullish' && indicators.rsi >= 40 && indicators.rsi <= 60) {
    setupType = 'pullback'
  } else if (indicators.trend === 'bearish' && indicators.rsi < 30) {
    setupType = 'reversal'
  }

  const warnings: string[] = []
  if (indicators.rsi > 80) warnings.push('RSI overbought (>80)')
  if (indicators.rsi < 20) warnings.push('RSI oversold (<20)')
  if (indicators.volumeRatio < 1) warnings.push('Volume below average')
  if (indicators.macd.label.includes('bearish')) warnings.push('MACD bearish')

  const keyReads: string[] = [
    `Trend: ${indicators.trend}`,
    `Volume: ${indicators.volumeRatio.toFixed(2)}x average`,
    `RSI: ${indicators.rsi.toFixed(1)}`,
    `Price vs EMA20: ${marketData.currentPrice > indicators.ema20 ? 'Above' : 'Below'}`,
    `MACD: ${indicators.macd.label}`,
  ]

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

export function runRiskAgent(
  marketData: MarketData,
  capital: number,
  riskPerTrade: number,
): RiskResult {
  const riskCalc = computeRisk({
    ticker: marketData.ticker,
    currentPrice: marketData.currentPrice.toString(),
    support: marketData.support.toString(),
    resistance: marketData.resistance.toString(),
    atr: marketData.atr.toString(),
    capital: capital.toString(),
    riskPerTrade: riskPerTrade.toString(),
  })

  if (!riskCalc) {
    throw new Error('Failed to calculate risk parameters')
  }

  let verdict: RiskResult['verdict'] = 'REJECT'
  if (riskCalc.riskReward1 >= 2.0) {
    verdict = 'ACCEPT'
  } else if (riskCalc.riskReward1 >= 1.5) {
    verdict = 'ADJUST'
  }

  const riskBudget = (capital * riskPerTrade) / 100
  let reasoning = `RR ${riskCalc.riskReward1.toFixed(2)} meets minimum requirements. Position sized for ${riskPerTrade.toFixed(2)}% risk on ${marketData.ticker}.`
  if (verdict === 'REJECT') {
    reasoning = `RR ${riskCalc.riskReward1.toFixed(2)} below minimum 2.0. Consider adjusting entry or waiting for better setup.`
  } else if (verdict === 'ADJUST') {
    reasoning = `RR ${riskCalc.riskReward1.toFixed(2)} marginal. Consider reducing position size or waiting for better entry.`
  }

  return {
    ticker: marketData.ticker,
    currentPrice: marketData.currentPrice,
    support: marketData.support,
    resistance: marketData.resistance,
    capital,
    riskPerTrade,
    riskBudget,
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

export function runContextAgent(
  indicators: IndicatorSet,
  ihsgTrend: 'bullish' | 'sideways' | 'bearish' | 'unknown',
  ihsgChange5d?: number,
): ContextResult {
  let marketRegime: ContextResult['marketRegime'] = 'NORMAL'
  let riskStance: ContextResult['riskStance'] = 'NEUTRAL'

  if (ihsgTrend === 'bullish' && (ihsgChange5d ?? 0) > 0) {
    marketRegime = 'AGGRESSIVE'
    riskStance = 'RISK-ON'
  } else if (ihsgTrend === 'bearish' || (ihsgChange5d ?? 0) < -1) {
    marketRegime = 'DEFENSIVE'
    riskStance = 'RISK-OFF'
  }

  const keyRisks: string[] = [
    'Market volatility',
    'Sector rotation',
    'Foreign outflow risk',
  ]

  if (indicators.rsi > 70) keyRisks.push('Overbought conditions')
  if (indicators.rsi < 30) keyRisks.push('Oversold bounce risk')
  if (indicators.volumeRatio < 1) keyRisks.push('Low volume participation')

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
    reasoning: `Market regime ${marketRegime} based on IHSG trend ${ihsgTrend}, IHSG 5d ${ihsgChange5d != null ? `${ihsgChange5d.toFixed(2)}%` : 'N/A'}, stock trend ${indicators.trend}, and volume ${indicators.volumeRatio.toFixed(2)}x. Risk stance: ${riskStance}.`,
  }
}

export function runDebateAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
): DebateResult {
  const bullishArguments: string[] = []
  const bearishArguments: string[] = []

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

  let consensus: DebateResult['consensus'] = 'NEUTRAL'
  if (bullishArguments.length > bearishArguments.length) {
    consensus = 'BULLISH'
  } else if (bearishArguments.length > bullishArguments.length) {
    consensus = 'BEARISH'
  }

  const confidence = Math.min(100, Math.max(0, scanner.setupScore))

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

export function runDecisionAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult,
): DecisionResult {
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

  let riskLevel: DecisionResult['riskLevel'] = 'MEDIUM'
  if (risk.rr1 >= 3 && scanner.setupScore >= 75) {
    riskLevel = 'LOW'
  } else if (risk.rr1 < 1.5 || scanner.setupScore < 50) {
    riskLevel = 'HIGH'
  }

  let urgency: DecisionResult['urgency'] = 'monitor'
  if (finalDecision === 'BUY_NOW' && scanner.setupType === 'breakout') {
    urgency = 'immediate'
  } else if (finalDecision === 'BUY_NOW') {
    urgency = 'soon'
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
    reasoning: `Final decision ${finalDecision} based on scanner ${scanner.status} (${scanner.setupScore}/100), risk ${risk.verdict} (RR ${risk.rr1.toFixed(2)}), market regime ${context.marketRegime}, and debate consensus ${debate.consensus}.`,
    riskLevel,
    urgency,
  }
}
