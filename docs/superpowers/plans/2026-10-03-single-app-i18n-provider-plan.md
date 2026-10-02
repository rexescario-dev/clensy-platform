# Single App-Level `ClensyI18nProvider` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-03, at `6bbe267`, by the owner, after one returned pass (Task 2 Step 5 wording, multi-line fixture). Executed natively, task by task: Task 1 → Task 2 → Task 3 → final verification. |
| Date | 2026-10-03 |
| Tracking issue | [#115](https://github.com/rexescario-dev/clensy-platform/issues/115) |
| Scope | `apps/web` (source, tests, ESLint config) and `.github/workflows/ci.yml`. No package changes. |
| Implements (Accepted) | [Single App-Level `ClensyI18nProvider` — Design](../specs/2026-10-02-single-app-i18n-provider-design.md), Status **Accepted** (M3, 2026-10-03, `31b713a`) |
| Relies on (Accepted) | [App Router i18n Architecture](../specs/2026-09-13-web-i18n-architecture-design.md); [`LoginForm` — Self-Translating UI Copy](../specs/2026-09-20-login-form-self-translating-design.md) §2 |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File layout, task grouping, order and test names below are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Any line numbers below are approximate, taken from `main` at `741693e`. |

## Gate outcomes

**M6 (2026-10-03): Complete.** Tasks 1–3 executed in order, test-first, with no rulings needed:
- `8693556`: Task 1
- `5ffb33a`: Task 2
- `fd8a98a`: Task 3

Every `Expected:` line matched, including the planned RED states:
- Task 1: the module was missing.
- Task 2: the wrapper was missing, then only the user-menu case failed.
- Task 3: the admin and bookings mounts were reported.

**M7 (2026-10-03): Approved for merge.** Basis:
- PR [#116](https://github.com/rexescario-dev/clensy-platform/pull/116), CI run [37037099101](https://github.com/rexescario-dev/clensy-platform/actions/runs/37037099101): Lint (including the new `Type-check apps/web` step), Test and Release gate all passed.
- An independent whole-branch review found 0 Critical, 0 Important and 3 Minor. The reviewer:
  - ran `next build` on a clean checkout (16/16 routes prerendered);
  - checked server-side rendering with `next start` + curl: `/app/admin` renders `staff` copy through the boundary, and `/login` is unchanged;
  - confirmed with deliberate code changes that each test fails when it should: removing the locale prop fails the locale test, removing the overrides prop fails all three override tests, deleting an `@ts-expect-error` fails tsc (TS2353), and adding a second mount fails the single-mount guard.
- Plan conformance: Tasks 1–3 ✓, nothing deferred or missing, no extra changes. Spec conformance: §4.1–§4.5 and §6.1–§6.3 ✓. No changes under `packages/` or the catalogs.

**Deferred minors** (each within spec §6.1, which defines the guard as syntactic over `.ts`/`.tsx`):
1. The guard skips `.js`/`.jsx` files, although `allowJs` is on.
2. A re-export barrel of `ClensyI18nProvider` from `@clensy/web` bypasses the syntactic guard.
3. The layout-wiring test identifies `DashboardLayout` by its tag name, not by its import path.

**Declined to judge, ruled out of scope:**
- `React.createElement` or reassigned-variable mounts (outside §6.1's definition of a mount).
- Tenant-sourced overrides and a second locale (§7, §8).
- The bookings page's hard-coded copy (§2).

**Not run:** the manual browser smoke test with real API data.

**M8 (2026-10-03): N/A.**
- Scope: the #115 change set (`apps/web` boundary, overrides module, the three former call sites, tests, CI step).
- The change is small and already minimal. `AppI18nProvider` is a 5-line wrapper, and the override module is a single constant.
- The AST helpers live next to the only test that uses them.
- The three deferred minors would strengthen the tests (more coverage), not restructure existing code, so they are not M8 work.
- No behaviour-preserving restructuring is worth its risk here.

**M9 (2026-10-03): Complete.** Documentation scope:
- `apps/web/README.md` § i18n: a new paragraph describing the shipped app i18n boundary. Caused by Tasks 2–3.
- The spec's Tracking cell: a link to PR #116. Caused by the PR being opened.
- This section. Caused by the M6–M9 gate outcomes.

`packages/web/README.md` already says that apps/web resolves the locale and passes it to `ClensyI18nProvider`, and that one app-level `roles` override changes a label wherever it is read. Both statements are still accurate, so the package docs are unchanged. Historical plans (#88/#89) are left as the record of their own slices.

**M10 (2026-10-03): Accepted (workflow validated).** Subject: the installed workflow prompt library (`docs/workflows/`, generic 1.2.0), validated against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran the whole workflow on #115 from start to finish.

Asset inventory:
- `prompts/`: `specification` M2, `design-review` M3, `implementation-planning` M4, `plan-review` M5, `implementation-execution` M6, `code-review` M7, `refactoring` M8, `documentation-execution` M9, `workflow-validation` M10.
- `conventions/`: `prompt-library` M1, `reporting-conventions` (§2.11).
- `specs/agent-workflow-design.md`: the governing contract.

Checks:
- Each prompt cites the governing contract and declares exactly one stage. There are no orphan assets.
- Every link in the README stage map and between prompts resolves.
- The M5→M6 hard prerequisite is stated in both the process spec (§2.5) and the M6 prompt.
- The provider rule (`prompt-library.md` §12) is present and was honoured: GitHub for the issue, the branch and the PR.

Blocking findings: none. The full M2→M9 path was executed for #115 using only these assets.

Non-blocking observations:
1. M10's output ("validation report, path recorded") has no conventional location, and the managed `docs/workflows/**` tree must not be edited. This report is therefore kept in the slice plan, the same place M7 outcomes are recorded.
2. `code-review.md` does not say whether the M7 reviewer must be independent of the M6 implementer. Here the M7 record was written by the implementer, based on an independent whole-branch review.
3. The merge in §2.12 closeout and M10 in §2.6 have no stated order between them. This slice ran M10 before the human-authorized merge.

**Goal:** Replace `apps/web`'s three per-component `ClensyI18nProvider` mounts with a single app i18n boundary in `/app/layout.tsx`. The boundary is fed by next-intl's locale and a typed override module committed as `{}`.

**Architecture:** `lib/clensy-i18n-overrides.ts` exports `APP_I18N_OVERRIDES: DeepPartial<ClensyMessages> = {}`. `components/layout/app-i18n-provider.tsx` (`'use client'`) renders the only provider mount, with `useLocale()` plus that constant. `app/app/layout.tsx` wraps `DashboardLayout` in it. The user menu, admin page and bookings page drop their own providers.

**Tech Stack:**
- Next.js 16 App Router and next-intl 4
- `@clensy/web` (`ClensyI18nProvider`, `ClensyMessages`, `DeepPartial`, `useClensyI18nContext`)
- Vitest 5 with `environment: 'node'` (rendered tests use `react-dom/server`'s `renderToStaticMarkup`; there is no DOM)
- The TypeScript 5 compiler API, used for the AST guard

**Spec:** `docs/superpowers/specs/2026-10-02-single-app-i18n-provider-design.md`

## Global Constraints

Copied from the Accepted spec. Every task implicitly includes these.

- Non-test `apps/web` source SHALL contain exactly one provider mount, in `components/layout/app-i18n-provider.tsx` (§4.5 item 1).
- `apps/web/app/app/layout.tsx` SHALL mount `AppI18nProvider` around `DashboardLayout` (§4.5 item 2). The boundary SHALL NOT be moved inside `DashboardLayout` (§4.3).
- `/login` SHALL NOT be inside the boundary (§4.5 item 4).
- Application-owned override values SHALL enter `/app` only through `APP_I18N_OVERRIDES`. `AppI18nProvider` SHALL be the only application-owned provider mount (§4.5 item 5).
- `APP_I18N_OVERRIDES` SHALL be typed `DeepPartial<ClensyMessages>` and committed as `{}`. There SHALL be no runtime, build-time or environment-dependent selection of override values (§4.1, §4.5 item 6).
- The boundary's locale SHALL come from next-intl `useLocale()` (§4.5 item 7).
- `@clensy/web` and `@clensy/ui` SHALL NOT change. No package API changes (§4.5 item 8).
- `AppI18nProvider` SHALL NOT accept or forward an override value from props, context, environment variables, session state, API data or any other runtime source (§4.5 item 9).
- No translation content changes. Test-only override values live only inside test mocks (§6.2).
- Commit messages use the repo's `type(115): …` style and carry **no** `Co-Authored-By` trailer and no "Generated with" line (owner's global instruction).

## Review Focus

Failure modes the spec implies that a naïve implementation could miss. Each one has a pinning test in the task named.

1. **Locale stops reaching `@clensy/web`.** With the per-component `useLocale()` calls removed, the boundary must still forward next-intl's locale, not fall back to the package default `en`. Pinned in Task 2 with a non-`en` locale probe.
2. **A partial override wipes sibling defaults.** Overriding only `roles.FINANCE` must leave `roles.TENANT_OWNER` as `Tenant Owner`. Pinned in Task 2 (create-staff form options).
3. **A test override leaks into the committed module.** The committed `APP_I18N_OVERRIDES` must stay exactly `{}`. Pinned in Task 1 by an unmocked test in its own file (`vi.mock` is file-scoped).
4. **The AST guard miscounts.** An aliased or namespace import must count. A same-named identifier from another module, or an unrelated `X.ClensyI18nProvider`, must not. Pinned in Task 3 with source fixtures run through the detector itself.
5. **`/login` gets wrapped by accident**, for example if someone "simplifies" by moving the boundary to the root layout. Pinned in Task 3: the single-mount location assertion plus the login text guard.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/web/lib/clensy-i18n-overrides.ts` | Create | The typed, committed-`{}` application override data (§4.1) |
| `apps/web/lib/clensy-i18n-overrides.test.ts` | Create | Committed value is `{}`, plus supplemental `@ts-expect-error` type cases (§6.3) |
| `.github/workflows/ci.yml` | Modify | Add `Type-check apps/web`, so the §6.3 type cases actually run under `tsc` in CI (today only `apps/api` is type-checked) |
| `apps/web/components/layout/app-i18n-provider.tsx` | Create | `AppI18nProvider`, the only provider mount (§4.2) |
| `apps/web/app/app/layout.tsx` | Modify | Mount `AppI18nProvider` around `DashboardLayout` (§4.3) |
| `apps/web/components/layout/user-menu.tsx` | Modify | Drop its provider and merge `UserMenuContent` into `UserMenu` (§4.4) |
| `apps/web/lib/app-i18n-boundary.test.tsx` | Create | Behavioural test: one mocked override reaches all three consumers, and the locale is forwarded (§6.2) |
| `apps/web/eslint.config.mjs` | Modify | Allow the behavioural test to import `getMessages()`, the same exception `i18n-rendering.test.tsx` already has |
| `apps/web/app/app/admin/page.tsx` | Modify | Drop its provider (§4.4) |
| `apps/web/app/app/bookings/page.tsx` | Modify | Drop its provider and the now-unused `useLocale` (§4.4) |
| `apps/web/lib/web-shell-regressions.test.ts` | Modify | AST single-mount guard, layout wiring, and the secondary text guard (§6.1) |

---

### Task 1: Override module and its type contract (spec §4.1, §6.3)

**Files:**
- Create: `apps/web/lib/clensy-i18n-overrides.ts`
- Create: `apps/web/lib/clensy-i18n-overrides.test.ts`
- Modify: `.github/workflows/ci.yml` (lint job, after the `Type-check apps/api` step)

**Interfaces:**
- Consumes: `ClensyMessages`, `DeepPartial` (type exports of `@clensy/web`)
- Produces: `export const APP_I18N_OVERRIDES: DeepPartial<ClensyMessages>`, imported by Task 2 as `'../../lib/clensy-i18n-overrides'` from `components/layout/` and mocked as `'./clensy-i18n-overrides'` from `lib/`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/clensy-i18n-overrides.test.ts`:

```ts
import type { ClensyMessages, DeepPartial } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import { APP_I18N_OVERRIDES } from './clensy-i18n-overrides';

// Unmocked on purpose: vi.mock is file-scoped, so the behavioural test's
// test-only override can never reach this file (spec §4.1, §6.2).
describe('APP_I18N_OVERRIDES', () => {
  it('is committed as {} — the application has no override values', () => {
    expect(APP_I18N_OVERRIDES).toEqual({});
  });
});

// Spec §6.3: the annotation on APP_I18N_OVERRIDES is the primary type
// contract. These supplemental cases confirm the same exported types reject
// representative invalid shapes. They are checked by `tsc` (CI "Type-check
// apps/web"), not by Vitest — an unused @ts-expect-error is itself an error.
// @ts-expect-error unknown namespace
export const unknownNamespace: DeepPartial<ClensyMessages> = { notANamespace: {} };
// @ts-expect-error unknown key path inside a known namespace
export const unknownKey: DeepPartial<ClensyMessages> = { roles: { NOT_A_ROLE: 'x' } };
// @ts-expect-error wrong leaf value type
export const wrongValueType: DeepPartial<ClensyMessages> = { roles: { FINANCE: 42 } };
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter web exec vitest run lib/clensy-i18n-overrides.test.ts`
Expected: FAIL. The import of `./clensy-i18n-overrides` fails to resolve.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/lib/clensy-i18n-overrides.ts`:

```ts
import type { ClensyMessages, DeepPartial } from '@clensy/web';

// Application-owned overrides for the app i18n boundary (single app i18n
// provider spec §4.1). Committed as `{}`: the application has no override
// values. Tests replace this module with vi.mock; nothing selects values at
// runtime, at build time or by environment. Tenant-sourced labels are a
// separate, future spec (§8).
export const APP_I18N_OVERRIDES: DeepPartial<ClensyMessages> = {};
```

- [ ] **Step 4: Add the `apps/web` type-check to CI**

First confirm the precondition still holds: `grep -n "tsc" .github/workflows/ci.yml` should show only `pnpm --filter api exec tsc --noEmit`, in the `lint` job. If `apps/web` is already type-checked anywhere in CI, skip this step's edit and record that in the M6 report.

In `.github/workflows/ci.yml`, directly after the `Type-check apps/api` step in the `lint` job, add:

```yaml
      # Vitest does not type-check, and CI does not run `next build`, so this
      # is the only check of type errors in `apps/web`, including the
      # override type contract's @ts-expect-error lines (#115).
      - name: Type-check apps/web
        run: pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 5: Run the test, type-check and lint, and confirm they pass**

Run: `pnpm --filter web exec vitest run lib/clensy-i18n-overrides.test.ts`
Expected: PASS (1 test).

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0. A pre-plan probe on 2026-10-03 confirmed that all three `@ts-expect-error` cases are real errors under `DeepPartial<ClensyMessages>`, so none of the directives is unused.

Run: `pnpm --filter web lint`
Expected: exit 0.

Run: `python3 -c "import yaml; steps = yaml.safe_load(open('.github/workflows/ci.yml'))['jobs']['lint']['steps']; print([s.get('name') or s.get('run') or s.get('uses') for s in steps])"`
Expected: the YAML parses, and the printed `lint` job steps end with `'Type-check apps/api', 'Type-check apps/web'`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/clensy-i18n-overrides.ts apps/web/lib/clensy-i18n-overrides.test.ts .github/workflows/ci.yml
git commit -m "feat(115): add the typed app i18n override module, committed as {}"
```

---

### Task 2: `AppI18nProvider`, layout mount, and the user menu (spec §4.2–§4.4, §6.2)

**Files:**
- Create: `apps/web/components/layout/app-i18n-provider.tsx`
- Create: `apps/web/lib/app-i18n-boundary.test.tsx`
- Modify: `apps/web/app/app/layout.tsx`
- Modify: `apps/web/components/layout/user-menu.tsx` (the `@clensy/web` and `next-intl` imports, and the `UserMenu` wrapper / `UserMenuContent` declaration)
- Modify: `apps/web/eslint.config.mjs` (the `ignores` list of the `no-restricted-imports` block and its comment)

**Interfaces:**
- Consumes: `APP_I18N_OVERRIDES` (Task 1)
- Produces: `export function AppI18nProvider({ children }: { children: ReactNode })` from `components/layout/app-i18n-provider.tsx`. It has no other props. Task 3's layout-wiring guard looks for this exact name and import path.

- [ ] **Step 1: Allow the behavioural test to load the real catalog**

In `apps/web/eslint.config.mjs`, change the exception comment and list:

```js
    // `lib/i18n-rendering.test.tsx` and `lib/app-i18n-boundary.test.tsx` are
    // the deliberate exceptions outside `i18n/**`: they render through the
    // real getMessages() -> NextIntlClientProvider path (i18n spec §6; single
    // app i18n provider spec §6.2) and must import getMessages directly.
    ignores: ['i18n/**', 'lib/i18n-rendering.test.tsx', 'lib/app-i18n-boundary.test.tsx'],
```

- [ ] **Step 2: Write the failing behavioural test**

Create `apps/web/lib/app-i18n-boundary.test.tsx`:

```tsx
import { CreateStaffForm, StaffDataTable, useClensyI18nContext } from '@clensy/web';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { ShellChrome } from '../components/layout/shell-chrome';
import { UserMenu } from '../components/layout/user-menu';
import { getMessages } from '../i18n/messages';

// Spec §6.2: the overrides module must be mocked before AppI18nProvider is
// evaluated, or the committed `{}` could be captured. Vitest hoists this
// vi.mock call ahead of the static imports, which guarantees that ordering.
// The committed module is unchanged (pinned unmocked in
// clensy-i18n-overrides.test.ts).
vi.mock('./clensy-i18n-overrides', () => ({
  APP_I18N_OVERRIDES: { roles: { FINANCE: 'Billing' } },
}));

// UserMenu's data and navigation dependencies, mocked: this test is about the
// i18n boundary, not GraphQL or routing.
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ clearStore: vi.fn() }),
}));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => ({
    data: { currentAdmin: { id: 'admin-1', role: 'FINANCE', scope: 'TENANT' } },
    loading: false,
  }),
  useLogoutMutation: () => [vi.fn(), { loading: false }],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function renderInBoundary(node: ReactNode, locale = 'en') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={getMessages()}>
      <AppI18nProvider>{node}</AppI18nProvider>
    </NextIntlClientProvider>,
  );
}

