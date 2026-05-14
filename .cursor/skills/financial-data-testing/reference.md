# Financial Data Testing Reference

Extra material for the `financial-data-testing` skill. Load this when you need
fixtures, edge-case tables, or longer examples. Skip for simple one-function tests.

---

## OHLCV Builder

The repo's `Bar` type lives in `src/lib/indicators.ts`. A minimal builder:

```ts
import type { Bar } from "@/lib/indicators";

function makeBar(close: number, i = 0, volume = 1_000_000): Bar {
  const delta = close * 0.01;
  return {
    timestamp: Date.UTC(2025, 0, i + 1),
    open: close - delta,
    high: close + delta,
    low: close - delta,
    close,
    volume,
  };
}

export function makeBars(closes: number[], volumes?: number[]): Bar[] {
  return closes.map((c, i) => makeBar(c, i, volumes?.[i] ?? 1_000_000));
}
```

Use this only when a test needs real OHLCV structure. For pure-number functions
like `ema(values, period)`, pass raw arrays directly.

---

## Edge-Case Tables

### `calculateRiskReward(entry, stop, target)`

| Entry | Stop | Target | Expected | Reason |
|-------|------|--------|----------|--------|
| 100 | 90 | 120 | 2 | classic 2R |
| 100 | 100 | 120 | 0 | zero risk |
| 100 | 90 | 100 | 0 | zero reward |
| 100 | 110 | 120 | 2 | short-style: uses absolute distance |

### `calculatePositionSize(capital, riskPct, entry, stop)`

| Capital | Risk% | Entry | Stop | Lots | Notes |
|---------|------:|------:|-----:|-----:|-------|
| 10_000_000 | 1 | 1000 | 950 | 20 | riskBudget 100k / riskPerShare 50 = 2000 shares = 20 lots |
| 10_000_000 | 1 | 1000 | 1000 | 0 | zero risk per share |
| 10_000_000 | 0 | 1000 | 950 | 0 | zero risk budget |
| 10_000_000 | 1 | 1000 | 999 | 100 | rounds down to nearest 100 lot |
| 100 | 1 | 1000 | 950 | 0 | capital too small for even one lot |

### `computeRisk(input: RiskInput)`

- Returns `null` when any of `price`, `support`, `resistance`, `capital`, `riskPct`
  is not finite or non-positive.
- `stopLoss` is clamped so it cannot be more than 10% below `price`.
- `tp1` uses the larger of `range * 0.6` and `atr * 1.5`.
- `tp2` uses the larger of `range` and `atr * 3`.

When writing tests: assert the clamping (feed a far-away support to confirm the
10% floor) and the ATR fallback (pass `atr = 0` to confirm
`(resistance - support) * 0.1` is used).

### Indicators (`ema`, `rsi`, `macd`, `atr`)

- Arrays shorter than the period produce `NaN` at early indexes.
- `rsi` returns `100` when `avgLoss === 0`.
- `macd` is `emaFast - emaSlow`; signal is `ema(macdLine, signalPeriod)`.
- `atr` requires at least 2 bars.

Test warmup behavior explicitly: given a short series, assert early values are
`NaN` and the first valid index equals `period - 1` (or `period` for `rsi`).

### Scanner and Filters

- `applyHardFilters` in `src/pipeline/filters.ts` should be tested by arranging a
  full `IndicatorSet` + `MarketData` and checking both the pass/fail boolean and
  the `reasons: string[]` list.
- Boundary cases: value exactly equal to the threshold. Document which side of
  the boundary is allowed and write one test per side.

### Risk Governor

- `evaluateRiskGovernor` takes a `DailyGuardSnapshot`. Construct one with known
  `tradesToday`, `dailyLossPct`, and `currentDrawdownPct` values and assert the
  returned `status` and `reason`.
- Test the transition around each limit (one under, equal, one over).

### Portfolio Manager

- `evaluatePortfolio` makes a decision based on the analyst reports and the
  thesis. Build a minimal synthetic thesis to isolate the branch under test.
- Do not depend on real AI output; AI is optional in this pipeline.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `toBe` on floats | Switch to `toBeCloseTo(value, 4)` or tighter |
| Asserting on a 200-bar indicator window | Shorten the input until only the branch under test is exercised |
| Mocking `yahoo-finance2` deeply | Mock at the module boundary (`vi.mock("yahoo-finance2", ...)`) — see `news-api.test.ts` pattern |
| Writing tests against implementation detail (private helper names) | Test the public export; treat internals as free to refactor |
| Skipping the warmup case for indicators | Always include at least one "not enough bars" assertion |
| Forgetting lot rounding | Assert `lots * 100 === shares` and that `shares * entry === positionValue` |

---

## Running And Debugging Tests

- Focus one file: `npx vitest run src/lib/__tests__/calc.test.ts`
- Watch mode (manual): `npm run test:watch`
- Only one test: add `.only` temporarily; remove before commit.
- Print a value once to triangulate: `console.log(result); expect(result).toEqual(...)`.
- If a test is flaky, it is almost always because of time (`Date.now()`),
  floating point, or mock state. Inject time and clear mocks in `beforeEach`.

---

## What Counts As Verified

- `npm run test` exits 0.
- The new test file lives next to its siblings under `src/**/__tests__/`.
- For pipeline changes, `npm run typecheck` is also green.
- For closeout on release-scale work, `npm run verify` passes end to end.

If any of these were not run, label the change `unverified` and state what is
outstanding.
