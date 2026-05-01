# IDX AI Trading Assistant - Quick Start Guide

## New Architecture Overview

The app has been refactored from fragmented manual modules into a unified automated analysis pipeline.

## File Structure

```
src/
├── agents/                          # Multi-agent system
│   ├── scanner/
│   │   ├── agent.ts                # Scanner agent implementation
│   │   ├── prompt.ts               # Scanner prompt templates
│   │   └── types.ts                # Scanner-specific types
│   ├── risk/
│   │   └── agent.ts                # Risk agent implementation
│   ├── context/
│   │   └── agent.ts                # Context agent implementation
│   ├── debate/
│   │   └── agent.ts                # Debate agent implementation
│   ├── decision/
│   │   └── agent.ts                # Decision agent implementation
│   └── orchestrator.ts             # Central agent coordinator
│
├── pipeline/                        # Core pipeline infrastructure
│   ├── types.ts                    # Pipeline interfaces
│   ├── filters.ts                  # Hard filters before AI
│   ├── scanner.ts                  # Automated market scanner
│   └── orchestrator.ts             # Central orchestrator
│
├── lib/
│   ├── ai-provider.ts              # Low-level AI wrapper (NEW)
│   ├── ai.ts                       # Original AI integration (KEEP)
│   ├── indicators.ts               # Technical indicators (KEEP)
│   ├── calc.ts                     # Calculations (KEEP)
│   ├── quote.ts                    # Data fetching (KEEP)
│   ├── storage.ts                  # Storage helpers (KEEP)
│   ├── types.ts                    # Shared types (KEEP)
│   └── utils.ts                    # Utilities (KEEP)
│
└── components/
    ├── modules/
    │   └── scanner-display.tsx     # Example display component (NEW)
    ├── modules.tsx                 # Original modules (KEEP for now)
    └── ...                        # Other components (KEEP)
```

## Quick Start

### 1. Run Full Analysis Pipeline

```typescript
import { runAnalysisPipeline } from '@/agents/orchestrator'
import { DEFAULT_SETTINGS } from '@/lib/ai'

// Run complete analysis for a ticker
const pipeline = await runAnalysisPipeline('BBRI', DEFAULT_SETTINGS)

// Access results
console.log('Setup Score:', pipeline.scanner.setupScore)
console.log('Risk/Reward:', pipeline.risk.rr1)
console.log('Final Decision:', pipeline.decision.finalDecision)
console.log('Final Score:', pipeline.finalScore)
```

### 2. Run Market Scanner

```typescript
import { runMarketScan, getDefaultIDXTickers } from '@/pipeline/scanner'

// Scan market for opportunities
const candidates = await runMarketScan({
  tickers: getDefaultIDXTickers(),
  minVolumeRatio: 1.5,
  minRR: 2.0,
  minSetupScore: 60,
  maxResults: 10,
})

// View top opportunities
candidates.forEach((candidate, index) => {
  console.log(
    `${index + 1}. ${candidate.ticker}: ${candidate.setupScore}/100 ` +
    `- ${candidate.status} - RR: ${candidate.rr.toFixed(2)}`
  )
})
```

### 3. Use Display Components

```typescript
import { ScannerDisplay } from '@/components/modules/scanner-display'

function AnalysisView({ pipeline }: { pipeline: AnalysisPipeline }) {
  return (
    <div className="space-y-6">
      <ScannerDisplay
        result={pipeline.scanner}
        marketData={pipeline.marketData}
        indicators={pipeline.indicators}
      />
      {/* Add other display components here */}
    </div>
  )
}
```

## Key Concepts

### 1. Analysis Pipeline

The `AnalysisPipeline` interface contains all analysis results:

```typescript
interface AnalysisPipeline {
  ticker: string
  timestamp: number
  marketData: MarketData
  indicators: IndicatorSet
  scanner: ScannerResult
  risk: RiskResult
  context: ContextResult
  debate: DebateResult
  decision: DecisionResult
  finalScore: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'VALID' | 'WATCHLIST' | 'REJECT'
}
```

### 2. Hard Filters

Before AI analysis, deterministic filters reject weak setups:

```typescript
import { applyHardFilters } from '@/pipeline/filters'

const filterResult = applyHardFilters(marketData, indicators)

if (!filterResult.passed) {
  console.log('Rejected:', filterResult.reason)
}
```

### 3. Agent System

Each agent has specific responsibilities:

- **Scanner Agent**: Analyzes technical setups
- **Risk Agent**: Validates risk parameters
- **Context Agent**: Analyzes market context
- **Debate Agent**: Facilitates bullish/bearish debate
- **Decision Agent**: Makes final trading decision

## Migration Guide

### For Existing Code

**Old Way (Manual Input):**
```typescript
// Each module required manual input
const scannerInput = { ticker: 'BBRI', currentPrice: '5100', ... }
const riskInput = { ticker: 'BBRI', support: '5000', ... }
// ... repeated for each module
```

**New Way (Automated Pipeline):**
```typescript
// Single call runs entire pipeline
const pipeline = await runAnalysisPipeline('BBRI', settings)
// All results available in pipeline object
```

### For UI Components

**Old Way (Mixed UI + Logic):**
```typescript
// Components had their own state and logic
function ScannerModule() {
  const [input, setInput] = useState(SCANNER_DEFAULTS)
  const [result, setResult] = useState(null)
  // ... lots of component logic
}
```

**New Way (Display-Only):**
```typescript
// Components only display pipeline results
function ScannerDisplay({ result, marketData, indicators }) {
  // Pure display logic, no business logic
  return <div>{/* display results */}</div>
}
```

