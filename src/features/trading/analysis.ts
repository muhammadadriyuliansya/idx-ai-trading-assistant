import type { AnalysisRunOptions } from "@/pipeline/orchestrator";
import type { AnalysisPipeline, TradingMode } from "@/pipeline/types";
import type { ScanMode } from "./types";

export function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getPipelineOptions(
  capital: string,
  riskPerTrade: string,
): AnalysisRunOptions | null {
  const parsedCapital = parsePositiveNumber(capital);
  const parsedRisk = parsePositiveNumber(riskPerTrade);

  if (!parsedCapital || !parsedRisk || parsedRisk > 10) {
    return null;
  }

  return {
    capital: parsedCapital,
    riskPerTrade: parsedRisk,
  };
}

export function normalizeAnalysisMode(mode: ScanMode): TradingMode {
  return mode === "day" ? "day" : "swing";
}

export function buildImprovementText(analysis: AnalysisPipeline): string {
  const improvements: string[] = [];
  if (analysis.indicators.trend !== "bullish") improvements.push("trend must turn bullish");
  if (analysis.indicators.volumeRatio < 1.5) improvements.push("volume must rise above 1.5x");
  if (analysis.risk.rr1 < 2) improvements.push("RR should improve above 2.0");
  if (analysis.context.marketRegime === "DEFENSIVE") {
    improvements.push("IHSG regime should stop being defensive");
  }

  return improvements.length > 0
    ? improvements.join(", ")
    : "Setup already meets the main improvement gates; execution discipline is the key constraint.";
}
