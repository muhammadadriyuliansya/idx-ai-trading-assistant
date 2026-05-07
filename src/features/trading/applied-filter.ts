import { computeRisk } from "@/lib/calc";
import { getAppliedOnly, type AppliedStockResult, type TradingConfig } from "@/lib/stock-filter";
import type { ScanCandidate } from "@/pipeline/types";

export function buildTradingConfig(capital: string, riskPerTrade: string): TradingConfig {
  return {
    capital: parseInt(capital) || 10_000_000,
    riskPerTrade: parseFloat(riskPerTrade) || 1,
    targetProfit: parseFloat(riskPerTrade) || 1,
  };
}

export function filterAppliedScanResults(
  scanResults: ScanCandidate[],
  showAppliedOnly: boolean,
  capital: string,
  riskPerTrade: string,
  tradingConfig: TradingConfig,
): ScanCandidate[] {
  if (!showAppliedOnly || scanResults.length === 0) return scanResults;

  const appliedResults: AppliedStockResult[] = scanResults.map((candidate) => {
    const price = candidate.marketData.currentPrice;
    const support = candidate.marketData.support || price * 0.98;
    const resistance = candidate.marketData.resistance || price * 1.02;

    const riskResult = computeRisk({
      ticker: candidate.ticker,
      currentPrice: price.toString(),
      support: support.toString(),
      resistance: resistance.toString(),
      atr: (price * 0.02).toString(),
      capital,
      riskPerTrade,
    });

    const rr = riskResult ? (resistance - price) / (price - support) : candidate.rr;
    const maxLoss = riskResult?.maxLoss ?? 0;
    const positionValue = riskResult?.positionValue ?? 0;
    const estimatedProfit = positionValue * (tradingConfig.targetProfit / 100);
    const capitalAmount = parseInt(capital);
    const riskPercent = parseFloat(riskPerTrade);
    const isApplied =
      rr >= 1.0 &&
      maxLoss > 0 &&
      maxLoss <= capitalAmount * (riskPercent / 100) * 2 &&
      positionValue <= capitalAmount * 0.5 &&
      estimatedProfit >= 10000;

    return {
      ticker: candidate.ticker,
      isApplied,
      reasons: isApplied ? ["All criteria met"] : [rr < 1.0 ? "RR < 1.0" : "Failed capital rules"],
      config: tradingConfig,
      riskResult,
      rr,
      setupScore: candidate.setupScore,
      maxLoss,
      positionValue,
      lotSize: riskResult?.lots ?? 0,
      estimatedProfit,
    };
  });

  const candidateByTicker = new Map(scanResults.map((candidate) => [candidate.ticker, candidate]));
  return getAppliedOnly(appliedResults)
    .map((result) => candidateByTicker.get(result.ticker))
    .filter((candidate): candidate is ScanCandidate => Boolean(candidate));
}
