# Pipeline Debugging Reference

Stage-by-stage contract details and common failure signatures for the
`pipeline-debugging` skill. Load when bisecting a tricky regression or when
onboarding onto the pipeline code for the first time.

---

## Stage Contracts

The canonical types live in `src/pipeline/types.ts` and `src/lib/types.ts`.
The short version of what flows through each stage:

### 1. Market Data → `MarketData`

Source: `src/pipeline/core/market-data.ts` + `/api/quote` route.

Fields: `ticker`, `currentPrice`, `open`, `high`, `low`, `previousClose`,
`todayVolume`, `avgVolume20d`, `support`, `resistance`, `atr`, `fetchedAt`.

Failure signatures:

- All numbers `0` or `NaN` → upstream Yahoo call failed silently.
- `support >= resistance` → swing-level detection had too few bars.
- `avgVolume20d == 0` → not enough history; scanner will divide by zero when
  computing volume ratio.

### 2. Indicators → `IndicatorSet`

Source: `src/lib/indicators.ts` driven from the bar series in market-data.

Fields: `ema20`, `ema50`, `ema200`, `vwap`, `rsi`, `macd` (object), `stochastic`
(object), `trend`, `volumeRatio`.

Failure signatures:

- `rsi == NaN` on a long history → `closes` array was empty or shorter than the
  period. Check `fetchBars` returned ≥ 60 bars.
- `ema200` equals `ema20` → series too short; `ema` seeds with the first value
  and converges slowly.
- `trend === "sideways"` when visually bullish → check `classifyTrend`
  thresholds, not the EMAs.

### 3. Hard Filters → `ScannerInput`

Source: `src/pipeline/filters.ts` (`applyHardFilters`).

Output: pass/fail + `reasons: string[]`.

Failure signatures:

- Always rejecting → a new filter was added with the wrong comparator (`<`
  vs `<=`). Unit test each threshold.
- Never rejecting → a filter silently returned `true` on `NaN` input.
  Always compare with `Number.isFinite(...)` first.

### 4. Scanner → `ScannerResult`

Source: `runScannerAgent` in `core/legacy-agents.ts` plus scoring in
`core/scoring.ts`.

Fields: `setupType`, `setupScore`, `confidence`, `status`, `keyReads`,
`warnings`, `actionPlan`, `reasoning`.

Failure signatures:

- `status` is `REJECT` but `setupScore` is high → score and status use
  different thresholds; read them both.
- `confidence === "HIGH"` with missing `keyReads` → a branch in the reasoning
  builder didn't populate the array; empty reads are a red flag.

### 5. Risk → `RiskCalcResult`

Source: `runRiskAgent` via `src/lib/calc.ts` (`computeRisk`,
`calculatePositionSize`).

Fields: `entry`, `stopLoss`, `takeProfit1`, `takeProfit2`, `riskPerShare`,
`rewardPerShare1/2`, `riskReward1/2`, plus sizing (`lots`, `shares`,
`maxLoss`, `positionValue`).

Failure signatures:

- `stopLoss > entry` → input types confused (the function assumes long side;
  short side handled elsewhere).
- `lots == 0` on a reasonable capital → capital too small for one lot at that
  entry. Not necessarily a bug — but the UI should surface this.
- `riskReward1 < 0` → impossible; indicates entry above take profit, usually
  a swap between `support` and `resistance`.

### 6. Context → IHSG / sector / liquidity

Source: `runContextAgent`.

Failure signatures:

- `ihsgTrend === "unknown"` → IHSG bars fetch failed; the scanner still works
  but debate may weight context too lightly.
- Sector context always neutral → sector map in the agent doesn't cover this
  ticker; not a bug but worth noting.

### 7. Debate, Analysts, Research

Source: `runDebateAgent`, `analysts/*`, `research/*`.

These build on the earlier stages. If the thesis looks inconsistent, 90% of
the time the cause is one of:

- News analyst returned an empty `NewsIntelligence` (upstream failure).
- Sentiment analyst defaulted because no social signals are wired yet.
- Fundamental analyst missing fields because `quoteSummary` partial response.

Check the empty-object fallbacks in `src/pipeline/core/fallbacks.ts` — they
are designed to degrade gracefully, but a stage downstream may treat "empty"
as "bearish".

### 8. Thesis → `Thesis`

Source: `src/pipeline/thesis/thesis-builder.ts`.

Combines consensus + scanner + risk into a single actionable narrative.
Failure signatures:

- Thesis contradicts the scanner → one of the analyst reports is overweighted.
  Print the report scores and confirm.

### 9. Portfolio Manager → decision

Source: `src/pipeline/portfolio/portfolio-manager.ts`.

Considers existing positions, correlation, and guard rails. Failure signatures:

- Decision is `HOLD` with empty portfolio → the `dailyGuardSnapshot` is
  blocking the trade. Check `riskGovernor` output.

### 10. Risk Governor

Source: `src/lib/risk-governor.ts`.

Final gate. If it trips, the decision is blocked regardless of upstream signal.
Failure signatures:

- Trade blocked silently → `DailyGuardSnapshot` not passed through to the
  orchestrator. Check `runAnalysis`'s option normalization.

---

## Bisection Tips

- Use `JSON.stringify(stage, null, 2)` to dump state at each boundary. Big,
  but unambiguous.
- Pin the ticker and seed date in a Vitest case so the bug is deterministic.
  Yahoo responses change daily, so freeze input with a fixture if you need a
  long-lived regression test.
- If two stages look equally wrong, always walk **upstream** first. The bug
  is almost always the earlier one.

---

## Logging In The Pipeline

The repo has `createLogger` in `src/lib/logger.ts`. Use it with a namespace:

```ts
const logger = createLogger("pipeline:scanner");
logger.info("score", { ticker, setupScore, status });
```

These logs survive past the debug session and can be left in. They don't
appear in production UI. Remove ad-hoc `console.log` statements before
committing; keep `logger.info` entries that provide durable observability.

---

## Minimal Repro Template

```ts
import { describe, it, expect } from "vitest";
import { runAnalysis } from "@/pipeline/orchestrator";

describe("pipeline regression: BBRI with low volume", () => {
  it("does not mark no_setup when EMA stack is clearly bullish", async () => {
    // Arrange: inject a deterministic market-data payload
    const fixture = /* snapshot of QuoteResult */;
    // Act
    const result = await runAnalysis("BBRI", /* injected data */, {
      capital: 10_000_000,
      riskPerTrade: 1,
    });
    // Assert the specific stage you suspect
    expect(result.scanner.status).not.toBe("REJECT");
    expect(result.scanner.setupType).not.toBe("no_setup");
  });
});
```

Fixtures go under `src/lib/__tests__/fixtures/*.json` (create the folder if
needed). Keep them small — one bug per fixture.

---

## What Counts As Verified

- The stage that was wrong is identified by name.
- A test case exists that reproduces the bug from captured inputs.
- `npm run test` passes after the fix.
- If the bug affected UI, the happy path is manually re-checked.

If you fixed the symptom without localizing the stage, the change is
`unverified` — document what is missing and why.
