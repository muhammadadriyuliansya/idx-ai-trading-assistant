/**
 * Automated market scanner for IDX stocks
 * Scans multiple tickers, calculates indicators, applies filters, and ranks opportunities
 */

import type { ScanCandidate, ScanOptions, MarketData, IndicatorSet } from './types'
import { applyHardFilters, DEFAULT_FILTERS } from './filters'
import { calculateRiskReward } from '@/lib/calc'
import { fetchMarketDataWithIndicators } from './orchestrator'
import { mapWithConcurrency } from '@/lib/concurrency'

/**
 * Run automated market scan on multiple tickers.
 *
 * The scanner only needs bars + derived indicators, so it hits the quote
 * endpoint in "bars" mode — that skips IHSG + fundamentals per ticker and
 * lets the server cache dedup parallel callers. Concurrency 8 is a
 * balance between throughput and Yahoo rate limits.
 */
export async function runMarketScan(
  options: ScanOptions
): Promise<ScanCandidate[]> {
  const {
    tickers,
    mode = 'swing',
    minVolumeRatio = DEFAULT_FILTERS.minVolumeRatio,
    minRR = DEFAULT_FILTERS.minRR,
    minSetupScore = 50,
    maxResults = 20,
  } = options

  const candidates: ScanCandidate[] = []
  const errors: Map<string, string> = new Map()

  const settled = await mapWithConcurrency(tickers, 8, async (ticker) => {
    try {
      return await scanTicker(
        ticker,
        mode,
        minVolumeRatio ?? getModeDefaults(mode).minVolumeRatio,
        minRR ?? getModeDefaults(mode).minRR,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.set(ticker, message)
      return null
    }
  })

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) {
      candidates.push(result.value)
    }
  }

  // Log errors
  if (errors.size > 0) {
    console.warn(`Market scan completed with ${errors.size} errors:`)
    errors.forEach((error, ticker) => {
      console.warn(`  ${ticker}: ${error}`)
    })
  }

  // Prefer candidates above the configured score, but never return an empty
  // market screen when quote data exists.
  const filtered = candidates.filter((c) => c.setupScore >= minSetupScore)
  const resultPool = filtered.length > 0 ? filtered : candidates

  // Sort: bullish → sideways → bearish, then by setup quality.
  const trendRank: Record<string, number> = { bullish: 0, sideways: 1, bearish: 2 }
  const sorted = resultPool.sort((a, b) => {
    const trendDiff = (trendRank[a.trend] ?? 1) - (trendRank[b.trend] ?? 1)
    if (trendDiff !== 0) return trendDiff

    const scoreDiff = b.setupScore - a.setupScore
    if (scoreDiff !== 0) return scoreDiff

    const rrDiff = b.rr - a.rr
    if (rrDiff !== 0) return rrDiff

    return b.volumeRatio - a.volumeRatio
  })

  // Return top results
  return sorted.slice(0, maxResults)
}

/**
 * Scan a single ticker
 */
