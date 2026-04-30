/**
 * Technical indicator calculations on OHLCV bar data.
 * All inputs are arrays in chronological order (oldest first).
 */

export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0 || period <= 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export function atr(bars: Bar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  if (bars.length < 2) return out;
  const trs: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  if (trs.length <= period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function vwap(bars: Bar[]): number {
  // Single-day VWAP across the most recent bar's typical price weighted by volume.
  // For daily bars (which Yahoo gives us), VWAP per bar ≈ (H+L+C)/3.
  const last = bars[bars.length - 1];
  if (!last) return NaN;
  return (last.high + last.low + last.close) / 3;
}

export function rollingVwap(bars: Bar[], lookback = 5): number {
  const slice = bars.slice(-lookback);
  let pv = 0;
  let v = 0;
  for (const b of slice) {
    const tp = (b.high + b.low + b.close) / 3;
    pv += tp * b.volume;
    v += b.volume;
  }
  if (v <= 0) return NaN;
  return pv / v;
}

export function avgVolume(bars: Bar[], period = 20): number {
  if (bars.length === 0) return NaN;
  const slice = bars.slice(-period - 1, -1); // exclude latest bar
  if (slice.length === 0) return NaN;
  const sum = slice.reduce((acc, b) => acc + b.volume, 0);
  return sum / slice.length;
}

/**
 * Find recent swing low (support) and swing high (resistance) using a simple
 * pivot-window heuristic. A pivot is the lowest/highest close in a window of
 * size `window` on each side. Falls back to min/max over the lookback period.
 */
export function swingLevels(
  bars: Bar[],
  lookback = 60,
  window = 3,
): { support: number; resistance: number } {
  const slice = bars.slice(-lookback);
  if (slice.length === 0) return { support: NaN, resistance: NaN };

  const pivotLows: number[] = [];
  const pivotHighs: number[] = [];

  for (let i = window; i < slice.length - window; i++) {
    const center = slice[i];
    let isLow = true;
    let isHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (slice[j].low <= center.low) isLow = false;
      if (slice[j].high >= center.high) isHigh = false;
    }
    if (isLow) pivotLows.push(center.low);
    if (isHigh) pivotHighs.push(center.high);
  }

  const last = slice[slice.length - 1];
  const lowsBelow = pivotLows.filter((v) => v < last.close);
  const highsAbove = pivotHighs.filter((v) => v > last.close);

  const support = lowsBelow.length
    ? Math.max(...lowsBelow)
    : Math.min(...slice.map((b) => b.low));
  const resistance = highsAbove.length
    ? Math.min(...highsAbove)
    : Math.max(...slice.map((b) => b.high));

  return { support, resistance };
}

export function classifyTrend(closes: number[]): "bullish" | "sideways" | "bearish" {
  if (closes.length < 50) return "sideways";
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const last = closes.length - 1;
  const slopeRef = closes.length - 10;
  const slope20 = ema20[last] - ema20[slopeRef];
  if (closes[last] > ema20[last] && ema20[last] > ema50[last] && slope20 > 0)
    return "bullish";
  if (closes[last] < ema20[last] && ema20[last] < ema50[last] && slope20 < 0)
    return "bearish";
  return "sideways";
}

export function describeMacd(
  macdLine: number[],
  signalLine: number[],
  histogram: number[],
): string {
  const last = macdLine.length - 1;
  if (last < 1) return "n/a";
  const histNow = histogram[last];
  const histPrev = histogram[last - 1];
  const macdNow = macdLine[last];
  const sigNow = signalLine[last];
  if (histPrev <= 0 && histNow > 0) return "bullish cross";
  if (histPrev >= 0 && histNow < 0) return "bearish cross";
  if (macdNow > sigNow && histNow > 0) return "bullish above signal";
  if (macdNow < sigNow && histNow < 0) return "bearish below signal";
  return "netral";
}

export function describeStochastic(bars: Bar[], period = 14, smooth = 3): string {
  if (bars.length < period + smooth) return "n/a";
  const ks: number[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map((b) => b.high));
    const low = Math.min(...slice.map((b) => b.low));
    const close = bars[i].close;
    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    ks.push(k);
  }
  const k = ks.slice(-smooth).reduce((a, b) => a + b, 0) / smooth;
  const d =
    ks.length >= smooth * 2
      ? ks.slice(-smooth * 2, -smooth).reduce((a, b) => a + b, 0) / smooth
      : k;
  let label = "neutral";
  if (k >= 80) label = "overbought";
  else if (k <= 20) label = "oversold";
  return `K ${k.toFixed(0)} / D ${d.toFixed(0)} (${label})`;
}
