import type {
  AnalystReport,
  ContextResult,
  DebateResult,
  DecisionResult,
  PortfolioDecision,
  RiskResult,
  ScannerResult,
} from '@/pipeline/types'

export function calculateFinalScore(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult,
  decision: DecisionResult,
  analystReports: AnalystReport[],
  portfolioDecision: PortfolioDecision,
): number {
  let score = 0

  score += scanner.setupScore * 0.25

  if (risk.verdict === 'ACCEPT') {
    score += 15
  } else if (risk.verdict === 'ADJUST') {
    score += 8
  }

  if (context.marketRegime === 'AGGRESSIVE') {
    score += 10
  } else if (context.marketRegime === 'NORMAL') {
    score += 7
  }

  if (debate.consensus === 'BULLISH') {
    score += 10
  } else if (debate.consensus === 'NEUTRAL') {
    score += 5
  }

  if (analystReports.length > 0) {
    const avgScore = analystReports.reduce((sum, report) => sum + report.score, 0) / analystReports.length
    score += avgScore * 0.2
  }

  if (portfolioDecision.action === 'APPROVED') {
    score += 15
  } else if (portfolioDecision.action === 'WATCHLIST') {
    score += 8
  } else if (portfolioDecision.action === 'REDUCE_SIZE') {
    score += 5
  }

  score += (decision.confidenceScore / 100) * 5

  return Math.round(Math.min(100, Math.max(0, score)))
}
