"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalStorage } from "@/lib/storage";
import { STORAGE_KEYS } from "@/config/app";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { sendTelegramMessage } from "@/lib/telegram-client";
import { runMarketScan, getDefaultIDXTickers } from "@/pipeline/scanner";
import { computeLiveSnapshot } from "@/features/trading/positions";
import type { OpenPosition, ClosedTrade } from "@/features/trading/position-types";
import type { WatchlistItem } from "@/features/trading/types";
import type { ScanCandidate } from "@/pipeline/types";
import {
  buildDailyGuardSnapshot,
  evaluateRiskGovernor,
} from "@/lib/risk-governor";
import type { TradeJournalRecord } from "@/lib/risk-governor";

interface IhsgSnapshot {
  trend: "bullish" | "sideways" | "bearish" | "unknown";
  change1d?: number;
  change5d?: number;
  label?: string;
}

interface BriefQuote {
  [symbol: string]: number;
}

interface BriefState {
  ihsg: IhsgSnapshot | null;
  topSetups: ScanCandidate[];
  quotes: BriefQuote;
  loading: boolean;
  error: string | null;
  lastRefresh: number;
}

export function MorningBriefTab({
  onJumpToTicker,
}: {
  onJumpToTicker?: (ticker: string) => void;
}) {
  const [openPositions] = useLocalStorage<OpenPosition[]>(
    STORAGE_KEYS.openPositions,
    [],
  );
  const [closedTrades] = useLocalStorage<ClosedTrade[]>(
    STORAGE_KEYS.closedTrades,
    [],
  );
  const [watchlist] = useLocalStorage<WatchlistItem[]>(STORAGE_KEYS.watchlist, []);
  const [capitalStr] = useLocalStorage<string>(STORAGE_KEYS.lastCapital, "1500000");
  const capital = Number(capitalStr) || 0;
  const [sendingBrief, setSendingBrief] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [state, setState] = useState<BriefState>({
    ihsg: null,
    topSetups: [],
    quotes: {},
    loading: true,
    error: null,
    lastRefresh: 0,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // Parallel fetch: IHSG + scan + quote untuk open positions
      const [ihsgRes, scanResult, posQuotes] = await Promise.all([
        fetch("/api/ihsg")
          .then((r) => r.json())
          .catch(() => ({ trend: "unknown" as const })),
        runMarketScan({
          tickers: getDefaultIDXTickers(),
          mode: "day",
          minSetupScore: 55,
          maxResults: 5,
        }).catch(() => [] as ScanCandidate[]),
        Promise.all(
          openPositions.map(async (pos) => {
            try {
              const r = await fetch(
                `/api/quote?ticker=${encodeURIComponent(pos.symbol)}&fields=bars`,
              );
              if (!r.ok) return null;
              const d = (await r.json()) as { scanner?: { currentPrice?: string } };
              const price = Number(d.scanner?.currentPrice ?? NaN);
              if (!Number.isFinite(price)) return null;
              return { symbol: pos.symbol, price };
            } catch {
              return null;
            }
          }),
        ),
      ]);

      const quotes: BriefQuote = {};
      for (const q of posQuotes) {
        if (q) quotes[q.symbol] = q.price;
      }

      setState({
        ihsg: ihsgRes,
        topSetups: scanResult,
        quotes,
        loading: false,
        error: null,
        lastRefresh: Date.now(),
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [openPositions]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positionSnapshots = useMemo(
    () =>
      openPositions.map((pos) => {
        const price = state.quotes[pos.symbol] ?? pos.entryPrice;
        return computeLiveSnapshot(pos, price);
      }),
    [openPositions, state.quotes],
  );

  const unrealizedTotal = positionSnapshots.reduce(
    (s, snap) => s + snap.unrealizedNetPnl,
    0,
  );

  // Risk governor status
  const governor = useMemo(() => {
    const journalRecords: TradeJournalRecord[] = closedTrades.map((t) => ({
      date: t.closedAt,
      type: "BUY",
      pnl: t.netPnl,
      notes: t.exitNotes,
      ticker: t.symbol,
    }));
    const snapshot = buildDailyGuardSnapshot(journalRecords);
    return evaluateRiskGovernor({
      mode: "day",
      capital,
      requestedRiskPerTrade: 0.5,
      snapshot,
    });
  }, [closedTrades, capital]);

  // Watchlist hits: cross-ref watchlist vs top setups
  const watchlistHits = useMemo(() => {
    const setupMap = new Map(state.topSetups.map((c) => [c.ticker, c]));
    return watchlist
      .map((w) => ({ watch: w, match: setupMap.get(w.ticker) }))
      .filter((x) => x.match && x.match.status === "VALID")
      .slice(0, 5);
  }, [watchlist, state.topSetups]);

  const dayOfWeek = new Date().toLocaleDateString("id-ID", { weekday: "long" });
  const timeNow = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSendBrief = async () => {
    setSendingBrief(true);
    const ihsgLabel =
      state.ihsg?.change5d != null
        ? `${state.ihsg.trend} (5d ${state.ihsg.change5d >= 0 ? "+" : ""}${state.ihsg.change5d.toFixed(2)}%)`
        : state.ihsg?.trend ?? "unknown";
    const governorLine =
      governor.status === "OPEN"
        ? "🟢 Governor OPEN"
        : `🔴 Governor ${governor.status}: ${governor.noTradeReason ?? "—"}`;

    const openLines =
      positionSnapshots.length > 0
        ? positionSnapshots
            .map(
              (s) =>
                `  • ${s.position.symbol}: ${formatCurrency(s.unrealizedNetPnl)} (${s.rMultiple?.toFixed(2) ?? "—"}R) ${s.status}`,
            )
            .join("\n")
        : "  (gak ada posisi terbuka)";

    const setupLines =
      state.topSetups.length > 0
        ? state.topSetups
            .slice(0, 5)
            .map(
              (c) =>
                `  • ${c.ticker} ${c.status} (score ${c.setupScore}, RR ${c.rr.toFixed(2)}, vol ${c.volumeRatio.toFixed(1)}x)`,
            )
            .join("\n")
        : "  (tidak ada setup kuat)";

    const text = [
      `☀️ *MORNING BRIEF* — ${dayOfWeek} ${timeNow}`,
      ``,
      `*IHSG:* ${ihsgLabel}`,
      `*Governor:* ${governorLine}`,
      `*Modal:* ${formatCurrency(capital)} · Risk/trade: ${governor.effectiveRiskPerTrade.toFixed(2)}%`,
      ``,
      `*Open Positions (${openPositions.length})* — Unrealized ${formatCurrency(unrealizedTotal)}`,
      openLines,
      ``,
      `*Top Setup Pagi Ini*`,
      setupLines,
    ].join("\n");

    const result = await sendTelegramMessage(text);
    setSendingBrief(false);
    setFeedback(
      result.ok ? "Brief terkirim ke Telegram" : `Gagal: ${result.error}`,
    );
  };

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Sun className="h-6 w-6 text-amber-400" />
            Morning Brief
          </h2>
          <p className="text-sm text-zinc-400">
            {dayOfWeek}, {timeNow} — satu layar sebelum market buka.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={state.loading}
          >
            {state.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleSendBrief()}
            disabled={sendingBrief || state.loading}
          >
            {sendingBrief ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Kirim ke Telegram
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
          {feedback}
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {state.error}
        </div>
      )}

      {/* Row 1: IHSG + Governor */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
              <Activity className="h-3 w-3" />
              IHSG
            </div>
            {state.ihsg ? (
              <>
                <div
                  className={cn(
                    "font-mono text-lg font-semibold capitalize",
                    state.ihsg.trend === "bullish"
                      ? "text-emerald-400"
                      : state.ihsg.trend === "bearish"
                      ? "text-red-400"
                      : "text-zinc-200",
                  )}
                >
                  {state.ihsg.trend}
                </div>
                <div className="text-xs text-zinc-500">
                  {state.ihsg.change1d != null && (
                    <>1d {state.ihsg.change1d >= 0 ? "+" : ""}{state.ihsg.change1d.toFixed(2)}% · </>
                  )}
                  {state.ihsg.change5d != null && (
                    <>5d {state.ihsg.change5d >= 0 ? "+" : ""}{state.ihsg.change5d.toFixed(2)}%</>
                  )}
                </div>
              </>
            ) : (
              <div className="text-zinc-500">—</div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            governor.status === "OPEN"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : governor.status === "DAILY_STOP"
              ? "border-red-500/30 bg-red-500/5"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
              <Shield className="h-3 w-3" />
              Risk Governor
            </div>
            <div className="font-mono text-lg font-semibold">
              {governor.status.replace("_", " ")}
            </div>
            <div className="text-xs text-zinc-500">
              {governor.noTradeReason ??
                `Risk/trade ${governor.effectiveRiskPerTrade.toFixed(2)}% · Max ${governor.maxTrades} trades/day`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
              <DollarSign className="h-3 w-3" />
              Modal · Unrealized
            </div>
            <div className="font-mono text-lg font-semibold">
              {formatCurrency(capital)}
            </div>
            <div
              className={cn(
                "text-xs",
                unrealizedTotal >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {unrealizedTotal >= 0 ? "+" : ""}
              {formatCurrency(unrealizedTotal)} unrealized
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Open Positions */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="h-4 w-4" />
              Open Positions ({openPositions.length})
            </div>
          </div>
          {positionSnapshots.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-500">
              Belum ada posisi terbuka.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Ticker</th>
                    <th className="py-2 pr-3">Entry</th>
                    <th className="py-2 pr-3">Now</th>
                    <th className="py-2 pr-3">P&L Net</th>
                    <th className="py-2 pr-3">R</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {positionSnapshots.map((s) => (
                    <tr key={s.position.id} className="border-t border-zinc-900">
                      <td className="py-2 pr-3 font-mono font-semibold">
                        {s.position.symbol}
                      </td>
                      <td className="py-2 pr-3 font-mono text-zinc-400">
                        {formatNumber(s.position.entryPrice)}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        {formatNumber(s.currentPrice)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          s.unrealizedNetPnl >= 0
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {formatCurrency(s.unrealizedNetPnl)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          (s.rMultiple ?? 0) >= 0
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {s.rMultiple !== null ? `${s.rMultiple.toFixed(2)}R` : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          tone={
                            s.status === "NEAR_STOP"
                              ? "red"
                              : s.status === "BEYOND_TP2"
                              ? "violet"
                              : s.status.startsWith("BEYOND") ||
                                s.status === "NEAR_TP1"
                              ? "emerald"
                              : "neutral"
                          }
                        >
                          {s.status.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Watchlist Hits + Top Setups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Watchlist Hits ({watchlistHits.length})
            </div>
            <p className="text-[10px] text-zinc-500">
              Saham di watchlist lu yang pagi ini setup-nya VALID
            </p>
            {watchlistHits.length === 0 ? (
              <div className="py-3 text-center text-xs text-zinc-500">
                {watchlist.length === 0
                  ? "Watchlist kosong."
                  : "Gak ada watchlist yang hit pagi ini."}
              </div>
            ) : (
              <div className="space-y-2">
                {watchlistHits.map(({ watch, match }) =>
                  match ? (
                    <button
                      key={watch.ticker}
                      onClick={() => onJumpToTicker?.(watch.ticker)}
                      className="flex w-full items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs hover:border-emerald-500/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">
                          {watch.ticker}
                        </span>
                        <Badge tone="emerald">VALID {match.setupScore}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span>RR {match.rr.toFixed(2)}</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </div>
                    </button>
                  ) : null,
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              Top Setup Pagi ({state.topSetups.length})
            </div>
            <p className="text-[10px] text-zinc-500">
              Hasil scan day-mode, score ≥ 55
            </p>
            {state.topSetups.length === 0 ? (
              <div className="py-3 text-center text-xs text-zinc-500">
                {state.loading
                  ? "Loading..."
                  : "Gak ada setup kuat pagi ini — market mungkin lagi risk-off."}
              </div>
            ) : (
              <div className="space-y-1.5">
                {state.topSetups.slice(0, 5).map((c) => (
                  <button
                    key={c.ticker}
                    onClick={() => onJumpToTicker?.(c.ticker)}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{c.ticker}</span>
                      <Badge
                        tone={
                          c.status === "VALID"
                            ? "emerald"
                            : c.status === "WATCHLIST"
                            ? "amber"
                            : "neutral"
                        }
                      >
                        {c.status} {c.setupScore}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" /> {c.rr.toFixed(2)}
                      </span>
                      <span>{c.volumeRatio.toFixed(1)}x</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {state.lastRefresh > 0 && (
        <div className="text-right text-[10px] text-zinc-600">
          Last refresh: {new Date(state.lastRefresh).toLocaleTimeString("id-ID")}
        </div>
      )}
    </div>
  );
}
