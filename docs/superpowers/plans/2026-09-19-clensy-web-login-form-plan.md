# `@clensy/web` and the Login Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Input` and the shadcn `Field` family (`Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError`, plus whatever else the same registry item generates) to `packages/ui/src/base/`; create a new `packages/web` (`@clensy/web`) workspace package with `src/auth/login-form.tsx`, encapsulating the login form's field state, client validation, submission, and generic-error handling behind an injected `onLogin` action and already-translated `labels`/`errorMessage` props; refactor `apps/web/app/login/page.tsx` to render `LoginForm` instead of the hand-rolled form.

**Architecture:** Three layers — `@clensy/ui` (generic UI, gains `Input`/`Field`), `@clensy/web` (new, the sole home for Clensy domain components, starting with `auth/LoginForm`), `apps/web` (application composition: route, redirect, i18n lookup, GraphQL call). `packages/ui/src/domain/` becomes documented-legacy (not physically removed this slice). One-way dependency: `@clensy/ui` never imports `@clensy/web`.

**Tech Stack:** TypeScript, React 19, `react-hook-form` (new direct dependency of `@clensy/web`, mirroring `apps/web`'s existing usage), `@clensy/validation`'s `clensyResolver`/`Rules<T>` (unchanged), Tailwind 4 (content-scanning extended to `packages/web/src`), Next.js `transpilePackages` (gains `@clensy/web`). No `vitest`/test-runner wiring added to `@clensy/web` this slice (§ Global Constraints).

**Spec:** [docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md](../specs/2026-09-19-clensy-web-login-form-design.md) (Accepted, M3 2026-09-19). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**M5 decision:** **Accepted** — 2026-09-19. Round 1 required: (1) resolving the "exactly two new files" vs. `label.tsx` contradiction between Global Constraints and Task 1; (2) distinguishing external-package deps from the internal `cn` import in Task 1's verification step; (3) removing the hand-authored fallback for `input.tsx`/`field.tsx` generation (the spec requires "generated fresh (not hand-authored)" with no fallback authorized) in favor of stop-and-report; (4) an explicit no-memoization note in Task 3; (5) not mechanically moving comments in Task 4 — placing each with the logic it explains instead; (6) replacing Task 6's brittle `git status`/regex scope check with explicit `git diff --name-only` checks; (7) an explicit baseline-capture step before Task 4 modifies `page.tsx`, reading the real current file rather than relying solely on this plan's reference snippets; (8) Task 2's Tailwind `@source` step inspecting and matching the file's existing convention rather than inserting a literal. All applied. Round 2 confirmed all eight addressed with no remaining executability or traceability blocker. Ready for M6 implementation.

**Also relies on (Accepted, unmodified by this plan):** [`@clensy/ui` as the Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md) (the `base/` boundary, the `@clensy/ui`-only-shadcn rule, `packages/ui`'s existing `radix-ui`/`class-variance-authority`/`cn`/`lucide-react` dependencies — this plan adds two new `base/` files under that same boundary, nothing about the boundary itself changes). [Web i18n Architecture](../specs/2026-09-13-web-i18n-architecture-design.md) / `apps/web/README.md`'s i18n boundary (translated-strings-as-props rule, now also followed by `@clensy/web`). [`@clensy/validation` Design](../specs/2026-09-15-clensy-validation-design.md) (`clensyResolver`/`Rules<T>`/`FieldErrors`, consumed unchanged by `LoginForm`).

---

## Global Constraints

- SHALL add `input.tsx` and `field.tsx` to `packages/ui/src/base/`, plus only those additional files the `field` registry item's own transitive shadcn registry dependencies actually require (e.g. `label.tsx`, if shadcn's current `field` registry item depends on it) — SHALL NOT add any file beyond what that dependency graph requires. All such files SHALL be generated via the shadcn CLI following shadcn's current recipe, not hand-invented from memory (spec §4.2, §2 informative — see the stop-and-report rule in Task 1/Step 1 if generation isn't possible). SHALL export every named export every such file produces from `packages/ui/src/index.ts`.
- SHALL NOT add any new `packages/ui` runtime dependency unless the generated `input.tsx`/`field.tsx` actually import one not already present (`radix-ui`, `class-variance-authority`, `cn`, `lucide-react` are already dependencies) — verify by reading the generated files' own imports before editing `package.json` (spec §4.2).
- SHALL NOT modify, deprecate in code, or repoint `packages/ui/src/base/form-field.tsx`. It stays as-is (spec §2).
- SHALL create `packages/web` as a new pnpm workspace member (`@clensy/web`), source-only (`"main": "src/index.ts"`, no build step), mirroring `packages/ui`'s scaffold shape (browser-facing, JSX-emitting, `tsconfig.json` with `"jsx": "react-jsx"`) rather than `packages/validation`'s logic-only shape (spec §4.3).
- SHALL NOT add `vitest`, `jsdom`, `@testing-library/react`, or any component-rendering test framework to `packages/web` or anywhere else in the repository this slice (spec §4.3, §7). `packages/web/package.json` has only `build` (`tsc --noEmit`) and `lint` (`eslint src`) scripts, no `test` script.
- SHALL export exactly `LoginForm`, `LoginFormProps`, `LoginFormLabels`, `LoginFormValues` from `packages/web/src/index.ts`, sourced from `packages/web/src/auth/login-form.tsx` (spec §4.3, §4.4).
- SHALL give `LoginForm` the exact prop contract from spec §4.4: `labels: LoginFormLabels`, `errorMessage: string`, `onLogin: (values: LoginFormValues) => Promise<void>` — resolves on success, rejects on any failure. SHALL NOT change this to a `boolean`-returning or richer/discriminated-error contract (spec §4.4, §5 — this was the explicit M3 round-1 correction).
- SHALL keep the client validation rules (`required|email|max:255` for `email`, `required|string|max:255` for `password`) intrinsic to `LoginForm`, sourced via `clensyResolver`/`Rules<LoginFormValues>` from `@clensy/validation`, unchanged from today's `apps/web/app/login/page.tsx` (spec §4.4).
- SHALL derive `clensyResolver`'s `attributes` option from `labels.email`/`labels.password` (lowercased) inside `LoginForm` — SHALL NOT have `LoginForm` call `next-intl` itself (spec §4.4, §4.6).
- SHALL NOT import `next-intl`, any `messages/**` path, `@clensy/client`, `@apollo/client`, `radix-ui`, `shadcn`, or `apps/web/components/ui/*` anywhere under `packages/web/src/**` (spec §4.6, §4.7).
- SHALL NOT import from `apps/web` anywhere under `packages/web/src/**`, and SHALL NOT import from `@clensy/web` anywhere under `packages/ui/src/**` (spec §4.1, §4.7).
- SHALL keep the full-page `<main>` centering wrapper in `apps/web/app/login/page.tsx`; `LoginForm` renders only the `<form>` element and its contents (spec §4.4).
- SHALL keep `apps/web/app/login/page.tsx` owning: the route, `useTranslations('auth')` lookups, the `useLoginMutation` call, and the post-success `router.push('/app')` redirect. SHALL NOT move any of these into `@clensy/web` (spec §4.5).
- SHALL add `@clensy/web` to `apps/web/next.config.ts`'s `transpilePackages` array (spec §4.3).
- SHALL extend Tailwind's `@source` content scan in `apps/web/app/globals.css` to include `packages/web/src` — `LoginForm`'s own layout/container classes (the former `<form>`-level styling) live in `packages/web/src/auth/login-form.tsx`, outside every glob Tailwind currently scans (`packages/ui/src`, `apps/web/components`, `apps/web/**`). Omitting this makes those classes silently unstyled in production builds. This is planning-level infrastructure required to fulfill the Accepted spec's preserved-layout requirement (§4.8), not a new design decision.
- SHALL NOT redesign login visually beyond what `Field`/`Input`/`Button` require in place of the old `FormField`/hardcoded classes (spec §4.9).
- SHALL NOT touch `apps/api/**`, `packages/validation/**`, `packages/client/**`, `apps/web/app/globals.css`'s theme-token variables, or any `apps/web` page other than `app/login/page.tsx`.
- SHALL NOT physically remove `packages/ui/src/domain/` or its `README.md` this slice — mark it legacy in documentation only (spec §2, §6). SHALL NOT populate it with any component.
- SHALL NOT add a `no-restricted-imports` (or equivalent) lint rule for any boundary this plan establishes (spec §2, §6 — deferred).

