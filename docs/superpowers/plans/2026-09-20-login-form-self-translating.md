# `LoginForm` Self-Translating UI Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `LoginForm`'s `labels` prop entirely; resolve all its UI copy from `@clensy/web`'s own i18n context, matching `BookingDataTable`'s existing self-translating pattern and completing `LoginForm`'s partial adoption of it (`errorMessage`) from #63.

**Architecture:** Extend the existing `auth` namespace in `@clensy/web`'s default-messages catalog with five more keys (title/email/password/submit/submitting), read via the `t = useClensyTranslations('auth')` `LoginForm` already calls. Delete `LoginFormLabels`/`labels`. Thin `apps/web/app/login/page.tsx` down to pure composition (no `next-intl` calls left). Empty (not delete) `apps/web/messages/en/auth.json`, mirroring `common.json`'s existing empty-stub precedent. Repoint the one test that depends on `auth.title` (`apps/web/lib/i18n-rendering.test.tsx`) to a stable, unrelated key (`nav.sidebar.primary`) that proves the same resolution path without depending on the now-emptied namespace.

**Tech Stack:** Same as #63 — TypeScript, React 19, `vitest` (+ `renderToStaticMarkup`, no `jsdom`), pnpm workspaces (`@clensy/web`, `web`), `next-intl` (apps/web only), the `@clensy/web` i18n context.

**Spec:** [docs/superpowers/specs/2026-09-20-login-form-self-translating-design.md](../specs/2026-09-20-login-form-self-translating-design.md) (Accepted, M3 2026-09-20). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**Also relies on (Accepted, unmodified by this plan beyond what the spec authorizes):** [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api.md) (this plan extends `LoginForm`'s already-Accepted `t = useClensyTranslations('auth')`/`resolveMessage` wiring from that slice — `errorMessage` behavior itself is untouched). [`@clensy/web` / `LoginForm`](2026-09-19-clensy-web-login-form-design.md) (validation rules, `onLogin` contract, accessibility attributes — all untouched). [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) (the four-namespace catalog shape and `common.json`'s empty-stub precedent this plan follows for `auth.json`).

**M5 decision:** **Accepted** — 2026-09-20. Self-review against `docs/workflows/prompts/plan-review.md`'s checklist found no plan blockers: authoritative-spec rule stated explicitly; every constraint and task traces to a specific spec section; task ordering (component → catalog → callers/tests → verification) is executable without inventing missing work; the one real test dependency (`i18n-rendering.test.tsx`) is handled by an explicit task, not discovered mid-implementation; every in-scope spec requirement maps to a task. Ready for M6 implementation.

## Global Constraints

