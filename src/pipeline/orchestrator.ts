/**
 * Central orchestrator for the enhanced analysis pipeline (v2)
 * Coordinates multi-layer institutional trading workflow:
 * Market Data → Intelligence → Analysts → Research → Thesis → Portfolio → Decision
 *
 * Pipeline utama tetap deterministic. AI hanya optional di export/refinement.
 */

import type {
  AnalysisPipeline,
  MarketData,
  IndicatorSet,
  DataHealth,
  ScannerResult,
  RiskResult,
  ContextResult,
  DebateResult,
  DecisionResult,
  AnalystReport,
  PortfolioDecision,
} from './types'
import type { AISettings } from '@/lib/types'
import { applyHardFilters } from './filters'
import { calculateSetupScore, computeRisk, calculateRiskReward } from '@/lib/calc'
import { resilientFetch } from '@/lib/resilient-fetch'
import { createLogger } from '@/lib/logger'

const logger = createLogger('pipeline:orchestrator')

// Phase 1 — Market Intelligence
import { fetchNewsIntelligence } from './analysts/news-analyst'
import { computeSocialSentiment } from './analysts/sentiment-analyst'
import { computeMacroContext } from './analysts/macro-analyst'

// Phase 2 — Analyst Team
import { analyzeTechnical } from './analysts/technical-analyst'
import { analyzeFundamental } from './analysts/fundamental-analyst'
import { analyzeNews } from './analysts/news-analyst-full'

// Phase 3 — Research Debate
import { bullResearch } from './research/bull-researcher'
import { bearResearch } from './research/bear-researcher'
import { computeConsensus } from './research/consensus-engine'

// Phase 4 — Thesis Engine
import { buildThesis } from './thesis/thesis-builder'

// Phase 5 — Portfolio Manager
import { evaluatePortfolio } from './portfolio/portfolio-manager'

export interface AnalysisRunOptions {
  settings?: AISettings
  capital?: number
  riskPerTrade?: number
}

function isAISettings(value: AISettings | AnalysisRunOptions | undefined): value is AISettings {
  return Boolean(value && 'provider' in value)
}

function normalizeRunOptions(options?: AISettings | AnalysisRunOptions): AnalysisRunOptions {
  if (isAISettings(options)) {
    return { settings: options }
  }

  return {
    settings: options?.settings,
    capital: options?.capital,
    riskPerTrade: options?.riskPerTrade,
  }
}

/**
 * Run full analysis pipeline for a ticker (enhanced v2).
 * The core pipeline stays deterministic; AI settings are only carried for
 * compatibility with manual refinement flows.
 */