---

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/ui/src/base/input.tsx` | New: shadcn `Input`, generated |
| `packages/ui/src/base/field.tsx` | New: shadcn `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError` (+ whatever else the registry item generates), generated |
| `packages/ui/src/base/label.tsx` (conditional) | New, only if the `field` registry item's own dependency graph requires it (Task 1) — not added speculatively |
| `packages/ui/src/index.ts` | Adds exports for every named export of every file Task 1 actually adds |
| `packages/ui/README.md` | Adds `Input`/`Field` to the primitive list; adds a short note marking `src/domain/` legacy, pointing to `@clensy/web` |
| `packages/ui/package.json` | Unchanged unless Task 1 discovers a genuinely new runtime import (verified, not assumed) |
| `packages/web/package.json` | New: `"@clensy/web"`, deps on `@clensy/ui`/`@clensy/validation` (`workspace:*`), `react-hook-form` dependency, `react` peerDependency |
| `packages/web/tsconfig.json` | New: mirrors `packages/ui/tsconfig.json` |
| `packages/web/eslint.config.mjs` | New: mirrors `packages/ui/eslint.config.mjs` |
| `packages/web/README.md` | New: "Boundary this package enforces" convention |
| `packages/web/src/index.ts` | New: public export surface |
| `packages/web/src/auth/login-form.tsx` | New: `LoginForm` component |
| `apps/web/app/login/page.tsx` | Rewritten: renders `LoginForm`, owns route/i18n/mutation/redirect only |
| `apps/web/next.config.ts` | `transpilePackages` gains `'@clensy/web'` |
| `apps/web/app/globals.css` | New `@source` line for `packages/web/src` |
| `apps/web/README.md` | Short addition: `apps/web` also consumes domain components through `@clensy/web` |
| `README.md` (root) | `packages/` tree gains a `web:` line |
| `apps/web/package.json` | No dependency change expected — `react-hook-form`/`@clensy/validation` stay listed (still used by other `apps/web` forms) even though `app/login/page.tsx` itself no longer imports them directly |

**Must remain untouched:** `apps/api/**`, `packages/validation/**`, `packages/client/**`, `packages/ui/src/base/form-field.tsx`, `apps/web/app/globals.css`'s theme-token variables, `apps/web/middleware.ts`, every `apps/web` page other than `app/login/page.tsx`, `packages/ui/src/domain/` (documentation-only touch, no deletion).

---

### Task 1: `packages/ui` — `Input` and the `Field` family

**Files:**
- Create: `packages/ui/src/base/input.tsx`, `packages/ui/src/base/field.tsx`
- Modify: `packages/ui/src/index.ts`, possibly `packages/ui/package.json` (only if a genuinely new import surfaces)

**Interfaces:** `Input` (styled `<input>`), `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError` (+ any sibling export the same registry item produces).

- [ ] **Step 1: Generate the two primitives**

  Recommended approach (mirrors how the seven existing primitives were originally produced, and the workflow the `@clensy/ui` boundary spec's §4.3 explicitly left as an M4/M6 investigation): run the shadcn CLI targeting `packages/ui` directly if a `components.json` can be anchored there (aliases `ui` → `src/base`, `components` → `src`), e.g.

  ```bash
  cd packages/ui && pnpm exec shadcn add input field
  ```

  If the CLI cannot resolve a Tailwind entry point from inside `packages/ui` (it has no `app/globals.css` of its own), fall back to generating into a scratch location from `apps/web` (which still has the Tailwind/`app/globals.css` context the CLI needs) and relocating the output into `packages/ui/src/base/`, fixing only the import paths the move itself breaks — the same "verbatim relocation" definition the boundary spec's §3 already establishes. Either mechanism is acceptable; only the resulting files' content and behavior are normative (spec §2, informative).

  If neither CLI path succeeds — no registry/network access at all — **stop and report** that the current shadcn registry recipe for `input`/`field` could not be obtained, rather than hand-authoring the files from memory. The Accepted spec requires these files "generated fresh (not hand-authored)" (spec §4.2) and does not authorize a manual-authoring fallback; inventing plausible-looking source for a source-generation task risks silently drifting from shadcn's actual current output in a way nothing downstream would catch. Report the blocker and pause this task rather than proceeding past it.

- [ ] **Step 2: Verify the generated files against the package boundary**

  ```bash
  grep -n "next-intl\|@clensy/client\|@apollo/client\|apps/web" packages/ui/src/base/input.tsx packages/ui/src/base/field.tsx
  grep -n "^import" packages/ui/src/base/input.tsx packages/ui/src/base/field.tsx
  ```

  Expect the first command to print nothing. Read the second command's output and classify each import:
  - **External package imports** (`class-variance-authority`, `radix-ui`, `lucide-react`, or any other npm package) — verify each is already listed in `packages/ui/package.json`'s `dependencies`. If one is missing, add it (matching the version `apps/web/package.json` or `packages/ui/package.json` already pins elsewhere for the same package, per the boundary spec §4.3's precedent).
  - **Internal utility imports** (`cn`) — `cn` is not a shadcn/npm package requiring a new dependency here; it's the existing `packages/ui` utility import already used by every other `base/` file (already a `packages/ui/package.json` dependency). Verify it resolves the same way `button.tsx`'s `import { cn } from "cn"` does — no separate action needed beyond confirming the import path matches the existing convention.

  If `field.tsx` pulls in a shadcn `Label` primitive as a transitive registry dependency (a plausible outcome — shadcn's `field` registry item commonly depends on `label`), generating `packages/ui/src/base/label.tsx` is the Global Constraints' explicitly allowed "additional file the `field` registry item's own dependency graph requires" — apply this same Step 1/Step 2 treatment to it, not a separately-justified addition.

- [ ] **Step 3: Update `packages/ui/src/index.ts`**

  Append export lines for `input.tsx`'s and `field.tsx`'s (and `label.tsx`'s, if generated) full named-export sets, following the existing file's pattern (see e.g. the `FormField` export block for the type-plus-value export style):

  ```ts
  export { Input } from './base/input';
  export { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from './base/field';
  // + any additional named exports base/field.tsx actually produces
  ```

- [ ] **Step 4: Verify**

  ```bash
  pnpm install
  pnpm --filter @clensy/ui lint
  pnpm --filter @clensy/ui build
  pnpm --filter @clensy/ui test
  ```

  Expect all to pass — no existing file's behavior changes in this task.

- [ ] **Step 5 (no commit yet — leave working tree as-is for review).**

---

### Task 2: `packages/web` — package scaffold

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/eslint.config.mjs`, `packages/web/src/index.ts` (placeholder)
- Modify: `apps/web/next.config.ts`, `apps/web/app/globals.css`

(`packages/web/README.md` is authored in Task 5/Step 1, not here — do not create it in this task.)

**Interfaces:** none yet — `src/index.ts` is an empty placeholder pending Task 3.

- [ ] **Step 1: Re-verify current dependency versions before writing them down**

  ```bash
  grep -n '"react"\|"react-hook-form"' apps/web/package.json packages/ui/package.json packages/validation/package.json
  ```

  Use exactly what this prints, not the versions cited in this plan, in case any has drifted since 2026-09-19.

- [ ] **Step 2: Write `packages/web/package.json`**

  ```json
  {
    "name": "@clensy/web",
    "version": "0.0.1",
    "private": true,
    "main": "src/index.ts",
    "scripts": {
      "build": "tsc --noEmit",
      "lint": "eslint src"
    },
    "peerDependencies": {
      "react": "^19.2.8"
    },
    "dependencies": {
      "@clensy/ui": "workspace:*",
      "@clensy/validation": "workspace:*",
      "react-hook-form": "^7.88.0"
    },
    "devDependencies": {
      "@eslint/js": "^9.18.0",
      "@types/react": "^19.2.18",
      "eslint": "^9.18.0",
      "globals": "^17.0.0",
      "react": "^19.2.8",
      "typescript": "^5.7.3",
      "typescript-eslint": "^8.20.0"
    }
  }
  ```

  No `test` script and no `vitest` devDependency (Global Constraints). No `@types/react-dom`/`react-dom` — `LoginForm` is never rendered inside this package's own tooling.

- [ ] **Step 3: Write `packages/web/tsconfig.json`** (identical shape to `packages/ui/tsconfig.json`)

  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "lib": ["dom", "dom.iterable", "esnext"],
      "module": "esnext",
      "moduleResolution": "bundler",
      "jsx": "react-jsx",
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

- [ ] **Step 4: Write `packages/web/eslint.config.mjs`** (identical shape to `packages/ui/eslint.config.mjs`, `globals.browser`)

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
        globals: { ...globals.browser },
      },
    },
  );
  ```

- [ ] **Step 5: Write a placeholder `packages/web/src/index.ts`**

  ```ts
  export {};
  ```

  Replaced by Task 3's real export. This step exists only so Step 7's install/build/lint gate has something valid to check against before `LoginForm` exists.

- [ ] **Step 6: Add `@clensy/web` to `apps/web/next.config.ts`'s `transpilePackages`**

  ```ts
  transpilePackages: ['@clensy/client', '@clensy/ui', '@clensy/validation', '@clensy/web'],
  ```

  Keep the existing explanatory comment above this array; it already documents why source-only packages need this.

- [ ] **Step 7: Add a `@source` line to `apps/web/app/globals.css`**

  Inspect the file's existing `@source` declarations first — do not insert a literal without checking they still look like this:

  ```bash
  grep -n "@source" apps/web/app/globals.css
  ```

  Add a new `@source` line for `packages/web/src` using the exact same relative-path/glob convention the existing `packages/ui/src` line already uses (at planning time: `@source "../../../packages/ui/src/**/*.{ts,tsx}";`, so the new line would read `@source "../../../packages/web/src/**/*.{ts,tsx}";` — confirm the relative path segment count and glob pattern match what Step 7's `grep` actually prints, not this plan's cached copy, in case the file has changed since 2026-09-19).

  Without this, Tailwind's content scan never sees `LoginForm`'s own container/layout classes and they render unstyled in production builds (Global Constraints).

