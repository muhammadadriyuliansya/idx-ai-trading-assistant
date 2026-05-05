export type Provider = "openai" | "anthropic";

export interface AISettings {
  provider: Provider;
  openaiKey: string;
  anthropicKey: string;
  openaiModel: string;
  anthropicModel: string;
}

export interface ScannerInput {
  ticker: string;
  currentPrice: string;
  open: string;
  high: string;
  low: string;
  previousClose: string;
  todayVolume: string;
  avgVolume20d: string;
  ema20: string;
  ema50: string;
  ema200: string;
  vwap: string;
  rsi: string;
  macd: string;
  stochastic: string;
  foreignFlow: string;
  brokerAccumulation: string;
  ihsgTrend: string;
  sectorStrength: string;
  resistance: string;
  support: string;
}

export interface RiskInput {
  ticker: string;
  currentPrice: string;
  support: string;
  resistance: string;
  atr: string;
  capital: string;
  riskPerTrade: string;
}

export interface ContextInput {
  ihsgTrend: string;
  foreignFlow: string;
  usMarket: string;
  commodityTrend: string;
  interestRate: string;
  usdIdr: string;
  sector: string;
  sectorStrength: string;
}

export interface DecisionInput {
  ticker: string;
  setupScore: string;
  confidence: string;
  trend: string;
  volume: string;
  momentum: string;
  marketContext: string;
  riskReward: string;
  entry: string;
  stopLoss: string;
  target: string;
}

export interface JournalInput {
  ticker: string;
  entry: string;
  exit: string;
  stopLoss: string;
  target: string;
  result: string;
  holdingTime: string;
  entryReason: string;
  marketCondition: string;
  emotion: string;
}

export type ModuleKey =
  | "scanner"
  | "risk"
  | "context"
  | "decision"
  | "journal";

export interface SavedSetup {
  id: string;
  module: ModuleKey;
  ticker: string;
  createdAt: number;
  payload: unknown;
  output?: string;
}

export interface RiskCalcResult {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskPerShare: number;
  rewardPerShare1: number;
  rewardPerShare2: number;
  riskReward1: number;
  riskReward2: number;
  downsidePct: number;
  upsidePct1: number;
  upsidePct2: number;
  maxLoss: number;
  shares: number;
  lots: number;
  positionValue: number;
}

export interface SetupScoreBreakdown {
  trend: number;
  momentum: number;
  volume: number;
  context: number;
  rrQuality: number;
  total: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  status: "VALID" | "WATCHLIST" | "REJECT";
}

export interface QuoteResult {
  ticker: string;
  fetchedAt: number;
  scanner: Partial<ScannerInput>;
  risk: Partial<RiskInput>;
  meta: {
    barsCount: number;
    lastBarDate: string;
    trend: "bullish" | "sideways" | "bearish";
    macdLabel: string;
    stochLabel: string;
    ihsgTrend: "bullish" | "sideways" | "bearish" | "unknown";
    ihsgChange1d?: number;
    ihsgChange5d?: number;
    volRatio: number;
    source?: "live" | "cache";
  };
  fundamental?: {
    per: number | null;
    pbv: number | null;
    dividendYield: number | null;
    marketCap: number | null;
    roe: number | null;
    der: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    eps: number | null;
  } | null;
}
