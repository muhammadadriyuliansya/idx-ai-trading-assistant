import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import {
  Bar,
  atr,
  avgVolume,
  classifyTrend,
  describeMacd,
  describeStochastic,
  ema,
  macd,
  rollingVwap,
  rsi,
  swingLevels,
} from "@/lib/indicators";
import type { QuoteResult } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:quote");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

interface CacheEntry {
  data: QuoteResult;
  timestamp: number;
}

const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Simple rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 30; // max requests
const RATE_WINDOW_MS = 60 * 1000; // per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT) {
    return false;
  }
  
  entry.count++;
  return true;
}

function getCachedQuote(symbol: string): QuoteResult | null {
  const entry = quoteCache.get(symbol);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    quoteCache.delete(symbol);
    return null;
  }
  return entry.data;
}

function setCachedQuote(symbol: string, data: QuoteResult): void {
  quoteCache.set(symbol, { data, timestamp: Date.now() });
}

interface ChartBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toBars(rows: ChartBar[]): Bar[] {
  return rows
    .filter(
      (r) =>
        Number.isFinite(r.open) &&
        Number.isFinite(r.high) &&
        Number.isFinite(r.low) &&
        Number.isFinite(r.close) &&
        Number.isFinite(r.volume),
    )
    .map((r) => ({
      timestamp: r.date.getTime(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));
}

function fmt(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(digits);
}

function normaliseTicker(input: string): string {
  const t = input.trim().toUpperCase();
  if (!t) return "";
  if (t.includes(".")) return t;
  return `${t}.JK`;
}

function isValidTicker(ticker: string): boolean {
  const validTicker = /^[A-Z]{4}(?:\.JK)?$/;
  return validTicker.test(ticker);
}

async function fetchBars(symbol: string, days = 260): Promise<Bar[]> {
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: "1d",
  });
  const quotes = (result?.quotes ?? []) as ChartBar[];
  return toBars(quotes);
}

function rawNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>).raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

// Tambahan: fetch fundamental dari Yahoo Finance
async function fetchFundamental(ticker: string) {
  const symbol = normaliseTicker(ticker);
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ["summaryDetail", "defaultKeyStatistics", "financialData"],
  });
  if (!result) return null;

  return {
    per: rawNumber(result.summaryDetail?.trailingPE) ?? rawNumber(result.defaultKeyStatistics?.trailingPE),
    pbv: rawNumber(result.defaultKeyStatistics?.priceToBook) ?? rawNumber(result.summaryDetail?.priceToBook),
    dividendYield: rawNumber(result.summaryDetail?.dividendYield),
    marketCap: rawNumber(result.summaryDetail?.marketCap) ?? rawNumber(result.price?.marketCap),
    roe: rawNumber(result.financialData?.returnOnEquity),
    der: rawNumber(result.financialData?.debtToEquity),
    revenueGrowth: rawNumber(result.financialData?.revenueGrowth),
    earningsGrowth: rawNumber(result.financialData?.earningsGrowth),
    eps: rawNumber(result.defaultKeyStatistics?.trailingEps),
  };
}

