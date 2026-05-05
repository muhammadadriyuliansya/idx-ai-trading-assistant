/**
 * Bear Researcher — menyusun kasus bearish dari semua data
 * Deterministic rule-based reasoning
 */
import type { AnalystReport } from '@/pipeline/types'

export interface BearResearchInput {
  analystReports: AnalystReport[]
  marketRegime: 'AGGRESSIVE' | 'NORMAL' | 'DEFENSIVE'
}

export function bearResearch(input: BearResearchInput): string[] {
  const { analystReports, marketRegime } = input
  const bearCase: string[] = []

  // Collect all risks from analysts
  for (const report of analystReports) {
    if (report.bias === 'bearish') {
      bearCase.push(`[${report.agent}] ${report.summary}`)
    }
    for (const risk of report.risks) {
      bearCase.push(`[${report.agent}] ${risk}`)
    }
  }

  // Market regime penalty
  if (marketRegime === 'DEFENSIVE') {
    bearCase.push('[Market Context] Defensive market regime — higher probability of downside')
  }

  // Score-based arguments
  const techReport = analystReports.find((r) => r.agent === 'Technical Analyst')
  if (techReport && techReport.score < 50) {
    bearCase.push(`[Technical] Weak technical score ${techReport.score}/100 — avoid entry`)
  }

  const fundReport = analystReports.find((r) => r.agent === 'Fundamental Analyst')
  if (fundReport && fundReport.bias === 'bearish') {
    bearCase.push('[Fundamental] Fundamental concerns weigh on thesis')
  }

  // Remove duplicates
  const seen = new Set<string>()
  return bearCase.filter((item) => {
    if (seen.has(item)) return false
    seen.add(item)
    return true
  })
}
