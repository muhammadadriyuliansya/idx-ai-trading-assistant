---
name: typescript-strict-migration
description: >
  Tightening and maintaining TypeScript strictness in this calculation-heavy
  codebase. Targets trading logic, risk calculations, indicators, and pipeline
  types so numeric contracts cannot silently loosen. Use when adding strict
  compiler flags, migrating an `any`-heavy module, tightening a type after a
  bug, or reviewing a PR that adds new `any`, `unknown`, or untyped imports.
license: MIT
metadata:
  version: "1.0.0"
  category: typescript
  sources:
    - tsconfig.json in this repo
    - TypeScript strict flags documentation
    - src/lib/types.ts and src/pipeline/types.ts as canonical shapes
---

# TypeScript Strict Migration Skill

Trading math is the worst place for a silent `any`. This skill is for
incrementally raising the type-safety floor without turning a small change
into a rewrite.

## When to Use

- Adding strict flags to `tsconfig.json`.
- A bug report points at a type mismatch (string vs number, nullable field
  used as non-null, missing branch).
- Reviewing a PR that introduces `as any`, `as unknown as T`, `// @ts-ignore`,
  or untyped third-party imports.
- Migrating a module from loose typing to fully typed (functions returning
  `any`, objects typed as `Record<string, any>`, etc.).

For flag-by-flag migration order, common error shapes, and refactor recipes,
read `reference.md` in this skill directory.

## Current State

This repo already enables the standard `"strict": true` preset via
`tsconfig.json`. The goal of this skill is to keep it that way and push a
small number of additional strictness flags where they pay off — not to
flip everything at once.

## Policy

- `any` is banned in new code. Use `unknown` and narrow.
- `as` casts are a smell. Prefer type guards (`is` predicates, `Number.isFinite`,
  `typeof x === "string"`).
- `// @ts-ignore` is banned. `// @ts-expect-error <reason>` is allowed for
  deliberate mismatches with an expiration note.
- Public module exports must have explicit return types.
- Functions that can fail must return `T | null` or a tagged result object,
  not throw into the void.

## Step 0: Pick A Target Scope

Choose exactly one of:

- A **single module** (e.g. `src/lib/calc.ts`) to eliminate `any` from.
- A **single compiler flag** to enable across the whole project.
- A **single barrel type** (e.g. `AnalysisPipeline`) to fully nail down.

Do not combine these. Mixed migrations always stall.

## Step 1: Baseline

1. `npm run typecheck` — must be green before you start. If it's red, fix
   that first, regardless of the migration target.
2. Count current offenders for the chosen scope. Quick greps:
   - `grep -n "any" src/lib/calc.ts`
   - `grep -rn "as any" src/`
   - `grep -rn "@ts-ignore" src/`
3. Note the offenders in a checklist — you'll tick them off one by one.

## Step 2: Migration Order (for a module)

Work in this order inside the module:

1. **Input parameters.** Replace `any` with the real type from
   `src/lib/types.ts` or `src/pipeline/types.ts`. If the type doesn't exist,
   define it alongside the function.
2. **Return types.** Add an explicit return annotation. The compiler will
   surface every conflicting call site.
3. **Internal variables.** Only loosen to `unknown` when truly necessary
   (JSON parsing, upstream API responses). Narrow with guards before use.
4. **Error paths.** `catch (err)` receives `unknown` in strict mode. Use
   `err instanceof Error ? err.message : String(err)` consistently.
5. **Tests.** Update any test fixtures that used loose shapes.

## Step 3: Migration Order (for a compiler flag)

Candidate flags, in order of value vs. effort for this repo:

| Flag | Value | Effort |
|------|-------|--------|
| `noUncheckedIndexedAccess` | High — prevents `arr[i]` being treated as non-undefined. Critical for OHLCV arrays. | Medium — many loop sites must be updated. |
| `exactOptionalPropertyTypes` | Medium — catches `undefined` vs missing property bugs. | Medium. |
| `noImplicitOverride` | Low — few classes in this repo. | Low. |
| `noPropertyAccessFromIndexSignature` | Low — we don't use index signatures much. | Low. |
| `useUnknownInCatchVariables` | Already default under `strict`. | None. |

For each flag:

1. Enable in `tsconfig.json`.
2. Run `npm run typecheck`. Collect the error list.
3. Group errors by file. Fix one file at a time.
4. Commit per file or per group — do not batch a hundred fixes into one PR.

## Step 4: Common Refactors

### `any` in a calculation function

```ts
// Before
export function compute(input: any) {
  return input.price * input.qty;
}

// After
import type { RiskInput } from "@/lib/types";

export function compute(input: RiskInput): number {
  return input.currentPrice * input.shares;
}
```

If the shape isn't in the types file, add it — don't ship a local anonymous
interface.

### `unknown` from JSON

```ts
const raw: unknown = await response.json();
if (!isQuoteResult(raw)) {
  throw new Error("Malformed quote response");
}
// raw is now QuoteResult
```

Type guard (`isQuoteResult`) lives next to the type in `src/lib/types.ts` or
a `guards.ts` helper.

### `as any` to quiet the compiler

Never. Either:

- The type is wrong — fix the type.
- You need to narrow — add a guard.
- The library is untyped — install or write a `@types/*` module.

### `@ts-ignore`

Replace with `@ts-expect-error <why>`. The expect-error variant will trip the
build when the underlying issue is resolved, preventing stale suppressions.

## Step 5: Verify

1. `npm run typecheck` — green.
2. `npm run lint` — green. ESLint rules for `@typescript-eslint/no-explicit-any`
   should not regress.
3. `npm run test` — green. Type changes frequently surface real bugs.
4. `npm run build` — green. Some type errors only surface during the Next.js
   production type check.

## Closeout

Report: the scope (module name or flag name), the number of offenders
eliminated, the number of tests added/updated, and which verifications ran.
If you merged with known suppressions remaining, list them and state when
they will be revisited.