function LocaleProbe() {
  return <span data-testid="locale">{useClensyI18nContext().locale}</span>;
}

describe('app i18n boundary', () => {
  it('applies the app-wide role override in the user menu', () => {
    const html = renderInBoundary(
      <ShellChrome>
        <UserMenu />
      </ShellChrome>,
    );
    // The role label renders as the text of an element (the trigger's label
    // span); match it as element text, not as a bare substring.
    expect(html).toMatch(/>Billing<\/span>/);
    expect(html).not.toMatch(/>Finance</);
  });

  it('applies the same override in the staff table', () => {
    const html = renderInBoundary(
      <StaffDataTable
        staff={[{ id: 'staff-1', email: 'finance@example.com', isActive: true, role: 'FINANCE' }]}
        currentAdminId="admin-1"
        onDisable={() => {}}
      />,
    );
    expect(html).toMatch(/>Billing</);
    expect(html).not.toMatch(/>Finance</);
  });

  it('applies the same override in the create-staff form and keeps sibling defaults', () => {
    const html = renderInBoundary(
      <CreateStaffForm values={{ email: '', password: '', role: 'CUSTOMER_SUPPORT' }} onChange={() => {}} />,
    );
    expect(html).toContain('<option value="FINANCE">Billing</option>');
    expect(html).not.toContain('>Finance<');
    expect(html).toContain('<option value="TENANT_OWNER">Tenant Owner</option>');
  });

  it("forwards next-intl's locale to @clensy/web rather than the package default", () => {
    expect(renderInBoundary(<LocaleProbe />, 'fil')).toContain('>fil</span>');
  });
});
```

Mock ordering is the requirement; the mechanism is flexible. If this file's mocks ever need shared state, use `vi.hoisted`. If static imports ever stop being enough, switch to `const { AppI18nProvider } = await import('../components/layout/app-i18n-provider')` inside the tests. Either way, the overrides module must be mocked before `AppI18nProvider` is evaluated.

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm --filter web exec vitest run lib/app-i18n-boundary.test.tsx`
Expected: FAIL. `../components/layout/app-i18n-provider` does not exist.

