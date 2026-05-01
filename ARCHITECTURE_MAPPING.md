# IDX AI Trading Assistant - Architecture Mapping untuk Full Automation

## Current Stack Overview

### Frontend Layer
- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: TailwindCSS v4 + shadcn/ui-style primitives
- **State**: React hooks + localStorage
- **Animations**: framer-motion

### Backend Layer
- **API Routes**: `/api/ai` (OpenAI/Anthropic proxy), `/api/quote` (Yahoo Finance)
- **Runtime**: Node.js runtime dengan force-dynamic
- **Data Source**: Yahoo Finance (yahoo-finance2 library)

### Business Logic Layer
- **Technical Indicators**: `src/lib/indicators.ts` (EMA, RSI, MACD, ATR, VWAP, Stochastic, Swing Levels)
- **Risk Calculations**: `src/lib/calc.ts` (Position sizing, RR, Setup scoring)
- **AI Integration**: `src/lib/ai.ts` (OpenAI/Anthropic wrapper)
- **Prompt System**: `src/lib/prompts.ts` (Modular prompts per module)

### Data Layer
- **Persistence**: localStorage (settings, setups, trade history)
- **Types**: `src/lib/types.ts` (TypeScript interfaces)
- **Storage Helpers**: `src/lib/storage.ts`

## Current Module Architecture

### 1. Market Scanner Module (`src/components/modules.tsx` - Scanner)
**Status**: ✅ IMPLEMENTED

**Current Capabilities:**
- Manual input atau auto-fetch dari Yahoo Finance
- Technical indicator calculations (EMA20/50/200, RSI, MACD, Stochastic, VWAP)
- Setup scoring (0-100) dengan breakdown:
  - Trend score (max 30)
  - Momentum score (max 20)
  - Volume score (max 20)
  - Context score (max 20)
  - RR Quality score (max 10)
- Confidence classification (LOW/MEDIUM/HIGH)
- Status classification (VALID/WATCHLIST/REJECT)
- AI-powered setup analysis dengan hedge fund voice

**Data Flow:**
```
User Input/Auto-fetch → Indicator Calculations → Setup Scoring → AI Analysis → Output
```

**Files:**
- Component: `src/components/modules.tsx` (Scanner section)
- Logic: `src/lib/calc.ts` (calculateSetupScore)
- Indicators: `src/lib/indicators.ts`
- Prompts: `src/lib/prompts.ts` (SYSTEM_PROMPTS.scanner)

### 2. Risk Management Module (`src/components/modules.tsx` - Risk)
**Status**: ✅ IMPLEMENTED

**Current Capabilities:**
- Auto-calculation entry/stop/target dari support/resistance
- ATR-based stop loss calculation
- Position sizing dengan IDX lot size (100 shares)
- Risk/reward ratio calculation (TP1 & TP2)
- Max loss calculation
- AI validation dan refinement

**Data Flow:**
```
User Input → Risk Calculations → AI Validation → Output
```

**Files:**
- Component: `src/components/modules.tsx` (Risk section)
- Logic: `src/lib/calc.ts` (computeRisk, calculatePositionSize)
- Prompts: `src/lib/prompts.ts` (SYSTEM_PROMPTS.risk)

### 3. Market Context Module (`src/components/modules.tsx` - Context)
**Status**: ✅ IMPLEMENTED

**Current Capabilities:**
- Manual input untuk market context
- IHSG trend analysis (auto dari Yahoo Finance)
- Foreign flow analysis
- US market correlation
- Commodity trend analysis
- Sector strength analysis
- AI-powered market regime determination

**Data Flow:**
```
User Input + IHSG Data → AI Analysis → Market Regime Output
```

**Files:**
- Component: `src/components/modules.tsx` (Context section)
- Data: `src/app/api/quote/route.ts` (IHSG data)
- Prompts: `src/lib/prompts.ts` (SYSTEM_PROMPTS.context)

### 4. Decision Engine Module (`src/components/modules.tsx` - Decision)
**Status**: ✅ IMPLEMENTED