- [ ] **Step 8: Install and verify**

  ```bash
  pnpm install
  pnpm --filter @clensy/web lint
  pnpm --filter @clensy/web build
  pnpm --filter web build
  ```

  Expect all to pass — `apps/web` doesn't import `@clensy/web` yet (Task 4), so this only proves the workspace wiring and Tailwind/`transpilePackages` config are valid.

- [ ] **Step 9 (no commit yet — leave working tree as-is for review).**

---

### Task 3: `LoginForm`

**Files:**
- Modify: `packages/web/src/index.ts`
- Create: `packages/web/src/auth/login-form.tsx`

**Interfaces:** `LoginForm`, `LoginFormProps`, `LoginFormLabels`, `LoginFormValues` (spec §4.4 — normative; exact JSX/markup below is the planning-time reference implementation).

- [ ] **Step 1: Write `packages/web/src/auth/login-form.tsx`**

  The snippet below is the planning-time reference implementation, derived from reading `apps/web/app/login/page.tsx`'s current source during M2/M4 planning — before writing this file, re-read that file directly (it is still present and unmodified at this point in the sequence; Task 4 is what changes it) rather than relying solely on this snippet, in case anything has drifted since planning. Carry forward the code comment explaining the client-validation ceiling (`max:255` as a client-only addition, not derived from `LoginInput`) into this file, adapted to `loginRules` here — see Task 4/Step 1 and Step 2 for the full comment-placement split.

  ```tsx
  'use client';

  import { Button, Field, FieldError, FieldGroup, FieldLabel, Input } from '@clensy/ui';
  import { clensyResolver, type Rules } from '@clensy/validation';
  import { useState } from 'react';
  import { useForm } from 'react-hook-form';

  export interface LoginFormLabels {
    title: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
  }

  export interface LoginFormValues {
    email: string;
    password: string;
  }

  export interface LoginFormProps {
    labels: LoginFormLabels;
    errorMessage: string;
    onLogin: (values: LoginFormValues) => Promise<void>;
  }

  const loginRules = {
    email: 'required|email|max:255',
    password: 'required|string|max:255',
  } satisfies Rules<LoginFormValues>;

  export function LoginForm({ labels, errorMessage, onLogin }: LoginFormProps) {
    const [error, setError] = useState<string | undefined>(undefined);
    const [submitting, setSubmitting] = useState(false);
    const form = useForm<LoginFormValues>({
      resolver: clensyResolver<LoginFormValues>(loginRules, {
        attributes: { email: labels.email.toLowerCase(), password: labels.password.toLowerCase() },
      }),
    });

    async function onValid(values: LoginFormValues) {
      setError(undefined);
      setSubmitting(true);
      try {
        await onLogin(values);
      } catch {
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">{labels.title}</h1>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">{labels.email}</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              aria-invalid={form.formState.errors.email ? true : undefined}
              {...form.register('email')}
            />
            {form.formState.errors.email ? <FieldError>{form.formState.errors.email.message}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{labels.password}</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={form.formState.errors.password ? true : undefined}
              {...form.register('password')}
            />
            {form.formState.errors.password ? <FieldError>{form.formState.errors.password.message}</FieldError> : null}
          </Field>
        </FieldGroup>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? labels.submitting : labels.submit}
        </Button>
      </form>
    );
  }
  ```

  **Do not memoize the resolver.** `clensyResolver(loginRules, { attributes: {...} })` is recreated on every render, exactly as `apps/web/app/login/page.tsx`'s current `resolver: clensyResolver<LoginFormValues>(loginRules, { attributes: {...} })` inline call already is today. Do not introduce `useMemo` around it "for theoretical optimization" — the existing implementation doesn't have it, nothing in the spec asks for it, and adding it would be scope creep into a performance concern this ticket never raised. Only add memoization here if a *behavioral* correctness need is found during implementation (none is anticipated).

  **Caveat, carried over from Task 1's own uncertainty:** `FieldError`'s exact prop shape (children vs. an `errors`-array prop; whether `Field`/`FieldError` auto-wire `aria-describedby` between themselves via context) depends on Task 1's actual generated `field.tsx`. The behavioral requirement — an error message associated with its field, `aria-invalid` on the input, submit disabled while `submitting` — is normative (spec §4.8); the exact prop names to reach it are not, and this snippet is adjusted to match whatever Task 1 actually produced, not silently reinterpreted as a design change.