- [ ] **Step 4: Create `AppI18nProvider`**

Create `apps/web/components/layout/app-i18n-provider.tsx`:

```tsx
'use client';

import { ClensyI18nProvider } from '@clensy/web';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';

import { APP_I18N_OVERRIDES } from '../../lib/clensy-i18n-overrides';

// The app i18n boundary (single app i18n provider spec §3, §4.2): the one
// application-owned ClensyI18nProvider mount, placed by app/app/layout.tsx.
// The locale comes only from next-intl, and application-owned overrides only
// from APP_I18N_OVERRIDES. There is deliberately no overrides/locale prop
// (§4.5 item 9).
export function AppI18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <ClensyI18nProvider locale={locale} overrides={APP_I18N_OVERRIDES}>
      {children}
    </ClensyI18nProvider>
  );
}
```

- [ ] **Step 5: Run the test and confirm the user-menu case still fails**

Run: `pnpm --filter web exec vitest run lib/app-i18n-boundary.test.tsx`
Expected:
- The test mounts `AppI18nProvider` directly. It does not depend on the route layout, which is still unchanged until Step 7.
- The staff table, create-staff form and locale cases PASS.
- `applies the app-wide role override in the user menu` FAILS: the user menu renders `Finance`. `UserMenu`'s own nested provider overrides the outer test boundary. This is the drift problem #115 describes; a pre-plan probe on 2026-10-03 confirmed it.

