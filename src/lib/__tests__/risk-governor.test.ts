import { describe, expect, it } from "vitest";
import {
  buildDailyGuardSnapshot,
  computeJournalAnalytics,
  evaluateRiskGovernor,
  getDefaultRiskPerTrade,
} from "../risk-governor";

describe("risk governor defaults", () => {
  it("caps unqualified swing risk to 0.5%", () => {
    const guard = evaluateRiskGovernor({
      mode: "swing",
      capital: 10_000_000,
      requestedRiskPerTrade: 1,
    });

    expect(getDefaultRiskPerTrade("swing")).toBe(0.5);
    expect(guard.effectiveRiskPerTrade).toBe(0.5);
    expect(guard.riskQualifiedForScaleUp).toBe(false);
  });

  it("locks review after the daily hard stop", () => {
    const guard = evaluateRiskGovernor({
      mode: "swing",
      capital: 10_000_000,
      requestedRiskPerTrade: 0.5,
      snapshot: {
        realizedPnl: -75_000,
        tradesTaken: 1,
      },
    });

    expect(guard.status).toBe("DAILY_STOP");
    expect(guard.canOpenNewTrade).toBe(false);
    expect(guard.entryAllowed).toBe(false);
  });

  it("moves to profit lock after the daily target", () => {
    const guard = evaluateRiskGovernor({
      mode: "swing",
      capital: 10_000_000,
      requestedRiskPerTrade: 0.5,
      snapshot: {
        realizedPnl: 100_000,
        tradesTaken: 1,
      },
    });

    expect(guard.status).toBe("PROFIT_LOCK");
    expect(guard.effectiveRiskPerTrade).toBe(0.25);
  });
});

describe("journal analytics", () => {
  it("summarizes closed trade quality and today's guard snapshot", () => {
    const now = new Date("2026-05-06T10:00:00+07:00").getTime();
    const records = [
      { date: now, type: "BUY", ticker: "BBRI" },
      { date: now, type: "SELL", ticker: "BBRI", pnl: 50_000, notes: "TP hit" },
      { date: now - 86_400_000, type: "SELL", ticker: "TLKM", pnl: -25_000, notes: "cut loss below support" },
    ];

    const analytics = computeJournalAnalytics(records);
    const snapshot = buildDailyGuardSnapshot(records, now);

    expect(analytics.closedTrades).toBe(2);
    expect(analytics.winRate).toBe(50);
    expect(analytics.profitFactor).toBe(2);
    expect(snapshot.realizedPnl).toBe(50_000);
    expect(snapshot.tradesTaken).toBe(1);
  });
});
