# `LoginForm` — Self-Translating UI Copy — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-20 |
| Tracking issue | [#63](https://github.com/rexescario-dev/clensy-platform/issues/63) — folded in by explicit request; originally scoped to `errorMessage` normalization only |
| Depends on (Accepted) | [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api-design.md) — established `LoginForm`'s first (partial) use of `@clensy/web`'s i18n context (`useClensyTranslations('auth')`, resolving only `error`) and explicitly deferred the `labels` migration as a named follow-up (its §2 "Out of scope", its README update's "narrowed, not fully reconciled" framing). This spec completes that deferral (extends). [`@clensy/web` / `LoginForm`](2026-09-19-clensy-web-login-form-design.md) — established `LoginFormLabels`/`labels: LoginFormLabels` as a required, fully caller-supplied prop and the `@clensy/ui`-presentation-only / `apps/web`-translates boundary. This spec supersedes the `labels` prop specifically (constrains) while leaving every other part of that spec's contract (validation rules, `onLogin` resolve/reject semantics, accessibility attributes) unchanged (relies upon). [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) — established `apps/web/messages/en/auth.json` and `apps/web/lib/i18n-rendering.test.tsx`'s synthetic proof of the next-intl resolution path using `auth.title`. This spec empties `auth.json`'s remaining keys and repoints that test to a still-populated namespace (constrains that one test's subject key; relies upon the four-namespace catalog shape it also established, which is unchanged). |
| Related (not a dependency) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — its "`@clensy/ui` MUST NOT import `next-intl`" rule is why this spec explicitly confirms (§2, §5) that `LoginForm` stays inside `@clensy/web`, never moves to `@clensy/ui`, and `@clensy/ui` gains no i18n dependency of any kind as a result of this change. |
| Followed by | None. This closes the `labels`/`errorMessage` inconsistency `packages/web/README.md` flagged as a deliberately deferred follow-up — no further `@clensy/web`-i18n follow-up is implied. |
| Governing references | This document. It does not redesign `LoginForm`'s validation rules, its `onLogin` resolve/reject contract, its accessibility attributes, `BookingDataTable`, or `@clensy/ui`'s boundary — it moves one component's remaining caller-supplied UI copy onto the self-translating mechanism that component (for its error text) and `BookingDataTable` (for everything) already use. |
| M3 decision | **Accepted** — 2026-09-20. Self-reviewed against `docs/workflows/prompts/design-review.md`'s checklist: single document kind, scope/goals/non-goals/terminology/invariants/rationale/acceptance-criteria all present, every normative dependency cited with its relationship, no contradiction with Accepted upstream specs. One real risk this spec surfaces and resolves rather than leaving for M4 to discover: `apps/web/lib/i18n-rendering.test.tsx`'s dependency on `auth.title`, found by direct file inspection before drafting (§4.4). No design blocker; M4 should not need to invent semantics. Ready for M4 Implementation Planning. **Post-Accept correction (2026-09-20, requested after implementation shipped):** §2/§4.3/§5's original decision — empty `apps/web/messages/en/auth.json` to `{}` and keep it registered, mirroring `common.json`'s forward-contract precedent — is reversed. The requester's stronger requirement: no empty/unused namespace should remain in `apps/web` merely to preserve the prior catalog shape; the `auth` namespace is retired outright now that nothing in `apps/web` reads it. `apps/web/messages/en/auth.json` is deleted; `apps/web/i18n/messages.ts` drops the `auth` import and its key from `getMessages()`'s return; `apps/web/i18n/messages.test.ts`'s namespace-set assertion changes from four entries to three (`['common','nav','validation']`). See the [App Router i18n Architecture spec](2026-09-13-web-i18n-architecture-design.md)'s own matching Post-Accept correction for why this is a retirement of a v1-snapshot namespace, not an architecture break. Every other part of this spec (§4.1's `LoginForm` contract, §4.2's login-page shape, §4.4's test repoint) is unchanged. |

## 1. Thesis

`LoginForm` currently gets its UI copy two different ways: `labels` (title/email/password/submit/submitting) is a required prop `apps/web/app/login/page.tsx` translates and supplies; `errorMessage` (as of the just-Accepted `errorMessage` normalization spec) is optional, falling back to a package-owned translated default via `useClensyTranslations('auth')` when omitted. This is the exact "known, intentional inconsistency" `packages/web/README.md` already documents as deferred, not accidental. This spec closes it: `LoginForm` becomes fully self-translating, exactly like `BookingDataTable` already is — it takes no `labels` prop at all, resolving all five UI strings (plus its existing `error` key) from `@clensy/web`'s own `auth` namespace. `apps/web/app/login/page.tsx` shrinks to composition only (`onLogin` injection, redirect), with no `next-intl` translation calls left in it at all. `@clensy/ui` is untouched and gains no i18n dependency — `LoginForm` was never there and this spec keeps it in `@clensy/web`.

## 2. Scope

**In scope (normative):**

- `LoginFormLabels` and the `labels` prop are removed entirely from `LoginFormProps`. New shape: `interface LoginFormProps { errorMessage?: string; onLogin: (values: LoginFormValues) => Promise<void>; }` (§4.1).
- `packages/web/src/i18n/messages/en/auth.ts`'s `auth` namespace gains five new keys — exact existing English wording, relocated verbatim from `apps/web/messages/en/auth.json`, not reworded: `title: 'Clensy Admin Login'`, `email: 'Email'`, `password: 'Password'`, `submit: 'Sign in'`, `submitting: 'Signing in…'` (alongside the existing `error` key) (§4.1).
- `LoginForm` resolves every string it renders — `<h1>`, both `<FieldLabel>`s, the submit button's submitting/idle text — from `t('title')`/`t('email')`/`t('password')`/`t('submit')`/`t('submitting')` (the same `t = useClensyTranslations('auth')` it already calls for `error`), not from props (§4.1).
- The `clensyResolver` validation-attributes interpolation (`attributes: { email: ..., password: ... }`, used to produce field display names inside validation messages) switches from `labels.email.toLowerCase()`/`labels.password.toLowerCase()` to `t('email').toLowerCase()`/`t('password').toLowerCase()` — same values, same lowercase transform, different source (§4.1). This is not a new behavior; it is the same two strings previously threaded through as `labels`, now threaded through as `t(...)`.
- `apps/web/app/login/page.tsx` drops its `useTranslations` import, its `t` variable, and the entire `labels={{ ... }}` object from its `<LoginForm ... />` call, leaving `<LoginForm onLogin={handleLogin} />` (§4.2). No other line on this page changes — `handleLogin`, the `useLoginMutation` call, the redirect, and the explanatory comment above `handleLogin` are untouched.
- `apps/web/messages/en/auth.json` is emptied to `{}` — not deleted, and not removed from `apps/web/i18n/messages.ts`'s `getMessages()` (§4.3). This mirrors `common.json`'s existing empty-stub precedent (Accepted i18n-architecture spec, §5: "`common.json` ships empty... documented as a forward contract only") rather than introducing a new pattern, and keeps `apps/web/i18n/messages.test.ts`'s existing four-namespace assertion (`['auth','common','nav','validation']`) passing unmodified.
- `apps/web/lib/i18n-rendering.test.tsx`'s synthetic `LoginTitle` component (which exists solely to prove the full `next-intl` resolution path — `NextIntlClientProvider` → `useTranslations` → rendered output — using the login title as a convenient real key, not to test the login page itself) is repointed from `useTranslations('auth')` / `t('title')` to `useTranslations('nav')` / `t('sidebar.primary')`, asserting `"Primary"` instead of `"Clensy Admin Login"` — any still-populated, stable key proves the identical resolution path; `nav.sidebar.primary` is unrelated to this change and in no danger of emptying (§4.4).
- `packages/web/README.md`'s "Known, intentional inconsistency" paragraph is updated: `LoginForm` no longer has any caller-supplied string prop besides `errorMessage`; both `LoginForm` and `BookingDataTable` now fully own their own UI copy via `@clensy/web`'s i18n context (§4.5).

**Informative:** the exact current `LoginFormLabels`/`labels` usage sites in `login-form.tsx` (§4.1's table), confirming no fourth, undocumented use exists.

**Out of scope:**

- Any change to `@clensy/ui`. It has no i18n dependency before this spec and gains none after — `LoginForm` was never part of `@clensy/ui` and does not move there or anywhere else; it stays exactly where the original `LoginForm` design spec placed it, inside `@clensy/web` (Related, above).
- Adding `ClensyI18nProvider` around the login page. `useClensyI18nContext()` already falls back to `getDefaultMessages()`'s English defaults with no Provider in the tree — the same guarantee `LoginForm`'s `error` default and `BookingDataTable` already rely on (Accepted `errorMessage` spec §4.2) — so no Provider is required for `LoginForm` to render correctly. Adding one for a locale-override capability nothing currently needs would be speculative; not added (YAGNI, matches this spec's own minimal-footprint goal).
- Any change to `LoginForm`'s validation rules (`loginRules`), its `onLogin` resolve/reject contract, its accessibility attributes (`aria-invalid`, `aria-describedby`, `role="alert"`), or its `errorMessage`/`resolveMessage` behavior — all Accepted and unmodified by the `errorMessage` spec, untouched here.
- Any change to `BookingDataTable`, `DataTable`, or any other `@clensy/web`/`@clensy/ui` component.
- A second locale, or any `locale`/`messages` override prop on `LoginForm` — same explicit constraint the `errorMessage` spec already established, unchanged here.
- Deleting `apps/web/messages/en/auth.json` or removing the `auth` namespace from `apps/web/i18n/messages.ts` (§2, above — kept as an empty stub, not removed).

## 3. Terminology

Reuses **component-owned default**, **override**, and **resolved error message** exactly as defined in the Accepted `errorMessage` normalization spec §3 — this spec extends that same mechanism to five more keys, introducing no new terminology.

## 4. Architecture & behavioral contracts

### 4.1 `LoginForm` (`packages/web/src/auth/login-form.tsx`)

Current `labels.*` use sites (verified by reading the file in full):

| Site | Current | New |
| --- | --- | --- |
| Validation interpolation | `attributes: { email: labels.email.toLowerCase(), password: labels.password.toLowerCase() }` | `attributes: { email: t('email').toLowerCase(), password: t('password').toLowerCase() }` |
| Heading | `<h1>{labels.title}</h1>` | `<h1>{t('title')}</h1>` |
| Field labels | `<FieldLabel>{labels.email}</FieldLabel>` / `<FieldLabel>{labels.password}</FieldLabel>` | `<FieldLabel>{t('email')}</FieldLabel>` / `<FieldLabel>{t('password')}</FieldLabel>` |
| Submit button | `{submitting ? labels.submitting : labels.submit}` | `{submitting ? t('submitting') : t('submit')}` |

These are the only four use sites — no fifth, undocumented use of `labels` exists.

```ts
export interface LoginFormProps {
  errorMessage?: string;
  onLogin: (values: LoginFormValues) => Promise<void>;
}
```

`LoginFormLabels` is deleted (no longer referenced anywhere). `packages/web/src/index.ts` drops `LoginFormLabels` from its `export type { ... } from './auth/login-form'` line — it has no other consumer (verified: the only references to `LoginFormLabels`/`LoginFormProps` repo-wide are the interface's own definition and this one re-export).

`t = useClensyTranslations('auth')` — already called today (for `error`); no new hook call, just more keys read from the same `t`.

New default-messages content:

```ts
// packages/web/src/i18n/messages/en/auth.ts
export const auth = {
  title: 'Clensy Admin Login',
  email: 'Email',
  password: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in…',
  error: 'Invalid email or password.',
};
```

### 4.2 `apps/web/app/login/page.tsx` after refactor

```tsx
'use client';

import { LoginForm, type LoginFormValues } from '@clensy/web';
import { useLoginMutation } from '@clensy/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [login] = useLoginMutation();

  // Spec §4.5 / §3 (errorMessage spec): on success the API has already set
  // the HttpOnly session cookie via `Set-Cookie` on the mutation response —
  // this page never reads or writes the cookie itself, it only redirects.
  // `LoginForm` resolves on success and rejects on failure, so a falsy
  // `result.data?.login.success` (which Apollo doesn't otherwise treat as
  // an error) is turned into an explicit throw to signal failure up to
  // `LoginForm`, which is what displays the generic error message.
  async function handleLogin(values: LoginFormValues) {
    const result = await login({ variables: { loginInput: values } });
    if (!result.data?.login.success) {
      throw new Error('Login failed');
    }
    router.push('/app');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <LoginForm onLogin={handleLogin} />
    </main>
  );
}
```

`useTranslations`/`next-intl` no longer appears anywhere in this file — it was imported solely to build `labels`.

### 4.3 `apps/web/messages/en/auth.json`

```json
{}
```

`apps/web/i18n/messages.ts` keeps importing and returning `auth` unchanged (`import auth from '../messages/en/auth.json'; ... return { auth, common, nav, validation };`) — the namespace stays registered, just empty, exactly like `common.json` today. `apps/web/i18n/messages.test.ts`'s `Object.keys(getMessages()).sort()` assertion needs no change.

### 4.4 `apps/web/lib/i18n-rendering.test.tsx`

```tsx
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../i18n/messages';

function SidebarPrimaryLabel() {
  const t = useTranslations('nav');
  return <h1>{t('sidebar.primary')}</h1>;
}

describe('next-intl resolution path', () => {
  it('resolves a real catalog key through NextIntlClientProvider + useTranslations', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={getMessages()}>
        <SidebarPrimaryLabel />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Primary');
  });
});
```

This test's purpose (prove `next-intl`'s catalog → provider → hook → output path resolves correctly) is unchanged — only its example key moves from the now-empty `auth` namespace to `nav.sidebar.primary`, a key with no relationship to this change and no reason to ever empty.

### 4.5 `packages/web/README.md`

The "Known, intentional inconsistency" paragraph and the `## i18n` section's parenthetical (`LoginForm` (its error-message default only — `labels` stays caller-supplied, see above)) are updated to state that `LoginForm` now fully self-translates, same as `BookingDataTable` — no caller-supplied string prop remains on either component besides `BookingDataTable`'s own `errorMessage` override and `LoginForm`'s own `errorMessage` override, both optional overrides of a package-owned default, not required inputs.

## 5. Rationale

**Why extend `@clensy/web`'s existing i18n context rather than any other mechanism?** It already exists, `LoginForm` already partially uses it (for `error`, per the just-Accepted `errorMessage` spec), and `BookingDataTable` already fully uses it for every string it renders. Extending the same `auth` namespace with five more keys is the smallest change that closes the inconsistency `packages/web/README.md` already names — no new mechanism, no new dependency, no second i18n system (a standing constraint from the `errorMessage` spec, unchanged here).

**Why does `@clensy/ui` stay untouched?** `LoginForm` has never lived in `@clensy/ui` — it was placed in `@clensy/web` specifically because `@clensy/ui` "must not import next-intl" and must stay presentation-only (original `LoginForm` design spec, Related above). This spec doesn't move `LoginForm`; it deepens its existing position inside `@clensy/web`, so `@clensy/ui`'s boundary is never at risk here — there is no conditional to resolve (the request's own framing — "if `LoginForm` remains inside `@clensy/ui`..." — does not apply, since it never was).

**Why empty `apps/web/messages/en/auth.json` to `{}` instead of deleting the namespace?** `common.json` already ships empty as "a forward contract only" per the Accepted i18n-architecture spec — this is the same move applied to `auth`, not a new pattern. It also avoids touching `apps/web/i18n/messages.ts`'s return shape or `messages.test.ts`'s four-namespace assertion, keeping this change's footprint to exactly the files that need it.

**Why repoint `i18n-rendering.test.tsx` instead of leaving `auth.title` in `auth.json` just for that test's sake?** Keeping a translation key alive solely because an unrelated test happens to read it would be a dead-key-in-disguise — the exact anti-pattern the `errorMessage` spec's own `errors.invalidCredentials` cleanup rejected. The test's actual job (prove the resolution path) is fully satisfied by any stable, real key; `nav.sidebar.primary` already is one.

## 6. Followed-by

None (Governing references, header).

## 7. Testing and acceptance

Consistent with this repository's existing precedent (no `jsdom`/`@testing-library/react`; no interaction-simulation, per the `errorMessage` spec's own §8/§9 reasoning, unchanged and still applicable — `LoginForm`'s rendered text is verifiable at any point via `renderToStaticMarkup`, but *which* branch of `submitting ? ... : ...` shows, or the post-submit error text, is still only reachable through interaction, so no new `login-form.test.tsx` is added here either):

- `apps/web/lib/i18n-rendering.test.tsx`: updated per §4.4, still passes, still proves the same resolution path.
- `apps/web/i18n/messages.test.ts`: unmodified, still passes (four-namespace assertion unaffected by `auth.json`'s emptied *contents*).
- **Grep-verifiable acceptance gates:** no remaining reference to `LoginFormLabels` anywhere in `packages/web/src` or its `index.ts` export list; no remaining `labels` prop on any `<LoginForm` call site; `apps/web/app/login/page.tsx` contains no `next-intl` import.
- **Build gates:** `pnpm --filter @clensy/web build`/`lint`/`test` and `pnpm --filter web build`/`lint`/`test` all succeed.
- **Manual golden path:** the login page renders with the exact same visible English copy as before (title, field labels, button text, and — on invalid credentials — the same error message), and successful login still redirects to `/app`.

## 8. Non-goals

- Any change to `@clensy/ui` (§2, §5).
- Adding `ClensyI18nProvider` to the login page (§2).
- Any change to `LoginForm`'s validation rules, `onLogin` contract, or accessibility attributes (§2).
- Any change to `BookingDataTable` or any other component (§2).
- A second locale or `locale`/`messages` override props (§2).
- Deleting `apps/web/messages/en/auth.json` or its namespace registration (§2, §4.3).

## 9. Acceptance criteria (for this specification)

- States `LoginForm`'s exact current `labels` use sites (verified by reading the file, §4.1's table) and its exact new contract, precisely enough that M4 does not need to invent it.
- Resolves the one real test dependency this change touches (`i18n-rendering.test.tsx`'s reliance on `auth.title`) explicitly, rather than leaving it for M6 to discover as a surprise failure (§4.4, §5).
- States precisely how `apps/web/messages/en/auth.json` is treated (emptied, not deleted) and why, tying the decision to an existing repository precedent (`common.json`) rather than inventing a new one (§4.3, §5).
- Explicitly confirms `@clensy/ui`'s boundary is unaffected, closing the request's own conditional rather than leaving it open (§5).
- Defines a testing and acceptance bar consistent with this repository's existing precedent, including exactly which existing test is touched and why no new component-interaction test is added (§7).