- [ ] **Step 6: Remove the user menu's own provider**

In `apps/web/components/layout/user-menu.tsx`:

Change the `@clensy/web` import from
```tsx
import { ClensyI18nProvider, useClensyTranslations } from '@clensy/web';
```
to
```tsx
import { useClensyTranslations } from '@clensy/web';
```

Change the `next-intl` import from
```tsx
import { useLocale, useTranslations } from 'next-intl';
```
to
```tsx
import { useTranslations } from 'next-intl';
```

Replace the comment, the `UserMenu` wrapper and the `UserMenuContent` declaration:
```tsx
// Role labels come from @clensy/web's shared `roles` namespace (the same
// labels as the staff console); the menu's own copy from apps/web's
// `nav.userMenu`.
export function UserMenu() {
  const locale = useLocale();
  return (
    <ClensyI18nProvider locale={locale}>
      <UserMenuContent />
    </ClensyI18nProvider>
  );
}

function UserMenuContent() {
```
with
```tsx
// Role labels come from @clensy/web's shared `roles` namespace (the same
// labels as the staff console), resolved through the app i18n boundary that
// app/app/layout.tsx mounts; the menu's own copy from apps/web's
// `nav.userMenu`.
export function UserMenu() {
```

The rest of the former `UserMenuContent` body stays exactly as it is.

