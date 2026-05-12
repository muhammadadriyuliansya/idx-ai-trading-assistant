import type {
  DecisionResult,
  RiskGovernorState,
  RiskResult,
  TechnicalSkillReport,
  FundamentalSkillReport,
  MacroSkillReport,
  ThesisDebateSkillReport,
} from "@/pipeline/types";

export function runThesisDebaterSkill(input: {
  ticker: string
  technical: TechnicalSkillReport
  fundamental: FundamentalSkillReport
  macro: MacroSkillReport
  riskSkill: { overallRiskRating: "acceptable" | "moderate" | "high"; riskRewardRatio: number }
  risk: RiskResult
  decision: DecisionResult
  riskGovernor: RiskGovernorState
}): ThesisDebateSkillReport {
  const { ticker, technical, fundamental, macro, riskSkill, risk, decision, riskGovernor } = input;
  const bullCasePoints: string[] = [];
  const bearCasePoints: string[] = [];

  if (technical.technicalScore >= 7) bullCasePoints.push(`Technical score ${technical.technicalScore}/10 with ${technical.primaryTrend} primary trend`);
  if (fundamental.valuationOpinion === "undervalued") bullCasePoints.push("Valuation looks undemanding versus sector benchmark");
  if (macro.macroSentimentScore >= 6) bullCasePoints.push(`Macro backdrop supportive at ${macro.macroSentimentScore}/10`);
  if (riskSkill.riskRewardRatio >= 2) bullCasePoints.push(`Risk/reward ${riskSkill.riskRewardRatio.toFixed(2)} is acceptable`);

  if (technical.idxArbAraAlert !== "none") bearCasePoints.push(`IDX ${technical.idxArbAraAlert} band was touched`);
  if (riskSkill.overallRiskRating !== "acceptable") bearCasePoints.push(`Risk skill flags ${riskSkill.overallRiskRating} risk`);
  if (fundamental.redFlags.length > 0) bearCasePoints.push(...fundamental.redFlags.slice(0, 2));
  if (macro.riskFactors.length > 0) bearCasePoints.push(macro.riskFactors[0]);
  if (!riskGovernor.entryAllowed) bearCasePoints.push(`Daily guard blocks entry: ${riskGovernor.noTradeReason ?? riskGovernor.status}`);

  const bullWeight = bullCasePoints.length;
  const bearWeight = bearCasePoints.length;
  const debateWinner =
    bullWeight > bearWeight ? "bulls" :
    bearWeight > bullWeight ? "bears" :
    "draw";

  let confidenceScore = Math.round((technical.technicalScore + fundamental.fundamentalScore + macro.macroSentimentScore) / 3);
  if (!riskGovernor.entryAllowed) confidenceScore = Math.min(confidenceScore, 4);
  confidenceScore = Math.max(1, Math.min(10, confidenceScore));

  let preferredSetup: ThesisDebateSkillReport["recommendedSetup"] = "hold";
  if (fundamental.valuationOpinion === "undervalued" && technical.primaryTrend !== "bearish") {
    preferredSetup = "value_buy";
  } else if (technical.technicalScore >= 7 && risk.rr1 >= 2) {
    preferredSetup = "swing_buy";
  } else if (riskSkill.overallRiskRating === "high") {
    preferredSetup = "reduce";
  } else if (decision.finalDecision === "WATCHLIST") {
    preferredSetup = "hold";
  }

  const recommendedSetup =
    !riskGovernor.entryAllowed || decision.finalDecision === "NO_TRADE"
      ? "stay_away"
      : preferredSetup;

  const advisoryConflict =
    decision.finalDecision === "REJECT" && (preferredSetup === "swing_buy" || preferredSetup === "value_buy")
      ? "Skill layer sees upside, but deterministic engine rejects the setup."
      : !riskGovernor.entryAllowed && (preferredSetup === "swing_buy" || preferredSetup === "value_buy")
      ? "Skill layer is constructive, but daily guard keeps the trade closed."
      : null;

  const thesis =
    debateWinner === "bulls"
      ? `Bias constructive for ${ticker}, but execution should stay disciplined around support and stop placement.`
      : debateWinner === "bears"
      ? `Risk still dominates the case for ${ticker}, so capital preservation matters more than chasing a setup.`
      : `Evidence is mixed for ${ticker}; this is better treated as a monitored idea than an immediate trade.`;

  return {
    ticker,
    bullCasePoints,
    bearCasePoints,
    debateWinner,
    thesis,
    confidenceScore,
    recommendedSetup,
    executionPlan: {
      entry: Number(risk.entryZone.split("-")[0]?.trim()) || null,
      stopLoss: Number(risk.stopLoss) || null,
      target1: Number(risk.tp1) || null,
      target2: Number(risk.tp2) || null,
    },
    advisoryConflict,
  };
}
