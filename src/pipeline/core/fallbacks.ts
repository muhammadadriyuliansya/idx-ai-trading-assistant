import type { MacroContext, NewsIntelligence, SocialSentiment } from '@/pipeline/types'

export function createEmptySocialSentiment(): SocialSentiment {
  return {
    score: 0,
    volume: 0,
    momentum: 'stable',
    mentions: 0,
    positiveRatio: 0,
    negativeRatio: 0,
    neutralRatio: 1,
    topKeywords: [],
  }
}

export function createEmptyNewsIntelligence(): NewsIntelligence {
  return {
    sources: [],
    totalArticles: 0,
    recentHeadlines: [],
    dominantSentiment: 'neutral',
    sentimentScore: 0,
    keyTopics: [],
  }
}

export function createEmptyMacroContext(): MacroContext {
  return {
    volatilityState: 'normal',
    sectorMomentum: 'No data available',
    liquidityCondition: 'normal',
    globalCue: 'neutral',
    marketBreadth: 'No data available',
  }
}

export function deriveIhsgTrend(
  ihsgChange5d?: number,
  ihsgChange1d?: number,
): 'bullish' | 'sideways' | 'bearish' | 'unknown' {
  const change = ihsgChange5d ?? ihsgChange1d
  if (change == null || !Number.isFinite(change)) return 'unknown'
  if (change > 0) return 'bullish'
  if (change < -1) return 'bearish'
  return 'sideways'
}
