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
import { cached, peek } from "@/lib/server-cache";

const logger = createLogger("api:quote");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

// ---------------------------------------------------------------------------
// TTLs (tuned for IDX trading hours + Yahoo rate limits)
// ---------------------------------------------------------------------------
const BARS_TTL_MS = 2 * 60 * 1000;           // 2 min fresh
const BARS_STALE_MS = 10 * 60 * 1000;        // 10 min stale window
const FUNDAMENTAL_TTL_MS = 6 * 60 * 60 * 1000; // 6h fresh (rarely changes)
const FUNDAMENTAL_STALE_MS = 24 * 60 * 60 * 1000; // 24h stale
const IHSG_TTL_MS = 60 * 1000;               // 60s fresh — IHSG moves slowly during scan
const IHSG_STALE_MS = 5 * 60 * 1000;         // 5m stale

// ---------------------------------------------------------------------------
// Per-IP rate limiting (burst-friendly for scanner workloads)
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 1000;

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

// ---------------------------------------------------------------------------
// Fetch primitives (each wrapped in cached())
// ---------------------------------------------------------------------------
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

function normaliseTicker(input: string): string {
  const t = input.trim().toUpperCase();
  if (!t) return "";
  if (t.includes(".")) return t;
  return `${t}.JK`;
}

function isValidTicker(ticker: string): boolean {
  return /^[A-Z]{4}(?:\.JK)?$/.test(ticker);
}

function fmt(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(digits);
}

function rawNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>).raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

async function fetchBarsRaw(symbol: string, days = 260): Promise<Bar[]> {
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

function getBars(symbol: string): Promise<Bar[]> {
  return cached(
    `bars:${symbol}`,
    { ttlMs: BARS_TTL_MS, staleMs: BARS_STALE_MS },
    () => fetchBarsRaw(symbol),
  );
}

interface FundamentalData {
  per: number | null;
  pbv: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  roe: number | null;
  der: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  eps: number | null;
}

async function fetchFundamentalRaw(
  tickerClean: string,
): Promise<FundamentalData | null> {
  const symbol = normaliseTicker(tickerClean);
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ["summaryDetail", "defaultKeyStatistics", "financialData"],
  });
  if (!result) return null;

  return {
    per:
      rawNumber(result.summaryDetail?.trailingPE) ??
      rawNumber(result.defaultKeyStatistics?.trailingPE),
    pbv:
      rawNumber(result.defaultKeyStatistics?.priceToBook) ??
      rawNumber(result.summaryDetail?.priceToBook),
    dividendYield: rawNumber(result.summaryDetail?.dividendYield),
    marketCap:
      rawNumber(result.summaryDetail?.marketCap) ??
      rawNumber(result.price?.marketCap),
    roe: rawNumber(result.financialData?.returnOnEquity),
    der: rawNumber(result.financialData?.debtToEquity),
    revenueGrowth: rawNumber(result.financialData?.revenueGrowth),
    earningsGrowth: rawNumber(result.financialData?.earningsGrowth),
    eps: rawNumber(result.defaultKeyStatistics?.trailingEps),
  };
}

function getFundamental(tickerClean: string): Promise<FundamentalData | null> {
  return cached(
    `fundamental:${tickerClean}`,
    { ttlMs: FUNDAMENTAL_TTL_MS, staleMs: FUNDAMENTAL_STALE_MS },
    () => fetchFundamentalRaw(tickerClean),
  );
}

interface IhsgSnapshot {
  trend: "bullish" | "sideways" | "bearish" | "unknown";
  change1d?: number;
  change5d?: number;
  label: string;
}

function classifyIhsgFromBars(bars: Bar[]): IhsgSnapshot {
  if (bars.length < 50) return { trend: "unknown", label: "" };
  const closes = bars.map((b) => b.close);
  const last = closes.length - 1;
  const trend = classifyTrend(closes);
  const change1d = (closes[last] / closes[last - 1] - 1) * 100;
  const change5d =
    last >= 5 ? (closes[last] / closes[last - 5] - 1) * 100 : undefined;
  const label =
    change5d !== undefined
      ? `${trend} (5d ${change5d >= 0 ? "+" : ""}${change5d.toFixed(2)}%)`
      : trend;
  return { trend, change1d, change5d, label };
}

