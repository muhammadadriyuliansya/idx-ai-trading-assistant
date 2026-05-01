# IDX AI Trading Assistant - Architecture Refactor Plan

## Problem Statement

Current architecture is fragmented with disconnected manual modules. Each module works independently requiring repeated manual input, creating duplicated workflow and poor UX.

## Target Architecture

Transform into unified automated analysis pipeline with:
- Central orchestrator controlling entire flow
- Shared analysis state across all modules
- Automated market scanning and ranking
- One-click analysis from ticker selection
- Display-only modules (no repeated inputs)

## New Folder Structure

```
src/
├── agents/
│   ├── scanner/
│   │   ├── agent.ts          # Scanner agent implementation
│   │   ├── prompt.ts         # Scanner prompt logic
│   │   └── types.ts          # Scanner-specific types
│   ├── risk/
│   │   ├── agent.ts          # Risk agent implementation
│   │   ├── prompt.ts         # Risk prompt logic
│   │   └── types.ts          # Risk-specific types
│   ├── context/
│   │   ├── agent.ts          # Context agent implementation
│   │   ├── prompt.ts         # Context prompt logic
│   │   └── types.ts          # Context-specific types
│   ├── debate/
│   │   ├── agent.ts          # Debate agent implementation
│   │   ├── prompt.ts         # Debate prompt logic
│   │   └── types.ts          # Debate-specific types
│   ├── decision/
│   │   ├── agent.ts          # Decision agent implementation
│   │   ├── prompt.ts         # Decision prompt logic
│   │   └── types.ts          # Decision-specific types
│   └── orchestrator.ts       # Central orchestrator
├── pipeline/
│   ├── types.ts              # Pipeline interfaces
│   ├── scanner.ts            # Automated market scanner
│   └── filters.ts            # Hard filters before AI
├── lib/
│   ├── ai-provider.ts        # Low-level AI wrapper
│   ├── indicators.ts         # Technical indicators (existing)
│   ├── calc.ts               # Calculations (existing)
│   ├── quote.ts              # Data fetching (existing)
│   └── types.ts              # Shared types (existing)
└── components/
    ├── modules/
    │   ├── scanner-display.tsx    # Scanner display component
    │   ├── risk-display.tsx       # Risk display component
    │   ├── context-display.tsx   # Context display component
    │   ├── debate-display.tsx    # Debate display component
    │   └── decision-display.tsx  # Decision display component
    ├── market-scan.tsx            # Market scan UI
    └── analysis-pipeline.tsx     # Unified pipeline display
```

## Core Interfaces

### 1. Analysis Pipeline Interface

```typescript
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
```

### 2. Market Data Interface

```typescript
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
```

### 3. Indicator Set Interface

```typescript
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
```

### 4. Agent Result Interfaces

```typescript
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
}
```

## Central Orchestrator

### Responsibilities

1. Fetch market data for ticker
2. Calculate all technical indicators
3. Apply hard filters (deterministic)
4. Run scanner agent
5. Run risk agent
6. Run context agent
7. Run debate agent
8. Run decision agent
9. Return unified pipeline result

### Implementation Flow

```typescript
export async function runFullAnalysis(
  ticker: string,
  settings: AISettings
): Promise<AnalysisPipeline> {

  // 1. Fetch market data
  const marketData = await fetchMarketData(ticker)

  // 2. Calculate indicators
  const indicators = calculateIndicators(marketData)

  // 3. Apply hard filters
  const filterResult = applyHardFilters(marketData, indicators)
  if (!filterResult.passed) {
    return createRejectedPipeline(ticker, marketData, indicators, filterResult.reason)
  }

  // 4. Run scanner agent
  const scanner = await runScannerAgent({
    marketData,
    indicators,
    settings
  })

  // 5. Run risk agent
  const risk = await runRiskAgent({
    marketData,
    indicators,
    scanner,
    settings
  })

  // 6. Run context agent
  const context = await runContextAgent({
    marketData,
    indicators,
    settings
  })

  // 7. Run debate agent
  const debate = await runDebateAgent({
    scanner,
    risk,
    context,
    settings
  })

  // 8. Run decision agent
  const decision = await runDecisionAgent({
    scanner,
    risk,
    context,
    debate,
    settings
  })

  // 9. Calculate final score
  const finalScore = calculateFinalScore(scanner, risk, context, debate, decision)

  return {
    ticker,
    timestamp: Date.now(),
    marketData,
    indicators,
    scanner,
    risk,
    context,
    debate,
    decision,
    finalScore,
    confidence: scanner.confidence,
    status: scanner.status
  }
}
```

