/**
 * Portfolio Manager — evaluasi akhir dari perspektif portfolio management
 * Deterministic approval/rejection system
 */
import type { PortfolioDecision, DebateMatrix, InstitutionalThesis, MacroContext } from '@/pipeline/types'

export interface PortfolioInput {
  thesis: InstitutionalThesis
  debateMatrix: DebateMatrix
  macro: MacroContext | null
  riskReward: number
  setupScore: number
  liquidity: 'liquid' | 'normal' | 'tight'
  volatility: 'low' | 'normal' | 'high' | 'extreme'
}

export function evaluatePortfolio(input: PortfolioInput): PortfolioDecision {
  const { thesis, debateMatrix, riskReward, setupScore, liquidity, volatility } = input

  let action: PortfolioDecision['action'] = 'REJECTED'
  const conviction = thesis.conviction
  const reasoning: string[] = []
  let recommendedRiskPercent = 1.0 // default 1%

  // --- CONVICTION ASSESSMENT ---
  if (conviction < 30) {
    action = 'REJECTED'
    reasoning.push(`Conviction too low (${conviction}/100) — insufficient edge`)
  } else if (conviction < 50) {
    action = 'WATCHLIST'
    reasoning.push(`Low conviction (${conviction}/100) — add to watchlist, wait for better signal`)
  }

  // --- DEBATE CONSENSUS ---
  if (debateMatrix.dominantBias === 'bearish') {
    reasoning.push('Bearish consensus from research team')
    if (action !== 'REJECTED') action = 'WATCHLIST'
  }

  if (debateMatrix.conflictScore > 70) {
    reasoning.push(`High analyst conflict (${debateMatrix.conflictScore}%) — reduced conviction warranted`)
    recommendedRiskPercent *= 0.5
  }

  // --- RISK/REWARD ---
  if (riskReward < 1.5) {
    action = 'REJECTED'
    reasoning.push(`Risk/reward ${riskReward.toFixed(2)} below minimum 1.5 — reject`)
  } else if (riskReward < 2.0) {
    if (action !== 'REJECTED') action = 'WATCHLIST'
    reasoning.push(`Risk/reward ${riskReward.toFixed(2)} marginal — consider reduced size`)
    recommendedRiskPercent *= 0.5
  } else if (riskReward >= 3.0) {
    recommendedRiskPercent *= 1.5
    reasoning.push(`Excellent RRR ${riskReward.toFixed(2)} — can increase allocation`)
  }

  // --- SETUP SCORE ---
  if (setupScore < 45) {
    action = 'REJECTED'
    reasoning.push(`Setup score ${setupScore}/100 below threshold — reject`)
  } else if (setupScore >= 75 && conviction >= 60) {
    action = 'APPROVED'
    reasoning.push(`Strong setup score ${setupScore}/100 with good conviction`)
  } else if (setupScore >= 60) {
    if (action !== 'REJECTED') action = 'WATCHLIST'
    reasoning.push(`Moderate setup score ${setupScore}/100 — watchlist candidate`)
  }

  // --- LIQUIDITY ---
  if (liquidity === 'tight') {
    reasoning.push('Tight liquidity — slippage risk on entry/exit')
    recommendedRiskPercent *= 0.5
    if (action === 'APPROVED') action = 'REDUCE_SIZE'
  } else if (liquidity === 'liquid') {
    reasoning.push('Good liquidity — no execution concerns')
  }

  // --- VOLATILITY ---
  if (volatility === 'extreme') {
    reasoning.push('Extreme volatility — wide stops, reduced sizing recommended')
    recommendedRiskPercent *= 0.3
    if (action === 'APPROVED') action = 'REDUCE_SIZE'
  } else if (volatility === 'high') {
    reasoning.push('High volatility — ensure adequate stop buffer')
    recommendedRiskPercent *= 0.7
  } else if (volatility === 'low') {
    reasoning.push('Low volatility environment — tighter stops acceptable')
    recommendedRiskPercent *= 1.2
  }

  // --- THESIS QUALITY ---
  if (thesis.risks.length > thesis.opportunities.length) {
    reasoning.push('Risk factors outweigh opportunities — caution advised')
    if (action === 'APPROVED') action = 'REDUCE_SIZE'
  }

  // Clamp risk percent
  recommendedRiskPercent = Math.min(5, Math.max(0.1, Math.round(recommendedRiskPercent * 10) / 10))

  // Final check: if nothing decided and conviction is high enough
  if (action === 'REJECTED' && conviction >= 70 && riskReward >= 2.0 && setupScore >= 65) {
    action = 'APPROVED'
    reasoning.push('Strong overall thesis overrides individual concerns')
  }

  return {
    action,
    conviction,
    reasoning,
    recommendedRiskPercent,
  }
}
