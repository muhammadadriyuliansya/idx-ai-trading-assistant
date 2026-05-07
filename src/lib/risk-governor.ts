import type {
  ContextResult,
  DailyGuardSnapshot,
  DataHealth,
  IndicatorSet,
  MarketData,
  RiskGovernorGate,
  RiskGovernorState,
  RiskResult,
  ScannerResult,
  TradingMode,
} from "@/pipeline/types";

export interface TradeJournalRecord {
  date: number;
  type?: string;
  pnl?: number;
  notes?: string;
  ticker?: string;
}

export interface JournalAnalytics {
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  expectancyR: number;
  averageR: number;
  profitFactor: number;
  maxDrawdownPct: number;
  bestTicker: string;
  worstDay: string;
  cutLossReasons: string[];
}

interface RiskGovernorInput {
  mode: TradingMode;
  capital: number;
  requestedRiskPerTrade: number;
  snapshot?: DailyGuardSnapshot;
  marketData?: MarketData;
  indicators?: IndicatorSet;
  dataHealth?: DataHealth;
  scanner?: ScannerResult;
  risk?: RiskResult;
  context?: ContextResult;
}

const DEFAULTS = {
  dailyTargetPct: 1,
  dailyHardStopPct: -0.75,
  fullStopProfitPct: 2,
  maxTrades: 3,
  dayRiskPct: 0.25,
  swingRiskPct: 0.5,
  scaleUpRiskPct: 1,
  minRR: 2,
  minVolumeRatio: 1.5,
  profitLockScore: 80,
  profitLockRR: 3,
} as const;

export function getDefaultRiskPerTrade(mode: TradingMode): number {
  return mode === "day" ? DEFAULTS.dayRiskPct : DEFAULTS.swingRiskPct;
}

