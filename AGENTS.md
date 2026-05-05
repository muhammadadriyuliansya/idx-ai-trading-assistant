# AGENTS.md

## Commands

- `npm run dev` — start Next.js 16 dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (eslint-config-next core-web-vitals)
- No test runner, no `tsc` script, no Prettier configured
- TypeScript: `strict: true`, path alias `@/*` → `./src/*`

## Architecture (current)

**Single-page app.** `src/app/page.tsx` is the ONLY user-facing entry point.

```
User enters ticker → runFullAnalysis() → displays results
```

### Two Pipelines

**Legacy pipeline** (simple, still used by main page):
- `src/lib/orchestrator.ts` — `runFullAnalysis()` → scanner → risk → context → decision
- `src/components/displays.tsx` — display components

**Enhanced v2 pipeline** (institutional workstation):
- `src/pipeline/orchestrator.ts` — multi-layer: Market Data → Intelligence → Analysts → Research → Thesis → Portfolio → Decision
- `src/pipeline/analysts/` — deterministic analyst engines (technical, fundamental, news)
- `src/pipeline/research/` — bull/bear researcher + consensus engine
- `src/pipeline/thesis/` — institutional thesis builder
- `src/pipeline/portfolio/` — portfolio approval manager
- `src/components/pipeline-module.tsx` → `use-pipeline.ts` → `pipeline-viewer.tsx`
- `src/lib/export.ts` — institutional export (markdown, JSON, AI-ready prompt)

**Quote API**: `GET /api/quote?ticker=BBRI` — fetches ~260 daily bars via `yahoo-finance2`, computes indicators (EMA, RSI, MACD, ATR, VWAP, swing S/R), and also fetches IHSG (`^JKSE`) and fundamentals. Auto-appends `.JK` suffix.

**News API**: `GET /api/news?ticker=BBRI` — Google News RSS, lexicon-based sentiment.

**AI API**: `POST /api/ai` — proxy to OpenAI or Anthropic. User brings their own API key (stored in browser localStorage only).

**State**: Everything persisted in browser localStorage (`idxai.*` keys). No database, no server-side state.

### ⚠️ Stale directories — do NOT modify

- `src/agents/` — orphaned (not imported by current page.tsx)
- `src/app/page-old.tsx` — dead file
- README architecture section references old structure; trust the code above instead

## Key Business Rules

- **IDX lot size**: 1 lot = 100 shares (hardcoded as `LOT_SIZE` in `src/lib/calc.ts`)
- **Minimum RR**: 1.5 → auto REJECT below this
- **Default RR threshold**: 2.0
- **Market regime**: `AGGRESSIVE` (IHSG bullish + 5d > 0), `DEFENSIVE` (IHSG bearish OR 5d < -1%), else `NORMAL`

## Pipeline v2 Architecture

```
USER INPUT
  ↓
MARKET DATA LAYER  (fetchMarketDataWithIndicators)
  ↓
MARKET INTELLIGENCE  (news from Google News RSS, social sentiment, macro context)
  ↓
ANALYST TEAM  (technical-analyst, fundamental-analyst, news-analyst — all deterministic)
  ↓
RESEARCH DEBATE  (bull-researcher, bear-researcher, consensus-engine)
  ↓
INSTITUTIONAL THESIS  (thesis-builder combines all analysis)
  ↓
PORTFOLIO MANAGER  (approve/watchlist/reject/reduce-size)
  ↓
EXPORT ENGINE  (markdown, JSON, AI-ready prompt)
  ↓
OPTIONAL AI REFINEMENT  (user triggers manually, NOT a pipeline dependency)
```

**All pipeline logic is deterministic.** No LLM calls in the core pipeline.

## Manual Fields (Yahoo Finance has no data for these)

Foreign Flow, Broker Accumulation, Sector Strength — must be input by user or left blank.

## Yahoo Finance Rate Limits

- IP-based rate limiting, especially on datacenter/Vercel IPs
- App works reliably when run locally (`npm run dev`)
- Endpoint returns 404 if < 60 bars received

## Adding a Module

**For enhanced v2 pipeline:**
1. Add analyst module to `src/pipeline/analysts/` (must return `AnalystReport`)
2. Integrate into `src/pipeline/orchestrator.ts` (parallel Promise.allSettled)
3. Add display section to `src/components/pipeline-viewer.tsx`
4. Add export section to `src/lib/export.ts` (`exportFullBrief`)

**For legacy pipeline:**
1. Add logic to `src/lib/orchestrator.ts` (extend `AnalysisResult`)
2. Add display component to `src/components/displays.tsx`

## Style Conventions

- Dark mode only (`className="dark"` hardcoded in layout)
- TailwindCSS v4 (`@tailwindcss/postcss` in postcss.config.mjs)
- TypeScript strict mode, no `any`
