export interface MarketData {
  ticker: string
  currentPrice: number
  open: number
  high: number
  low: number
  previousClose: number
  todayVolume: number
  avgVolume20d: number
  support: number
  resistance: number
  atr: number
  fetchedAt: number
}

export interface DataHealth {
  status: 'GOOD' | 'DEGRADED' | 'STALE' | 'BAD'
  score: number
  lastUpdate: string
  barsCount: number
  issues: string[]
  source: 'live' | 'cache' | 'fallback'
  hasFundamental: boolean
  hasNews: boolean
}

export interface MACDResult {
  macd: number
  signal: number
  histogram: number
  label: string
}

export interface StochasticResult {
  k: number
  d: number
  label: string
}

export interface IndicatorSet {
  ema20: number
  ema50: number
  ema200: number
  vwap: number
  rsi: number
  macd: MACDResult
  stochastic: StochasticResult
  trend: 'bullish' | 'sideways' | 'bearish'
  volumeRatio: number
}

export interface ScannerResult {
  setupType: 'breakout' | 'pullback' | 'reversal' | 'distribution' | 'fake' | 'no_setup'
  setupScore: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'VALID' | 'WATCHLIST' | 'REJECT'
  keyReads: string[]
  warnings: string[]
  actionPlan: string
  reasoning: string
}

export interface RiskResult {
  ticker: string
  currentPrice: number
  support: number
  resistance: number
  capital: number
  riskPerTrade: number
  riskBudget: number
  entryZone: string
  stopLoss: string
  stopReason: string
  tp1: string
  tp1Reason: string
  tp2: string
  tp2Reason: string
  rr1: number
  rr2: number
  positionSize: {
    lots: number
    shares: number
    maxLoss: number
    positionValue: number
  }
  verdict: 'ACCEPT' | 'ADJUST' | 'REJECT'
  reasoning: string
}

export interface ContextResult {
  marketRegime: 'AGGRESSIVE' | 'NORMAL' | 'DEFENSIVE'
  riskStance: 'RISK-ON' | 'NEUTRAL' | 'RISK-OFF'
  sectorTake: string
  flowRead: string
  keyRisks: string[]
  strategyBias: string
  reasoning: string
}

export interface DebateResult {
  bullishArguments: string[]
  bearishArguments: string[]
  consensus: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence: number
  keyFactors: string[]
  reasoning: string
}

export interface DecisionResult {
  finalDecision: 'BUY_NOW' | 'WAIT' | 'WATCHLIST' | 'REJECT' | 'NO_TRADE'
  confidenceScore: number
  successProbability: number
  keyEdge: string
  keyRisk: string
  bullishScenario: string
  bearishScenario: string
  executionNotes: string
  reasoning: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  urgency: 'immediate' | 'soon' | 'monitor'
}

// ============================================================================
// MARKET INTELLIGENCE LAYER (Phase 1)
// ============================================================================

export interface NewsIntelligence {
  sources: NewsSource[]
  totalArticles: number
  recentHeadlines: string[]
  dominantSentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number
  keyTopics: string[]
}

export interface NewsSource {
  name: string
  articles: number
  sentiment: number
}

export interface SocialSentiment {
  score: number
  volume: number
  momentum: 'rising' | 'falling' | 'stable'
  mentions: number
  positiveRatio: number
  negativeRatio: number
  neutralRatio: number
  topKeywords: string[]
}

export interface MacroContext {
  volatilityState: 'low' | 'normal' | 'high' | 'extreme'
  sectorMomentum: string
  liquidityCondition: 'liquid' | 'normal' | 'tight'
  globalCue: 'risk-on' | 'neutral' | 'risk-off'
  marketBreadth: string
}

// ============================================================================
// ANALYST TEAM (Phase 2)
// ============================================================================

export interface AnalystReport {
  agent: string
  bias: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  score: number
  summary: string
  signals: string[]
  risks: string[]
}

// ============================================================================
// RESEARCH DEBATE SYSTEM (Phase 3)
// ============================================================================

export interface DebateMatrix {
  bullCase: string[]
  bearCase: string[]
  consensusScore: number
  conflictScore: number
  dominantBias: 'bullish' | 'bearish' | 'neutral'
}

// ============================================================================
// INSTITUTIONAL THESIS (Phase 4)
// ============================================================================

export interface InstitutionalThesis {
  title: string
  executiveSummary: string
  technicalThesis: string[]
  fundamentalThesis: string[]
  sentimentThesis: string[]
  opportunities: string[]
  risks: string[]
  conviction: number
}

