# Role-Aware Typed URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft (revised after first M5 pass) |
| M5 history | First pass (2026-10-04) returned one required clarification and two wording fixes, all applied without changing the approach. **Required:** Task 2 states that ungated means the rendering decision does not depend on the `currentAdmin` result, not that the hook is skipped (the hook runs unconditionally, per spec §4.2 and the rules of hooks). A new test proves that no query state changes an ungated path's rendering. **Wording:** the query-call test is renamed to what it observes (`calls useCurrentAdminQuery with no options`). Final verification's out-of-scope diff now includes `apps/web/middleware.ts`. **Kept, with reason:** Task 1's private helper order (`isPlatformPath`, `segmentMatches`) is alphabetical, as `docs/conventions/javascript/README.md` § Function order requires ("each group by name"); the plan now quotes that rule. |
| Date | 2026-10-04 |
| Tracking issue | [#114](https://github.com/rexescario-dev/clensy-platform/issues/114) |
| Scope | `apps/web` (`lib/nav-groups.ts`, a new layout component, `app/app/layout.tsx`, `app/app/admin/page.tsx`, `lib/staff-console.ts`, `messages/en/nav.json`, tests). `packages/web` (one message key removed). No `apps/api`, `packages/client` or `packages/ui` changes. |
| Implements (Accepted) | [Role-Aware Experience for Typed URLs of Role-Hidden Pages — Design](../specs/2026-10-04-role-aware-typed-urls-design.md), Status **Accepted** (M3, 2026-10-04, `4d1d4c0`) |
| Relies on (Accepted) | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.8, §5 invariant 13; [Web Shell and Design System](../specs/2026-09-10-web-shell-and-design-system-design.md); [Single App-Level `ClensyI18nProvider`](../specs/2026-10-02-single-app-i18n-provider-design.md); [`@clensy/ui` Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md) |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File layout, task grouping, order, helper names, test names and CSS classes below are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. The branch base is `fb12aea` (`main`); the spec commits on top do not touch code. |
| Pre-validation | See the end of this header section. |

**Goal:** Deliver spec §4.1–§4.5. Pure `isGatedPath` / `canViewPath` rules derived from `NAV_GROUPS` and `PLATFORM_HOME_HREF`, one cache-first `PageVisibilityGate` in the `/app` layout rendering a shared "This page isn't available to you." state, and the retirement of `canManageStaff` and `staff.page.notAuthorized`.

**Architecture:**

- **Rules (`lib/nav-groups.ts`).** Two pure exports sit next to the existing `visibleNavGroups` / `landingHref`. A private `segmentMatches(pathname, href)` becomes the one definition of a segment match, shared by `findActiveHref` (unchanged behavior) and the platform-path check.
- **Gate (`components/layout/page-visibility-gate.tsx`).** It calls its three hooks unconditionally, as the rules of hooks require. "Ungated" means the *rendering decision* ignores the `currentAdmin` result. It does not mean the query hook is skipped: on an ungated path `useCurrentAdminQuery()` still runs its normal cache/network behavior (the same shared read the sidebar makes), and its result is not consulted (spec §4.2 Inputs). It then decides in the spec's row order:
  - ungated → `children`;
  - principal present → `children` or the unavailable state;
  - no principal: error → `children`, loading → `LoadingState`, otherwise → `children`.
  
  The unavailable state is a module-local component composing `@clensy/ui`'s `EmptyState` and `next/link`.
- **Mount.** `app/app/layout.tsx` wraps `{children}` in the gate inside `DashboardLayout`.
- **Retirement.** The admin page loses its `canManageStaff` branch. The helper, its test, and the `notAuthorized` key are deleted.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Apollo Client 3 (`@clensy/client` generated hooks), next-intl 4, Vitest 5 in the `node` environment with `react-dom/server` `renderToStaticMarkup` (the repo has no DOM test environment), and TypeScript 5.

**Spec:** [`docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md`](../specs/2026-10-04-role-aware-typed-urls-design.md). Executors read both.

**Pre-validation (full).** Before M5, on 2026-10-04, every code block in Tasks 1–3 was applied verbatim to a working tree at `db60664`, and every command named by an `Expected:` line in this plan ran with the stated result, including each planned RED state. The tree was then reverted.

The first pass found one gap: `pnpm --filter web lint` failed on the gate test's `getMessages()` import (`no-restricted-imports`). Task 2 Step 6 (the named ESLint exception) was added to the plan, applied verbatim, and every Task 2 and Task 3 command plus Final verification was re-run green. After the first M5 pass's revisions, Tasks 1–3 were re-applied from the revised plan text (at `b432685`) and every command below was re-run: the same RED states, then `apps/web` 482 tests, `@clensy/web` 62 tests, and every other check green. Commands run:

- `pnpm --filter web exec vitest run lib/nav-groups.test.ts lib/web-shell-regressions.test.ts`
- `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx lib/web-shell-regressions.test.ts i18n/messages.test.ts`
- `pnpm --filter web exec vitest run lib/tenant-role-regressions.test.ts lib/staff-console.test.ts`
- `pnpm --filter web test`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint`
- `pnpm --filter @clensy/web test`
- `pnpm --filter @clensy/web build`
- `pnpm --filter @clensy/web lint`
- `pnpm --filter web build`
- `git diff --stat fb12aea -- apps/api packages/client packages/ui apps/web/middleware.ts`

## Global Constraints

Copied from the Accepted spec. Every task's requirements implicitly include this section.

- `isGatedPath`, `canViewPath` and the gate are **presentation rules, not authorization**. Their comments say so, and nothing names them as authorization (spec §4.1, §5 invariant 1).
- Page visibility derives **only** from `NAV_GROUPS` and `PLATFORM_HOME_HREF`. `apps/web/lib/nav-groups.ts` stays the only non-test `apps/web` source file containing `viewRoles` (§5 invariant 2).
- **Segment match** means `pathname === href || pathname.startsWith(`${href}/`)`. `findActiveHref` keeps segment-match, longest-match semantics (§3, §5 invariant 11).
- `PLATFORM_HOME_HREF` is reserved: it segment-matches no `NAV_GROUPS` href, and none segment-matches it (§5 invariant 9).
- The gate uses `useCurrentAdminQuery()` with **no arguments**: the default cache-first policy, never `fetchPolicy` (§4.2, §5 invariant 4).
- Ungated paths (`/app`, unknown/unlisted, and `''` for a `null` pathname) render `children` without waiting on principal data (§4.2 row 0, §5 invariant 10). The gate still calls `useCurrentAdminQuery()` there, unconditionally, as the rules of hooks require (§4.2 Inputs). Its loading, error and data states simply do not affect what an ungated path renders.
- **Not mounted** means the page component's function body never runs, so its hooks and queries never execute (§3, §5 invariant 5).
- The gate never redirects, never routes to `/login`, and never inspects API errors. With no principal on a gated path it passes `children` through, except while loading (§4.2 rows 3–5, §5 invariant 6).
- The gate is mounted exactly once, in `app/app/layout.tsx`, directly inside `DashboardLayout` (§5 invariant 7).
- Copy, verbatim: `nav.unavailable.message` = `This page isn't available to you.`, and `nav.unavailable.action` = `Go to your home page`. The loading row reuses `nav.landing.loading`. No other key is added (§4.4).
- The recovery link targets `landingHref(principal)` only, and is omitted when that is `undefined` (§4.3, §5 invariant 8).
- No API, middleware, sidebar, header, user menu, `landingTarget`, or `findActiveHref` behavior changes (§2 out of scope).

## Review Focus

The inputs and conditions the spec implies that are most likely to bite a real user, each pinned by a test in the owning task:

1. **A query error while a stale cached principal is present.** Apollo can return both `data` and `error`. The gate must still decide from the principal (rows 1–2), not pass a denied page through. Pinned in Task 2 ("decides from a cached principal even when the query also reports an error").
2. **`usePathname()` returning `null`.** This happens in some render contexts. It must be treated as `''`, which is ungated, so the page mounts rather than the gate throwing or showing loading. Pinned in Task 2 (the ungated `it.each` includes `null`).
3. **A trailing slash or deep link under a gated page**, for example `/app/admin/` or `/app/customers/123`. The same rule as the page applies, so a `FINANCE` deep link to a customer is still denied. Pinned in Task 1 (systematic `${href}/nested`) and Task 2 (`/app/customers/123`).
4. **Look-alike paths that only share a string prefix**, for example `/app/customers-old` or `/app/platformx`. These must be ungated, never denied. Pinned in Task 1.
5. **The denied state must not leak the page's data request** while the principal is still loading. Pinned in Task 2 (the loading test asserts the probe's query hook was never called).

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/web/lib/nav-groups.ts` | Add `canViewPath`, `isGatedPath`, and private `isPlatformPath` / `segmentMatches`; `findActiveHref` uses `segmentMatches` | 1 |
| `apps/web/lib/nav-groups.test.ts` | Segment characterization, `isGatedPath`, `canViewPath` matrix, reserved path | 1 |
| `apps/web/lib/web-shell-regressions.test.ts` | `viewRoles` single-source regression (Task 1); gate mount and cache-first regressions (Task 2) | 1, 2 |
| `apps/web/messages/en/nav.json` | Add `unavailable` | 2 |
| `apps/web/i18n/messages.test.ts` | Pin the `nav.unavailable` copy | 2 |
| `apps/web/components/layout/page-visibility-gate.tsx` | **Create** | 2 |
| `apps/web/lib/page-visibility-gate.test.tsx` | **Create**: gate behavior tests | 2 |
| `apps/web/app/app/layout.tsx` | Mount the gate | 2 |
| `apps/web/eslint.config.mjs` | Name the gate test as a `getMessages()` exception, like the two existing rendering tests | 2 |
| `apps/web/app/app/admin/page.tsx` | Drop the `canManageStaff` branch | 3 |
| `apps/web/lib/staff-console.ts` / `staff-console.test.ts` | Remove `canManageStaff` and its test | 3 |
| `apps/web/lib/tenant-role-regressions.test.ts` | Replace the `canManageStaff(` assertion | 3 |
| `packages/web/src/i18n/messages/en/staff.ts` | Remove `page.notAuthorized` | 3 |

Each task leaves `pnpm --filter web test` green. Between Task 2 and Task 3 the admin page's `canManageStaff` branch is still present but unreachable for denied principals, because the gate decides first.

---

### Task 1: Path rules — `isGatedPath` and `canViewPath` (spec §4.1, §5 invariants 2, 3, 9, 11; §8.1)

**Files:**
- Modify: `apps/web/lib/nav-groups.ts`
- Test: `apps/web/lib/nav-groups.test.ts`, `apps/web/lib/web-shell-regressions.test.ts`

**Interfaces:**
- Consumes: the existing `NAV_GROUPS`, `PLATFORM_HOME_HREF`, `NavPrincipal`, `findActiveHref` and `visibleNavGroups` from `lib/nav-groups.ts`.
- Produces, for Task 2:
  - `export function isGatedPath(pathname: string): boolean`
  - `export function canViewPath(principal: NavPrincipal, pathname: string): boolean`
  
  Both come from `apps/web/lib/nav-groups.ts`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/lib/nav-groups.test.ts`, replace the import block:

```ts
import type { AdminScope, Role } from '@clensy/client';
import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, PLATFORM_HOME_HREF, findActiveHref, landingHref, visibleNavGroups } from './nav-groups';
```

with:

```ts
import type { AdminScope, Role } from '@clensy/client';
import { describe, expect, it } from 'vitest';
import {
  NAV_GROUPS,
  PLATFORM_HOME_HREF,
  canViewPath,
  findActiveHref,
  isGatedPath,
  landingHref,
  visibleNavGroups,
  type NavPrincipal,
} from './nav-groups';
```

After the `function visibleHrefs(...) { ... }` helper, add:

```ts
const ALL_ROLES: Role[] = ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'SUPER_ADMIN', 'TENANT_OWNER'];
const ALL_SCOPES: AdminScope[] = ['PLATFORM', 'TENANT'];

// Every role × scope pair, including the inconsistent ones (SUPER_ADMIN in
// TENANT scope), so the rules are pinned for any principal shape.
const ALL_PRINCIPALS: [string, NavPrincipal][] = ALL_ROLES.flatMap((role) =>
  ALL_SCOPES.map((scope): [string, NavPrincipal] => [`${role}/${scope}`, { role, scope }]),
);

// Paths that share only a string prefix with a shell path, plus the
// landing, an unknown path and the empty pathname: all ungated (spec §3).
const UNGATED_PATHS = ['/app', '', '/app/does-not-exist', '/app/customers-old', '/app/customers2', '/app/platformx'];

// The spec §3 segment match, restated independently of the implementation.
function segmentMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

Inside the existing `describe('findActiveHref', ...)`, after its last `it(...)`, add:

```ts
  // Characterization (already true on main): spec §4.1 makes these
  // segment-boundary semantics a contract.
  it('matches on path segments, not string prefixes', () => {
    expect(findActiveHref('/app/customers-old')).toBeUndefined();
    expect(findActiveHref('/app/customers2')).toBeUndefined();
    expect(findActiveHref('/app/cleaners/teams/x')).toBe(TEAMS);
    expect(findActiveHref('/app/catalog/add-ons/x')).toBe(ADD_ONS);
    // Beneath /app/cleaners, not a Teams match.
    expect(findActiveHref('/app/cleaners/teams-extra')).toBe(CLEANERS);
  });
```

At the end of the file, add:

```ts
describe('isGatedPath', () => {
  it.each(ALL_TENANT_HREFS)('gates %s and the paths beneath it', (href) => {
    expect(isGatedPath(href)).toBe(true);
    expect(isGatedPath(`${href}/nested`)).toBe(true);
  });

  it('gates the platform path and the paths beneath it', () => {
    expect(isGatedPath(PLATFORM_HOME_HREF)).toBe(true);
    expect(isGatedPath(`${PLATFORM_HOME_HREF}/x`)).toBe(true);
  });

  it.each(UNGATED_PATHS)('does not gate %j', (pathname) => {
    expect(isGatedPath(pathname)).toBe(false);
  });
});

describe('canViewPath', () => {
  describe.each(ALL_PRINCIPALS)('for %s', (_label, principal) => {
    it.each(ALL_TENANT_HREFS)('agrees with the sidebar on %s and on the paths beneath it', (href) => {
      const shownInSidebar = visibleHrefs(principal).includes(href);
      expect(canViewPath(principal, href)).toBe(shownInSidebar);
      expect(canViewPath(principal, `${href}/nested`)).toBe(canViewPath(principal, href));
    });

    it('views the platform path and the paths beneath it only in PLATFORM scope', () => {
      expect(canViewPath(principal, PLATFORM_HOME_HREF)).toBe(principal.scope === 'PLATFORM');
      expect(canViewPath(principal, `${PLATFORM_HOME_HREF}/x`)).toBe(principal.scope === 'PLATFORM');
    });

    it('views every ungated path', () => {
      for (const pathname of UNGATED_PATHS) expect(canViewPath(principal, pathname)).toBe(true);
    });
  });

  it('applies the Cleaners rule to /app/cleaners/teams-extra', () => {
    expect(canViewPath(tenant('CUSTOMER_SUPPORT'), '/app/cleaners/teams-extra')).toBe(false);
    expect(canViewPath(tenant('ANALYST'), '/app/cleaners/teams-extra')).toBe(true);
  });

  // Spec §4.6 worked examples.
  it('denies and allows the worked examples', () => {
    expect(canViewPath(tenant('FINANCE'), CUSTOMERS)).toBe(false);
    expect(canViewPath(tenant('FINANCE'), `${CUSTOMERS}/123`)).toBe(false);
    expect(canViewPath(tenant('CUSTOMER_SUPPORT'), TEAMS)).toBe(false);
    expect(canViewPath(tenant('OPS_MANAGER'), STAFF)).toBe(false);
    expect(canViewPath({ role: 'SUPER_ADMIN', scope: 'PLATFORM' }, BOOKINGS)).toBe(false);
    expect(canViewPath(tenant('SCHEDULER'), PLATFORM_HOME_HREF)).toBe(false);
    expect(canViewPath(tenant('TENANT_OWNER'), STAFF)).toBe(true);
    expect(canViewPath({ role: 'SUPER_ADMIN', scope: 'PLATFORM' }, PLATFORM_HOME_HREF)).toBe(true);
  });
});

describe('PLATFORM_HOME_HREF reservation', () => {
  // Spec §5 invariant 9: rule 1 (nav items) can never shadow rule 2
  // (platform path), or the reverse.
  it('neither segment-matches nor is segment-matched by any nav href', () => {
    for (const { href } of NAV_GROUPS.flatMap((group) => group.items)) {
      expect(segmentMatches(PLATFORM_HOME_HREF, href)).toBe(false);
      expect(segmentMatches(href, PLATFORM_HOME_HREF)).toBe(false);
    }
  });
});
```

In `apps/web/lib/web-shell-regressions.test.ts`, inside `describe('web shell regressions', ...)`, after the `it('keeps the platform placeholder presentational with no API calls', ...)` test, add:

```ts
  // Role-aware typed URLs spec §5 invariant 2 (characterization: holds on
  // main). Page visibility has one source; no page or gate declares roles.
  it('keeps viewRoles in lib/nav-groups.ts only', () => {
    const owners = nonTestSources(webRoot)
      .filter((path) => readFileSync(path, 'utf8').includes('viewRoles'))
      .map((path) => relative(webRoot, path));

    expect(owners).toEqual(['lib/nav-groups.ts']);
  });
```

`nonTestSources`, `readFileSync` and `relative` already exist in this file. `nonTestSources` is a hoisted function declaration further down, and it skips `node_modules` and `.next`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts lib/web-shell-regressions.test.ts`

Expected: FAIL. Every `isGatedPath` and `canViewPath` test fails with `TypeError: ... is not a function`. The existing tests, the new `findActiveHref` characterization test, the `PLATFORM_HOME_HREF reservation` test and `keeps viewRoles in lib/nav-groups.ts only` all pass, because they pin behavior that already holds.

- [ ] **Step 3: Implement the rules**

In `apps/web/lib/nav-groups.ts`, replace:

```ts
const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

export function findActiveHref(pathname: string): string | undefined {
  return ALL_HREFS.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ).reduce<string | undefined>(
```

with:

```ts
const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

// Whether the principal may be shown the page at pathname (role-aware typed
// URLs spec §4.1). A client-side presentation rule derived from the shell
// navigation policy; it does not grant, deny, or replace API authorization
// (multi-tenant spec §4.2, §5.13). A nav item path follows the sidebar, a
// platform path needs PLATFORM scope, and an ungated path (/app, or a path
// with no shell rule) is always viewable.
export function canViewPath(principal: NavPrincipal, pathname: string): boolean {
  const href = findActiveHref(pathname);
  if (href !== undefined) {
    return visibleNavGroups(principal).some((group) => group.items.some((item) => item.href === href));
  }
  if (isPlatformPath(pathname)) return principal.scope === 'PLATFORM';
  return true;
}

export function findActiveHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => segmentMatches(pathname, href)).reduce<string | undefined>(
```

Then, after the closing `}` of `findActiveHref` (the function ending in `undefined,\n  );\n}`), add:

```ts

// Whether pathname needs a visibility decision at all: a nav item path or a
// platform path (spec §4.1). /app and unknown/unlisted paths need no
// principal. Presentation only, like canViewPath.
export function isGatedPath(pathname: string): boolean {
  return findActiveHref(pathname) !== undefined || isPlatformPath(pathname);
}
```

At the end of the file, after `visibleNavGroups`, add:

```ts

// PLATFORM_HOME_HREF is a reserved non-nav shell path (spec §5 invariant 9).
function isPlatformPath(pathname: string): boolean {
  return segmentMatches(pathname, PLATFORM_HOME_HREF);
}

// The one segment-match definition (spec §3): the href itself or a path
// beneath it, never a bare string prefix (/app/customers-old is no match).
function segmentMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

The resulting top-level order follows `docs/conventions/javascript/README.md` § Function order: "`export function` … first, then module-private functions, each group by name." That gives exported `canViewPath`, `findActiveHref`, `isGatedPath`, `landingHref`, `visibleNavGroups`, then private `isPlatformPath`, `segmentMatches` (*i* before *s*).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts lib/web-shell-regressions.test.ts`
Expected: PASS, both files.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/nav-groups.ts apps/web/lib/nav-groups.test.ts apps/web/lib/web-shell-regressions.test.ts
git commit -m "feat(114): add the isGatedPath and canViewPath shell visibility rules"
```

---

### Task 2: `PageVisibilityGate`, its copy, and the layout mount (spec §4.2–§4.4; §5 invariants 4–8, 10; §8.2–§8.4)

**Files:**
- Create: `apps/web/components/layout/page-visibility-gate.tsx`
- Create: `apps/web/lib/page-visibility-gate.test.tsx`. It lives under `lib/` because `vitest.config.ts` only includes `lib/**/*.test.{ts,tsx}` and `i18n/**/*.test.ts`, as `lib/app-i18n-boundary.test.tsx` already does for layout components.
- Modify: `apps/web/messages/en/nav.json`, `apps/web/i18n/messages.test.ts`, `apps/web/app/app/layout.tsx`, `apps/web/lib/web-shell-regressions.test.ts`, `apps/web/eslint.config.mjs`

**Interfaces:**
- Consumes: `isGatedPath`, `canViewPath` (Task 1), the existing `landingHref` and `NavPrincipal` from `lib/nav-groups.ts`, `useCurrentAdminQuery` from `@clensy/client`, and `EmptyState` / `LoadingState` from `@clensy/ui`.
- Produces: `export function PageVisibilityGate({ children }: { children: ReactNode })` from `apps/web/components/layout/page-visibility-gate.tsx`. Only `app/app/layout.tsx` consumes it.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/page-visibility-gate.test.tsx`:

```tsx
import type { AdminScope, Role } from '@clensy/client';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageVisibilityGate } from '../components/layout/page-visibility-gate';
import { getMessages } from '../i18n/messages';

interface QueryState {
  data?: { currentAdmin: { id: string; role: Role; scope: AdminScope } | null };
  error?: Error;
  loading: boolean;
}

// Mutable inputs for the mocked hooks below. vi.hoisted makes them exist
// before the hoisted vi.mock factories run.
const inputs = vi.hoisted(() => ({
  pathname: '/app' as string | null,
  query: { loading: true } as QueryState,
  queryCalls: [] as unknown[][],
}));

vi.mock('next/navigation', () => ({ usePathname: () => inputs.pathname }));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: (...args: unknown[]) => {
    inputs.queryCalls.push(args);
    return inputs.query;
  },
}));

// The page under the gate. "Not mounted" (spec §3) is asserted as zero
// function-body runs and zero calls to its data-query hook, not merely as
// absence from the markup.
const pageDataQuery = vi.fn();
let pageRenders = 0;
function PageProbe() {
  pageRenders += 1;
  pageDataQuery();
  return <p>page-probe</p>;
}

const UNAVAILABLE = 'This page isn&#x27;t available to you.';
const LOADING = 'role="status" aria-label="Loading…"';

function admin(role: Role, scope: AdminScope) {
  return { data: { currentAdmin: { id: 'admin-1', role, scope } }, loading: false };
}

function renderGate(pathname: string | null, query: QueryState) {
  inputs.pathname = pathname;
  inputs.query = query;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={getMessages()}>
      <PageVisibilityGate>
        <PageProbe />
      </PageVisibilityGate>
    </NextIntlClientProvider>,
  );
}

function homeLink(href: string) {
  return new RegExp(`<a [^>]*href="${href}"[^>]*>Go to your home page</a>`);
}

function expectMounted(html: string) {
  expect(html).toContain('page-probe');
  expect(pageRenders).toBe(1);
  expect(pageDataQuery).toHaveBeenCalledTimes(1);
}

function expectNotMounted(html: string) {
  expect(html).not.toContain('page-probe');
  expect(pageRenders).toBe(0);
  expect(pageDataQuery).not.toHaveBeenCalled();
}

beforeEach(() => {
  pageRenders = 0;
  pageDataQuery.mockClear();
  inputs.queryCalls.length = 0;
});

describe('PageVisibilityGate', () => {
  describe('row 0: ungated paths', () => {
    it.each(['/app', '/app/does-not-exist', '/app/customers-old', null])(
      'mounts the page on %j at once, while currentAdmin is still loading',
      (pathname) => {
        const html = renderGate(pathname, { loading: true });

        expectMounted(html);
        expect(html).not.toContain(LOADING);
      },
    );

    // "Ungated" means the rendering decision ignores the currentAdmin result,
    // not that the hook is skipped (spec §4.2 Inputs): the hook still runs,
    // and no query state changes what an ungated path renders.
    it.each([
      ['loading', { loading: true }],
      ['an error', { error: new Error('session expired'), loading: false }],
      ['a settled null', { data: { currentAdmin: null }, loading: false }],
      ['a principal with no tenant pages', admin('SUPER_ADMIN', 'PLATFORM')],
      ['a principal denied every gated page', admin('SUPER_ADMIN', 'TENANT')],
    ] as [string, QueryState][])('mounts an unknown/unlisted path whatever the query state: %s', (_label, query) => {
      const html = renderGate('/app/does-not-exist', query);

      expectMounted(html);
      expect(html).not.toContain(LOADING);
      expect(html).not.toContain(UNAVAILABLE);
      expect(inputs.queryCalls).toEqual([[]]);
    });
  });

  describe('rows 1–2: principal present', () => {
    it('mounts an allowed page', () => {
      expectMounted(renderGate('/app/admin', admin('TENANT_OWNER', 'TENANT')));
    });

    it('replaces a denied page with the unavailable state and a home link', () => {
      const html = renderGate('/app/customers', admin('FINANCE', 'TENANT'));

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
      expect(html).toMatch(homeLink('/app/bookings'));
    });

    it('denies a deep link beneath a hidden page', () => {
      const html = renderGate('/app/customers/123', admin('FINANCE', 'TENANT'));

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
    });

    it('denies a Super Admin a tenant page and links to the platform landing', () => {
      const html = renderGate('/app/bookings', admin('SUPER_ADMIN', 'PLATFORM'));

      expectNotMounted(html);
      expect(html).toMatch(homeLink('/app/platform'));
    });

    it('denies a tenant principal the platform page', () => {
      const html = renderGate('/app/platform', admin('SCHEDULER', 'TENANT'));

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
      expect(html).toMatch(homeLink('/app/bookings'));
    });

    it('omits the home link when the principal has no landing', () => {
      const html = renderGate('/app/bookings', admin('SUPER_ADMIN', 'TENANT'));

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
      expect(html).not.toContain('<a ');
    });

    it('decides from a cached principal during a refetch, never showing LoadingState', () => {
      const refetching = { ...admin('FINANCE', 'TENANT'), loading: true };

      expectMounted(renderGate('/app/bookings', refetching));

      pageRenders = 0;
      pageDataQuery.mockClear();
      const denied = renderGate('/app/customers', refetching);
      expectNotMounted(denied);
      expect(denied).toContain(UNAVAILABLE);
      expect(denied).not.toContain(LOADING);
    });

    it('decides from a cached principal even when the query also reports an error', () => {
      const html = renderGate('/app/customers', { ...admin('FINANCE', 'TENANT'), error: new Error('refetch failed') });

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
    });
  });

  describe('rows 3–5: no principal on a gated path', () => {
    it('passes the page through on a query error', () => {
      expectMounted(renderGate('/app/cleaners', { error: new Error('session expired'), loading: false }));
    });

    it('shows LoadingState and does not mount the page while loading', () => {
      const html = renderGate('/app/customers', { loading: true });

      expectNotMounted(html);
      expect(html).toContain(LOADING);
    });

    it('passes the page through when the query settles with no currentAdmin', () => {
      expectMounted(renderGate('/app/admin', { data: { currentAdmin: null }, loading: false }));
    });
  });

  // The generated hook's default fetch policy is cache-first; passing no
  // options is the spec §4.2 mechanism for using it.
  it('calls useCurrentAdminQuery with no options', () => {
    renderGate('/app/bookings', admin('FINANCE', 'TENANT'));

    expect(inputs.queryCalls).toEqual([[]]);
  });
});
```

In `apps/web/i18n/messages.test.ts`, inside `describe('getMessages', ...)`, after the `it('carries the landing and platform placeholder copy in nav', ...)` test, add:

```ts
  it('carries the unavailable-page copy in nav.unavailable', () => {
    expect(getMessages().nav.unavailable).toEqual({
      action: 'Go to your home page',
      message: "This page isn't available to you.",
    });
  });
```

In `apps/web/lib/web-shell-regressions.test.ts`, inside `describe('web shell regressions', ...)`, after the `it('keeps viewRoles in lib/nav-groups.ts only', ...)` test from Task 1, add:

```ts
  // Role-aware typed URLs spec §4.2, §5 invariants 4, 6 and 7.
  it('mounts the page-visibility gate once, directly inside DashboardLayout', () => {
    const layout = readWebSource('app/app/layout.tsx');

    expect(layout).toMatch(
      /<DashboardLayout>\s*<PageVisibilityGate>\{children\}<\/PageVisibilityGate>\s*<\/DashboardLayout>/,
    );
    const mounts = nonTestSources(webRoot)
      .filter((path) => readFileSync(path, 'utf8').includes('<PageVisibilityGate'))
      .map((path) => relative(webRoot, path));
    expect(mounts).toEqual(['app/app/layout.tsx']);
  });

  it('reads currentAdmin in the gate with the default cache-first policy and never redirects', () => {
    const gate = readWebSource('components/layout/page-visibility-gate.tsx');

    expect(gate).toContain('useCurrentAdminQuery()');
    expect(gate).not.toContain('fetchPolicy');
    expect(gate).not.toMatch(/useRouter|redirect\(|'\/login'/);
    expect(gate).not.toMatch(/tenantId|viewRoles/);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx lib/web-shell-regressions.test.ts i18n/messages.test.ts`

Expected: FAIL.
- `page-visibility-gate.test.tsx` fails to load: `../components/layout/page-visibility-gate` does not exist.
- `messages.test.ts` › `carries the unavailable-page copy…` fails: `nav.unavailable` is `undefined`.
- `web-shell-regressions` › `mounts the page-visibility gate once…` fails on the layout regex.
- `web-shell-regressions` › `reads currentAdmin in the gate…` fails with `ENOENT` for the gate file.

Every other test in those files passes.

- [ ] **Step 3: Add the copy**

In `apps/web/messages/en/nav.json`, replace:

```json
  "landing": {
    "empty": "No areas are available for your account.",
    "loading": "Loading…"
  },
```

with:

```json
  "landing": {
    "empty": "No areas are available for your account.",
    "loading": "Loading…"
  },
  "unavailable": {
    "action": "Go to your home page",
    "message": "This page isn't available to you."
  },
```

- [ ] **Step 4: Create the gate**

Create `apps/web/components/layout/page-visibility-gate.tsx`:

```tsx
'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { EmptyState, LoadingState } from '@clensy/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { canViewPath, isGatedPath, landingHref, type NavPrincipal } from '../../lib/nav-groups';

// The one /app page-visibility gate (role-aware typed URLs spec §4.2),
// mounted by app/app/layout.tsx. A client-side presentation rule derived from
// the shell navigation policy, not authorization: the API stays the boundary
// (multi-tenant spec §4.2, §5.13). It never redirects and makes no session
// decision; with no principal the page mounts and keeps its own behavior. A
// denied page is never rendered, so its hooks and queries never run.
export function PageVisibilityGate({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';
  // Default cache-first, sharing the sidebar's and user menu's read. Called
  // on every render (rules of hooks) even where the result is unused.
  const { data, error, loading } = useCurrentAdminQuery();
  const principal = data?.currentAdmin;

  if (!isGatedPath(pathname)) return children;
  if (principal) {
    return canViewPath(principal, pathname) ? children : <UnavailableState principal={principal} />;
  }
  if (!error && loading) return <LoadingState message={t('landing.loading')} />;
  return children;
}

// The shared state for every denied path (spec §4.3): no roles or scopes
// named, one way home through the same landing rule as /app.
function UnavailableState({ principal }: { principal: NavPrincipal }) {
  const t = useTranslations('nav');
  const home = landingHref(principal);

  return (
    <EmptyState
      message={t('unavailable.message')}
      action={
        home ? (
          <Link href={home} className="text-sm font-medium text-slate-900 underline underline-offset-4">
            {t('unavailable.action')}
          </Link>
        ) : undefined
      }
    />
  );
}
```

- [ ] **Step 5: Mount it in the layout**

In `apps/web/app/app/layout.tsx`, replace:

```tsx
import { AppI18nProvider } from '../../components/layout/app-i18n-provider';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
```

with:

```tsx
import { AppI18nProvider } from '../../components/layout/app-i18n-provider';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { PageVisibilityGate } from '../../components/layout/page-visibility-gate';
```

Replace:

```tsx
// and every page share it. `/login` stays outside it.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppI18nProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AppI18nProvider>
  );
}
```

with:

```tsx
// and every page share it. `/login` stays outside it.
//
// `PageVisibilityGate` is the one page-visibility gate (role-aware typed URLs
// spec §4.2): inside DashboardLayout, so shell chrome renders on every path
// and only the page body is replaced. UX only, never authorization.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppI18nProvider>
      <DashboardLayout>
        <PageVisibilityGate>{children}</PageVisibilityGate>
      </DashboardLayout>
    </AppI18nProvider>
  );
}
```

- [ ] **Step 6: Let the gate test import `getMessages()`**

The gate test renders through the real `getMessages()` → `NextIntlClientProvider` path, so that the copy it asserts is the shipped `nav.json`. The repo's `no-restricted-imports` rule allows that only for named test files. In `apps/web/eslint.config.mjs`, replace:

```js
    // `lib/i18n-rendering.test.tsx` and `lib/app-i18n-boundary.test.tsx` are
    // the deliberate exceptions outside `i18n/**`: they render through the
    // real getMessages() -> NextIntlClientProvider path (i18n spec §6; single
    // app i18n provider spec §6.2) and must import getMessages directly.
    ignores: ['i18n/**', 'lib/i18n-rendering.test.tsx', 'lib/app-i18n-boundary.test.tsx'],
```

with:

```js
    // `lib/i18n-rendering.test.tsx`, `lib/app-i18n-boundary.test.tsx` and
    // `lib/page-visibility-gate.test.tsx` are the deliberate exceptions
    // outside `i18n/**`: they render through the real getMessages() ->
    // NextIntlClientProvider path (i18n spec §6; single app i18n provider spec
    // §6.2; role-aware typed URLs spec §8.2) and must import getMessages
    // directly.
    ignores: [
      'i18n/**',
      'lib/i18n-rendering.test.tsx',
      'lib/app-i18n-boundary.test.tsx',
      'lib/page-visibility-gate.test.tsx',
    ],
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx lib/web-shell-regressions.test.ts i18n/messages.test.ts`
Expected: PASS, all three files.

Run: `pnpm --filter web test`
Expected: PASS, every file.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: exit 0. Without Step 6, lint fails with `no-restricted-imports` on the gate test's `../i18n/messages` import.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/layout/page-visibility-gate.tsx apps/web/lib/page-visibility-gate.test.tsx \
  apps/web/messages/en/nav.json apps/web/i18n/messages.test.ts apps/web/app/app/layout.tsx \
  apps/web/lib/web-shell-regressions.test.ts apps/web/eslint.config.mjs
git commit -m "feat(114): gate shell-hidden /app pages behind a shared unavailable state"
```

---

### Task 3: Retire `canManageStaff` and `staff.page.notAuthorized` (spec §4.5; §8.3)

**Files:**
- Modify: `apps/web/app/app/admin/page.tsx`, `apps/web/lib/staff-console.ts`, `apps/web/lib/staff-console.test.ts`, `apps/web/lib/tenant-role-regressions.test.ts`, `packages/web/src/i18n/messages/en/staff.ts`

**Interfaces:**
- Consumes: the Task 2 gate, which now owns `/app/admin` visibility.
- Produces: nothing new. Removes `canManageStaff` from `lib/staff-console.ts` and `page.notAuthorized` from the `@clensy/web` `staff` catalog.

- [ ] **Step 1: Confirm the key has no other consumer**

Run: `grep -rn "notAuthorized" apps packages --include=*.ts --include=*.tsx --include=*.json --exclude-dir=node_modules --exclude-dir=.next`

Expected: exactly two lines, `packages/web/src/i18n/messages/en/staff.ts` (the key) and `apps/web/app/app/admin/page.tsx` (the use). If any other line appears, stop: spec §4.5 removes the key only when the admin page is its sole consumer. Report the extra consumer at the M6 handoff instead of removing the key.

- [ ] **Step 2: Write the failing regression**

In `apps/web/lib/tenant-role-regressions.test.ts`, replace:

```ts
  it('gates the staff admin page on the scope-aware canManageStaff predicate', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).toContain('canManageStaff(');
    expect(adminPage).not.toMatch(/role === 'TENANT_OWNER'/);
    expect(adminPage).not.toMatch(/tenantId === null/);
  });
```

with:

```ts
  // Role-aware typed URLs spec §4.5: the /app layout's PageVisibilityGate
  // decides whether the staff page is shown; the page keeps its own session
  // handling and its own currentAdmin read.
  it('leaves staff page visibility to the layout gate and keeps its session handling', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).not.toContain('canManageStaff');
    expect(adminPage).not.toContain('notAuthorized');
    expect(adminPage).not.toMatch(/role === 'TENANT_OWNER'/);
    expect(adminPage).not.toMatch(/tenantId === null/);
    expect(adminPage).toContain("useCurrentAdminQuery({ fetchPolicy: 'network-only' })");
    expect(adminPage).toContain("router.replace('/login')");
    expect(adminPage).toContain('<StaffConsole currentAdminId={currentAdmin.id} />');
  });

  it('retires the canManageStaff helper', () => {
    expect(readWebSource('lib/staff-console.ts')).not.toContain('canManageStaff');
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/tenant-role-regressions.test.ts lib/staff-console.test.ts`

Expected: FAIL in `tenant-role-regressions` only: `leaves staff page visibility…` (the page still contains `canManageStaff`) and `retires the canManageStaff helper`. `staff-console.test.ts` still passes.

- [ ] **Step 4: Remove the branch from the admin page**

In `apps/web/app/app/admin/page.tsx`, replace:

```tsx
import { canManageStaff, disableConfirmDescription, staffMutationErrorKey } from '../../../lib/staff-console';
```

with:

```tsx
import { disableConfirmDescription, staffMutationErrorKey } from '../../../lib/staff-console';
```

Replace:

```tsx
// back to `/login`. `canManageStaff` is a UX nicety only — the API
// independently enforces Tenant-Owner-only, same-tenant access on
// `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
```

with:

```tsx
// back to `/login`. Whether this page is shown at all is the /app layout's
// PageVisibilityGate (role-aware typed URLs spec §4.2, §4.5), a UX rule only
// — the API independently enforces Tenant-Owner-only, same-tenant access on
// `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
```

Replace:

```tsx
  if (error || !currentAdmin) {
    // Redirect already dispatched in the effect above.
    return null;
  }

  if (!canManageStaff(currentAdmin)) {
    return <p className="text-sm text-slate-700">{t('page.notAuthorized')}</p>;
  }

  return <StaffConsole currentAdminId={currentAdmin.id} />;
```

with:

```tsx
  if (error || !currentAdmin) {
    // Redirect already dispatched in the effect above.
    return null;
  }

  return <StaffConsole currentAdminId={currentAdmin.id} />;
```

`t` is still used for `t('page.loading')`, so the `useClensyTranslations('staff')` line stays.

- [ ] **Step 5: Remove the helper, its test and the key**

In `apps/web/lib/staff-console.ts`, replace:

```ts
import type { AdminScope, Role } from '@clensy/client';
import type { StaffErrorKey } from '@clensy/web';

// UX gate for the staff console. Branches on the explicit scope, never on
// tenantId === null (multi-tenant spec §3/§4.1). Not authorization — the API
// enforces Tenant-Owner-only, same-tenant access regardless (§4.2).
export function canManageStaff(admin: { role: Role; scope: AdminScope } | null | undefined): boolean {
  return admin?.scope === 'TENANT' && admin.role === 'TENANT_OWNER';
}

export type StaffMutation = 'create' | 'disable';
```

with:

```ts
import type { StaffErrorKey } from '@clensy/web';

export type StaffMutation = 'create' | 'disable';
```

In `apps/web/lib/staff-console.test.ts`, replace:

```ts
import { canManageStaff, disableConfirmDescription, staffMutationErrorKey } from './staff-console';
```

with:

```ts
import { disableConfirmDescription, staffMutationErrorKey } from './staff-console';
```

and delete this block, together with the blank line after it:

```ts
describe('canManageStaff', () => {
  it('requires both TENANT scope and TENANT_OWNER role', () => {
    expect(canManageStaff({ role: 'TENANT_OWNER', scope: 'TENANT' })).toBe(true);
    expect(canManageStaff({ role: 'TENANT_OWNER', scope: 'PLATFORM' })).toBe(false);
    expect(canManageStaff({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toBe(false);
    expect(canManageStaff({ role: 'FINANCE', scope: 'TENANT' })).toBe(false);
    expect(canManageStaff(null)).toBe(false);
    expect(canManageStaff(undefined)).toBe(false);
  });
});
```

The equivalent cases are covered by Task 1's `canViewPath` matrix on `/app/admin`, which spans every role × scope.

In `packages/web/src/i18n/messages/en/staff.ts`, replace:

```ts
    newAccount: '+ New Staff Account',
    notAuthorized: 'You are not authorized to view this page.',
    title: 'Staff Accounts',
```

with:

```ts
    newAccount: '+ New Staff Account',
    title: 'Staff Accounts',
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/tenant-role-regressions.test.ts lib/staff-console.test.ts`
Expected: PASS, both files.

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint`
Expected: exit 0. The `staff` catalog's type is inferred from the `en` object, so nothing else references the removed key.

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: exit 0, every `apps/web` test file passing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/app/admin/page.tsx apps/web/lib/staff-console.ts apps/web/lib/staff-console.test.ts \
  apps/web/lib/tenant-role-regressions.test.ts packages/web/src/i18n/messages/en/staff.ts
git commit -m "refactor(114): retire canManageStaff and staff.page.notAuthorized for the layout gate"
```

---

## Final verification (before the M6 handoff report)

Run each command and record its result in the M6 Slice Completion Report's Validation table:

| Command | Expected |
| --- | --- |
| `pnpm --filter web test` | PASS, every file |
| `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `pnpm --filter web lint` | exit 0 |
| `pnpm --filter web build` | exit 0 (Next.js production build of the client gate in the server layout) |
| `pnpm --filter @clensy/web test` / `build` / `lint` | exit 0 |
| `git diff --stat fb12aea -- apps/api packages/client packages/ui apps/web/middleware.ts` | empty (spec §2 and §8.5: no API, client, UI package or middleware change) |

**Optional manual smoke**, at M6's discretion and not a gate: sign in as a `FINANCE` seed user, open `/app/customers` and `/app/platform`, and confirm that the shell chrome is intact, the unavailable state shows, and the link goes to `/app/bookings`.

## Traceability

| Spec | Implemented by |
| --- | --- |
| §3 segment match, gated/ungated, "not mounted" | Task 1 (`segmentMatches`, `isGatedPath`); Task 2 (probe assertions) |
| §4.1 `isGatedPath`, `canViewPath`, segment boundaries, reserved platform path, no new data, sidebar consistency | Task 1 |
| §4.2 gate, mount, cache-first, rows 0–5, no redirect | Task 2 |
| §4.3 unavailable state, `landingHref` link, omitted link | Task 2 |
| §4.4 copy | Task 2 |
| §4.5 retirement, unchanged admin redirect lifecycle | Task 3 |
| §4.6 worked examples | Task 1 (`denies and allows the worked examples`, teams-extra); Task 2 (cross-scope, ungated, expired-session rows 3/5) |
| §5 invariants 1–11 | 1: comments in Tasks 1–2 plus the Task 2 regressions; 2: Task 1 regression; 3: Task 1 matrix; 4, 6, 7: Task 2 regressions and the runtime `queryCalls` check; 5: Task 2 probes; 8: Task 2 denied tests; 9: Task 1 reservation test; 10: Task 2 row-0 tests; 11: Task 1 characterization |
| §8.1–§8.5 verification contract | Tasks 1–3 and Final verification |

## Deferred (not in this plan)

Per spec §11: session/expiry routing across `/app` pages, platform navigation, and locales beyond `en`. None of these is opened by this plan.

## Execution risks (operational only)

- **Node-environment rendering.** The gate tests rely on `renderToStaticMarkup` rendering `next/link` and next-intl without a router context. Pre-validation confirmed this under Next 16 / next-intl 4. If an upgrade breaks it, mock `next/link` as a plain `<a>` in the test file only; the gate's code doesn't change.
- **HTML escaping.** `renderToStaticMarkup` escapes `'` as `&#x27;`, hence the `UNAVAILABLE` constant. The `messages.test.ts` assertion pins the unescaped source text.

## Gate outcomes

*(Appended after M5.)*