function classifyIhsg(bars: Bar[]): {
  trend: "bullish" | "sideways" | "bearish" | "unknown";
  change1d?: number;
  change5d?: number;
} {
  if (bars.length < 50) return { trend: "unknown" };
  const closes = bars.map((b) => b.close);
  const last = closes.length - 1;
  const trend = classifyTrend(closes);
  const change1d = (closes[last] / closes[last - 1] - 1) * 100;
  const change5d =
    last >= 5 ? (closes[last] / closes[last - 5] - 1) * 100 : undefined;
  return { trend, change1d, change5d };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickerParam = url.searchParams.get("ticker") ?? "";
  const symbol = normaliseTicker(tickerParam);

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing ticker query parameter (e.g. ?ticker=BBRI)" },
      { status: 400 },
    );
  }

  const tickerClean = symbol.replace(".JK", "");
  if (!isValidTicker(tickerClean)) {
    return NextResponse.json(
      { error: "Invalid ticker format. Use 4 letters (e.g. BBRI, TLKM)" },
      { status: 400 },
    );
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in 1 minute." },
      { status: 429 },
    );
  }

  logger.info(`Fetching quote for ${symbol}`);

  try {
    // Paralel: fetch data harga, IHSG, dan fundamental
    const [bars, ihsgBars, fundamental] = await Promise.all([
      fetchBars(symbol),
      fetchBars("^JKSE").catch(() => [] as Bar[]),
      fetchFundamental(tickerClean).catch(() => null),
    ]);

    if (bars.length < 60) {
      return NextResponse.json(
        {
          error: `Not enough data for ${symbol} (got ${bars.length} bars). Verify the ticker is listed on IDX.`,
        },
        { status: 404 },
      );
    }

    const closes = bars.map((b) => b.close);
    const last = bars.length - 1;
    const lastBar = bars[last];

    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const ema200 = ema(closes, 200);
    const rsi14 = rsi(closes, 14);
    const m = macd(closes);
    const atr14 = atr(bars, 14);
    const vwapVal = rollingVwap(bars, 5);
    const avgVol20 = avgVolume(bars, 20);
    const sr = swingLevels(bars, 80, 3);
    const trend = classifyTrend(closes);
    const macdLabel = describeMacd(m.macd, m.signal, m.histogram);
    const stochLabel = describeStochastic(bars, 14, 3);

    const ihsg = classifyIhsg(ihsgBars);
    const ihsgTrendLabel =
      ihsg.trend === "unknown"
        ? ""
        : ihsg.change5d !== undefined
          ? `${ihsg.trend} (5d ${ihsg.change5d >= 0 ? "+" : ""}${ihsg.change5d.toFixed(2)}%)`
          : ihsg.trend;

    const volRatio = avgVol20 > 0 ? lastBar.volume / avgVol20 : 0;

    const result: QuoteResult = {
      ticker: symbol,
      fetchedAt: Date.now(),
      scanner: {
        ticker: symbol.replace(".JK", ""),
        currentPrice: fmt(lastBar.close, 0),
        open: fmt(lastBar.open, 0),
        high: fmt(lastBar.high, 0),
        low: fmt(lastBar.low, 0),
        previousClose: bars.length > 1 ? fmt(bars[last - 1].close, 0) : "",
        todayVolume: fmt(lastBar.volume, 0),
        avgVolume20d: fmt(avgVol20, 0),
        ema20: fmt(ema20[last], 0),
        ema50: fmt(ema50[last], 0),
        ema200: fmt(ema200[last], 0),
        vwap: fmt(vwapVal, 0),
        rsi: fmt(rsi14[last], 1),
        macd: macdLabel,
        stochastic: stochLabel,
        ihsgTrend: ihsgTrendLabel,
        resistance: fmt(sr.resistance, 0),
        support: fmt(sr.support, 0),
      },
      risk: {
        ticker: symbol.replace(".JK", ""),
        currentPrice: fmt(lastBar.close, 0),
        support: fmt(sr.support, 0),
        resistance: fmt(sr.resistance, 0),
        atr: fmt(atr14[last], 1),
      },
      meta: {
        barsCount: bars.length,
        lastBarDate: new Date(lastBar.timestamp).toISOString().slice(0, 10),
        trend,
        macdLabel,
        stochLabel,
        ihsgTrend: ihsg.trend,
        ihsgChange1d: ihsg.change1d,
        ihsgChange5d: ihsg.change5d,
        volRatio,
        source: "live",
      },
      fundamental, // tambahan fundamental
    };

    setCachedQuote(symbol, result);

    logger.info(`Quote fetched successfully for ${symbol}`, {
      bars: bars.length,
      trend,
      volRatio: volRatio.toFixed(2),
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error(`Failed to fetch quote for ${symbol}`, {
      error: err instanceof Error ? err.message : String(err),
    });

    const cached = getCachedQuote(symbol);
    if (cached) {
      return NextResponse.json(
        {
          ...cached,
          meta: {
            ...cached.meta,
            source: "cache",
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Data-Warning": "Yahoo Finance failed; served last cached quote",
          },
        },
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    const isNotFound = /not found|no data|404/i.test(message);
    return NextResponse.json(
      {
        error: isNotFound
          ? `Ticker ${symbol} tidak ditemukan di Yahoo Finance.`
          : `Gagal fetch ${symbol}: ${message}`,
      },
      { status: isNotFound ? 404 : 502 },
    );
  }
}
