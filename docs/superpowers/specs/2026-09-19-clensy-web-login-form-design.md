# `@clensy/web` and the Login Form — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-19 |
| Tracking issue | [#59](https://github.com/rexescario-dev/clensy-platform/issues/59) — "Refactor login page to reusable `@clensy/web` LoginForm" |
| Depends on (Accepted) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — establishes `@clensy/ui` as the sole owner of shadcn primitives and the `apps/web` MUST NOT-import-shadcn-directly rule this spec builds the next layer on top of (relies upon). This spec also **constrains** that spec's own Followed-by item "Populate `packages/ui/src/domain/` with the first real domain-specific composition, once a second consumer exists" (§6 there): §4.1 below establishes `@clensy/web`, not `packages/ui/src/domain/`, as that future home, superseding that one Followed-by item without otherwise reopening the Accepted design. [Web i18n Architecture](2026-09-13-web-i18n-architecture-design.md) and `apps/web/README.md`'s i18n boundary ("`@clensy/ui` MUST NOT import `next-intl` ... It takes already-translated strings as props; `apps/web` translates, `@clensy/ui` renders.") — this spec extends that same prop-based-translation rule to `@clensy/web` (extends). [`@clensy/validation` Design](2026-09-15-clensy-validation-design.md) — `LoginForm` consumes `clensyResolver`/`Rules<T>` unchanged (relies upon). |
| Related (not a dependency) | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.5 — established the `packages/*` empty-stub-until-second-consumer convention this spec's `packages/web` follows for its own scaffold decisions (§5). |
| Followed by | A future slice may migrate additional `apps/web` forms onto the `Field`/`Input` family and extend `@clensy/web` with further domain groupings once a second consumer need exists (§6). |
| Governing references | This document. It does not redesign `@clensy/ui`'s existing `base/` boundary or `packages/validation`'s resolver contract — it adds two new `base/` primitives to the former and introduces one new package that consumes both, unchanged. It does narrow one still-open question the `@clensy/ui` boundary spec left for a future consumer to resolve (§4.1). |
| M3 decision | **Accepted** — 2026-09-19. Two review rounds: round 1 required resolving the `packages/ui/src/domain/` vs. `@clensy/web` placement ambiguity with one explicit rule (not two valid destinations), grounding `LoginForm`'s `onLogin` contract in the actual current implementation rather than an arbitrary `boolean`, renaming `@clensy/web`'s "domain/application components" framing to "domain components," stating `@clensy/ui` MUST NOT depend on `@clensy/web` explicitly, and a minor wording fix distinguishing shadcn registry items from generated files (addressed in §4.1, §4.4, §4.5, §5). Round 2 confirmed all required changes addressed with no remaining design blocker. Ready for M4 Implementation Planning. |

## 1. Thesis

Today `apps/web/app/login/page.tsx` hand-rolls the entire login experience as page-local UI: form state, client validation wiring, the mutation call, and markup built directly from `@clensy/ui`'s `FormField`/`Button`. This spec introduces a third layer — `@clensy/web`, home to reusable Clensy **domain** components — sitting between `@clensy/ui` (generic, business-agnostic) and `apps/web` (application composition):

```text
shadcn/ui
    ↓
@clensy/ui     Generic UI primitives (business-agnostic)
    ↓
@clensy/web    Reusable Clensy domain components
    ↓
apps/web       Application composition (routes, redirects, i18n wiring, auth wiring)
```

Login is the smallest existing screen with which to establish and evaluate this layer: `@clensy/ui` gains the `Input`/`Field` family it does not yet have (`Button` already exists there); a new `@clensy/web` package gains `auth/LoginForm`, built from those primitives and encapsulating the existing login form's validation, submission, and state-management behavior; and `apps/web/app/login/page.tsx` shrinks to page-level composition — translated copy, the injected login action, and the post-login redirect — importing `LoginForm` rather than implementing the form inline.

## 2. Scope

**In scope (normative):**

- One explicit domain-placement rule, replacing any softer per-component judgment call: business/domain concepts belong in `@clensy/web`; business-agnostic UI belongs in `@clensy/ui`. `packages/ui/src/domain/` (scaffolded empty by the `@clensy/ui` boundary spec) becomes legacy under this rule — no new content is ever added there (§4.1).
- Adding `Input`, `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` to `packages/ui/src/base/`, generated fresh from shadcn's current recipe (the same "generated, not hand-authored" origin as every existing `base/` primitive), exported from `packages/ui/src/index.ts` (§4.2).
- Creating `packages/web` (`@clensy/web`) as a new pnpm workspace member: package scaffold, `src/index.ts` public export surface, `src/auth/` domain grouping (§4.3).
- `auth/LoginForm`: a `@clensy/web` component that owns the login form's field state, client-side validation (`clensyResolver`/`Rules<LoginFormValues>`, unchanged from today), submitting/loading state, and generic (non-discriminating) error display — built from `@clensy/ui`'s `Field`/`FieldLabel`/`Input`/`FieldError`/`Button`, never from shadcn or `apps/web/components/ui` directly (§4.4).
- An injected login action (`onLogin`) through which `LoginForm` delegates the actual authentication call to its host application — `LoginForm` itself holds no GraphQL/Apollo/`@clensy/client` dependency (§4.4, §4.7).
- Already-translated copy passed into `LoginForm` as props — extending `@clensy/ui`'s existing "components take translated strings as props; only `apps/web` calls `useTranslations`" rule to `@clensy/web` (§4.6).
- Refactoring `apps/web/app/login/page.tsx` to import and render `LoginForm`, retaining only: the `<main>` page-level layout wrapper, `useTranslations('auth')` calls, the `useLoginMutation` call wrapped into the `onLogin` action, and the post-success `router.push('/app')` redirect (§4.5).
- Preserving current login behavior exactly: required/email/max:255 and required/string/max:255 client validation, the single non-discriminating generic error message on any submission failure (network or business), loading/disabled submit-button state, redirect-on-success, `autoComplete` hints, and existing accessibility attributes (`aria-invalid`, `aria-describedby`, `role="alert"`) (§4.8).
- Adding `@clensy/web` to `apps/web/next.config.ts`'s `transpilePackages` array, alongside `@clensy/client`, `@clensy/ui`, `@clensy/validation` (§4.3).

**Informative:** the exact shadcn-generated file(s) backing `Input`/`Field` and their full named-export set, confirmed at M6 against the generated output rather than assumed here (§4.2, following the `@clensy/ui` boundary spec's own precedent of reading dependencies off generated files rather than assuming them).

**Out of scope:**

- Migrating any other `apps/web` form (e.g. the Add Customer form) onto `Field`/`Input`, or retiring `@clensy/ui`'s existing `FormField` composition. `FormField` remains as-is and in use elsewhere; this ticket does not touch it (§6).
- Any new `@clensy/ui` composition beyond `Input`/`Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError` and whatever else the same generated registry item exports as part of that set.
- Physically removing the now-legacy, scaffolded-but-empty `packages/ui/src/domain/` directory and its README, or updating `packages/ui/README.md`'s Layout section to drop the reference. The placement rule (§4.1) takes effect immediately regardless; deleting the stale scaffold is a small independent cleanup, deferred (§6).
- Redesigning login UX, copy, layout, or visual language beyond what `Field`/`Input` require in place of the old hand-rolled `FormField` markup. Not a login redesign (§4.8).
- Coupling `@clensy/ui`'s new `Input`/`Field` primitives to Next.js, `next-intl`, routing, or auth. They remain generic, business-agnostic primitives exactly like every other `base/` export (§4.1).
- Any change to `apps/api`'s authentication logic, session handling, or the `login` GraphQL mutation contract.
- A `no-restricted-imports` lint rule enforcing the `@clensy/web`-only (or `@clensy/ui`-only) boundary at `apps/web` or `@clensy/web` itself. Not required by this migration, consistent with the same deferral in the `@clensy/ui` boundary spec (§6).
- Introducing `jsdom`/`@testing-library/react` or any component-rendering test framework. No package in this repository has this today (§7).

## 3. Terminology

- **Field family:** `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` — shadcn's current form-layout primitive set, generated together (like `Avatar`'s `AvatarImage`/`AvatarFallback`/`AvatarGroup`/... today, one registry item, full export set generated together even where a given consumer uses only part of it). Plain semantic HTML (`div`/`label`/`p`) styled with Tailwind via `cn`; not `radix-ui`-based.
- **`Input`:** shadcn's current `Input` primitive — a styled `<input>`, the `Field` family's natural pairing, added alongside it for the same reason.
- **Domain component:** a component that represents a Clensy business/domain concept (e.g. logging in, a customer record). Governed by one rule (§4.1): domain components live in `@clensy/web`, never in `@clensy/ui`.
- **`@clensy/web`:** the new package (`packages/web`), the sole home for reusable Clensy domain components going forward — the layer above `@clensy/ui` (generic UI) and below `apps/web` (application composition). Supersedes `packages/ui/src/domain/` as the intended destination for domain-specific composition (§4.1); that directory is now legacy.
- **Injected login action:** the `onLogin` prop through which `LoginForm` delegates the actual authentication network call to its host application, so a different consumer application could reuse `LoginForm` with its own auth wiring without `LoginForm` importing any GraphQL/Apollo client itself.
- **Non-discriminating generic error:** the existing, already-documented invariant in `apps/web/app/login/page.tsx` (its own code comments) that a failed login — wrong password, unknown email, disabled account, or a network/mutation exception — always surfaces the single fixed translated message `auth.errors.invalidCredentials`, never a field-specific or cause-specific one. This spec preserves that invariant; it does not relax or extend it.
- **Layering (dependency direction):** shadcn internals → `@clensy/ui` (`base/`) → `@clensy/web` (`src/auth/`) → `apps/web` application code. Never the reverse; `@clensy/web` never imports from `apps/web`, and `@clensy/ui` never imports from `@clensy/web` (§4.1).

## 4. Architecture & behavioral contracts

### 4.1 Domain placement: `@clensy/web`, not `packages/ui/src/domain/`

One rule, replacing any softer "generic-enough-to-live-inside-`@clensy/ui`" judgment call:

> **If a component represents a Clensy business/domain concept, it belongs in `@clensy/web`. If it is business-agnostic UI, it belongs in `@clensy/ui`.**

`packages/ui/src/domain/` was scaffolded empty by the `@clensy/ui` boundary spec (its §5) as a placeholder for "future business-domain-specific composition," naming a hypothetical `CustomerDataTable` as the kind of thing that might go there. This spec supersedes that plan: `@clensy/web` is the unambiguous, sole home for domain components going forward — a future `CustomerDataTable`, for example, belongs at `packages/web/src/customers/customer-data-table.tsx`, not `packages/ui/src/domain/`. `packages/ui/src/domain/` is legacy as of this spec: no new component is ever added there, though physically deleting the scaffold/README is a small independent cleanup this ticket does not require (§2, §6).

A single bright-line test ("is this a Clensy business concept?") is auditable by inspection; "generic enough to live inside `@clensy/ui`" is not — it would have become a repeated judgment call with no fixed answer, exactly the ambiguity this rule eliminates.

Corollary, stated explicitly rather than left only implicit in the layering diagram: **`@clensy/ui` MUST NOT depend on `@clensy/web`.** `@clensy/ui` remains buildable and usable with zero knowledge that `@clensy/web` exists.

### 4.2 `@clensy/ui`: `Input` and the `Field` family

Two new shadcn registry items land in `packages/ui/src/base/` — `input.tsx` and `field.tsx` — generated fresh (not hand-authored) following shadcn's current recipe for each registry item, the same origin every existing `base/` primitive has:

- `input.tsx` — shadcn's `Input`.
- `field.tsx` — shadcn's `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError`, plus any other named export the same registry item generates in that file (e.g. `FieldSet`/`FieldLegend`/`FieldSeparator`/`FieldContent`/`FieldTitle`, if shadcn's current field registry item generates them) — exported as a complete unit, exactly as `avatar.tsx` exports `AvatarGroup`/`AvatarGroupCount`/`AvatarBadge` today even though only a subset is used by any one consumer. Confirmed against the actual generated output at M6 (§2, informative).

