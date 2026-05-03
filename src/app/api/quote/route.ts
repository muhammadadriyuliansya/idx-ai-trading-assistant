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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

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

// Tambahan: fetch fundamental dari Yahoo Finance
async function fetchFundamental(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}.JK?modules=summaryDetail,defaultKeyStatistics,financialData`;
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.quoteSummary?.result?.[0];
  if (!result) return null;

  return {
    per: result.summaryDetail?.trailingPE?.raw ?? null,
    pbv: result.summaryDetail?.priceToBook?.raw ?? null,
    dividendYield: result.summaryDetail?.dividendYield?.raw ?? null,
    marketCap: result.summaryDetail?.marketCap?.raw ?? null,
    roe: result.financialData?.returnOnEquity?.raw ?? null,
    der: result.financialData?.debtToEquity?.raw ?? null,
    revenueGrowth: result.financialData?.revenueGrowth?.raw ?? null,
    earningsGrowth: result.financialData?.earningsGrowth?.raw ?? null,
    eps: result.defaultKeyStatistics?.trailingEps?.raw ?? null,
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

  try {
    const tickerClean = symbol.replace(".JK", "");

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
      },
      fundamental, // tambahan fundamental
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
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