**Current Capabilities:**
- Aggregates semua module outputs
- Final verdict generation (BUY NOW/WAIT/WATCHLIST/REJECT)
- Confidence scoring (0-100)
- Success probability estimation
- Bullish/bearish scenario analysis
- Execution notes

**Data Flow:**
```
Scanner + Risk + Context Outputs → Decision Engine → Final Verdict
```

**Files:**
- Component: `src/components/modules.tsx` (Decision section)
- Prompts: `src/lib/prompts.ts` (SYSTEM_PROMPTS.decision)

### 5. Trade Journal Module (`src/components/modules.tsx` - Journal)
**Status**: ✅ IMPLEMENTED

**Current Capabilities:**
- Post-trade evaluation
- Trade quality scoring (0-100)
- Execution scoring (0-100)
- Emotional discipline scoring (0-100)
- Behavioral flag detection (FOMO, revenge, dll)
- Lessons learned generation
- Next time checklist

**Data Flow:**
```
Trade Result Input → AI Analysis → Performance Metrics
```

**Files:**
- Component: `src/components/modules.tsx` (Journal section)
- Prompts: `src/lib/prompts.ts` (SYSTEM_PROMPTS.journal)

## TradingAgents Flow Mapping

### Phase 1: Data Collection & Monitoring
**Status**: 🟡 PARTIALLY AUTOMATED

| Component | Current Status | Automation Level | Gaps |
|-----------|----------------|------------------|------|
| **Real-time Price Feed** | Manual trigger via `/api/quote` | 🔴 Manual | Need WebSocket/polling for live updates |
| **Market Scanner** | Manual per-ticker analysis | 🔴 Manual | Need automated watchlist scanning |
| **Volume Monitoring** | Calculated on demand | 🟡 Semi-auto | Need real-time volume alerts |
| **Foreign Flow Data** | Manual input only | 🔴 Manual | Need automated foreign flow data source |
| **Sector Rotation** | Manual input only | 🔴 Manual | Need automated sector analysis |
| **IHSG Context** | Auto from Yahoo Finance | 🟢 Auto | None - already automated |

**Required Additions:**
```typescript
// New files needed:
src/lib/realtime.ts          // WebSocket/polling for live prices
src/lib/watchlist.ts          // Watchlist management & scanning
src/lib/alerts.ts             // Alert system (price, volume, indicator)
src/lib/foreign-flow.ts      // Foreign flow data integration
src/lib/sector-analysis.ts   // Automated sector rotation analysis
```

### Phase 2: Analysis & Decision Making
**Status**: 🟢 CORE LOGIC IMPLEMENTED

| Component | Current Status | Automation Level | Gaps |
|-----------|----------------|------------------|------|
| **Technical Analysis** | AI-powered per module | 🟢 Auto | None - already automated |
| **Setup Scoring** | Heuristic + AI | 🟢 Auto | None - already automated |
| **Risk Management** | Calculated + AI validated | 🟢 Auto | None - already automated |
| **Market Context** | AI-powered analysis | 🟢 Auto | None - already automated |
| **Decision Engine** | AI-powered final verdict | 🟢 Auto | None - already automated |

**Enhancement Opportunities:**
```typescript
// Enhancements needed:
src/lib/strategy-optimizer.ts  // Optimize parameters based on historical performance
src/lib/backtest.ts            // Backtesting engine for strategy validation
src/lib/market-regime-detector.ts // Automated regime detection
```

### Phase 3: Execution & Portfolio Management
**Status**: 🔴 NOT IMPLEMENTED

| Component | Current Status | Automation Level | Gaps |
|-----------|----------------|------------------|------|
| **Order Execution** | Not implemented | 🔴 Manual | Need broker API integration |
| **Position Management** | Not implemented | 🔴 Manual | Need portfolio tracking |
| **Portfolio Rebalancing** | Not implemented | 🔴 Manual | Need automated rebalancing |
| **Risk Monitoring** | Not implemented | 🔴 Manual | Need real-time risk monitoring |
| **P&L Tracking** | Manual journal only | 🔴 Manual | Need automated P&L calculation |

