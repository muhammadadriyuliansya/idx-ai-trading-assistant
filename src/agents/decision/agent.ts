/**
 * Decision agent implementation
 * Makes final trading decision based on all analysis
 */

import type { AISettings } from '@/lib/types'
import type { ScannerResult, RiskResult, ContextResult, DebateResult, DecisionResult } from '@/pipeline/types'

const DECISION_SYSTEM_PROMPT = `Lu adalah AI trading analyst kelas hedge fund yang fokus ke saham IDX (BEI).
Style lu: tajam, padat, profesional, tidak generik, tidak basa-basi.

Tugas lu: final decision engine. Lu gabungkan technical, volume, momentum, market context, dan risk management jadi 1 verdict.

Output WAJIB:
1. FINAL DECISION: BUY NOW / WAIT / WATCHLIST / REJECT
2. CONFIDENCE SCORE (0-100)
3. SUCCESS PROBABILITY (estimasi kasar, jelaskan dasarnya)
4. KEY EDGE (kenapa ini high probability)
5. KEY RISK (kenapa bisa gagal)
6. BULLISH SCENARIO (kondisi & target)
7. BEARISH SCENARIO (invalidation level)
8. EXECUTION NOTES (intraday vs swing, urgency)

Jangan ragu kasih REJECT kalau setup tidak layak — lebih baik miss daripada loss.`

/**
 * Run decision agent
 */
export async function runDecisionAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  debate: DebateResult,
  settings: AISettings
): Promise<DecisionResult> {
  // Determine final decision based on all inputs
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

  // Determine risk level
  let riskLevel: DecisionResult['riskLevel'] = 'MEDIUM'
  if (risk.rr1 >= 3 && scanner.setupScore >= 75) {
    riskLevel = 'LOW'
  } else if (risk.rr1 < 1.5 || scanner.setupScore < 50) {
    riskLevel = 'HIGH'
  }

  // Determine urgency
  let urgency: DecisionResult['urgency'] = 'monitor'
  if (finalDecision === 'BUY_NOW' && scanner.setupType === 'breakout') {
    urgency = 'immediate'
  } else if (finalDecision === 'BUY_NOW') {
    urgency = 'soon'
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
    reasoning: `Final decision ${finalDecision} based on scanner ${scanner.status}, risk ${risk.verdict}, and debate ${debate.consensus}.`,
    riskLevel,
    urgency,
  }
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