## Automated Market Scanner

### Responsibilities

1. Scan multiple IDX tickers
2. Fetch OHLC data for each
3. Calculate indicators
4. Apply hard filters
5. Calculate setup scores
6. Rank opportunities
7. Return top candidates

### Implementation

```typescript
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

export async function runMarketScan(
  tickers: string[],
  settings: AISettings
): Promise<ScanCandidate[]> {

  const candidates: ScanCandidate[] = []

  for (const ticker of tickers) {
    try {
      // Fetch data
      const marketData = await fetchMarketData(ticker)
      const indicators = calculateIndicators(marketData)

      // Apply hard filters
      const filterResult = applyHardFilters(marketData, indicators)
      if (!filterResult.passed) continue

      // Calculate setup score
      const setupScore = calculateSetupScore(marketData, indicators)

      // Calculate RR
      const rr = calculateRiskReward(
        marketData.currentPrice,
        marketData.support,
        marketData.resistance
      )

      candidates.push({
        ticker,
        setupScore,
        volumeRatio: indicators.volumeRatio,
        rr,
        trend: indicators.trend,
        status: setupScore >= 70 ? 'VALID' : setupScore >= 50 ? 'WATCHLIST' : 'REJECT',
        marketData,
        indicators
      })
    } catch (error) {
      console.error(`Failed to scan ${ticker}:`, error)
    }
  }

  // Sort by setup score
  return candidates
    .sort((a, b) => b.setupScore - a.setupScore)
    .filter(c => c.status === 'VALID' || c.status === 'WATCHLIST')
}
```

## Hard Filters (Before AI)

### Deterministic Filters

```typescript
export interface FilterResult {
  passed: boolean
  reason?: string
}

export function applyHardFilters(
  marketData: MarketData,
  indicators: IndicatorSet
): FilterResult {

  // Volume filter
  if (indicators.volumeRatio < 1.5) {
    return { passed: false, reason: 'Volume too low' }
  }

  // Trend filter
  if (indicators.trend === 'bearish' && marketData.currentPrice < indicators.ema20) {
    return { passed: false, reason: 'Bearish trend below EMA20' }
  }

  // RR filter
  const rr = calculateRiskReward(
    marketData.currentPrice,
    marketData.support,
    marketData.resistance
  )
  if (rr < 2.0) {
    return { passed: false, reason: 'Risk/Reward below 2.0' }
  }

  // Average volume filter
  if (marketData.avgVolume20d < 1000000) {
    return { passed: false, reason: 'Average volume too low' }
  }

  // Price range filter
  const priceRange = (marketData.high - marketData.low) / marketData.currentPrice
  if (priceRange < 0.02) {
    return { passed: false, reason: 'Price range too narrow' }
  }

  return { passed: true }
}
```

## Multi-Agent Structure

### Agent Template

```typescript
export interface AgentInput<T> {
  data: T
  settings: AISettings
}

export interface AgentOutput<T> {
  result: T
  reasoning: string
  confidence: number
}

export abstract class Agent<TInput, TOutput> {
  abstract name: string
  abstract systemPrompt: string

  async execute(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>> {
    const userPrompt = this.buildUserPrompt(input.data)
    const response = await callAIProvider({
      system: this.systemPrompt,
      user: userPrompt,
      settings: input.settings
    })
    return this.parseResponse(response)
  }

  protected abstract buildUserPrompt(data: TInput): string
  protected abstract parseResponse(response: string): AgentOutput<TOutput>
}
```

### Agent Implementations

Each agent extends the base Agent class with specific:
- Input type
- Output type
- System prompt
- User prompt builder
- Response parser

## Refactored AI Layer

### Low-Level Provider Wrapper

