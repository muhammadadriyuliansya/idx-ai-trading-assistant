/**
 * Fundamental Analyst — deterministic assessment dari data fundamental Yahoo Finance
 */
import type { AnalystReport } from '@/pipeline/types'

export interface FundamentalInput {
  fundamental: {
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
  sector?: string
}

export function analyzeFundamental(input: FundamentalInput): AnalystReport {
  const { fundamental } = input
  const signals: string[] = []
  const risks: string[] = []
  let score = 0
  let bullishCount = 0
  let bearishCount = 0

  if (!fundamental) {
    return {
      agent: 'Fundamental Analyst',
      bias: 'neutral',
      confidence: 20,
      score: 50,
      summary: 'Data fundamental tidak tersedia. Analisis berdasarkan teknikal saja.',
      signals: ['Fundamental data not available — relying on technical analysis'],
      risks: ['No fundamental data for valuation assessment'],
    }
  }

  // --- VALUATION (max 25 pts) ---
  if (fundamental.per != null && fundamental.per > 0) {
    if (fundamental.per < 10) {
      score += 15
      bullishCount++
      signals.push(`PER ${fundamental.per.toFixed(1)}x — undervalued (<10x)`)
    } else if (fundamental.per < 15) {
      score += 12
      bullishCount++
      signals.push(`PER ${fundamental.per.toFixed(1)}x — reasonable valuation`)
    } else if (fundamental.per < 25) {
      score += 7
      signals.push(`PER ${fundamental.per.toFixed(1)}x — fair valuation`)
    } else {
      score += 3
      bearishCount++
      risks.push(`PER ${fundamental.per.toFixed(1)}x — expensive (>25x)`)
    }
  }

  if (fundamental.pbv != null && fundamental.pbv > 0) {
    if (fundamental.pbv < 1) {
      score += 10
      bullishCount++
      signals.push(`PBV ${fundamental.pbv.toFixed(2)}x — trading below book value`)
    } else if (fundamental.pbv < 3) {
      score += 7
      signals.push(`PBV ${fundamental.pbv.toFixed(2)}x — reasonable`)
    } else {
      bearishCount++
      risks.push(`PBV ${fundamental.pbv.toFixed(2)}x — premium valuation`)
    }
  }

  // --- PROFITABILITY (max 25 pts) ---
  if (fundamental.roe != null) {
    const roePct = fundamental.roe * 100
    if (roePct > 15) {
      score += 15
      bullishCount++
      signals.push(`ROE ${roePct.toFixed(1)}% — strong profitability (>15%)`)
    } else if (roePct > 10) {
      score += 10
      signals.push(`ROE ${roePct.toFixed(1)}% — adequate profitability`)
    } else if (roePct > 0) {
      score += 5
      signals.push(`ROE ${roePct.toFixed(1)}% — low but positive`)
    } else {
      bearishCount++
      risks.push(`ROE ${roePct.toFixed(1)}% — negative profitability`)
    }
  }

  // --- LEVERAGE (max 15 pts) ---
  if (fundamental.der != null) {
    if (fundamental.der < 50) {
      score += 10
      bullishCount++
      signals.push(`DER ${fundamental.der.toFixed(0)}% — conservative leverage`)
    } else if (fundamental.der < 150) {
      score += 7
      signals.push(`DER ${fundamental.der.toFixed(0)}% — moderate leverage`)
    } else {
      score += 3
      bearishCount++
      risks.push(`DER ${fundamental.der.toFixed(0)}% — high leverage risk`)
    }
  }

  // --- GROWTH (max 20 pts) ---
  if (fundamental.earningsGrowth != null) {
    const egPct = fundamental.earningsGrowth * 100
    if (egPct > 20) {
      score += 12
      bullishCount++
      signals.push(`Earnings growth ${egPct.toFixed(1)}% — strong growth`)
    } else if (egPct > 5) {
      score += 8
      signals.push(`Earnings growth ${egPct.toFixed(1)}% — moderate growth`)
    } else if (egPct > 0) {
      score += 4
      signals.push(`Earnings growth ${egPct.toFixed(1)}% — slow growth`)
    } else {
      bearishCount++
      risks.push(`Earnings growth ${egPct.toFixed(1)}% — declining earnings`)
    }
  }

  if (fundamental.revenueGrowth != null) {
    const rgPct = fundamental.revenueGrowth * 100
    if (rgPct > 10) {
      score += 8
      bullishCount++
      signals.push(`Revenue growth ${rgPct.toFixed(1)}% — expanding top line`)
    } else if (rgPct > 0) {
      score += 4
      signals.push(`Revenue growth ${rgPct.toFixed(1)}% — modest growth`)
    } else {
      bearishCount++
      risks.push(`Revenue growth ${rgPct.toFixed(1)}% — shrinking revenue`)
    }
  }

  // --- DIVIDEND (max 15 pts) ---
  if (fundamental.dividendYield != null && fundamental.dividendYield > 0) {
    const dyPct = fundamental.dividendYield * 100
    if (dyPct > 4) {
      score += 12
      bullishCount++
      signals.push(`Dividend yield ${dyPct.toFixed(2)}% — attractive income`)
    } else if (dyPct > 2) {
      score += 8
      signals.push(`Dividend yield ${dyPct.toFixed(2)}% — moderate income`)
    } else {
      score += 4
      signals.push(`Dividend yield ${dyPct.toFixed(2)}% — low yield`)
    }
  }

  // Normalize
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)))

  let bias: AnalystReport['bias'] = 'neutral'
  if (bullishCount > bearishCount + 1) bias = 'bullish'
  else if (bearishCount > bullishCount + 1) bias = 'bearish'
  else if (bullishCount > bearishCount) bias = 'bullish'

  const confidence = Math.min(90, Math.max(25, normalizedScore))
  const summary = `Fundamental score ${normalizedScore}/100. ${bullishCount} positive, ${bearishCount} negative indicators. Bias: ${bias}.`

  return {
    agent: 'Fundamental Analyst',
    bias,
    confidence,
    score: normalizedScore,
    summary,
    signals,
    risks,
  }
}
