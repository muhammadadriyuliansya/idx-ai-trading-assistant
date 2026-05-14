---
name: pipeline-debugging
description: >
  Workflow for debugging the deterministic analysis pipeline in src/pipeline:
  Quote API → indicators → hard filters → scanner → risk → context → debate →
  analyst reports → thesis → portfolio decision. Use when a ticker produces
  a wrong setup score, unexpected REJECT/WATCHLIST, broken risk plan, or a
  confusing final decision.
license: MIT
metadata:
  version: "1.0.0"
  category: debugging
  sources:
    - src/pipeline/orchestrator.ts stage ordering
    - src/pipeline/types.ts contract shapes
    - README.md architecture section
---

# Pipeline Debugging Skill

The pipeline is deterministic by design. When the final decision is wrong, the
bug is at exactly one stage — find it by walking the data, not by guessing.

## When to Use

- A known-good ticker reports `no_setup` or `REJECT`, or a known-bad ticker
  returns `VALID`.
- The risk plan shows impossible numbers (negative RR, zero lots, stop above
  entry).
- The analyst reports, thesis, or portfolio decision contradict the underlying
  scanner/indicators.
- A test in `orchestrator.test.ts` fails and you need to locate the stage.

For a stage-by-stage contract reference and common failure signatures, read
`reference.md` in this skill directory.

## The Pipeline Order

From `src/pipeline/orchestrator.ts`:

```
1. Market data        src/pipeline/core/market-data.ts
2. Indicators         src/lib/indicators.ts (inside market-data)
3. Hard filters       src/pipeline/filters.ts
4. Scanner agent      src/pipeline/core/legacy-agents.ts (runScannerAgent)
5. Risk agent         runRiskAgent
6. Context agent      runContextAgent
7. Debate agent       runDebateAgent
8. Analyst reports    src/pipeline/analysts/*
9. Research (bull/bear + consensus)  src/pipeline/research/*
10. Thesis            src/pipeline/thesis/thesis-builder.ts
11. Portfolio         src/pipeline/portfolio/portfolio-manager.ts
12. Risk governor     src/lib/risk-governor.ts
```

Every stage writes fields into `AnalysisPipeline` (see `src/pipeline/types.ts`).
A bug somewhere late is almost always caused by wrong inputs from somewhere
earlier — bisect from the top.

## Step 0: Reproduce

1. Call the route: `GET /api/quote?ticker=<SYMBOL>` and save the response.
   This gives you the raw `QuoteResult` the pipeline starts from.
2. If the bug is in a live dashboard interaction, note the exact ticker,
   the tab, and any capital/risk inputs.
3. If you can write a failing Vitest case against the orchestrator with the
   captured data, do so — it gives you a tight loop.

Do not touch pipeline code until you have a concrete repro.

## Step 1: Bisect The Stages

For the reproducing ticker, inspect the output of each stage in order.
The easiest way is to add a temporary `console.log` (or a debugger) at the end
of each stage in `orchestrator.ts` and print the relevant slice.

Ask at each stage: **does this stage's output match what I expect given its
input?** If yes, move on. If no, you have found the bug.

| Check | If wrong, look at |
|-------|-------------------|
| Raw OHLCV (`MarketData`) | `core/market-data.ts`, `/api/quote/route.ts`, Yahoo response |
| `IndicatorSet` (EMA/RSI/MACD/VWAP/trend/volumeRatio) | `src/lib/indicators.ts`, `core/market-data.ts` |
| Hard filter pass/fail + reasons | `src/pipeline/filters.ts` |
| `ScannerResult` (setup, score, status) | `core/legacy-agents.runScannerAgent` + scoring |
| Risk plan (entry/stop/TPs/RR/lots) | `src/lib/calc.ts`, `core/legacy-agents.runRiskAgent` |
| Context (IHSG, sector, liquidity) | `runContextAgent`, IHSG fetch in `/api/quote` |
| Debate / research / consensus | `analysts/*`, `research/*` |
| Thesis | `thesis/thesis-builder.ts` |
| Portfolio decision | `portfolio/portfolio-manager.ts` |
| Final gate | `risk-governor.ts` |

## Step 2: Read The Contract

Before changing a stage, open `src/pipeline/types.ts` and confirm:

- What fields the stage **reads** from `AnalysisPipeline`.
- What fields it is expected to **write**.
- Which values are strings (pre-formatted for UI) vs numbers (computed).

A common class of bug in this repo is a stage consuming a pre-formatted string
(e.g. `currentPrice: "1000"`) when it needs a number — or vice versa. The
`toNumber` helper in `src/lib/utils.ts` exists for exactly that reason.

## Step 3: Make The Smallest Fix

Pipeline stages are easy to over-refactor. Rules:

- Fix the stage that produced the wrong value. Do not patch a later stage to
  compensate.
- If the bug is a threshold, change the threshold and update the test — do
  not add a new branch.
- If the bug is an input type mismatch, fix the consumer with `toNumber` or
  matching `fmt` — do not change the type of the producer.
- If multiple stages look wrong, you probably have one upstream bug. Keep
  bisecting.

## Step 4: Test The Fix

1. Add or update a Vitest case in `src/lib/__tests__/orchestrator.test.ts`
   (or the relevant stage's test) that would have caught the bug. Follow
   the `financial-data-testing` skill for shape.
2. Run that test file only: `npx vitest run src/lib/__tests__/<file>`.
3. Run the full suite: `npm run test`.
4. If the bug was surfaced in the UI, also run through the happy path in
   `npm run dev` — open the ticker in the analysis tab, verify the final
   decision reads sensibly.

## Step 5: Remove Debug Instrumentation

Delete any `console.log` calls you added for bisection before commit. The
repo uses `createLogger` (`src/lib/logger.ts`) for persistent diagnostics —
prefer that if you want to keep any observation permanent.

## Closeout

Report: the symptom, the stage where you located the cause, the exact field
and value that was wrong, what the fix was, and which tests now cover the
regression. If you fixed the symptom without pinning down the stage (shotgun
patch), say so — that change is `unverified` until the stage is identified.
