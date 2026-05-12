import type {
  FundamentalEnrichment,
  FundamentalSnapshot,
  MacroDriver,
  MacroSignalSnapshot,
} from "@/pipeline/types";

const SECTOR_BENCHMARKS: Array<{
  match: RegExp;
  label: string;
  per: number;
  pbv: number;
}> = [
  { match: /bank|financial/i, label: "IDX Banking", per: 13, pbv: 2.0 },
  { match: /consumer|food|beverage/i, label: "IDX Consumer", per: 19, pbv: 2.6 },
  { match: /telecom|communication/i, label: "IDX Telecom", per: 15, pbv: 2.3 },
  { match: /energy|coal|oil|gas/i, label: "IDX Energy", per: 9, pbv: 1.5 },
  { match: /material|mining|metal/i, label: "IDX Materials", per: 10, pbv: 1.6 },
  { match: /property|real estate/i, label: "IDX Property", per: 11, pbv: 0.9 },
  { match: /industrial|infrastructure/i, label: "IDX Industrials", per: 12, pbv: 1.4 },
];

function fallbackBenchmark() {
  return {
    per: null,
    pbv: null,
    label: "Sector benchmark unavailable",
  };
}

export function buildFundamentalEnrichment(fundamental: (FundamentalSnapshot & {
  sector?: string | null;
  industry?: string | null;
  netProfitMargin?: number | null;
  forwardPe?: number | null;
  historical?: Array<{ year: string; revenue: number | null; netIncome: number | null }>;
}) | null): FundamentalEnrichment {
  const gaps: string[] = [];

  if (!fundamental) {
    return {
      source: "fallback",
      sector: null,
      industry: null,
      netProfitMargin: null,
      dividendYield: null,
      forwardPe: null,
      priceToBook: null,
      historical: [],
      industryBenchmark: fallbackBenchmark(),
      gaps: ["Yahoo fundamental snapshot unavailable"],
    };
  }

  const benchmark =
    SECTOR_BENCHMARKS.find((item) => item.match.test(fundamental.sector ?? "")) ?? null;

  if (!fundamental.sector) gaps.push("Sector metadata unavailable");
  if (!fundamental.historical?.length) gaps.push("3-year income history unavailable");
  if (fundamental.netProfitMargin == null) gaps.push("Net profit margin unavailable");
  if (!benchmark) gaps.push("Industry benchmark unavailable");

  return {
    source: "yahoo",
    sector: fundamental.sector ?? null,
    industry: fundamental.industry ?? null,
    netProfitMargin: fundamental.netProfitMargin ?? null,
    dividendYield: fundamental.dividendYield ?? null,
    forwardPe: fundamental.forwardPe ?? null,
    priceToBook: fundamental.pbv ?? null,
    historical: fundamental.historical ?? [],
    industryBenchmark: benchmark
      ? { per: benchmark.per, pbv: benchmark.pbv, label: benchmark.label }
      : fallbackBenchmark(),
    gaps,
  };
}

function inferCommodityBias(sector: string | null | undefined): string | null {
  if (!sector) return null;
  if (/energy|coal|oil|gas/i.test(sector)) return "Sensitive to energy and coal prices";
  if (/material|mining|metal/i.test(sector)) return "Sensitive to metal and mining commodity cycles";
  if (/consumer|industrial|health/i.test(sector)) return "Sensitive to imported input costs and domestic demand";
  return null;
}

export function buildMacroSignals(input: {
  sector: string | null | undefined;
  ihsgChange1d?: number;
  ihsgChange5d?: number;
  usdIdr?: number | null;
  biRate?: number | null;
  inflation?: number | null;
}): MacroSignalSnapshot {
  const gaps: string[] = [];
  const keyDrivers: MacroDriver[] = [];

  if (typeof input.ihsgChange5d === "number") {
    keyDrivers.push({
      factor: `IHSG 5d ${input.ihsgChange5d >= 0 ? "+" : ""}${input.ihsgChange5d.toFixed(2)}%`,
      impact: input.ihsgChange5d > 1 ? "positive" : input.ihsgChange5d < -1 ? "negative" : "neutral",
    });
  } else {
    gaps.push("IHSG 5-day context unavailable");
  }

  if (typeof input.ihsgChange1d === "number") {
    keyDrivers.push({
      factor: `IHSG 1d ${input.ihsgChange1d >= 0 ? "+" : ""}${input.ihsgChange1d.toFixed(2)}%`,
      impact: input.ihsgChange1d > 0.5 ? "positive" : input.ihsgChange1d < -0.5 ? "negative" : "neutral",
    });
  } else {
    gaps.push("IHSG 1-day context unavailable");
  }

  const commodityBias = inferCommodityBias(input.sector);
  if (commodityBias) {
    keyDrivers.push({
      factor: commodityBias,
      impact: /energy|metal|mining/i.test(commodityBias) ? "positive" : "neutral",
    });
  }

  if (input.biRate == null) gaps.push("BI rate not connected yet");
  if (input.inflation == null) gaps.push("Inflation feed not connected yet");
  if (input.usdIdr == null) gaps.push("USD/IDR live feed not connected yet");

  return {
    source: "derived",
    biRate: input.biRate ?? null,
    inflation: input.inflation ?? null,
    usdIdr: input.usdIdr ?? null,
    sp500Change1d: null,
    dxyProxy: null,
    commodityBias,
    policyCatalyst: null,
    keyDrivers,
    gaps,
  };
}