- [ ] **Step 2: Export from `packages/web/src/index.ts`**

  ```ts
  export { LoginForm } from './auth/login-form';
  export type { LoginFormLabels, LoginFormProps, LoginFormValues } from './auth/login-form';
  ```

- [ ] **Step 3: Verify**

  ```bash
  pnpm --filter @clensy/web lint
  pnpm --filter @clensy/web build
  ```

  `LoginForm` is not yet consumed anywhere (Task 4), so this only confirms the component type-checks and lints on its own.

- [ ] **Step 4 (no commit yet — leave working tree as-is for review).**

---

### Task 4: `apps/web/app/login/page.tsx`

**Files:**
- Modify: `apps/web/app/login/page.tsx`

**Interfaces:** none new — consumes `LoginForm` from `@clensy/web` (Task 3).

- [ ] **Step 1: Capture the current baseline before modifying anything**

  Before touching `apps/web/app/login/page.tsx`, read its current source directly (it is still unmodified at this point — Tasks 1–3 touch only `packages/ui`/`packages/web`) and record the exact existing:
  - Validation rules (`required|email|max:255`, `required|string|max:255`) and how `clensyResolver`'s `attributes` option is populated.
  - Form container classes/layout (the `<main>`/`<form>` class strings).
  - `autoComplete`/`type` attributes on each field.
  - Loading/submitting state (what disables, what label swaps, when).
  - Error state (what triggers it, what it renders, `role="alert"`).
  - Redirect behavior (exact route, exact trigger condition).
  - Every code comment and the invariant it documents.

  This plan's Task 3 snippet and this task's own snippet below are planning-time references, not the authoritative source — the current file is. If anything here has drifted since this plan was written (2026-09-19), the current file wins; update the implementation to match it, not the other way around, and note the discrepancy in the PR description.

