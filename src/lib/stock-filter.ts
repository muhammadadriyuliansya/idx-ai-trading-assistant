import type { RiskCalcResult, ScannerInput } from "./types";
import { computeRisk, calculateRiskReward } from "./calc";

export interface TradingConfig {
  capital: number;
  riskPerTrade: number;
  targetProfit: number;
}

export const DEFAULT_SMALL_CAPITAL_CONFIG: TradingConfig = {
  capital: 1_000_000,
  riskPerTrade: 1,
  targetProfit: 1,
};

export const DEFAULT_MEDIUM_CAPITAL_CONFIG: TradingConfig = {
  capital: 5_000_000,
  riskPerTrade: 1.5,
  targetProfit: 1.5,
};

export const DEFAULT_LARGE_CAPITAL_CONFIG: TradingConfig = {
  capital: 10_000_000,
  riskPerTrade: 2,
  targetProfit: 2,
};

export const VALID_CAPITAL_RANGE = {
  min: 1_000_000,
  max: 10_000_000,
} as const;

export const VALID_RISK_RANGE = {
  min: 1,
  max: 2,
} as const;

export const VALID_PROFIT_RANGE = {
  min: 1,
  max: 2,
} as const;

export interface StockFilterCriteria {
  minCapital: number;
  maxCapital: number;
  minRiskPct: number;
  maxRiskPct: number;
  minProfitPct: number;
  maxProfitPct: number;
  minRR: number;
  minSetupScore: number;
  maxPositionSize: number;
}

export const DEFAULT_FILTER_CRITERIA: StockFilterCriteria = {
  minCapital: 1_000_000,
  maxCapital: 10_000_000,
  minRiskPct: 1,
  maxRiskPct: 2,
  minProfitPct: 1,
  maxProfitPct: 2,
  minRR: 1.0,
  minSetupScore: 50,
  maxPositionSize: 10_000_000,
};

export interface AppliedStockResult {
  ticker: string;
  isApplied: boolean;
  reasons: string[];
  config: TradingConfig;
  riskResult: RiskCalcResult | null;
  rr: number;
  setupScore: number;
  maxLoss: number;
  positionValue: number;
  lotSize: number;
  estimatedProfit: number;
}

export function isValidCapital(capital: number): boolean {
  return capital >= VALID_CAPITAL_RANGE.min && capital <= VALID_CAPITAL_RANGE.max;
}

export function isValidRiskPct(riskPct: number): boolean {
  return riskPct >= VALID_RISK_RANGE.min && riskPct <= VALID_RISK_RANGE.max;
}

export function isValidProfitPct(profitPct: number): boolean {
  return profitPct >= VALID_PROFIT_RANGE.min && profitPct <= VALID_PROFIT_RANGE.max;
}

