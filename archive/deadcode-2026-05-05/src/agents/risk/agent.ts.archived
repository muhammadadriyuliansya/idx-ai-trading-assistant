/**
 * Risk agent implementation
 * Validates and refines risk management parameters
 */

import type { AISettings } from '@/lib/types'
import type { MarketData, IndicatorSet, ScannerResult, RiskResult } from '@/pipeline/types'
import { callAIProvider } from '@/lib/ai-provider'
import { computeRisk } from '@/lib/calc'

const RISK_SYSTEM_PROMPT = `Lu adalah AI trading analyst kelas hedge fund yang fokus ke saham IDX (BEI).
Style lu: tajam, padat, profesional, tidak generik, tidak basa-basi.

Tugas lu: risk manager. Validasi & refine entry/stop/target dari calculator.

Output WAJIB:
1. ENTRY ZONE (range realistis, bukan 1 angka kaku)
2. STOP LOSS (jelaskan kenapa di level itu — di bawah support / ATR-based)
3. TP1 dan TP2 (jelaskan logika)
4. RISK REWARD (RR1 & RR2)
5. POSITION SIZING (lot, max loss, % dari modal)
6. VERDICT: ACCEPT / ADJUST / REJECT
   - REJECT kalau RR < 1.5 atau stop terlalu jauh
   - ADJUST kasih saran level yang lebih sehat

Selalu prioritaskan capital preservation.`

/**
 * Run risk agent
 */
export async function runRiskAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  scanner: ScannerResult,
  settings: AISettings
): Promise<RiskResult> {
  try {
    // Calculate risk parameters
    const riskCalc = computeRisk({
      ticker: marketData.ticker,
      currentPrice: marketData.currentPrice.toString(),
      support: marketData.support.toString(),
      resistance: marketData.resistance.toString(),
      atr: marketData.atr.toString(),
      capital: '100000000', // Default 100M
      riskPerTrade: '1',
    })

    if (!riskCalc) {
      throw new Error('Failed to calculate risk parameters')
    }

    // Determine verdict based on calculations
    let verdict: RiskResult['verdict'] = 'REJECT'
    if (riskCalc.riskReward1 >= 2.0) {
      verdict = 'ACCEPT'
    } else if (riskCalc.riskReward1 >= 1.5) {
      verdict = 'ADJUST'
    }

    return {
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
      reasoning: `RR ${riskCalc.riskReward1.toFixed(2)} meets minimum requirements. Position sized for 1% risk.`,
    }
  } catch (error) {
    console.error('Risk agent error:', error)
    throw error
  }
}