---
name: financial-data-testing
description: >
  Vitest-based testing workflow for deterministic trading logic in this repo:
  indicators (EMA/RSI/MACD/ATR), risk sizing, scanner filters, portfolio decisions,
  and governor limits. Use when adding or reviewing tests that cover calculation,
  filtering, or pipeline scoring behavior.
license: MIT
metadata:
  version: "1.0.0"
  category: testing
  sources:
    - src/lib/__tests__ existing Vitest suites
    - Vitest 4.x docs (vitest.dev)
    - package.json scripts (`npm run test`, `npm run verify`)
---

# Financial Data Testing Skill

Trading calculations in this repo are deterministic by contract. The job of a test
is to pin the math down so a refactor of indicators, risk sizing, filters, or
portfolio decisions cannot silently drift.

## When to Use

- Adding a new indicator, setup score, risk rule, filter, or portfolio rule in
  `src/lib/*` or `src/pipeline/*`.
- Changing an existing calculation or threshold.
- Reviewing a PR that touches `calc.ts`, `indicators.ts`, `risk-governor.ts`,
  `stock-filter.ts`, `filters.ts`, `scanner.ts`, `portfolio-manager.ts`, or
  `orchestrator.ts`.
- Reproducing a bug reported at the numeric layer (wrong RR, wrong score,
  wrong sizing, filter firing at the wrong threshold).

For extra fixtures, OHLCV builders, and edge-case checklists, read
`reference.md` in this skill directory.

## Inputs And Outputs

- Inputs: a specific function or pipeline stage, its typed input (see
  `src/lib/types.ts` and `src/pipeline/types.ts`), and the desired behavior.
- Outputs: one or more Vitest tests in `src/**/__tests__/*.test.ts` that pass
  locally via `npm run test`.
- Stop condition: `npm run test` is green and the new file is referenced by
  existing coverage patterns (co-located under `__tests__/`).

## Step 0: Locate The Contract

Before writing tests, read the function signature and its types:

1. Open the module under test and copy the input/output types.
2. If the function reads from `MarketData`, `IndicatorSet`, `ScannerInput`, or
   `RiskInput`, use those shapes verbatim — do not invent new shapes.
3. Check existing tests in `src/lib/__tests__/` for the same style
   (`describe` per function, small `it` cases, `toBeCloseTo` for floats).

## Step 1: Pick The Right Test Shape

| Target area | Test style | Example reference |
|-------------|-----------|-------------------|
| Pure math (`calculateRiskReward`, `calculatePositionSize`, `ema`, `rsi`, `atr`) | Table of inputs → expected outputs | `src/lib/__tests__/calc.test.ts` |
| Filters / gating (`applyHardFilters`, `stock-filter`) | Arrange a full input, assert pass/fail + reasons | `src/lib/__tests__/stock-filter.test.ts` |
| Risk governor / portfolio rules | Arrange a snapshot, assert allowed/blocked + reason codes | `src/lib/__tests__/risk-governor.test.ts` |
| Pipeline orchestration | Stub market data, assert emitted `AnalysisPipeline` fields | `src/lib/__tests__/orchestrator.test.ts` |
| API route behavior (`/api/quote`, `/api/news`) | Mock `yahoo-finance2` or `fetch`, assert response shape | `src/lib/__tests__/news-api.test.ts` |

## Step 2: Writing The Test

Follow the conventions already in this repo:

- `import { describe, it, expect } from "vitest"`.
- Group by function with `describe("functionName", ...)`.
- Use `toBe` for integers (lots, shares, counts).
- Use `toBeCloseTo(value, digits)` for any float derived from math
  (RR ratios, RSI, MACD, ATR, position value fractions).
- Use small, hand-calculated numbers. Do **not** assert on multi-hundred-bar
  histories unless the test is specifically about rolling windows.
- Name cases by behavior ("returns 0 when risk is 0"), not implementation.

For OHLCV-based indicators, build bars as the smallest array that exercises the
branch you care about. The `Bar` type is:

```ts
{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }
```

## Step 3: Cover The Dangerous Edges

Every financial function needs these cases considered — skip one only if you can
state why it is impossible given the type:

- Zero or negative risk (entry == stop, entry < stop for long).
- Zero or negative capital, zero risk percent.
- `NaN` / non-finite input from upstream (indicators return `NaN` during warmup).
- Lot rounding: IDX lot size is 100 (see `LOT_SIZE` in `calc.ts`). Test that
  fractional shares round **down** to the nearest lot.
- Warmup / insufficient bars: `rsi`, `ema`, `atr` emit `NaN` until the period is
  filled.
- Exact threshold boundaries in filters (value equal to the cutoff).

## Step 4: Verify

1. Run the focused test:
   `npx vitest run path/to/file.test.ts`
2. Run the full suite before closeout:
   `npm run test`
3. For changes that touch types or cross module boundaries, also run
   `npm run typecheck`.
4. Before calling a larger change done, run `npm run verify` which chains
   lint + typecheck + test + build.

## Closeout

Report which file(s) changed, which test file(s) were added or updated, and
which of `npm run test` / `npm run verify` were executed. If a case is skipped
(e.g. waiting on a separate PR), label it `unverified` and name what is missing.