export async function runFullAnalysis(
  ticker: string,
  options?: AISettings | AnalysisRunOptions
): Promise<AnalysisPipeline> {
  try {
    const runOptions = normalizeRunOptions(options)
    const capital = runOptions.capital ?? 100000000
    const riskPerTrade = runOptions.riskPerTrade ?? 1

    // ============================================================
    // LAYER 1: Market Data
    // ============================================================
    const { marketData, indicators, fundamental, dataHealth, ihsgTrend, ihsgChange5d, ihsgChange1d } =
      await fetchMarketDataWithIndicators(ticker)

    // ============================================================
    // LAYER 1b: Hard Filters (legacy compatibility)
    // ============================================================
    const filterResult = applyHardFilters(marketData, indicators)
    const hardFilterReason = filterResult.passed
      ? null
      : filterResult.reason || 'Failed hard filters'

    // ============================================================
    // LAYER 2: Market Intelligence (parallel fetch)
    // ============================================================
    const [newsIntelligence, macroContext] = await Promise.allSettled([
      fetchNewsIntelligence(ticker.replace('.JK', '')),
      Promise.resolve(
        computeMacroContext({
          marketData,
          indicators,
          ihsgChange5d,
          ihsgChange1d,
        })
      ),
    ])

    const news = newsIntelligence.status === 'fulfilled' ? newsIntelligence.value : null
    const macro = macroContext.status === 'fulfilled' ? macroContext.value : null

    // Social sentiment dari news headlines
    const socialSentiment = news && news.recentHeadlines.length > 0
      ? computeSocialSentiment(news.recentHeadlines)
      : createEmptySocialSentiment()

    // Attach news to macro context for reference
    if (macro) {
      // macro already computed, sentiment available separately
    }

    // ============================================================
    // LAYER 3: Analyst Team (parallel)
    // ============================================================
    const [technicalReport, fundamentalReport, newsReport] = await Promise.allSettled([
      Promise.resolve(
        analyzeTechnical({ marketData, indicators })
      ),
      Promise.resolve(
        analyzeFundamental({ fundamental: fundamental ?? null })
      ),
      Promise.resolve(
        analyzeNews({ news, sentiment: socialSentiment })
      ),
    ])

    const analystReports: AnalystReport[] = []
    if (technicalReport.status === 'fulfilled') analystReports.push(technicalReport.value)
    if (fundamentalReport.status === 'fulfilled') analystReports.push(fundamentalReport.value)
    if (newsReport.status === 'fulfilled') analystReports.push(newsReport.value)

    // ============================================================
    // LAYER 4: Legacy Pipeline (scanner → risk → context → debate → decision)
    // ============================================================
    const scanner = runScannerAgent(marketData, indicators, ihsgTrend)
    if (hardFilterReason) {
      scanner.status = 'REJECT'
      scanner.warnings = [...scanner.warnings, hardFilterReason]
      scanner.actionPlan = 'Skip entry until hard filters improve'
    }

    const risk = runRiskAgent(marketData, capital, riskPerTrade)
    const context = runContextAgent(indicators, ihsgTrend, ihsgChange5d)
    const debate = runDebateAgent(scanner, risk, context)
    const decision = runDecisionAgent(scanner, risk, context, debate)
    if (hardFilterReason) {
      decision.finalDecision = 'REJECT'
      decision.keyRisk = hardFilterReason
      decision.executionNotes = 'No entry while hard filters fail'
      decision.reasoning = `Rejected by hard filter: ${hardFilterReason}. Full market data and risk plan are still shown for review.`
      decision.riskLevel = 'HIGH'
      decision.urgency = 'monitor'
    }

    // ============================================================
    // LAYER 5: Research Debate (enhanced)
    // ============================================================
    const marketRegime = context.marketRegime
    const bullCase = bullResearch({ analystReports, marketRegime })
    const bearCase = bearResearch({ analystReports, marketRegime })
    const analystScores = analystReports.map((r) => r.score)

    const debateMatrix = computeConsensus({
      bullCase,
      bearCase,
      analystScores,
      marketRegime,
    })

    // ============================================================
    // LAYER 6: Institutional Thesis
    // ============================================================
    const thesis = buildThesis({
      analystReports,
      debateMatrix,
      marketRegime,
      news,
      sentiment: socialSentiment,
      macro,
      fundamental,
      ticker: ticker.replace('.JK', ''),
    })

    // ============================================================
    // LAYER 7: Portfolio Manager
    // ============================================================
    const rr = calculateRiskReward(
      marketData.currentPrice,
      marketData.support,
      marketData.resistance
    )

    const portfolioDecision = evaluatePortfolio({
      thesis,
      debateMatrix,
      macro,
      riskReward: rr,
      setupScore: scanner.setupScore,
      liquidity: macro?.liquidityCondition ?? 'normal',
      volatility: macro?.volatilityState ?? 'normal',
    })
    if (hardFilterReason) {
      portfolioDecision.action = 'REJECTED'
      portfolioDecision.conviction = Math.min(portfolioDecision.conviction, 25)
      portfolioDecision.reasoning = [
        hardFilterReason,
        ...portfolioDecision.reasoning,
      ]
      portfolioDecision.recommendedRiskPercent = 0
    }

    // ============================================================
    // LAYER 8: Final Score
    // ============================================================
    const calculatedScore = calculateFinalScore(scanner, risk, context, debate, decision, analystReports, portfolioDecision)
    const finalScore = hardFilterReason ? Math.min(45, calculatedScore) : calculatedScore

    return {
      ticker,
      timestamp: Date.now(),
      marketData,
      indicators,
      dataHealth: {
        ...dataHealth,
        hasFundamental: Boolean(fundamental),
        hasNews: (news?.totalArticles ?? 0) > 0,
        issues: [
          ...dataHealth.issues,
          ...(fundamental ? [] : ['Fundamental data unavailable from Yahoo Finance']),
          ...((news?.totalArticles ?? 0) > 0 ? [] : ['No fresh news found']),
        ],
      },
      fundamental,
      scanner,
      risk,
      context,
      debate,
      decision,
      finalScore,
      confidence: scanner.confidence,
      status: hardFilterReason ? 'REJECT' : scanner.status,

      // Phase 1 — Market Intelligence
      newsIntelligence: news ?? createEmptyNewsIntelligence(),
      socialSentiment,
      macroContext: macro ?? createEmptyMacroContext(),

      // Phase 2 — Analyst Reports
      analystReports,

      // Phase 3 — Research Debate
      debateMatrix,

      // Phase 4 — Institutional Thesis
      thesis,

      // Phase 5 — Portfolio Manager
      portfolioDecision,
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

/**
 * Fetch market data with indicators from Yahoo Finance API
 */
export async function fetchMarketDataWithIndicators(
  ticker: string
): Promise<{
  marketData: MarketData
  indicators: IndicatorSet
  fundamental: AnalysisPipeline['fundamental']
  dataHealth: DataHealth
  ihsgTrend: 'bullish' | 'sideways' | 'bearish' | 'unknown'
  ihsgChange5d?: number
  ihsgChange1d?: number
}> {
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
    ihsgTrend: (meta.ihsgTrend as 'bullish' | 'sideways' | 'bearish' | 'unknown') ?? deriveIhsgTrend(meta.ihsgChange5d as number | undefined, meta.ihsgChange1d as number | undefined),
    ihsgChange5d: meta.ihsgChange5d as number | undefined,
    ihsgChange1d: meta.ihsgChange1d as number | undefined,
  }
}

/**
 * Run scanner agent (deterministic, no AI required)
 */
function runScannerAgent(
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
    calculateRiskReward(marketData.currentPrice, marketData.support, marketData.resistance)
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

/**
 * Run risk agent (deterministic, no AI required)
 */
function runRiskAgent(
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

/**
 * Run context agent (deterministic, no AI required)
 */
function runContextAgent(
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
    reasoning: `Market regime ${marketRegime} based on IHSG trend ${ihsgTrend}, IHSG 5d ${ihsgChange5d != null ? ihsgChange5d.toFixed(2) + '%' : 'N/A'}, stock trend ${indicators.trend}, and volume ${indicators.volumeRatio.toFixed(2)}x. Risk stance: ${riskStance}.`,
  }
}

type QuotePayload = {
  scanner?: Record<string, unknown>
  meta?: Record<string, unknown>
  fundamental?: unknown
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
  const lastTime = lastUpdate ? new Date(lastUpdate).getTime() : NaN
  const ageDays = Number.isFinite(lastTime)
    ? (Date.now() - lastTime) / (24 * 60 * 60 * 1000)
    : Infinity
  if (ageDays > 7) issues.push(`Price data stale by ${Math.floor(ageDays)} days`)

  let score = 100
  score -= Math.max(0, 60 - barsCount)
  score -= issues.length * 12
  if (!data?.fundamental) score -= 8
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

/**
 * Run decision agent (deterministic, no AI required)
 */
function runDecisionAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult
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

  const reasoning = `Final decision ${finalDecision} based on scanner ${scanner.status} (${scanner.setupScore}/100), risk ${risk.verdict} (RR ${risk.rr1.toFixed(2)}), market regime ${context.marketRegime}, and debate consensus ${debate.consensus}.`

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
 * Calculate final score from all layers
 */
function calculateFinalScore(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult,
  decision: DecisionResult,
  analystReports: AnalystReport[],
  portfolioDecision: PortfolioDecision,
): number {
  let score = 0

  // Scanner contribution (25%)
  score += scanner.setupScore * 0.25

  // Risk contribution (15%)
  if (risk.verdict === 'ACCEPT') {
    score += 15
  } else if (risk.verdict === 'ADJUST') {
    score += 8
  }

  // Context contribution (10%)
  if (context.marketRegime === 'AGGRESSIVE') {
    score += 10
  } else if (context.marketRegime === 'NORMAL') {
    score += 7
  }

  // Debate contribution (10%)
  if (debate.consensus === 'BULLISH') {
    score += 10
  } else if (debate.consensus === 'NEUTRAL') {
    score += 5
  }

  // Analyst team contribution (20%)
  if (analystReports.length > 0) {
    const avgScore = analystReports.reduce((sum, r) => sum + r.score, 0) / analystReports.length
    score += avgScore * 0.2
  }

  // Portfolio decision contribution (15%)
  if (portfolioDecision.action === 'APPROVED') {
    score += 15
  } else if (portfolioDecision.action === 'WATCHLIST') {
    score += 8
  } else if (portfolioDecision.action === 'REDUCE_SIZE') {
    score += 5
  }

  // Decision confidence (5%)
  score += (decision.confidenceScore / 100) * 5

  return Math.round(Math.min(100, Math.max(0, score)))
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

function createEmptySocialSentiment() {
  return {
    score: 0,
    volume: 0,
    momentum: 'stable' as const,
    mentions: 0,
    positiveRatio: 0,
    negativeRatio: 0,
    neutralRatio: 1,
    topKeywords: [],
  }
}

function createEmptyNewsIntelligence() {
  return {
    sources: [],
    totalArticles: 0,
    recentHeadlines: [],
    dominantSentiment: 'neutral' as const,
    sentimentScore: 0,
    keyTopics: [],
  }
}

function createEmptyMacroContext() {
  return {
    volatilityState: 'normal' as const,
    sectorMomentum: 'No data available',
    liquidityCondition: 'normal' as const,
    globalCue: 'neutral' as const,
    marketBreadth: 'No data available',
  }
}

function deriveIhsgTrend(
  ihsgChange5d?: number,
  ihsgChange1d?: number,
): 'bullish' | 'sideways' | 'bearish' | 'unknown' {
  const change = ihsgChange5d ?? ihsgChange1d
  if (change == null || !Number.isFinite(change)) return 'unknown'
  if (change > 0) return 'bullish'
  if (change < -1) return 'bearish'
  return 'sideways'
}