- [ ] **Step 7: Mount the boundary in the `/app` layout**

In `apps/web/app/app/layout.tsx`, change the imports from
```tsx
import type { ReactNode } from 'react';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
```
to
```tsx
import type { ReactNode } from 'react';
import { AppI18nProvider } from '../../components/layout/app-i18n-provider';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
```

Then replace
```tsx
export default function AppLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
```
with
```tsx
//
// `AppI18nProvider` is the app i18n boundary (single app i18n provider spec
// §4.3): the one ClensyI18nProvider for all of `/app`, deliberately wrapping
// DashboardLayout (which itself consumes nothing) so the header's user menu
// and every page share it. `/login` stays outside it.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppI18nProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AppI18nProvider>
  );
}
```

The new `//` lines continue the existing header comment block directly above the function.

- [ ] **Step 8: Run the tests, type-check and lint, and confirm they pass**

Run: `pnpm --filter web exec vitest run lib/app-i18n-boundary.test.tsx`
Expected: PASS (4 tests).

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: exit 0.

Run: `pnpm --filter web test`
Expected: PASS except `web-shell-regressions` › `presents identity through @clensy/web roles…`, which still checks `user-menu.tsx` for `<ClensyI18nProvider`. Task 3 replaces that assertion. This is the only failure allowed at this point.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/layout/app-i18n-provider.tsx apps/web/lib/app-i18n-boundary.test.tsx apps/web/app/app/layout.tsx apps/web/components/layout/user-menu.tsx apps/web/eslint.config.mjs
git commit -m "feat(115): mount the app i18n boundary in /app and drop the user menu's provider"
```

---

### Task 3: Remove the remaining mounts and add the structural guard (spec §4.4, §4.5, §6.1)

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: the `node:fs` / `node:path` / `vitest` imports, the `presents identity…` case, and a new `describe` block at the end of the file
- Modify: `apps/web/app/app/admin/page.tsx` (the `@clensy/web` and `next-intl` imports, the wrapper `AdminPage`, and the `StaffAdminGate` declaration)
- Modify: `apps/web/app/app/bookings/page.tsx` (the `@clensy/web` and `next-intl` imports, the `useLocale()` call in `BookingsPageContent`, and the wrapper around `BookingDataTable`)

**Interfaces:**
- Consumes: `AppI18nProvider` and its path `components/layout/app-i18n-provider` (Task 2)
- Produces: none for later tasks. The detector helpers stay local to the test file and are not exported.

- [ ] **Step 1: Write the failing structural guard**

In `apps/web/lib/web-shell-regressions.test.ts`:

Replace the three import lines at the top of the file
```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
```
with
```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
```

In `it('presents identity through @clensy/web roles and accountIdentity, with no hard-coded copy', …)`, delete this one line and keep every other assertion:
```ts
    expect(userMenu).toContain('<ClensyI18nProvider');