- [ ] **Step 2: Rewrite `apps/web/app/login/page.tsx`**

  ```tsx
  'use client';

  import { LoginForm, type LoginFormValues } from '@clensy/web';
  import { useLoginMutation } from '@clensy/client';
  import { useTranslations } from 'next-intl';
  import { useRouter } from 'next/navigation';

  export default function LoginPage() {
    const t = useTranslations('auth');
    const router = useRouter();
    const [login] = useLoginMutation();

    async function handleLogin(values: LoginFormValues) {
      const result = await login({ variables: { loginInput: values } });
      if (!result.data?.login.success) {
        throw new Error('Login failed');
      }
      router.push('/app');
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <LoginForm
          labels={{
            title: t('title'),
            email: t('email'),
            password: t('password'),
            submit: t('submit'),
            submitting: t('submitting'),
          }}
          errorMessage={t('errors.invalidCredentials')}
          onLogin={handleLogin}
        />
      </main>
    );
  }
  ```

  Preserve the substantive rationale from the existing file's code comments (recorded in Step 1), placing each comment with the logic it now explains rather than mechanically copying every comment into whichever file its associated code happened to move to. Concretely: the comment explaining the client-validation ceiling (why `max:255` exists, why it's a client-only addition not derived from `LoginInput`) documents `LoginForm`'s validation rules and belongs in `packages/web/src/auth/login-form.tsx` (Task 3) alongside `loginRules`. The comment explaining the HttpOnly-cookie / non-discriminating-error invariant is partly about `apps/web`'s own mutation-response handling (stays here, adapted to explain `handleLogin`'s explicit `throw`) and partly about the generic-error *display* behavior (belongs with `LoginForm`'s `catch`, Task 3) — split it along that line rather than copying it whole into one place or the other.

