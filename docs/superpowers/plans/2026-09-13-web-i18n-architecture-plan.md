# App Router i18n Architecture (next-intl) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `next-intl` into `apps/web` for a single `en` catalog and migrate two PoC surfaces — the login page and the shell sidebar/nav — from hardcoded English to translation keys, without touching routing, `@clensy/ui`, money math, or any other module screen.

**Architecture:** `i18n/request.ts` (+ an extracted `i18n/messages.ts` helper, a planning-level split — see Task 1) is the single place that resolves the locale (`en`, no fallback chain) and merges the four namespaced catalogs. `apps/web/app/layout.tsx` obtains `<html lang>` via `getLocale()` and renders `NextIntlClientProvider` with no explicit `messages`/`locale` props (it inherits the request configuration). Login and the sidebar consume `useTranslations`. `@clensy/ui` remains untouched.

**Tech Stack:** Next.js 16.3 App Router, React 19, `next-intl` (new dependency), existing Vitest setup (`environment: 'node'`), `apps/web` ESLint flat config.

**Spec:** [docs/superpowers/specs/2026-09-13-web-i18n-architecture-design.md](../specs/2026-09-13-web-i18n-architecture-design.md) (Accepted). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**Also relies on (Accepted, unmodified by this plan):** [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) (login's non-discriminating error semantics), [Web Application Shell & Design System](../specs/2026-09-10-web-shell-and-design-system-design.md) (current `AppSidebar`/`NAV_GROUPS` implementation this plan edits in place).

**Revision (plan review, Accepted):** rendered-component test's claim narrowed to what it actually exercises (catalog → `getMessages()` → provider → hook → output); `getMessages()` documented as internal to the i18n loading boundary (doc comment + a second ESLint restriction blocking `i18n/messages` imports, not just raw catalog JSON, from outside `i18n/`); Task 3's lint rule and verification step extended to cover both relative and `@/*`-aliased import forms; Task 5 Step 1 relabeled as a regression baseline rather than a TDD red step.

**Execution note (M6):** this plan briefly included a standalone `apps/web/i18n/request.test.ts` unit test (calling `request.ts`'s default export directly to assert its locale/messages contract). During Task 2 execution against the actual installed `next-intl@4.14.4`, that test was found to be infeasible: `next-intl/server` ships two builds selected by a `"react-server"` package-export condition, and any environment that doesn't declare that condition — including plain Vitest — resolves to a stub where `getRequestConfig` and every other export throw `` `<name>` is not supported in Client Components `` when called, by design (the package's own source comments this as intentional, "mostly relevant for testing," so that incidentally importing `next-intl/server` in a client-only test doesn't crash at import time). Forcing `resolve.conditions: ['react-server']` globally would fix this test but would also flip the *other* new test's `next-intl` (root) import onto its React-Server-only build, which is not designed to run under `renderToStaticMarkup`. next-intl also ships an internal `react-server/testUtils` (`renderToStream`) used by its own test suite, but it isn't part of the package's published `exports` map, so depending on it would mean relying on an unpublished internal. **Resolution (confirmed with the plan's own reviewer): the standalone `request.test.ts` is removed. `i18n/request.ts` runtime integration is verified by the Next.js build and the Task 7 manual golden path. No standalone Vitest test is used because `next-intl/server` selects its non-RSC stub when executed outside a React Server Components environment** — this is an intentional test-strategy adjustment, not a coverage gap, and does not reopen M5 (the spec never required a standalone unit test of next-intl's RSC runtime wiring; see spec §6). Task 2 below reflects this directly (no Step 1 contract test).

## Global Constraints

- SHALL keep the next-intl resolved locale `en` throughout; SHALL NOT introduce `en-PH` (or any locale) as a `getRequestConfig`/`getLocale()`/`NextIntlClientProvider` `locale` value.
- SHALL NOT add a `/en/...` URL prefix; SHALL NOT modify `apps/web/middleware.ts`'s matcher or `apps/web/next.config.ts`'s `redirects()` array (re-read that array in full before touching the file — every existing entry must still be present after this plan's edit).
- SHALL relocate, not reword, the login failure copy — the translated `auth.errors.invalidCredentials` string MUST remain exactly `"Invalid email or password."`, with no field-specific branching.
- SHALL NOT add `next-intl`, a message catalog, or any Clensy translation dependency to `packages/ui`. SHALL NOT modify `packages/ui/src/form-dialog.tsx`'s hardcoded `'Cancel'` literal.
- SHALL NOT modify `apps/web/lib/format-price.ts` (`formatMinorUnits` / `parsePesosToMinorUnits`) — money arithmetic and the `₱` literal are untouched.
- SHALL make `NavItem`/`NavGroup` (`apps/web/lib/nav-groups.ts`) key-only: `labelKey` + `href` for items, `labelKey` + `items` for groups. SHALL NOT retain a `label` field on either type.
- SHALL NOT change `findActiveHref` behavior, `NAV_GROUPS` hrefs/grouping, or the existing `apps/web/lib/nav-groups.test.ts` assertions.
- SHALL NOT change `apps/web/lib/web-shell-regressions.test.ts`'s asserted behavior: `app-sidebar.tsx` must still omit `forceMount` and `key={mobileNavOpen`, and still contain `md:hidden`. Do not touch `app/page.tsx` or the `globals.css` cursor rule this test also checks.
- SHALL NOT add typed translation keys / a generated `Messages` typing setup (spec §7 non-goal).
- SHALL NOT implement `normalizeApiError` as code in this slice — it is a developer-docs writeup only (spec §4.6, §2).
- SHALL ship `apps/web/messages/en/common.json` empty (`{}`); SHALL NOT pre-populate `common.errors.requestFailed` or any other speculative key.
- SHALL add a lint-level (or lightweight script) check that prevents any file under `apps/web` outside the `i18n/` module from importing `messages/**` directly.

---

## Planning-level deviation from the spec's file naming (non-normative)

The spec's §4.1 diagram and its "message loading" paragraph describe `i18n/request.ts` as the one authoritative file that both resolves the locale and produces the merged namespaced object. This plan splits that into two files for unit-testability:

- `apps/web/i18n/messages.ts` — a plain, synchronously-callable `getMessages()` that imports the four catalog JSON files and returns the merged object. Testable directly with Vitest; no Next.js request-scoped machinery involved.
- `apps/web/i18n/request.ts` — `getRequestConfig(async () => ({ locale: 'en', messages: getMessages() }))`, i.e. the next-intl plugin/runtime entry point, which delegates to `getMessages()`.

This is a file-layout decision, not a new normative contract: both files together are the single "authoritative message-loading boundary" the spec requires. The import-boundary lint rule (Task 3) exempts the whole `apps/web/i18n/` directory, not only `request.ts`, since `messages.ts` is the other half of that same boundary.

**`getMessages()` is internal to that boundary, not a second application-facing i18n API.** It exists only so `i18n/request.ts` and this plan's tests can load catalogs synchronously; it is not a substitute for `useTranslations`/`getTranslations`. Task 3's lint rule enforces this: importing `i18n/messages` (not just raw `messages/**` JSON) from anywhere outside `apps/web/i18n/` is also an error, so a component cannot route around the catalog-import restriction by reading `getMessages().nav.items.bookings` instead of calling `useTranslations('nav')`.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `apps/web/i18n/messages.ts` | `getMessages()` — imports and merges the four catalogs |
| `apps/web/i18n/messages.test.ts` | Catalog-integrity check: exactly the v1 namespace set |
| `apps/web/i18n/request.ts` | `getRequestConfig`; resolved locale `en`, no fallback chain. No standalone Vitest test — see the M6 execution note above; verified by build + manual golden path (Task 7). |
| `apps/web/messages/en/common.json` | Empty (`{}`) in v1 |
| `apps/web/messages/en/nav.json` | `NAV_GROUPS` + sidebar/mobile-nav copy |
| `apps/web/messages/en/auth.json` | Login copy + generic failed-login string |
| `apps/web/messages/en/validation.json` | Representative `required`/`email` ICU entries (#51 contract) |
| `apps/web/next.config.ts` | Wrapped by `createNextIntlPlugin` |
| `apps/web/app/layout.tsx` | `getLocale()` for `<html lang>`; `NextIntlClientProvider` |
| `apps/web/lib/i18n-rendering.test.tsx` | Rendered-component test: catalog → provider → hook → output |
| `apps/web/eslint.config.mjs` | Adds the direct-catalog-import restriction |
| `apps/web/app/login/page.tsx` | `useTranslations('auth')` |
| `apps/web/lib/nav-groups.ts` | Key-only `NavItem`/`NavGroup` |
| `apps/web/components/layout/app-sidebar.tsx` | `useTranslations('nav')` for all rendered/aria-label text |
| `apps/web/vitest.config.ts` | `include` extended for `.tsx` and `i18n/**` |
| `apps/web/package.json` | Adds `next-intl` dependency |
| `docs/superpowers/specs/... ` or `apps/web/README.md` (developer doc) | How to add/consume a key; `@clensy/ui` boundary rule |

**Must remain untouched:** `apps/api/**`, `packages/ui/**` (no `next-intl` dependency, no catalog, `form-dialog.tsx`'s `'Cancel'` unchanged), `apps/web/middleware.ts`, `apps/web/next.config.ts`'s `redirects()` entries, `apps/web/lib/format-price.ts`, `apps/web/app/page.tsx`, `apps/web/app/globals.css`.

---

### Task 1: Message catalogs + `getMessages()` + tests

**Files:**
- Create: `apps/web/messages/en/common.json`, `apps/web/messages/en/nav.json`, `apps/web/messages/en/auth.json`, `apps/web/messages/en/validation.json`
- Create: `apps/web/i18n/messages.ts`
- Create: `apps/web/i18n/messages.test.ts`
- Create: `apps/web/lib/i18n-rendering.test.tsx`
- Modify: `apps/web/package.json` (add `next-intl`), `apps/web/vitest.config.ts` (extend `include`)

**Interfaces:**
- Produces: `getMessages(): { common: object; nav: object; auth: object; validation: object }`

- [x] **Step 1: Add `next-intl`**

```bash
pnpm --filter web add next-intl
```

Inspect the installed package's own README/type declarations (`node_modules/.pnpm/next-intl@*/node_modules/next-intl/`) for the exact current API shape (`getRequestConfig`, `NextIntlClientProvider`, `useTranslations`, `getLocale`, `createNextIntlPlugin`) against Next 16.3 App Router before writing Task 2 — this plan's snippets are correct as of current next-intl documentation, but the installed version is authoritative. If the installed API meaningfully diverges from what this plan assumes, stop and treat it as a plan-revision item (M4/M5), not a silent workaround.

Confirmed against the installed `next-intl@4.14.4`: `getRequestConfig` (from `next-intl/server`) returns the callback passed to it, typed `(params: GetRequestConfigParams) => RequestConfig | Promise<RequestConfig>`; `getLocale` (from `next-intl/server`) is a zero-arg async function; `createNextIntlPlugin(i18nPathOrConfig?)` (from `next-intl/plugin`) defaults to searching `./i18n/request.{ts,tsx,js,jsx}` (then `./src/i18n/request.*`) relative to `next.config.ts` when no path is given — matches `apps/web/i18n/request.ts` exactly; `NextIntlClientProvider`'s `Props` make both `locale` and `messages` optional when rendered from a Server Component (both come from `IntlConfig`, which marks `messages` optional and `NextIntlClientProvider` itself makes `locale` optional). All plan snippets below are unchanged from this inspection. One thing this inspection did **not** cover — `next-intl/server`'s dual react-server/react-client builds under Vitest — surfaced in Task 2; see the M6 execution note at the top of this plan.

- [x] **Step 2: Write the catalogs**

`apps/web/messages/en/common.json`:

```json
{}
```

`apps/web/messages/en/auth.json`:

```json
{
  "title": "Clensy Admin Login",
  "email": "Email",
  "password": "Password",
  "submit": "Sign in",
  "submitting": "Signing in…",
  "errors": {
    "invalidCredentials": "Invalid email or password."
  }
}
```

`apps/web/messages/en/nav.json`:

```json
{
  "groups": {
    "operations": "Operations",
    "people": "People",
    "catalog": "Catalog",
    "administration": "Administration"
  },
  "items": {
    "bookings": "Bookings",
    "jobs": "Jobs",
    "laundry": "Laundry",
    "invoices": "Invoices",
    "customers": "Customers",
    "cleaners": "Cleaners",
    "teams": "Teams",
    "services": "Services",
    "addOns": "Add-ons",
    "staff": "Staff"
  },
  "sidebar": {
    "primary": "Primary",
    "expand": "Expand sidebar",
    "collapse": "Collapse sidebar",
    "collapseLabel": "Collapse",
    "mobileTitle": "Primary navigation"
  }
}
```

`apps/web/messages/en/validation.json`:

```json
{
  "required": "{field} is required",
  "email": "{field} must be a valid email address"
}
```

Note (for M5 visibility, not new scope): `nav.sidebar.collapseLabel` ("Collapse", the visible text next to the collapse toggle icon) and `nav.sidebar.mobileTitle` ("Primary navigation", the mobile `Sheet`'s screen-reader-only title) were found during file inspection of `app-sidebar.tsx`. They are hardcoded English strings inside the exact two files (`nav-groups.ts`, `app-sidebar.tsx`) the spec names as this slice's nav surface (§4.3), so this plan treats migrating them as part of that surface rather than deferred scope.

- [x] **Step 3: Write the failing catalog-integrity test**

`apps/web/i18n/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getMessages } from './messages';

describe('getMessages', () => {
  it('exposes exactly the v1 namespace set', () => {
    expect(Object.keys(getMessages()).sort()).toEqual(['auth', 'common', 'nav', 'validation']);
  });
});
```

- [x] **Step 4: Write the failing rendered-component test**

`apps/web/lib/i18n-rendering.test.tsx`:

```tsx
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../i18n/messages';

function LoginTitle() {
  const t = useTranslations('auth');
  return <h1>{t('title')}</h1>;
}

describe('next-intl resolution path', () => {
  it('resolves a real catalog key through NextIntlClientProvider + useTranslations', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={getMessages()}>
        <LoginTitle />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Clensy Admin Login');
  });
});
```

This test's actual, precisely-stated responsibility: **catalog → `getMessages()` → `NextIntlClientProvider` → `useTranslations` → rendered output**, using the real provider and hook — not a bare JSON-object assertion. It does **not** exercise `getLocale()` or `i18n/request.ts`'s own Next-runtime request-config wiring — that integration is covered by the build gate and manual golden path in Task 7 (see the M6 execution note at the top of this plan for why no standalone Vitest test exists for `request.ts`).

- [x] **Step 5: Extend `vitest.config.ts` include globs**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.{ts,tsx}', 'i18n/**/*.test.ts'],
  },
});
```

- [x] **Step 6: Implement `getMessages()`**

`apps/web/i18n/messages.ts`:

```ts
import common from '../messages/en/common.json';
import nav from '../messages/en/nav.json';
import auth from '../messages/en/auth.json';
import validation from '../messages/en/validation.json';

// Internal to the i18n loading boundary — consumed by ./request.ts and by
// this module's own tests. Application components MUST NOT call this to
// read message text directly; use useTranslations()/getTranslations().
// Enforced by the eslint restriction in Task 3.
export function getMessages() {
  return { common, nav, auth, validation };
}
```

- [x] **Step 7: Run tests — expect PASS**

```bash
pnpm --filter web test
```

- [x] **Step 8: Commit**

```bash
git add apps/web/messages apps/web/i18n/messages.ts apps/web/i18n/messages.test.ts apps/web/lib/i18n-rendering.test.tsx apps/web/vitest.config.ts apps/web/package.json pnpm-lock.yaml
git commit -m "test(web): add i18n message catalogs and resolution tests"
```

---

### Task 2: Wire next-intl into the runtime (plugin, request config, root layout)

**Files:**
- Create: `apps/web/i18n/request.ts`
- Modify: `apps/web/next.config.ts`, `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `getMessages` (Task 1)
- Produces: `<html lang>` sourced from `getLocale()`; `NextIntlClientProvider` ancestor for all of `apps/web`

- [x] **Step 1: `apps/web/i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server';
import { getMessages } from './messages';

export default getRequestConfig(async () => ({
  locale: 'en',
  messages: getMessages(),
}));
```

No standalone Vitest test for this file — see the M6 execution note at the top of this plan: `next-intl/server`'s real implementation is only resolved under the `"react-server"` package-export condition, which plain Vitest does not set. `i18n/request.ts`'s runtime integration is verified by the Next.js build (Step 4 below) and the Task 7 manual golden path instead.

- [x] **Step 2: Wrap `next.config.ts` with the next-intl plugin**

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // ... unchanged: transpilePackages, redirects() — do not remove or reorder any existing entry
};

export default withNextIntl(nextConfig);
```

Confirmed in Task 1 Step 1: the installed `next-intl` version's `createNextIntlPlugin()` (no argument) defaults to `./i18n/request.ts` relative to `next.config.ts` — exactly our file's path.

- [x] **Step 3: Root layout**

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ApolloProvider } from './apollo-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clensy',
  description: 'Clensy admin',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <ApolloProvider>{children}</ApolloProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

`NextIntlClientProvider` takes no explicit `locale`/`messages` props here — confirmed in Task 1 Step 1 that both are optional on its `Props` type when rendered from a Server Component.

- [x] **Step 4: Build**

```bash
pnpm --filter web build
```

Expected: success. This, plus Task 7's manual golden path, is the primary verification that `getLocale()` and the plugin/runtime request-config wiring actually work end to end.

- [x] **Step 5: `pnpm --filter web lint`**

- [x] **Step 6: Commit**

```bash
git add apps/web/i18n/request.ts apps/web/next.config.ts apps/web/app/layout.tsx
git commit -m "feat(web): wire next-intl request config and root layout locale"
```

---

### Task 3: Direct-catalog-import lint guard

**Files:**
- Modify: `apps/web/eslint.config.mjs`

**Interfaces:**
- Produces: an ESLint error on any `apps/web` file outside `i18n/` importing `messages/**` **or** `i18n/messages` directly, via either a relative import or the `@/*` → `apps/web/*` alias (`apps/web/tsconfig.json`) — both forms are in active use in this codebase, so the pattern must catch both.

- [x] **Step 1: Add the restriction**

```js
// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    // `lib/i18n-rendering.test.tsx` is the one deliberate exception outside
    // `i18n/**`: it exercises the real getMessages() -> NextIntlClientProvider
    // -> useTranslations() path (spec §6) and must import getMessages directly
    // to do so.
    ignores: ['i18n/**', 'lib/i18n-rendering.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/messages/*', '**/messages/**'],
              message:
                'Do not import message catalogs directly. Use useTranslations()/getTranslations() instead.',
            },
            {
              group: ['**/i18n/messages', '**/i18n/messages.ts'],
              message:
                'getMessages() is internal to the i18n loading boundary. Use useTranslations()/getTranslations() instead.',
            },
          ],
        },
      ],
    },
  },
);
```

Both `group` entries use `**` so they match a source string regardless of how many leading segments precede `messages`/`i18n` — this is what makes them fire for both a relative import (`../messages/en/auth.json`, `../i18n/messages`) and the `@/*` alias (`@/messages/en/auth.json`, `@/i18n/messages`), since `apps/web/tsconfig.json` maps `@/*` to `apps/web/*`.

- [x] **Step 2: Verify the rule fires for every import form it must catch, and doesn't false-positive**

Temporarily added each of the following to `apps/web/components/layout/app-sidebar.tsx`, confirmed `pnpm --filter web lint` failed for all four (one `no-restricted-imports` error each, per the message for its group), then removed them:

```ts
import x from '../../messages/en/auth.json'; // relative catalog import
import y from '@/messages/en/auth.json'; // aliased catalog import
import { getMessages } from '../../i18n/messages'; // relative internal-module import
import { getMessages as getMessages2 } from '@/i18n/messages'; // aliased internal-module import
```

**False positive found and fixed:** the first lint run also flagged `apps/web/lib/i18n-rendering.test.tsx` (Task 1), which legitimately imports `getMessages` from `../i18n/messages` to exercise the real resolution path per spec §6 — that file lives under `lib/`, not `i18n/`, so the original `ignores: ['i18n/**']` didn't cover it. Fixed by adding the exact file to `ignores` (Step 1's snippet above already reflects this) rather than broadening the ignore to a `*.test.*` glob, which would have let any test bypass the restriction. Confirmed no other false positive: `apps/web/i18n/messages.ts` and `apps/web/i18n/request.ts` both still lint clean (inside `i18n/**`), and `lib/i18n-rendering.test.tsx` now lints clean too.

- [x] **Step 3: `pnpm --filter web lint` — expect PASS**

- [x] **Step 4: Commit**

```bash
git add apps/web/eslint.config.mjs
git commit -m "chore(web): forbid importing i18n message catalogs outside i18n/"
```

---

### Task 4: Migrate the login page

**Files:**
- Modify: `apps/web/app/login/page.tsx`

**Interfaces:**
- Consumes: `useTranslations('auth')`

- [ ] **Step 1: Replace hardcoded strings**

```tsx
'use client';

import { useLoginMutation } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

// Spec §4.8 / §4.3 (Admin Foundation): on success the API has already set
// the HttpOnly session cookie via `Set-Cookie` on the mutation response —
// this page never reads or writes the cookie itself, it only redirects. On
// failure the API returns one generic, non-discriminating error message
// (unknown email, wrong password, and disabled account are all
// indistinguishable) — this page mirrors that by not attempting to
// interpret the error, just displaying the fixed generic translated string.
export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [login, { loading }] = useLoginMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const result = await login({ variables: { loginInput: { email, password } } });
      if (result.data?.login.success) {
        router.push('/app');
        return;
      }
      setError(t('errors.invalidCredentials'));
    } catch {
      setError(t('errors.invalidCredentials'));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">{t('title')}</h1>
        <FormField
          label={t('email')}
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormField
          label={t('password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? t('submitting') : t('submit')}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: `pnpm --filter web lint` and `pnpm --filter web build`**

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/login/page.tsx
git commit -m "feat(web): migrate login page copy to next-intl keys"
```

---

### Task 5: Migrate `NAV_GROUPS` and the sidebar

**Files:**
- Modify: `apps/web/lib/nav-groups.ts`
- Modify: `apps/web/components/layout/app-sidebar.tsx`

**Interfaces:**
- Produces: `NavItem { href: string; labelKey: string }`, `NavGroup { labelKey: string; items: NavItem[] }`
- `findActiveHref` signature and behavior unchanged

- [ ] **Step 1: Establish the existing regression baseline**

```bash
pnpm --filter web test -- nav-groups
```

This is a baseline check, not a TDD red step — `findActiveHref` only reads `href` and is unaffected by the `label` → `labelKey` rename, so it's expected to pass now and to still pass after Step 2. Re-run after Step 2 to confirm no regression.

- [ ] **Step 2: Update `nav-groups.ts`**

```ts
export interface NavItem {
  href: string;
  labelKey: string;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'groups.operations',
    items: [
      { href: '/app/bookings', labelKey: 'items.bookings' },
      { href: '/app/jobs', labelKey: 'items.jobs' },
      { href: '/app/laundry', labelKey: 'items.laundry' },
      { href: '/app/billing', labelKey: 'items.invoices' },
    ],
  },
  {
    labelKey: 'groups.people',
    items: [
      { href: '/app/customers', labelKey: 'items.customers' },
      { href: '/app/cleaners', labelKey: 'items.cleaners' },
      { href: '/app/cleaners/teams', labelKey: 'items.teams' },
    ],
  },
  {
    labelKey: 'groups.catalog',
    items: [
      { href: '/app/catalog', labelKey: 'items.services' },
      { href: '/app/catalog/add-ons', labelKey: 'items.addOns' },
    ],
  },
  {
    labelKey: 'groups.administration',
    items: [{ href: '/app/admin', labelKey: 'items.staff' }],
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

export function findActiveHref(pathname: string): string | undefined {
  return ALL_HREFS.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ).reduce<string | undefined>(
    (longest, current) =>
      longest === undefined || current.length > longest.length ? current : longest,
    undefined,
  );
}
```

- [ ] **Step 3: Update `app-sidebar.tsx` to resolve every label/aria-label via `useTranslations('nav')`**

Key changes to the existing file (full rewrite not required — apply in place):

- Add `import { useTranslations } from 'next-intl';` and `const t = useTranslations('nav');` inside `AppSidebar`.
- `aria-label="Primary"` (both `<nav>` elements, lines 45 and 94) → `aria-label={t('sidebar.primary')}`.
- The collapse toggle's `aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}` → `aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}`.
- The toggle's visible `<span>Collapse</span>` → `<span>{t('sidebar.collapseLabel')}</span>`.
- `<SheetTitle className="sr-only">Primary navigation</SheetTitle>` → `<SheetTitle className="sr-only">{t('sidebar.mobileTitle')}</SheetTitle>`.
- `SidebarNavigation` and `NavigationLink` need `t` passed down (prop or a second `useTranslations('nav')` call in each function component — either is fine; prefer passing `t` as a prop from `AppSidebar`/`SidebarNavigation` to avoid three separate hook calls for one namespace).
- `group.label` → `t(group.labelKey)`; use `group.labelKey` as the React `key` where `group.label` was previously used as the key (`key={group.label}` → `key={group.labelKey}`).
- `item.label` → resolve once as `const label = t(item.labelKey)` inside `NavigationLink`, then use `label` everywhere that function currently uses its `label` prop (display text, `aria-label`, `label.charAt(0)` for the collapsed icon letter, tooltip content). The `label` **prop name** on `NavigationLink` may stay (planning-level naming — spec's key-only invariant is about `NavItem`/`NavGroup`'s data shape, not internal component prop names); pass `t(item.labelKey)` as its value from `SidebarNavigation`.

- [ ] **Step 4: `pnpm --filter web test` — `nav-groups.test.ts` and `web-shell-regressions.test.ts` still pass**

- [ ] **Step 5: `pnpm --filter web lint` and `pnpm --filter web build`**

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/nav-groups.ts apps/web/components/layout/app-sidebar.tsx
git commit -m "feat(web): migrate NAV_GROUPS and sidebar to next-intl keys"
```

---

### Task 6: Developer docs

**Files:**
- Create or modify: `apps/web/README.md` (or a new `apps/web/docs/i18n.md` if a README doesn't exist — inspect first)

**Interfaces:** none (documentation only)

- [ ] **Step 1: Inspect `apps/web` for an existing README**

```bash
ls apps/web/README.md 2>/dev/null
```

- [ ] **Step 2: Write the doc**

Cover, briefly:
- Catalog location (`apps/web/messages/en/*.json`) and the four current namespaces.
- How to add a key: add it to the right namespace's JSON file, then `useTranslations('<namespace>')` + `t('<key>')` in a client component (or `getTranslations` in a server component).
- The rule: never import a `messages/**` file directly outside `apps/web/i18n/` (enforced by lint, Task 3).
- The rule: `@clensy/ui` MUST NOT import `next-intl` or hold a Clensy message catalog — callers translate, `@clensy/ui` renders translated strings.
- Documented (not implemented) contracts for future work, per spec §4.5–§4.6: the `{ field, rule, params }` structured-validation-error shape validation.json is meant to compose with (#51), and the `normalizeApiError` flow (`API error → stable error metadata when available → rule key → validation.<rule>`, falling back to a generic `common.errors.requestFailed` string that does not yet exist in the catalog).

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): document the next-intl catalog and key conventions"
```

---

### Task 7: Full verification and golden path

**Files:** none new unless a compatibility fix surfaces (then the smallest change to the affected file).

- [ ] **Step 1: `pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`**

- [ ] **Step 2: Manual golden path (spec §6)**

1. `/login` renders the same visible English (title, field labels, button states, generic failure message on a bad login attempt) as before this plan.
2. `<html lang="en">` in the rendered page source (View Source, not DevTools-mutated DOM) — confirms it came from `getLocale()`, not a leftover literal.
3. Every `NAV_GROUPS` sidebar item shows the same visible label as before; collapse toggle `aria-label`/visible text and collapsed-item `aria-label`s are correct; opening the mobile Sheet still announces the same "Primary navigation" screen-reader title.
4. `findActiveHref` behavior unchanged: `/app/cleaners/teams` highlights Teams, not Cleaners (same as `nav-groups.test.ts`).
5. Old-path redirects in `next.config.ts` still work (spot-check one, e.g. `/customers` → `/app/customers`).
6. Signed-out `/app` still redirects to `/login` (middleware unaffected).

- [ ] **Step 3: `formatMinorUnits` regression spot check**

Confirm `apps/web/lib/format-price.ts` is untouched (`git diff` shows no changes to that file).

- [ ] **Step 4: Clean tree**

```bash
git status --short
```

Only intentional Task 1–6 files. Confirm no `next-intl` artifacts leaked into `packages/ui` or `apps/api`.

- [ ] **Step 5: Commit only if Step 1 required a fix**

```bash
git commit -m "fix(web): next-intl build/lint compatibility fix"
```

Otherwise no commit.

---

## Spec coverage

| Spec | Task |
| --- | --- |
| `next-intl` dependency, `i18n/request.ts`, message merge (§4.1) | 1, 2 |
| Single resolved locale `en`, no fallback chain (§3, §4.2) | 1, 2 |
| `<html lang>` via `getLocale()` (§4.2) | 2 |
| `NextIntlClientProvider` inherits request config (§4.1) | 2 |
| Direct-catalog-import lint guard (§4.1, §6) | 3 |
| Login PoC + generic error preserved (§4.3) | 4 |
| `NAV_GROUPS`/sidebar key-only migration, extra sidebar strings (§4.3) | 5 |
| `@clensy/ui` boundary untouched (§4.4) | none (verified by omission — no `packages/ui` edits in any task) |
| Validation contract + representative `validation.json` (§4.5) | 1 |
| API error strategy — documented only, no code (§4.6) | 6 |
| Developer docs (§4.7) | 6 |
| Catalog-integrity + rendered-component tests (§6) | 1 |
| `i18n/request.ts` runtime integration — build + manual golden path, no standalone unit test (M6 execution note) | 2, 7 |
| `getMessages()` internal-only boundary (planning decision, not spec-normative) | 1, 3 |
| Regression: middleware, redirects, `formatMinorUnits` (§6) | 7 |
| Non-goals: routing, second locale, `@clensy/ui` catalog, typed keys, `FormDialog` `'Cancel'`, float money (§7) | all (verified by omission) |

## Type consistency

- `getMessages()` — Task 1, consumed by Task 2 (`i18n/request.ts`) and Task 1's own rendered-component test
- `NavItem` / `NavGroup` (`labelKey`, no `label`) — Task 5, consumed only by `app-sidebar.tsx` (confirmed sole consumer)
- `useTranslations('auth')` — Task 4
- `useTranslations('nav')` — Task 5
