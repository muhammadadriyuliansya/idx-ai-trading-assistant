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
  if (analysis.indicators.trend !== "bullish") improvements.push("tren harus berubah naik");
  if (analysis.indicators.volumeRatio < 1.5) improvements.push("volume harus naik di atas 1.5x rata-rata");
  if (analysis.risk.rr1 < 2) improvements.push("Risk/Reward harus di atas 2.0");
  if (analysis.context.marketRegime === "DEFENSIVE") {
    improvements.push("kondisi IHSG harus keluar dari mode defensif");
  }

  return improvements.length > 0
    ? improvements.join(", ")
    : "Setup sudah lewat filter utama. Tinggal disiplin eksekusi yang jadi penentu.";
}
