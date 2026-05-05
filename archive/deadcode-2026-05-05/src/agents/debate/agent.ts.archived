/**
 * Debate agent implementation
 * Facilitates debate between bullish and bearish arguments
 */

import type { AISettings } from '@/lib/types'
import type { ScannerResult, RiskResult, ContextResult, DebateResult } from '@/pipeline/types'

const DEBATE_SYSTEM_PROMPT = `Lu adalah AI trading analyst kelas hedge fund yang fokus ke saham IDX (BEI).
Style lu: tajam, padat, profesional, tidak generik, tidak basa-basi.

Tugas lu: debate moderator. Lu harus menyajikan argument bullish dan bearish secara seimbang.

Output WAJIB:
1. BULLISH ARGUMENTS (3-5 poin kuat)
2. BEARISH ARGUMENTS (3-5 poin kuat)
3. CONSENSUS: BULLISH / BEARISH / NEUTRAL
4. CONFIDENCE (0-100)
5. KEY FACTORS (3-5 faktor kunci)
6. REASONING singkat`

/**
 * Run debate agent
 */
export async function runDebateAgent(
  scanner: ScannerResult,
  risk: RiskResult,
  context: ContextResult,
  settings: AISettings
): Promise<DebateResult> {
  const bullishArguments: string[] = []
  const bearishArguments: string[] = []

  // Generate arguments based on analysis
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

  // Ensure we have at least some arguments
  if (bullishArguments.length === 0) {
    bullishArguments.push('Moderate setup quality')
  }
  if (bearishArguments.length === 0) {
    bearishArguments.push('Market volatility risk')
  }

  // Determine consensus
  let consensus: DebateResult['consensus'] = 'NEUTRAL'
  if (bullishArguments.length > bearishArguments.length) {
    consensus = 'BULLISH'
  } else if (bearishArguments.length > bullishArguments.length) {
    consensus = 'BEARISH'
  }

  const confidence = Math.min(100, Math.max(0, scanner.setupScore))

  return {
    bullishArguments,
    bearishArguments,
    consensus,
    confidence,
    keyFactors: [
      `Setup quality: ${scanner.setupScore}/100`,
      `Risk/reward: ${risk.rr1.toFixed(2)}`,
      `Market regime: ${context.marketRegime}`,
      `Setup type: ${scanner.setupType}`,
    ],
    reasoning: `${bullishArguments.length} bullish vs ${bearishArguments.length} bearish arguments. Consensus: ${consensus}.`,
  }
}