Both are exported from `packages/ui/src/index.ts` alongside the existing `base/` exports. Neither depends on `radix-ui`; both are plain-HTML, Tailwind-via-`cn` primitives — no new `packages/ui` runtime dependency is anticipated, but this is confirmed at M6 by reading the generated files' own imports, not assumed here (following the `@clensy/ui` boundary spec §4.3's own precedent for exactly this kind of claim).

`@clensy/ui`'s existing `FormField` composition (`base/form-field.tsx`) is untouched. It is not superseded, deprecated, or repointed onto `Field`/`Input` by this spec (§2).

### 4.3 `@clensy/web`: package scaffold

New workspace member, package name `@clensy/web`, mirroring `packages/ui`'s scaffold (browser-facing, JSX-emitting package) rather than `packages/validation`'s (logic-only):

```text
packages/web/
  package.json      ← name "@clensy/web"; "main": "src/index.ts" (source-only, like every
                       existing packages/* member — no build step); dependencies on
                       "@clensy/ui" and "@clensy/validation" (workspace:*); peerDependency
                       "react" (matching packages/ui's peer-dependency convention);
                       react-hook-form as a dependency (apps/web already depends on it
                       directly today; @clensy/web takes over that usage for the login
                       form specifically — apps/web keeps its own react-hook-form
                       dependency for its other forms, unaffected by this spec)
  tsconfig.json     ← mirrors packages/ui/tsconfig.json (jsx: "react-jsx")
  eslint.config.mjs ← mirrors packages/ui/eslint.config.mjs (globals.browser)
  README.md         ← new: "Boundary this package enforces" convention (§4.6, §4.7)
  src/
    index.ts          ← public export surface: `export { LoginForm } from './auth/login-form'`
                          and its prop types
    auth/
      login-form.tsx    ← 'use client' (owns useForm/useState, like packages/ui's existing
                           'use client' compositions — modal.tsx, toast.tsx, the dialogs)
```

