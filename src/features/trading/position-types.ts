/**
 * Tipe data untuk Position Tracker & Trade Journal.
 *
 * Position = trade yang lagi OPEN, belum di-close. Gue track live P&L,
 * R-multiple berjalan, dan suggested trail stop.
 *
 * Trade = hasil close dari Position (atau entry manual). Gue simpan alasan
 * entry + alasan exit supaya journal bisa hitung expectancy per-reason.
 */

import type { FeeConfig } from "@/lib/fees";

export type EntryReason =
  | "SCANNER_VALID"
  | "SCANNER_WATCHLIST"
  | "BREAKOUT_CONFIRMED"
  | "PULLBACK_TO_SUPPORT"
  | "NEWS_CATALYST"
  | "REVERSAL_OVERSOLD"
  | "MANUAL_DISCRETIONARY"
  | "OTHER";

export type ExitReason =
  | "HIT_TP1"
  | "HIT_TP2"
  | "HIT_STOP"
  | "TRAIL_STOP"
  | "TIME_STOP"
  | "MANUAL_CUT"
  | "MANUAL_TAKE_PROFIT"
  | "OTHER";

export interface OpenPosition {
  id: string;
  ticker: string;
  /** 'JK' symbol tanpa suffix, mis. "BBRI". */
  symbol: string;
  mode: "swing" | "day" | "scalp";
  openedAt: number;
  entryPrice: number;
  shares: number;
  lots: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  /** Risk per share dibekukan saat entry — jangan dihitung ulang dari TP/SL baru. */
  riskPerShareAtEntry: number;
  entryReason: EntryReason;
  /** Free-form note user saat open. */
  notes?: string;
  /** Fee config yang dipakai saat entry — dibekukan juga supaya journal konsisten. */
  feeConfig: FeeConfig;
  /** Trailing stop yang user aktifkan manually (optional). */
  trailStop?: number;
  /** Cached last price + fetch time — supaya UI gak spam quote endpoint. */
  lastKnownPrice?: number;
  lastPriceAt?: number;
}

export interface ClosedTrade {
  id: string;
  ticker: string;
  symbol: string;
  mode: "swing" | "day" | "scalp";
  openedAt: number;
  closedAt: number;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  lots: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskPerShareAtEntry: number;
  entryReason: EntryReason;
  exitReason: ExitReason;
  entryNotes?: string;
  exitNotes?: string;
  /** P&L net setelah fee, dalam IDR. */
  netPnl: number;
  grossPnl: number;
  totalFees: number;
  /** P&L sebagai R-multiple (netPnl / (riskPerShare * shares)). */
  rMultiple: number;
  /** P&L sebagai persen dari nilai entry. */
  netPct: number;
  feeConfig: FeeConfig;
}

export interface JournalQueryResult {
  reason: EntryReason;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRMultiple: number;
  totalR: number;
  expectancyR: number;
  totalNetPnl: number;
}

/**
 * Default fee config disimpan di settings AI storage — supaya user bisa
 * tweak kalau broker-nya beda. Expose di tab Pengaturan sekali, terus
 * dipake di seluruh app.
 */
export interface TradingPersona {
  /** Capital default yang di-inject ke scanner/analysis form. */
  defaultCapital: number;
  /** Risk per trade default (persen). */
  defaultRiskPct: number;
  /** Mode yang paling sering dipakai user. */
  defaultMode: "swing" | "day" | "scalp";
  fees: FeeConfig;
}

export const DEFAULT_TRADING_PERSONA: TradingPersona = {
  defaultCapital: 1_500_000, // 1.5jt — modal user
  defaultRiskPct: 0.5,
  defaultMode: "day",
  fees: {
    buyFeePct: 0.15,
    sellFeePct: 0.25,
    levyPct: 0.04,
    sellTaxPct: 0.10,
    vatOnFeePct: 11,
  },
};