```

Append at the end of the file, after the final `});` of `describe('web shell regressions', …)`:

```ts
// Single app i18n provider spec §6.1. Syntactic import resolution, limited to
// `import` declarations whose module specifier is exactly '@clensy/web'.
const SKIPPED_DIRS = new Set(['node_modules', '.next']);

function parseTsx(fileName: string, text: string) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function clensyProviderBindings(source: ts.SourceFile) {
  const named = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@clensy/web') continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
      continue;
    }
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === 'ClensyI18nProvider') named.add(element.name.text);
    }
  }
  return { named, namespaces };
}

function countProviderMounts(fileName: string, text: string): number {
  const source = parseTsx(fileName, text);
  const { named, namespaces } = clensyProviderBindings(source);
  const isProviderTag = (tag: ts.JsxTagNameExpression) =>
    ts.isIdentifier(tag)
      ? named.has(tag.text)
      : ts.isPropertyAccessExpression(tag) &&
        ts.isIdentifier(tag.expression) &&
        namespaces.has(tag.expression.text) &&
        tag.name.text === 'ClensyI18nProvider';
  let count = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isProviderTag(node.tagName)) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

function nonTestSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : nonTestSources(path);
    const isSource = /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts');
    return isSource && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('app i18n boundary structure', () => {
  describe('provider-mount detector', () => {
    it.each([
      ['a named import', "import { ClensyI18nProvider } from '@clensy/web';\nconst x = <ClensyI18nProvider>a</ClensyI18nProvider>;", 1],
      ['an aliased import', "import { ClensyI18nProvider as P } from '@clensy/web';\nconst x = <P />;", 1],
      ['a namespace import', "import * as W from '@clensy/web';\nconst x = <W.ClensyI18nProvider>a</W.ClensyI18nProvider>;", 1],
      [
        'a multi-line opening element',
        "import { ClensyI18nProvider } from '@clensy/web';\nconst x = (\n  <ClensyI18nProvider\n    locale=\"en\"\n  >\n    a\n  </ClensyI18nProvider>\n);",
        1,
      ],
      ['a same-named import from another module', "import { ClensyI18nProvider } from './local';\nconst x = <ClensyI18nProvider />;", 0],
      ['an unrelated property access', "const Other = { ClensyI18nProvider: () => null };\nconst x = <Other.ClensyI18nProvider />;", 0],
      ['an import that is never rendered', "import { ClensyI18nProvider } from '@clensy/web';\nexport { ClensyI18nProvider };", 0],
    ])('counts %s correctly', (_label, source, expected) => {
      expect(countProviderMounts('fixture.tsx', source)).toBe(expected);
    });
  });

  it('has exactly one provider mount in apps/web, in app-i18n-provider.tsx', () => {
    const mounts = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), count: countProviderMounts(path, readFileSync(path, 'utf8')) }))
      .filter(({ count }) => count > 0);

    // Fails on the wrong location as well as the wrong count.
    expect(mounts).toEqual([{ file: 'components/layout/app-i18n-provider.tsx', count: 1 }]);
  });

  it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', () => {
    const layout = parseTsx('layout.tsx', readWebSource('app/app/layout.tsx'));

    const imported = layout.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === '../../components/layout/app-i18n-provider' &&
        statement.importClause?.namedBindings !== undefined &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        statement.importClause.namedBindings.elements.some((element) => element.name.text === 'AppI18nProvider'),
    );
    expect(imported).toBe(true);

    const boundaries: ts.JsxElement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && ts.isIdentifier(node.openingElement.tagName) && node.openingElement.tagName.text === 'AppI18nProvider') {
        boundaries.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(layout);
    expect(boundaries).toHaveLength(1);

    const children = boundaries[0].children.filter((child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces));
    expect(children).toHaveLength(1);
    const [child] = children;
    expect(ts.isJsxElement(child) && ts.isIdentifier(child.openingElement.tagName) && child.openingElement.tagName.text).toBe(
      'DashboardLayout',
    );
  });

  // Secondary text guard; the AST check above is the primary one.
  it.each(['components/layout/user-menu.tsx', 'app/app/admin/page.tsx', 'app/app/bookings/page.tsx', 'app/login/page.tsx'])(
    'keeps %s free of ClensyI18nProvider',
    (file) => {
      expect(readWebSource(file)).not.toContain('ClensyI18nProvider');
    },
  );
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected:
- The detector fixtures and the layout-wiring case PASS.
- `has exactly one provider mount…` FAILS. `mounts` also lists `app/app/admin/page.tsx` and `app/app/bookings/page.tsx`.
- The text guard FAILS for `app/app/admin/page.tsx` and `app/app/bookings/page.tsx`.