export function validateTradingConfig(config: TradingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isValidCapital(config.capital)) {
    errors.push(`Capital must be between 1-10 million IDR`);
  }
  if (!isValidRiskPct(config.riskPerTrade)) {
    errors.push(`Risk per trade must be between 1-2%`);
  }
  if (!isValidProfitPct(config.targetProfit)) {
    errors.push(`Target profit must be between 1-2%`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function analyzeStockForApplied(
  ticker: string,
  scanner: ScannerInput,
  config: TradingConfig = DEFAULT_SMALL_CAPITAL_CONFIG
): AppliedStockResult {
  const reasons: string[] = [];
  let isApplied = true;

  const validation = validateTradingConfig(config);
  if (!validation.valid) {
    return {
      ticker,
      isApplied: false,
      reasons: validation.errors,
      config,
      riskResult: null,
      rr: 0,
      setupScore: 0,
      maxLoss: 0,
      positionValue: 0,
      lotSize: 0,
      estimatedProfit: 0,
    };
  }

  if (config.capital < VALID_CAPITAL_RANGE.min || config.capital > VALID_CAPITAL_RANGE.max) {
    reasons.push(`Capital ${config.capital.toLocaleString("id-ID")} outside valid range (1-10JT)`);
    isApplied = false;
  }

  if (config.riskPerTrade < VALID_RISK_RANGE.min || config.riskPerTrade > VALID_RISK_RANGE.max) {
    reasons.push(`Risk ${config.riskPerTrade}% outside valid range (1-2%)`);
    isApplied = false;
  }

  const price = parseFloat(scanner.currentPrice);
  const support = parseFloat(scanner.support);
  const resistance = parseFloat(scanner.resistance);

  if (isNaN(price) || isNaN(support) || isNaN(resistance)) {
    reasons.push("Invalid price/support/resistance values");
    isApplied = false;
  }

  const rr = calculateRiskReward(price, support, resistance);
  if (rr < 1.0) {
    reasons.push(`RR ${rr.toFixed(2)} below minimum 1.0`);
  }

  const riskResult = computeRisk({
    ticker,
    currentPrice: scanner.currentPrice,
    support: scanner.support,
    resistance: scanner.resistance,
    atr: "0",
    capital: config.capital.toString(),
    riskPerTrade: config.riskPerTrade.toString(),
  });

  if (!riskResult) {
    reasons.push("Failed to calculate risk parameters");
    isApplied = false;
  } else {
    if (riskResult.maxLoss > config.capital * (config.riskPerTrade / 100) * 2) {
      reasons.push(`Max loss exceeds risk budget`);
      isApplied = false;
    }

    if (riskResult.positionValue > config.capital * 0.5) {
      reasons.push(`Position size too large (>50% capital)`);
      isApplied = false;
    }

    const estimatedProfit = riskResult.positionValue * (config.targetProfit / 100);
    if (estimatedProfit < 10000) {
      reasons.push(`Potential profit too small (<10K)`);
    }

    if (rr < 1.0) {
      isApplied = false;
    }
  }

  const setupScore = calculateSetupScoreSimple(scanner);
  if (setupScore < 50) {
    reasons.push(`Setup score ${setupScore} below minimum 50`);
    isApplied = false;
  }

  return {
    ticker,
    isApplied,
    reasons: isApplied ? ["All criteria met"] : reasons,
    config,
    riskResult,
    rr,
    setupScore,
    maxLoss: riskResult?.maxLoss ?? 0,
    positionValue: riskResult?.positionValue ?? 0,
    lotSize: riskResult?.lots ?? 0,
    estimatedProfit: riskResult 
      ? riskResult.positionValue * (config.targetProfit / 100)
      : 0,
  };
}

function calculateSetupScoreSimple(input: ScannerInput): number {
  let score = 0;

  const price = parseFloat(input.currentPrice);
  const ema20 = parseFloat(input.ema20);
  const ema50 = parseFloat(input.ema50);

  if (!isNaN(price) && !isNaN(ema20) && price > ema20) score += 10;
  if (!isNaN(ema20) && !isNaN(ema50) && ema20 > ema50) score += 10;

  const rsi = parseFloat(input.rsi);
  if (!isNaN(rsi) && rsi >= 40 && rsi <= 70) score += 10;

  const vol = parseFloat(input.todayVolume);
  const avgVol = parseFloat(input.avgVolume20d);
  if (!isNaN(vol) && !isNaN(avgVol) && avgVol > 0 && vol >= avgVol) score += 10;

  if (input.ihsgTrend.toLowerCase().includes("bull")) score += 10;

  return score;
}

export function filterAppliedStocks(
  stocks: Array<{ ticker: string; scanner: ScannerInput }>,
  config: TradingConfig = DEFAULT_SMALL_CAPITAL_CONFIG
): AppliedStockResult[] {
  return stocks.map(stock => analyzeStockForApplied(stock.ticker, stock.scanner, config));
}

export function getAppliedOnly(
  results: AppliedStockResult[]
): AppliedStockResult[] {
  return results.filter(r => r.isApplied);
}

export function getRejectedOnly(
  results: AppliedStockResult[]
): AppliedStockResult[] {
  return results.filter(r => !r.isApplied);
}

export function sortByRR(results: AppliedStockResult[]): AppliedStockResult[] {
  return [...results].sort((a, b) => b.rr - a.rr);
}

export function sortByProfit(results: AppliedStockResult[]): AppliedStockResult[] {
  return [...results].sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}