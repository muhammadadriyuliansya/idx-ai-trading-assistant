# IDX AI Trading Assistant

IDX AI Trading Assistant is a Next.js application for semi-manual Indonesian stock market analysis. It combines deterministic market scanning, risk sizing, context checks, analyst-style scoring, portfolio guardrails, and optional AI explanation prompts.

This is not an auto-trading bot and does not place orders. The app is designed to help traders review IDX setups more consistently before taking manual action.

## Features

- Market scanner for default IDX tickers with setup score, trend, volume ratio, risk/reward, and status.
- Full ticker analysis pipeline with market data, indicators, hard filters, risk plan, context, debate, thesis, and final decision.
- Daily capital guard for trade frequency, daily loss, and risk-per-trade control.
- Watchlist, local alerts, AI opinions, and portfolio history stored in browser storage.
- Exportable institutional brief and AI-ready prompt.
- Optional OpenAI or Anthropic analysis layer. Core analysis works without an API key.
- Unit tests for calculations, indicators, scanner filtering, news behavior, orchestrator behavior, and risk governance.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide React icons
- Vitest with jsdom
- Yahoo Finance data through the local quote API route

## Folder Structure

```text
src/
  app/                    Next.js routes, API handlers, global styles, app shell page
  components/             Reusable UI and feature-facing React components
    pipeline-viewer/      Smaller parts used by the full pipeline viewer
    ui/                   Low-level UI primitives
  config/                 App-wide constants such as storage keys and scan defaults
  features/
    trading/              Dashboard-specific types, display maps, filters, and helpers
  lib/                    Shared domain utilities, calculations, exports, storage, logging
  pipeline/               Market scanner and deterministic analysis pipeline
    analysts/             Technical, fundamental, news, sentiment, and macro analysts
    portfolio/            Portfolio decision logic
    research/             Bull/bear research and consensus
    thesis/               Thesis builder
```

## Installation

```bash
npm ci
```

Use Node.js 20+ for local development. CI currently validates Node.js 18 and 20.

## Development Workflow

```bash
npm run dev
```

Open `http://localhost:3000`.

Recommended checks while developing:

```bash
npm run lint
npm run typecheck
npm run test
```

Run the complete local verification suite before release:

```bash
npm run verify
```

## Build and Run

```bash
npm run build
npm run start
```

The production server starts the compiled Next.js app. Market quotes are fetched through `GET /api/quote?ticker=BBRI`, which normalizes IDX symbols to `.JK` when needed.

## Environment Variables

No environment variables are required for the deterministic scanner and analysis pipeline.

AI keys are entered in the app settings and sent only to the local `/api/ai` route for the requested generation. Do not commit API keys, tokens, or secrets.

Optional deployment variables can be added by the hosting provider as needed, but the current app does not require a committed `.env` file.

## Deployment Notes

- Deploy as a standard Next.js app.
- Use `npm ci`, `npm run build`, and `npm run start` for a production build.
- Yahoo Finance can rate-limit hosted environments. For heavy daily use, prefer running locally or add a more durable market-data provider behind `/api/quote`.
- Keep API keys out of source control. The repository ignores `.env*` by default.

## Architecture Notes

The application is organized around a deterministic pipeline:

```text
Quote API -> indicators -> hard filters -> scanner -> risk -> context
          -> debate -> analyst reports -> thesis -> portfolio decision
          -> risk governor -> final UI and export
```

Core trading calculations live in `src/lib`. Pipeline orchestration and analysis stages live in `src/pipeline`. UI-specific dashboard helpers live in `src/features/trading` so `src/app/page.tsx` stays focused on composition and state wiring.

AI is optional. The deterministic pipeline produces a complete output without external AI calls; AI is used only to generate extra narrative analysis from an exported prompt.

## Refactoring Notes

The current structure was cleaned to reduce feature clutter and make ownership clearer:

- App constants moved to `src/config/app.ts`.
- Dashboard types, badge tones, applied-stock filtering, watchlist/alert helpers, and small dashboard components moved to `src/features/trading`.
- Pipeline viewer helper components moved to `src/components/pipeline-viewer`.
- Archived dead code and unused default public SVG assets were removed.
- CI commands now reuse package scripts, and `npm run verify` provides one local release check.

## Contribution Guidelines

- Keep core trading behavior deterministic and covered by focused tests.
- Put route handlers in `src/app/api`, reusable UI in `src/components`, trading helpers in `src/features/trading`, and domain logic in `src/lib` or `src/pipeline`.
- Prefer small functions and explicit types over clever abstractions.
- Do not add new dependencies unless they replace meaningful complexity.
- Run `npm run verify` before opening a pull request.
- Never commit secrets, generated build output, `.next`, `node_modules`, or local TypeScript build info.

## Recommended Next Improvements

- Split `src/pipeline/orchestrator.ts` into market-data, legacy deterministic agents, scoring, and result assembly modules.
- Split the remaining main dashboard view into route-level sections once product behavior is stable.
- Add Playwright smoke tests for the scanner and full-analysis happy path.
- Replace Yahoo Finance with a dedicated market-data provider if the app is used in production every trading day.
