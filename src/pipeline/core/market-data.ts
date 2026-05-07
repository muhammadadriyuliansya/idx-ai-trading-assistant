import { resilientFetch } from '@/lib/resilient-fetch'
import { createLogger } from '@/lib/logger'
import type { AnalysisPipeline, DataHealth, IndicatorSet, MarketData } from '@/pipeline/types'
import { deriveIhsgTrend } from './fallbacks'

const logger = createLogger('pipeline:market-data')

type QuotePayload = {
  scanner?: Record<string, unknown>
  meta?: Record<string, unknown>
  fundamental?: unknown
}

export interface MarketDataWithIndicators {
  marketData: MarketData
  indicators: IndicatorSet
  fundamental: AnalysisPipeline['fundamental']
  dataHealth: DataHealth
  ihsgTrend: 'bullish' | 'sideways' | 'bearish' | 'unknown'
  ihsgChange5d?: number
  ihsgChange1d?: number
}

export async function fetchMarketData(ticker: string): Promise<MarketData> {
  const normalisedTicker = ticker.trim().toUpperCase()
  const symbol = normalisedTicker.includes('.') ? normalisedTicker : `${normalisedTicker}.JK`

  const data = await resilientFetch<{
    ticker: string
    scanner: Record<string, string>
    risk: Record<string, string>
    error?: string
  }>(
    `/api/quote?ticker=${encodeURIComponent(symbol)}`,
    { cache: 'no-store' },
    { cacheKey: `quote:${symbol}`, useCircuitBreaker: true, useCache: true },
  )

  if (data.error) {
    throw new Error(data.error)
  }

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

export async function fetchMarketDataWithIndicators(ticker: string): Promise<MarketDataWithIndicators> {
  const normalisedTicker = ticker.trim().toUpperCase()
  const symbol = normalisedTicker.includes('.') ? normalisedTicker : `${normalisedTicker}.JK`

  const data = await resilientFetch<Record<string, unknown>>(
    `/api/quote?ticker=${encodeURIComponent(symbol)}`,
    { cache: 'no-store' },
    { cacheKey: `quote:${symbol}`, useCircuitBreaker: true, useCache: true },
  )

  if (data.error) {
    throw new Error(String(data.error))
  }

  const scanner = data.scanner as Record<string, string>
  const meta = data.meta as Record<string, unknown>

  const marketData: MarketData = {
    ticker: data.ticker as string,
    currentPrice: parseFloat(scanner.currentPrice),
    open: parseFloat(scanner.open),
    high: parseFloat(scanner.high),
    low: parseFloat(scanner.low),
    previousClose: parseFloat(scanner.previousClose),
    todayVolume: parseFloat(scanner.todayVolume),
    avgVolume20d: parseFloat(scanner.avgVolume20d),
    support: parseFloat(scanner.support),
    resistance: parseFloat(scanner.resistance),
    atr: parseFloat((data.risk as Record<string, string>).atr),
    fetchedAt: Date.now(),
  }

  const indicators: IndicatorSet = {
    ema20: parseFloat(scanner.ema20),
    ema50: parseFloat(scanner.ema50),
    ema200: parseFloat(scanner.ema200),
    vwap: parseFloat(scanner.vwap),
    rsi: parseFloat(scanner.rsi),
    macd: {
      macd: 0,
      signal: 0,
      histogram: 0,
      label: scanner.macd || 'netral',
    },
    stochastic: {
      k: 50,
      d: 50,
      label: scanner.stochastic || 'neutral',
    },
    trend: meta.trend as IndicatorSet['trend'],
    volumeRatio: meta.volRatio as number,
  }

  logger.info(`Market data fetched for ${ticker}`, {
    bars: meta.barsCount,
    trend: meta.trend,
  })

  return {
    marketData,
    indicators,
    fundamental: (data.fundamental as AnalysisPipeline['fundamental']) ?? null,
    dataHealth: buildDataHealth(data),
    ihsgTrend:
      (meta.ihsgTrend as 'bullish' | 'sideways' | 'bearish' | 'unknown') ??
      deriveIhsgTrend(meta.ihsgChange5d as number | undefined, meta.ihsgChange1d as number | undefined),
    ihsgChange5d: meta.ihsgChange5d as number | undefined,
    ihsgChange1d: meta.ihsgChange1d as number | undefined,
  }
}

function buildDataHealth(data: QuotePayload): DataHealth {
  const scanner = data.scanner ?? {}
  const meta = data.meta ?? {}
  const issues: string[] = []
  const numericFields = [
    ['price', scanner.currentPrice],
    ['volume', scanner.todayVolume],
    ['avg volume', scanner.avgVolume20d],
    ['support', scanner.support],
    ['resistance', scanner.resistance],
    ['EMA20', scanner.ema20],
    ['RSI', scanner.rsi],
  ] as const

  for (const [label, raw] of numericFields) {
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) {
      issues.push(`${label} missing or zero`)
    }
  }

  const barsCount = Number(meta.barsCount ?? 0)
  if (barsCount < 60) issues.push(`Only ${barsCount} price bars available`)
  if (!meta.lastBarDate) issues.push('Last bar date unavailable')

  const lastUpdate = typeof meta.lastBarDate === 'string' ? meta.lastBarDate : ''
  const lastTime = lastUpdate ? new Date(lastUpdate).getTime() : Number.NaN
  const ageDays = Number.isFinite(lastTime)
    ? (Date.now() - lastTime) / (24 * 60 * 60 * 1000)
    : Number.POSITIVE_INFINITY
  if (ageDays > 7) issues.push(`Price data stale by ${Math.floor(ageDays)} days`)

  let score = 100
  score -= Math.max(0, 60 - barsCount)
  score -= issues.length * 12
  if (!data.fundamental) score -= 8
  score = Math.max(0, Math.min(100, Math.round(score)))

  const status: DataHealth['status'] =
    score >= 80 ? 'GOOD' : score >= 55 ? 'DEGRADED' : score >= 30 ? 'STALE' : 'BAD'

  return {
    status,
    score,
    lastUpdate: lastUpdate || 'unknown',
    barsCount,
    issues,
    source: meta.source === 'cache' ? 'cache' : 'live',
    hasFundamental: Boolean(data.fundamental),
    hasNews: false,
  }
}
