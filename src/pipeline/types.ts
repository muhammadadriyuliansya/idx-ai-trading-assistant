/**
 * Core types for the unified analysis pipeline
 */

// ============================================================================
// MARKET DATA
// ============================================================================

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

// ============================================================================
// INDICATORS
// ============================================================================

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

// ============================================================================
// AGENT RESULTS
// ============================================================================

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
  finalDecision: 'BUY_NOW' | 'WAIT' | 'WATCHLIST' | 'REJECT'
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
// ANALYSIS PIPELINE
// ============================================================================

export interface AnalysisPipeline {
  ticker: string
  timestamp: number

  // Raw data
  marketData: MarketData
  indicators: IndicatorSet

  // Agent results
  scanner: ScannerResult
  risk: RiskResult
  context: ContextResult
  debate: DebateResult
  decision: DecisionResult

  // Final metrics
  finalScore: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'VALID' | 'WATCHLIST' | 'REJECT'
}

// ============================================================================
// MARKET SCANNER
// ============================================================================

export interface ScanCandidate {
  ticker: string
  setupScore: number
  volumeRatio: number
  rr: number
  trend: string
  status: 'VALID' | 'WATCHLIST' | 'REJECT'
  marketData: MarketData
  indicators: IndicatorSet
}

export interface ScanOptions {
  tickers: string[]
  minVolumeRatio?: number
  minRR?: number
  minSetupScore?: number
  maxResults?: number
}

// ============================================================================
// FILTERS
// ============================================================================

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

// ============================================================================
// AGENT INPUTS
// ============================================================================

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