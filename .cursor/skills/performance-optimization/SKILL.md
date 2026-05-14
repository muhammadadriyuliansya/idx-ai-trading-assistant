---
name: performance-optimization
description: >
  Performance workflow for this Next.js 16 / React 19 trading dashboard. Focuses
  on React render cost, framer-motion usage, bundle size, and repeated market-data
  fetches. Use when the UI feels janky, scans are slow, the bundle grows, or when
  introducing a heavy dependency or chart library.
license: MIT
metadata:
  version: "1.0.0"
  category: performance
  sources:
    - Next.js 16 App Router performance guidance
    - React 19 rendering model (use, startTransition, memoization)
    - framer-motion docs on layout/animate performance
    - Project scripts (`npm run build`, `npm run verify`)
---

# Performance Optimization Skill

The dashboard renders scanner results, full-pipeline analyses, watchlists, and
multi-section pipeline viewers with framer-motion. Small mistakes compound fast
— a re-render on every quote poll or an unmemoized scanner table will feel
janky on mobile.

## When to Use

- A list, table, or tab re-renders on every keystroke or poll.
- Scroll or expand/collapse feels stuttery (framer-motion or tall lists).
- `npm run build` output shows a first-load JS above ~200 KB for a route.
- You're adding a chart library, a date library, an icon pack, or a big helper.
- You're about to add client-side data fetching or polling.

For a deeper checklist, measurement recipes, and concrete refactor patterns,
read `reference.md` in this skill directory.

## Postur

- Measure before optimizing. A guessed bottleneck is almost always wrong.
- Fix rendering cost **before** caching or memoizing harder.
- Bundle size is a product decision. Every new dependency must justify itself.

## Step 0: Establish A Baseline

Before changing anything:

1. `npm run build` — note first-load JS for the affected route in the build
   output table.
2. Run the dev server and open React DevTools Profiler in the browser.
3. Record one slow interaction (scan, open a ticker, switch tab). Save the
   top three "commit" durations.

If you skip measurement, label your change `unverified` at closeout.

## Step 1: Classify The Problem

| Symptom | Most likely cause | First move |
|---------|-------------------|-----------|
| Tab switch is slow | Heavy component mounted eagerly | Lazy-load with `next/dynamic` (`ssr: false` for charts) |
| List scrolls janky | Re-rendering the whole list on any state change | Memoize row components, hoist filters, split state |
| Typing in a field lags the page | Parent re-renders on every keystroke | Move input state down; wrap consumers in `React.memo` |
| Scanner refresh is slow | Sequential per-ticker fetches | Parallelize with `Promise.all`, cap concurrency, reuse the `/api/quote` cache |
| Animation stutters | `layout` prop on many items, or animating `top`/`left` | Animate `transform`/`opacity`, limit `layout` to focal items |
| Build reports a huge chunk | Large dep imported at module top, or icons bundled wholesale | Tree-shake (named imports), lazy-load, swap for lighter dep |

## Step 2: React Render Rules

Apply in this order — each is cheaper to get right than the next:

1. **State placement.** State that only one subtree reads belongs in that
   subtree. Local form state should not live in the dashboard root.
2. **Keys.** Lists keyed by index cause double renders on reorder. Use stable
   IDs (ticker symbol, trade ID).
3. **Memoize the expensive bits.** `useMemo` for derived data the render path
   depends on, `useCallback` for props passed into memoized children.
4. **`React.memo` the row.** For any list > ~20 items, memoize the row.
   Profiler will confirm if it helps.
5. **`useTransition` for non-urgent updates.** Filter changes, sort changes,
   big re-computations — wrap the setter in `startTransition`.
6. **React 19 compiler.** The repo uses React 19. Trust it for simple
   components, but it is not magic — the profiler still wins.

## Step 3: framer-motion Hygiene

- Prefer `animate` + `transition` over `layout` for position changes.
- `AnimatePresence` only at the boundary where items actually mount/unmount.
- Reuse variants across items instead of inline objects (stable reference).
- On long lists, stagger with CSS delay instead of motion `staggerChildren`
  — it keeps the animation cost off the main thread.
- Respect `prefers-reduced-motion`: reduce to opacity-only transitions.

## Step 4: Bundle Size

- `npm run build` shows per-route first-load JS. Target < 200 KB for the main
  dashboard route, < 100 KB for API-less routes.
- `lucide-react` supports named imports. Never `import * as Icons`.
- `framer-motion` is large — keep it; but consider `motion/react` (lighter
  import) where available.
- Next.js 16 supports `dynamic(() => import('...'), { ssr: false })`. Use it
  for pipeline viewers, chart panes, and other below-the-fold heavy components.
- Before adding any dependency, check its minified+gzipped size on bundlephobia
  or inspect `package.json` and the dep's own bundle output. If it replaces
  ≥ 200 lines of code in this repo, it's justified; otherwise, reconsider.

## Step 5: Data Fetching

- `/api/quote` already caches for 5 minutes. Do not bypass it in the client.
- For scanner runs, fan out with `Promise.all` but cap concurrency to 4–6
  simultaneous requests so Yahoo does not rate-limit.
- Avoid polling the quote route in a tight loop. If you need near-real-time,
  use a single interval at the page root and distribute the data via context.
- Client state that mirrors server state should be minimal — render from the
  fetched object, don't duplicate into extra derived state.

## Step 6: Verify

1. `npm run build` again. Compare first-load JS before/after.
2. Re-run the Profiler trace on the same interaction. Compare commit times.
3. For any visible UI change, do a manual pass at 375px mobile width.
4. `npm run typecheck` and `npm run test` before closeout.

## Closeout

Report: what you measured (before/after numbers), what you changed, which
files, which verifications ran. If you could not measure (no dev environment,
no build), say so and label the result `unverified`.