- SHALL delete `LoginFormLabels` and the `labels` prop from `LoginFormProps` entirely (spec §2, §4.1). SHALL NOT add any replacement prop for UI copy — `LoginForm` resolves it internally via `t = useClensyTranslations('auth')`.
- SHALL resolve all of `LoginForm`'s rendered strings (`title`, `email`, `password`, `submit`, `submitting`) plus the `clensyResolver` validation-attributes interpolation via `t(...)`, replacing every `labels.*` use site 1:1 (spec §4.1's table) — SHALL NOT change what any of these five strings' English text says.
- SHALL keep `apps/web/messages/en/auth.json` registered in `apps/web/i18n/messages.ts` — SHALL NOT delete the file or remove `auth` from `getMessages()`'s return (spec §2, §4.3).
- SHALL repoint `apps/web/lib/i18n-rendering.test.tsx` to `nav.sidebar.primary` (spec §4.4) — SHALL NOT leave it asserting against the now-empty `auth` namespace, and SHALL NOT delete this test.
- SHALL NOT modify `@clensy/ui`, `BookingDataTable`, `LoginForm`'s validation rules/`onLogin` contract/accessibility attributes, or add a `ClensyI18nProvider` to the login page (spec §2).
- SHALL NOT add a new `login-form.test.tsx` (spec §7 — same reasoning as #63: no jsdom, this repository's existing precedent).
- SHALL NOT modify any file outside `packages/web/src/auth/login-form.tsx`, `packages/web/src/i18n/messages/en/auth.ts`, `packages/web/src/index.ts`, `packages/web/README.md`, `apps/web/app/login/page.tsx`, `apps/web/messages/en/auth.json`, `apps/web/lib/i18n-rendering.test.tsx`.

---

### Task 1: Extend `@clensy/web`'s `auth` catalog and `LoginForm` itself

**Files:**
- Modify: `packages/web/src/i18n/messages/en/auth.ts`
- Modify: `packages/web/src/auth/login-form.tsx`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Produces: `LoginFormProps` without `labels` — consumed by Task 2's `apps/web/app/login/page.tsx` edit.

- [ ] **Step 1: Add the five new default-messages keys**

Replace `packages/web/src/i18n/messages/en/auth.ts` with:

```ts
// Default `en` messages for LoginForm. Mirrors messages/en/bookings.ts's
// own convention: this is the ONLY copy of this text's original English
// wording — relocated from apps/web/messages/en/auth.json's now-emptied
// keys, not reworded.
export const auth = {
  title: 'Clensy Admin Login',
  email: 'Email',
  password: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in…',
  error: 'Invalid email or password.',
};
```

- [ ] **Step 2: Remove `LoginFormLabels`/`labels` and switch every use site to `t(...)`**

In `packages/web/src/auth/login-form.tsx`:

Delete the `LoginFormLabels` interface entirely.

Change `LoginFormProps`:

```ts
export interface LoginFormProps {
  errorMessage?: string;
  onLogin: (values: LoginFormValues) => Promise<void>;
}
```

Change the function signature and body's four use sites:

```ts
export function LoginForm({ errorMessage, onLogin }: LoginFormProps) {
  const t = useClensyTranslations('auth');
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoginFormValues>({
    resolver: clensyResolver<LoginFormValues>(loginRules, {
      attributes: { email: t('email').toLowerCase(), password: t('password').toLowerCase() },
    }),
  });
```

```tsx
      <h1 className="text-lg font-semibold text-slate-900">{t('title')}</h1>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
```

```tsx
        <Field>
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
```

```tsx
      <Button type="submit" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
```

No other line changes — `loginRules`, `onValid`'s try/catch, `resolveMessage(errorMessage, t('error'))`, form registration, and every `aria-*` attribute stay exactly as they are today.

- [ ] **Step 3: Drop the now-unused type export**

In `packages/web/src/index.ts`, change:

```ts
export type { LoginFormLabels, LoginFormProps, LoginFormValues } from './auth/login-form';
```

to:

```ts
export type { LoginFormProps, LoginFormValues } from './auth/login-form';
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web test`
Expected: all pass. No test currently references `LoginFormLabels`/`labels` (verified during spec research), so none should fail from this rename.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/i18n/messages/en/auth.ts packages/web/src/auth/login-form.tsx packages/web/src/index.ts
git commit -m "feat(63): make LoginForm fully self-translating, removing the labels prop"
```

---

### Task 2: Thin the login page and empty `apps/web`'s dead `auth` catalog

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/messages/en/auth.json`
- Modify: `apps/web/lib/i18n-rendering.test.tsx`

**Interfaces:**
- Consumes: `LoginFormProps` without `labels` (Task 1).

- [ ] **Step 1: Simplify the login page**

Replace `apps/web/app/login/page.tsx` with:

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

- [ ] **Step 2: Empty the now-dead `apps/web` auth catalog**

Replace `apps/web/messages/en/auth.json` with:

```json
{}
```

- [ ] **Step 3: Repoint the next-intl resolution-path test**

Replace `apps/web/lib/i18n-rendering.test.tsx` with:

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

- [ ] **Step 4: Verify**

Run: `pnpm --filter web build && pnpm --filter web lint && pnpm --filter web test`
Expected: all pass, including `apps/web/i18n/messages.test.ts` (unmodified — four-namespace assertion unaffected by `auth.json`'s emptied contents) and the repointed `i18n-rendering.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/login/page.tsx apps/web/messages/en/auth.json apps/web/lib/i18n-rendering.test.tsx
git commit -m "fix(63): drop translation plumbing from the login page now that LoginForm self-translates"
```

---

### Task 3: Documentation and full verification sweep

**Files:**
- Modify: `packages/web/README.md`

**Interfaces:** N/A.

- [ ] **Step 1: Update the README**

In `packages/web/README.md`, update the "Known, intentional inconsistency" paragraph and the `## i18n` section's `LoginForm` parenthetical to state that `LoginForm` now fully self-translates (no caller-supplied string prop besides its own `errorMessage` override), matching `BookingDataTable`. Update the `## LoginForm` section to remove the `labels` mention and describe `t = useClensyTranslations('auth')` resolving all of its copy.

- [ ] **Step 2: Full verification sweep**

```bash
pnpm --filter @clensy/web build
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web test
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test
```

Expected: all six succeed.

- [ ] **Step 3: Grep-verifiable acceptance gates**

```bash
grep -rn "LoginFormLabels" packages/web/src apps/web
grep -rn "labels=" apps/web/app/login/page.tsx
grep -n "next-intl" apps/web/app/login/page.tsx
```

Expected: first two return nothing; third returns nothing.

- [ ] **Step 4: Manual golden path**

Rebuild and restart the web container (or run `pnpm --filter web dev`), then verify in a browser: the login page renders the exact same visible copy as before (title, field labels, button text), invalid credentials still show `"Invalid email or password."`, and valid credentials still redirect to `/app`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/README.md
git commit -m "docs(63): update @clensy/web README for LoginForm's fully self-translating contract"
```

- [ ] **Step 6: Stop for manual review — do not push, merge, or create a new PR**

This is an update to the already-open PR #64. Report verification results and wait for explicit approval before pushing.
