// src/app/api/news/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'No ticker' }, { status: 400 });

  // Cari nama perusahaan juga biar hasil berita lebih relevan
  const queries = [ticker, `${ticker} saham`, `${ticker} BEI`];
  const allNews: NewsItem[] = [];

  for (const q of queries) {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
    
    try {
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const xml = await res.text();
      const items = parseRSS(xml).slice(0, 5); // 5 per query
      allNews.push(...items);
    } catch (e) {
      console.error('RSS fetch error:', e);
    }
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = allNews.filter(n => {
    if (seen.has(n.title)) return false;
    seen.add(n.title);
    return true;
  });

  return NextResponse.json({ news: unique.slice(0, 10) });
}

interface NewsItem {
  title: string;
  source: string;
  date: string;
  url: string;
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = strip(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const link  = strip(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
    const pubDate = strip(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '');
    const source = strip(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? 'Unknown');

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