No nested `src/domain/` inside `@clensy/web` — the package itself *is* the domain layer (§4.1); a future non-auth domain component is a sibling top-level grouping (`src/customers/`, etc. — §6), not a further subdirectory.

`apps/web/next.config.ts`'s `transpilePackages` gains `'@clensy/web'`, for the same reason `@clensy/client`/`@clensy/ui`/`@clensy/validation` are already listed there (source-only package, no pre-built dist).

Whether `@clensy/web` gains its own `vitest` wiring in this slice is an M4/M6 implementation decision, not decided here — `LoginForm` has no pure, renderer-independent unit comparable to `Button`'s `buttonVariants` (the reason `packages/ui` added `vitest` in the boundary spec), and this repository has no component-rendering test infrastructure to render it with (§2, §7).

### 4.4 `LoginForm` contract

```tsx
// packages/web/src/auth/login-form.tsx
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

export function LoginForm(props: LoginFormProps): JSX.Element;
```

- `labels` and `errorMessage` are already-translated strings, supplied by the host application (§4.6) — `LoginForm` does no translation lookup itself.
- `onLogin` is the injected login action (§3): it **resolves on successful authentication** and **rejects (throws) on any failure** — network/GraphQL error or an unsuccessful login alike. `LoginForm` does not distinguish *why* the promise rejected; every rejection renders the same `errorMessage`, matching the non-discriminating generic-error invariant exactly. On resolution, `LoginForm` takes no further action of its own — the host has already done whatever a success requires (e.g. the redirect) before resolving. `LoginForm` does not redirect and does not know the route to redirect to.
- This shape is a direct translation of the `try { ...; return } catch { setError(...) }` control flow already present in `apps/web/app/login/page.tsx` today, not a new abstraction invented for reusability's own sake — see §5 for the evidence this was grounded in.
- Client validation rules (`required|email|max:255` for `email`, `required|string|max:255` for `password`) move into `LoginForm` unchanged, via `clensyResolver` from `@clensy/validation` — these are intrinsic to "the existing Clensy login experience" this ticket preserves, not something the host application injects. `clensyResolver`'s `attributes` option (used for message interpolation) is derived from `labels.email`/`labels.password` (lowercased), exactly reproducing today's `t('email').toLowerCase()`/`t('password').toLowerCase()` values without `LoginForm` calling `next-intl` itself.
- `LoginForm` renders the `<form>` element and its contents — heading, fields, generic error, submit button — using `@clensy/ui`'s `Field`/`FieldLabel`/`Input`/`FieldError`/`Button`. The full-page centering `<main>` wrapper (today's `flex min-h-screen items-center justify-center ...`) stays in `apps/web/app/login/page.tsx` as page-level layout, not part of `LoginForm` — `LoginForm` owns the form itself; the page owns where that form sits on the page.

