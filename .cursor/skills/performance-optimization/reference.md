# Performance Optimization Reference

Extra material for the `performance-optimization` skill. Load when auditing a
full route, adding a new dependency, or chasing a hard-to-reproduce jank.

---

## Measurement Recipes

### React DevTools Profiler

1. Open the app in the browser, React DevTools → Profiler tab.
2. Click record.
3. Do one interaction (e.g. switch to the Scanner tab, run a scan).
4. Stop recording. Sort the flame graph by "Render duration" descending.
5. Note the top three components and their render counts.

What to look for:

- A component that rendered **more times than it should have** (e.g. every
  scanner row rendered when only one row changed).
- A single render > 16 ms on desktop (the 60-fps budget). On mobile, budget
  is ~33 ms for 30 fps.

### Next.js Build Output

`npm run build` prints a route table like:

```
Route (app)                         Size     First Load JS
┌ ○ /                              12 kB          150 kB
├ ○ /api/ai                         0 B              0 B
```

Track "First Load JS" per route over time. A +20 KB jump with no user-visible
feature is a regression.

### Browser Performance Timeline

For stutter that the Profiler cannot explain (scroll, animation):

1. Chrome DevTools → Performance → record.
2. Reproduce the jank, then stop.
3. Look for long tasks (red triangle). If a task > 50 ms sits on the main
   thread, find the call inside it.

---

## Common React 19 / Next.js 16 Patterns

### Lazy-loading a heavy component

```tsx
import dynamic from "next/dynamic";

const PipelineViewer = dynamic(
  () => import("@/components/pipeline-viewer").then((m) => m.PipelineViewer),
  { ssr: false, loading: () => <SkeletonViewer /> },
);
```

Use this for:

- The full pipeline viewer (heavy, only needed when a user opens analysis).
- Any chart component (Recharts, ApexCharts, etc.).
- Components that pull in framer-motion variants and are not above the fold.

### Memoized row

```tsx
const ScannerRow = memo(function ScannerRow({ row, onOpen }: Props) {
  // ...
});
```

Pair with stable `onOpen`:

```tsx
const handleOpen = useCallback(
  (ticker: string) => {
    startTransition(() => setSelected(ticker));
  },
  [],
);
```

### `useTransition` for filtering

```tsx
const [isPending, startTransition] = useTransition();

function onFilterChange(next: Filter) {
  startTransition(() => setFilter(next));
}
```

The input stays responsive; the expensive re-filter happens without blocking
typing.

### Stable variants for framer-motion

```tsx
const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
// defined at module scope — not inside the component
```

Inline objects break memoization for motion children.

---

## Icon Import Rules

```ts
// Good — tree-shaken
import { TrendingUp, AlertCircle } from "lucide-react";

// Bad — pulls in the whole icon set
import * as Icons from "lucide-react";
```

If you need many icons in one file, still prefer named imports — `lucide-react`
handles it correctly with Next.js 16's compilation.

---

## Scanner Concurrency

The scanner fans out across ~20 tickers. Without limits it will spike Yahoo
Finance and trigger 429s.

```ts
async function runScannerWithLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
```

`/api/quote` already de-duplicates via its in-memory cache, so repeated scans
of the same ticker list within 5 minutes cost almost nothing server-side.

---

## Animation Cost Cheat Sheet

| Property | Cost | Notes |
|----------|------|-------|
| `transform` / `opacity` | Cheap | GPU-composited. Prefer these. |
| `filter`, `backdrop-filter` | Expensive | Use sparingly, never in a list of > 10 items. |
| `width` / `height` | Triggers layout | Avoid animating. Use `transform: scale` or wrap in a container with fixed size. |
| `top` / `left` | Triggers layout | Replace with `transform: translate`. |
| `box-shadow` | Moderate | Fine on hover of one element, costly if animated across a list. |
| framer-motion `layout` | Expensive | Use only on focal items that actually reflow. |

---

## Dependency Size Budget

Informal budget for this project:

- Core framework (Next, React, react-dom): ignored, fixed cost.
- UI / motion (framer-motion, tailwind-merge, clsx, cva): under control, do
  not add a second animation library.
- Charts: not currently in `package.json`. If you add one, prefer
  lightweight/tree-shakeable options (e.g. `recharts` ~90 KB gzipped is
  acceptable; heavy alternatives are not).
- Date: none currently. If you add one, prefer `date-fns` with per-function
  imports, not `moment`.
- Utility/lodash: do not add. The repo's local utilities in `src/lib/utils.ts`
  are sufficient.

If a new dependency adds ≥ 30 KB gzipped to first-load JS, it needs a written
reason in the PR (replacing hand-rolled code, or enabling a feature with no
smaller alternative).

---

## Mobile Performance Notes

- Mobile CPUs are ~3-5× slower than a dev laptop. A 20 ms render on your
  machine can be 60+ ms on mid-range Android.
- Avoid `position: sticky` elements over long scrolls on mobile — they force
  repaints.
- `height: 100vh` on mobile triggers address-bar resize jank. Use
  `height: 100svh` or `height: 100dvh`.
- framer-motion's `whileInView` can fire many times during a fling scroll.
  Use `viewport={{ once: true }}` when the animation only needs to play once.

---

## Regression Guard

When optimizing, it is easy to break correctness. Before closeout:

- Run `npm run test` — especially the scanner and orchestrator tests.
- Manually verify the change at 375px width and at desktop width.
- Confirm that `prefers-reduced-motion` still results in reduced animation
  (toggle OS setting to test).
- If you removed a `useMemo` / `useCallback`, verify there is no prop that
  now changes reference every render and re-triggers a memoized child.

---

## What Counts As Verified

- Before/after numbers captured (Profiler commit time OR build size delta).
- `npm run build` succeeds.
- `npm run test` passes.
- Manual smoke at mobile and desktop widths.

If any of these were skipped, say so and label the change `unverified`.