async function scanTicker(
  ticker: string,
  mode: ScanCandidate['mode'],
  minVolumeRatio: number,
  minRR: number
): Promise<ScanCandidate | null> {
  // Fetch market data + indicators in "bars" mode — IHSG and fundamental
  // are not needed for scanning and would multiply Yahoo Finance calls.
  const { marketData, indicators, dataHealth } = await fetchMarketDataWithIndicators(
    ticker,
    { fields: 'bars' },
  )

  // Apply hard filters as classification, not as a data gate. The scanner
  // should still show the best available market candidates even on weak days.
  const modeDefaults = getModeDefaults(mode)
  const filterResult = applyHardFilters(
    marketData,
    indicators,
    {
      minVolumeRatio,
      minRR,
      minAvgVolume: modeDefaults.minAvgVolume,
      minPriceRange: modeDefaults.minPriceRange,
      requireBullishTrend: modeDefaults.requireBullishTrend,
    }
  )

  // Calculate setup score
  const scoreBreakdown = calculateSetupScoreFromData(marketData, indicators, mode)
  const setupScore = scoreBreakdown.trend + scoreBreakdown.momentum + scoreBreakdown.volume + scoreBreakdown.context + scoreBreakdown.rrQuality

  // Calculate RR
  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance
  )

  // Determine status
  let status: ScanCandidate['status'] = 'REJECT'
  if (!filterResult.passed) {
    status = 'REJECT'
  } else if (setupScore >= 70) {
    status = 'VALID'
  } else if (setupScore >= 50) {
    status = 'WATCHLIST'
  }

  return {
    ticker,
    mode,
    setupScore,
    scoreBreakdown,
    volumeRatio: indicators.volumeRatio,
    rr,
    trend: indicators.trend,
    status,
    reason: buildCandidateReason(status, filterResult.reason, setupScore, indicators, rr, mode),
    nextTrigger: buildNextTrigger(marketData, indicators, rr, mode),
    invalidation: `Break below ${marketData.support.toFixed(0)} or RR stays under 1.5`,
    miniBacktest: estimateMiniBacktest(marketData, indicators, rr),
    dataHealth,
    marketData,
    indicators,
  }
}

/**
 * Calculate setup score from market data and indicators.
 * Enhanced with scalping patterns: anti-gravity, VWAP authority,
 * gap continuation, and volume+price quality.
 */
function calculateSetupScoreFromData(
  marketData: MarketData,
  indicators: IndicatorSet,
  mode: ScanCandidate['mode'],
): ScanCandidate['scoreBreakdown'] {
  const breakdown: ScanCandidate['scoreBreakdown'] = {
    trend: 0,
    momentum: 0,
    volume: 0,
    context: 0,
    rrQuality: 0,
  }

  // ==========================================================================
  // Trend score (max 30) — includes anti-gravity detection
  // ==========================================================================
  const isGreenCandle = marketData.currentPrice > marketData.open
  const isNearHigh = marketData.currentPrice >= marketData.high * 0.92
  const isGapUp = marketData.open > marketData.previousClose
  const isGapHold = isGapUp && isGreenCandle

  // Core EMA alignment
  if (marketData.currentPrice > indicators.ema20) breakdown.trend += 8
  if (indicators.ema20 > indicators.ema50) breakdown.trend += 8
  if (indicators.ema50 > indicators.ema200) breakdown.trend += 5
  if (marketData.currentPrice > indicators.vwap) breakdown.trend += 3

  // Anti-gravity: green candle + near high + gap hold
  if (isGreenCandle) breakdown.trend += 3
  if (isNearHigh && isGreenCandle) breakdown.trend += 3
  if (isGapHold) breakdown.trend += 3
  if (mode === 'day' && marketData.currentPrice > indicators.vwap) breakdown.trend += 3
  if (mode === 'premarket') breakdown.trend += isGapHold ? 5 : 3
  if (mode === 'swing' && indicators.trend !== 'bearish') breakdown.trend += 5

  // ==========================================================================
  // Momentum score (max 20) — refined RSI zones + VWAP proximity
  // ==========================================================================
  const dayRange = marketData.high - marketData.low
  const priceFromLow = marketData.currentPrice - marketData.low
  const rangePosition = dayRange > 0 ? priceFromLow / dayRange : 0.5

  // RSI sweet spots for continuation
  if (indicators.rsi >= 55 && indicators.rsi <= 70) breakdown.momentum += 10
  else if (indicators.rsi >= 50 && indicators.rsi < 55) breakdown.momentum += 7
  else if (indicators.rsi > 70 && indicators.rsi <= 80) breakdown.momentum += 5
  else if (indicators.rsi >= 45 && indicators.rsi < 50) breakdown.momentum += 4

  // Price in upper 40% of day range = strength
  if (rangePosition >= 0.6) breakdown.momentum += 3

  // VWAP proximity bonus for day mode (pullback to VWAP while above = scalp entry)
  if (mode === 'day' && marketData.currentPrice > indicators.vwap) {
    const vwapDistance = (marketData.currentPrice - indicators.vwap) / marketData.currentPrice
    if (vwapDistance < 0.005) breakdown.momentum += 5  // within 0.5% of VWAP = bounce entry
    else if (vwapDistance < 0.015) breakdown.momentum += 3  // riding above VWAP
  }

  if (indicators.macd.label.includes('bull')) breakdown.momentum += 5
  else if (indicators.macd.label.includes('netral')) breakdown.momentum += 2

  // ==========================================================================
  // Volume score (max 20) — volume + price correlation
  // ==========================================================================
  const idealVolume = mode === 'day' ? 1.2 : mode === 'swing' ? 1 : 1.5
  if (indicators.volumeRatio >= 2.5 && isGreenCandle) breakdown.volume += 20  // massive accumulation
  else if (indicators.volumeRatio >= 2) breakdown.volume += 16
  else if (indicators.volumeRatio >= idealVolume && isGreenCandle) breakdown.volume += 14  // healthy volume + green
  else if (indicators.volumeRatio >= idealVolume) breakdown.volume += 11
  else if (indicators.volumeRatio >= 0.5) breakdown.volume += mode === 'conservative' ? 4 : 8
  else breakdown.volume += 2

  // ==========================================================================
  // Context score (max 20) — gap analysis + trend quality
  // ==========================================================================
  if (indicators.trend === 'bullish') breakdown.context += 6
  else if (indicators.trend === 'sideways') breakdown.context += 3

  // Gap continuation: green candle after gap up = strong momentum
  if (isGapHold) breakdown.context += 5
  else if (isGapUp && !isGreenCandle) breakdown.context += 2  // gap up but faded = neutral

  // Reversal: gap down but turned green
  if (marketData.open < marketData.previousClose && isGreenCandle) breakdown.context += 4

  // Price firmly in upper half of range
  if (rangePosition >= 0.5) breakdown.context += 3

  // ==========================================================================
  // RR quality (max 10)
  // ==========================================================================
  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance
  )
  const minGoodRr = mode === 'day' ? 1.2 : mode === 'swing' ? 1.5 : 2
  if (rr >= 3) breakdown.rrQuality += 10
  else if (rr >= 2) breakdown.rrQuality += 8
  else if (rr >= minGoodRr) breakdown.rrQuality += 6
  else if (rr >= 1.2) breakdown.rrQuality += 4
  else breakdown.rrQuality += 2

  return breakdown
}

