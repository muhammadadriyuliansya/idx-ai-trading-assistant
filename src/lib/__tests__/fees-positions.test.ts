/**
 * Unit tests untuk fee model + position tracker.
 * Target: kepastian matematika P&L + fee + R-multiple + trail stop.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEE_CONFIG,
  computeFees,
  computeTradePnl,
  computeNetRiskReward,
  estimateRoundTripFeePct,
} from "../fees";
import {
  closePosition,
  computeLiveSnapshot,
  openPosition,
  queryJournalByReason,
} from "@/features/trading/positions";
import type { ClosedTrade, OpenPosition } from "@/features/trading/position-types";

describe("fees — IDX broker model", () => {
  it("round-trip fee kira-kira 0.5–0.7% dari notional", () => {
    const pct = estimateRoundTripFeePct();
    // Default config ~0.60%
    expect(pct).toBeGreaterThan(0.4);
    expect(pct).toBeLessThan(0.8);
  });

  it("computeFees simetrik untuk notional sama", () => {
    const fees = computeFees(1_000_000, 1_000_000);
    // Buy: 0.15% + 0.04% + VAT 11% × 0.15% ≈ 0.2065%
    // Sell: 0.25% + 0.04% + 0.10% + VAT 11% × 0.25% ≈ 0.4175%
    // Total ~0.624%
    expect(fees.roundTripPctOfNotional).toBeGreaterThan(0.55);
    expect(fees.roundTripPctOfNotional).toBeLessThan(0.7);
    expect(fees.buyFee).toBeCloseTo(1500, 0);
    expect(fees.sellFee).toBeCloseTo(2500, 0);
    expect(fees.sellTax).toBeCloseTo(1000, 0);
  });

  it("computeTradePnl: scalp 1% gross jadi ~0.4% net setelah fee", () => {
    // Entry 1000, exit 1010 = 1% gross
    const result = computeTradePnl({
      shares: 1000,
      entryPrice: 1000,
      exitPrice: 1010,
    });
    expect(result.grossPnl).toBe(10_000);
    // Fee total ~0.6% of 1M = ~6000
    expect(result.totalFees).toBeGreaterThan(5000);
    expect(result.totalFees).toBeLessThan(7500);
    expect(result.netPnl).toBeGreaterThan(2000);
    expect(result.netPnl).toBeLessThan(5000);
    expect(result.netPct).toBeGreaterThan(0.2);
    expect(result.netPct).toBeLessThan(0.5);
  });

  it("computeTradePnl R-multiple: win 2R gross jadi <2R net", () => {
    // Risk per share = 10, shares = 100, entry 1000, TP 1020 (2R gross)
    const result = computeTradePnl(
      { shares: 100, entryPrice: 1000, exitPrice: 1020 },
      10,
    );
    expect(result.grossPnl).toBe(2000);
    expect(result.rMultiple).not.toBeNull();
    expect(result.rMultiple!).toBeLessThan(2);
    // Tapi harusnya masih di atas 1R setelah fee
    expect(result.rMultiple!).toBeGreaterThan(1);
  });

  it("computeNetRiskReward: RR gross 2 bisa turun ke <1.5 net buat modal kecil", () => {
    // Entry 1000, SL 995, TP 1010 → gross RR 2
    const { rrGross, rrNet } = computeNetRiskReward(1000, 995, 1010, 100);
    expect(rrGross).toBeCloseTo(2, 1);
    // Fee bikin RR net turun jelas
    expect(rrNet).toBeLessThan(rrGross);
    expect(rrNet).toBeLessThan(1.5);
  });
});

// ---------------------------------------------------------------------------

function makePosition(overrides: Partial<OpenPosition> = {}): OpenPosition {
  return {
    id: "test-1",
    ticker: "BBRI.JK",
    symbol: "BBRI",
    mode: "day",
    openedAt: Date.now(),
    entryPrice: 5000,
    shares: 100,
    lots: 1,
    stopLoss: 4950,
    takeProfit1: 5075,
    takeProfit2: 5150,
    riskPerShareAtEntry: 50,
    entryReason: "SCANNER_VALID",
    feeConfig: DEFAULT_FEE_CONFIG,
    ...overrides,
  };
}

describe("positions — open/update/close", () => {
  it("openPosition menambah entry dengan id baru", () => {
    const result = openPosition([], {
      ticker: "BBRI.JK",
      symbol: "BBRI",
      mode: "day",
      openedAt: Date.now(),
      entryPrice: 5000,
      shares: 100,
      lots: 1,
      stopLoss: 4950,
      takeProfit1: 5075,
      takeProfit2: 5150,
      riskPerShareAtEntry: 50,
      entryReason: "SCANNER_VALID",
      feeConfig: DEFAULT_FEE_CONFIG,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeTruthy();
    expect(result[0].symbol).toBe("BBRI");
  });

  it("closePosition menghitung netPnl + rMultiple dengan benar", () => {
    const open = [makePosition()];
    // Hit TP1 = 5075, risk per share 50, reward per share 75 → 1.5R gross
    const { remaining, closed } = closePosition(open, "test-1", {
      exitPrice: 5075,
      exitReason: "HIT_TP1",
    });
    expect(remaining).toHaveLength(0);
    expect(closed).not.toBeNull();
    expect(closed!.grossPnl).toBe(7500);
    expect(closed!.netPnl).toBeLessThan(7500);
    expect(closed!.netPnl).toBeGreaterThan(0);
    expect(closed!.rMultiple).toBeGreaterThan(0.8);
    expect(closed!.rMultiple).toBeLessThan(1.5);
  });

  it("closePosition yang hit stop menghasilkan rMultiple negatif", () => {
    const open = [makePosition()];
    const { closed } = closePosition(open, "test-1", {
      exitPrice: 4950, // exact stop
      exitReason: "HIT_STOP",
    });
    expect(closed!.netPnl).toBeLessThan(0);
    expect(closed!.rMultiple).toBeLessThan(-1); // fee makes it worse than -1R
  });

  it("closePosition id tidak ketemu — tidak mengubah state", () => {
    const open = [makePosition()];
    const { remaining, closed } = closePosition(open, "nonexistent", {
      exitPrice: 5000,
      exitReason: "HIT_STOP",
    });
    expect(remaining).toHaveLength(1);
    expect(closed).toBeNull();
  });
});

describe("positions — live snapshot & trail stop", () => {
  it("di harga entry: P&L net negatif (fees) tapi status OPEN", () => {
    const snap = computeLiveSnapshot(makePosition(), 5000);
    expect(snap.unrealizedGrossPnl).toBe(0);
    expect(snap.unrealizedNetPnl).toBeLessThan(0);
    expect(snap.status).toBe("OPEN");
    expect(snap.suggestedTrailStop).toBe(4950); // belum pindah
  });

  it("progress 50%+ ke TP1: trail ke break-even", () => {
    // Entry 5000 TP1 5075 — 50% progress = 5037
    const snap = computeLiveSnapshot(makePosition(), 5040);
    expect(snap.status).toBe("NEAR_TP1");
    expect(snap.suggestedTrailStop).toBeGreaterThan(5000); // di atas entry
    expect(snap.suggestedTrailStop).toBeLessThan(5010);
  });

  it("lewat TP1: trail ke TP1", () => {
    const snap = computeLiveSnapshot(makePosition(), 5100);
    expect(snap.status).toBe("BEYOND_TP1");
    expect(snap.suggestedTrailStop).toBe(5075);
  });

  it("lewat TP2: trail ke dekat TP2", () => {
    const snap = computeLiveSnapshot(makePosition(), 5200);
    expect(snap.status).toBe("BEYOND_TP2");
    expect(snap.suggestedTrailStop).toBeCloseTo(5150 * 0.995, 1);
  });

  it("dekat stop: status NEAR_STOP", () => {
    const snap = computeLiveSnapshot(makePosition(), 4960);
    expect(snap.status).toBe("NEAR_STOP");
  });

  it("honor trail stop manual yang lebih agresif", () => {
    const pos = makePosition({ trailStop: 5020 });
    const snap = computeLiveSnapshot(pos, 5010);
    expect(snap.suggestedTrailStop).toBe(5020);
  });
});

describe("positions — journal query", () => {
  function makeClosed(
    reason: ClosedTrade["entryReason"],
    netPnl: number,
    rMultiple: number,
  ): ClosedTrade {
    return {
      id: Math.random().toString(36).slice(2),
      ticker: "BBRI.JK",
      symbol: "BBRI",
      mode: "day",
      openedAt: Date.now() - 3600_000,
      closedAt: Date.now(),
      entryPrice: 5000,
      exitPrice: 5000 + netPnl / 100,
      shares: 100,
      lots: 1,
      stopLoss: 4950,
      takeProfit1: 5075,
      takeProfit2: 5150,
      riskPerShareAtEntry: 50,
      entryReason: reason,
      exitReason: netPnl > 0 ? "HIT_TP1" : "HIT_STOP",
      netPnl,
      grossPnl: netPnl,
      totalFees: 0,
      rMultiple,
      netPct: 0,
      feeConfig: DEFAULT_FEE_CONFIG,
    };
  }

  it("groupBy entryReason, hitung winRate + expectancyR", () => {
    const trades: ClosedTrade[] = [
      makeClosed("SCANNER_VALID", 1000, 1),
      makeClosed("SCANNER_VALID", 2000, 2),
      makeClosed("SCANNER_VALID", -500, -1),
      makeClosed("MANUAL_DISCRETIONARY", -1000, -1),
      makeClosed("MANUAL_DISCRETIONARY", -500, -0.5),
    ];
    const results = queryJournalByReason(trades);

    const scanner = results.find((r) => r.reason === "SCANNER_VALID")!;
    expect(scanner.count).toBe(3);
    expect(scanner.wins).toBe(2);
    expect(scanner.winRate).toBeCloseTo(66.67, 1);
    // Avg win R = 1.5, avg loss R = 1; WR 0.667
    // Expectancy = 0.667 * 1.5 - 0.333 * 1 = 0.667
    expect(scanner.expectancyR).toBeCloseTo(0.667, 1);

    const manual = results.find((r) => r.reason === "MANUAL_DISCRETIONARY")!;
    expect(manual.count).toBe(2);
    expect(manual.wins).toBe(0);
    expect(manual.expectancyR).toBeLessThan(0);
  });

  it("empty trades — empty results", () => {
    expect(queryJournalByReason([])).toEqual([]);
  });
});