```typescript
export interface AIProviderRequest {
  system: string
  user: string
  settings: AISettings
}

export interface AIProviderResponse {
  text: string
  provider: 'openai' | 'anthropic'
  model: string
}

export async function callAIProvider(
  request: AIProviderRequest
): Promise<AIProviderResponse> {

  const { system, user, settings } = request
  const provider = settings.provider
  const apiKey = provider === 'openai' ? settings.openaiKey : settings.anthropicKey
  const model = provider === 'openai' ? settings.openaiModel : settings.anthropicModel

  if (!apiKey) {
    throw new Error(`${provider} API key not configured`)
  }

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, apiKey, system, user })
  })

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`)
  }

  const data = await response.json()
  return {
    text: data.text,
    provider,
    model: data.model
  }
}
```

## Display Components

### Component Structure

Each module becomes a display-only component:

```typescript
interface ScannerDisplayProps {
  result: ScannerResult
  marketData: MarketData
  indicators: IndicatorSet
}

export function ScannerDisplay({ result, marketData, indicators }: ScannerDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <Title>Scanner Analysis</Title>
        <StatusBadge status={result.status} />
      </CardHeader>
      <CardContent>
        <SetupScoreBar score={result.setupScore} />
        <KeyReads reads={result.keyReads} />
        <Warnings warnings={result.warnings} />
        <ActionPlan plan={result.actionPlan} />
        <Reasoning text={result.reasoning} />
      </CardContent>
    </Card>
  )
}
```

## User Flow

### New UX Flow

1. **Market Scan**
   - User clicks "Scan Market"
   - App scans watchlist automatically
   - Displays ranked opportunities
   - Shows setup scores and key metrics

2. **Detailed Analysis**
   - User clicks on a ticker
   - Orchestrator runs full pipeline automatically
   - All modules display results simultaneously
   - User sees unified analysis with final decision

3. **No Manual Input Required**
   - All data fetched automatically
   - All calculations done locally
   - AI only analyzes filtered candidates
   - One-click from scan to decision

## Implementation Priority

### Phase 1: Core Infrastructure (Week 1)
1. Create pipeline types and interfaces
2. Implement central orchestrator
3. Refactor AI layer to provider wrapper
4. Create hard filter system

### Phase 2: Agent Implementation (Week 1-2)
1. Implement scanner agent
2. Implement risk agent
3. Implement context agent
4. Implement debate agent
5. Implement decision agent

### Phase 3: Market Scanner (Week 2)
1. Implement automated market scanner
2. Create ranking system
3. Build scan results display

### Phase 4: UI Refactor (Week 2-3)
1. Create display components
2. Build unified pipeline display
3. Implement new user flow
4. Remove manual input forms

### Phase 5: Testing & Polish (Week 3)
1. End-to-end testing
2. Performance optimization
3. Error handling improvements
4. Documentation updates

## Key Architectural Decisions

### 1. Shared State Over Isolated Modules
**Decision**: Single shared pipeline object vs isolated module state
**Rationale**: Eliminates data duplication, ensures consistency, simplifies flow

### 2. Hard Filters Before AI
**Decision**: Deterministic filtering before AI analysis
**Rationale**: Reduces AI calls, improves quality, saves costs, faster response

### 3. Agent Pattern
**Decision**: Modular agents with strict interfaces
**Rationale**: Testability, maintainability, clear separation of concerns

### 4. Display-Only Components
**Decision**: Components only display orchestrator output
**Rationale**: Eliminates duplicate logic, ensures single source of truth

### 5. Low-Level AI Provider
**Decision**: AI layer only handles provider communication
**Rationale**: Separation of concerns, easier to test, swap providers

### 6. No External Dependencies
**Decision**: Keep architecture simple, no Redis/RabbitMQ
**Rationale**: Maintainable, suitable for personal use, avoids complexity

## Success Criteria

✅ One-click analysis from ticker selection
✅ No repeated manual input across modules
✅ Shared analysis pipeline state
✅ Central orchestrator controls flow
✅ Automated market scanning and ranking
✅ Hard filters before AI analysis
✅ Display-only module components
✅ Clean multi-agent structure
✅ Lightweight, maintainable architecture

## Migration Strategy

### Backward Compatibility
- Keep existing API routes
- Preserve current UI design
- Maintain localStorage structure
- Gradual component replacement

### Data Migration
- Migrate existing setups to new pipeline format
- Preserve user settings and preferences
- Maintain trade journal data

### Testing Strategy
- Unit tests for each agent
- Integration tests for orchestrator
- E2E tests for user flows
- Performance tests for market scanning

This refactor transforms the app from fragmented manual modules into a unified automated analysis pipeline while maintaining simplicity and avoiding overengineering.