import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { cached } from '@/lib/server-cache';

const logger = createLogger('api:news');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEWS_TTL_MS = 10 * 60 * 1000;      // 10 min fresh
const NEWS_STALE_MS = 60 * 60 * 1000;    // 1 hour stale

interface NewsItem {
  title: string;
  source: string;
  date: string;
  url: string;
}

interface NewsResponse {
  news: NewsItem[];
  sentimentScore: number;
  totalArticles: number;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'Parameter ticker kosong' }, { status: 400 });

  try {
    const payload = await cached<NewsResponse>(
      `news:${ticker.toUpperCase()}`,
      { ttlMs: NEWS_TTL_MS, staleMs: NEWS_STALE_MS },
      () => fetchNews(ticker),
    );

    return NextResponse.json(payload, {
      headers: {
        // Let the browser cache too — news doesn't move fast.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      },
    });
  } catch (err) {
    logger.warn(`News fetch failed for ${ticker}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    // Soft-fail: return empty set so downstream pipeline still works
    return NextResponse.json(
      { news: [], sentimentScore: 0, totalArticles: 0 },
      { status: 200 },
    );
  }
}

async function fetchNews(ticker: string): Promise<NewsResponse> {
  logger.info(`Fetching news for ${ticker}`);

  // Trimmed from 4 to 2 queries — the extra variations mostly duplicated results
  // and burned RSS quota. ticker alone + "{ticker} saham" covers 95% of hits.
  const queries = [ticker, `${ticker} saham`];
  const sources = ['IDX Channel', 'Bisnis Indonesia', 'CNBC Indonesia', 'Kontan', 'Bloomberg'];

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const xml = await res.text();
      return parseRSS(xml, sources).slice(0, 6);
    }),
  );

  const allNews: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allNews.push(...r.value);
  }

  const seen = new Set<string>();
  const unique = allNews.filter((n) => {
    if (seen.has(n.title)) return false;
    seen.add(n.title);
    return true;
  });

  const top10 = unique.slice(0, 10);
  const sentimentScore = computeSentiment(top10.map((n) => n.title));

  logger.info(`News fetched for ${ticker}`, {
    articles: top10.length,
    sentiment: sentimentScore.toFixed(2),
  });

  return {
    news: top10,
    sentimentScore,
    totalArticles: top10.length,
  };
}

function parseRSS(xml: string, knownSources: string[]): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = strip(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const link = strip(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
    const pubDate = strip(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '');
    const rawSource = strip(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '');

    let source = 'Google News';
    if (rawSource) source = rawSource;
    else {
      const matched = knownSources.find(
        (s) => title.includes(s) || link.includes(s.toLowerCase().replace(/\s/g, '')),
      );
      if (matched) source = matched;
    }

    if (title) {
      items.push({
        title,
        url: link,
        source,
        date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : '',
      });
    }
  }
  return items;
}

function strip(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function computeSentiment(titles: string[]): number {
  const positive = ['naik', 'green', 'bullish', 'profit', 'terbang', 'positif', 'tumbuh', 'bangkit', 'kuat', 'optimis'];
  const negative = ['turun', 'red', 'bearish', 'rugi', 'jatuh', 'negatif', 'melemah', 'krisis', 'jual', 'panic', 'warning'];
  let score = 0;
  let count = 0;
  for (const t of titles) {
    const lower = t.toLowerCase();
    const pos = positive.filter((w) => lower.includes(w)).length;
    const neg = negative.filter((w) => lower.includes(w)).length;
    if (pos > 0 || neg > 0) {
      score += (pos - neg) / Math.max(pos + neg, 1);
      count++;
    }
  }
  return count > 0 ? score / count : 0;
}
