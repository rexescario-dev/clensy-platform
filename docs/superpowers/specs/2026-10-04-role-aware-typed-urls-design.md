# Role-Aware Experience for Typed URLs of Role-Hidden Pages — Design

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-04 |
| Document kind | Architecture RFC |
| Tracking issue | [#114](https://github.com/rexescario-dev/clensy-platform/issues/114) — surfaced by the #89 closeout. Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| Depends on (Accepted) | [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — **relied upon** unchanged: the API is the authorization boundary (§4.2, §4.5), UI visibility is not authorization (§4.2), shell and navigation MAY reflect scope and role for UX but MUST NOT be the isolation mechanism (§4.8), and navigation and middleware MUST NOT be the security boundary (§5 invariant 13). [Web Shell and Design System](2026-09-10-web-shell-and-design-system-design.md) — **relied upon**: the single `/app` layout and the shell is not an authorization boundary. This spec adds one component inside that layout and does not change shell chrome. [Single App-Level `ClensyI18nProvider`](2026-10-02-single-app-i18n-provider-design.md) — **relied upon** unchanged: `AppI18nProvider` stays the outermost `/app` wrapper. [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — **relied upon**: the new state composes existing `@clensy/ui` exports and adds no primitive. |
| Related (not a dependency) | [Admin Foundation](2026-08-14-admin-foundation-design.md) — owns `Query.currentAdmin`, read here unchanged. The #89 tenant-aware shell slice ([plan](../plans/2026-10-01-tenant-aware-application-shell-plan.md)) introduced `NAV_GROUPS[].viewRoles`, `visibleNavGroups`, `landingHref` and `landingTarget` in `apps/web`, which this spec reuses. |
| Followed by | None. Session/expiry routing across `/app` pages is a known inconsistency (§2, §11) and is not opened by this spec. |

## 1. Primary question and thesis

**Question:** What does a role-hidden `/app` page show when a user reaches it by typing or bookmarking its URL?

**Thesis:** The `/app` layout owns a single client-side **page-visibility gate**. The gate derives page visibility from the existing navigation configuration (`NAV_GROUPS[].viewRoles`) and the platform landing rule (`PLATFORM_HOME_HREF`). When the requested path is outside the principal's shell-visible scope, it renders one shared, role-aware "not available" state instead of the page. It does not redirect, it does not perform or replace API authorization, and it adds no second page-to-role mapping.

### 1.1 Background (state on `main` at `fb12aea`)

- `apps/web/middleware.ts` only redirects when the session cookie is missing. No route under `apps/web/app/app/` makes a shared role decision.
- From `NAV_GROUPS` in `apps/web/lib/nav-groups.ts`, the role-hidden tenant pages are:
  - `/app/customers`, hidden from `FINANCE`;
  - `/app/cleaners` and `/app/cleaners/teams`, hidden from `CUSTOMER_SUPPORT` and `FINANCE`;
  - `/app/admin`, hidden from every role except `TENANT_OWNER`.
  
  Every tenant page is hidden from a `PLATFORM`-scope principal, because `visibleNavGroups` returns nothing for a non-`TENANT` scope. `/app/platform` (`PLATFORM_HOME_HREF`) is the Super Admin landing and is not a nav item.
- What a typed URL shows today:
  - Most role-hidden pages show their generic `ErrorState`, for example "Unable to load teams.", from the API's `FORBIDDEN`. That reads as a failure, not as "not for your role."
  - `/app/admin` already shows `staff.page.notAuthorized`, through `canManageStaff` in `apps/web/lib/staff-console.ts`. That is a second, page-local copy of the `/app/admin` visibility rule. The issue's `/app/admin` example ("raw `Forbidden`") predates it.
  - A tenant user who opens `/app/platform` sees the Super Admin placeholder with no error, because that page makes no API call.
- Security is not affected. The API stays the authorization boundary, and the #92 release gate pins `FORBIDDEN` for every denied role. This is a UX gap only.

## 2. Scope

### In scope (normative)

- A pure presentation rule `canViewPath(principal, pathname)` in `apps/web/lib/nav-groups.ts` (§4.1).
- A client component `PageVisibilityGate` in `apps/web/components/layout/`, mounted once by `apps/web/app/app/layout.tsx` (§4.2).
- One shared "not available" state with a recovery link to `landingHref(principal)` (§4.3), and its `en` copy in `apps/web/messages/en/nav.json` (§4.4).
- Retirement of `canManageStaff` and the `staff.page.notAuthorized` message key (§4.5).
- Every `/app/*` page hidden from some role or scope, including `/app/platform` for tenant principals.

### Informative

- Bookings, jobs, laundry, billing, services and add-ons are visible to every tenant role today. They are gated by the same rule, so they are covered automatically if a later change narrows their `viewRoles`.
- Session handling is inconsistent today: only `/app` and `/app/admin` send a missing or invalid `currentAdmin` to `/login`. This spec preserves that and does not resolve it (§4.2, §11).

### Out of scope (normative)

- Any API authorization change, and relation-level RBAC ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106)).
- Session and expiry routing (`/login` redirects) on any page.
- Redirecting denied users anywhere (issue option B).
- Mapping API `FORBIDDEN` errors to friendly messages (issue option C).
- Changes to `middleware.ts`, the sidebar, the header, the user menu, or `landingTarget`.
- Locales other than `en`.