### 4.5 `apps/web/app/login/page.tsx` after refactor

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
        labels={{ title: t('title'), email: t('email'), password: t('password'), submit: t('submit'), submitting: t('submitting') }}
        errorMessage={t('errors.invalidCredentials')}
        onLogin={handleLogin}
      />
    </main>
  );
}
```

Any thrown/rejected error from `login(...)` itself (a network or GraphQL exception) propagates out of `handleLogin` uncaught, exactly as it does today; the explicit `throw` covers the resolved-but-unsuccessful case (`success: false`), which does not throw on its own from Apollo. Both land in `LoginForm`'s own `catch` (§4.4), reproducing today's two collapsed failure paths with no `apps/web`-side `try`/`catch` needed.

`apps/web` keeps: the route itself, the `<main>` layout wrapper, every `useTranslations('auth')` lookup, the `useLoginMutation` call and its Apollo/GraphQL specifics, and the post-success redirect — exactly the "route, redirect, i18n wiring, injecting auth" responsibilities the tracking issue assigns to `apps/web`. It no longer holds form state, validation wiring, or field/error markup.

### 4.6 i18n boundary: extending the existing rule to `@clensy/web`

`apps/web/README.md`'s i18n section already states: *"`@clensy/ui` MUST NOT import `next-intl` or hold a Clensy message catalog. It takes already-translated strings ... as props; `apps/web` translates, `@clensy/ui` renders."* This spec extends the identical rule to `@clensy/web`:

- `@clensy/web` MUST NOT import `next-intl` or hold/reference a `messages/**` catalog.
- `@clensy/web` components take already-translated copy as props (`LoginFormLabels`, `errorMessage`); `apps/web` remains the only layer that calls `useTranslations`/`getTranslations`.

This is required, not merely consistent-in-style: the tracking issue's stated goal is a `LoginForm` "another app could reuse ... with its own implementation" — a `next-intl` dependency inside `@clensy/web` would defeat that by coupling it to `apps/web`'s specific i18n rig the same way a `@clensy/client` dependency would couple it to `apps/web`'s specific GraphQL rig (§4.7).

### 4.7 Package boundaries (MUST / MUST NOT)

- `@clensy/web` MUST NOT import shadcn or `radix-ui` packages, or `apps/web/components/ui/*` (does not exist post-#57 in any case) — UI primitives come only through `@clensy/ui`.
- `@clensy/web` MUST NOT import `@clensy/client`, `@apollo/client`, or any other GraphQL/network client — authentication calls are always injected via `onLogin`.
- `@clensy/web` MUST NOT import `next-intl` or a Clensy message catalog (§4.6).
- `@clensy/web` MUST NOT import from `apps/web`.
- `@clensy/web` MAY depend on `@clensy/ui` and `@clensy/validation` — both are already business-agnostic-or-generic shared packages one layer below it.
- `@clensy/ui` MUST NOT depend on `@clensy/web` (§4.1) — the dependency direction is one-way.
- `@clensy/ui`'s new `Input`/`Field` family MUST NOT gain auth-specific behavior, props, or naming — they remain exactly as generic as every existing `base/` primitive (§2). `@clensy/ui` still has no domain/auth components after this spec.

### 4.8 Preserved behavior, enumerated

Per the tracking issue's "Preserve" section, the following are unchanged by this refactor (verified at M6 against the pre-refactor page, not merely asserted):

- Client validation rules and messages (`required|email|max:255`, `required|string|max:255`, via `clensyResolver`/`@clensy/validation`, unchanged).
- The authentication request itself (`useLoginMutation`, unchanged, still owned by `apps/web`).
- The non-discriminating generic error message and when it appears (§3).
- Loading/submitting state (submit button disabled + `submitting` label swap while `onLogin` is in flight).
- Redirect-on-success behavior (`router.push('/app')`, still owned by `apps/web`).
- i18n: identical visible copy, sourced from the same `auth` message namespace, now passed as props instead of read via `useTranslations` inside the form itself.
- Accessibility: `aria-invalid`/`aria-describedby` on invalid fields, `role="alert"` on the generic error, associated `<label>`/`FieldLabel` elements, `autoComplete="username"`/`autoComplete="current-password"`.
- User-facing text and overall layout, modulo the visual difference §4.9 explicitly allows.

### 4.9 Visual difference (bounded)

This ticket exists specifically to compare before/after visually, so some visual change is expected and acceptable — but only the change `Field`/`Input`/`Button` naturally impose in place of the old hand-rolled `FormField`/`Button`. No page-specific Tailwind classes are added to `LoginForm` merely to recreate every pixel of the old look once the shared components already provide the intended design (per the tracking issue's "Visual difference" section, verbatim). This is not a login redesign.

## 5. Rationale

**Why one domain-placement rule instead of two valid locations (`packages/ui/src/domain/` and `@clensy/web`)?** Two destinations for the same kind of thing — a domain component — is the exact ambiguity the tracking issue's three-layer diagram exists to eliminate; it never names `packages/ui/src/domain/` as a target. A softer "generic enough to live inside `@clensy/ui`" test would recur as a subjective judgment call on every future component; a bright-line business-concept test does not (§4.1).

**Why does `onLogin` resolve/reject instead of returning `Promise<boolean>`?** Grounded directly in `apps/web/app/login/page.tsx`'s current code, not a preference: today's `onValid` has exactly two outcomes at the UI layer — the success branch (`return` after redirecting) and everything else collapsing into the identical `setError(t('errors.invalidCredentials'))` call, regardless of whether the cause was a thrown network/GraphQL error or a resolved `success: false`. A `boolean` return would force both `LoginForm` and its host to carry an explicit true/false branch reproducing a distinction the current code does not actually preserve at the UI layer — every non-success path already renders identically. A rejected-promise contract needs no such branch inside `LoginForm`: `await onLogin(values)` inside a single `try { ...; return } catch { setError(errorMessage) }` is a one-to-one translation of the control flow already in the page today. The one adapter cost — converting the mutation's own `success: false` result into a thrown error — lands entirely inside `apps/web`'s `handleLogin` (§4.5), which already interprets that GraphQL response shape today and is the only layer with a reason to.

**Why inject only the login action, not the validation rules too?** The tracking issue is explicit: prefer injecting the login action "so another app could reuse `LoginForm`"; do not invent a new auth abstraction beyond what the existing service boundary already provides. Validation rules are part of *what a login form validates*, not part of *how a given application authenticates* — they stay intrinsic to `LoginForm`, matching "preserve existing login behavior ... as much as reasonably possible" rather than turning every preserved behavior into a new configurable surface.

**Why translated copy as props instead of `@clensy/web` calling `useTranslations` itself?** `next-intl`'s runtime is resolvable only inside an `apps/web`-provided provider tree — a `@clensy/web` component calling `useTranslations` directly would still render correctly inside `apps/web` today, but would silently couple `@clensy/web` to `apps/web`'s specific i18n catalog structure, defeating the issue's own reusability goal and contradicting the already-Accepted rule `@clensy/ui` follows for the identical reason (§4.6).

**Why does `Field`'s full generated export set (not just what `LoginForm` uses) land in `@clensy/ui`?** Matches this repository's existing precedent: every prior `base/` primitive was relocated/generated as its complete file, not hand-trimmed to one consumer's current usage (`avatar.tsx` ships `AvatarGroup`/`AvatarGroupCount`/`AvatarBadge` though only `Avatar`/`AvatarFallback` are consumed by `user-menu.tsx` today). Hand-trimming a generated file invites drift from shadcn's own recipe and repeated re-generation work later; shipping the complete file once is the established default here.

**Why not also migrate `FormField`'s existing consumers onto `Field`/`Input` in this slice?** The tracking issue scopes this explicitly to login only ("Keep this change small and isolated... do not migrate other forms or pages"), matching the `@clensy/ui` boundary spec's own precedent of separating "relocate/add a primitive" work from "migrate every existing consumer onto it" work when the latter is materially larger and not required to answer this ticket's evaluation question.

## 6. Followed-by: what this slice deliberately leaves for later

- Physically removing the now-legacy `packages/ui/src/domain/` scaffold (directory + README) and updating `packages/ui/README.md`'s Layout section accordingly, now that `@clensy/web` is the established home for domain components (§4.1, §2).
- Migrating other `apps/web` forms (e.g. Add Customer) from `FormField` onto `Field`/`Input`, if the evaluation this ticket exists to run is judged successful (§2, §5).
- Extending `@clensy/web` with further top-level domain groupings (siblings of `auth/`) once a second genuine need exists, per the Phase 1 design's extraction convention (§5).
- A `no-restricted-imports` lint rule enforcing the `@clensy/web`-only (and `@clensy/ui`-only) boundary at `apps/web`, and the `@clensy/ui`-only boundary at `@clensy/web` itself — worth doing, not required by this migration, consistent with the identical deferral already recorded in the `@clensy/ui` boundary spec.
- Adding `@clensy/web`-level `vitest` wiring, decided at M4/M6 once there is a concrete unit worth isolating (§4.3).

## 7. Testing and acceptance

Consistent with this repository's existing frontend testing precedent (Phase 1 Design, the Web Shell & Design System spec, and the `@clensy/ui` boundary spec all scope frontend testing to unit tests over closed/pure logic plus manual golden-path verification — no component-rendering test framework exists anywhere in this repository).

**Build gates:** `pnpm --filter @clensy/ui build` (`tsc --noEmit`) and `lint`; `pnpm --filter @clensy/web build` and `lint` (new); `pnpm --filter web build` and `lint` all succeed.

**Grep-verifiable acceptance gates:**

- `apps/web/app/login/page.tsx` contains no direct import from `@clensy/ui`'s `Field`/`Input`/`Button`/`FormField` primitives, `react-hook-form`, or `@clensy/validation` — those now live inside `@clensy/web`.
- `packages/web/src/**` contains no import of `next-intl`, any `messages/**` path, `@clensy/client`, or `@apollo/client`.
- `packages/web/src/**` contains no import from `radix-ui`, `shadcn`, or `apps/web/components/ui/*`.
- `packages/ui/src/**` contains no import from `@clensy/web`.
- `@clensy/ui`'s `index.ts` exports `Input` and the `Field` family alongside the existing `base/` exports.

**Manual golden path (`/login`):**

1. Empty submit — required-field client errors render under each field, matching today's copy and placement.
2. Invalid email format — email-format client error renders.
3. Valid format, wrong credentials — submit button shows the `submitting` label and is disabled while in flight; on response, the single generic `errors.invalidCredentials` message renders (not a field-level error).
4. Valid, correct credentials — redirects to `/app`.
5. Visual comparison against the pre-refactor page confirms the bounded visual difference described in §4.9 — no unrelated layout/copy drift.
6. Keyboard/a11y pass: label-to-input association, `aria-invalid`/`aria-describedby` on errored fields, `role="alert"` on the generic error, tab order unchanged.

## 8. Non-goals

- Migrating any `apps/web` form other than login onto `Field`/`Input`, or retiring `FormField` (§2, §6).
- Populating, or physically removing, `packages/ui/src/domain/` in this ticket (§2, §4.1, §6).
- Any visual/UX redesign of the login screen beyond what `Field`/`Input`/`Button` require (§2, §4.9).
- Coupling `@clensy/ui`'s new primitives, or `@clensy/web`, to Next.js/`next-intl`/routing/auth specifics (§2, §4.6, §4.7).
- Any change to `apps/api` authentication logic or the `login` mutation contract (§2).
- A `no-restricted-imports` lint rule enforcing any of this spec's new boundaries (§2, §6).
- Introducing `jsdom`/`@testing-library/react` or any component-rendering test framework (§2, §4.3, §7).

## 9. Acceptance criteria (for this specification)

- States one unambiguous domain-placement rule and resolves the `packages/ui/src/domain/` vs. `@clensy/web` conflict explicitly, including its relationship to the Accepted `@clensy/ui` boundary spec's own Followed-by item (§4.1, header table).
- States one clear three-layer rule (shadcn → `@clensy/ui` → `@clensy/web` → `apps/web`) and where each layer's constraints are documented, including the explicit one-way dependency direction (§4.1–§4.7).
- Defines `LoginForm`'s full prop contract, including the injected `onLogin` action and its exact success/failure semantics, grounded in the current implementation's actual control flow rather than an arbitrary shape, precisely enough that M4 does not need to invent the generic-error-collapsing behavior (§4.4, §5).
- Extends the existing, Accepted `@clensy/ui` i18n-boundary rule to `@clensy/web` explicitly, with rationale distinct from mere stylistic consistency (§4.6, §5).
- Enumerates every preserved behavior from the tracking issue's "Preserve" section concretely enough to verify at M6 (§4.8).
- States, with rationale, exactly what is deliberately deferred and why, distinguishing "add a primitive/package now" from "migrate every other consumer" work (§5, §6).
- Defines a testing and acceptance bar consistent with this repository's existing testing precedent, including grep-verifiable boundary gates (§7).