**Required Additions:**
```typescript
// New files needed:
src/lib/broker-api.ts         // Broker API integration (Mirae, Sekuritas, dll)
src/lib/portfolio.ts          // Portfolio management & tracking
src/lib/position-manager.ts   // Position sizing & management
src/lib/risk-monitor.ts       // Real-time risk monitoring
src/lib/pnl-tracker.ts        // Automated P&L tracking & reporting
src/lib/order-executor.ts     // Order execution logic
```

### Phase 4: Performance & Optimization
**Status**: 🟡 PARTIALLY IMPLEMENTED

| Component | Current Status | Automation Level | Gaps |
|-----------|----------------|------------------|------|
| **Trade Journal** | Manual entry + AI analysis | 🟡 Semi-auto | Need auto-import from broker |
| **Performance Analytics** | Basic journal only | 🟡 Semi-auto | Need advanced analytics |
| **Strategy Optimization** | Not implemented | 🔴 Manual | Need ML-based optimization |
| **Risk Analytics** | Basic per-trade only | 🟡 Semi-auto | Need portfolio-level risk analytics |

**Required Additions:**
```typescript
// Enhancements needed:
src/lib/performance-analytics.ts  // Advanced performance metrics
src/lib/strategy-optimizer.ts     // ML-based parameter optimization
src/lib/risk-analytics.ts         // Portfolio-level risk analytics
src/lib/attribution-analysis.ts   // P&L attribution analysis
```

## Full Automation Architecture

### Proposed System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
│  Next.js 16 + TypeScript + TailwindCSS v4 + shadcn/ui       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Market      │  │   Risk       │  │  Decision    │     │
│  │  Scanner     │  │  Manager     │  │  Engine      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Market      │  │   Trade      │  │  Portfolio   │     │
│  │  Context     │  │  Journal     │  │  Manager     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Yahoo       │  │   Broker     │  │  Local       │     │
│  │  Finance     │  │   API        │  │  Storage     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Real-time   │  │  Historical  │  │  AI/ML       │     │
│  │  Data Feed   │  │  Data        │  │  Models      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  IDX Broker  │  │  OpenAI/     │  │  Data        │     │
│  │  APIs        │  │  Anthropic   │  │  Providers   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Roadmap

### Phase 1: Real-time Data Infrastructure (Priority: HIGH)
**Timeline**: 2-3 weeks

**Tasks:**
1. Implement WebSocket/polling for real-time price updates
2. Create watchlist management system
3. Build alert system (price, volume, indicator alerts)
4. Integrate automated foreign flow data source
5. Implement sector rotation analysis

**New Files:**
```
src/lib/realtime.ts          // Real-time data infrastructure
src/lib/watchlist.ts          // Watchlist management
src/lib/alerts.ts             // Alert system
src/lib/foreign-flow.ts      // Foreign flow integration
src/lib/sector-analysis.ts   // Sector analysis
src/app/api/realtime/route.ts // WebSocket endpoint
src/components/realtime-panel.tsx // Real-time UI components
```

### Phase 2: Broker Integration (Priority: HIGH)
**Timeline**: 3-4 weeks

**Tasks:**
1. Research IDX broker APIs (Mirae, Sekuritas lainnya)
2. Implement broker API integration layer
3. Build order execution system
4. Create portfolio management system
5. Implement position tracking

**New Files:**
```
src/lib/broker-api.ts         // Broker API integration
src/lib/order-executor.ts     // Order execution
src/lib/portfolio.ts          // Portfolio management
src/lib/position-manager.ts   // Position tracking
src/app/api/broker/route.ts   // Broker API endpoint
src/components/portfolio-panel.tsx // Portfolio UI
```

### Phase 3: Advanced Analytics (Priority: MEDIUM)
**Timeline**: 2-3 weeks

**Tasks:**
1. Implement backtesting engine
2. Build performance analytics system
3. Create strategy optimization module
4. Implement risk analytics at portfolio level
5. Build attribution analysis

