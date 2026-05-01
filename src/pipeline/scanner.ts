/**
 * Automated market scanner for IDX stocks
 * Scans multiple tickers, calculates indicators, applies filters, and ranks opportunities
 */

import type { ScanCandidate, ScanOptions, MarketData, IndicatorSet } from './types'
import { applyHardFilters, DEFAULT_FILTERS } from './filters'
import { calculateSetupScore } from '@/lib/calc'
import { calculateRiskReward } from '@/lib/calc'
import { fetchMarketData } from './orchestrator'
import { calculateIndicators } from './orchestrator'

/**
 * Run automated market scan on multiple tickers
 */
export async function runMarketScan(
  options: ScanOptions
): Promise<ScanCandidate[]> {
  const {
    tickers,
    minVolumeRatio = DEFAULT_FILTERS.minVolumeRatio,
    minRR = DEFAULT_FILTERS.minRR,
    minSetupScore = 50,
    maxResults = 20,
  } = options

  const candidates: ScanCandidate[] = []
  const errors: Map<string, string> = new Map()

  // Process tickers in parallel batches
  const batchSize = 5
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)

    const batchResults = await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          return await scanTicker(ticker, minVolumeRatio, minRR)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          errors.set(ticker, message)
          return null
        }
      })
    )

    // Collect successful results
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        candidates.push(result.value)
      }
    }
  }

  // Log errors
  if (errors.size > 0) {
    console.warn(`Market scan completed with ${errors.size} errors:`)
    errors.forEach((error, ticker) => {
      console.warn(`  ${ticker}: ${error}`)
    })
  }

  // Filter by minimum setup score
  const filtered = candidates.filter((c) => c.setupScore >= minSetupScore)

  // Sort by setup score (descending)
  const sorted = filtered.sort((a, b) => b.setupScore - a.setupScore)

  // Return top results
  return sorted.slice(0, maxResults)
}

/**
 * Scan a single ticker
 */
async function scanTicker(
  ticker: string,
  minVolumeRatio: number,
  minRR: number
): Promise<ScanCandidate | null> {
  // Fetch market data
  const marketData = await fetchMarketData(ticker)

  // Calculate indicators
  const indicators = calculateIndicators(marketData)

  // Apply hard filters
  const filterResult = applyHardFilters(
    marketData,
    indicators,
    { minVolumeRatio, minRR }
  )

  if (!filterResult.passed) {
    return null
  }

  // Calculate setup score
  const setupScore = calculateSetupScoreFromData(marketData, indicators)

  // Calculate RR
  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance
  )

  // Determine status
  let status: ScanCandidate['status'] = 'REJECT'
  if (setupScore >= 70) {
    status = 'VALID'
  } else if (setupScore >= 50) {
    status = 'WATCHLIST'
  }

  return {
    ticker,
    setupScore,
    volumeRatio: indicators.volumeRatio,
    rr,
    trend: indicators.trend,
    status,
    marketData,
    indicators,
  }
}

/**
 * Calculate setup score from market data and indicators
 */
function calculateSetupScoreFromData(
  marketData: MarketData,
  indicators: IndicatorSet
): number {
  // This is a simplified version - in production, use the full calculateSetupScore
  let score = 0

  // Trend score (max 30)
  if (marketData.currentPrice > indicators.ema20) score += 10
  if (indicators.ema20 > indicators.ema50) score += 10
  if (indicators.ema50 > indicators.ema200) score += 7
  if (marketData.currentPrice > indicators.vwap) score += 3

  // Momentum score (max 20)
  if (indicators.rsi >= 50 && indicators.rsi <= 70) score += 12
  else if (indicators.rsi > 70 && indicators.rsi <= 80) score += 6
  else if (indicators.rsi >= 40 && indicators.rsi < 50) score += 6

  if (indicators.macd.label.includes('bull')) score += 8
  else if (indicators.macd.label.includes('netral')) score += 3

  // Volume score (max 20)
  if (indicators.volumeRatio >= 2) score += 20
  else if (indicators.volumeRatio >= 1.5) score += 15
  else if (indicators.volumeRatio >= 1) score += 8
  else score += 2

  // Context score (max 20) - simplified
  if (indicators.trend === 'bullish') score += 7
  else if (indicators.trend === 'sideways') score += 3

  // RR quality (max 10)
  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance
  )
  if (rr >= 3) score += 10
  else if (rr >= 2) score += 8
  else if (rr >= 1.5) score += 5
  else score += 2

  return Math.min(100, Math.max(0, score))
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