// ============================================================================
// PORTFOLIO MANAGER (Phase 5)
// ============================================================================

export interface PortfolioDecision {
  action: 'APPROVED' | 'WATCHLIST' | 'REJECTED' | 'REDUCE_SIZE'
  conviction: number
  reasoning: string[]
  recommendedRiskPercent: number
}

export type TradingMode = 'swing' | 'day'

export interface DailyGuardSnapshot {
  realizedPnl: number
  tradesTaken: number
  journalTradeCount?: number
  journalExpectancyR?: number
  journalProfitFactor?: number
  maxDrawdownPct?: number
}

export interface RiskGovernorGate {
  label: string
  passed: boolean
  reason: string
}

export interface RiskGovernorState {
  mode: TradingMode
  status: 'OPEN' | 'PROFIT_LOCK' | 'TARGET_LOCK' | 'DAILY_STOP' | 'MAX_TRADES' | 'NO_TRADE' | 'REVIEW_ONLY'
  canOpenNewTrade: boolean
  entryAllowed: boolean
  dailyTargetPct: number
  dailyHardStopPct: number
  fullStopProfitPct: number
  maxTrades: number
  realizedPnl: number
  realizedPct: number
  tradesTaken: number
  remainingDailyRisk: number
  requestedRiskPerTrade: number
  baseRiskPerTrade: number
  effectiveRiskPerTrade: number
  recommendedRiskPerTrade: number
  riskQualifiedForScaleUp: boolean
  gates: RiskGovernorGate[]
  notes: string[]
  noTradeReason?: string
}

// ============================================================================
// ANALYSIS PIPELINE (Enhanced)
// ============================================================================

export interface AnalysisPipeline {
  ticker: string
  timestamp: number

  marketData: MarketData
  indicators: IndicatorSet
  dataHealth: DataHealth

  scanner: ScannerResult
  risk: RiskResult
  context: ContextResult
  debate: DebateResult
  decision: DecisionResult

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

  // Phase 1 — Market Intelligence
  newsIntelligence: NewsIntelligence
  socialSentiment: SocialSentiment
  macroContext: MacroContext

  // Phase 2 — Analyst Reports
  analystReports: AnalystReport[]

  // Phase 3 — Research Debate
  debateMatrix: DebateMatrix

  // Phase 4 — Institutional Thesis
  thesis: InstitutionalThesis

  // Phase 5 — Portfolio Manager
  portfolioDecision: PortfolioDecision
  riskGovernor: RiskGovernorState

  finalScore: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'VALID' | 'WATCHLIST' | 'REJECT' | 'NO_TRADE'
}

// ============================================================================
// MARKET SCANNER
// ============================================================================

export interface ScanCandidate {
  ticker: string
  mode: 'conservative' | 'swing' | 'day' | 'premarket'
  setupScore: number
  scoreBreakdown: {
    trend: number
    momentum: number
    volume: number
    context: number
    rrQuality: number
  }
  volumeRatio: number
  rr: number
  trend: string
  status: 'VALID' | 'WATCHLIST' | 'REJECT'
  reason: string
  nextTrigger: string
  invalidation: string
  miniBacktest: {
    outcome: 'TP' | 'SL' | 'OPEN'
    horizonDays: number
    estimatedReturnPct: number
    maxDrawdownPct: number
  }
  dataHealth: DataHealth
  marketData: MarketData
  indicators: IndicatorSet
}

export interface ScanOptions {
  tickers: string[]
  mode?: 'conservative' | 'swing' | 'day' | 'premarket'
  minVolumeRatio?: number
  minRR?: number
  minSetupScore?: number
  maxResults?: number
}

export interface FilterResult {
  passed: boolean
  reason?: string
}

export interface FilterConfig {
  minVolumeRatio?: number
  minRR?: number
  minAvgVolume?: number
  minPriceRange?: number
  requireBullishTrend?: boolean
}

export interface ScannerAgentInput {
  marketData: MarketData
  indicators: IndicatorSet
}

export interface RiskAgentInput {
  marketData: MarketData
  indicators: IndicatorSet
  scanner: ScannerResult
}

export interface ContextAgentInput {
  marketData: MarketData
  indicators: IndicatorSet
}

export interface DebateAgentInput {
  scanner: ScannerResult
  risk: RiskResult
  context: ContextResult
}

export interface DecisionAgentInput {
  scanner: ScannerResult
  risk: RiskResult
  context: ContextResult
  debate: DebateResult
}