**New Files:**
```
src/lib/backtest.ts            // Backtesting engine
src/lib/performance-analytics.ts  // Performance metrics
src/lib/strategy-optimizer.ts     // Strategy optimization
src/lib/risk-analytics.ts         // Risk analytics
src/lib/attribution-analysis.ts   // Attribution analysis
src/app/api/backtest/route.ts  // Backtesting API
src/components/analytics-panel.tsx // Analytics UI
```

### Phase 4: Automation & Optimization (Priority: MEDIUM)
**Timeline**: 2-3 weeks

**Tasks:**
1. Implement automated trading workflows
2. Build market regime detection system
3. Create automated risk monitoring
4. Implement strategy auto-optimization
5. Build notification system

**New Files:**
```
src/lib/automation-engine.ts  // Automation workflows
src/lib/market-regime-detector.ts // Regime detection
src/lib/risk-monitor.ts       // Risk monitoring
src/lib/notification-system.ts // Notifications
src/app/api/automation/route.ts // Automation API
src/components/automation-panel.tsx // Automation UI
```

## Data Flow Enhancement

### Current Data Flow (Manual)
```
User Input → Manual Fetch → Analysis → Manual Decision → Manual Execution
```

### Enhanced Data Flow (Automated)
```
Real-time Data → Automated Analysis → AI Decision → Auto Execution → Portfolio Update
     ↓              ↓                  ↓              ↓                ↓
  Alerts        Scoring           Verdict        Orders          P&L Tracking
```

## Integration Points

### External APIs Needed
1. **IDX Broker APIs** - Order execution & portfolio data
2. **Real-time Data Providers** - Live price feeds (alternatives to Yahoo Finance)
3. **Foreign Flow Data** - Automated foreign flow tracking
4. **Sector Data** - Automated sector analysis data
5. **Notification Services** - Email/SMS/push notifications

### Internal System Integration
1. **Database** - Replace localStorage with proper database (PostgreSQL/MongoDB)
2. **Cache Layer** - Redis for caching market data and calculations
3. **Message Queue** - RabbitMQ/Redis for async processing
4. **Background Jobs** - Scheduled tasks for data updates and analysis

## Risk Considerations

### Technical Risks
- **API Rate Limits**: Yahoo Finance and broker APIs have rate limits
- **Data Quality**: Real-time data may have delays or errors
- **System Latency**: Automation requires low latency for execution
- **Scalability**: System must handle multiple concurrent operations

### Business Risks
- **Regulatory Compliance**: Automated trading requires regulatory approval
- **Financial Risk**: Automated execution can amplify losses
- **System Reliability**: System failures can result in significant losses
- **Market Risk**: Automated systems may not handle black swan events

### Mitigation Strategies
1. **Circuit Breakers**: Automatic shutdown on extreme conditions
2. **Risk Limits**: Hard limits on position sizes and total exposure
3. **Redundancy**: Multiple data sources and execution pathways
4. **Monitoring**: Real-time monitoring and alerting
5. **Testing**: Extensive testing in sandbox environments

## Success Metrics

### Technical Metrics
- **Latency**: < 100ms for analysis, < 500ms for execution
- **Uptime**: > 99.9% availability
- **Accuracy**: > 95% data accuracy
- **Throughput**: Handle 100+ concurrent operations

### Business Metrics
- **Win Rate**: Target > 60% win rate
- **Risk/Reward**: Average RR > 2.0
- **Max Drawdown**: < 15%
- **Sharpe Ratio**: > 1.5

## Conclusion

Current IDX AI Trading Assistant has solid foundation for semi-automated trading analysis with excellent AI-powered decision making. To achieve full automation, the following gaps need to be addressed:

### Critical Gaps (Must Have)
1. Real-time data infrastructure
2. Broker API integration
3. Order execution system
4. Portfolio management
5. Risk monitoring system

### Important Gaps (Should Have)
1. Automated watchlist scanning
2. Foreign flow automation
3. Sector analysis automation
4. Performance analytics
5. Backtesting capabilities

### Nice to Have (Could Have)
1. Strategy optimization
2. Market regime detection
3. Advanced analytics
4. Notification system
5. Mobile app

The current architecture provides excellent foundation for these enhancements, with modular design that allows incremental implementation of automation features.