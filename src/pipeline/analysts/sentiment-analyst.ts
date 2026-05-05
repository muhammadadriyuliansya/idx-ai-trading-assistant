/**
 * Social Sentiment Analysis — deterministic lexicon-based
 * Menghitung sentimen dari headline berita sebagai proxy social sentiment
 */
import type { SocialSentiment } from '@/pipeline/types'

const POSITIVE_WORDS = [
  'naik', 'bullish', 'terbang', 'positif', 'tumbuh', 'bangkit', 'kuat', 'optimis',
  'rekor', 'surge', 'rally', 'gain', 'profit', 'green', 'outperform', 'upgrade',
  'buy', 'akuisisi', 'ekspansi', 'dividen', 'laba', 'cuan', 'membalik', 'memimpin',
  'melambung', 'menanjak', 'prospek', 'menguntungkan', 'favorit', 'rekomendasi',
]

const NEGATIVE_WORDS = [
  'turun', 'bearish', 'jatuh', 'negatif', 'melemah', 'krisis', 'jual', 'panic',
  'warning', 'loss', 'red', 'crash', 'decline', 'underperform', 'downgrade',
  'sell', 'restrukturisasi', 'phk', 'rugi', 'buntung', 'tertekan', 'anjlok',
  'pelemahan', 'menurun', 'masalah', 'sengketa', 'kontroversi', 'investigasi',
]

/**
 * Hitung social sentiment dari array teks (headline berita)
 */
export function computeSocialSentiment(texts: string[]): SocialSentiment {
  if (texts.length === 0) {
    return createEmptySentiment()
  }

  let totalPos = 0
  let totalNeg = 0
  let totalNeutral = 0
  let totalMentions = 0
  const keywordFreq: Record<string, number> = {}

  for (const text of texts) {
    const lower = text.toLowerCase()
    const words = lower.split(/\s+/)

    let posCount = 0
    let negCount = 0

    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '')
      if (cleanWord.length < 3) continue

      if (POSITIVE_WORDS.some((pw) => lower.includes(pw))) {
        posCount++
      }
      if (NEGATIVE_WORDS.some((nw) => lower.includes(nw))) {
        negCount++
      }
    }

    // Check phrases instead of single words for better accuracy
    for (const pw of POSITIVE_WORDS) {
      if (lower.includes(pw)) {
        posCount++
        const key = pw.split(' ')[0]
        keywordFreq[key] = (keywordFreq[key] ?? 0) + 1
      }
    }
    for (const nw of NEGATIVE_WORDS) {
      if (lower.includes(nw)) {
        negCount++
        const key = nw.split(' ')[0]
        keywordFreq[key] = (keywordFreq[key] ?? 0) + 1
      }
    }

    totalMentions++
    if (posCount > negCount) totalPos++
    else if (negCount > posCount) totalNeg++
    else totalNeutral++
  }

  const total = totalPos + totalNeg + totalNeutral
  const score = total > 0 ? (totalPos - totalNeg) / total : 0

  // Determine momentum
  const momentum: SocialSentiment['momentum'] =
    score > 0.2 ? 'rising' : score < -0.2 ? 'falling' : 'stable'

  // Top keywords
  const topKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)

  return {
    score: Math.round(score * 100) / 100,
    volume: totalMentions,
    momentum,
    mentions: totalMentions,
    positiveRatio: total > 0 ? Math.round((totalPos / total) * 100) / 100 : 0,
    negativeRatio: total > 0 ? Math.round((totalNeg / total) * 100) / 100 : 0,
    neutralRatio: total > 0 ? Math.round((totalNeutral / total) * 100) / 100 : 0,
    topKeywords,
  }
}

function createEmptySentiment(): SocialSentiment {
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
