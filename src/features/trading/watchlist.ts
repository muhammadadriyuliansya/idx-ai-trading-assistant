import type { ScanCandidate } from "@/pipeline/types";
import type { AlertCondition, LocalAlert, WatchlistItem } from "./types";

export function mergeWatchlist(prev: WatchlistItem[], candidates: ScanCandidate[]): WatchlistItem[] {
  const nextItems = candidates
    .filter((item) => item.status === "WATCHLIST" || item.status === "VALID")
    .map((item) => ({
      ticker: item.ticker,
      reason: item.reason,
      trigger: item.nextTrigger,
      invalidation: item.invalidation,
      addedAt: Date.now(),
      status: item.status,
      setupScore: item.setupScore,
    }));

  const byTicker = new Map<string, WatchlistItem>();
  [...nextItems, ...prev].forEach((item) => {
    if (!byTicker.has(item.ticker)) byTicker.set(item.ticker, item);
  });

  return [...byTicker.values()].slice(0, 30);
}

export function evaluateAlerts(prev: LocalAlert[], candidates: ScanCandidate[]): LocalAlert[] {
  const byTicker = new Map(candidates.map((item) => [item.ticker, item]));

  return prev.map((alert) => {
    if (alert.triggeredAt) return alert;
    const candidate = byTicker.get(alert.ticker);
    if (!candidate) return alert;
    const triggered = isAlertTriggered(alert.condition, candidate);
    return triggered ? { ...alert, triggeredAt: Date.now() } : alert;
  });
}

export function isAlertTriggered(condition: AlertCondition, candidate: ScanCandidate): boolean {
  if (condition === "PRICE_ABOVE_RESISTANCE") {
    return candidate.marketData.currentPrice >= candidate.marketData.resistance;
  }
  if (condition === "VOLUME_ABOVE_1_5") {
    return candidate.volumeRatio >= 1.5;
  }
  if (condition === "RR_ABOVE_2") {
    return candidate.rr >= 2;
  }
  return candidate.status === "VALID";
}

export function getAlertLabel(candidate: ScanCandidate, condition: AlertCondition): string {
  if (condition === "PRICE_ABOVE_RESISTANCE") {
    return `Price breaks resistance ${candidate.marketData.resistance.toFixed(0)}`;
  }
  if (condition === "VOLUME_ABOVE_1_5") return "Volume ratio rises above 1.5x";
  if (condition === "RR_ABOVE_2") return "Risk/reward improves above 2.0";
  return "Watchlist candidate becomes valid";
}
