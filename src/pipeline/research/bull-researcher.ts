/**
 * Bull Researcher — menyusun kasus bullish dari semua data
 * Deterministic rule-based reasoning
 */
import type { AnalystReport } from '@/pipeline/types'

export interface BullResearchInput {
  analystReports: AnalystReport[]
  marketRegime: 'AGGRESSIVE' | 'NORMAL' | 'DEFENSIVE'
}

export function bullResearch(input: BullResearchInput): string[] {
  const { analystReports, marketRegime } = input
  const bullCase: string[] = []

  // Collect all bullish signals from analysts
  for (const report of analystReports) {
    if (report.bias === 'bullish') {
      bullCase.push(`[${report.agent}] ${report.summary}`)
    }
    for (const signal of report.signals) {
      if (!signal.toLowerCase().includes('bear') && !signal.toLowerCase().includes('risk')) {
        bullCase.push(`[${report.agent}] ${signal}`)
      }
    }
  }

  // Market regime bonus
  if (marketRegime === 'AGGRESSIVE') {
    bullCase.push('[Market Context] Aggressive market regime favors entry')
  }

  // Score-based arguments
  const techReport = analystReports.find((r) => r.agent === 'Technical Analyst')
  if (techReport && techReport.score >= 70) {
    bullCase.push(`[Technical] Strong technical score ${techReport.score}/100 supports entry`)
  }

  const fundReport = analystReports.find((r) => r.agent === 'Fundamental Analyst')
  if (fundReport && fundReport.score >= 60 && fundReport.bias === 'bullish') {
    bullCase.push('[Fundamental] Fundamental backing supports thesis')
  }

  // Remove duplicates
  const seen = new Set<string>()
  return bullCase.filter((item) => {
    if (seen.has(item)) return false
    seen.add(item)
    return true
  })
}
