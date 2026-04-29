import type {
  RiskCalcResult,
  RiskInput,
  ScannerInput,
  SetupScoreBreakdown,
} from "./types";
import { toNumber } from "./utils";

const LOT_SIZE = 100;

export function calculateRiskReward(
  entry: number,
  stopLoss: number,
  target: number,
): number {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(target - entry);
  if (risk <= 0) return 0;
  return reward / risk;
}

export function calculatePositionSize(
  capital: number,
  riskPerTradePct: number,
  entry: number,
  stopLoss: number,
): { shares: number; lots: number; maxLoss: number; positionValue: number } {
  const riskBudget = (capital * riskPerTradePct) / 100;
  const riskPerShare = Math.abs(entry - stopLoss);
  if (riskPerShare <= 0 || riskBudget <= 0 || entry <= 0) {
    return { shares: 0, lots: 0, maxLoss: 0, positionValue: 0 };
  }
  const rawShares = riskBudget / riskPerShare;
  const lots = Math.max(0, Math.floor(rawShares / LOT_SIZE));
  const shares = lots * LOT_SIZE;
  const maxLoss = shares * riskPerShare;
  const positionValue = shares * entry;
  return { shares, lots, maxLoss, positionValue };
}

export function computeRisk(input: RiskInput): RiskCalcResult | null {
  const price = toNumber(input.currentPrice);
  const support = toNumber(input.support);
  const resistance = toNumber(input.resistance);
  const atr = toNumber(input.atr);
  const capital = toNumber(input.capital);
  const riskPct = toNumber(input.riskPerTrade);

  if (![price, support, resistance, capital, riskPct].every(Number.isFinite)) {
    return null;
  }
  if (price <= 0 || support <= 0 || resistance <= 0 || capital <= 0) {
    return null;
  }

  const safeAtr = Number.isFinite(atr) && atr > 0 ? atr : (resistance - support) * 0.1;
  const entry = price;
  const stopBuffer = Math.max(safeAtr * 0.5, price * 0.005);
  const stopLoss = Math.max(support - stopBuffer, price * 0.9);
  const range = resistance - entry;
  const tp1 = entry + Math.max(range * 0.6, safeAtr * 1.5);
  const tp2 = entry + Math.max(range, safeAtr * 3);

  const riskPerShare = Math.max(entry - stopLoss, 1);
  const rewardPerShare1 = Math.max(tp1 - entry, 0);
  const rewardPerShare2 = Math.max(tp2 - entry, 0);
  const riskReward1 = rewardPerShare1 / riskPerShare;
  const riskReward2 = rewardPerShare2 / riskPerShare;

  const sizing = calculatePositionSize(capital, riskPct, entry, stopLoss);

  return {
    entry,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    riskPerShare,
    rewardPerShare1,
    rewardPerShare2,
    riskReward1,
    riskReward2,
    downsidePct: ((stopLoss - entry) / entry) * 100,
    upsidePct1: ((tp1 - entry) / entry) * 100,
    upsidePct2: ((tp2 - entry) / entry) * 100,
    maxLoss: sizing.maxLoss,
    shares: sizing.shares,
    lots: sizing.lots,
    positionValue: sizing.positionValue,
  };
}

interface ScoreParts {
  trend: number;
  momentum: number;
  volume: number;
  context: number;
  rrQuality: number;
}

function score(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(max, value));
}

export function calculateSetupScore(
  input: ScannerInput,
  rr?: number,
): SetupScoreBreakdown {
  const price = toNumber(input.currentPrice);
  const ema20 = toNumber(input.ema20);
  const ema50 = toNumber(input.ema50);
  const ema200 = toNumber(input.ema200);
  const vwap = toNumber(input.vwap);
  const rsi = toNumber(input.rsi);
  const todayVol = toNumber(input.todayVolume);
  const avgVol = toNumber(input.avgVolume20d);

  const parts: ScoreParts = { trend: 0, momentum: 0, volume: 0, context: 0, rrQuality: 0 };

  // Trend (max 30)
  if (Number.isFinite(price) && Number.isFinite(ema20) && price > ema20) parts.trend += 10;
  if (Number.isFinite(ema20) && Number.isFinite(ema50) && ema20 > ema50) parts.trend += 10;
  if (Number.isFinite(ema50) && Number.isFinite(ema200) && ema50 > ema200) parts.trend += 7;
  if (Number.isFinite(price) && Number.isFinite(vwap) && price > vwap) parts.trend += 3;
  parts.trend = score(parts.trend, 30);

  // Momentum (max 20)
  if (Number.isFinite(rsi)) {
    if (rsi >= 50 && rsi <= 70) parts.momentum += 12;
    else if (rsi > 70 && rsi <= 80) parts.momentum += 6;
    else if (rsi >= 40 && rsi < 50) parts.momentum += 6;
  }
  const macd = (input.macd || "").toLowerCase();
  if (macd.includes("bull") || macd.includes("positif") || macd.includes("cross up")) parts.momentum += 8;
  else if (macd.includes("netral") || macd.includes("flat")) parts.momentum += 3;
  parts.momentum = score(parts.momentum, 20);

  // Volume (max 20)
  if (Number.isFinite(todayVol) && Number.isFinite(avgVol) && avgVol > 0) {
    const ratio = todayVol / avgVol;
    if (ratio >= 2) parts.volume += 20;
    else if (ratio >= 1.5) parts.volume += 15;
    else if (ratio >= 1) parts.volume += 8;
    else parts.volume += 2;
  }
  parts.volume = score(parts.volume, 20);

  // Market context (max 20)
  const ihsg = input.ihsgTrend.toLowerCase();
  const sector = input.sectorStrength.toLowerCase();
  const flow = input.foreignFlow.toLowerCase();
  if (ihsg.includes("bull") || ihsg.includes("up")) parts.context += 7;
  else if (ihsg.includes("side") || ihsg.includes("netral")) parts.context += 3;
  if (sector.includes("strong") || sector.includes("lead") || sector.includes("kuat")) parts.context += 7;
  else if (sector.includes("netral") || sector.includes("normal")) parts.context += 3;
  if (flow.includes("inflow") || flow.includes("masuk") || flow.includes("buy")) parts.context += 6;
  parts.context = score(parts.context, 20);

  // RR Quality (max 10)
  if (Number.isFinite(rr) && rr! > 0) {
    if (rr! >= 3) parts.rrQuality = 10;
    else if (rr! >= 2) parts.rrQuality = 8;
    else if (rr! >= 1.5) parts.rrQuality = 5;
    else parts.rrQuality = 2;
  }

  const total = Math.round(
    parts.trend + parts.momentum + parts.volume + parts.context + parts.rrQuality,
  );

  let confidence: SetupScoreBreakdown["confidence"] = "LOW";
  if (total >= 75) confidence = "HIGH";
  else if (total >= 55) confidence = "MEDIUM";

  let status: SetupScoreBreakdown["status"] = "REJECT";
  if (total >= 70) status = "VALID";
  else if (total >= 50) status = "WATCHLIST";

  return { ...parts, total, confidence, status };
}

export function volumeRatio(input: ScannerInput): number | null {
  const today = toNumber(input.todayVolume);
  const avg = toNumber(input.avgVolume20d);
  if (!Number.isFinite(today) || !Number.isFinite(avg) || avg <= 0) return null;
  return today / avg;
}
