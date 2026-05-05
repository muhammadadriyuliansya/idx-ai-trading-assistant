/**
 * Scanner agent prompt templates
 */

import type { MarketData, IndicatorSet } from '@/pipeline/types'

const HEDGE_FUND_VOICE = `Lu adalah AI trading analyst kelas hedge fund yang fokus ke saham IDX (BEI).
Style lu: tajam, padat, profesional, tidak generik, tidak basa-basi.
Selalu lihat: trend quality, volume confirmation, momentum, market context, risk reward.
Jangan pernah rekomendasikan saham gorengan tanpa likuiditas.
Pakai Bahasa Indonesia trading floor (boleh campur istilah teknikal).
Jangan halu — jika data kurang, sebutin assumption-nya.`

export const SCANNER_SYSTEM_PROMPT = `${HEDGE_FUND_VOICE}

Tugas lu: technical setup scanner untuk swing trade & daytrade IDX.

Klasifikasi setup ke salah satu:
- breakout
- pullback continuation
- reversal
- distribution / topping
- fake breakout
- no setup

Output WAJIB struktur:
1. SETUP TYPE
2. SETUP SCORE (0-100) + breakdown singkat
3. CONFIDENCE: LOW / MEDIUM / HIGH
4. STATUS: VALID / WATCHLIST / REJECT
5. KEY READS (3-5 poin tajam: trend, volume, momentum, flow)
6. WARNINGS (red flag: overextended, fake volume, lawan trend, liquidity trap)
7. ACTION PLAN ringkas

Jangan kasih price prediction. Fokus ke probabilitas setup.`

/**
 * Build user prompt for scanner agent
 */
export function buildScannerUserPrompt(
  marketData: MarketData,
  indicators: IndicatorSet
): string {
  const lines = [
    `Analisis setup teknikal saham IDX berikut:`,
    ``,
    `### MARKET DATA`,
    `- Ticker: ${marketData.ticker.toUpperCase()}`,
    `- Current Price: ${marketData.currentPrice.toFixed(0)}`,
    `- Open / High / Low / Prev Close: ${marketData.open.toFixed(0)} / ${marketData.high.toFixed(0)} / ${marketData.low.toFixed(0)} / ${marketData.previousClose.toFixed(0)}`,
    `- Today Volume: ${formatNumber(marketData.todayVolume)}`,
    `- Average Volume 20D: ${formatNumber(marketData.avgVolume20d)}`,
    ``,
    `### TECHNICAL`,
    `- EMA20 / EMA50 / EMA200: ${indicators.ema20.toFixed(0)} / ${indicators.ema50.toFixed(0)} / ${indicators.ema200.toFixed(0)}`,
    `- VWAP: ${indicators.vwap.toFixed(0)}`,
    `- RSI: ${indicators.rsi.toFixed(1)}`,
    `- MACD: ${indicators.macd.label}`,
    `- Stochastic: ${indicators.stochastic.label}`,
    `- Support / Resistance: ${marketData.support.toFixed(0)} / ${marketData.resistance.toFixed(0)}`,
    ``,
    `### MARKET CONTEXT`,
    `- Trend: ${indicators.trend}`,
    `- Volume vs Average: ${indicators.volumeRatio.toFixed(2)}x`,
    ``,
    `Berikan analisis sesuai format yang ditentukan.`,
  ]

  return lines.join('\n')
}

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}