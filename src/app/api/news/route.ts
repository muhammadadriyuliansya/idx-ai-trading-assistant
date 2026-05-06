import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:news');

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'No ticker' }, { status: 400 });

  logger.info(`Fetching news for ${ticker}`);

  const queries = [ticker, `${ticker} saham`, `${ticker} BEI`, `${ticker} IDX`];
  const sources = ['IDX Channel', 'Bisnis Indonesia', 'CNBC Indonesia', 'Kontan', 'Bloomberg'];
  const allNews: NewsItem[] = [];

  // Google News RSS
  for (const q of queries) {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
    try {
      const res = await fetch(rssUrl, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        logger.warn(`RSS fetch failed for ${q}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRSS(xml, sources).slice(0, 5);
      allNews.push(...items);
    } catch (err) {
      logger.warn(`Failed to fetch RSS for ${q}`, { 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  }

  const seen = new Set<string>();
  const unique = allNews.filter(n => {
    if (seen.has(n.title)) return false;
    seen.add(n.title);
    return true;
  });

  const top10 = unique.slice(0, 10);

  // Compute sentiment
  const sentimentScore = computeSentiment(top10.map(n => n.title));

  logger.info(`News fetched for ${ticker}`, { articles: top10.length, sentiment: sentimentScore.toFixed(2) });

  return NextResponse.json({
    news: top10,
    sentimentScore,
    totalArticles: top10.length,
  });
}

interface NewsItem {
  title: string;
  source: string;
  date: string;
  url: string;
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
      const matched = knownSources.find(s => title.includes(s) || link.includes(s.toLowerCase().replace(/\s/g, '')));
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
    const pos = positive.filter(w => lower.includes(w)).length;
    const neg = negative.filter(w => lower.includes(w)).length;
    if (pos > 0 || neg > 0) {
      score += (pos - neg) / Math.max(pos + neg, 1);
      count++;
    }
  }
  return count > 0 ? score / count : 0;
}