function getModeDefaults(mode: ScanCandidate['mode']) {
  if (mode === 'day') {
    return {
      minVolumeRatio: 1.5,
      minRR: 2.0,
      minAvgVolume: 1000000,
      minPriceRange: 0.02,
      requireBullishTrend: false,
    }
  }

  if (mode === 'swing') {
    return {
      minVolumeRatio: 0.5,
      minRR: 1.5,
      minAvgVolume: 750000,
      minPriceRange: 0.015,
      requireBullishTrend: false,
    }
  }

  if (mode === 'premarket') {
    return {
      minVolumeRatio: 0.3,
      minRR: 1.2,
      minAvgVolume: 500000,
      minPriceRange: 0.01,
      requireBullishTrend: false,
    }
  }

  return {
    minVolumeRatio: DEFAULT_FILTERS.minVolumeRatio!,
    minRR: DEFAULT_FILTERS.minRR!,
    minAvgVolume: DEFAULT_FILTERS.minAvgVolume,
    minPriceRange: DEFAULT_FILTERS.minPriceRange,
    requireBullishTrend: DEFAULT_FILTERS.requireBullishTrend,
  }
}

function buildCandidateReason(
  status: ScanCandidate['status'],
  filterReason: string | undefined,
  setupScore: number,
  indicators: IndicatorSet,
  rr: number,
  mode: ScanCandidate['mode'],
): string {
  if (filterReason) return filterReason
  const modeLabel = mode === 'premarket' ? 'PREMARKET' : mode.toUpperCase()
  if (status === 'VALID') return `${modeLabel} setup valid: score ${setupScore}/100, RR ${rr.toFixed(2)}, volume ${indicators.volumeRatio.toFixed(2)}x.`
  if (status === 'WATCHLIST') return `${modeLabel} watchlist: score ${setupScore}/100, trend ${indicators.trend}, RR ${rr.toFixed(2)}.`
  return `Weak ${modeLabel} setup: score ${setupScore}/100, trend ${indicators.trend}, RR ${rr.toFixed(2)}.`
}

