/**
 * Position Tracker: store + helper untuk trade yang lagi OPEN dan yang udah CLOSED.
 *
 * Storage disimpan di localStorage (key di bawah). Semua mutasi lewat
 * function yang return state baru — React komponen tinggal useLocalStorage
 * untuk sync.
 */

import { computeTradePnl } from "@/lib/fees";
import type {
  ClosedTrade,
  EntryReason,
  ExitReason,
  JournalQueryResult,
  OpenPosition,
} from "./position-types";

export const POSITION_STORAGE_KEYS = {
  openPositions: "idxai.positions.open",
  closedTrades: "idxai.positions.closed",
  persona: "idxai.persona",
  telegramConfig: "idxai.telegram.config",
} as const;

// ---------------------------------------------------------------------------
// Open positions
// ---------------------------------------------------------------------------

export function openPosition(
  existing: OpenPosition[],
  next: Omit<OpenPosition, "id">,
): OpenPosition[] {
  const id = `${next.symbol}-${next.openedAt}-${Math.random().toString(36).slice(2, 8)}`;
  return [...existing, { ...next, id }];
}

export function updatePosition(
  existing: OpenPosition[],
  id: string,
  patch: Partial<OpenPosition>,
): OpenPosition[] {
  return existing.map((pos) => (pos.id === id ? { ...pos, ...patch } : pos));
}

export function removePosition(
  existing: OpenPosition[],
  id: string,
): OpenPosition[] {
  return existing.filter((pos) => pos.id !== id);
}

/**
 * Tutup posisi dengan harga exit. Return [sisa positions, ClosedTrade].
 * Kalau id gak ketemu, balikin [existing, null].
 */
export function closePosition(
  openPositions: OpenPosition[],
  id: string,
  params: {
    exitPrice: number;
    exitReason: ExitReason;
    exitNotes?: string;
    closedAt?: number;
  },
): { remaining: OpenPosition[]; closed: ClosedTrade | null } {
  const pos = openPositions.find((p) => p.id === id);
  if (!pos) return { remaining: openPositions, closed: null };

  const pnl = computeTradePnl(
    {
      shares: pos.shares,
      entryPrice: pos.entryPrice,
      exitPrice: params.exitPrice,
      fees: pos.feeConfig,
    },
    pos.riskPerShareAtEntry,
  );

  const closed: ClosedTrade = {
    id: pos.id,
    ticker: pos.ticker,
    symbol: pos.symbol,
    mode: pos.mode,
    openedAt: pos.openedAt,
    closedAt: params.closedAt ?? Date.now(),
    entryPrice: pos.entryPrice,
    exitPrice: params.exitPrice,
    shares: pos.shares,
    lots: pos.lots,
    stopLoss: pos.stopLoss,
    takeProfit1: pos.takeProfit1,
    takeProfit2: pos.takeProfit2,
    riskPerShareAtEntry: pos.riskPerShareAtEntry,
    entryReason: pos.entryReason,
    exitReason: params.exitReason,
    entryNotes: pos.notes,
    exitNotes: params.exitNotes,
    netPnl: pnl.netPnl,
    grossPnl: pnl.grossPnl,
    totalFees: pnl.totalFees,
    rMultiple: pnl.rMultiple ?? 0,
    netPct: pnl.netPct,
    feeConfig: pos.feeConfig,
  };

  return {
    remaining: openPositions.filter((p) => p.id !== id),
    closed,
  };
}

// ---------------------------------------------------------------------------
// Live P&L
// ---------------------------------------------------------------------------

export interface LivePositionSnapshot {
  position: OpenPosition;
  currentPrice: number;
  unrealizedGrossPnl: number;
  unrealizedNetPnl: number;
  rMultiple: number | null;
  /** Persen dari nilai entry, setelah fee estimasi. */
  netPct: number;
  /** Jarak ke stop dalam persen (negatif = jauh di atas stop). */
  pctToStop: number;
  /** Jarak ke TP1 dalam persen. */
  pctToTp1: number;
  /** Suggested trail stop berdasarkan progress menuju TP. */
  suggestedTrailStop: number;
  status: "OPEN" | "NEAR_STOP" | "NEAR_TP1" | "BEYOND_TP1" | "BEYOND_TP2";
}

/**
 * Hitung snapshot live dari posisi + harga saat ini.
 * Trail stop sederhana: kalau harga udah >=50% menuju TP1, trail ke breakeven.
 * Kalau udah >TP1, trail ke TP1. Kalau udah >TP2, trail ke TP2 minus 1 ATR
 * (tapi kita gak punya ATR di OpenPosition, jadi pake TP2 * 0.995).
 */
