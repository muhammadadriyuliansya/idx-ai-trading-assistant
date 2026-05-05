/**
 * Fetch news intelligence dari berbagai sumber berita Indonesia
 * Deterministic — menggunakan RSS dan pattern matching
 */
import type { NewsIntelligence, NewsSource } from '@/pipeline/types'

export interface RawNewsItem {
  title: string
  source: string
  date: string
  url: string
}

/**
 * Fetch dan proses berita untuk satu ticker
 * Menggunakan Google News RSS sebagai sumber utama
 */
export async function fetchNewsIntelligence(ticker: string): Promise<NewsIntelligence> {
  try {
    const queries = [ticker, `${ticker} saham`, `${ticker} BEI`, `${ticker} IDX`]
    const knownSources = ['IDX Channel', 'Bisnis Indonesia', 'CNBC Indonesia', 'Kontan', 'Bloomberg']
    const allNews: RawNewsItem[] = []

    for (const q of queries) {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`
      try {
        const res = await fetch(rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store',
        })
        const xml = await res.text()
        const items = parseRSS(xml, knownSources).slice(0, 5)
        allNews.push(...items)
      } catch {
        // silent — sumber ini optional
      }
    }

    // Dedup berdasarkan title
    const seen = new Set<string>()
    const unique = allNews.filter((n) => {
      if (seen.has(n.title)) return false
      seen.add(n.title)
      return true
    })

    const headlines = unique.slice(0, 10)
    const titles = headlines.map((n) => n.title)

    // Hitung sentiment dari headline
    const sentimentScore = computeSentiment(titles)
    const dominantSentiment = classifySentiment(sentimentScore)

    // Group by source
    const sourceMap = new Map<string, { count: number; scores: number[] }>()
    for (const item of headlines) {
      const itemScore = computeSingleSentiment(item.title)
      const existing = sourceMap.get(item.source) ?? { count: 0, scores: [] }
      existing.count++
      existing.scores.push(itemScore)
      sourceMap.set(item.source, existing)
    }

    const sources: NewsSource[] = Array.from(sourceMap.entries()).map(([name, data]) => ({
      name,
      articles: data.count,
      sentiment: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    }))

    // Extract key topics
    const keyTopics = extractKeyTopics(titles)

    return {
      sources,
      totalArticles: headlines.length,
      recentHeadlines: titles,
      dominantSentiment,
      sentimentScore,
      keyTopics,
    }
  } catch {
    return createEmptyNewsIntelligence()
  }
}

function parseRSS(xml: string, knownSources: string[]): RawNewsItem[] {
  const items: RawNewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = strip(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const link = strip(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '')
    const pubDate = strip(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '')
    const rawSource = strip(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '')

    let source = 'Google News'
    if (rawSource) source = rawSource
    else {
      const matched = knownSources.find((s) => title.includes(s) || link.includes(s.toLowerCase().replace(/\s/g, '')))
      if (matched) source = matched
    }

    if (title) {
      items.push({
        title,
        url: link,
        source,
        date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : '',
      })
    }
  }
  return items
}

function strip(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
}

/** Lexicon-based sentiment scoring */
const POSITIVE_WORDS = [
  'naik', 'bullish', 'terbang', 'positif', 'tumbuh', 'bangkit', 'kuat', 'optimis',
  'rekor', 'surge', 'rally', 'gain', 'profit', 'green', 'outperform', 'upgrade',
  'buy', 'akuisisi', 'ekspansi', 'dividen', 'laba', 'cuan', 'membalik', 'memimpin',
  'melambung', 'menanjak', 'prospek', 'menguntungkan',
]

const NEGATIVE_WORDS = [
  'turun', 'bearish', 'jatuh', 'negatif', 'melemah', 'krisis', 'jual', 'panic',
  'warning', 'loss', 'red', 'crash', 'decline', 'underperform', 'downgrade',
  'sell', 'restrukturisasi', 'phk', 'rugi', 'buntung', 'tertekan', 'an jlok',
  'pelemahan', 'menurun', 'masalah', 'sengketa',
]

function computeSingleSentiment(title: string): number {
  const lower = title.toLowerCase()
  let pos = 0
  let neg = 0
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) pos++
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) neg++
  }
  if (pos + neg === 0) return 0
  return (pos - neg) / (pos + neg)
}

function computeSentiment(titles: string[]): number {
  if (titles.length === 0) return 0
  const scores = titles.map(computeSingleSentiment)
  return scores.reduce((a, b) => a + b, 0) / titles.length
}

function classifySentiment(score: number): 'positive' | 'negative' | 'neutral' {
  if (score > 0.15) return 'positive'
  if (score < -0.15) return 'negative'
  return 'neutral'
}

function extractKeyTopics(titles: string[]): string[] {
  const topicKeywords: Record<string, string[]> = {
    'Laba/Earnings': ['laba', 'earnings', 'profit', 'cuan', 'revenue', 'pendapatan'],
    'Corporate Action': ['akuisisi', 'merger', 'spin-off', 'rights', 'dividen', 'stock split'],
    'Regulasi': ['regulasi', 'aturan', 'pemerintah', 'otoritas', 'ojk', 'bi'],
    'Foreign Flow': ['foreign', 'asing', 'capital outflow', 'capital inflow', 'net buy', 'net sell'],
    'Sectoral': ['sektor', 'bank', 'teknologi', 'energi', 'komoditas', 'properti', 'konsumer'],
    'Market Movement': ['rally', 'crash', 'rekor', 'jatuh', 'terbang', 'melambung', 'an jlok'],
  }

  const topicCounts: Record<string, number> = {}
  for (const title of titles) {
    const lower = title.toLowerCase()
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          topicCounts[topic] = (topicCounts[topic] ?? 0) + 1
          break
        }
      }
    }
  }

  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic)
    .slice(0, 4)
}

function createEmptyNewsIntelligence(): NewsIntelligence {
  return {
    sources: [],
    totalArticles: 0,
    recentHeadlines: [],
    dominantSentiment: 'neutral',
    sentimentScore: 0,
    keyTopics: [],
  }
}