## API Reference

### Pipeline Functions

#### `runAnalysisPipeline(ticker, settings)`
Run complete analysis pipeline for a ticker.

**Parameters:**
- `ticker: string` - Stock ticker (e.g., 'BBRI')
- `settings: AISettings` - AI provider settings

**Returns:** `Promise<AnalysisPipeline>`

#### `runMarketScan(options)`
Scan multiple tickers for opportunities.

**Parameters:**
- `options.tickers: string[]` - List of tickers to scan
- `options.minVolumeRatio?: number` - Minimum volume ratio (default: 1.5)
- `options.minRR?: number` - Minimum risk/reward (default: 2.0)
- `options.minSetupScore?: number` - Minimum setup score (default: 50)
- `options.maxResults?: number` - Maximum results to return (default: 20)

**Returns:** `Promise<ScanCandidate[]>`

### Filter Functions

#### `applyHardFilters(marketData, indicators, config?)`
Apply deterministic filters before AI analysis.

**Parameters:**
- `marketData: MarketData` - Market data for ticker
- `indicators: IndicatorSet` - Calculated indicators
- `config?: FilterConfig` - Optional filter configuration

**Returns:** `FilterResult`

## Configuration

### Default Filters

```typescript
import { DEFAULT_FILTERS } from '@/pipeline/filters'

console.log(DEFAULT_FILTERS)
// {
//   minVolumeRatio: 1.5,
//   minRR: 2.0,
//   minAvgVolume: 1000000,
//   minPriceRange: 0.02,
//   requireBullishTrend: false
// }
```

### Custom Filters

```typescript
const customFilters = {
  minVolumeRatio: 2.0,      // Stricter volume requirement
  minRR: 2.5,              // Higher RR requirement
  minAvgVolume: 5000000,   // Higher volume requirement
  requireBullishTrend: true // Only bullish setups
}

const filterResult = applyHardFilters(marketData, indicators, customFilters)
```

## Error Handling

### Pipeline Errors

```typescript
try {
  const pipeline = await runAnalysisPipeline('BBRI', settings)
  // Use pipeline results
} catch (error) {
  console.error('Analysis failed:', error)
  // Handle error appropriately
}
```

### Scanner Errors

```typescript
try {
  const candidates = await runMarketScan({
    tickers: ['BBRI', 'BBCA', 'INVALID'],
    maxResults: 10,
  })
  // Some tickers may fail, but successful ones are returned
} catch (error) {
  console.error('Scan failed:', error)
}
```

## Performance Tips

### 1. Batch Market Scans

```typescript
// Good: Scan multiple tickers at once
const candidates = await runMarketScan({
  tickers: getDefaultIDXTickers(),
  maxResults: 20,
})

// Avoid: Running individual analyses for many tickers
for (const ticker of tickers) {
  await runAnalysisPipeline(ticker, settings) // Slow!
}
```

### 2. Use Hard Filters

```typescript
// Good: Filter before AI analysis
const filterResult = applyHardFilters(marketData, indicators)
if (filterResult.passed) {
  // Only run AI on good setups
  const pipeline = await runAnalysisPipeline(ticker, settings)
}

// Avoid: Running AI on all setups
const pipeline = await runAnalysisPipeline(ticker, settings) // Wasteful!
```

### 3. Cache Results

```typescript
// Good: Cache pipeline results
const cache = new Map<string, AnalysisPipeline>()

async function getCachedAnalysis(ticker: string) {
  if (cache.has(ticker)) {
    return cache.get(ticker)!
  }
  const pipeline = await runAnalysisPipeline(ticker, settings)
  cache.set(ticker, pipeline)
  return pipeline
}
```

## Testing

### Unit Tests

```typescript
import { applyHardFilters } from '@/pipeline/filters'
import { createMockMarketData, createMockIndicators } from './test-utils'

test('should reject low volume setups', () => {
  const marketData = createMockMarketData()
  const indicators = createMockIndicators({ volumeRatio: 1.0 })

  const result = applyHardFilters(marketData, indicators)

  expect(result.passed).toBe(false)
  expect(result.reason).toContain('Volume')
})
```

### Integration Tests

```typescript
import { runAnalysisPipeline } from '@/agents/orchestrator'
import { TEST_SETTINGS } from './test-utils'

test('should run complete pipeline', async () => {
  const pipeline = await runAnalysisPipeline('BBRI', TEST_SETTINGS)

  expect(pipeline.ticker).toBe('BBRI')
  expect(pipeline.scanner).toBeDefined()
  expect(pipeline.risk).toBeDefined()
  expect(pipeline.decision).toBeDefined()
})
```

## Troubleshooting

### Common Issues

**Issue:** "AI provider error: API key not configured"
**Solution:** Ensure API keys are set in settings

**Issue:** "Failed to fetch data for TICKER"
**Solution:** Verify ticker is valid and listed on IDX

**Issue:** Pipeline takes too long
**Solution:** Use hard filters to reduce AI calls, or adjust scan batch size

**Issue:** Memory usage high
**Solution:** Cache results selectively, avoid storing large pipelines

## Next Steps

1. **Explore the codebase:** Read through the new pipeline and agent files
2. **Try the examples:** Run the quick start examples
3. **Build UI components:** Create display components for each module
4. **Integrate with app:** Replace old manual flow with new pipeline
5. **Add features:** Implement watchlist, notifications, etc.

## Support

For detailed documentation, see:
- `REFACTOR_PLAN.md` - Complete architecture plan
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- `ARCHITECTURE_MAPPING.md` - Original architecture analysis

## License

This refactored architecture maintains the same license as the original project.