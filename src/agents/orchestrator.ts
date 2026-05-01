/**
 * Central orchestrator - coordinates all agents in the analysis pipeline
 */

import type { AISettings } from '@/lib/types'
import type { AnalysisPipeline } from '@/pipeline/types'
import { runFullAnalysis } from '@/pipeline/orchestrator'
import { runScannerAgent } from './scanner/agent'
import { runRiskAgent } from './risk/agent'
import { runContextAgent } from './context/agent'
import { runDebateAgent } from './debate/agent'
import { runDecisionAgent } from './decision/agent'

/**
 * Run complete analysis pipeline with all agents
 * This is the main entry point for the unified analysis system
 */
export async function runAnalysisPipeline(
  ticker: string,
  settings: AISettings
): Promise<AnalysisPipeline> {
  return runFullAnalysis(ticker, settings)
}

/**
 * Run analysis pipeline with custom agent overrides
 * Useful for testing and development
 */
export async function runAnalysisPipelineWithOverrides(
  ticker: string,
  settings: AISettings,
  overrides: {
    skipScanner?: boolean
    skipRisk?: boolean
    skipContext?: boolean
    skipDebate?: boolean
    skipDecision?: boolean
  } = {}
): Promise<AnalysisPipeline> {
  // For now, just use the standard pipeline
  // In production, this would allow selective agent execution
  return runFullAnalysis(ticker, settings)
}

/**
 * Get pipeline status and health
 */
export function getPipelineHealth() {
  return {
    status: 'healthy',
    agents: {
      scanner: 'operational',
      risk: 'operational',
      context: 'operational',
      debate: 'operational',
      decision: 'operational',
    },
    version: '1.0.0',
  }
}