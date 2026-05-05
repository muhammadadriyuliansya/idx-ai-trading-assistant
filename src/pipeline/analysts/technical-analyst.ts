/**
 * Technical Analyst — deterministic assessment of technical setup
 */
import type { AnalystReport, MarketData, IndicatorSet } from '@/pipeline/types'

export interface TechnicalInput {
  marketData: MarketData
  indicators: IndicatorSet
}

export function analyzeTechnical(input: TechnicalInput): AnalystReport {
  const { marketData, indicators } = input
  const signals: string[] = []
  const risks: string[] = []
  let score = 0
  let bullishCount = 0
  let bearishCount = 0

  // --- TREND ANALYSIS (max 30 pts) ---
  const price = marketData.currentPrice
  if (price > indicators.ema20) {
    score += 10
    bullishCount++
    signals.push(`Price above EMA20 (${indicators.ema20.toFixed(0)}) — short-term bullish`)
  } else {
    bearishCount++
    risks.push(`Price below EMA20 (${indicators.ema20.toFixed(0)}) — short-term bearish`)
  }

  if (indicators.ema20 > indicators.ema50) {
    score += 10
    bullishCount++
    signals.push('EMA20 > EMA50 — medium-term uptrend')
  } else {
    bearishCount++
    risks.push('EMA20 < EMA50 — medium-term downtrend')
  }

  if (indicators.ema50 > indicators.ema200) {
    score += 7
    bullishCount++
    signals.push('EMA50 > EMA200 — long-term uptrend intact')
  } else {
    bearishCount++
    risks.push('EMA50 < EMA200 — long-term downtrend')
  }

  if (price > indicators.vwap) {
    score += 3
    bullishCount++
    signals.push(`Price above VWAP (${indicators.vwap.toFixed(0)}) — bullish intraday bias`)
  } else {
    bearishCount++
    risks.push(`Price below VWAP (${indicators.vwap.toFixed(0)}) — bearish intraday bias`)
  }

  // --- MOMENTUM (max 25 pts) ---
  const rsi = indicators.rsi
  if (rsi >= 50 && rsi <= 70) {
    score += 12
    bullishCount++
    signals.push(`RSI ${rsi.toFixed(1)} — healthy bullish momentum`)
  } else if (rsi > 70 && rsi <= 80) {
    score += 6
    bullishCount++
    risks.push(`RSI ${rsi.toFixed(1)} — approaching overbought`)
  } else if (rsi < 30) {
    score += 4
    bullishCount++
    signals.push(`RSI ${rsi.toFixed(1)} — oversold, potential reversal`)
  } else {
    score += 6
    signals.push(`RSI ${rsi.toFixed(1)} — neutral zone`)
  }

  const macd = indicators.macd.label.toLowerCase()
  if (macd.includes('bull') || macd.includes('positif') || macd.includes('cross up')) {
    score += 8
    bullishCount++
    signals.push(`MACD ${indicators.macd.label} — bullish momentum`)
  } else if (macd.includes('bear') || macd.includes('negatif') || macd.includes('cross down')) {
    bearishCount++
    risks.push(`MACD ${indicators.macd.label} — bearish momentum`)
  } else {
    score += 3
    signals.push(`MACD ${indicators.macd.label} — neutral`)
  }

  // --- VOLUME (max 20 pts) ---
  const volRatio = indicators.volumeRatio
  if (volRatio >= 2) {
    score += 20
    bullishCount++
    signals.push(`Volume ${volRatio.toFixed(2)}x average — strong participation`)
  } else if (volRatio >= 1.5) {
    score += 15
    bullishCount++
    signals.push(`Volume ${volRatio.toFixed(2)}x average — above normal`)
  } else if (volRatio >= 1) {
    score += 8
    signals.push(`Volume ${volRatio.toFixed(2)}x average — normal`)
  } else {
    score += 2
    bearishCount++
    risks.push(`Volume ${volRatio.toFixed(2)}x average — low participation`)
  }

  // --- SUPPORT/RESISTANCE (max 15 pts) ---
  const supportDist = marketData.support > 0
    ? ((price - marketData.support) / price) * 100
    : 0
  const resistDist = marketData.resistance > 0
    ? ((marketData.resistance - price) / price) * 100
    : 0

  if (supportDist < 3 && supportDist > 0) {
    score += 10
    bullishCount++
    signals.push(`Near support (${marketData.support.toFixed(0)}) — potential bounce zone`)
  } else if (supportDist >= 3 && supportDist < 8) {
    score += 5
    signals.push(`Adequate distance from support (${supportDist.toFixed(1)}%)`)
  } else if (supportDist < 0) {
    bearishCount++
    risks.push('Price below support level — bearish breakdown')
  }

  if (resistDist > 5) {
    score += 5
    signals.push(`Room to resistance (${resistDist.toFixed(1)}%)`)
  }

  // Normalize score to 0-100
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)))

  // Determine bias
  let bias: AnalystReport['bias'] = 'neutral'
  if (bullishCount > bearishCount + 2) bias = 'bullish'
  else if (bearishCount > bullishCount + 2) bias = 'bearish'
  else if (bullishCount > bearishCount) bias = 'bullish'

  // Confidence
  const confidence = Math.min(95, Math.max(20, normalizedScore))

  // Summary
  const summary = `Technical setup score ${normalizedScore}/100. ${signals.length} bullish signals, ${risks.length} risks identified. Overall bias: ${bias}.`

  return {
    agent: 'Technical Analyst',
    bias,
    confidence,
    score: normalizedScore,
    summary,
    signals,
    risks,
  }
}
