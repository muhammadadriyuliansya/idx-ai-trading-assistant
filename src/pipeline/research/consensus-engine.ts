/**
 * Consensus Engine — menghitung konsensus dari bull vs bear research
 * Deterministic scoring system
 */
import type { DebateMatrix } from '@/pipeline/types'

export interface ConsensusInput {
  bullCase: string[]
  bearCase: string[]
  analystScores: number[]
  marketRegime: 'AGGRESSIVE' | 'NORMAL' | 'DEFENSIVE'
}

export function computeConsensus(input: ConsensusInput): DebateMatrix {
  const { bullCase, bearCase, analystScores, marketRegime } = input

  // Base scores from argument counts
  const bullWeight = bullCase.length
  const bearWeight = bearCase.length
  const totalWeight = bullWeight + bearWeight

  // Analyst score influence
  const avgAnalystScore = analystScores.length > 0
    ? analystScores.reduce((a, b) => a + b, 0) / analystScores.length
    : 50

  // Calculate consensus score (-100 to +100, then normalize to 0-100)
  let rawScore = 0

  if (totalWeight > 0) {
    rawScore += ((bullWeight - bearWeight) / totalWeight) * 40
  }

  rawScore += ((avgAnalystScore - 50) / 50) * 40

  // Market regime modifier
  if (marketRegime === 'AGGRESSIVE') rawScore += 10
  else if (marketRegime === 'DEFENSIVE') rawScore -= 10

  // Normalize to 0-100
  const consensusScore = Math.min(100, Math.max(0, Math.round(50 + rawScore)))

  // Conflict score — how much disagreement
  const maxSide = Math.max(bullWeight, bearWeight)
  const minSide = Math.min(bullWeight, bearWeight)
  const conflictScore =
    maxSide > 0 ? Math.round((minSide / maxSide) * 100) : 0

  // Dominant bias
  let dominantBias: DebateMatrix['dominantBias'] = 'neutral'
  if (consensusScore > 60) dominantBias = 'bullish'
  else if (consensusScore < 40) dominantBias = 'bearish'

  return {
    bullCase,
    bearCase,
    consensusScore,
    conflictScore,
    dominantBias,
  }
}
