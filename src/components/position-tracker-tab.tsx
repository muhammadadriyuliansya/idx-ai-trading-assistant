"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalStorage } from "@/lib/storage";
import { STORAGE_KEYS } from "@/config/app";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  sendTelegramMessage,
  formatPositionAlert,
  formatTradeClosed,
} from "@/lib/telegram-client";
import {
  closePosition as closePositionFn,
  computeLiveSnapshot,
  openPosition as openPositionFn,
  queryJournalByReason,
  removePosition,
  updatePosition,
  ENTRY_REASON_LABELS,
  EXIT_REASON_LABELS,
} from "@/features/trading/positions";
import type {
  ClosedTrade,
  EntryReason,
  ExitReason,
  OpenPosition,
  TradingPersona,
} from "@/features/trading/position-types";
import { DEFAULT_TRADING_PERSONA } from "@/features/trading/position-types";
import { DEFAULT_FEE_CONFIG } from "@/lib/fees";

interface QuoteMap {
  [symbol: string]: {
    price: number;
    fetchedAt: number;
  };
}

interface EntryFormState {
  ticker: string;
  entry: string;
  shares: string;
  stopLoss: string;
  takeProfit1: string;
  takeProfit2: string;
  entryReason: EntryReason;
  notes: string;
  mode: "swing" | "day" | "scalp";
}

const EMPTY_ENTRY_FORM: EntryFormState = {
  ticker: "",
  entry: "",
  shares: "",
  stopLoss: "",
  takeProfit1: "",
  takeProfit2: "",
  entryReason: "SCANNER_VALID",
  notes: "",
  mode: "day",
};

