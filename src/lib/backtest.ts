/**
 * Inline backtest engine untuk validasi scanner di historical bars.
 *
 * Ide: ambil bars ticker, loop dari bar ke-200 sampe bar terakhir.
 * Di tiap bar, re-hitung scanner signal (same logic sebagai live scanner).
 * Kalau signal VALID: simulate entry di next-bar open, exit saat hit SL/TP.
 *
 * Return: WR, expectancy R, avg R, total signal, horizon avg — all net of fees.
 *
 * Cached by server supaya scan page gak recompute 40 ticker × 252 bar tiap kali.
 */

import type { Bar } from "@/lib/indicators";
import {
  atr,
  avgVolume,
  ema,
  macd,
  rollingVwap,
  rsi,
  swingLevels,
} from "@/lib/indicators";
import { DEFAULT_FEE_CONFIG, computeTradePnl } from "@/lib/fees";
import type { FeeConfig } from "@/lib/fees";

export interface BacktestSignal {
  barIndex: number;
  entryDate: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  setupScore: number;
  riskPerShare: number;
  volumeRatio: number;
}

export interface BacktestTrade {
  entryDate: number;
  entryPrice: number;
  exitDate: number;
  exitPrice: number;
  outcome: "TP" | "SL" | "TIMEOUT";
  barsHeld: number;
  netPnl: number;
  netPct: number;
  rMultiple: number;
}

export interface BacktestResult {
  symbol: string;
  totalSignals: number;
  trades: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  avgRMultiple: number;
  expectancyR: number;
  totalR: number;
  avgBarsHeld: number;
  bestTrade: BacktestTrade | null;
  worstTrade: BacktestTrade | null;
  /** Relative jitter — warn kalau sampel terlalu kecil. */
  lowSampleWarning: boolean;
  /** Window in days yang dibacktest. */
  windowDays: number;
}

export interface BacktestOptions {
  /** Min setup score di historical bar untuk dianggap signal. Default 65. */
  minSetupScore?: number;
  /** Max bars hold kalau gak hit TP/SL. Default 10 (day-mode). */
  maxBarsHold?: number;
  /** Fee config. Default IDX retail ~0.6%. */
  fees?: FeeConfig;
  /** Batasi sampai N signal terakhir kalau lu cuma mau window recent. Default semua. */
  maxSignals?: number;
  /** Minimum volume ratio untuk dianggap signal. Default 1.2x. */
  minVolumeRatio?: number;
}

const DEFAULT_OPTIONS: Required<BacktestOptions> = {
  minSetupScore: 55,
  maxBarsHold: 10,
  fees: DEFAULT_FEE_CONFIG,
  maxSignals: Infinity,
  minVolumeRatio: 0.8,
};

/**
 * Compute setup score dari bar lookback window — mirror scoring logic
 * di `pipeline/scanner.ts#calculateSetupScoreFromData`, tapi di titik
 * historis bukan titik sekarang.
 *
 * Simplified: gak ada IHSG context (terlalu mahal di backtest), fokus
 * trend + momentum + volume + setup quality. Konsisten dengan scanner live
 * kalau kita samain weight-nya.
 */
