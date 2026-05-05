/**
 * Macro Context Analysis — deterministic assessment of market conditions
 * Menilai volatility state, sector momentum, liquidity, dan global cue
 */
import type { MacroContext, IndicatorSet, MarketData, NewsIntelligence, SocialSentiment } from '@/pipeline/types'

export interface MacroInput {
  marketData: MarketData
  indicators: IndicatorSet
  news?: NewsIntelligence | null
  sentiment?: SocialSentiment | null
  ihsgChange5d?: number
  ihsgChange1d?: number
}

/**
 * Hitung macro context dari data yang tersedia
 */
export function computeMacroContext(input: MacroInput): MacroContext {
  const { marketData, indicators, ihsgChange5d, ihsgChange1d } = input

  // Volatility state berdasarkan ATR % dan daily range
  const atrPct = marketData.atr > 0 && marketData.currentPrice > 0
    ? (marketData.atr / marketData.currentPrice) * 100
    : 0

  const dailyRangePct = marketData.currentPrice > 0
    ? ((marketData.high - marketData.low) / marketData.currentPrice) * 100
    : 0

  const volatilityState = classifyVolatility(atrPct, dailyRangePct)

  // Sector momentum dari trend dan volume
  const sectorMomentum = classifySectorMomentum(indicators)

  // Liquidity condition dari volume ratio
  const liquidityCondition = classifyLiquidity(indicators.volumeRatio, marketData.avgVolume20d)

  // Global cue dari IHSG change
  const globalCue = classifyGlobalCue(ihsgChange5d, ihsgChange1d)

  // Market breadth proxy dari RSI dan trend
  const marketBreadth = classifyMarketBreadth(indicators)

  return {
    volatilityState,
    sectorMomentum,
    liquidityCondition,
    globalCue,
    marketBreadth,
  }
}

function classifyVolatility(atrPct: number, dailyRangePct: number): MacroContext['volatilityState'] {
  const avgVol = (atrPct + dailyRangePct) / 2
  if (avgVol > 4) return 'extreme'
  if (avgVol > 2.5) return 'high'
  if (avgVol > 1) return 'normal'
  return 'low'
}

function classifySectorMomentum(indicators: IndicatorSet): string {
  let score = 0
  if (indicators.trend === 'bullish') score += 3
  if (indicators.trend === 'bearish') score -= 3
  if (indicators.rsi > 60) score += 1
  if (indicators.rsi < 40) score -= 1
  if (indicators.volumeRatio > 1.5) score += 1
  if (indicators.volumeRatio < 0.8) score -= 1

  if (score >= 4) return 'Strong bullish momentum'
  if (score >= 2) return 'Moderate bullish momentum'
  if (score <= -4) return 'Strong bearish momentum'
  if (score <= -2) return 'Moderate bearish momentum'
  return 'Sideways / no clear momentum'
}

function classifyLiquidity(volumeRatio: number, avgVolume: number): MacroContext['liquidityCondition'] {
  if (volumeRatio >= 2 && avgVolume >= 5_000_000) return 'liquid'
  if (volumeRatio < 0.5 || avgVolume < 1_000_000) return 'tight'
  return 'normal'
}

function classifyGlobalCue(change5d?: number, change1d?: number): MacroContext['globalCue'] {
  if (change5d == null) return 'neutral'
  if (change5d > 2) return 'risk-on'
  if (change5d < -2) return 'risk-off'
  if (change1d != null && change1d > 1) return 'risk-on'
  if (change1d != null && change1d < -1) return 'risk-off'
  return 'neutral'
}

function classifyMarketBreadth(indicators: IndicatorSet): string {
  const parts: string[] = []

  // Price position relative to EMAs
  if (indicators.ema20 > indicators.ema50 && indicators.ema50 > indicators.ema200) {
    parts.push('EMA aligned bullish')
  } else if (indicators.ema20 < indicators.ema50 && indicators.ema50 < indicators.ema200) {
    parts.push('EMA aligned bearish')
  } else {
    parts.push('EMA mixed')
  }

  // RSI zone
  if (indicators.rsi > 70) parts.push('RSI overbought zone')
  else if (indicators.rsi < 30) parts.push('RSI oversold zone')
  else parts.push(`RSI neutral (${indicators.rsi.toFixed(1)})`)

  return parts.join(', ')
}