export function computeJournalAnalytics(records: TradeJournalRecord[]): JournalAnalytics {
  const closed = records.filter((record) => Number.isFinite(record.pnl));
  const wins = closed.filter((record) => (record.pnl ?? 0) > 0);
  const losses = closed.filter((record) => (record.pnl ?? 0) < 0);
  const grossWin = wins.reduce((sum, record) => sum + (record.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, record) => sum + (record.pnl ?? 0), 0));
  const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const lossRate = closed.length > 0 ? losses.length / closed.length : 0;
  const expectancy = closed.length > 0 ? (winRate / 100) * avgWin - lossRate * avgLoss : 0;
  const riskUnit = avgLoss > 0 ? avgLoss : Math.max(avgWin, 1);
  const expectancyR = riskUnit > 0 ? expectancy / riskUnit : 0;
  const averageR = closed.length > 0
    ? closed.reduce((sum, record) => sum + ((record.pnl ?? 0) / riskUnit), 0) / closed.length
    : 0;

  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const record of closed.sort((a, b) => a.date - b.date)) {
    running += record.pnl ?? 0;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }

  const byTicker = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const record of closed) {
    const ticker = record.ticker ?? "-";
    byTicker.set(ticker, (byTicker.get(ticker) ?? 0) + (record.pnl ?? 0));
    const day = new Date(record.date).toLocaleDateString("id-ID", { weekday: "short" });
    byDay.set(day, (byDay.get(day) ?? 0) + (record.pnl ?? 0));
  }

  const bestTicker = [...byTicker.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
  const worstDay = [...byDay.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? "-";
  const cutLossReasons = losses
    .map((record) => record.notes?.trim())
    .filter((note): note is string => Boolean(note))
    .slice(0, 5);

  return {
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    expectancyR,
    averageR,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    maxDrawdownPct: riskUnit > 0 ? (maxDrawdown / riskUnit) * 100 : 0,
    bestTicker,
    worstDay,
    cutLossReasons,
  };
}

export function buildDailyGuardSnapshot(records: TradeJournalRecord[], now = Date.now()): DailyGuardSnapshot {
  const todayKey = new Date(now).toLocaleDateString("id-ID");
  const todaysRecords = records.filter((record) => (
    new Date(record.date).toLocaleDateString("id-ID") === todayKey
  ));
  const analytics = computeJournalAnalytics(records);

  return {
    realizedPnl: todaysRecords.reduce((sum, record) => sum + (record.pnl ?? 0), 0),
    tradesTaken: todaysRecords.filter((record) => record.type === "BUY").length,
    journalTradeCount: analytics.closedTrades,
    journalExpectancyR: analytics.expectancyR,
    journalProfitFactor: analytics.profitFactor,
    maxDrawdownPct: analytics.maxDrawdownPct,
  };
}

export function evaluateRiskGovernor(input: RiskGovernorInput): RiskGovernorState {
  const snapshot = input.snapshot ?? { realizedPnl: 0, tradesTaken: 0 };
  const capital = Number.isFinite(input.capital) && input.capital > 0 ? input.capital : 0;
  const realizedPct = capital > 0 ? (snapshot.realizedPnl / capital) * 100 : 0;
  const riskQualifiedForScaleUp =
    (snapshot.journalTradeCount ?? 0) >= 60 &&
    (snapshot.journalExpectancyR ?? 0) > 0 &&
    (snapshot.journalProfitFactor ?? 0) >= 1.2 &&
    (snapshot.maxDrawdownPct ?? Infinity) <= 500;
  const baseRiskPerTrade = getDefaultRiskPerTrade(input.mode);
  const maxAllowedRisk = riskQualifiedForScaleUp ? DEFAULTS.scaleUpRiskPct : baseRiskPerTrade;
  const requestedRiskPerTrade = Number.isFinite(input.requestedRiskPerTrade)
    ? input.requestedRiskPerTrade
    : baseRiskPerTrade;

  let effectiveRiskPerTrade = Math.min(requestedRiskPerTrade, maxAllowedRisk);
  let status: RiskGovernorState["status"] = "OPEN";
  const notes: string[] = [];

  if (!riskQualifiedForScaleUp && requestedRiskPerTrade > baseRiskPerTrade) {
    notes.push(`Risk capped at ${baseRiskPerTrade}% until journal has 60 positive-quality closed trades.`);
  }

  if (realizedPct <= DEFAULTS.dailyHardStopPct) {
    status = "DAILY_STOP";
  } else if (realizedPct >= DEFAULTS.fullStopProfitPct) {
    status = "TARGET_LOCK";
  } else if (snapshot.tradesTaken >= DEFAULTS.maxTrades) {
    status = "MAX_TRADES";
  } else if (realizedPct >= DEFAULTS.dailyTargetPct) {
    status = "PROFIT_LOCK";
    effectiveRiskPerTrade = Math.min(effectiveRiskPerTrade, baseRiskPerTrade / 2);
    notes.push("Daily target reached; only exceptional setups may trade with half-size risk.");
  }

  const dailyLossBudget = capital * Math.abs(DEFAULTS.dailyHardStopPct) / 100;
  const remainingDailyRisk = Math.max(0, dailyLossBudget + snapshot.realizedPnl);
  const canOpenByDay =
    status !== "DAILY_STOP" &&
    status !== "TARGET_LOCK" &&
    status !== "MAX_TRADES" &&
    capital > 0 &&
    remainingDailyRisk > 0;

  const gates: RiskGovernorGate[] = [];
  if (input.risk && input.indicators && input.dataHealth && input.scanner && input.context) {
    gates.push({
      label: "RR >= 2.0",
      passed: input.risk.rr1 >= DEFAULTS.minRR,
      reason: `RR ${input.risk.rr1.toFixed(2)}`,
    });
    gates.push({
      label: "Volume >= 1.5x",
      passed: input.indicators.volumeRatio >= DEFAULTS.minVolumeRatio,
      reason: `Volume ${input.indicators.volumeRatio.toFixed(2)}x`,
    });
    gates.push({
      label: "Trend not bearish",
      passed: input.indicators.trend !== "bearish",
      reason: `Trend ${input.indicators.trend}`,
    });
    gates.push({
      label: "Data health GOOD",
      passed: input.dataHealth.status === "GOOD",
      reason: `Data health ${input.dataHealth.status}`,
    });
    gates.push({
      label: "Position inside risk budget",
      passed:
        input.risk.positionSize.lots > 0 &&
        input.risk.positionSize.maxLoss <= capital * (effectiveRiskPerTrade / 100),
      reason: `Max loss ${input.risk.positionSize.maxLoss.toFixed(0)}`,
    });
    gates.push({
      label: "IHSG not risk-off",
      passed: input.context.riskStance !== "RISK-OFF",
      reason: `Risk stance ${input.context.riskStance}`,
    });
    gates.push({
      label: "Profit-lock quality",
      passed:
        status !== "PROFIT_LOCK" ||
        (input.scanner.setupScore >= DEFAULTS.profitLockScore && input.risk.rr1 >= DEFAULTS.profitLockRR),
      reason: `Score ${input.scanner.setupScore}, RR ${input.risk.rr1.toFixed(2)}`,
    });
    gates.push({
      label: "Daytrade data valid",
      passed: input.mode !== "day",
      reason: input.mode === "day"
        ? "Intraday data source is not connected; review only"
        : "Daily swing data is supported",
    });
  }

  const failedGate = gates.find((gate) => !gate.passed);
  const entryAllowed = canOpenByDay && gates.length > 0 && !failedGate;
  const noTradeReason = !canOpenByDay
    ? buildDailyLockReason(status)
    : failedGate?.reason;

  return {
    mode: input.mode,
    status: entryAllowed ? status : status === "OPEN" ? "NO_TRADE" : status,
    canOpenNewTrade: canOpenByDay,
    entryAllowed,
    dailyTargetPct: DEFAULTS.dailyTargetPct,
    dailyHardStopPct: DEFAULTS.dailyHardStopPct,
    fullStopProfitPct: DEFAULTS.fullStopProfitPct,
    maxTrades: DEFAULTS.maxTrades,
    realizedPnl: snapshot.realizedPnl,
    realizedPct,
    tradesTaken: snapshot.tradesTaken,
    remainingDailyRisk,
    requestedRiskPerTrade,
    baseRiskPerTrade,
    effectiveRiskPerTrade: entryAllowed || canOpenByDay ? effectiveRiskPerTrade : 0,
    recommendedRiskPerTrade: effectiveRiskPerTrade,
    riskQualifiedForScaleUp,
    gates,
    notes,
    noTradeReason,
  };
}

function buildDailyLockReason(status: RiskGovernorState["status"]): string {
  if (status === "DAILY_STOP") return "Daily hard stop reached";
  if (status === "TARGET_LOCK") return "Daily full profit lock reached";
  if (status === "MAX_TRADES") return "Maximum daily trades reached";
  return "Daily risk budget unavailable";
}