## 3. Terminology

| Term | Meaning in this spec |
| --- | --- |
| **Principal** | The `currentAdmin` result's `{ role, scope }`, as `NavPrincipal` in `nav-groups.ts`. |
| **Shell visibility policy** | The rules already in `nav-groups.ts`: `NAV_GROUPS[].viewRoles`, `visibleNavGroups`, `PLATFORM_HOME_HREF` and `landingHref`. |
| **Viewable path** | A pathname for which `canViewPath(principal, pathname)` is `true`. Presentation only; it says nothing about whether an API operation is authorized. |
| **Shell path** | A pathname that resolves, via `findActiveHref`, to a `NAV_GROUPS` item href, or that equals or lies below `PLATFORM_HOME_HREF`, or that equals `/app`. |
| **Unknown/unlisted path** | Any other pathname. It has no shell visibility rule, so the shell imposes no restriction. This does not mean Next.js fails to recognize the route. |
| **Unavailable state** | The shared "not available for your role" rendering of §4.3. |

## 4. Contracts

### 4.1 `canViewPath(principal, pathname)`

`canViewPath(principal: NavPrincipal, pathname: string): boolean` is exported from `apps/web/lib/nav-groups.ts`. Its documentation MUST state that it is *a client-side presentation rule derived from the shell navigation policy, and that it does not grant, deny, or replace API authorization.* It MUST NOT be named or described as an authorization function.

Resolution, evaluated in this order:

