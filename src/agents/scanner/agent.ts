/**
 * Scanner agent implementation
 * Analyzes technical setups and classifies them
 */

import type { AISettings } from '@/lib/types'
import type { MarketData, IndicatorSet, ScannerResult } from '@/pipeline/types'
import { callAIProvider } from '@/lib/ai-provider'
import { SCANNER_SYSTEM_PROMPT, buildScannerUserPrompt } from './prompt'

/**
 * Run scanner agent
 */
export async function runScannerAgent(
  marketData: MarketData,
  indicators: IndicatorSet,
  settings: AISettings
): Promise<ScannerResult> {
  try {
    const userPrompt = buildScannerUserPrompt(marketData, indicators)

    const response = await callAIProvider({
      system: SCANNER_SYSTEM_PROMPT,
      user: userPrompt,
      settings,
    })

    return parseScannerResponse(response.text, marketData, indicators)
  } catch (error) {
    console.error('Scanner agent error:', error)
    // Return fallback result on error
    return createFallbackScannerResult(marketData, indicators)
  }
}

/**
 * Parse scanner response from AI
 */
function parseScannerResponse(
  response: string,
  marketData: MarketData,
  indicators: IndicatorSet
): ScannerResult {
  // Default values
  let setupType: ScannerResult['setupType'] = 'no_setup'
  let setupScore = 50
  let confidence: ScannerResult['confidence'] = 'MEDIUM'
  let status: ScannerResult['status'] = 'WATCHLIST'
  const keyReads: string[] = []
  const warnings: string[] = []
  let actionPlan = 'Monitor for confirmation'

  // Parse response (simple parsing - in production, use more robust parsing)
  const lines = response.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Parse setup type
    if (trimmed.toLowerCase().includes('setup type')) {
      const type = trimmed.toLowerCase().split(':').pop()?.trim()
      if (type?.includes('breakout')) setupType = 'breakout'
      else if (type?.includes('pullback')) setupType = 'pullback'
      else if (type?.includes('reversal')) setupType = 'reversal'
      else if (type?.includes('distribution')) setupType = 'distribution'
      else if (type?.includes('fake')) setupType = 'fake'
    }

    // Parse setup score
    const scoreMatch = trimmed.match(/setup score[:\s]*(\d+)/i)
    if (scoreMatch) {
      setupScore = parseInt(scoreMatch[1], 10)
    }

    // Parse confidence
    if (trimmed.toLowerCase().includes('confidence')) {
      if (trimmed.toLowerCase().includes('high')) confidence = 'HIGH'
      else if (trimmed.toLowerCase().includes('low')) confidence = 'LOW'
      else confidence = 'MEDIUM'
    }

    // Parse status
    if (trimmed.toLowerCase().includes('status')) {
      if (trimmed.toLowerCase().includes('valid')) status = 'VALID'
      else if (trimmed.toLowerCase().includes('reject')) status = 'REJECT'
      else status = 'WATCHLIST'
    }

    // Parse key reads
    if (trimmed.toLowerCase().includes('key read') || trimmed.toLowerCase().includes('key reads')) {
      // Next lines are key reads until we hit another section
      const keyReadsStart = lines.indexOf(line)
      for (let i = keyReadsStart + 1; i < lines.length; i++) {
        const nextLine = lines[i].trim()
        if (nextLine === '' || nextLine.match(/^[A-Z]+:/)) break
        if (nextLine.startsWith('-') || nextLine.startsWith('•')) {
          keyReads.push(nextLine.replace(/^[-•]\s*/, ''))
        }
      }
    }

    // Parse warnings
    if (trimmed.toLowerCase().includes('warning')) {
      const warningsStart = lines.indexOf(line)
      for (let i = warningsStart + 1; i < lines.length; i++) {
        const nextLine = lines[i].trim()
        if (nextLine === '' || nextLine.match(/^[A-Z]+:/)) break
        if (nextLine.startsWith('-') || nextLine.startsWith('•')) {
          warnings.push(nextLine.replace(/^[-•]\s*/, ''))
        }
      }
    }

    // Parse action plan
    if (trimmed.toLowerCase().includes('action plan')) {
      const actionPlanStart = lines.indexOf(line)
      for (let i = actionPlanStart + 1; i < Math.min(actionPlanStart + 3, lines.length); i++) {
        const nextLine = lines[i].trim()
        if (nextLine !== '') {
          actionPlan = nextLine
          break
        }
      }
    }
  }

  // Ensure we have at least some key reads
  if (keyReads.length === 0) {
    keyReads.push(
      `Trend: ${indicators.trend}`,
      `Volume: ${indicators.volumeRatio.toFixed(2)}x average`,
      `RSI: ${indicators.rsi.toFixed(1)}`
    )
  }

  return {
    setupType,
    setupScore,
    confidence,
    status,
    keyReads,
    warnings,
    actionPlan,
    reasoning: response,
  }
}

/**
 * Create fallback scanner result when AI fails
 */
function createFallbackScannerResult(
  marketData: MarketData,
  indicators: IndicatorSet
): ScannerResult {
  let setupType: ScannerResult['setupType'] = 'no_setup'
  let setupScore = 50
  let confidence: ScannerResult['confidence'] = 'MEDIUM'
  let status: ScannerResult['status'] = 'WATCHLIST'

  // Determine setup type based on indicators
  if (indicators.trend === 'bullish' && indicators.volumeRatio > 1.5) {
    setupType = 'breakout'
    setupScore = 70
    confidence = 'HIGH'
    status = 'VALID'
  } else if (indicators.trend === 'bullish' && indicators.rsi >= 40 && indicators.rsi <= 60) {
    setupType = 'pullback'
    setupScore = 60
    confidence = 'MEDIUM'
    status = 'VALID'
  } else if (indicators.trend === 'bearish' && indicators.rsi < 30) {
    setupType = 'reversal'
    setupScore = 55
    confidence = 'MEDIUM'
    status = 'WATCHLIST'
  }

  return {
    setupType,
    setupScore,
    confidence,
    status,
    keyReads: [
      `Trend: ${indicators.trend}`,
      `Volume: ${indicators.volumeRatio.toFixed(2)}x average`,
      `RSI: ${indicators.rsi.toFixed(1)}`,
      `Price vs EMA20: ${marketData.currentPrice > indicators.ema20 ? 'Above' : 'Below'}`,
    ],
    warnings: [],
    actionPlan: 'Monitor for confirmation',
    reasoning: 'AI analysis unavailable - using heuristic fallback',
  }
}