export function computeLiveSnapshot(
  position: OpenPosition,
  currentPrice: number,
): LivePositionSnapshot {
  const pnl = computeTradePnl(
    {
      shares: position.shares,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      fees: position.feeConfig,
    },
    position.riskPerShareAtEntry,
  );

  const entryValue = position.entryPrice * position.shares;
  const distanceToStop = currentPrice - position.stopLoss;
  const distanceToTp1 = position.takeProfit1 - currentPrice;
  const pctToStop = entryValue > 0 ? (distanceToStop / position.entryPrice) * 100 : 0;
  const pctToTp1 = entryValue > 0 ? (distanceToTp1 / position.entryPrice) * 100 : 0;

  const progressToTp1 =
    position.takeProfit1 > position.entryPrice
      ? (currentPrice - position.entryPrice) / (position.takeProfit1 - position.entryPrice)
      : 0;

  let suggestedTrailStop = position.stopLoss;
  let status: LivePositionSnapshot["status"] = "OPEN";

  if (currentPrice >= position.takeProfit2) {
    suggestedTrailStop = position.takeProfit2 * 0.995;
    status = "BEYOND_TP2";
  } else if (currentPrice >= position.takeProfit1) {
    suggestedTrailStop = position.takeProfit1;
    status = "BEYOND_TP1";
  } else if (progressToTp1 >= 0.5) {
    // Break-even + 0.1% supaya gak kena whipsaw
    suggestedTrailStop = Math.max(position.entryPrice * 1.001, position.stopLoss);
    status = "NEAR_TP1";
  } else if (currentPrice <= position.stopLoss * 1.005) {
    status = "NEAR_STOP";
  }

  // Honor trailStop manual kalau user udah pasang sendiri
  if (position.trailStop && position.trailStop > suggestedTrailStop) {
    suggestedTrailStop = position.trailStop;
  }

  return {
    position,
    currentPrice,
    unrealizedGrossPnl: pnl.grossPnl,
    unrealizedNetPnl: pnl.netPnl,
    rMultiple: pnl.rMultiple,
    netPct: pnl.netPct,
    pctToStop,
    pctToTp1,
    suggestedTrailStop,
    status,
  };
}

// ---------------------------------------------------------------------------
// Journal analytics (per entry reason)
// ---------------------------------------------------------------------------

export function queryJournalByReason(
  trades: ClosedTrade[],
): JournalQueryResult[] {
  const groups = new Map<EntryReason, ClosedTrade[]>();
  for (const trade of trades) {
    const bucket = groups.get(trade.entryReason) ?? [];
    bucket.push(trade);
    groups.set(trade.entryReason, bucket);
  }

  const results: JournalQueryResult[] = [];
  for (const [reason, bucket] of groups.entries()) {
    const wins = bucket.filter((t) => t.netPnl > 0).length;
    const losses = bucket.filter((t) => t.netPnl <= 0).length;
    const totalR = bucket.reduce((sum, t) => sum + t.rMultiple, 0);
    const totalNetPnl = bucket.reduce((sum, t) => sum + t.netPnl, 0);
    const winRate = bucket.length > 0 ? (wins / bucket.length) * 100 : 0;
    const avgRMultiple = bucket.length > 0 ? totalR / bucket.length : 0;

    // Expectancy R: (WR × avgWinR) - (LR × avgLossR)
    const winBucket = bucket.filter((t) => t.rMultiple > 0);
    const lossBucket = bucket.filter((t) => t.rMultiple <= 0);
    const avgWinR =
      winBucket.length > 0
        ? winBucket.reduce((s, t) => s + t.rMultiple, 0) / winBucket.length
        : 0;
    const avgLossR =
      lossBucket.length > 0
        ? Math.abs(lossBucket.reduce((s, t) => s + t.rMultiple, 0) / lossBucket.length)
        : 0;
    const expectancyR =
      (wins / Math.max(1, bucket.length)) * avgWinR -
      (losses / Math.max(1, bucket.length)) * avgLossR;

    results.push({
      reason,
      count: bucket.length,
      wins,
      losses,
      winRate,
      avgRMultiple,
      totalR,
      expectancyR,
      totalNetPnl,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

export const ENTRY_REASON_LABELS: Record<EntryReason, string> = {
  SCANNER_VALID: "Scanner VALID",
  SCANNER_WATCHLIST: "Scanner Watchlist",
  BREAKOUT_CONFIRMED: "Breakout Confirmed",
  PULLBACK_TO_SUPPORT: "Pullback ke Support",
  NEWS_CATALYST: "News Catalyst",
  REVERSAL_OVERSOLD: "Reversal Oversold",
  MANUAL_DISCRETIONARY: "Gut Feeling / Diskresi",
  OTHER: "Lain-lain",
};

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  HIT_TP1: "Kena TP1",
  HIT_TP2: "Kena TP2",
  HIT_STOP: "Kena Stop",
  TRAIL_STOP: "Trail Stop",
  TIME_STOP: "Time Stop",
  MANUAL_CUT: "Cut Manual",
  MANUAL_TAKE_PROFIT: "Take Profit Manual",
  OTHER: "Lain-lain",
};