- [ ] **Step 3: Verify**

  ```bash
  pnpm --filter web lint
  pnpm --filter web build
  ```

- [ ] **Step 4 (no commit yet — leave working tree as-is for review).**

---

### Task 5: Documentation

**Files:**
- Create: `packages/web/README.md`
- Modify: `packages/ui/README.md`, `apps/web/README.md`, `README.md` (root)

**Interfaces:** none (documentation only)

- [ ] **Step 1: Write `packages/web/README.md`**, covering:
  - What `@clensy/web` is: the sole home for reusable Clensy domain components, between `@clensy/ui` (generic UI) and `apps/web` (application composition) — spec §1, §4.1.
  - "Boundary this package enforces" (matching `packages/ui/README.md`'s/`packages/validation/README.md`'s established convention):

    ```text
    Boundary this package enforces:

    - Domain components (components representing a Clensy business concept)
      live here, grouped by domain (e.g. auth/).
    - This package must not import shadcn, radix-ui, or apps/web/components/ui
      directly — UI primitives come only through @clensy/ui.
    - This package must not import @clensy/client, @apollo/client, or any
      other GraphQL/network client — host applications inject data actions
      (e.g. LoginForm's onLogin) instead.
    - This package must not import next-intl or hold a message catalog — it
      takes already-translated strings as props; apps/web translates.
    - This package must not import from apps/web.
    ```
  - `LoginForm`'s contract summary (props, the resolve/reject `onLogin` convention) with a pointer to the design spec for full rationale rather than duplicating it.

