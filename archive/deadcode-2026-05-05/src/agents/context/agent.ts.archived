/**
 * Context agent implementation
 * Analyzes market context and determines market regime
 */

import type { AISettings } from '@/lib/types'
import type { MarketData, IndicatorSet, ContextResult } from '@/pipeline/types'

const CONTEXT_SYSTEM_PROMPT = `Lu adalah AI trading analyst kelas hedge fund yang fokus ke saham IDX (BEI).
Style lu: tajam, padat, profesional, tidak generik, tidak basa-basi.

Tugas lu: macro & market context analyst untuk IDX.

Analisis:
- Apakah IHSG dalam fase risk-on, risk-off, atau transisi
- Foreign flow (inflow / outflow / netral)
- Pengaruh US market (S&P, Nasdaq, Dow)
- Komoditas relevan (CPO, batu bara, nikel, minyak)
- USD/IDR & rate trend
- Sektor leading vs lagging
- Potensi fake rally / sector rotation

Output WAJIB:
1. MARKET REGIME: AGGRESSIVE / NORMAL / DEFENSIVE
2. RISK STANCE: RISK-ON / NEUTRAL / RISK-OFF
3. SECTOR TAKE (leader vs laggard)
4. FLOW READ
5. KEY RISKS hari ini / minggu ini
6. STRATEGY BIAS (boleh aggressive trade, atau wajib defensive)`

/**
 * Run context agent
 */
export async function runContextAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  settings: AISettings
): Promise<ContextResult> {
  // Simplified context analysis based on indicators
  let marketRegime: ContextResult['marketRegime'] = 'NORMAL'
  let riskStance: ContextResult['riskStance'] = 'NEUTRAL'

  if (indicators.trend === 'bullish' && indicators.volumeRatio > 1.5) {
    marketRegime = 'AGGRESSIVE'
    riskStance = 'RISK-ON'
  } else if (indicators.trend === 'bearish') {
    marketRegime = 'DEFENSIVE'
    riskStance = 'RISK-OFF'
  }

  return {
    marketRegime,
    riskStance,
    sectorTake: 'Analyze sector rotation',
    flowRead: 'Monitor foreign flow',
    keyRisks: [
      'Market volatility',
      'Sector rotation',
      'Foreign outflow risk',
    ],
    strategyBias: marketRegime === 'AGGRESSIVE' ? 'Can be selective aggressive' : 'Stay defensive',
    reasoning: `Market regime ${marketRegime} based on trend ${indicators.trend} and volume ${indicators.volumeRatio.toFixed(2)}x.`,
  }
}