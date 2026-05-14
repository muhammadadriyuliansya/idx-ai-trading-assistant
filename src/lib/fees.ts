/**
 * Broker fee model untuk IDX.
 *
 * Referensi typical retail (Stockbit/Ajaib/Mirae tier umum):
 *   Buy  : fee broker 0.15% + levy 0.04% + PPN-on-fee 0.015% ≈ 0.20%
 *   Sell : fee broker 0.25% + levy 0.04% + PPh 0.10% + PPN ≈ 0.40%
 *   Round-trip typical ≈ 0.55–0.60% dari nilai transaksi (average).
 *
 * Nilai exact beda per broker dan tier paket. Default di bawah ini adalah
 * angka konservatif-realistis — bisa di-override per kalkulasi kalau user
 * pasang nilai broker sendiri di Settings.
 *
 * Semua angka di-hitung dari nilai transaksi (shares × price), bukan modal.
 */

export interface FeeConfig {
  /** Fee broker saat buy, dalam persen nilai transaksi. Default 0.15. */
  buyFeePct: number;
  /** Fee broker saat sell, dalam persen. Default 0.25. */
  sellFeePct: number;
  /** Levy IDX (BEI + KPEI + KSEI), dalam persen. Default 0.04 (dikenakan buy & sell). */
  levyPct: number;
  /** Pajak penghasilan final (sell saja), dalam persen. Default 0.10. */
  sellTaxPct: number;
  /** PPN atas fee broker, dalam persen dari fee broker (bukan nilai transaksi). Default 11. */
  vatOnFeePct: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  buyFeePct: 0.15,
  sellFeePct: 0.25,
  levyPct: 0.04,
  sellTaxPct: 0.10,
  vatOnFeePct: 11,
};

export interface FeeBreakdown {
  buyFee: number;
  sellFee: number;
  levyBuy: number;
  levySell: number;
  sellTax: number;
  vatBuy: number;
  vatSell: number;
  totalBuyCost: number;
  totalSellCost: number;
  roundTripCost: number;
  roundTripPctOfNotional: number;
}

/**
 * Hitung total ongkos round-trip untuk nilai transaksi tertentu.
 * notional = shares * price (sisi buy = sisi sell asumsinya sama untuk estimasi).
 */
export function computeFees(
  notionalBuy: number,
  notionalSell: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): FeeBreakdown {
  const buyFee = (notionalBuy * config.buyFeePct) / 100;
  const sellFee = (notionalSell * config.sellFeePct) / 100;
  const levyBuy = (notionalBuy * config.levyPct) / 100;
  const levySell = (notionalSell * config.levyPct) / 100;
  const sellTax = (notionalSell * config.sellTaxPct) / 100;
  const vatBuy = (buyFee * config.vatOnFeePct) / 100;
  const vatSell = (sellFee * config.vatOnFeePct) / 100;

  const totalBuyCost = buyFee + levyBuy + vatBuy;
  const totalSellCost = sellFee + levySell + sellTax + vatSell;
  const roundTripCost = totalBuyCost + totalSellCost;
  const avgNotional = (notionalBuy + notionalSell) / 2;
  const roundTripPctOfNotional = avgNotional > 0 ? (roundTripCost / avgNotional) * 100 : 0;

  return {
    buyFee,
    sellFee,
    levyBuy,
    levySell,
    sellTax,
    vatBuy,
    vatSell,
    totalBuyCost,
    totalSellCost,
    roundTripCost,
    roundTripPctOfNotional,
  };
}

/**
 * Estimasi persen fee round-trip dari nilai transaksi — angka ini yang
 * biasanya dipakai untuk konversi RR gross → RR net. Default ~0.6%.
 */
export function estimateRoundTripFeePct(config: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const total =
    config.buyFeePct +
    config.sellFeePct +
    config.levyPct * 2 +
    config.sellTaxPct +
    ((config.buyFeePct + config.sellFeePct) * config.vatOnFeePct) / 100;
  return Number(total.toFixed(3));
}

/**
 * P&L net setelah fee untuk trade close di exitPrice.
 * Dipakai di Position Tracker dan Journal — return selalu dalam IDR.
 */
export interface TradePnlInput {
  shares: number;
  entryPrice: number;
  exitPrice: number;
  fees?: FeeConfig;
}

export interface TradePnlResult {
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  netPct: number;
  rMultiple: number | null;
  feeBreakdown: FeeBreakdown;
}

export function computeTradePnl(
  input: TradePnlInput,
  riskPerShare?: number,
): TradePnlResult {
  const { shares, entryPrice, exitPrice, fees = DEFAULT_FEE_CONFIG } = input;
  const notionalBuy = shares * entryPrice;
  const notionalSell = shares * exitPrice;
  const grossPnl = notionalSell - notionalBuy;
  const feeBreakdown = computeFees(notionalBuy, notionalSell, fees);
  const netPnl = grossPnl - feeBreakdown.roundTripCost;
  const netPct = notionalBuy > 0 ? (netPnl / notionalBuy) * 100 : 0;
  const rMultiple =
    riskPerShare && riskPerShare > 0 && shares > 0
      ? netPnl / (riskPerShare * shares)
      : null;

  return {
    grossPnl,
    totalFees: feeBreakdown.roundTripCost,
    netPnl,
    netPct,
    rMultiple,
    feeBreakdown,
  };
}

/**
 * Net RR: tukar TP & SL dari gross-RR jadi net-RR setelah fee.
 * Formula: reward_net = reward_gross - fee_round_trip_on_avg_notional
 *          risk_net   = risk_gross + fee_round_trip_on_avg_notional
 * Penting banget untuk scalper modal kecil — scalp 1% bisa jadi net-negatif.
 */
export function computeNetRiskReward(
  entry: number,
  stopLoss: number,
  takeProfit: number,
  shares: number,
  config: FeeConfig = DEFAULT_FEE_CONFIG,
): { rrGross: number; rrNet: number; netReward: number; netRisk: number } {
  if (entry <= 0 || shares <= 0) return { rrGross: 0, rrNet: 0, netReward: 0, netRisk: 0 };

  const grossReward = Math.max(0, (takeProfit - entry) * shares);
  const grossRisk = Math.max(0, (entry - stopLoss) * shares);
  const rrGross = grossRisk > 0 ? grossReward / grossRisk : 0;

  // Fee dihitung dua scenario: hit TP (buy@entry, sell@TP) vs hit SL (buy@entry, sell@SL)
  const feesAtTp = computeFees(entry * shares, takeProfit * shares, config).roundTripCost;
  const feesAtSl = computeFees(entry * shares, stopLoss * shares, config).roundTripCost;

  const netReward = Math.max(0, grossReward - feesAtTp);
  const netRisk = grossRisk + feesAtSl; // stopped-out juga kena fee = bikin risk lebih besar
  const rrNet = netRisk > 0 ? netReward / netRisk : 0;

  return { rrGross, rrNet, netReward, netRisk };
}
