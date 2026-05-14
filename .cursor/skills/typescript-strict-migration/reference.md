# TypeScript Strict Migration Reference

Extra material for the `typescript-strict-migration` skill. Load when doing a
project-wide flag flip or when you hit a less-common error shape.

---

## Recommended `tsconfig.json` Additions

The repo already has `"strict": true`. Candidates for further tightening, in
priority order for a calculation-heavy codebase:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Do not enable all at once. Enable one, fix the fallout, commit, repeat.

---

## Flag-By-Flag Notes

### `noUncheckedIndexedAccess`

Biggest value for this repo. After enabling, `bars[i]` has type `Bar | undefined`
instead of `Bar`. Expect errors in:

- Indicator loops over `closes[i]`, `bars[i]`.
- Pipeline stages that read `arr[last]`.
- Array destructuring where the length is only implicit.

Refactor patterns:

```ts
// Before
const lastBar = bars[bars.length - 1];
lastBar.close;

// After
const lastBar = bars.at(-1);
if (!lastBar) return null;
lastBar.close;
```

Or, when the length is guaranteed earlier:

```ts
if (bars.length < 2) return [];
const lastBar = bars[bars.length - 1]!; // justified: length checked above
```

Use `!` sparingly and only with a comment that explains the invariant.

### `exactOptionalPropertyTypes`

Catches subtle bugs like `{ foo: undefined }` vs `{ }`. The fix is almost
always either dropping the key or making the type `foo?: T | undefined`.

### `useUnknownInCatchVariables`

Already default under `strict`. In `catch (err)`, `err` is `unknown`. The repo
already uses the canonical pattern:

```ts
const message = err instanceof Error ? err.message : String(err);
```

Reuse it. Do not cast `err as Error`.

---

## Type Guard Patterns

### Narrowing from `unknown`

```ts
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}
```

### Narrowing a JSON object

```ts
function isQuoteResult(x: unknown): x is QuoteResult {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.ticker === "string" &&
    typeof o.fetchedAt === "number" &&
    o.scanner != null &&
    typeof o.scanner === "object"
    // ... fill in the rest of the required fields
  );
}
```

This is verbose on purpose. Zod is also in the devDependencies (`zod`) and can
replace hand-rolled guards when you want validation + parsing in one step.

### Zod schema for an upstream response

```ts
import { z } from "zod";

const QuoteResultSchema = z.object({
  ticker: z.string(),
  fetchedAt: z.number(),
  scanner: z.object({
    ticker: z.string(),
    currentPrice: z.string(),
    // ...
  }),
});

export type QuoteResult = z.infer<typeof QuoteResultSchema>;

// At the boundary:
const parsed = QuoteResultSchema.parse(raw); // throws on mismatch
```

Using Zod is preferred when the validation happens at an I/O boundary
(`/api/*` routes). Hand-rolled guards are fine for pure in-process checks.

---

## Migrating A Calculation Module

Example walk-through for `src/lib/calc.ts`:

1. List public exports: `calculateRiskReward`, `calculatePositionSize`,
   `computeRisk`, `calculateSetupScore`, `volumeRatio`.
2. For each, confirm the parameter and return type are explicit.
3. Search for any `any` inside: `grep -n ": any\|<any>\|as any" src/lib/calc.ts`.
4. Replace with the actual type. If the type lives in `types.ts`, import it.
5. For fallible paths, ensure return types include `| null` — then `strict`
   forces every caller to handle the null branch.
6. Re-run `npm run typecheck` + `npm run test`. Every caller that wasn't
   handling null will surface — fix them.

---

## Common Error Shapes

| Error | Cause | Fix |
|-------|-------|-----|
| `Object is possibly 'undefined'` | `noUncheckedIndexedAccess` on array access | Guard with length check or use `.at()` |
| `Type 'string' is not assignable to type 'number'` | UI-formatted string treated as a numeric value | Use `toNumber(value)` from `src/lib/utils.ts` |
| `Type 'X' is not assignable to type 'Y' with 'exactOptionalPropertyTypes'` | Passing `{ foo: undefined }` where `foo?: T` expected | Either omit the key or widen the type to `foo?: T \| undefined` |
| `Property 'x' does not exist on type 'unknown'` | `catch (err)` in strict mode | Narrow with `err instanceof Error` |
| `Argument of type 'unknown' is not assignable to parameter of type 'X'` | JSON result used without validation | Add a guard or parse with Zod |

---

## Review Checklist

When reviewing a PR, block on any of these:

- [ ] New `any` (explicit or implicit via `Record<string, any>` / untyped params).
- [ ] New `as any`, `as unknown as T` (unless the cast is justified in a
      comment and the type it targets is defined in the repo).
- [ ] New `@ts-ignore` (use `@ts-expect-error <why>` instead).
- [ ] Public function without an explicit return type.
- [ ] Fallible function that throws instead of returning `| null` or a
      tagged result.
- [ ] `catch (err: any)` — should be `catch (err)` with unknown narrowing.
- [ ] New upstream data parsed without a guard or Zod schema.

Approve when the PR either avoids these or justifies each one in a comment
on the diff.

---

## Working Around Missing Third-Party Types

If a dep has no types:

1. Check `@types/<name>` on npm.
2. If none, declare a minimal `.d.ts` in `src/types/`:

   ```ts
   declare module "some-lib" {
     export function doThing(x: string): number;
   }
   ```

3. Commit the declaration with the change that uses the library.

Do not use `require(...)` to sidestep missing types. Keep it all `import`.

---

## What Counts As Verified

- `npm run typecheck` exits 0.
- `npm run lint` exits 0.
- `npm run test` exits 0.
- `npm run build` exits 0 (Next.js runs an additional type check during build).

If you only ran `typecheck`, label the change `unverified` on tests and build
and name what you skipped.