- [ ] **Step 2: Update `packages/ui/README.md`**
  - Add `Input`/`Field`(/`Label`, if Task 1 generated it) to the `src/base/` primitive list in the Layout section.
  - Add a short note to the `src/domain/` bullet (or `src/domain/README.md`) marking it legacy: domain-specific composition now belongs in `@clensy/web` (link to this ticket's spec §4.1); `src/domain/` stays scaffolded but receives no new content.

- [ ] **Step 3: Add to `apps/web/README.md`**, near its existing `## UI` section (after the shadcn-boundary bullets, before or after the `cn`/`lucide-react` paragraph) — a short new note: `apps/web` also consumes reusable Clensy domain components (e.g. `LoginForm`) through [`@clensy/web`](../../packages/web/README.md)'s public API, following the same translated-strings-as-props convention as `@clensy/ui`.

- [ ] **Step 4: Update the root `README.md` monorepo-layout tree** — add a `web:` line under `packages/` (after `ui:`) describing it as the reusable Clensy domain component layer, starting with `auth/LoginForm`; do not restate the `@clensy/ui`/`@clensy/web`/`apps/web` boundary rule itself (link to the spec instead).

- [ ] **Step 5 (no commit yet — leave working tree as-is for review).**

---

### Task 6: Full verification

**Files:** none new unless a compatibility fix surfaces (then the smallest change to the affected file, called out explicitly rather than folded silently into this task).

- [ ] **Step 1: Grep-verifiable acceptance gates (spec §7)**

  ```bash
  grep -n "FormField\|from '@clensy/ui'\|react-hook-form\|@clensy/validation" apps/web/app/login/page.tsx
  grep -rln "next-intl\|messages/\|@clensy/client\|@apollo/client" packages/web/src
  grep -rln "radix-ui\|shadcn\|apps/web/components/ui" packages/web/src
  grep -rln "@clensy/web" packages/ui/src
  grep -n "Input\|Field" packages/ui/src/index.ts
  ```

  Expect: line 1 prints only the `'@clensy/web'`/`LoginForm` import (no `FormField`/`react-hook-form`/`@clensy/validation` import in the page file); lines 2–4 print nothing; line 5 prints the new export lines from Task 1.

- [ ] **Step 2: Full monorepo checks**

  ```bash
  pnpm --filter @clensy/ui lint
  pnpm --filter @clensy/ui build
  pnpm --filter @clensy/ui test
  pnpm --filter @clensy/web lint
  pnpm --filter @clensy/web build
  pnpm --filter web lint
  pnpm --filter web build
  ```

- [ ] **Step 3: Clean-tree scope check**

  Confirm untouched paths with explicit `git diff --name-only` checks (covers both the working tree and the index, unlike `git status`'s formatting-sensitive output):

  ```bash
  git diff --name-only HEAD -- apps/api packages/validation packages/client
  git diff --name-only HEAD -- packages/ui/src/base/form-field.tsx
  git diff --name-only HEAD -- apps/web/app
  git diff --name-only HEAD -- apps/web/middleware.ts apps/web/app/globals.css
  ```

  Expect the first two commands to print nothing. Expect the third to print exactly:

  ```text
  apps/web/app/login/page.tsx
  ```

  (no other `apps/web/app/**` file) — any other line is an out-of-scope page edit to investigate before proceeding. Expect the fourth to print only `apps/web/app/globals.css` (the `@source` addition from Task 2/Step 7) and not `apps/web/middleware.ts`.

  Then confirm every new/changed file is one this plan accounts for:

  ```bash
  git status --short
  ```

  Every line should match a path in the File structure table above (`packages/ui/src/base/{input,field,label}.tsx`, `packages/ui/src/index.ts`, `packages/ui/README.md`, `packages/ui/package.json` — only if Task 1 needed it, `packages/web/**`, `apps/web/app/login/page.tsx`, `apps/web/next.config.ts`, `apps/web/app/globals.css`, `apps/web/README.md`, root `README.md`). Anything else is an out-of-scope change to investigate before proceeding.

- [ ] **Step 4: Manual golden path (`/login`, spec §7)** — start the dev server and confirm, without a Playwright/RTL suite (none exists in this repo):
  1. Empty submit — required-field client errors render under each field, matching today's copy/placement.
  2. Invalid email format — email-format client error renders.
  3. Valid format, wrong credentials — submit button shows the `submitting` label and is disabled while in flight; on response, the single generic `errors.invalidCredentials` message renders (not a field-level error).
  4. Valid, correct credentials — redirects to `/app`.
  5. Visual comparison against the pre-refactor page — bounded to what `Field`/`Input`/`Button` require, no unrelated layout/copy drift (spec §4.9).
  6. Keyboard/a11y pass: label-to-input association, `aria-invalid` on errored fields, an error announced via `role="alert"`, tab order unchanged.

- [ ] **Step 5: N/A unless Step 1–4 surfaced a fix — if so, note what broke and why, as its own reviewable change.**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Domain-placement rule; `@clensy/ui` MUST NOT depend on `@clensy/web`; `packages/ui/src/domain/` legacy note (§4.1) | 5 (documentation); enforced by omission and Task 6/Step 1's grep gate |
| `Input`/`Field` family added to `packages/ui/src/base/`, generated not hand-invented, full export set (§4.2) | 1 |
| `packages/web` scaffold, no `vitest` this slice, `transpilePackages`, Tailwind `@source` (§4.3) | 2 |
| `LoginForm` contract: `labels`/`errorMessage`/`onLogin` (`Promise<void>`), intrinsic validation rules, `<form>`-only ownership (§4.4) | 3 |
| `apps/web/app/login/page.tsx` after refactor: route/i18n/mutation/redirect ownership, `handleLogin`'s explicit throw (§4.5) | 4 |
| i18n boundary extended to `@clensy/web` (§4.6) | 3, 5 |
| Package boundaries, MUST/MUST NOT (§4.7) | 1, 3, 6 (grep gates) |
| Preserved behavior enumeration (§4.8) | 3, 4, 6/Step 4 |
| Visual difference bound (§4.9) | 3, 6/Step 4 |
| Followed-by items explicitly deferred, not implemented (§6) | verified by omission — Task 6/Step 3's scope check would catch accidental creep |
| Testing/acceptance: build/lint gates, grep gates, manual golden path, no component-rendering framework (§7) | 1, 2, 6 |

## Type consistency

- `LoginFormLabels`, `LoginFormValues`, `LoginFormProps` — Task 3, defined once in `packages/web/src/auth/login-form.tsx`, re-exported from `packages/web/src/index.ts` (Task 3/Step 2), consumed by `apps/web/app/login/page.tsx` (Task 4) as `LoginFormValues` only (the page never constructs `LoginFormProps`/`LoginFormLabels` as a named type — it passes an inline object literal matching `LoginFormLabels`'s shape structurally).
- `Input`, `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` (+ any sibling export) — Task 1, exported from `@clensy/ui`'s `index.ts`; consumed only by `packages/web/src/auth/login-form.tsx` (Task 3) in this slice — no other `apps/web` file imports them (spec §2, out of scope).
- `Rules<LoginFormValues>` / `clensyResolver<LoginFormValues>` — from `@clensy/validation`, unchanged; instantiated once, inside `packages/web/src/auth/login-form.tsx` (Task 3) — previously instantiated inside `apps/web/app/login/page.tsx`, now moved, not duplicated.
- `FormFieldProps` (`@clensy/ui`'s existing `FormField`) — untouched, still exported, still used by other `apps/web` forms (unaffected by this plan).
