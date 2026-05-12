import type {
  ContextResult,
  MacroSignalSnapshot,
  MacroSkillReport,
} from "@/pipeline/types";

export function runMacroSkill(input: {
  ticker: string
  sector: string
  macroSignals: MacroSignalSnapshot
  context: ContextResult
}): MacroSkillReport {
  const { ticker, sector, macroSignals, context } = input;
  const riskFactors = [...macroSignals.gaps];
  const keyDrivers = [...macroSignals.keyDrivers];

  if (context.marketRegime === "DEFENSIVE") {
    keyDrivers.push({ factor: "IHSG regime defensive", impact: "negative" });
  } else if (context.marketRegime === "AGGRESSIVE") {
    keyDrivers.push({ factor: "IHSG regime aggressive", impact: "positive" });
  }

  if (/bank|financial/i.test(sector)) {
    keyDrivers.push({
      factor: "Banking sector is sensitive to BI rate and credit growth",
      impact: macroSignals.biRate == null ? "neutral" : "positive",
    });
  } else if (/property|real estate|automotive/i.test(sector)) {
    keyDrivers.push({
      factor: "Rate-sensitive sector",
      impact: macroSignals.biRate == null ? "neutral" : "negative",
    });
  } else if (/energy|material|mining/i.test(sector)) {
    keyDrivers.push({
      factor: "Commodity-linked sector",
      impact: macroSignals.commodityBias ? "positive" : "neutral",
    });
  }

  let score = 5;
  if (context.marketRegime === "AGGRESSIVE") score += 2;
  if (context.marketRegime === "DEFENSIVE") score -= 2;
  if (macroSignals.keyDrivers.some((item) => item.impact === "positive")) score += 1;
  if (macroSignals.gaps.length >= 3) score -= 1;
  const macroSentimentScore = Math.max(1, Math.min(10, score));

  if (context.riskStance === "RISK-OFF") {
    riskFactors.push("Risk-off market stance may compress upside");
  }
  if (macroSignals.usdIdr == null) {
    riskFactors.push("USD/IDR feed missing, so importer/exporter sensitivity is approximated");
  }

  return {
    ticker,
    sector,
    macroSentimentScore,
    keyDrivers,
    riskFactors,
    summary: `${sector} macro backdrop scored ${macroSentimentScore}/10 with ${context.marketRegime.toLowerCase()} regime and ${macroSignals.gaps.length} missing macro feed(s).`,
    missingData: macroSignals.gaps,
  };
}