export function getIhsgSnapshot(): Promise<IhsgSnapshot> {
  return cached(
    "ihsg:snapshot",
    { ttlMs: IHSG_TTL_MS, staleMs: IHSG_STALE_MS },
    async () => {
      try {
        const bars = await fetchBarsRaw("^JKSE");
        return classifyIhsgFromBars(bars);
      } catch (err) {
        logger.warn("IHSG fetch failed, returning unknown", {
          error: err instanceof Error ? err.message : String(err),
        });
        return { trend: "unknown" as const, label: "" };
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Build response (scanner + full modes share core bars computation)
// ---------------------------------------------------------------------------
type QuoteFields = "full" | "bars";

interface BuildParams {
  symbol: string;
  tickerClean: string;
  bars: Bar[];
  ihsg: IhsgSnapshot | null;
  fundamental: FundamentalData | null;
  source: "live" | "cache";
}

function buildQuoteResult({
  symbol,
  tickerClean,
  bars,
  ihsg,
  fundamental,
  source,
}: BuildParams): QuoteResult {
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

  const volRatio = avgVol20 > 0 ? lastBar.volume / avgVol20 : 0;

  return {
    ticker: symbol,
    fetchedAt: Date.now(),
    scanner: {
      ticker: tickerClean,
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
      ihsgTrend: ihsg?.label ?? "",
      resistance: fmt(sr.resistance, 0),
      support: fmt(sr.support, 0),
    },
    risk: {
      ticker: tickerClean,
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
      ihsgTrend: ihsg?.trend ?? "unknown",
      ihsgChange1d: ihsg?.change1d,
      ihsgChange5d: ihsg?.change5d,
      volRatio,
      source,
    },
    fundamental,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickerParam = url.searchParams.get("ticker") ?? "";
  const fieldsParam = (url.searchParams.get("fields") ?? "full").toLowerCase();
  const fields: QuoteFields = fieldsParam === "bars" ? "bars" : "full";

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

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in 1 minute." },
      { status: 429 },
    );
  }

  logger.info(`Fetching quote ${symbol} fields=${fields}`);

  try {
    // "bars" mode: skip IHSG + fundamental entirely (scanner path).
    // "full" mode: fetch everything in parallel — each call is cached/deduped.
    const [bars, ihsg, fundamental] = await Promise.all([
      getBars(symbol),
      fields === "full"
        ? getIhsgSnapshot().catch(() => null)
        : Promise.resolve<IhsgSnapshot | null>(null),
      fields === "full"
        ? getFundamental(tickerClean).catch(() => null)
        : Promise.resolve<FundamentalData | null>(null),
    ]);

    if (bars.length < 60) {
      return NextResponse.json(
        {
          error: `Not enough data for ${symbol} (got ${bars.length} bars). Verify the ticker is listed on IDX.`,
        },
        { status: 404 },
      );
    }

    const result = buildQuoteResult({
      symbol,
      tickerClean,
      bars,
      ihsg,
      fundamental,
      source: "live",
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to fetch quote for ${symbol}`, { error: message });

    // Last-resort: try stale bars
    const staleBars = peek<Bar[]>(`bars:${symbol}`, true);
    if (staleBars && staleBars.length >= 60) {
      const staleIhsg =
        fields === "full" ? peek<IhsgSnapshot>("ihsg:snapshot", true) : null;
      const staleFund =
        fields === "full"
          ? peek<FundamentalData>(`fundamental:${tickerClean}`, true)
          : null;
      const staleResult = buildQuoteResult({
        symbol,
        tickerClean,
        bars: staleBars,
        ihsg: staleIhsg,
        fundamental: staleFund,
        source: "cache",
      });
      return NextResponse.json(staleResult, {
        headers: {
          "Cache-Control": "no-store",
          "X-Data-Warning": "Yahoo Finance failed; served stale cache",
        },
      });
    }

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
