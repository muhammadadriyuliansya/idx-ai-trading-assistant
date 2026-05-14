# API Integration Reference

Provider-specific details and patterns that don't belong in the main SKILL.md.
Load this when wiring a new provider or auditing an existing route end-to-end.

---

## Yahoo Finance (`yahoo-finance2`)

### Instantiation

```ts
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});
```

Suppressing those two notices keeps server logs clean — they are not errors.

### Useful Calls

| Call | Use |
|------|-----|
| `yahooFinance.chart(symbol, { period1, period2, interval: "1d" })` | Daily OHLCV history. Returns `{ quotes: ChartBar[] }`. |
| `yahooFinance.quoteSummary(symbol, { modules: [...] })` | Fundamentals. Modules used in this repo: `summaryDetail`, `defaultKeyStatistics`, `financialData`. |
| `yahooFinance.search(term)` | Ticker / company search. Not currently used but safe to adopt. |

### Common Failure Modes

- **Rate limited from hosted environment.** README flags this explicitly. Cache
  aggressively and serve stale on failure.
- **Ticker not listed** — message contains `not found`, `no data`, or `404`.
  Reply `404` to the client.
- **Transient 5xx from Yahoo** — reply `502` and serve cache if available.
- **Missing fundamentals** — `quoteSummary` can return partial modules. Wrap
  each extraction in `rawNumber(...)` (see `route.ts`) and return `null` for
  absent fields rather than throwing.

### Parallel Fetch Pattern

```ts
const [bars, ihsgBars, fundamental] = await Promise.all([
  fetchBars(symbol),
  fetchBars("^JKSE").catch(() => [] as Bar[]),
  fetchFundamental(tickerClean).catch(() => null),
]);
```

The primary series (`bars`) has no `.catch` — if it fails the route fails. The
secondary series (`ihsgBars`, `fundamental`) degrade to empty/null.

---

## AI Providers (OpenAI, Anthropic)

### Key Handling

- The key arrives in the request body from the browser (the user pastes it into
  the app settings). It is **never** read from `process.env` and **never**
  persisted server-side.
- Never log the key. Never include it in an error response. Do not cache the
  response keyed by the key.

### Minimal Request Pattern

```ts
const res = await fetch(providerUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ model, messages, ... }),
  signal: AbortSignal.timeout(60_000),
});
```

### Error Classification

| Upstream status | Our response | Message |
|---|---|---|
| 401 / 403 | 401 | "Invalid API key" |
| 429 | 429 | "AI provider rate limited. Try again soon." |
| 5xx or network error | 502 | "AI provider unavailable." |
| 400 validation | 400 | Forward a sanitized reason (no stack trace). |

---

## News Source

The news route currently uses a single external feed behind `resilient-fetch`.

- Cache the normalized `NewsIntelligence` object by ticker + date bucket.
- The feed can return empty results legitimately — do not treat empty as error.
- Sanitize any `title` / `summary` fields before forwarding to the client; the
  orchestrator does not re-sanitize.

---

## Rate Limit Pattern (reference code shape)

```ts
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const LIMIT = 30;
const WINDOW = 60_000;

function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + WINDOW });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}
```

The map is in-memory, per-process. It resets on redeploy, which is fine for the
current usage pattern (semi-manual analysis). If the app ever scales beyond one
instance, move this to Redis or an edge KV.

---

## Cache Pattern

```ts
const cache = new Map<string, { data: T; timestamp: number }>();
const TTL = 5 * 60 * 1000;

function getCached(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
```

Key choices:

- Always use the **normalized** key (`.JK`-suffixed ticker, lowercased url, etc.).
- Cache **after** successful normalization, not upstream JSON.
- Use a different TTL per route: quote 5 min, news 10–15 min, fundamental 1 h.

---

## Standard Route Skeleton

```ts
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:<name>");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = validate(url.searchParams);
    if (!input.ok) {
      return NextResponse.json({ error: input.reason }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in 1 minute." },
        { status: 429 },
      );
    }

    const cached = getCached(input.key);
    if (cached) return NextResponse.json(cached);

    const data = await fetchAndNormalize(input);
    setCached(input.key, data);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error("Failed", { error: err instanceof Error ? err.message : String(err) });
    const cached = getCached(input.key);
    if (cached) {
      return NextResponse.json(
        { ...cached, meta: { ...cached.meta, source: "cache" } },
        { headers: { "X-Data-Warning": "upstream failed; served cache" } },
      );
    }
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
```

Adapt as needed — but every one of the numbered points in SKILL.md must be
present.

---

## Testing Routes

- Unit-test the normalization helpers, not the Next.js route machinery.
- Route-level smoke tests: see `src/lib/__tests__/news-api.test.ts`. It mocks
  the upstream fetch and calls the handler directly.
- Integration checks: run `npm run dev` locally and exercise happy and sad
  paths manually (unknown ticker, known ticker, rate-limit burst).

---

## What Counts As Verified

- Happy path returns `200` with the expected normalized shape.
- Unknown input returns `404` with a readable error.
- Rate limit triggers `429` after N rapid requests.
- `npm run typecheck` passes.
- Related test file (`*-api.test.ts`) is green.

If you only touched a provider client (not the route itself), running the
route's existing test is still the cheapest verification.