function computeHistoricalScore(
  barIdx: number,
  bars: Bar[],
  ema20Arr: number[],
  ema50Arr: number[],
  ema200Arr: number[],
  rsi14Arr: number[],
  vwapAt: number,
  avgVol20: number,
  macdLabel: string,
  support: number,
  resistance: number,
): { score: number; rr: number; volumeRatio: number } {
  const bar = bars[barIdx];
  const price = bar.close;

  let trend = 0;
  if (price > ema20Arr[barIdx]) trend += 8;
  if (ema20Arr[barIdx] > ema50Arr[barIdx]) trend += 8;
  if (ema50Arr[barIdx] > ema200Arr[barIdx]) trend += 5;
  if (price > vwapAt) trend += 3;

  const isGreen = price > bar.open;
  const isNearHigh = price >= bar.high * 0.92;
  const isGapUp = barIdx > 0 && bar.open > bars[barIdx - 1].close;
  const isGapHold = isGapUp && isGreen;
  if (isGreen) trend += 3;
  if (isNearHigh && isGreen) trend += 3;
  if (isGapHold) trend += 3;
  trend = Math.min(30, trend);

  // Momentum
  let mom = 0;
  const r = rsi14Arr[barIdx];
  if (Number.isFinite(r)) {
    if (r >= 55 && r <= 70) mom += 10;
    else if (r >= 50 && r < 55) mom += 7;
    else if (r > 70 && r <= 80) mom += 5;
    else if (r >= 45 && r < 50) mom += 4;
  }
  const dayRange = bar.high - bar.low;
  const rangePos = dayRange > 0 ? (price - bar.low) / dayRange : 0.5;
  if (rangePos >= 0.6) mom += 3;
  if (macdLabel.includes("bull")) mom += 5;
  else if (macdLabel.includes("netral")) mom += 2;
  mom = Math.min(20, mom);

  // Volume
  const volRatio = avgVol20 > 0 ? bar.volume / avgVol20 : 0;
  let vol = 0;
  if (volRatio >= 2.5 && isGreen) vol += 20;
  else if (volRatio >= 2) vol += 16;
  else if (volRatio >= 1.2 && isGreen) vol += 14;
  else if (volRatio >= 1.2) vol += 11;
  else if (volRatio >= 0.5) vol += 8;
  else vol += 2;
  vol = Math.min(20, vol);

  // Context (simplified — gak ada IHSG di backtest)
  let ctx = 0;
  const shortTrend =
    price > ema20Arr[barIdx] && ema20Arr[barIdx] > ema50Arr[barIdx]
      ? "bullish"
      : price < ema20Arr[barIdx] && ema20Arr[barIdx] < ema50Arr[barIdx]
      ? "bearish"
      : "sideways";
  if (shortTrend === "bullish") ctx += 6;
  else if (shortTrend === "sideways") ctx += 3;
  if (isGapHold) ctx += 5;
  else if (isGapUp && !isGreen) ctx += 2;
  if (rangePos >= 0.5) ctx += 3;
  ctx = Math.min(20, ctx);

  // RR
  const riskPerShare = Math.max(1, price - support);
  const rewardPerShare = Math.max(0, resistance - price);
  const rr = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  let rrQ = 0;
  if (rr >= 3) rrQ = 10;
  else if (rr >= 2) rrQ = 8;
  else if (rr >= 1.5) rrQ = 6;
  else if (rr >= 1.2) rrQ = 4;
  else rrQ = 2;

  return { score: trend + mom + vol + ctx + rrQ, rr, volumeRatio: volRatio };
}

/**
 * Cari semua signal historis di bars + simulate outcome di bar berikutnya.
 */
