import type {
  FundamentalEnrichment,
  FundamentalSkillReport,
  FundamentalSnapshot,
} from "@/pipeline/types";

function computeCagr(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (clean.length < 2) return null;
  const first = clean[clean.length - 1];
  const last = clean[0];
  const periods = clean.length - 1;
  if (first <= 0 || last <= 0 || periods <= 0) return null;
  return Math.pow(last / first, 1 / periods) - 1;
}

export function runFundamentalSkill(input: {
  ticker: string
  fundamental: FundamentalSnapshot | null
  enrichment: FundamentalEnrichment
}): FundamentalSkillReport {
  const { ticker, fundamental, enrichment } = input;
  const revenueSeries = enrichment.historical.map((item) => item.revenue);
  const profitSeries = enrichment.historical.map((item) => item.netIncome);
  const revenueCagr = computeCagr(revenueSeries);
  const netProfitCagr = computeCagr(profitSeries);
  const benchmark = enrichment.industryBenchmark;
  const sector = enrichment.sector ?? "Unknown";
  const redFlags: string[] = [];

  const keyRatios = {
    per: fundamental?.per ?? null,
    pbv: fundamental?.pbv ?? null,
    roe: fundamental?.roe ?? null,
    der: fundamental?.der ?? null,
    npm: enrichment.netProfitMargin ?? null,
    dividendYield: fundamental?.dividendYield ?? null,
  };

  if (revenueCagr != null && netProfitCagr != null && netProfitCagr < revenueCagr - 0.1) {
    redFlags.push("Net profit growth lags revenue growth");
  }
  if (keyRatios.der != null && keyRatios.der > 200) {
    redFlags.push("Debt to equity is elevated");
  }
  if (keyRatios.npm != null && keyRatios.npm < 0.05) {
    redFlags.push("Net profit margin is thin");
  }
  if (enrichment.gaps.length > 0) {
    redFlags.push(...enrichment.gaps.slice(0, 2));
  }

  let valuationOpinion: FundamentalSkillReport["valuationOpinion"] = "fairly valued";
  if (
    keyRatios.per != null &&
    benchmark?.per != null &&
    keyRatios.per < benchmark.per * 0.9 &&
    (keyRatios.roe ?? 0) >= 0.12
  ) {
    valuationOpinion = "undervalued";
  } else if (
    keyRatios.per != null &&
    benchmark?.per != null &&
    keyRatios.per > benchmark.per * 1.2
  ) {
    valuationOpinion = "overvalued";
  }

  let verdict: FundamentalSkillReport["industryComparison"]["verdict"] = "average";
  if ((keyRatios.per ?? Infinity) < ((benchmark?.per ?? Infinity) * 0.9) || (keyRatios.pbv ?? Infinity) < ((benchmark?.pbv ?? Infinity) * 0.9)) {
    verdict = "below average";
  } else if ((keyRatios.per ?? 0) > ((benchmark?.per ?? 0) * 1.1) || (keyRatios.pbv ?? 0) > ((benchmark?.pbv ?? 0) * 1.1)) {
    verdict = "above average";
  }

  let score = 5;
  if (valuationOpinion === "undervalued") score += 2;
  if ((keyRatios.roe ?? 0) >= 0.15) score += 1;
  if ((keyRatios.der ?? 999) <= 100) score += 1;
  if ((revenueCagr ?? 0) > 0.05) score += 1;
  if (redFlags.length >= 2) score -= 2;
  const fundamentalScore = Math.max(1, Math.min(10, score));

  return {
    ticker,
    sector,
    revenueCagr,
    netProfitCagr,
    keyRatios,
    industryComparison: {
      perIndustryAvg: benchmark?.per ?? null,
      pbvIndustryAvg: benchmark?.pbv ?? null,
      verdict,
    },
    redFlags,
    valuationOpinion,
    fundamentalScore,
    summary: `${sector} sector, valuation ${valuationOpinion}, score ${fundamentalScore}/10${redFlags.length > 0 ? `, ${redFlags.length} red flag(s)` : ""}.`,
  };
}
