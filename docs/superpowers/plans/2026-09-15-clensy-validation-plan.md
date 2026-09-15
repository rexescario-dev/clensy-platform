# `@clensy/validation` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@clensy/validation` workspace package (Laravel-inspired rule engine, field-error contract, React Hook Form resolver, GraphQL validation-error normalizer) and migrate exactly the Add Customer `FormDialog` in `apps/web` to use it, per the Accepted spec.

**Architecture:** `packages/validation` is a new, source-shipped (`"main": "src/index.ts"`) workspace package, transpiled by Next.js the same way `@clensy/client`/`@clensy/ui` already are. Its rule engine (`rules.ts`/`validate.ts`) is pure TypeScript with no React dependency; `react-hook-form.ts` adapts it to RHF's `Resolver<T>` type (RHF is a peer dependency); `normalize.ts` maps a failed `createCustomer` GraphQL error onto the same `FieldErrors` contract, built against a real captured fixture rather than an assumed wire shape. `apps/web`'s Add Customer form is the only consumer touched.

**Tech Stack:** TypeScript (mirrors `packages/ui`'s `tsconfig.json`/ESLint config), Vitest (new setup for this package — no existing `packages/*` precedent), React Hook Form (new `apps/web` dependency), existing Apollo/`@clensy/client` `useCreateCustomerMutation` hook.

**Spec:** [docs/superpowers/specs/2026-09-15-clensy-validation-design.md](../specs/2026-09-15-clensy-validation-design.md) (Accepted, M3 2026-09-15). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**M5 decision:** **Accepted** — 2026-09-15. No remaining blockers; the revisions below were applied and verified. Ready for M6 implementation.

**Revision (plan review, Approved with minor revisions):** Task 2's `in`/`not_in` test description was made unambiguous — `String(value)` is computed once, then compared strictly against each parameter, so a numeric `1` and string `'1'` both pass `in:1,2` while `10` fails (the original wording risked being misread as raw `value === param`). Task 4 was restructured so fixture capture (Steps 1–2) is explicitly discovery-only, with a stated hard rule that no `normalize.ts` parsing code may be written before the fixture exists. Task 5's rules constant now uses `satisfies Rules<CreateCustomerFormValues>` (the package's actual, partial, `Rules<T>` contract) instead of a full `Record<keyof T, string>`, so the migration exercises the real public type. Task 2's empty-value and `string`-rule test coverage was made explicit (the `undefined`/`null`/`''` matrix, and `string`'s edge cases against non-string/non-empty values) rather than left as generic "pass/fail" coverage. Task 3 now requires the resolver to type-check against RHF's own exported error type rather than a hand-rolled one. Task 5 now states exactly when `formError` is cleared and adds a manual check that correcting a server-flagged field and resubmitting clears that error. Task 1's dependency-version wording was loosened — the plan states a `^7.x` peer range and defers the exact resolution to `pnpm-lock.yaml`, not to a version hand-recorded into this document.

**Also relies on (Accepted, unmodified by this plan):** [Customers & Properties](../specs/2026-08-15-customers-properties-design.md) (`CreateCustomerInput`, `createCustomer` resolver, `Customer` non-empty invariant, email-syntax-is-presentation-layer split — none of this plan's tasks touch `apps/api`). [App Router i18n Architecture](../specs/2026-09-13-web-i18n-architecture-design.md) (the `validation.<rule>` catalog contract this plan's messages are compatible with but does not wire up — spec §6, out of scope here).

---

## Global Constraints

- SHALL NOT add `react-hook-form`, RHF types, or a validation-engine import to `@clensy/ui`; SHALL NOT add an `Input`/textarea/children-slot component to `@clensy/ui`. `packages/ui/**` is untouched by every task in this plan.
- SHALL NOT modify `apps/api/**` in any way — `CreateCustomerInput`, the `createCustomer` resolver/service, and the global `ValidationPipe`/GraphQL module configuration are read-only inputs to this plan (Task 4 only *reads* the API's behavior to capture a fixture; it does not change the API).
- SHALL implement exactly the rule set the Accepted spec §4.2 enumerates — `required`, `nullable`, `string`, `integer`, `numeric`, `boolean`, `array`, `email`, `url`, `min`, `max`, `between`, `in`, `not_in`, `same`, `different`, `required_if`, `required_unless`, `required_with`, `required_without`. SHALL NOT add date rules, `confirmed`, regex rules, or any rule outside this list.
- SHALL constrain `Rules<T>`/`validate<T>` to `T extends object` (spec §4.2's corrected generic constraint) — SHALL NOT use `T extends Record<string, unknown>`.
- SHALL implement `min`/`max`/`between` per spec §4.2 exactly: string → character length, number (or numeric-looking string) → numeric value, array → item count; both bounds of `between` inclusive. SHALL implement `in`/`not_in` via strict `String(value) === param` comparison (no loose/numeric coercion). SHALL implement `same`/`different` via strict `===` on the two field values. SHALL implement `url` as "`new URL(value)` does not throw" (no scheme allow-list).
- SHALL throw a plain `Error` for an unrecognized rule name or a rule invoked with missing/invalid required parameters (spec §4.2's "programmer error" policy) — SHALL NOT silently ignore an unknown/malformed rule token or treat the field as passing.
- SHALL implement the empty-value short-circuit exactly as specified: an empty (`undefined`/`null`/`''`) value with a satisfied `required` (or conditional-required) rule emits only the `required` message; an empty value that is not required emits no error and evaluates no further rule for that field, regardless of `nullable`'s presence.
- SHALL keep `nullable` a declarative no-op beyond the short-circuit above — SHALL NOT give it independent behavior in this slice.
- SHALL keep the public contract at `FieldErrors = Record<string, string[]>` for `validate`/`clensyResolver`/`normalizeApiValidationErrors` — SHALL NOT leak rule name/params across that boundary (spec §6).
- SHALL declare `react-hook-form` as a `peerDependency` (+ matching `devDependency`) of `@clensy/validation` — SHALL NOT bundle it as a regular `dependency`.
- SHALL add `'@clensy/validation'` to `apps/web/next.config.ts`'s `transpilePackages` array without removing or reordering `'@clensy/client'`/`'@clensy/ui'` or any entry in the `redirects()` array.
- SHALL NOT write `normalize.ts`'s parsing logic against an assumed/guessed GraphQL error shape. MUST capture one real failed `createCustomer` mutation response from the running dev API as a committed fixture before implementing or testing the parser (spec §4.5, blocking — Task 4).
- SHALL keep Add Customer's mutation `variables` shape and `notes`-trim-to-`undefined` normalization behavior unchanged from the pre-migration implementation. SHALL NOT modify Edit customer, Add property, or Edit property in `apps/web/app/app/customers/page.tsx` — only the Add Customer `FormDialog` block.
- SHALL NOT touch `apps/web/app/login/page.tsx` or any login wiring; login never calls `normalizeApiValidationErrors`.
- SHALL NOT wire `@clensy/validation`'s messages into the i18n `validation.<rule>` catalog or import `next-intl` anywhere in `packages/validation` (spec §6 — documented compatibility only, not implemented here).
- SHALL NOT add a client-only `max` length rule to Add Customer's `fullName`/`email`/`phone`/`notes` rules (spec §4.2 — the backend DTO has no length constraint).
- SHALL NOT add a test runner other than Vitest.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/validation/package.json` | New `@clensy/validation` manifest — mirrors `packages/ui`'s shape + `test` script + `vitest`/`react-hook-form` devDeps + `react-hook-form` peerDep |
| `packages/validation/tsconfig.json` | Mirrors `packages/ui`'s, no `"jsx"` |
| `packages/validation/eslint.config.mjs` | Reuses `../../tooling/eslint.contextforge.mjs` |
| `packages/validation/vitest.config.ts` | New: `environment: 'node'`, `include: ['src/**/*.test.ts']` |
| `packages/validation/src/index.ts` | Public exports only |
| `packages/validation/src/types.ts` | `RuleString`, `Rules<T>`, `FieldErrors`, `ValidateOptions` |
| `packages/validation/src/rules.ts` | Rule-string parser + all rule implementations |
| `packages/validation/src/rules.test.ts` | Per-rule pass/fail cases, unknown/malformed-rule throw behavior |
| `packages/validation/src/messages.ts` | Default Laravel-style templates + `:attribute` humanization/override |
| `packages/validation/src/messages.test.ts` | Message-formatting tests |
| `packages/validation/src/validate.ts` | `validate(values, rules, options) -> FieldErrors` |
| `packages/validation/src/validate.test.ts` | Empty-value short-circuit, `nullable` no-op, cross-field rules, `required_if` worked example |
| `packages/validation/src/react-hook-form.ts` | `clensyResolver(rules, options) -> Resolver<T>` |
| `packages/validation/src/react-hook-form.test.ts` | Resolver success/failure shape, first-message selection |
| `packages/validation/src/normalize.ts` | `normalizeApiValidationErrors(error, knownFields) -> FieldErrors \| undefined` |
| `packages/validation/src/normalize.test.ts` | Against the captured fixture; unrecognized-error → `undefined` |
| `packages/validation/src/__fixtures__/create-customer-validation-error.json` | Real captured `createCustomer` GraphQL validation-error response (Task 4) |
| `packages/validation/README.md` | "How to add a validated form" doc |
| `apps/web/package.json` | Adds `"@clensy/validation": "workspace:*"`, `"react-hook-form"` |
| `apps/web/next.config.ts` | `transpilePackages` gains `'@clensy/validation'` |
| `apps/web/app/app/customers/page.tsx` | Add Customer `FormDialog` migrated to `useForm` + `clensyResolver` + `normalizeApiValidationErrors` |

**Must remain untouched:** `apps/api/**`, `packages/ui/**`, `apps/web/app/login/**`, `apps/web/middleware.ts`, `apps/web/next.config.ts`'s `redirects()` entries, `apps/web/app/app/customers/page.tsx`'s Edit customer / Add property / Edit property blocks.

---

### Task 1: Scaffold `packages/validation` and wire it into the workspace

**Files:**
- Create: `packages/validation/package.json`, `packages/validation/tsconfig.json`, `packages/validation/eslint.config.mjs`, `packages/validation/vitest.config.ts`, `packages/validation/src/index.ts`, `packages/validation/src/index.test.ts`
- Modify: `apps/web/package.json`, `apps/web/next.config.ts`

**Interfaces:** none yet (empty package skeleton, proven to build/lint/test/transpile).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@clensy/validation",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "peerDependencies": {
    "react-hook-form": "^7.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.18.0",
    "eslint": "^9.18.0",
    "globals": "^17.0.0",
    "react-hook-form": "^7.0.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0",
    "vitest": "^5.0.0"
  }
}
```

`vitest`'s version should match `apps/web/package.json`'s installed major for consistency. `react-hook-form` is new to the repo: run `pnpm view react-hook-form version` to confirm the current stable major is `7.x` (or note if it has moved past that), declare the `^7.x` peer/dev range shown above, and let `pnpm-lock.yaml` — not this document — record the exact resolved version. Do not edit this plan file to pin a specific patch version after `pnpm install` resolves one.

- [ ] **Step 2: Write `tsconfig.json`** (mirrors `packages/ui`'s, minus `"jsx"` — no React components in this package)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "declaration": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `eslint.config.mjs`** (identical pattern to `packages/ui/eslint.config.mjs`, `globals.node` instead of `globals.browser` — this package has no DOM code)

```js
// @ts-check
import { contextforgeJavascript } from '../../tooling/eslint.contextforge.mjs';
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  ...contextforgeJavascript({ eslint, tseslint }),
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write the failing smoke test**

`packages/validation/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as validation from './index';

describe('@clensy/validation package', () => {
  it('resolves as a module', () => {
    expect(validation).toBeDefined();
  });
});
```

- [ ] **Step 6: Minimal `index.ts` to pass the smoke test**

```ts
export {};
```

- [ ] **Step 7: Install and verify**

```bash
pnpm install
pnpm --filter validation lint
pnpm --filter validation build
pnpm --filter validation test
```

Expect all three to pass on an intentionally empty package.

- [ ] **Step 8: Wire `apps/web`**

`apps/web/package.json` `dependencies` gains (alongside the existing `@clensy/client`/`@clensy/ui` entries):

```json
"@clensy/validation": "workspace:*",
"react-hook-form": "^7.0.0"
```

`apps/web/next.config.ts` — extend the existing array in place, do not replace it:

```ts
transpilePackages: ['@clensy/client', '@clensy/ui', '@clensy/validation'],
```

```bash
pnpm install
pnpm --filter web build
```

Expect success — this is the check that catches a missed `transpilePackages` entry (spec §4.1).

- [ ] **Step 9: Commit**

```bash
git add packages/validation apps/web/package.json apps/web/next.config.ts pnpm-lock.yaml
git commit -m "chore(validation): scaffold @clensy/validation package"
```

---

### Task 2: Rule engine — types, parser, rules, messages, `validate()`

**Files:**
- Create: `packages/validation/src/types.ts`, `packages/validation/src/rules.ts`, `packages/validation/src/rules.test.ts`, `packages/validation/src/messages.ts`, `packages/validation/src/messages.test.ts`, `packages/validation/src/validate.ts`, `packages/validation/src/validate.test.ts`
- Modify: `packages/validation/src/index.ts`

**Interfaces:**
- Produces: `RuleString`, `Rules<T extends object>`, `FieldErrors`, `ValidateOptions`, `validate<T extends object>(values, rules, options?) -> FieldErrors`

- [ ] **Step 1: `types.ts`**

```ts
export type RuleString = string;
export type Rules<T extends object> = Partial<Record<keyof T, RuleString>>;
export type FieldErrors = Record<string, string[]>;

export interface ValidateOptions {
  attributes?: Record<string, string>;
  messages?: Partial<Record<string, string>>; // keyed by rule name; overrides the default template
}
```

- [ ] **Step 2: Write failing `rules.test.ts`** — one `describe` block per rule in the spec §4.2 list, covering:
  - Pass and fail cases for `required`, `integer`, `numeric`, `boolean`, `array`, `email`.
  - `string` explicitly against: `null` → no error (empty-value short-circuit owns this, not the `string` rule itself — see Step 8's `validate.test.ts` for where that's actually asserted; this file's `string`-rule-in-isolation tests may call the rule function directly with a non-empty invalid type), `123` → `string` error, `true` → `string` error, and a genuine string → pass.
  - `min`/`max`/`between` on string length, numeric value, and array item count (inclusive bounds).
  - `in`/`not_in`: compute `String(value)` **once**, then compare that single string strictly (`===`) against each comma-separated parameter — this is not raw `value === param`. Explicit table for `in:1,2`:

    | Value | `String(value)` | Result |
    | --- | --- | --- |
    | `1` (number) | `'1'` | pass |
    | `'1'` (string) | `'1'` | pass |
    | `'1 '` (trailing space) | `'1 '` | fail |
    | `10` (number) | `'10'` | fail |

    `not_in` is the exact negation of this same comparison.
  - `same`/`different` strict equality against a sibling field.
  - `url` — accepts `'https://example.com'`, `'mailto:a@b.com'` (non-http scheme, still valid per spec), rejects `'not a url'`.
  - `required_if`/`required_unless`/`required_with`/`required_without` — the exact three-case shape from spec §4.2's worked example (condition false + empty → valid; condition true + empty → required error; condition true + non-empty → remaining rules run).
  - Unknown rule name (e.g. `'emali'`) throws a plain `Error`.
  - Malformed rule parameters (`'between:1'`, `'min:abc'`) throw a plain `Error`.

- [ ] **Step 3: Implement `rules.ts`** — grammar parser (`ruleName` / `ruleName:param1,param2`, tokens split on `|`) plus one function per rule name, dispatched by a lookup table. Throw for any rule name not in the spec §4.2 list, and for any rule whose required parameters are missing/non-numeric where the rule expects a number. `in`/`not_in` specifically: convert the candidate value to `String(value)` exactly once, then compare that resulting string strictly against each parameter — do not compare the original, un-stringified value against the (always-string) parameters.

- [ ] **Step 4: Run `rules.test.ts` — expect PASS**

```bash
pnpm --filter validation test -- rules
```

- [ ] **Step 5: Write failing `messages.test.ts`**

Cover: default `:attribute` humanization (`fullName` → `"full name"`) for every rule's default template; an explicit `attributes` override; an explicit `messages` override replacing a rule's default template text.

- [ ] **Step 6: Implement `messages.ts`** — the default English template per rule (`:attribute` placeholder), the camelCase-to-humanized-words function, and the lookup that applies `ValidateOptions.attributes`/`.messages` overrides.

- [ ] **Step 7: Run `messages.test.ts` — expect PASS**

- [ ] **Step 8: Write failing `validate.test.ts`**

Cover: a field absent from the result map when valid (not present with `[]`); the empty-value short-circuit (empty + required → only the `required` message; empty + not required → no error, and a would-otherwise-fail second rule like `email` does not fire). Test the full empty-value matrix explicitly, all three representations against both a required and a non-required rule string, asserting `validate()`'s output directly (this is where the short-circuit is actually proven centrally, not left to `rules.ts`'s per-rule tests or incidentally to HTML/RHF behavior):

| Value | `required|string` | `nullable|string` | `string` (bare) |
| --- | --- | --- | --- |
| `undefined` | one `required` message | valid (no error) | valid (no error) |
| `null` | one `required` message | valid (no error) | valid (no error) |
| `''` | one `required` message | valid (no error) | valid (no error) |

The last two columns must produce byte-identical results for every row — that's the explicit proof that `nullable` is a documented no-op (spec §4.2), not a rule the engine special-cases. Also cover: cross-field rule evaluation reading sibling values from the same `values` object; the `required_if` worked example end to end via `validate()` (not just `rules.ts`'s unit-level check).

- [ ] **Step 9: Implement `validate.ts`** — iterate `rules`, apply the empty-value short-circuit before delegating to `rules.ts`'s per-rule functions, collect one-or-more messages per field via `messages.ts`, omit fields with zero messages from the returned map.

- [ ] **Step 10: Run `validate.test.ts` — expect PASS**

- [ ] **Step 11: `index.ts` exports**

```ts
export type { RuleString, Rules, FieldErrors, ValidateOptions } from './types';
export { validate } from './validate';
```

- [ ] **Step 12: Full package verification**

```bash
pnpm --filter validation lint
pnpm --filter validation build
pnpm --filter validation test
```

- [ ] **Step 13: Commit**

```bash
git add packages/validation/src
git commit -m "feat(validation): implement rule engine, messages, and validate()"
```

---

### Task 3: React Hook Form resolver

**Files:**
- Create: `packages/validation/src/react-hook-form.ts`, `packages/validation/src/react-hook-form.test.ts`
- Modify: `packages/validation/src/index.ts`

**Interfaces:**
- Consumes: `validate` (Task 2), `react-hook-form`'s `Resolver<T>`/`FieldValues` types
- Produces: `clensyResolver<T extends FieldValues>(rules: Rules<T>, options?: ValidateOptions) -> Resolver<T>`

- [ ] **Step 1: Write failing `react-hook-form.test.ts`**

Cover: a passing `validate()` result produces RHF's success shape (`{ values, errors: {} }`, `values` equal to the input); a failing result produces RHF's `FieldErrors` shape (`{ values: {}, errors: { field: { type: 'validation', message } } }`) with `message` equal to the first string of a multi-message field; calling the resolver directly (it is a plain async function matching `Resolver<T>` — no React rendering needed to test it).

- [ ] **Step 2: Implement `react-hook-form.ts`**

Use RHF's own exported error/resolver types (`FieldErrors<T>`, `FieldValues`, `Resolver`, and whatever per-field error type the installed RHF version exports, e.g. `FieldError`) rather than a hand-rolled shape like `Record<string, { type: string; message: string }>`. Inspect the installed `react-hook-form` version's type declarations before writing this file — the exact export name for the per-field error type may differ slightly by version; use whatever it actually exports, not a re-derivation of it. Illustrative shape (confirm exact types against the installed version):

```ts
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { Rules, ValidateOptions } from './types';
import { validate } from './validate';

export function clensyResolver<T extends FieldValues>(
  rules: Rules<T>,
  options?: ValidateOptions,
): Resolver<T> {
  return async (values) => {
    const errors = validate(values, rules, options);
    if (Object.keys(errors).length === 0) {
      return { values, errors: {} };
    }
    const fieldErrors = {} as FieldErrors<T>;
    for (const [field, messages] of Object.entries(errors)) {
      fieldErrors[field as keyof T] = { type: 'validation', message: messages[0] } as FieldErrors<T>[keyof T];
    }
    return { values: {}, errors: fieldErrors };
  };
}
```

Do not use `as any` or otherwise weaken the resolver's return type to work around a type mismatch — if the installed RHF version's types don't fit cleanly, that is a signal to adjust the cast to something precise (as above) or, if genuinely blocked, to flag it rather than silently loosen the types.

- [ ] **Step 3: Run `react-hook-form.test.ts` — expect PASS**

- [ ] **Step 3b: Type-check against the installed RHF version**

```bash
pnpm --filter validation build
```

This `tsc --noEmit` run is the check that the resolver's return value genuinely satisfies RHF's own `Resolver<T>`/`FieldErrors<T>` types as installed — not just that the hand-written test happens to pass at runtime.

- [ ] **Step 4: `index.ts` export**

```ts
export { clensyResolver } from './react-hook-form';
```

- [ ] **Step 5: Full package verification** (`lint`, `build`, `test`)

- [ ] **Step 6: Commit**

```bash
git add packages/validation/src
git commit -m "feat(validation): add React Hook Form resolver"
```

---

### Task 4: Capture the real GraphQL validation-error fixture, then implement the normalizer

**Files:**
- Create: `packages/validation/src/__fixtures__/create-customer-validation-error.json`, `packages/validation/src/normalize.ts`, `packages/validation/src/normalize.test.ts`
- Modify: `packages/validation/src/index.ts`

**Interfaces:**
- Produces: `normalizeApiValidationErrors(error: unknown, knownFields: string[]) -> FieldErrors | undefined`

**Hard sequencing rule for this task:** Steps 1–2 are discovery/capture only. **No line of `normalize.ts` may be written, and the file must not even be scaffolded with a parsing-shaped skeleton, until Step 2's fixture is committed to disk.** This is stronger than "don't finalize against a guess" — there is no partial-credit parser implementation before the fixture exists. Steps 3 onward (test-writing and implementation) start only after Step 2 is done and Step 2b has recorded what the fixture actually looks like.

- [ ] **Step 1: Start the dev API against a local database**

```bash
docker compose up -d postgres
pnpm --filter api migration:run
pnpm --filter api start:dev
```

Confirm `apps/api`'s `.env` (or environment) has `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` set (`apps/api/src/platform/database/seed.ts` requires both to seed an admin), then `pnpm db:seed` if a seeded admin session is needed to call `createCustomer` (it's behind `AuthGuard`/`@Roles()` per Customers & Properties).

- [ ] **Step 2: Trigger a real failed `createCustomer` mutation and capture the raw response**

Authenticate (GraphQL `login` mutation with the seeded admin credentials, or reuse an existing dev session cookie), then call `createCustomer` with an intentionally invalid input — e.g. omit `email`, or send `email: 'not-an-email'` — via `curl`/a GraphQL client against the API's GraphQL endpoint. Save the complete raw JSON response body (not a paraphrase) to `packages/validation/src/__fixtures__/create-customer-validation-error.json`. If the shape differs from what spec §4.5 anticipated (a field-keyed `extensions` entry vs. Nest's default array of `"<property> <constraint description>"` strings), that's fine — the fixture is authoritative, not the spec's anticipation.

- [ ] **Step 2b: Inspect and document the observed shape (still discovery, no code)**

Before writing any test or implementation, write one or two sentences (in the eventual commit message or a comment atop the fixture file) describing what the captured response actually looks like: is it a single `GraphQLError`, an array of them; is `extensions.code` present and what value; is the per-field information already structured (`extensions.field`/`extensions.rule`) or only present as free-text constraint strings; if free-text, do they follow the `"<property> <constraint description>"` shape. This is the concrete checkpoint separating "we captured something" from "we understand what we captured" — Step 3 depends on this understanding, not just the raw file.

- [ ] **Step 3: Write failing `normalize.test.ts`** against the captured fixture, informed by Step 2b's documented shape

Cover: the captured fixture, passed through `normalizeApiValidationErrors(fixtureError, ['fullName', 'email', 'phone', 'notes'])`, returns a `FieldErrors` map with the correct field(s) populated; an unrelated error shape (e.g. `new Error('Network error')`, or a GraphQL error with no recognizable validation structure) returns `undefined`.

- [ ] **Step 4: Implement `normalize.ts`** to parse exactly the captured fixture's shape (direct field-keyed map, or leading-token parsing against `knownFields` for Nest's default array-of-strings shape — whichever the fixture actually shows), returning `undefined` for anything that doesn't match that recognized shape.

- [ ] **Step 5: Run `normalize.test.ts` — expect PASS**

- [ ] **Step 6: `index.ts` export**

```ts
export { normalizeApiValidationErrors } from './normalize';
```

- [ ] **Step 7: Full package verification** (`lint`, `build`, `test`)

- [ ] **Step 8: Commit**

```bash
git add packages/validation/src
git commit -m "feat(validation): add GraphQL validation-error normalizer with captured fixture"
```

---

### Task 5: Migrate Add Customer

**Files:**
- Modify: `apps/web/app/app/customers/page.tsx`

**Interfaces:**
- Consumes: `clensyResolver`, `normalizeApiValidationErrors` (Tasks 3–4), `react-hook-form`'s `useForm`

- [ ] **Step 1: Establish the regression baseline**

```bash
pnpm --filter web test
pnpm --filter web build
```

Confirm both pass before touching the file (existing customers-page behavior, if any tests cover it, is the baseline to preserve).

- [ ] **Step 2: Define the rules and form-values type** (near the top of the file or in a small local const, per spec §4.2)

```ts
import type { CreateCustomerInput } from '@clensy/client'; // or the codegen-produced input type, if exported — otherwise a local interface matching it
import { clensyResolver, normalizeApiValidationErrors, type Rules } from '@clensy/validation';
import { useForm } from 'react-hook-form';

interface CreateCustomerFormValues {
  fullName: string;
  email: string;
  phone: string;
  notes?: string;
}

const createCustomerRules = {
  fullName: 'required|string',
  email: 'required|email',
  phone: 'required|string',
  notes: 'nullable|string',
} satisfies Rules<CreateCustomerFormValues>;
```

Use `satisfies Rules<CreateCustomerFormValues>` — the package's actual, partial (`Partial<Record<keyof T, RuleString>>`) public type — not `Record<keyof T, string>`. The latter would type-check here only because this particular form happens to declare a rule for every field; it doesn't exercise or prove the package's real (partial) contract, and a future form with an intentionally unvalidated field would silently need a different annotation. Using `Rules<T>` directly is both more correct and doubles as a worked usage example for the package README (Task 6).

Check whether `@clensy/client`'s codegen output already exports a usable `CreateCustomerInput`-shaped type before declaring `CreateCustomerFormValues` locally — reuse it if the shape matches exactly (all fields required except `notes`), to avoid a duplicate type.

- [ ] **Step 3: Replace the four `useState` fields with `useForm`**

```ts
const form = useForm<CreateCustomerFormValues>({
  resolver: clensyResolver(createCustomerRules),
});
```

Remove `fullName`/`email`/`phone`/`notes` `useState` declarations and `resetForm()`'s body in favor of `form.reset()`. Keep a `formError` state only for the generic non-field fallback message (spec §4.6 keeps that path for unrecognized failures), but its lifecycle must now be explicit rather than implied:

- `openCreateForm()` clears `formError` (alongside calling `form.reset()`) — reopening the dialog must not show a stale message from a previous attempt.
- `onValid` clears `formError` (`setFormError(undefined)`) at the start of every submit attempt, before the mutation call — matching the current pre-migration behavior's own `setFormError(undefined)` at the top of `handleCreateSubmit`.
- `formError` is set only in the `catch` branch when `normalizeApiValidationErrors` returns `undefined` (an unrecognized failure); it is never set alongside a field-level `form.setError(...)` call.

- [ ] **Step 4: Update each `FormField`**

```tsx
<FormField
  label="Full name"
  error={form.formState.errors.fullName?.message}
  {...form.register('fullName')}
/>
<FormField
  label="Email"
  type="email"
  error={form.formState.errors.email?.message}
  {...form.register('email')}
/>
<FormField
  label="Phone"
  error={form.formState.errors.phone?.message}
  {...form.register('phone')}
/>
<FormField
  label="Notes"
  error={form.formState.errors.notes?.message}
  {...form.register('notes')}
/>
```

Drop the `required`/`value`/`onChange`/`name="new-*"` props RHF's `register` now supersedes; keep `id`/`name` sourced from `register`'s own return (RHF sets `name` to the registered key).

- [ ] **Step 5: Update the submit handler** (per spec §4.6)

```ts
async function onValid(values: CreateCustomerFormValues) {
  setFormError(undefined);
  try {
    await createCustomer({
      variables: {
        input: {
          ...values,
          notes: values.notes?.trim() === '' ? undefined : values.notes,
        },
      },
    });
    setFormOpen(false);
    form.reset();
    await refetch();
  } catch (err) {
    const fieldErrors = normalizeApiValidationErrors(err, ['fullName', 'email', 'phone', 'notes']);
    if (fieldErrors) {
      for (const [field, messages] of Object.entries(fieldErrors)) {
        form.setError(field as keyof CreateCustomerFormValues, { type: 'server', message: messages[0] });
      }
    } else {
      setFormError('Unable to create customer.');
    }
  }
}
```

**Server-set field errors and resubmission (no extra logic to write, but verify the behavior):** when `form.setError('email', ...)` runs after a server-side rejection and the user then edits that field and resubmits, RHF's own resolver-driven revalidation on the next `handleSubmit` call re-evaluates `email` against `clensyResolver` and replaces/clears the stale server-set error — this is stock RHF behavior given a resolver is configured, not something this task needs to implement. Do not add a manual `form.clearErrors()` call or other custom clearing logic; Step 9's golden path below proves the existing wiring already does this.

- [ ] **Step 6: Wire `FormDialog`**

```tsx
<FormDialog
  open={formOpen}
  onClose={() => setFormOpen(false)}
  title="Add customer"
  onSubmit={form.handleSubmit(onValid)}
  submitLabel={creating ? 'Creating…' : 'Add customer'}
  submitting={creating}
>
  {/* fields from Step 4 */}
  {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
</FormDialog>
```

Do not modify `openCreateForm`'s call site beyond swapping `resetForm()` for `form.reset()`.

- [ ] **Step 7: `pnpm --filter web lint` and `pnpm --filter web build`**

- [ ] **Step 8: `pnpm --filter web test`** — confirm no regression

- [ ] **Step 9: Manual golden path**

Run `pnpm dev` (or `pnpm --filter web dev`), open `/app/customers`, and verify:
1. Submitting the Add Customer dialog with all fields blank shows `required` errors on `fullName`/`email`/`phone` only — `notes` shows no error, and no mutation fires.
2. An invalid email (e.g. `not-an-email`) shows only the `email` message on that field.
3. Valid input creates the customer, closes the dialog, and the list refetches — same behavior as before this task.
4. If reproducible, a forced backend validation failure sets a field error via `normalizeApiValidationErrors` instead of the generic fallback.
5. After step 4's server-set field error, correcting that field's value and resubmitting successfully clears the previous error (no leftover server-error message once the corrected submission succeeds or passes client-side validation) — confirms RHF's stock resolver-driven revalidation is doing this, per the note in Step 5.
6. Reopening the dialog after a prior generic `'Unable to create customer.'` failure (e.g. cancel and reopen, or a subsequent successful submit) does not show the stale message.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/app/customers/page.tsx
git commit -m "feat(web): migrate Add Customer to @clensy/validation"
```

---

### Task 6: Package README

**Files:**
- Create: `packages/validation/README.md`

**Interfaces:** none (documentation only)

- [ ] **Step 1: Write the doc** covering:
  - What `@clensy/validation` is and the layer boundary it enforces (`@clensy/ui` stays presentation-only; RHF lives in `apps/web`).
  - How to declare rules (`Rules<T>`, the rule-string grammar, the full rule list).
  - How to wire `useForm({ resolver: clensyResolver(rules) })` and spread `register(...)` onto a `FormField`.
  - How to call `normalizeApiValidationErrors` in a mutation's catch block, with the "returns `undefined` for anything unrecognized → keep your generic fallback" contract.
  - A pointer to the Add Customer migration (`apps/web/app/app/customers/page.tsx`) as the worked example.
  - A short note that message text is fixed English today and the i18n catalog integration is documented but not implemented (spec §6), so as not to surprise a future reader who expects `validation.<rule>` keys to already work.

- [ ] **Step 2: Commit**

```bash
git add packages/validation/README.md
git commit -m "docs(validation): add package README"
```

---

### Task 7: Full verification

**Files:** none new unless a compatibility fix surfaces (then the smallest change to the affected file, with its own commit).

- [ ] **Step 1: Full monorepo checks**

```bash
pnpm --filter validation lint
pnpm --filter validation build
pnpm --filter validation test
pnpm --filter web lint
pnpm --filter web build
pnpm --filter web test
```

- [ ] **Step 2: Clean-tree check**

```bash
git status --short
```

Confirm only the files this plan's tasks intentionally touched are modified, and that `packages/ui/**` and `apps/api/**` show zero diff.

```bash
git diff --stat main...HEAD -- packages/ui apps/api
```

Expect empty output.

- [ ] **Step 3: Re-confirm the login page is untouched**

```bash
git diff --stat main...HEAD -- apps/web/app/login apps/web/middleware.ts
```

Expect empty output.

- [ ] **Step 4: N/A unless Step 1 surfaced a fix — if so, commit it separately with a description of what broke and why.**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Package scaffold, workspace/`transpilePackages` wiring (§4.1) | 1 |
| Rule engine, `Rules<T>`/`validate<T>` generic constraint, empty-value short-circuit, type coercion, `min`/`max`/`between`/`in`/`not_in`/`same`/`different`/`url` semantics, unknown/malformed-rule throw, `nullable` no-op (§4.2) | 2 |
| Default Laravel-style messages, `:attribute` humanization/override (§4.3) | 2 |
| `clensyResolver` RHF adapter, `FormDialog` zero-change integration (§4.4) | 3, 5 |
| GraphQL fixture capture (blocking) + `normalizeApiValidationErrors` (§4.5) | 4 |
| Add Customer migration, unchanged mutation variables/`notes` normalization (§4.6) | 5 |
| `react-hook-form` peer dependency placement, source-shipped package convention (§5) | 1 |
| Rule metadata internal-only / `FieldErrors` public contract (§6) | 2, 3, 4 |
| Unit tests per rule, message formatting, resolver, normalizer-against-fixture (§7) | 2, 3, 4 |
| Package README / "how to add a validated form" (§2, Task 6 of the spec's suggested steps) | 6 |
| Non-goals: `@clensy/ui` untouched, no `apps/api` change, no other form migrated, no i18n wiring, no client-only `max`, login untouched (§8) | 7 (verified by omission) |

## Type consistency

- `RuleString`, `Rules<T extends object>`, `FieldErrors`, `ValidateOptions` — Task 2, consumed by `rules.ts`/`validate.ts`/`react-hook-form.ts`/`normalize.ts` and re-exported from `index.ts`
- `validate<T extends object>` — Task 2, consumed by `clensyResolver` (Task 3)
- `clensyResolver<T extends FieldValues>` — Task 3, consumed by Add Customer's `useForm` (Task 5)
- `normalizeApiValidationErrors` — Task 4, consumed by Add Customer's submit handler (Task 5)
- `CreateCustomerFormValues` — Task 5, local to `apps/web/app/app/customers/page.tsx` (or reused from `@clensy/client`'s codegen output if an exact match exists — confirm in Task 5 Step 2)
