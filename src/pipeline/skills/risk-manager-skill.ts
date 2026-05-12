import { getIdxTickSize, isNearAutoRejectLower, roundToTick } from "@/lib/idx";
import type { MarketData, RiskResult, RiskSkillReport } from "@/pipeline/types";

export function runRiskManagerSkill(input: {
  marketData: MarketData
  risk: RiskResult
}): RiskSkillReport {
  const { marketData, risk } = input;
  const entry = Number(risk.entryZone.split("-")[0]?.trim() ?? marketData.currentPrice);
  const stop = Number(risk.stopLoss);
  const riskPerShare = Math.max(entry - stop, 0);
  const tickSize = getIdxTickSize(marketData.currentPrice);
  const roundedEntry = roundToTick(entry);
  const roundedStopLoss = roundToTick(stop, "down");
  const arbWarning = isNearAutoRejectLower(marketData.currentPrice, marketData.previousClose);

  const overallRiskRating =
    arbWarning || risk.rr1 < 1.5 ? "high" :
    risk.rr1 < 2 || risk.positionSize.maxLoss > risk.riskBudget ? "moderate" :
    "acceptable";

  let advice = `Risk budget ${risk.riskBudget.toFixed(0)} with RR ${risk.rr1.toFixed(2)}.`;
  if (arbWarning) {
    advice = "Price is near IDX ARB lower band, so stop-loss execution risk is elevated.";
  } else if (overallRiskRating === "moderate") {
    advice = "Use smaller size or wait for cleaner entry because the setup is only marginal.";
  }

  return {
    ticker: marketData.ticker,
    capitalAtRiskPerShare: riskPerShare,
    positionLots: risk.positionSize.lots,
    totalShares: risk.positionSize.shares,
    totalValue: risk.positionSize.positionValue,
    maxLoss: risk.positionSize.maxLoss,
    riskRewardRatio: risk.rr1,
    arbWarning,
    overallRiskRating,
    idxTickSize: tickSize,
    roundedEntry,
    roundedStopLoss,
    advice,
  };
}
