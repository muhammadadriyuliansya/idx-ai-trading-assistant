---
name: api-integration
description: >
  Workflow for integrating external data providers in this Next.js app route layer:
  Yahoo Finance (via yahoo-finance2), optional OpenAI/Anthropic, and any future
  quote/news source. Covers rate limiting, caching, timeouts, error normalization,
  and response shape contracts. Use when adding, modifying, or debugging an
  `src/app/api/*/route.ts` handler or a client-side fetch against one.
license: MIT
metadata:
  version: "1.0.0"
  category: integration
  sources:
    - src/app/api/quote/route.ts (reference implementation)
    - src/app/api/news/route.ts, src/app/api/ai/route.ts
    - src/lib/resilient-fetch.ts
    - Next.js 16 App Router route handler docs
---

# API Integration Skill

The repo treats all external APIs (Yahoo Finance, AI providers, news sources) as
untrusted and rate-limited. Every route must normalize responses into the app's
own types, enforce caching, and degrade gracefully.

## When to Use

- Adding a new route under `src/app/api/*`.
- Changing how `/api/quote`, `/api/news`, or `/api/ai` calls an upstream.
- Introducing a new provider (alternative quote source, different AI model).
- Debugging a 429, timeout, or stale-data incident at the route boundary.

For provider-specific checklists and the full response contract, read
`reference.md` in this skill directory.

## Contract

Every external-facing route handler in this repo must provide:

1. **Input validation** — reject malformed tickers, symbols, or prompts before
   the upstream call. Return `400` with a clear message.
2. **Rate limiting** — per-IP, in-memory bucket. See `checkRateLimit` in
   `src/app/api/quote/route.ts` for the reference.
3. **Caching** — TTL-based, keyed by the normalized input. Serve stale cache
   on upstream failure and mark it (`meta.source = "cache"` plus
   `X-Data-Warning` header).
4. **Timeouts and retries** — use `src/lib/resilient-fetch.ts` for `fetch`-based
   upstreams. For `yahoo-finance2`, wrap in `Promise.all` with `.catch(() => …)`
   fallbacks so one failed subcall cannot take down the whole response.
5. **Normalized response shape** — map the upstream into a type that lives in
   `src/lib/types.ts` or `src/pipeline/types.ts`. Never leak raw upstream JSON.
6. **Structured errors** — return `{ error: string }` with the correct status
   (400 / 404 / 429 / 502). Do not echo stack traces or upstream URLs.
7. **Logging** — `createLogger("api:<route>")`. Log on entry, success, and
   failure. Do not log PII or API keys.

## Step 0: Read The Reference Implementation

Before adding a new route, open `src/app/api/quote/route.ts` and note:

- `runtime = "nodejs"` and `dynamic = "force-dynamic"` exports.
- `normaliseTicker` / `isValidTicker` input validation.
- `checkRateLimit` using a `Map<string, { count, resetTime }>`.
- `getCachedQuote` / `setCachedQuote` with a 5-minute TTL.
- `Promise.all([...])` parallel upstream fetches with per-call `.catch`.
- On error: serve cache if available with `X-Data-Warning`, otherwise return a
  normalized JSON error.

Mirror that shape for any new route.

## Step 1: Choose The Upstream Client

| Provider | Use | Notes |
|----------|-----|-------|
| `yahoo-finance2` | Quotes, chart history, fundamentals | Already a dependency. Suppress `yahooSurvey` and `ripHistorical` notices when instantiating. |
| `fetch` + `resilient-fetch` | REST APIs without an official SDK | Pass a timeout; handle `AbortError` distinctly from network failure. |
| OpenAI / Anthropic SDK | Only in `src/app/api/ai/route.ts` | Accept the API key from the request body (the app stores it locally), never log it, never cache the response keyed by key. |

**Do not** introduce a new SDK without replacing meaningful existing complexity.
The README's contribution rule explicitly limits new dependencies.

## Step 2: Input Validation

- Tickers must match `^[A-Z]{4}(?:\.JK)?$` for IDX. Normalize to `<SYMBOL>.JK`
  before calling Yahoo.
- For prompts (AI route), limit length server-side (reject > ~20k chars).
- For news queries, sanitize the search term — no raw HTML, no upstream
  query-string passthrough.
- Always reply `400` with a human-readable reason when validation fails.

## Step 3: Rate Limit And Cache

Use separate `Map`s keyed by a stable identifier:

- Rate limit key: client IP from `x-forwarded-for`, falling back to `"unknown"`.
- Cache key: the **normalized** input (e.g. `BBRI.JK`, not `bbri`).
- TTLs: quote 5 min, news 10–15 min, AI never cache (responses depend on prompt
  and are user-specific).

When the upstream fails **and** a cached value exists:

- Return the cached payload with `meta.source = "cache"`.
- Add header `X-Data-Warning: <upstream> failed; served last cached <kind>`.

When the upstream fails **and** there is no cache:

- Classify error: `not found` (404), `timeout`/`network`/`5xx` (502),
  `rate limited upstream` (429).
- Reply `{ error: "..." }` with the matching status.

## Step 4: Response Normalization

Every route returns a typed object defined in the repo (e.g. `QuoteResult`,
`NewsIntelligence`). If the upstream adds fields you do not consume, drop them.
Never forward an unbounded upstream JSON blob.

Include a `meta` object with at minimum:

- `source`: `"live" | "cache" | "fallback"`.
- `fetchedAt`: `Date.now()`.
- Any upstream-specific quality signal (`barsCount`, `volRatio`, etc.).

## Step 5: Error Handling

- Never throw from a route handler — always `return NextResponse.json(...)`.
- Log the error message (not the stack) with `logger.error`.
- Classify the error so the client can react (the dashboard uses the status
  code and the `error` string to decide whether to retry).
- Redact anything that looks like a key (`sk-...`, `bearer ...`) before logging.

## Step 6: Verify

1. Start the dev server manually (do not run `npm run dev` from the agent):
   the user runs it in their own terminal.
2. Hit the route with a known-good input (e.g. `/api/quote?ticker=BBRI`) and a
   known-bad one (`?ticker=XXX`). Confirm status codes and the `meta.source`
   value.
3. Run `npm run test` — if you changed caching, rate limiting, or normalization,
   add or update a test under `src/lib/__tests__` using the
   `financial-data-testing` skill's API-route pattern (`news-api.test.ts`).
4. Run `npm run typecheck` to confirm response shapes still match the exported
   types in `src/lib/types.ts`.

## Closeout

Report: route touched, upstream changed or added, new validation or error
branches, test(s) added, and which verification commands ran. If you could not
hit the upstream (network, missing credentials), label the behavior
`unverified` and name the branch that was not exercised.