function buildNextTrigger(
  marketData: MarketData,
  indicators: IndicatorSet,
  rr: number,
  mode: ScanCandidate['mode'],
): string {
  const minRr = mode === 'day' ? 2 : mode === 'swing' ? 1.5 : mode === 'premarket' ? 1.2 : 2
  const minVolume = mode === 'day' ? 1.5 : mode === 'swing' ? 1 : mode === 'premarket' ? 0.5 : 1.5
  if (rr < minRr) return `Wait for price closer to support ${marketData.support.toFixed(0)} or resistance expansion.`
  if (indicators.volumeRatio < minVolume) return `Wait for volume ratio above ${minVolume.toFixed(1)}x.`
  if (mode === 'premarket') return `Pantau saat pre-market. Fokus gap ${marketData.open > marketData.previousClose ? 'up' : 'down'} dan level support/resistance.`
  if (mode === 'day') return `Review only until intraday feed, spread, and VWAP confirmation are available.`
  if (indicators.trend !== 'bullish') return `Wait for close above EMA20 ${indicators.ema20.toFixed(0)}.`
  return `Break or hold above resistance ${marketData.resistance.toFixed(0)} with volume.`
}

function estimateMiniBacktest(
  marketData: MarketData,
  indicators: IndicatorSet,
  rr: number,
): ScanCandidate['miniBacktest'] {
  const trendBonus = indicators.trend === 'bullish' ? 1 : indicators.trend === 'sideways' ? 0 : -1
  const volumeBonus = indicators.volumeRatio >= 1.5 ? 1 : indicators.volumeRatio < 0.8 ? -1 : 0
  const score = trendBonus + volumeBonus + (rr >= 2 ? 1 : rr < 1.5 ? -1 : 0)
  const riskPct = ((marketData.currentPrice - marketData.support) / marketData.currentPrice) * 100
  const rewardPct = ((marketData.resistance - marketData.currentPrice) / marketData.currentPrice) * 100

  return {
    outcome: score >= 2 ? 'TP' : score <= -1 ? 'SL' : 'OPEN',
    horizonDays: 10,
    estimatedReturnPct: Number((score >= 2 ? rewardPct : score <= -1 ? -riskPct : rewardPct * 0.35).toFixed(2)),
    maxDrawdownPct: Number(Math.max(0, riskPct).toFixed(2)),
  }
}

/**
 * Get default IDX tickers for scanning
 */
export function getDefaultIDXTickers(): string[] {
  return [
    // Banking
    'BBRI', 'BBCA', 'BMRI', 'BBNI', 'BTPS',
    // Consumer
    'INDF', 'ICBP', 'UNVR', 'GGRM', 'HMSP',
    // Tech
    'TLKM', 'EXCL', 'ISAT', 'FREN', 'BRIS',
    // Energy
    'ADRO', 'PGAS', 'PGEO', 'MEDC', 'TPIA',
    // Infrastructure
    'JSMR', 'WIKA', 'WSKT', 'ADHI', 'PTPP',
    // Mining
    'ANTM', 'ITMG', 'PTBA', 'TINS', 'MDKA',
    // Property
    'BSDE', 'LPKR', 'ASRI', 'PWON', 'CTRA',
    // Industrial
    'UNTR', 'INTP', 'AUTO', 'GJTL', 'SMMT',
  ]
}