1. **Nav item.** If `findActiveHref(pathname)` returns an href (the sidebar's existing longest-prefix match, so `/app/cleaners/teams/x` resolves to `/app/cleaners/teams`), the result is `true` exactly when an item with that href is in `visibleNavGroups(principal)`.
2. **Platform path.** If `pathname` equals `PLATFORM_HOME_HREF` or starts with `` `${PLATFORM_HOME_HREF}/` ``, the result is `principal.scope === 'PLATFORM'`.
3. **Landing.** If `pathname` equals `/app`, the result is `true`.
4. **Unknown/unlisted path.** Otherwise the result is `true`.

Requirements:

- It reads only `NAV_GROUPS` (through `findActiveHref` and `visibleNavGroups`) and `PLATFORM_HOME_HREF`. It MUST NOT introduce any new list, map or table of paths, roles or scopes.
- For every nav href `h` and every principal `p`, `canViewPath(p, h)` MUST equal "`visibleNavGroups(p)` contains an item with href `h`". The sidebar and the gate cannot disagree.
- It is pure: no I/O, no React, no `tenantId` (multi-tenant spec §3/§4.1 — scope first).

### 4.2 `PageVisibilityGate`

`PageVisibilityGate({ children })` is a client component in `apps/web/components/layout/page-visibility-gate.tsx`. `apps/web/app/app/layout.tsx` mounts it exactly once, directly inside `DashboardLayout`:

```tsx
<AppI18nProvider>
  <DashboardLayout>
    <PageVisibilityGate>{children}</PageVisibilityGate>
  </DashboardLayout>
</AppI18nProvider>
```

As a result, shell chrome (sidebar, header, user menu) renders as it does today on every path; only the page body inside `<main>` is replaced.

**Inputs.**

- `usePathname()`, with `null` treated as `''` (an unknown/unlisted path).
- `useCurrentAdminQuery()` with the **default (cache-first) fetch policy**. The gate MUST NOT pass `fetchPolicy`, and MUST NOT introduce a `network-only` or other variant. It therefore shares the Apollo cache entry the sidebar and user menu already read. Pages that query `currentAdmin` with `network-only` continue to do so, unchanged.

**Rendering**, evaluated in this order (`principal = data?.currentAdmin`):

| # | Condition | Renders |
| --- | --- | --- |
| 1 | `principal` is present and `canViewPath(principal, pathname)` | `children` |
| 2 | `principal` is present and not `canViewPath(principal, pathname)` | The unavailable state (§4.3). `children` are **not mounted**. |
| 3 | No `principal`, and `error` is set | `children`, unchanged |
| 4 | No `principal`, no `error`, and `loading` | `LoadingState` from `@clensy/ui`, with `message` set to the existing `nav.landing.loading` copy. `children` are **not mounted**. |
| 5 | Otherwise (query settled with `currentAdmin` null) | `children`, unchanged |

Consequences, all normative:

- **"Loading" means no principal data yet.** If a cached principal is present while Apollo reports `loading: true` during a refetch, rows 1–2 apply immediately. The gate MUST NOT regress to `LoadingState` because of a refetch.
- **A denied page's subtree, and so its data queries, never mount** before or after the decision (rows 2 and 4).
- **The gate is not a session boundary.** It MUST NOT redirect, MUST NOT route to `/login`, and MUST NOT inspect API error codes or messages. On rows 3 and 5 each page keeps exactly its current behavior: `/app` and `/app/admin` still redirect to `/login`, and other pages show their own error.
- **Role staleness is accepted.** The gate evaluates the cached principal. It does not track a role change made elsewhere mid-session, which is the same as the sidebar. The API enforces the current role on every operation regardless.
- **The cold-load cost is accepted.** On a cold load a page's own queries start one `currentAdmin` round trip later than today. Navigation within the session is served from the cache and is not delayed.

### 4.3 The unavailable state

It is rendered by the gate file (a module-local component), composed from `@clensy/ui`'s existing `EmptyState`:

- `message`: `nav.unavailable.message`.
- `action`: a `next/link` `Link` to `landingHref(principal)`, labelled `nav.unavailable.action`. If `landingHref(principal)` is `undefined`, the action is omitted (`EmptyState` without `action`). That cannot happen with today's role matrix, because every tenant role sees `/app/bookings` and Super Admin lands on `/app/platform`, but the contract defines it.

Requirements:

- It is shell chrome, not a domain component. It lives in `apps/web` and adds nothing to `@clensy/ui` or `@clensy/web` (multi-tenant spec §4.8 is unaffected).
- It MUST NOT name the roles or scopes that could view the page, and MUST NOT state or imply that an API operation was attempted or denied.
- It renders identically for every denied path. There is no per-page copy.

### 4.4 Copy

Two keys are added to `apps/web/messages/en/nav.json` under a new `unavailable` object, alongside `landing`:

| Key | `en` text |
| --- | --- |
| `nav.unavailable.message` | This page isn't available for your role. |
| `nav.unavailable.action` | Go to your home page |

They are read with next-intl `useTranslations('nav')`, as `app/app/page.tsx` reads `nav.landing.*`. The gate's loading row reuses `nav.landing.loading`; no loading key is added.

### 4.5 Retirement of the page-local `/app/admin` rule

`canManageStaff` (`scope === 'TENANT' && role === 'TENANT_OWNER'`) is exactly `canViewPath(principal, '/app/admin')` under §4.1 (`viewRoles: ['TENANT_OWNER']`, `TENANT` scope). Therefore:

- `apps/web/app/app/admin/page.tsx` drops its `canManageStaff` branch and its use of `staff.page.notAuthorized`. It keeps its own `currentAdmin` read (`network-only`), its `/login` redirect on error or null, and its use of `currentAdmin.id` for `StaffConsole`.
- `canManageStaff` is removed from `apps/web/lib/staff-console.ts`, together with its unit test.
- The `tenant-role-regressions.test.ts` assertion that the admin page calls `canManageStaff(` is replaced by the §8 regressions.
- `staff.page.notAuthorized` is removed from `packages/web/src/i18n/messages/en/staff.ts` if, at M4, the admin page is its only consumer. That is the state on `fb12aea`.

### 4.6 Worked examples

| Principal | Path | Gate renders | Recovery link |
| --- | --- | --- | --- |
| `FINANCE` / `TENANT` | `/app/customers` | Unavailable state | `/app/bookings` |
| `CUSTOMER_SUPPORT` / `TENANT` | `/app/cleaners/teams` | Unavailable state | `/app/bookings` |
| `OPS_MANAGER` / `TENANT` | `/app/admin` | Unavailable state (previously `staff.page.notAuthorized`) | `/app/bookings` |
| `SUPER_ADMIN` / `PLATFORM` | `/app/bookings` | Unavailable state | `/app/platform` |
| `SCHEDULER` / `TENANT` | `/app/platform` | Unavailable state | `/app/bookings` |
| `TENANT_OWNER` / `TENANT` | `/app/admin` | The staff console | — |
| `SUPER_ADMIN` / `PLATFORM` | `/app/platform` | The platform placeholder | — |
| `ANALYST` / `TENANT` | `/app/does-not-exist` | `children` (Next.js not-found) | — |
| Any principal | `/app` | `children` (the existing landing redirect) | — |
| Expired session (cookie present, `currentAdmin` errors) | `/app/cleaners` | `children` (the page's own error, unchanged) | — |

## 5. Invariants (MUST / MUST NOT)

1. The gate and `canViewPath` MUST NOT be, or be documented as, authorization. API authorization is unchanged. A denial by the gate MUST NOT be treated as evidence that the corresponding API operation is unauthorized, and an allowed path grants nothing (multi-tenant spec §4.2, §5 invariant 13).
2. Page visibility MUST be derived only from `NAV_GROUPS` and `PLATFORM_HOME_HREF`. `apps/web/lib/nav-groups.ts` MUST remain the only non-test source file in `apps/web` that contains the token `viewRoles`. No page-level or gate-level role or scope rule may be added.
3. `canViewPath` and `visibleNavGroups` MUST agree on every nav href for every principal.
4. The gate MUST use `useCurrentAdminQuery()` with the default cache-first policy, and MUST NOT pass `fetchPolicy`.
5. A denied page's subtree MUST NOT mount, and MUST NOT mount while the principal is unknown and no error has occurred.
6. The gate MUST NOT redirect, route to `/login`, or inspect API errors. With no principal, it passes `children` through unchanged.
7. The gate MUST be mounted exactly once, in `apps/web/app/app/layout.tsx`, inside `DashboardLayout`. No page mounts its own gate.
8. The unavailable state MUST be the same for every denied path, with its recovery target taken only from `landingHref(principal)`.

## 6. Goals and non-goals

**Goals**

- A user who types or bookmarks a role-hidden page sees a deliberate "not available for your role" state with one way back to their home page.
- One visibility rule shared by the sidebar, the landing redirect and the gate. Future nav entries are covered by their `viewRoles` alone.
- Denied pages don't fire their data queries.

**Non-goals**

- Hardening security. The API is already the boundary, and nothing here changes it.
- Redirects of any kind, including for denied paths, unknown paths, or expired sessions.
- Unifying session/expiry handling across pages.
- Friendly mapping of `FORBIDDEN` or other API errors on pages.
- Hiding or gating unknown/unlisted paths.
- Per-page, per-role, or per-tenant copy for the unavailable state.
- Gating individual actions or fields within a visible page (relation-level RBAC is #106).

## 7. Rationale

- **A shared state instead of a redirect (option B).** A redirect silently sends the user somewhere they didn't ask for, and makes a shared or bookmarked URL look broken. An explicit state with one recovery link explains what happened and still gets them home.
- **A shared state instead of `FORBIDDEN` mapping (option C).**
  - Error mapping must be repeated on every page and still runs the denied query.
  - It cannot cover `/app/platform`, which makes no API call, so there is nothing to map.
  - It would also tie UX copy to API error shapes.
- **Gating in the layout, not per page.** One mount point means a new page is covered without remembering to opt in, and the page-local `canManageStaff` copy disappears. The layout already owns the shell, and `<main>` is the natural replacement boundary.
- **Deriving from `NAV_GROUPS`.** The issue requires reusing the shell's visibility rules. `viewRoles` already mirrors each destination's API read gate, and the sidebar and landing redirect already depend on it, so one source keeps all three consistent.
- **Unknown/unlisted paths are viewable.** They have no navigation rule. Denying them would turn a presentation helper into an implicit route firewall and would mask Next.js's not-found handling.
- **Passing children through on error or null.** Making the gate own session semantics would widen #114 into authentication UX and duplicate the `/app` and `/app/admin` redirects. Preserving each page's current behavior keeps this slice's blast radius at visibility only.
- **Cache-first.** It shares the sidebar's existing read, so navigation within a session is instant. A `network-only` gate would add a round trip to every navigation.

## 8. Verification contract

These are acceptance anchors for M4–M7. Test file names are planning decisions.

1. **`canViewPath` matrix** (unit, `apps/web/lib/nav-groups.test.ts`):
   - Every `Role` × `AdminScope` × nav href, asserted equal to `visibleNavGroups` membership.
   - `/app` is viewable for every principal.
   - `/app/platform` and `/app/platform/x` are viewable only for `PLATFORM` scope.
   - An unknown/unlisted path (for example `/app/does-not-exist`) is viewable for every principal.
   - Nested paths resolve by longest prefix, for example `/app/cleaners/teams/x` (Teams rule) and `/app/catalog/add-ons/x` (Add-ons rule).
2. **Gate behavior** (component tests), using a child probe that records whether it mounted:
   - **Loading:** with no data, the gate renders `LoadingState` and the probe is not mounted.
   - **Cached principal during refetch** (`loading: true` with data): the gate evaluates immediately, rendering the probe or the unavailable state, never `LoadingState`.
   - **Error, and settled null:** the probe is mounted.
   - **Allowed:** the probe is mounted.
   - **Denied:** the unavailable state renders with the `landingHref(principal)` link, and the probe is not mounted.
   - **Cross-scope:** `SUPER_ADMIN`/`PLATFORM` on a tenant page is denied with a `/app/platform` link, and a tenant principal on `/app/platform` is denied.
   - **No landing:** for a principal whose `landingHref` is `undefined` (for example the inconsistent `SUPER_ADMIN`/`TENANT` pair, which sees no nav items), a denied path renders the state without an action.
3. **Source regressions**, in the style of the existing `web-shell-regressions.test.ts` / `tenant-role-regressions.test.ts`:
   - `app/app/layout.tsx` mounts `PageVisibilityGate` inside `DashboardLayout`.
   - The gate's `useCurrentAdminQuery` call passes no `fetchPolicy`.
   - `app/app/admin/page.tsx` no longer references `canManageStaff` or `notAuthorized`.
   - `lib/nav-groups.ts` is the only non-test `apps/web` source file containing `viewRoles` (invariant 2).
4. **Copy:** `nav.unavailable.message` and `nav.unavailable.action` exist in `apps/web/messages/en/nav.json`.
5. **Existing suites stay green:** `apps/web` unit/component tests, typecheck, lint, the `@clensy/web` tests (after the §4.5 key removal), and the API suites. No API source changes.

## 9. Traceability

| Dependency | Relationship |
| --- | --- |
| Multi-Tenant Architecture §4.2, §4.8, §5 invariant 13 | **Relied upon** unchanged. This spec is the "shell MAY reflect scope / role for UX" allowance of §4.8, bounded by invariant 13. |
| Web Shell and Design System | **Relied upon**: the single `/app` layout. One component is added inside it, and shell chrome is unchanged. |
| Single App-Level `ClensyI18nProvider` | **Relied upon**: `AppI18nProvider` stays outermost, and the gate's copy uses next-intl, not `@clensy/web`. |
| `@clensy/ui` Shared UI System | **Relied upon**: `EmptyState` and `LoadingState` are used as-is. |
| #89 shell slice (`nav-groups.ts`, `landing-target.ts`) | **Extended** with `canViewPath`. `visibleNavGroups`, `landingHref`, `findActiveHref` and `landingTarget` are unchanged. |
| Staff Administration UI (#88), `canManageStaff` | **Superseded** for the page-visibility decision only (§4.5). The staff console's mutations, error mapping and API gates are unchanged. |

## 10. Acceptance criteria (for this specification)

This specification may move from Draft to Accepted at M3 when the reviewer agrees that:

1. The decision (shared layout gate plus shared state; no redirect, no error mapping) is locked and justified (§1, §7).
2. `canViewPath`'s resolution order and its single-source requirement are unambiguous (§4.1, §5 invariants 2–3).
3. The gate's five rendering rows, the cache-first requirement, and the "no principal ⇒ children unchanged" rule are unambiguous (§4.2, §5 invariants 4–6).
4. The unavailable state, its copy, and the `canManageStaff` / `staff.page.notAuthorized` retirement are specified without leaving product decisions to M4 (§4.3–§4.5).
5. Every role-hidden page, including `/app/platform` for tenant principals, is covered by the worked examples and the verification contract (§4.6, §8).
6. Nothing here changes API authorization or contradicts the Accepted multi-tenant RFC (§5 invariant 1, §9).

## 11. Explicit deferrals

- **Session/expiry routing across `/app` pages.** Only `/app` and `/app/admin` route a missing or invalid `currentAdmin` to `/login`. Unifying this is a separate authentication-UX concern and needs its own issue.
- **Platform navigation.** `/app/platform` stays a single placeholder that is not a nav item (multi-tenant spec §10). If platform nav items are added later, they belong in the shell visibility policy, and §4.1 rule 2 must then be revisited by a spec amendment.
- **Additional locales** for `nav.unavailable.*`.
