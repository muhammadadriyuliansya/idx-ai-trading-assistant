/**
 * Institutional Thesis Builder — menggabungkan semua analisis menjadi thesis terpadu
 * Menghasilkan dokumen research berkualitas institusional
 */
import type {
  InstitutionalThesis,
  AnalystReport,
  DebateMatrix,
  NewsIntelligence,
  SocialSentiment,
  MacroContext,
} from '@/pipeline/types'

export interface ThesisInput {
  analystReports: AnalystReport[]
  debateMatrix: DebateMatrix
  marketRegime: 'AGGRESSIVE' | 'NORMAL' | 'DEFENSIVE'
  news?: NewsIntelligence | null
  sentiment?: SocialSentiment | null
  macro?: MacroContext | null
  fundamental?: {
    per: number | null
    pbv: number | null
    dividendYield: number | null
    marketCap: number | null
    roe: number | null
    der: number | null
    revenueGrowth: number | null
    earningsGrowth: number | null
    eps: number | null
  } | null
  ticker: string
}

export function buildThesis(input: ThesisInput): InstitutionalThesis {
  const { analystReports, debateMatrix, ticker, marketRegime } = input

  // Technical thesis from technical analyst
  const techReport = analystReports.find((r) => r.agent === 'Technical Analyst')
  const technicalThesis = techReport ? extractThesisPoints(techReport) : []

  // Fundamental thesis from fundamental analyst
  const fundReport = analystReports.find((r) => r.agent === 'Fundamental Analyst')
  const fundamentalThesis = fundReport ? extractThesisPoints(fundReport) : []

  // Sentiment thesis from news + sentiment
  const sentimentThesis: string[] = []
  const newsReport = analystReports.find((r) => r.agent === 'News Analyst')
  if (newsReport) {
    sentimentThesis.push(...extractThesisPoints(newsReport))
  }
  if (input.news && input.news.keyTopics.length > 0) {
    sentimentThesis.push(`Key news topics: ${input.news.keyTopics.join(', ')}`)
  }
  if (input.sentiment && input.sentiment.momentum !== 'stable') {
    sentimentThesis.push(`Social sentiment momentum: ${input.sentiment.momentum}`)
  }

  // Opportunities dari bull case
  const opportunities = debateMatrix.bullCase.slice(0, 5)

  // Risks dari bear case
  const risks = debateMatrix.bearCase.slice(0, 5)

  // Add regime context to risks
  if (marketRegime === 'DEFENSIVE') {
    risks.unshift('Market regime DEFENSIVE — elevated downside risk')
  }

  // Conviction — weighted average
  const weights: number[] = []
  for (const report of analystReports) {
    weights.push(report.score * (report.confidence / 100))
  }
  const avgWeighted = weights.length > 0
    ? weights.reduce((a, b) => a + b, 0) / weights.length
    : 50

  // Blend with debate consensus
  const conviction = Math.round((avgWeighted * 0.6 + debateMatrix.consensusScore * 0.4))

  // Executive summary
  const executiveSummary = generateExecutiveSummary(
    ticker,
    conviction,
    debateMatrix.dominantBias,
    marketRegime,
    analystReports.length,
  )

  // Title
  const title = `${ticker} — Institutional Trading Thesis`

  return {
    title,
    executiveSummary,
    technicalThesis,
    fundamentalThesis,
    sentimentThesis,
    opportunities,
    risks,
    conviction: Math.min(100, Math.max(0, conviction)),
  }
}

function extractThesisPoints(report: AnalystReport): string[] {
  const points: string[] = []

  if (report.bias === 'bullish') {
    for (const signal of report.signals) {
      points.push(`✓ ${signal}`)
    }
  } else if (report.bias === 'bearish') {
    for (const risk of report.risks) {
      points.push(`✗ ${risk}`)
    }
  } else {
    for (const signal of report.signals.slice(0, 3)) {
      points.push(`○ ${signal}`)
    }
  }

  return points.slice(0, 6)
}

function generateExecutiveSummary(
  ticker: string,
  conviction: number,
  bias: string,
  regime: string,
  reportCount: number,
): string {
  const convictionLevel = conviction >= 75 ? 'High' : conviction >= 55 ? 'Moderate' : 'Low'
  return `${regime} market environment. ${reportCount} analyst reports assessed. Consensus ${bias} with ${convictionLevel.toLowerCase()} conviction (${conviction}/100). Review full thesis below for entry rationale and risk factors.`
}
