/**
 * Central orchestrator for the enhanced analysis pipeline (v2)
 * Coordinates multi-layer institutional trading workflow:
 * Market Data → Intelligence → Analysts → Research → Thesis → Portfolio → Decision
 *
 * Pipeline utama tetap deterministic. AI hanya optional di export/refinement.
 */

import type {
  AnalysisPipeline,
  AnalystReport,
  DailyGuardSnapshot,
  TradingMode,
} from './types'
import type { AISettings } from '@/lib/types'
import { applyHardFilters } from './filters'
import { calculateRiskReward } from '@/lib/calc'
import { evaluateRiskGovernor, getDefaultRiskPerTrade } from '@/lib/risk-governor'
import { createEmptyMacroContext, createEmptyNewsIntelligence, createEmptySocialSentiment } from './core/fallbacks'
import { fetchMarketData, fetchMarketDataWithIndicators } from './core/market-data'
import {
  runContextAgent,
  runDebateAgent,
  runDecisionAgent,
  runRiskAgent,
  runScannerAgent,
} from './core/legacy-agents'
import { calculateFinalScore } from './core/scoring'

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
  mode?: TradingMode
  dailyGuardSnapshot?: DailyGuardSnapshot
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
    mode: options?.mode,
    dailyGuardSnapshot: options?.dailyGuardSnapshot,
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
    const mode = runOptions.mode ?? 'swing'
    const requestedRiskPerTrade = runOptions.riskPerTrade ?? getDefaultRiskPerTrade(mode)
    const initialGovernor = evaluateRiskGovernor({
      mode,
      capital,
      requestedRiskPerTrade,
      snapshot: runOptions.dailyGuardSnapshot,
    })
    const riskPerTrade = initialGovernor.effectiveRiskPerTrade || initialGovernor.baseRiskPerTrade

    // ============================================================
    // LAYER 1: Market Data
    // ============================================================
    const { marketData, indicators, fundamental, dataHealth, ihsgTrend, ihsgChange5d, ihsgChange1d } =
      await fetchMarketDataWithIndicators(ticker, { fields: 'full' })

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

    const riskGovernor = evaluateRiskGovernor({
      mode,
      capital,
      requestedRiskPerTrade,
      snapshot: runOptions.dailyGuardSnapshot,
      marketData,
      indicators,
      dataHealth,
      scanner,
      risk,
      context,
    })

    if (!riskGovernor.entryAllowed) {
      const failedGates = riskGovernor.gates.filter((gate) => !gate.passed)
      const reason = riskGovernor.noTradeReason ?? failedGates[0]?.label ?? 'Capital guard blocked entry'
      decision.finalDecision = 'NO_TRADE'
      decision.keyRisk = reason
      decision.executionNotes = `No trade: ${reason}. Review only until the guard opens again.`
      decision.reasoning = `Risk governor blocks entry. Status ${riskGovernor.status}; ${failedGates.map((gate) => `${gate.label}: ${gate.reason}`).join('; ') || reason}.`
      decision.riskLevel = 'HIGH'
      decision.urgency = 'monitor'
      decision.successProbability = Math.min(decision.successProbability, 50)
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
    if (!riskGovernor.entryAllowed) {
      const failedGates = riskGovernor.gates
        .filter((gate) => !gate.passed)
        .map((gate) => `${gate.label}: ${gate.reason}`)
      portfolioDecision.action = 'REJECTED'
      portfolioDecision.conviction = Math.min(portfolioDecision.conviction, 30)
      portfolioDecision.reasoning = [
        riskGovernor.noTradeReason ?? 'Risk governor blocked entry',
        ...failedGates,
        ...portfolioDecision.reasoning,
      ]
      portfolioDecision.recommendedRiskPercent = 0
    } else {
      portfolioDecision.recommendedRiskPercent = Math.min(
        portfolioDecision.recommendedRiskPercent,
        riskGovernor.recommendedRiskPerTrade,
      )
    }

    // ============================================================
    // LAYER 8: Final Score
    // ============================================================
    const calculatedScore = calculateFinalScore(scanner, risk, context, debate, decision, analystReports, portfolioDecision)
    const finalScore = hardFilterReason || !riskGovernor.entryAllowed
      ? Math.min(45, calculatedScore)
      : calculatedScore

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
      status: !riskGovernor.entryAllowed ? 'NO_TRADE' : hardFilterReason ? 'REJECT' : scanner.status,

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
      riskGovernor,
    }
  } catch (error) {
    console.error(`Analysis failed for ${ticker}:`, error)
    throw error
  }
}

export { fetchMarketData, fetchMarketDataWithIndicators }
