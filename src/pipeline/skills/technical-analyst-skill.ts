import { calculateAutoRejectBounds } from "@/lib/idx";
import { bollingerBands, classifyTrend } from "@/lib/indicators";
import type {
  DetectedPattern,
  IndicatorSet,
  MarketBar,
  MarketData,
  TechnicalPriceLevel,
  TechnicalSkillReport,
} from "@/pipeline/types";

interface TechnicalSkillInput {
  marketData: MarketData
  indicators: IndicatorSet
  recentBars: MarketBar[]
}

function buildLevels(
  values: number[],
  currentPrice: number,
  side: "support" | "resistance",
): TechnicalPriceLevel[] {
  const filtered = values
    .filter((value) => Number.isFinite(value))
    .filter((value) => side === "support" ? value <= currentPrice : value >= currentPrice);
  const unique = [...new Set(filtered.map((value) => Math.round(value)))];

  return unique.slice(0, 3).map((price, index) => ({
    price,
    strength: index === 0 ? "strong" : index === 1 ? "medium" : "weak",
  }));
}

function detectPatterns(bars: MarketBar[], marketData: MarketData, indicators: IndicatorSet): DetectedPattern[] {
  if (bars.length < 30) return [];

  const slice = bars.slice(-30);
  const highs = slice.map((bar) => bar.high);
  const lows = slice.map((bar) => bar.low);
  const volumes = slice.map((bar) => bar.volume);
  const last = slice[slice.length - 1];
  const prev = slice[slice.length - 2];
  const patterns: DetectedPattern[] = [];

  const highRange = Math.max(...highs);
  const lowRange = Math.min(...lows);
  const rangePct = ((highRange - lowRange) / Math.max(lowRange, 1)) * 100;
  const avgVolume = volumes.slice(0, -1).reduce((sum, value) => sum + value, 0) / Math.max(volumes.length - 1, 1);

  if (Math.abs(last.close - marketData.resistance) / Math.max(marketData.resistance, 1) < 0.015) {
    patterns.push({
      name: "ascending_triangle_candidate",
      quality: indicators.volumeRatio > 1.2 ? "high" : "medium",
    });
  }

  if (rangePct < 12 && indicators.volumeRatio > 1.2) {
    patterns.push({
      name: "symmetrical_triangle_candidate",
      quality: "medium",
    });
  }

  const lastFiveLows = lows.slice(-10);
  const low1 = Math.min(...lastFiveLows.slice(0, 5));
  const low2 = Math.min(...lastFiveLows.slice(5));
  if (Math.abs(low1 - low2) / Math.max(low1, 1) < 0.03 && last.close > prev.close) {
    patterns.push({
      name: "double_bottom_candidate",
      quality: indicators.rsi < 45 ? "high" : "medium",
    });
  }

  const body = Math.abs(last.close - last.open);
  const range = Math.max(last.high - last.low, 1);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  if (lowerWick / range > 0.45 && body / range < 0.35) {
    patterns.push({ name: "hammer", quality: last.volume > avgVolume ? "high" : "medium" });
  }
  if (upperWick / range > 0.45 && body / range < 0.35) {
    patterns.push({ name: "shooting_star", quality: last.volume > avgVolume ? "high" : "medium" });
  }

  return patterns.slice(0, 4);
}

function momentumCondition(rsi: number): "oversold" | "neutral" | "overbought" {
  if (rsi <= 30) return "oversold";
  if (rsi >= 70) return "overbought";
  return "neutral";
}

export function runTechnicalSkill(input: TechnicalSkillInput): TechnicalSkillReport {
  const { marketData, indicators, recentBars } = input;
  const closes = recentBars.map((bar) => bar.close);
  const higherTimeframeTrend = closes.length >= 50 ? classifyTrend(closes) : indicators.trend;
  const bands = closes.length >= 20 ? bollingerBands(closes) : null;
  const bandState = bands ? bands.percentB[bands.percentB.length - 1] : 50;
  const { lower, upper } = calculateAutoRejectBounds(marketData.previousClose);
  const touchedUpper = marketData.high >= upper;
  const touchedLower = marketData.low <= lower;

  const supportLevels = buildLevels(
    [marketData.support, indicators.ema20, indicators.ema50, marketData.low],
    marketData.currentPrice,
    "support",
  );
  const resistanceLevels = buildLevels(
    [marketData.resistance, indicators.ema20, indicators.ema50, marketData.high],
    marketData.currentPrice,
    "resistance",
  );
  const patternDetected = detectPatterns(recentBars, marketData, indicators);

  let trendStrength: TechnicalSkillReport["trendStrength"] = "weak";
  if (higherTimeframeTrend === indicators.trend && indicators.volumeRatio >= 1.2) trendStrength = "strong";
  else if (higherTimeframeTrend === indicators.trend || indicators.volumeRatio >= 1) trendStrength = "moderate";

  const macdLabel = indicators.macd.label.toLowerCase();
  const macdSignal =
    macdLabel.includes("bull") ? "bullish" :
    macdLabel.includes("bear") ? "bearish" :
    "none";

  let score = 5;
  if (indicators.trend === "bullish") score += 2;
  if (higherTimeframeTrend === "bullish") score += 1;
  if (indicators.volumeRatio >= 1.2) score += 1;
  if (bandState < 15 || bandState > 85) score -= 1;
  if (touchedLower || touchedUpper) score -= 1;
  const technicalScore = Math.max(1, Math.min(10, score));

  const riskLevel =
    technicalScore >= 8 && !touchedLower && !touchedUpper ? "low" :
    technicalScore >= 5 ? "medium" :
    "high";

  return {
    ticker: marketData.ticker,
    primaryTrend: higherTimeframeTrend,
    secondaryTrend: indicators.trend,
    trendStrength,
    momentum: {
      rsi: {
        value: indicators.rsi,
        condition: momentumCondition(indicators.rsi),
      },
      macd: {
        signal: macdSignal,
        details: indicators.macd.label,
      },
    },
    supportLevels,
    resistanceLevels,
    patternDetected,
    idxArbAraAlert: touchedUpper ? "ARA" : touchedLower ? "ARB" : "none",
    arbAraRange: { lower, upper },
    riskLevel,
    technicalScore,
    summary: `Primary trend ${higherTimeframeTrend}, secondary trend ${indicators.trend}, RSI ${indicators.rsi.toFixed(1)}, volume ${indicators.volumeRatio.toFixed(2)}x, technical score ${technicalScore}/10.`,
  };
}