export function backtestScanner(
  symbol: string,
  bars: Bar[],
  options: BacktestOptions = {},
): BacktestResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const empty: BacktestResult = {
    symbol,
    totalSignals: 0,
    trades: 0,
    wins: 0,
    losses: 0,
    timeouts: 0,
    winRate: 0,
    avgRMultiple: 0,
    expectancyR: 0,
    totalR: 0,
    avgBarsHeld: 0,
    bestTrade: null,
    worstTrade: null,
    lowSampleWarning: true,
    windowDays: 0,
  };

  // Butuh minimal 220 bars (200 untuk EMA200 warmup + 20 buffer)
  if (bars.length < 220) return empty;

  // Pre-compute indicator arrays sekali
  const closes = bars.map((b) => b.close);
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);
  const rsi14Arr = rsi(closes, 14);
  const macdResult = macd(closes);
  const atrArr = atr(bars, 14);
  const avgVol20 = avgVolume(bars, 20);

  // Helper: kategorikan MACD di index tertentu (cheap string match)
  const macdLabelAt = (i: number): string => {
    if (i < 1) return "n/a";
    const histNow = macdResult.histogram[i];
    const histPrev = macdResult.histogram[i - 1];
    const macdNow = macdResult.macd[i];
    const sigNow = macdResult.signal[i];
    if (histPrev <= 0 && histNow > 0) return "bullish cross";
    if (histPrev >= 0 && histNow < 0) return "bearish cross";
    if (macdNow > sigNow && histNow > 0) return "bullish above signal";
    if (macdNow < sigNow && histNow < 0) return "bearish below signal";
    return "netral";
  };

  const signals: BacktestSignal[] = [];

  // Window awal: mulai dari bar 200 (EMA200 baru valid)
  for (let i = 200; i < bars.length - 1; i++) {
    // Window swing levels — pake 80 bar lookback, konsisten dengan live scanner
    const lookback = bars.slice(Math.max(0, i - 80), i + 1);
    const sr = swingLevels(lookback, 80, 3);
    if (!Number.isFinite(sr.support) || !Number.isFinite(sr.resistance)) continue;
    if (sr.resistance <= sr.support) continue;

    const vwapAt = rollingVwap(bars.slice(Math.max(0, i - 4), i + 1), 5);
    const macdLabel = macdLabelAt(i);

    const { score, rr, volumeRatio } = computeHistoricalScore(
      i,
      bars,
      ema20Arr,
      ema50Arr,
      ema200Arr,
      rsi14Arr,
      vwapAt,
      avgVol20,
      macdLabel,
      sr.support,
      sr.resistance,
    );

    if (score < opts.minSetupScore) continue;
    if (volumeRatio < opts.minVolumeRatio) continue;
    if (rr < 1.2) continue;

    const entryPrice = bars[i + 1].open; // Entry di next-bar open (realistic)
    const atrValue = atrArr[i] ?? (bars[i].high - bars[i].low);
    const stopBuffer = Math.max(atrValue * 0.5, entryPrice * 0.005);
    const stopLoss = Math.max(sr.support - stopBuffer, entryPrice * 0.9);
    if (stopLoss >= entryPrice) continue;

    const riskPerShare = entryPrice - stopLoss;
    const takeProfit = entryPrice + riskPerShare * 2; // Target 2R default

    signals.push({
      barIndex: i + 1,
      entryDate: bars[i + 1].timestamp,
      entryPrice,
      stopLoss,
      takeProfit,
      setupScore: score,
      riskPerShare,
      volumeRatio,
    });
  }

  // Batasi sample kalau user request
  const usedSignals =
    signals.length > opts.maxSignals
      ? signals.slice(-opts.maxSignals)
      : signals;

  // Simulate exit di tiap signal
  const trades: BacktestTrade[] = [];
  for (const sig of usedSignals) {
    let exitPrice = sig.entryPrice;
    let outcome: BacktestTrade["outcome"] = "TIMEOUT";
    let barsHeld = opts.maxBarsHold;

    for (let j = 1; j <= opts.maxBarsHold; j++) {
      const idx = sig.barIndex + j;
      if (idx >= bars.length) break;
      const bar = bars[idx];

      // Check SL dulu (konservatif — kalau low <= SL asumsi kena)
      if (bar.low <= sig.stopLoss) {
        exitPrice = sig.stopLoss;
        outcome = "SL";
        barsHeld = j;
        break;
      }
      if (bar.high >= sig.takeProfit) {
        exitPrice = sig.takeProfit;
        outcome = "TP";
        barsHeld = j;
        break;
      }
      if (j === opts.maxBarsHold) {
        exitPrice = bar.close;
        outcome = "TIMEOUT";
      }
    }

    // Use arbitrary 100 shares — R-multiple gak dipengaruhi size asal consistent
    const pnl = computeTradePnl(
      {
        shares: 100,
        entryPrice: sig.entryPrice,
        exitPrice,
        fees: opts.fees,
      },
      sig.riskPerShare,
    );

    trades.push({
      entryDate: sig.entryDate,
      entryPrice: sig.entryPrice,
      exitDate: bars[Math.min(bars.length - 1, sig.barIndex + barsHeld)].timestamp,
      exitPrice,
      outcome,
      barsHeld,
      netPnl: pnl.netPnl,
      netPct: pnl.netPct,
      rMultiple: pnl.rMultiple ?? 0,
    });
  }

  if (trades.length === 0) {
    return {
      ...empty,
      totalSignals: signals.length,
      windowDays: Math.round((bars[bars.length - 1].timestamp - bars[0].timestamp) / 86400000),
    };
  }

  const wins = trades.filter((t) => t.rMultiple > 0).length;
  const losses = trades.filter((t) => t.rMultiple <= 0 && t.outcome === "SL").length;
  const timeouts = trades.filter((t) => t.outcome === "TIMEOUT").length;
  const totalR = trades.reduce((s, t) => s + t.rMultiple, 0);
  const avgR = totalR / trades.length;
  const winRate = (wins / trades.length) * 100;

  const winRs = trades.filter((t) => t.rMultiple > 0).map((t) => t.rMultiple);
  const lossRs = trades
    .filter((t) => t.rMultiple <= 0)
    .map((t) => Math.abs(t.rMultiple));
  const avgWinR =
    winRs.length > 0 ? winRs.reduce((s, r) => s + r, 0) / winRs.length : 0;
  const avgLossR =
    lossRs.length > 0 ? lossRs.reduce((s, r) => s + r, 0) / lossRs.length : 0;
  const expectancyR =
    (wins / trades.length) * avgWinR - (1 - wins / trades.length) * avgLossR;

  const avgBarsHeld =
    trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length;

  const sortedByR = [...trades].sort((a, b) => b.rMultiple - a.rMultiple);

  return {
    symbol,
    totalSignals: signals.length,
    trades: trades.length,
    wins,
    losses,
    timeouts,
    winRate,
    avgRMultiple: avgR,
    expectancyR,
    totalR,
    avgBarsHeld,
    bestTrade: sortedByR[0] ?? null,
    worstTrade: sortedByR[sortedByR.length - 1] ?? null,
    lowSampleWarning: trades.length < 10,
    windowDays: Math.round(
      (bars[bars.length - 1].timestamp - bars[0].timestamp) / 86400000,
    ),
  };
}
