/**
 * News Analyst — deterministic assessment dari berita dan sentimen
 */
import type { AnalystReport, NewsIntelligence, SocialSentiment } from '@/pipeline/types'

export interface NewsAnalystInput {
  news: NewsIntelligence | null
  sentiment: SocialSentiment | null
}

export function analyzeNews(input: NewsAnalystInput): AnalystReport {
  const { news, sentiment } = input
  const signals: string[] = []
  const risks: string[] = []
  let score = 50 // default neutral
  let bullishCount = 0
  let bearishCount = 0

  if (!news && !sentiment) {
    return {
      agent: 'News Analyst',
      bias: 'neutral',
      confidence: 15,
      score: 50,
      summary: 'Tidak ada data berita atau sentimen yang tersedia.',
      signals: [],
      risks: ['No news or sentiment data available'],
    }
  }

  // --- NEWS SENTIMENT (max 40 pts) ---
  if (news) {
    const sentScore = news.sentimentScore

    if (sentScore > 0.3) {
      score += 20
      bullishCount++
      signals.push(`News sentiment strongly positive (${sentScore.toFixed(2)})`)
    } else if (sentScore > 0.1) {
      score += 12
      bullishCount++
      signals.push(`News sentiment moderately positive (${sentScore.toFixed(2)})`)
    } else if (sentScore < -0.3) {
      score -= 20
      bearishCount++
      risks.push(`News sentiment strongly negative (${sentScore.toFixed(2)})`)
    } else if (sentScore < -0.1) {
      score -= 12
      bearishCount++
      risks.push(`News sentiment moderately negative (${sentScore.toFixed(2)})`)
    } else {
      signals.push(`News sentiment neutral (${sentScore.toFixed(2)})`)
    }

    if (news.totalArticles > 0) {
      signals.push(`${news.totalArticles} recent articles found`)
      if (news.dominantSentiment === 'positive') bullishCount++
      else if (news.dominantSentiment === 'negative') bearishCount++
    }

    // Key topics
    if (news.keyTopics.length > 0) {
      signals.push(`Key topics: ${news.keyTopics.join(', ')}`)
    }

    // Source diversity
    if (news.sources.length >= 3) {
      signals.push(`Good source diversity (${news.sources.length} sources)`)
    }
  }

  // --- SOCIAL SENTIMENT (max 30 pts) ---
  if (sentiment) {
    const sScore = sentiment.score

    if (sScore > 0.3) {
      score += 15
      bullishCount++
      signals.push(`Social sentiment rising (${sScore.toFixed(2)}, momentum: ${sentiment.momentum})`)
    } else if (sScore > 0.1) {
      score += 8
      signals.push(`Social sentiment slightly positive (${sScore.toFixed(2)})`)
    } else if (sScore < -0.3) {
      score -= 15
      bearishCount++
      risks.push(`Social sentiment falling (${sScore.toFixed(2)}, momentum: ${sentiment.momentum})`)
    } else if (sScore < -0.1) {
      score -= 8
      bearishCount++
      risks.push(`Social sentiment slightly negative (${sScore.toFixed(2)})`)
    }

    if (sentiment.topKeywords.length > 0) {
      signals.push(`Top keywords: ${sentiment.topKeywords.join(', ')}`)
    }

    if (sentiment.momentum === 'rising') {
      bullishCount++
      signals.push('Sentiment momentum is rising')
    } else if (sentiment.momentum === 'falling') {
      bearishCount++
      risks.push('Sentiment momentum is falling')
    }
  }

  // Normalize
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)))

  let bias: AnalystReport['bias'] = 'neutral'
  if (bullishCount > bearishCount + 1) bias = 'bullish'
  else if (bearishCount > bullishCount + 1) bias = 'bearish'
  else if (bullishCount > bearishCount) bias = 'bullish'

  const confidence = Math.min(75, Math.max(15, normalizedScore))
  const summary = `News/sentiment score ${normalizedScore}/100. ${bullishCount} positive, ${bearishCount} negative signals. Bias: ${bias}.`

  return {
    agent: 'News Analyst',
    bias,
    confidence,
    score: normalizedScore,
    summary,
    signals,
    risks,
  }
}
