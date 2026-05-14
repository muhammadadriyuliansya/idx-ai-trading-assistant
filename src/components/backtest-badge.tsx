"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BacktestResult } from "@/lib/backtest";

/**
 * Inline backtest badge — di-render di tiap ScanCandidate card dan di Analysis tab.
 *
 * Lazy-fetch saat mounted, cache di-memory (per-ticker Map) supaya gak
 * ngulangin fetch buat ticker yang sama. Server-side endpoint sendiri
 * cache 6 jam jadi hit cache biasanya cepat.
 *
 * Progressive disclosure: compact mode show "12 sig, 58% WR, +0.4R".
 * Click expand show best/worst trade.
 */

const cache = new Map<string, BacktestResult>();
const inflight = new Map<string, Promise<BacktestResult>>();

async function fetchBacktest(ticker: string): Promise<BacktestResult> {
  const key = ticker.replace(".JK", "");
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(`/api/backtest?ticker=${encodeURIComponent(key)}`);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as BacktestResult;
    cache.set(key, data);
    return data;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

interface BacktestBadgeProps {
  ticker: string;
  /** Compact = 1 line; detailed = 3 lines with best/worst. */
  variant?: "compact" | "detailed";
  className?: string;
}

export function BacktestBadge({
  ticker,
  variant = "compact",
  className,
}: BacktestBadgeProps) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer setState ke microtask supaya effect-nya bukan sync-setState.
    // Pattern ini match sama rest of codebase (settings-tab, analysis, etc).
    const handle = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      fetchBacktest(ticker)
        .then((r) => {
          if (!cancelled) {
            setResult(r);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [ticker]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] text-zinc-500",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        backtest…
      </div>
    );
  }

  if (error || !result) {
    return (
      <div
        className={cn(
          "text-[10px] text-zinc-600",
          className,
        )}
        title={error ?? "Backtest tidak tersedia"}
      >
        backtest N/A
      </div>
    );
  }

  if (result.trades === 0) {
    return (
      <div
        className={cn(
          "text-[10px] text-zinc-500",
          className,
        )}
        title={`No valid signals in ${result.windowDays}d window (threshold scoring tidak cukup historical fit)`}
      >
        Backtest: 0 sinyal/{result.windowDays}d
      </div>
    );
  }

  const tone =
    result.expectancyR >= 0.3
      ? "emerald"
      : result.expectancyR >= 0
      ? "blue"
      : "red";
  const TrendIcon = result.expectancyR >= 0 ? TrendingUp : TrendingDown;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-[10px]",
          className,
        )}
        title={
          `${result.trades} trades in ${result.windowDays} days\n` +
          `Win rate: ${result.winRate.toFixed(0)}%\n` +
          `Expectancy: ${result.expectancyR.toFixed(2)}R per trade\n` +
          `${result.lowSampleWarning ? "⚠️ Low sample size — take with grain of salt" : ""}`
        }
      >
        <Badge tone={tone}>
          <TrendIcon className="mr-1 h-3 w-3" />
          backtest
        </Badge>
        <span className="text-zinc-400">
          <span className="font-mono">{result.trades}</span>sig ·{" "}
          <span className="font-mono">{result.winRate.toFixed(0)}%</span>WR ·{" "}
          <span
            className={cn(
              "font-mono font-semibold",
              result.expectancyR >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {result.expectancyR >= 0 ? "+" : ""}
            {result.expectancyR.toFixed(2)}R
          </span>
        </span>
        {result.lowSampleWarning && (
          <span className="text-amber-500" title="Sample kecil (<10 trade)">
            ⚠
          </span>
        )}
      </div>
    );
  }

  // Detailed
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
          <TrendIcon className="h-3 w-3" />
          Backtest {result.windowDays}d
        </div>
        <Badge tone={tone}>
          {result.expectancyR >= 0 ? "+" : ""}
          {result.expectancyR.toFixed(2)}R expectancy
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Signals" value={String(result.totalSignals)} />
        <Metric
          label="Win Rate"
          value={`${result.winRate.toFixed(0)}%`}
          tone={result.winRate >= 50 ? "emerald" : "red"}
        />
        <Metric
          label="Avg R"
          value={`${result.avgRMultiple >= 0 ? "+" : ""}${result.avgRMultiple.toFixed(2)}`}
          tone={result.avgRMultiple >= 0 ? "emerald" : "red"}
        />
        <Metric label="Wins" value={String(result.wins)} />
        <Metric label="Losses" value={String(result.losses)} />
        <Metric label="Avg Hold" value={`${result.avgBarsHeld.toFixed(1)}b`} />
      </div>
      {result.lowSampleWarning && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-300">
          ⚠️ Sample kecil ({result.trades} trade) — angka ini belum statistically significant.
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "red";
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald-400" : tone === "red" ? "text-red-400" : "text-zinc-100";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-xs font-semibold", toneClass)}>
        {value}
      </div>
    </div>
  );
}