export function PositionTrackerTab() {
  const [openPositions, setOpenPositions] = useLocalStorage<OpenPosition[]>(
    STORAGE_KEYS.openPositions,
    [],
  );
  const [closedTrades, setClosedTrades] = useLocalStorage<ClosedTrade[]>(
    STORAGE_KEYS.closedTrades,
    [],
  );
  const [persona] = useLocalStorage<TradingPersona>(
    STORAGE_KEYS.persona,
    DEFAULT_TRADING_PERSONA,
  );

  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [refreshing, setRefreshing] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryFormState>(EMPTY_ENTRY_FORM);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState<{
    exitPrice: string;
    exitReason: ExitReason;
    exitNotes: string;
  }>({ exitPrice: "", exitReason: "HIT_TP1", exitNotes: "" });
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Auto-fetch quotes for all open positions
  const refreshQuotes = useCallback(async () => {
    if (openPositions.length === 0) return;
    setRefreshing(true);
    try {
      const results = await Promise.all(
        openPositions.map(async (pos) => {
          try {
            const res = await fetch(
              `/api/quote?ticker=${encodeURIComponent(pos.symbol)}&fields=bars`,
            );
            if (!res.ok) return null;
            const data = (await res.json()) as {
              scanner?: { currentPrice?: string };
            };
            const price = Number(data.scanner?.currentPrice ?? NaN);
            if (!Number.isFinite(price) || price <= 0) return null;
            return { symbol: pos.symbol, price };
          } catch {
            return null;
          }
        }),
      );
      setQuotes((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.symbol] = { price: r.price, fetchedAt: Date.now() };
        }
        return next;
      });
    } finally {
      setRefreshing(false);
    }
  }, [openPositions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshQuotes();
    // Auto-refresh tiap 60 detik — IDX gak butuh real-time tick
    const interval = setInterval(() => {
      void refreshQuotes();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshQuotes]);

  // Snapshot per position (harga live + R-multiple + trail)
  const snapshots = useMemo(
    () =>
      openPositions.map((pos) => {
        const quote = quotes[pos.symbol];
        const price = quote?.price ?? pos.lastKnownPrice ?? pos.entryPrice;
        return computeLiveSnapshot(pos, price);
      }),
    [openPositions, quotes],
  );

  // Aggregate stats
  const totals = useMemo(() => {
    const totalUnrealized = snapshots.reduce(
      (sum, s) => sum + s.unrealizedNetPnl,
      0,
    );
    const totalExposure = openPositions.reduce(
      (sum, p) => sum + p.entryPrice * p.shares,
      0,
    );
    const totalClosedNet = closedTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const todayKey = new Date().toLocaleDateString("id-ID");
    const todayClosed = closedTrades.filter(
      (t) => new Date(t.closedAt).toLocaleDateString("id-ID") === todayKey,
    );
    const todayNet = todayClosed.reduce((sum, t) => sum + t.netPnl, 0);
    const wins = closedTrades.filter((t) => t.netPnl > 0).length;
    const winRate =
      closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    return {
      totalUnrealized,
      totalExposure,
      totalClosedNet,
      todayNet,
      closedCount: closedTrades.length,
      wins,
      winRate,
      openCount: openPositions.length,
    };
  }, [snapshots, openPositions, closedTrades]);

  const journalByReason = useMemo(
    () => queryJournalByReason(closedTrades),
    [closedTrades],
  );

  // ---------- Handlers ----------

  const handleOpenTrade = () => {
    const ticker = entryForm.ticker.trim().toUpperCase().replace(".JK", "");
    const entryPrice = Number(entryForm.entry);
    const shares = Number(entryForm.shares);
    const stopLoss = Number(entryForm.stopLoss);
    const tp1 = Number(entryForm.takeProfit1);
    const tp2 =
      entryForm.takeProfit2.trim() === "" ? tp1 * 1.5 : Number(entryForm.takeProfit2);

    if (!ticker || !/^[A-Z]{4}$/.test(ticker)) {
      setFeedback("Ticker harus 4 huruf, contoh: BBRI");
      return;
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      setFeedback("Harga entry tidak valid");
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0 || shares % 100 !== 0) {
      setFeedback("Jumlah saham harus kelipatan 100 (1 lot = 100 shares)");
      return;
    }
    if (!Number.isFinite(stopLoss) || stopLoss <= 0 || stopLoss >= entryPrice) {
      setFeedback("Stop loss harus di bawah harga entry");
      return;
    }
    if (!Number.isFinite(tp1) || tp1 <= entryPrice) {
      setFeedback("Take profit 1 harus di atas harga entry");
      return;
    }

    const riskPerShare = entryPrice - stopLoss;

    setOpenPositions((prev) =>
      openPositionFn(prev, {
        ticker: `${ticker}.JK`,
        symbol: ticker,
        mode: entryForm.mode,
        openedAt: Date.now(),
        entryPrice,
        shares,
        lots: Math.floor(shares / 100),
        stopLoss,
        takeProfit1: tp1,
        takeProfit2: tp2,
        riskPerShareAtEntry: riskPerShare,
        entryReason: entryForm.entryReason,
        notes: entryForm.notes.trim() || undefined,
        feeConfig: persona.fees ?? DEFAULT_FEE_CONFIG,
      }),
    );
    setEntryForm(EMPTY_ENTRY_FORM);
    setShowEntryForm(false);
    setFeedback(`Posisi ${ticker} dibuka @ ${formatCurrency(entryPrice)}`);
  };

  const handleClose = (id: string) => {
    const pos = openPositions.find((p) => p.id === id);
    if (!pos) return;
    const exitPrice = Number(closeForm.exitPrice);
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
      setFeedback("Harga exit tidak valid");
      return;
    }
    const { remaining, closed } = closePositionFn(openPositions, id, {
      exitPrice,
      exitReason: closeForm.exitReason,
      exitNotes: closeForm.exitNotes.trim() || undefined,
    });
    if (closed) {
      setOpenPositions(remaining);
      setClosedTrades((prev) => [closed, ...prev]);
      setFeedback(
        `${pos.symbol} ditutup. Net ${formatCurrency(closed.netPnl)} (${closed.rMultiple.toFixed(2)}R)`,
      );
      // Auto-fire Telegram
      void sendTelegramMessage(
        formatTradeClosed({
          ticker: pos.symbol,
          netPnl: closed.netPnl,
          rMultiple: closed.rMultiple,
          netPct: closed.netPct,
          exitReason: EXIT_REASON_LABELS[closed.exitReason],
        }),
      );
    }
    setClosingId(null);
    setCloseForm({ exitPrice: "", exitReason: "HIT_TP1", exitNotes: "" });
  };

  const handleSendAlert = async (symbol: string) => {
    const idx = snapshots.findIndex((s) => s.position.symbol === symbol);
    if (idx === -1) return;
    const snap = snapshots[idx];
    setSendingAlertId(symbol);
    const result = await sendTelegramMessage(
      formatPositionAlert({
        ticker: symbol,
        status: snap.status,
        currentPrice: snap.currentPrice,
        entry: snap.position.entryPrice,
        unrealizedNetPnl: snap.unrealizedNetPnl,
        rMultiple: snap.rMultiple,
        suggestedTrail: snap.suggestedTrailStop,
        stopLoss: snap.position.stopLoss,
        tp1: snap.position.takeProfit1,
      }),
    );
    setSendingAlertId(null);
    setFeedback(
      result.ok ? `Alert ${symbol} terkirim` : `Gagal kirim: ${result.error}`,
    );
  };

  const handleApplyTrail = (id: string, trail: number) => {
    setOpenPositions((prev) =>
      updatePosition(prev, id, { trailStop: trail, stopLoss: trail }),
    );
    setFeedback("Trail stop diaplikasikan (stop loss di-update)");
  };

  const handleDelete = (id: string) => {
    setOpenPositions((prev) => removePosition(prev, id));
    setFeedback("Posisi dihapus dari list (tanpa record trade)");
  };

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header + add trade */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Posisi & Jurnal</h2>
          <p className="text-sm text-zinc-400">
            Posisi OPEN dengan P&L live, suggested trail stop, dan auto-journal saat close.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshQuotes()}
            disabled={refreshing || openPositions.length === 0}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowEntryForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            {showEntryForm ? "Tutup Form" : "Buka Posisi"}
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
          {feedback}
          <button
            onClick={() => setFeedback(null)}
            className="float-right text-blue-300 hover:text-blue-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Open Positions"
          value={String(totals.openCount)}
          sub={`Exposure ${formatCurrency(totals.totalExposure)}`}
        />
        <StatCard
          label="Unrealized P&L"
          value={formatCurrency(totals.totalUnrealized)}
          tone={totals.totalUnrealized >= 0 ? "emerald" : "red"}
        />
        <StatCard
          label="Today's Realized"
          value={formatCurrency(totals.todayNet)}
          tone={totals.todayNet >= 0 ? "emerald" : "red"}
        />
        <StatCard
          label="All-Time Win Rate"
          value={`${totals.winRate.toFixed(0)}%`}
          sub={`${totals.closedCount} trades`}
        />
      </div>

      {/* Entry form */}
      {showEntryForm && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4" />
              Buka Posisi Baru
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Ticker</Label>
                <Input
                  value={entryForm.ticker}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, ticker: e.target.value }))
                  }
                  placeholder="BBRI"
                  className="font-mono uppercase"
                  maxLength={4}
                />
              </div>
              <div>
                <Label>Mode</Label>
                <select
                  value={entryForm.mode}
                  onChange={(e) =>
                    setEntryForm((f) => ({
                      ...f,
                      mode: e.target.value as "swing" | "day" | "scalp",
                    }))
                  }
                  className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-sm"
                >
                  <option value="scalp">Scalp</option>
                  <option value="day">Day</option>
                  <option value="swing">Swing</option>
                </select>
              </div>
              <div>
                <Label>Alasan Entry</Label>
                <select
                  value={entryForm.entryReason}
                  onChange={(e) =>
                    setEntryForm((f) => ({
                      ...f,
                      entryReason: e.target.value as EntryReason,
                    }))
                  }
                  className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-sm"
                >
                  {(Object.keys(ENTRY_REASON_LABELS) as EntryReason[]).map((r) => (
                    <option key={r} value={r}>
                      {ENTRY_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Entry Price</Label>
                <Input
                  value={entryForm.entry}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, entry: e.target.value }))
                  }
                  placeholder="5000"
                  type="number"
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Shares (kelipatan 100)</Label>
                <Input
                  value={entryForm.shares}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, shares: e.target.value }))
                  }
                  placeholder="100"
                  type="number"
                  step="100"
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Stop Loss</Label>
                <Input
                  value={entryForm.stopLoss}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, stopLoss: e.target.value }))
                  }
                  placeholder="4950"
                  type="number"
                  className="font-mono"
                />
              </div>
              <div>
                <Label>TP1</Label>
                <Input
                  value={entryForm.takeProfit1}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, takeProfit1: e.target.value }))
                  }
                  placeholder="5050"
                  type="number"
                  className="font-mono"
                />
              </div>
              <div>
                <Label>TP2 (optional)</Label>
                <Input
                  value={entryForm.takeProfit2}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, takeProfit2: e.target.value }))
                  }
                  placeholder="5100"
                  type="number"
                  className="font-mono"
                />
              </div>
              <div className="md:col-span-3">
                <Label>Catatan (optional)</Label>
                <Input
                  value={entryForm.notes}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="mis. breakout konsolidasi 3 hari, volume 2x avg"
                />
              </div>
            </div>
            <Button variant="accent" onClick={handleOpenTrade}>
              <CheckCircle2 className="h-4 w-4" />
              Simpan Entry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Open positions */}
      {openPositions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-zinc-400">
            <Target className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
            Belum ada posisi terbuka. Klik <b>Buka Posisi</b> setelah lu execute entry
            di broker.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snap) => (
            <PositionCard
              key={snap.position.id}
              snap={snap}
              closing={closingId === snap.position.id}
              closeForm={closeForm}
              onStartClose={() => {
                setClosingId(snap.position.id);
                setCloseForm({
                  exitPrice: snap.currentPrice.toFixed(0),
                  exitReason:
                    snap.currentPrice >= snap.position.takeProfit2
                      ? "HIT_TP2"
                      : snap.currentPrice >= snap.position.takeProfit1
                      ? "HIT_TP1"
                      : snap.currentPrice <= snap.position.stopLoss
                      ? "HIT_STOP"
                      : "MANUAL_TAKE_PROFIT",
                  exitNotes: "",
                });
              }}
              onCancelClose={() => setClosingId(null)}
              onConfirmClose={() => handleClose(snap.position.id)}
              onChangeCloseForm={(patch) =>
                setCloseForm((f) => ({ ...f, ...patch }))
              }
              onApplyTrail={(trail) => handleApplyTrail(snap.position.id, trail)}
              onSendAlert={() => void handleSendAlert(snap.position.symbol)}
              sending={sendingAlertId === snap.position.symbol}
              onDelete={() => handleDelete(snap.position.id)}
            />
          ))}
        </div>
      )}

      {/* Journal summary */}
      {closedTrades.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4" />
              Jurnal per Alasan Entry
            </div>
            <p className="text-xs text-zinc-500">
              Mana alasan entry yang paling profitable untuk lo? Expectancy R = berapa R
              yang lu dapet per trade rata-rata.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Alasan</th>
                    <th className="py-2 pr-3">N</th>
                    <th className="py-2 pr-3">WR%</th>
                    <th className="py-2 pr-3">Avg R</th>
                    <th className="py-2 pr-3">Expectancy R</th>
                    <th className="py-2 pr-3">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {journalByReason.map((row) => (
                    <tr key={row.reason} className="border-t border-zinc-900">
                      <td className="py-2 pr-3 font-medium">
                        {ENTRY_REASON_LABELS[row.reason]}
                      </td>
                      <td className="py-2 pr-3 font-mono">{row.count}</td>
                      <td className="py-2 pr-3 font-mono">
                        {row.winRate.toFixed(0)}%
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          row.avgRMultiple >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {row.avgRMultiple.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          row.expectancyR >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {row.expectancyR.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          row.totalNetPnl >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {formatCurrency(row.totalNetPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent closed */}
      {closedTrades.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              Trade Terakhir ({Math.min(10, closedTrades.length)})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3">Ticker</th>
                    <th className="py-2 pr-3">Entry → Exit</th>
                    <th className="py-2 pr-3">Net P&L</th>
                    <th className="py-2 pr-3">R</th>
                    <th className="py-2 pr-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.slice(0, 10).map((t) => (
                    <tr key={t.id} className="border-t border-zinc-900">
                      <td className="py-2 pr-3 text-zinc-500">
                        {new Date(t.closedAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-2 pr-3 font-mono">{t.symbol}</td>
                      <td className="py-2 pr-3 font-mono text-zinc-400">
                        {formatNumber(t.entryPrice)} → {formatNumber(t.exitPrice)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          t.netPnl >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {formatCurrency(t.netPnl)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 font-mono",
                          t.rMultiple >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {t.rMultiple.toFixed(2)}R
                      </td>
                      <td className="py-2 pr-3 text-zinc-400">
                        {EXIT_REASON_LABELS[t.exitReason]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "red" | "neutral";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "red"
      ? "text-red-400"
      : "text-zinc-100";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </div>
        <div className={cn("mt-1 font-mono text-lg font-semibold", toneClass)}>
          {value}
        </div>
        {sub && <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>}
      </CardContent>
    </Card>
  );
}

interface PositionCardProps {
  snap: ReturnType<typeof computeLiveSnapshot>;
  closing: boolean;
  closeForm: { exitPrice: string; exitReason: ExitReason; exitNotes: string };
  onStartClose: () => void;
  onCancelClose: () => void;
  onConfirmClose: () => void;
  onChangeCloseForm: (patch: Partial<PositionCardProps["closeForm"]>) => void;
  onApplyTrail: (trail: number) => void;
  onSendAlert: () => void;
  sending: boolean;
  onDelete: () => void;
}

function PositionCard({
  snap,
  closing,
  closeForm,
  onStartClose,
  onCancelClose,
  onConfirmClose,
  onChangeCloseForm,
  onApplyTrail,
  onSendAlert,
  sending,
  onDelete,
}: PositionCardProps) {
  const { position: pos } = snap;
  const statusTone =
    snap.status === "NEAR_STOP"
      ? "red"
      : snap.status === "NEAR_TP1" || snap.status === "BEYOND_TP1"
      ? "emerald"
      : snap.status === "BEYOND_TP2"
      ? "violet"
      : "neutral";
  const pnlPositive = snap.unrealizedNetPnl >= 0;
  const StatusIcon =
    snap.status === "NEAR_STOP"
      ? AlertTriangle
      : pnlPositive
      ? TrendingUp
      : TrendingDown;

  return (
    <Card
      className={cn(
        snap.status === "NEAR_STOP" && "border-red-500/40",
        snap.status === "BEYOND_TP2" && "border-violet-500/40",
      )}
    >
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                {pos.symbol}
                <Badge tone={statusTone}>{snap.status.replace("_", " ")}</Badge>
                <Badge tone="neutral">{pos.mode.toUpperCase()}</Badge>
              </div>
              <div className="text-[10px] text-zinc-500">
                Dibuka {new Date(pos.openedAt).toLocaleString("id-ID")} —{" "}
                {ENTRY_REASON_LABELS[pos.entryReason]}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSendAlert}
              disabled={sending}
              title="Kirim status ke Telegram"
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Telegram
            </Button>
            {!closing ? (
              <>
                <Button variant="destructive" size="sm" onClick={onStartClose}>
                  Close
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  title="Hapus tanpa catat trade (kalau entry-nya salah input)"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Price row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MiniMetric
            label="Now"
            value={formatNumber(snap.currentPrice)}
            icon={<StatusIcon className="h-3 w-3" />}
          />
          <MiniMetric label="Entry" value={formatNumber(pos.entryPrice)} />
          <MiniMetric
            label="Stop"
            value={formatNumber(pos.stopLoss)}
            tone="red"
          />
          <MiniMetric
            label="TP1 / TP2"
            value={`${formatNumber(pos.takeProfit1)} / ${formatNumber(pos.takeProfit2)}`}
            tone="emerald"
          />
          <MiniMetric
            label="Unrealized Net"
            value={formatCurrency(snap.unrealizedNetPnl)}
            sub={
              snap.rMultiple !== null
                ? `${snap.rMultiple.toFixed(2)}R`
                : undefined
            }
            tone={pnlPositive ? "emerald" : "red"}
          />
        </div>

        {/* Trail suggestion */}
        {snap.suggestedTrailStop > pos.stopLoss && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <div>
              Trail stop saran:{" "}
              <span className="font-mono font-semibold text-emerald-300">
                {formatNumber(snap.suggestedTrailStop)}
              </span>{" "}
              (naikin stop dari {formatNumber(pos.stopLoss)} — lock profit kalau turun)
            </div>
            <Button
              variant="accent"
              size="sm"
              onClick={() => onApplyTrail(snap.suggestedTrailStop)}
            >
              Apply
            </Button>
          </div>
        )}

        {/* Close form */}
        {closing && (
          <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="text-xs font-semibold text-red-200">
              Tutup posisi {pos.symbol}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <Label>Harga Exit</Label>
                <Input
                  type="number"
                  value={closeForm.exitPrice}
                  onChange={(e) =>
                    onChangeCloseForm({ exitPrice: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Exit Reason</Label>
                <select
                  value={closeForm.exitReason}
                  onChange={(e) =>
                    onChangeCloseForm({
                      exitReason: e.target.value as ExitReason,
                    })
                  }
                  className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-sm"
                >
                  {(Object.keys(EXIT_REASON_LABELS) as ExitReason[]).map((r) => (
                    <option key={r} value={r}>
                      {EXIT_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Catatan Exit</Label>
                <Input
                  value={closeForm.exitNotes}
                  onChange={(e) =>
                    onChangeCloseForm({ exitNotes: e.target.value })
                  }
                  placeholder="(opsional)"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={onConfirmClose}>
                <CheckCircle2 className="h-3 w-3" />
                Confirm Close
              </Button>
              <Button variant="outline" size="sm" onClick={onCancelClose}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {pos.notes && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
            <span className="text-zinc-500">Note entry:</span> {pos.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "red" | "neutral";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "red"
      ? "text-red-400"
      : "text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-sm font-semibold", toneClass)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}
