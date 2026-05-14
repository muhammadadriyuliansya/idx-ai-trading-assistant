/**
 * Inline backtest endpoint.
 *
 * GET /api/backtest?ticker=BBRI&minScore=65&maxHold=10
 *
 * Flow:
 *   1. Ambil bars dari cache (via quote endpoint internals) atau fetch fresh
 *   2. Replay scanner logic → collect signals
 *   3. Simulate outcome di next bars → compute WR/expectancy/etc
 *   4. Cache hasil 6 jam per ticker (bars berubah harian, WR-nya stabil)
 *
 * Response: BacktestResult dari lib/backtest.ts
 */

import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { backtestScanner, type BacktestResult } from "@/lib/backtest";
import type { Bar } from "@/lib/indicators";
import { createLogger } from "@/lib/logger";
import { cached, peek } from "@/lib/server-cache";

const logger = createLogger("api:backtest");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const BACKTEST_TTL_MS = 6 * 60 * 60 * 1000; // 6h — WR gak berubah drastis harian
const BACKTEST_STALE_MS = 24 * 60 * 60 * 1000;
const BARS_TTL_MS = 2 * 60 * 1000;
const BARS_STALE_MS = 30 * 60 * 1000;

interface ChartBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function normaliseTicker(input: string): string {
  const t = input.trim().toUpperCase();
  if (!t) return "";
  return t.includes(".") ? t : `${t}.JK`;
}

function isValidTicker(ticker: string): boolean {
  return /^[A-Z]{4}(?:\.JK)?$/.test(ticker);
}

async function fetchBars(symbol: string, days = 365): Promise<Bar[]> {
  return cached(
    `bt:bars:${symbol}:${days}`,
    { ttlMs: BARS_TTL_MS, staleMs: BARS_STALE_MS },
    async () => {
      const period2 = new Date();
      const period1 = new Date(period2.getTime() - days * 86400000);
      const result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: "1d",
      });
      const quotes = (result?.quotes ?? []) as ChartBar[];
      return quotes
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
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  const minScore = Number(url.searchParams.get("minScore") ?? 65);
  const maxHold = Number(url.searchParams.get("maxHold") ?? 10);
  const days = Number(url.searchParams.get("days") ?? 365);

  const symbol = normaliseTicker(ticker);
  if (!symbol) {
    return NextResponse.json({ error: "Parameter ticker kosong" }, { status: 400 });
  }
  const tickerClean = symbol.replace(".JK", "");
  if (!isValidTicker(tickerClean)) {
    return NextResponse.json({ error: "Format ticker salah" }, { status: 400 });
  }

  try {
    const cacheKey = `bt:result:${symbol}:${minScore}:${maxHold}:${days}`;
    const result = await cached<BacktestResult>(
      cacheKey,
      { ttlMs: BACKTEST_TTL_MS, staleMs: BACKTEST_STALE_MS },
      async () => {
        const bars = await fetchBars(symbol, days);
        if (bars.length < 220) {
          throw new Error(
            `Data tidak cukup (${bars.length} bar, butuh >=220). Ticker mungkin IPO baru atau delisted.`,
          );
        }
        return backtestScanner(tickerClean, bars, {
          minSetupScore: minScore,
          maxBarsHold: maxHold,
        });
      },
    );

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Backtest failed for ${symbol}: ${message}`);

    // Try stale
    const stale = peek<BacktestResult>(
      `bt:result:${symbol}:${minScore}:${maxHold}:${days}`,
      true,
    );
    if (stale) {
      return NextResponse.json(stale, {
        headers: {
          "Cache-Control": "no-store",
          "X-Data-Warning": "Served from stale cache",
        },
      });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
