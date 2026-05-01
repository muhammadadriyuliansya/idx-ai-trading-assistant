/**
 * Hard filters applied before AI analysis
 * These are deterministic calculations to filter out weak setups
 */

import type { FilterConfig, FilterResult, IndicatorSet, MarketData } from './types'
import { calculateRiskReward } from '@/lib/calc'

/**
 * Default filter configuration
 */
export const DEFAULT_FILTERS: FilterConfig = {
  minVolumeRatio: 1.5,
  minRR: 2.0,
  minAvgVolume: 1000000, // 1M shares
  minPriceRange: 0.02, // 2%
  requireBullishTrend: false,
}

/**
 * Apply hard filters to market data and indicators
 */
export function applyHardFilters(
  marketData: MarketData,
  indicators: IndicatorSet,
  config: FilterConfig = DEFAULT_FILTERS
): FilterResult {
  const filters = [
    checkVolumeRatio(indicators.volumeRatio, config.minVolumeRatio),
    checkTrend(indicators.trend, marketData.currentPrice, indicators.ema20, config.requireBullishTrend),
    checkRR(marketData, config.minRR),
    checkAvgVolume(marketData.avgVolume20d, config.minAvgVolume),
    checkPriceRange(marketData, config.minPriceRange),
  ]

  for (const filter of filters) {
    if (!filter.passed) {
      return filter
    }
  }

  return { passed: true }
}

/**
 * Check if volume ratio meets minimum threshold
 */
function checkVolumeRatio(
  volumeRatio: number,
  minVolumeRatio?: number
): FilterResult {
  const threshold = minVolumeRatio ?? DEFAULT_FILTERS.minVolumeRatio!

  if (volumeRatio < threshold) {
    return {
      passed: false,
      reason: `Volume ratio ${volumeRatio.toFixed(2)}x below minimum ${threshold}x`,
    }
  }

  return { passed: true }
}

/**
 * Check if trend is acceptable
 */
function checkTrend(
  trend: IndicatorSet['trend'],
  currentPrice: number,
  ema20: number,
  requireBullish?: boolean
): FilterResult {
  if (requireBullish && trend === 'bearish') {
    return {
      passed: false,
      reason: 'Bearish trend not allowed',
    }
  }

  if (trend === 'bearish' && currentPrice < ema20) {
    return {
      passed: false,
      reason: 'Price below EMA20 in bearish trend',
    }
  }

  return { passed: true }
}

/**
 * Check if risk/reward ratio meets minimum threshold
 */
function checkRR(
  marketData: MarketData,
  minRR?: number
): FilterResult {
  const threshold = minRR ?? DEFAULT_FILTERS.minRR!

  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance
  )

  if (rr < threshold) {
    return {
      passed: false,
      reason: `Risk/Reward ${rr.toFixed(2)} below minimum ${threshold}`,
    }
  }

  return { passed: true }
}

/**
 * Check if average volume meets minimum threshold
 */
function checkAvgVolume(
  avgVolume: number,
  minAvgVolume?: number
): FilterResult {
  const threshold = minAvgVolume ?? DEFAULT_FILTERS.minAvgVolume!

  if (avgVolume < threshold) {
    return {
      passed: false,
      reason: `Average volume ${formatNumber(avgVolume)} below minimum ${formatNumber(threshold)}`,
    }
  }

  return { passed: true }
}

/**
 * Check if price range is sufficient for trading
 */
function checkPriceRange(
  marketData: MarketData,
  minPriceRange?: number
): FilterResult {
  const threshold = minPriceRange ?? DEFAULT_FILTERS.minPriceRange!

  const priceRange = (marketData.high - marketData.low) / marketData.currentPrice

  if (priceRange < threshold) {
    return {
      passed: false,
      reason: `Price range ${(priceRange * 100).toFixed(2)}% below minimum ${(threshold * 100).toFixed(2)}%`,
    }
  }

  return { passed: true }
}

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}