- [ ] **Step 3: Remove the admin page's provider**

In `apps/web/app/app/admin/page.tsx`:

In the multi-line `@clensy/web` import, delete the line `  ClensyI18nProvider,`.

Delete the `next-intl` import:
```tsx
import { useLocale } from 'next-intl';
```

Replace the comment and wrapper `AdminPage`, then the `StaffAdminGate` comment and declaration:
```tsx
// Staff copy (page, table, form, errors) comes from @clensy/web's `staff`
// namespace, as LoginForm owns its copy; this route only composes, wires
// GraphQL and routes (multi-tenant spec §4.8).
export default function AdminPage() {
  const locale = useLocale();
  return (
    <ClensyI18nProvider locale={locale}>
      <StaffAdminGate />
    </ClensyI18nProvider>
  );
}

// Spec §4.1 (Admin Foundation): `middleware.ts` only checks that the session
// cookie is present, not that it's still valid — an expired, invalid, or
// disabled-account session lands here, where the guarded `currentAdmin`
// surfaces it as an error (or a missing `currentAdmin`) and we send the user
// back to `/login`. `canManageStaff` is a UX nicety only — the API
// independently enforces Tenant-Owner-only, same-tenant access on
// `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
function StaffAdminGate() {
```
with
```tsx
// Staff copy (page, table, form, errors) comes from @clensy/web's `staff`
// namespace, as LoginForm owns its copy, resolved through the app i18n
// boundary that app/app/layout.tsx mounts; this route only composes, wires
// GraphQL and routes (multi-tenant spec §4.8).
//
// Spec §4.1 (Admin Foundation): `middleware.ts` only checks that the session
// cookie is present, not that it's still valid — an expired, invalid, or
// disabled-account session lands here, where the guarded `currentAdmin`
// surfaces it as an error (or a missing `currentAdmin`) and we send the user
// back to `/login`. `canManageStaff` is a UX nicety only — the API
// independently enforces Tenant-Owner-only, same-tenant access on
// `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
export default function AdminPage() {
```

The body of the former `StaffAdminGate` and `StaffConsole` stay unchanged.

- [ ] **Step 4: Remove the bookings page's provider**

In `apps/web/app/app/bookings/page.tsx`:

Change the `@clensy/web` import from
```tsx
import { BookingDataTable, ClensyI18nProvider, type Booking } from '@clensy/web';
```
to
```tsx
import { BookingDataTable, type Booking } from '@clensy/web';
```

Delete `import { useLocale } from 'next-intl';` and, in `BookingsPageContent`, `  const locale = useLocale();`. Before deleting, run `grep -n "locale\|next-intl" apps/web/app/app/bookings/page.tsx`. It should show only those two lines and the `<ClensyI18nProvider locale={locale}>` wrapper (about lines 30, 72 and 191 on `741693e`). If anything else uses them, keep the import and report it.

Replace the wrapper around `BookingDataTable`:
```tsx
      <ClensyI18nProvider locale={locale}>
        <BookingDataTable
          …unchanged props…
        />
      </ClensyI18nProvider>
```
with the same `<BookingDataTable … />` element and the same props, dedented by two spaces so it sits directly under `<div className="flex flex-col gap-8">`:
```tsx
      <BookingDataTable
        …unchanged props, each line dedented by two spaces…
      />
```

- [ ] **Step 5: Run all `apps/web` checks and confirm they pass**

Run: `pnpm --filter web test`
Expected: PASS, every file, including all of `web-shell-regressions`, `app-i18n-boundary` and `clensy-i18n-overrides`.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts apps/web/app/app/admin/page.tsx apps/web/app/app/bookings/page.tsx
git commit -m "feat(115): remove the admin and bookings providers and pin the single app i18n boundary"
```

---

## Final verification (before the M6 handoff report)

- [ ] `pnpm run lint`: exit 0 across the monorepo.
- [ ] `pnpm run test`: exit 0 across the monorepo. `@clensy/web` package tests are unchanged and pass (spec §6.4).
- [ ] `pnpm --filter web exec tsc --noEmit` and `pnpm --filter api exec tsc --noEmit`: both exit 0, the same as the CI lint job.
- [ ] `git diff main --name-only -- packages/`: no output. No `@clensy/web` or `@clensy/ui` change (§4.5 item 8).
- [ ] `git diff main --name-only -- apps/web/messages/ packages/web/src/i18n/messages/`: no output. No translation content change. (The `packages/` check above already covers the package catalog; this names both catalogs explicitly.)
- [ ] Manual smoke test, if the dev stack is available (`pnpm --filter web dev`): `/app` shows the role label in the user menu; `/app/admin` shows staff roles; `/app/bookings` renders its table; `/login` renders unchanged.

## Traceability

| Spec section | Task |
| --- | --- |
| §4.1 override module, committed `{}` | Task 1 |
| §4.2 `AppI18nProvider` (no override prop, `useLocale()`) | Task 2 |
| §4.3 `/app/layout.tsx` wraps `DashboardLayout` | Task 2, pinned in Task 3 |
| §4.4 remove the user-menu mount | Task 2 |
| §4.4 remove the admin and bookings mounts | Task 3 |
| §4.5 items 1–3, 5 (single mount, location, no others) | Task 3 AST guard |
| §4.5 item 4 (`/login` outside) | Task 3 location assertion and text guard |
| §4.5 items 6, 9 (committed `{}`, no runtime source) | Task 1, plus Task 2's prop-less signature |
| §4.5 item 7 (next-intl locale) | Task 2 locale probe |
| §4.5 item 8 (packages untouched) | Final verification |
| §6.1 structural | Task 3 |
| §6.2 behavioural, with hoisted mock before evaluation | Task 2 |
| §6.3 type-level, under `tsc` in CI | Task 1 (CI step plus the type cases) |

## Deferred (not in this plan)

- Tenant- or API-sourced overrides (spec §8).
- The bookings page's hard-coded copy, `title="Bookings"` and others (spec §2 out of scope).

## Execution risks (operational only)

- `.github/workflows/ci.yml` gains a `Type-check apps/web` step. Spec §6.3 requires the type cases to run "under `apps/web`'s `tsc` in CI", but CI type-checks only `apps/api` today, so this step is how the spec requirement is met, not new scope. `apps/web` type-checks cleanly on `main` as of 2026-10-03 (exit 0), so the step should not surface unrelated failures.
