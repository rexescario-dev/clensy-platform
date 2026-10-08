# Role-Aware Experience for Typed URLs of Role-Hidden Pages — Design

| Field | Value |
| --- | --- |
| Status | Accepted. **§4.3 amendment (#132): Accepted** 2026-10-04. **§4.3 amendment (#134): Accepted** 2026-10-07. **Cross-reference amendment (#131): Accepted** 2026-10-07. **Title amendment (#143): Accepted** 2026-10-08. |
| Date | 2026-10-04 (§4.3 amendment drafted 2026-10-04 for #132; §4.3 amendment drafted 2026-10-07 for #134; cross-reference amendment drafted 2026-10-07 for #131; title amendment drafted 2026-10-08 for #143) |
| Document kind | Architecture RFC |
| Tracking issue | [#114](https://github.com/rexescario-dev/clensy-platform/issues/114) — surfaced by the #89 closeout. Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). Implemented in PR [#130](https://github.com/rexescario-dev/clensy-platform/pull/130). §4.3 amendment: [#132](https://github.com/rexescario-dev/clensy-platform/issues/132), implemented in PR [#133](https://github.com/rexescario-dev/clensy-platform/pull/133). §4.3 amendment: [#134](https://github.com/rexescario-dev/clensy-platform/issues/134), implemented in PR [#144](https://github.com/rexescario-dev/clensy-platform/pull/144). Title amendment: [#143](https://github.com/rexescario-dev/clensy-platform/issues/143). |
| Depends on (Accepted) | [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — **relied upon** unchanged: the API is the authorization boundary (§4.2, §4.5), UI visibility is not authorization (§4.2), shell and navigation MAY reflect scope and role for UX but MUST NOT be the isolation mechanism (§4.8), and navigation and middleware MUST NOT be the security boundary (§5 invariant 13). [Web Shell and Design System](2026-09-10-web-shell-and-design-system-design.md) — **relied upon**: the single `/app` layout and the shell is not an authorization boundary. This spec adds one component inside that layout and does not change shell chrome. [Single App-Level `ClensyI18nProvider`](2026-10-02-single-app-i18n-provider-design.md) — **relied upon** unchanged: `AppI18nProvider` stays the outermost `/app` wrapper. [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — **relied upon**: the gate uses existing `@clensy/ui` exports and adds no primitive. *(#132)* The unavailable state no longer composes `EmptyState` (§4.3). *(#134)* Its home link composes the existing `Button` with `asChild` and `variant="link"` (§4.3). |
| Related (not a dependency) | [Admin Foundation](2026-08-14-admin-foundation-design.md) — owns `Query.currentAdmin`, read here unchanged. The #89 tenant-aware shell slice ([plan](../plans/2026-10-01-tenant-aware-application-shell-plan.md)) introduced `NAV_GROUPS[].viewRoles`, `visibleNavGroups`, `findActiveHref`, `landingHref` and `landingTarget` in `apps/web`, which this spec reuses. |
| Followed by | *(#143)* [Page-Specific Document Titles for `/app` Pages](2026-10-08-app-document-titles-design.md), which extends the gate with title ownership. *(#131)* The [session routing spec](2026-10-07-session-routing-design.md) ([#131](https://github.com/rexescario-dev/clensy-platform/issues/131)) resolves the session/expiry routing deferred in §2 and §11. Session redirect responsibility in §2, §4.5 and §4.6 now belongs to that spec. The gate's contract, including its cache-first read and role-staleness note (§4.2), is unchanged. |
| M3 decision | **Accepted** — 2026-10-04, at `4d1d4c0`, by the owner, on the second pass, with no further clarification. M4 implements it mechanically and MUST keep the locked decisions: one layout-level `PageVisibilityGate` using the default cache-first `useCurrentAdminQuery()`; `isGatedPath` decided before the principal, so `/app` and unknown/unlisted paths render at once; `canViewPath` derived only from `NAV_GROUPS` and `PLATFORM_HOME_HREF`, with segment-match semantics and `PLATFORM_HOME_HREF` reserved; denied pages not mounted (§3); no redirects, no session handling, no API changes; the shared "This page isn't available to you." state with a `landingHref` link; and the retirement of `canManageStaff` and `staff.page.notAuthorized`. **§4.3 amendment (#132) — Accepted 2026-10-04, at `194c11d`, by the owner, on the first pass, with two wording clarifications applied (`UnavailableState` ownership in `page-visibility-gate.tsx`; container styling described as previously used by `EmptyState`).** M4 implements it mechanically. It is presentation only. `UnavailableState` exposes its existing message as the page's single `<h1>` and no longer composes `EmptyState` (§4.3). Its delta is confined to the Depends-on row, §4.3, §6, §8 item 2, §9, §10 and §11. Every locked decision above is unchanged, including the copy, the `landingHref` link and the six rendering rows, as are all the other sections and the earlier acceptance criteria. **§4.3 amendment (#134) — Accepted 2026-10-07, at `86cd2b8`, by the owner, on the first pass, with no required changes.** M4 implements it mechanically. M4's gate-test plan MUST keep the existing accessible-name and href assertions on the rendered anchor; the `data-slot`/`data-variant` assertions complement them and do not replace them. It is presentation and test coverage only. The unavailable state's home link is rendered through `@clensy/ui` `Button asChild variant="link"`, which this amendment records as the convention for a standalone navigation action in shell chrome (§4.3). A trailing-slash path is pinned as segment-matching its nav href (§4.1, §8 item 1). Its delta is confined to the Status, Date, Tracking, Depends-on and M3 decision rows, §4.1 (one example), §4.3, §6, §8 items 1 and 2, §9, §10 and §11. Every locked decision above is unchanged, including the copy, the heading, the `landingHref` target, the visibility rule and the six rendering rows, as are all the other sections and the earlier acceptance criteria. **Cross-reference amendment (#131) — Accepted 2026-10-07, at `0e81e98`, by the owner, on the second pass. The first pass trimmed it to cross-references only.** It adds cross-references only. They record that session-redirect responsibility belongs to the [session routing spec](2026-10-07-session-routing-design.md), and make no second design decision. Its delta is confined to the Status, Date and Followed-by rows, this row, §2 Informative, §4.2 (the role-staleness note), §4.5, §4.6 (the two expired-session rows), §10 and §11. It changes no locked decision. The gate's file, its cache-first read, its six rendering rows and §5 invariant 6 ("the gate MUST NOT redirect, route to `/login`, or inspect API errors") are unchanged, as are all the other sections and acceptance criteria 1–9. **Title amendment (#143) — Accepted 2026-10-08, at `c780fbc`, by the owner, on the second pass, reviewed together with the [document titles spec](2026-10-08-app-document-titles-design.md).** It supersedes only the §4.3 bullet "It does not change the document `<title>`" and the `<title>` clause of the §6 non-goal, and it adds the Followed-by link and a §10 criterion. The gate's title ownership, copy and verification are specified in the document titles spec, not here. Its delta is confined to the Status, Date, Tracking, Followed-by and M3 decision rows, §4.3, §6, §10 and §11. Every locked decision above is unchanged, including the visibility rule, the gate decision, the six rendering rows and their visible output, the unavailable state's heading, link and copy, and every earlier acceptance criterion. |
| M3 history | First pass (2026-10-04) accepted the direction and returned the spec with six required changes and four clarifications, all applied without changing the decision. **Required:** `/app` and unknown/unlisted paths render without waiting for principal data (§4.1 `isGatedPath`, §4.2 row 0); segment-boundary semantics for `findActiveHref` (§4.1, §8); `PLATFORM_HOME_HREF` reserved as a non-nav path (§4.1, §5 invariant 9); "never mount" defined as the page component and its hooks never executing (§3, §4.2, §8); the cold-load serialization stated as an explicit trade-off (§4.2, §7); copy changed to "This page isn't available to you." (§4.4). **Clarifications:** the `/app/admin` redirect lifecycle (§4.5); a systematic nested-path assertion (§8); the term *shell-hidden page* (§3); the copy now covers scope as well as role (§4.3). |

## 1. Primary question and thesis

**Question:** What does a shell-hidden `/app` page show when a user reaches it by typing or bookmarking its URL?

**Thesis:** The `/app` layout owns a single client-side **page-visibility gate**. The gate derives page visibility from the existing navigation configuration (`NAV_GROUPS[].viewRoles`) and the platform landing rule (`PLATFORM_HOME_HREF`). When the requested path is outside the principal's shell-visible scope, it renders one shared "not available" state instead of the page. It does not redirect, it does not perform or replace API authorization, and it adds no second page-to-role mapping. Paths with no visibility rule (`/app` and unknown/unlisted paths) pass straight through, without the gate waiting for the principal.

The issue's title says "role-hidden". This spec uses **shell-hidden** (§3), because the same mechanism also handles scope: a `PLATFORM` principal on a tenant page, and a `TENANT` principal on `/app/platform`.

### 1.1 Background (state on `main` at `fb12aea`)

- `apps/web/middleware.ts` only redirects when the session cookie is missing. No route under `apps/web/app/app/` makes a shared role or scope decision.
- From `NAV_GROUPS` in `apps/web/lib/nav-groups.ts`, the role-hidden tenant pages are:
  - `/app/customers`, hidden from `FINANCE`;
  - `/app/cleaners` and `/app/cleaners/teams`, hidden from `CUSTOMER_SUPPORT` and `FINANCE`;
  - `/app/admin`, hidden from every role except `TENANT_OWNER`.
  
  Every tenant page is scope-hidden from a `PLATFORM` principal, because `visibleNavGroups` returns nothing for a non-`TENANT` scope. `/app/platform` (`PLATFORM_HOME_HREF`) is the Super Admin landing, is not a nav item, and is scope-hidden from `TENANT` principals.
- What a typed URL shows today:
  - Most shell-hidden pages show their generic `ErrorState`, for example "Unable to load teams.", from the API's `FORBIDDEN`. That reads as a failure, not as "not available to you."
  - `/app/admin` already shows `staff.page.notAuthorized`, through `canManageStaff` in `apps/web/lib/staff-console.ts`. That is a second, page-local copy of the `/app/admin` visibility rule. The issue's `/app/admin` example ("raw `Forbidden`") predates it.
  - A tenant user who opens `/app/platform` sees the Super Admin placeholder with no error, because that page makes no API call.
- `findActiveHref` already matches on segment boundaries: `pathname === href || pathname.startsWith(`${href}/`)`, longest match wins. §4.1 makes that a contract.
- Security is not affected. The API stays the authorization boundary, and the #92 release gate pins `FORBIDDEN` for every denied role. This is a UX gap only.

## 2. Scope

### In scope (normative)

- Two pure presentation rules in `apps/web/lib/nav-groups.ts`: `isGatedPath(pathname)` and `canViewPath(principal, pathname)` (§4.1).
- A client component `PageVisibilityGate` in `apps/web/components/layout/`, mounted once by `apps/web/app/app/layout.tsx` (§4.2).
- One shared "not available" state with a recovery link to `landingHref(principal)` (§4.3), and its `en` copy in `apps/web/messages/en/nav.json` (§4.4).
- Retirement of `canManageStaff` and the `staff.page.notAuthorized` message key (§4.5).
- Every shell-hidden `/app/*` page, including `/app/platform` for tenant principals.

### Informative

- Bookings, jobs, laundry, billing, services and add-ons are visible to every tenant role today. They are gated paths under the same rule, so they are covered automatically if a later change narrows their `viewRoles`.
- Session handling is inconsistent today: only `/app` and `/app/admin` send a missing or invalid `currentAdmin` to `/login`. This spec preserves that and does not resolve it (§4.2, §11). *(#131)* Responsibility for this now belongs to the [session routing spec](2026-10-07-session-routing-design.md). The gate is unchanged and is not a session boundary.

### Out of scope (normative)

- Any API authorization change, and relation-level RBAC ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106)).
- Session and expiry routing (`/login` redirects) on any page.
- Redirecting denied users anywhere (issue option B).
- Mapping API `FORBIDDEN` errors to friendly messages (issue option C).
- Changes to `middleware.ts`, the sidebar, the header, the user menu, `findActiveHref`'s behavior, or `landingTarget`.
- Locales other than `en`.

## 3. Terminology

| Term | Meaning in this spec |
| --- | --- |
| **Principal** | The `currentAdmin` result's `{ role, scope }`, as `NavPrincipal` in `nav-groups.ts`. |
| **Shell visibility policy** | The rules already in `nav-groups.ts`: `NAV_GROUPS[].viewRoles`, `visibleNavGroups`, `findActiveHref`, `PLATFORM_HOME_HREF` and `landingHref`. |
| **Segment match** | `pathname` *segment-matches* `href` when `pathname === href` or `pathname.startsWith(`${href}/`)`. Plain string prefixes do not count: `/app/customers-old` does not segment-match `/app/customers`. |
| **Platform path** | A pathname that segment-matches `PLATFORM_HOME_HREF`. |
| **Gated path** | A pathname for which `findActiveHref` returns a nav href, or a platform path. These are the only paths that need a visibility decision. |
| **Ungated path** | Any other pathname: `/app` itself and every unknown/unlisted path. These paths have no shell visibility rule. "Unknown/unlisted" does not mean that Next.js fails to recognize the route. |
| **Viewable path** | A pathname for which `canViewPath(principal, pathname)` is `true`. Presentation only; it says nothing about whether an API operation is authorized. |
| **Shell-hidden page** | A gated path that is not viewable for some principal, whether because of role (`viewRoles`) or scope (`TENANT` vs `PLATFORM`). |
| **Not mounted** | The page component (the gate's `children` element) is never rendered: its function body never runs, so none of its hooks, effects or data-query hooks execute. Absence from the DOM alone does not satisfy this. |
| **Unavailable state** | The shared "not available" rendering of §4.3. |

## 4. Contracts

### 4.1 `isGatedPath` and `canViewPath`

Both are exported from `apps/web/lib/nav-groups.ts`. Their documentation MUST state that they are *client-side presentation rules derived from the shell navigation policy, and that they do not grant, deny, or replace API authorization.* Neither may be named or described as an authorization function.

**`isGatedPath(pathname: string): boolean`** is `true` exactly when `pathname` is a gated path (§3): `findActiveHref(pathname)` returns an href, or `pathname` is a platform path. It needs no principal.

**`canViewPath(principal: NavPrincipal, pathname: string): boolean`**, evaluated in this order:

1. **Nav item.** If `findActiveHref(pathname)` returns href `h`, the result is `true` exactly when `visibleNavGroups(principal)` contains an item with href `h`.
2. **Platform path.** If `pathname` is a platform path, the result is `principal.scope === 'PLATFORM'`.
3. **Ungated path.** Otherwise the result is `true`. This covers both `/app` and unknown/unlisted paths.

Requirements:

- **Segment boundaries.** `findActiveHref` MUST keep its current segment-match semantics (§3), which the sidebar's active-state resolution also uses. A nav href matches only when the pathname equals it or lies beneath it as a path segment, and the longest matching href wins. For example:
  - `/app/cleaners/teams/x` resolves to `/app/cleaners/teams`.
  - `/app/cleaners/teams-extra` does **not** resolve to `/app/cleaners/teams`. It resolves to `/app/cleaners`, because it lies beneath that href.
  - `/app/customers-old` resolves to nothing and is ungated.
  - *(#134)* `/app/admin/` segment-matches `/app/admin`: it starts with `/app/admin/`, so it lies beneath that href and resolves to it. It is therefore gated and viewable exactly when `/app/admin` is. This states the existing semantics; it does not change them.
- **Reserved platform path.** `PLATFORM_HOME_HREF` is a reserved non-nav shell path. No `NAV_GROUPS` href may segment-match it, and it may not segment-match any `NAV_GROUPS` href (§5 invariant 9). Rule 1 can therefore never shadow rule 2, or the reverse.
- **No new data.** These functions read only `NAV_GROUPS` (through `findActiveHref` and `visibleNavGroups`) and `PLATFORM_HOME_HREF`. They MUST NOT introduce any new list, map or table of paths, roles or scopes.
- **Consistency with the sidebar.** For every nav href `h` and every principal `p`, `canViewPath(p, h)` MUST equal "`visibleNavGroups(p)` contains an item with href `h`". The same holds for every path beneath `h` that resolves to `h`.
- **Purity.** No I/O, no React, no `tenantId` (multi-tenant spec §3/§4.1 — scope first).

### 4.2 `PageVisibilityGate`

`PageVisibilityGate({ children })` is a client component in `apps/web/components/layout/page-visibility-gate.tsx`. `apps/web/app/app/layout.tsx` mounts it exactly once, directly inside `DashboardLayout`:

```tsx
<AppI18nProvider>
  <DashboardLayout>
    <PageVisibilityGate>{children}</PageVisibilityGate>
  </DashboardLayout>
</AppI18nProvider>
```

As a result, shell chrome (sidebar, header, user menu) renders as it does today on every path; only the page body inside `<main>` is affected.

**Inputs.**

- `usePathname()`, with `null` treated as `''`. `''` is ungated.
- `useCurrentAdminQuery()` with the **default (cache-first) fetch policy**. The gate MUST NOT pass `fetchPolicy`, and MUST NOT introduce a `network-only` or other variant. The hook is called unconditionally on every render, as React's rules of hooks require. It shares the Apollo cache entry the sidebar and user menu already read, so it adds no request beyond theirs, even on ungated paths. Pages that query `currentAdmin` with `network-only` continue to do so, unchanged.

**Rendering**, evaluated in this order (`principal = data?.currentAdmin`):

| # | Condition | Renders |
| --- | --- | --- |
| 0 | `!isGatedPath(pathname)`, i.e. `/app` or an unknown/unlisted path | `children`, immediately, whatever the query state |
| 1 | `principal` is present and `canViewPath(principal, pathname)` | `children` |
| 2 | `principal` is present and not `canViewPath(principal, pathname)` | The unavailable state (§4.3). `children` are **not mounted**. |
| 3 | No `principal`, and `error` is set | `children`, unchanged |
| 4 | No `principal`, no `error`, and `loading` | `LoadingState` from `@clensy/ui`, with `message` set to the existing `nav.landing.loading` copy. `children` are **not mounted**. |
| 5 | Otherwise (query settled with `currentAdmin` null) | `children`, unchanged |

Consequences, all normative:

- **Ungated paths do not depend on the principal.** `/app` keeps today's landing behavior exactly: the landing page mounts at once and runs its own `currentAdmin` read and redirect. An unknown/unlisted path reaches Next.js not-found at once.
- **"Loading" means no principal data yet.** If a cached principal is present while Apollo reports `loading: true` during a refetch, rows 1–2 apply immediately. The gate MUST NOT regress to `LoadingState` because of a refetch.
- **A denied page is not mounted** (§3), before or after the decision (rows 2 and 4). Its hooks and data queries therefore never execute.
- **The gate is not a session boundary.** It MUST NOT redirect, MUST NOT route to `/login`, and MUST NOT inspect API error codes or messages. On rows 3 and 5 the page mounts and keeps exactly its current behavior.
- **Role staleness is accepted.** The gate evaluates the cached principal. It does not track a role change made elsewhere mid-session, which is the same as the sidebar. The API enforces the current role on every operation regardless. *(#131)* This contract is unchanged: the gate still reads cache-first, passes no `fetchPolicy` (§5 invariant 4), and is not a session boundary. Any effect of the [session routing spec](2026-10-07-session-routing-design.md)'s session check on the shared cache is owned by that spec.
- **Cold-load serialization (an explicit trade-off).** The gate serializes the initial rendering of every gated page's subtree behind the cache-first `currentAdmin` result. This includes pages visible to every role, such as `/app/bookings`. On a cold load such a page's own queries now start after `currentAdmin` resolves, where today they start alongside it, so the first data appears one round trip later. Navigation within the session is served from the cache and is not delayed. Ungated paths are not serialized.

### 4.3 The unavailable state

*Amended by #132 (Accepted).* `UnavailableState` is a page-level shell state implemented as a module-local component in `page-visibility-gate.tsx`. The gate renders it with the existing unavailable message as its single `<h1>`. It does not compose `EmptyState`.

- **Heading:** an `<h1>` whose text is `nav.unavailable.message`. It is the state's only heading. There is no additional generic heading such as "Unavailable", and no visually hidden duplicate of the message.
- **Action:** after the heading, a `next/link` `Link` to `landingHref(principal)`, labelled `nav.unavailable.action`. *(#134)* The `Link` is rendered through `@clensy/ui` `Button` with `asChild` and `variant="link"`, so the rendered element is still a single anchor, with Button's link styling. If `landingHref(principal)` is `undefined`, the action is omitted and the heading renders alone. That cannot happen with today's role matrix, because every tenant role sees `/app/bookings` and Super Admin lands on `/app/platform`, but the contract defines it.
- **Presentation:** the visual treatment stays as it is before #132: the same centered container styling previously used by `EmptyState`, and the message at its current `text-sm` slate size and colour. The heading level is semantic and does not imply heading styling. It does not use `PageHeader`. *(#134)* The exception is the home link, which takes Button's `link` variant as-is: `text-primary`, an underline on hover only, and Button's base box (default size) and focus-visible ring. It replaces the former hand-written `text-sm font-medium text-slate-900 underline underline-offset-4` classes, and the slice adds no class overrides to compensate.

Requirements:

- It is shell chrome, not a domain component. It lives in `apps/web` and adds nothing to `@clensy/ui` or `@clensy/web` (multi-tenant spec §4.8 is unaffected). *(#132)* `@clensy/ui`'s `EmptyState` and its API are unchanged. `EmptyState` renders its `message` string in a `<p>`, so the state renders its own markup rather than widening that shared API for a single caller.
- *(#132)* It adds no live region, `role="status"`/`role="alert"` or landmark. The `<h1>` is the cue for heading navigation, and a live region would announce the message a second time.
- ~~*(#132)* It does not change the document `<title>`. Every `/app` page shares the root layout's `metadata.title` ("Clensy"), so a page-specific title would be an app-wide metadata decision (§11).~~ *(#143)* Superseded by the [document titles spec](2026-10-08-app-document-titles-design.md) §4.3: the gate renders the document title for every row, and the unavailable state's title is `Page unavailable · Clensy`. The unavailable state's heading, link, copy and presentation are unchanged.
- Its copy covers both role and scope denial. It MUST NOT name the roles or scopes that could view the page, and MUST NOT state or imply that an API operation was attempted or denied.
- It renders identically for every denied path. There is no per-page copy.
- *(#134)* **Shell-link convention.** A standalone navigation action in shell chrome, such as this home link, uses `@clensy/ui` `Button asChild variant="link"` wrapping `next/link` `Link`, not hand-written link classes. The convention does not cover inline links within data. The existing inline links in the `<dd>` of the invoice and laundry detail views (`app/app/billing/page.tsx`, `app/app/laundry/page.tsx`) are out of scope and unchanged. No `@clensy/ui` export is added or changed.

### 4.4 Copy

Two keys are added to `apps/web/messages/en/nav.json` under a new `unavailable` object, alongside `landing`:

| Key | `en` text |
| --- | --- |
| `nav.unavailable.message` | This page isn't available to you. |
| `nav.unavailable.action` | Go to your home page |

They are read with next-intl `useTranslations('nav')`, as `app/app/page.tsx` reads `nav.landing.*`. The gate's loading row reuses `nav.landing.loading`; no loading key is added.

### 4.5 Retirement of the page-local `/app/admin` rule

`canManageStaff` (`scope === 'TENANT' && role === 'TENANT_OWNER'`) is exactly `canViewPath(principal, '/app/admin')` under §4.1 (`viewRoles: ['TENANT_OWNER']`, `TENANT` scope). Therefore:

- `apps/web/app/app/admin/page.tsx` drops its `canManageStaff` branch and its use of `staff.page.notAuthorized`. It keeps its own `currentAdmin` read (`network-only`), its `/login` redirect on error or null, and its use of `currentAdmin.id` for `StaffConsole`.
- **The redirect lifecycle is unchanged.** Whenever the gate mounts the admin page (rows 1, 3 and 5), the page's own redirect effect runs exactly as it does today. In particular, on rows 3 and 5 (no principal) the gate passes the page through, so the gate never suppresses or replaces that redirect. When the gate denies the path (row 2), the page is not mounted, and the gate's principal was present, so there is no session to redirect. *(#131)* Responsibility for this page-local `/login` redirect moves to the [session routing spec](2026-10-07-session-routing-design.md) (§4.5 there). The gate's rows for `/app/admin` and its pass-through on rows 3 and 5 are unchanged.
- `canManageStaff` is removed from `apps/web/lib/staff-console.ts`, together with its unit test.
- The `tenant-role-regressions.test.ts` assertion that the admin page calls `canManageStaff(` is replaced by the §8 regressions.
- `staff.page.notAuthorized` is removed from `packages/web/src/i18n/messages/en/staff.ts` if, at M4, the admin page is its only consumer. That is the state on `fb12aea`.

### 4.6 Worked examples

| Principal | Path | Gate row | Renders | Recovery link |
| --- | --- | --- | --- | --- |
| `FINANCE` / `TENANT` | `/app/customers` | 2 | Unavailable state | `/app/bookings` |
| `CUSTOMER_SUPPORT` / `TENANT` | `/app/cleaners/teams` | 2 | Unavailable state | `/app/bookings` |
| `CUSTOMER_SUPPORT` / `TENANT` | `/app/cleaners/teams-extra` (resolves to `/app/cleaners`) | 2 | Unavailable state | `/app/bookings` |
| `OPS_MANAGER` / `TENANT` | `/app/admin` | 2 | Unavailable state (previously `staff.page.notAuthorized`) | `/app/bookings` |
| `SUPER_ADMIN` / `PLATFORM` | `/app/bookings` | 2 | Unavailable state | `/app/platform` |
| `SCHEDULER` / `TENANT` | `/app/platform` | 2 | Unavailable state | `/app/bookings` |
| `TENANT_OWNER` / `TENANT` | `/app/admin` | 1 | The staff console | — |
| `SUPER_ADMIN` / `PLATFORM` | `/app/platform` | 1 | The platform placeholder | — |
| Any, including still loading | `/app` | 0 | `children` at once (the existing landing redirect) | — |
| Any, including still loading | `/app/does-not-exist` or `/app/customers-old` | 0 | `children` at once (Next.js not-found) | — |
| Expired session (cookie present, `currentAdmin` errors) | `/app/cleaners` | 3 | `children` (the page's own error, unchanged) | — |
| Expired session | `/app/admin` | 3 | `children`; the page's existing `/login` redirect runs | — |

*(#131)* In the last two rows the gate's behavior (row 3, `children`) is unchanged. Responsibility for the session redirect belongs to the [session routing spec](2026-10-07-session-routing-design.md); see §4.7 there.

## 5. Invariants (MUST / MUST NOT)

1. The gate, `isGatedPath` and `canViewPath` MUST NOT be, or be documented as, authorization. API authorization is unchanged. A denial by the gate MUST NOT be treated as evidence that the corresponding API operation is unauthorized, and an allowed path grants nothing (multi-tenant spec §4.2, §5 invariant 13).
2. Page visibility MUST be derived only from `NAV_GROUPS` and `PLATFORM_HOME_HREF`. `apps/web/lib/nav-groups.ts` MUST remain the only non-test source file in `apps/web` that contains the token `viewRoles`. No page-level or gate-level role or scope rule may be added.
3. `canViewPath` and `visibleNavGroups` MUST agree on every nav href, and on every path beneath it that resolves to it, for every principal.
4. The gate MUST use `useCurrentAdminQuery()` with the default cache-first policy, and MUST NOT pass `fetchPolicy`.
5. A denied page MUST NOT be mounted (§3). On a gated path it also MUST NOT be mounted while the principal is unknown and no error has occurred.
6. The gate MUST NOT redirect, route to `/login`, or inspect API errors. With no principal on a gated path, it passes `children` through unchanged.
7. The gate MUST be mounted exactly once, in `apps/web/app/app/layout.tsx`, inside `DashboardLayout`. No page mounts its own gate.
8. The unavailable state MUST be the same for every denied path, with its recovery target taken only from `landingHref(principal)`.
9. `PLATFORM_HOME_HREF` MUST NOT segment-match any `NAV_GROUPS` href, and no `NAV_GROUPS` href may segment-match it.
10. Ungated paths (`/app` and unknown/unlisted paths) MUST render `children` without waiting on principal data.
11. `findActiveHref` MUST keep segment-match, longest-match semantics.

## 6. Goals and non-goals

**Goals**

- A user who types or bookmarks a shell-hidden page sees a deliberate "not available to you" state with one way back to their home page.
- One visibility rule shared by the sidebar, the landing redirect and the gate. Future nav entries are covered by their `viewRoles` alone.
- Denied pages don't execute their hooks or data queries.
- `/app` and unknown/unlisted paths behave exactly as today.
- *(#132)* A screen-reader user who lands on a denied page can reach the unavailable message as the page's `<h1>` by heading navigation.

**Non-goals**

- Hardening security. The API is already the boundary, and nothing here changes it.
- Redirects of any kind, including for denied paths, unknown paths, or expired sessions.
- Unifying session/expiry handling across pages.
- Friendly mapping of `FORBIDDEN` or other API errors on pages.
- Hiding or gating unknown/unlisted paths.
- Per-page, per-role, or per-tenant copy for the unavailable state.
- Gating individual actions or fields within a visible page (relation-level RBAC is #106).
- *(#132)* ~~Changing the document `<title>`,~~ adding a live region, or changing `@clensy/ui`'s `EmptyState` for the unavailable state. *(#143)* The document title is no longer a non-goal; it is owned by the gate under the [document titles spec](2026-10-08-app-document-titles-design.md).
- *(#134)* Migrating inline data links (billing, laundry) to `Button`, adding or changing a `@clensy/ui` `Button` variant or size, or overriding the `link` variant's styling for the unavailable state.

## 7. Rationale

- **A shared state instead of a redirect (option B).** A redirect silently sends the user somewhere they didn't ask for, and makes a shared or bookmarked URL look broken. An explicit state with one recovery link explains what happened and still gets them home.
- **A shared state instead of `FORBIDDEN` mapping (option C).**
  - Error mapping must be repeated on every page and still runs the denied query.
  - It cannot cover `/app/platform`, which makes no API call, so there is nothing to map.
  - It would also tie UX copy to API error shapes.
- **Gating in the layout, not per page.** One mount point means a new page is covered without remembering to opt in, and the page-local `canManageStaff` copy disappears. The layout already owns the shell, and `<main>` is the natural replacement boundary.
- **Deriving from `NAV_GROUPS`.** The issue requires reusing the shell's visibility rules. `viewRoles` already mirrors each destination's API read gate, and the sidebar and landing redirect already depend on it, so one source keeps all three consistent.
- **Deciding "gated?" before "visible?".** The gate exists only to make a visibility decision. A path with no rule needs no principal, so it is rendered at once. This keeps `/app` and not-found behavior identical to today, and limits the cold-load cost to pages that actually have a rule.
- **Unknown/unlisted paths are viewable.** They have no navigation rule. Denying them would turn a presentation helper into an implicit route firewall and would mask Next.js's not-found handling.
- **Reserving `PLATFORM_HOME_HREF`.** `canViewPath` has two resolution mechanisms: nav items, and the platform path. Forbidding overlap makes their precedence irrelevant, so a future `NAV_GROUPS` entry can't silently have its `viewRoles` ignored. Platform navigation, if it arrives, is a spec amendment (§11).
- **Passing children through on error or null.** Making the gate own session semantics would widen #114 into authentication UX and duplicate the `/app` and `/app/admin` redirects. Preserving each page's current behavior keeps this slice's blast radius at visibility only.
- **Cache-first, with serialization accepted.** Sharing the sidebar's existing read makes in-session navigation instant. The price is one extra round trip before a gated page's first data on a cold load (§4.2). The alternative, mounting the page before the decision, would let a denied page run its hooks and queries, which defeats the gate. A `network-only` gate would add that round trip to every navigation.

## 8. Verification contract

These are acceptance anchors for M4–M7. Test file names are planning decisions.

1. **Path rules** (unit, `apps/web/lib/nav-groups.test.ts`):
   - **Matrix:** every `Role` × `AdminScope` × nav href, with `canViewPath` asserted equal to `visibleNavGroups` membership.
   - **Systematic nesting:** for every nav href `h` and every principal, `canViewPath(p, `${h}/nested`) === canViewPath(p, h)`.
   - **Segment boundaries:**
     - `/app/customers-old` and `/app/customers2` are ungated and viewable for every principal.
     - `/app/cleaners/teams-extra` resolves to the Cleaners rule, not the Teams rule: `findActiveHref` returns `/app/cleaners`. The assertion is on `findActiveHref` itself, because Cleaners and Teams have identical `viewRoles` today and a role check alone could not tell them apart.
     - `/app/platformx` is ungated.
   - **Gating:**
     - `isGatedPath` is `true` for every nav href and every path beneath one, and for `/app/platform` and `/app/platform/x`.
     - `isGatedPath` is `false` for `/app`, `''`, `/app/does-not-exist` and the segment-boundary examples above.
   - **Ungated paths:** `/app` and `/app/does-not-exist` are viewable for every principal.
   - **Platform paths:** `/app/platform` and `/app/platform/x` are viewable only for `PLATFORM` scope.
   - **Reserved path:** no `NAV_GROUPS` href segment-matches `PLATFORM_HOME_HREF`, and it segment-matches none of them (invariant 9).
   - **Trailing slash** *(#134)*: `/app/admin/` segment-matches `/app/admin`. `findActiveHref('/app/admin/')` returns `/app/admin`, `isGatedPath('/app/admin/')` is `true`, and for every principal `canViewPath(p, '/app/admin/') === canViewPath(p, '/app/admin')`. `next.config.ts` sets no `trailingSlash`, so Next's default 308 normalizes this path before the gate sees it today. The row guards against a future `trailingSlash: true` silently changing gating.
2. **Gate behavior** (component tests). The child is a probe *component* that records each invocation of its function body and calls a mocked data-query hook. "Not mounted" is asserted as zero invocations and zero hook calls, not merely as absence from the DOM.
   - **Ungated:** on `/app` and on an unknown/unlisted path, while `currentAdmin` is still loading, the probe is mounted immediately and `LoadingState` is not rendered.
   - **Loading on a gated path:** with no data, the gate renders `LoadingState` and the probe is not mounted.
   - **Cached principal during refetch** (`loading: true` with data): the gate evaluates immediately, rendering the probe or the unavailable state, never `LoadingState`.
   - **Error, and settled null, on a gated path:** the probe is mounted.
   - **Allowed:** the probe is mounted.
   - **Denied:** the unavailable state renders with the `landingHref(principal)` link, and the probe is not mounted.
   - **Cross-scope:** `SUPER_ADMIN`/`PLATFORM` on a tenant page is denied with a `/app/platform` link, and a tenant principal on `/app/platform` is denied.
   - **No landing:** for a principal whose `landingHref` is `undefined` (for example the inconsistent `SUPER_ADMIN`/`TENANT` pair, which sees no nav items), a denied path renders the state without an action.
   - **Heading** *(#132)*: in each of the Denied, Cross-scope and No-landing cases, the rendered output has exactly one heading. It is level 1, and its accessible name is the `nav.unavailable.message` text. The link assertions above are unchanged.
   - **Home link** *(#134)*: in the Denied and Cross-scope cases, the single link keeps its accessible name (`nav.unavailable.action`) and its `landingHref(principal)` href, and it is rendered through Button's link variant (`data-slot="button"`, `data-variant="link"`) on the anchor itself.
3. **Source regressions**, in the style of the existing `web-shell-regressions.test.ts` / `tenant-role-regressions.test.ts`:
   - `app/app/layout.tsx` mounts `PageVisibilityGate` inside `DashboardLayout`.
   - The gate's `useCurrentAdminQuery` call passes no `fetchPolicy`.
   - `app/app/admin/page.tsx` no longer references `canManageStaff` or `notAuthorized`.
   - `lib/nav-groups.ts` is the only non-test `apps/web` source file containing `viewRoles` (invariant 2).
4. **Copy:** `nav.unavailable.message` and `nav.unavailable.action` exist in `apps/web/messages/en/nav.json` with the §4.4 text.
5. **Existing suites stay green:** `apps/web` unit/component tests, typecheck, lint, the `@clensy/web` tests (after the §4.5 key removal), and the API suites. No API source changes.

## 9. Traceability

| Dependency | Relationship |
| --- | --- |
| Multi-Tenant Architecture §4.2, §4.8, §5 invariant 13 | **Relied upon** unchanged. This spec is the "shell MAY reflect scope / role for UX" allowance of §4.8, bounded by invariant 13. |
| Web Shell and Design System | **Relied upon**: the single `/app` layout. One component is added inside it, and shell chrome is unchanged. |
| Single App-Level `ClensyI18nProvider` | **Relied upon**: `AppI18nProvider` stays outermost, and the gate's copy uses next-intl, not `@clensy/web`. |
| `@clensy/ui` Shared UI System | **Relied upon**: `LoadingState` is used as-is. *(#132)* `EmptyState` is no longer used by the gate (§4.3). Its API is unchanged, and no `@clensy/ui` export is added or changed. *(#134)* `Button` is used as-is, with `asChild` and `variant="link"`, for the home link (§4.3). |
| #89 shell slice (`nav-groups.ts`, `landing-target.ts`) | **Extended** with `isGatedPath` and `canViewPath`. `findActiveHref`'s segment semantics are made contractual, not changed. `visibleNavGroups`, `landingHref` and `landingTarget` are unchanged. |
| Staff Administration UI (#88), `canManageStaff` | **Superseded** for the page-visibility decision only (§4.5). The staff console's mutations, error mapping, `/login` redirect and API gates are unchanged. |

## 10. Acceptance criteria (for this specification)

This specification may move from Draft to Accepted at M3 when the reviewer agrees that:

1. The decision (shared layout gate plus shared state; no redirect, no error mapping) is locked and justified (§1, §7).
2. `isGatedPath` and `canViewPath`, their resolution order, segment-boundary semantics, the reserved platform path, and the single-source requirement are unambiguous (§4.1, §5 invariants 2–3, 9, 11).
3. The gate's six rendering rows, the cache-first requirement, the ungated pass-through, the definition of "not mounted", and the "no principal ⇒ children unchanged" rule are unambiguous (§3, §4.2, §5 invariants 4–6, 10).
4. The cold-load serialization trade-off is stated explicitly and accepted (§4.2, §7).
5. The unavailable state, its copy, and the `canManageStaff` / `staff.page.notAuthorized` retirement, including the unchanged `/app/admin` redirect lifecycle, are specified without leaving product decisions to M4 (§4.3–§4.5).
6. Every shell-hidden page, including `/app/platform` for tenant principals, is covered by the worked examples and the verification contract (§4.6, §8).
7. Nothing here changes API authorization or contradicts the Accepted multi-tenant RFC (§5 invariant 1, §9).

**§4.3 amendment (#132).** Criteria 1–7 are unaffected and stay met. The amendment may move from Draft to Accepted at M3 when the reviewer agrees that:

8. The unavailable state's single `<h1>` (the existing message), its unchanged presentation and link, and its decision not to compose `EmptyState` are unambiguous. The exclusions are explicit: no title change, no live region, no `@clensy/ui` change. They are verified by the §8 item 2 heading assertion and leave the copy, the visibility rule, the six rendering rows and the API unchanged (§4.3, §6, §9).

**§4.3 amendment (#134).** Criteria 1–8 are unaffected and stay met. The amendment may move from Draft to Accepted at M3 when the reviewer agrees that:

9. The home link's rendering through `Button asChild variant="link"`, its accepted visual change, and the shell-link convention's boundary (standalone shell actions only; the billing and laundry inline links unchanged; no `@clensy/ui` change) are unambiguous, and the `/app/admin/` trailing-slash row pins the existing segment-match semantics without changing them. They are verified by the §8 item 1 trailing-slash row and the §8 item 2 home-link assertion, and leave the copy, the heading, the link's target, the visibility rule, the six rendering rows and the API unchanged (§4.1, §4.3, §6, §8, §9).

**Cross-reference amendment (#131).** Criteria 1–9 are unaffected and stay met. The amendment may move from Draft to Accepted at M3 when the reviewer agrees that:

10. The amendment only points to the [session routing spec](2026-10-07-session-routing-design.md). It does not change the gate's contract, its six rendering rows, its cache-first read or §5 invariant 6. Each annotation (§2, §4.2, §4.5, §4.6, §11) only states where session-redirect responsibility now lives, and makes no design decision of its own.

**Title amendment (#143).** Criteria 1–10 are unaffected and stay met. The amendment may move from Draft to Accepted at M3, together with the document titles spec, when the reviewer agrees that:

11. Only the two "no title change" clauses (§4.3, §6) are superseded, each pointing to the document titles spec, and no other contract in this spec changes (§4.3, §6, §11).

## 11. Explicit deferrals

- **Session/expiry routing across `/app` pages.** Only `/app` and `/app/admin` route a missing or invalid `currentAdmin` to `/login`. Unifying this is a separate authentication-UX concern and needs its own issue. *(#131)* Opened as #131 and specified in the [session routing spec](2026-10-07-session-routing-design.md).
- **Platform navigation.** `/app/platform` stays a single placeholder that is not a nav item (multi-tenant spec §10), and it is reserved under §5 invariant 9. Adding platform nav items requires a spec amendment that revisits §4.1 rule 2 and invariant 9.
- **Additional locales** for `nav.unavailable.*`.
- **Page-specific document titles** *(#132)*. Every `/app` page shares the root layout's "Clensy" title. Giving pages, including the unavailable state, their own titles is an app-wide metadata decision. *(#134)* Tracked by [#143](https://github.com/rexescario-dev/clensy-platform/issues/143), which needs its own specification. *(#143)* Resolved by the [document titles spec](2026-10-08-app-document-titles-design.md).
- ~~**`Button asChild variant="link"` for the home link**~~ *(#132)*. *(#134)* Resolved by the #134 amendment: adopted as the shell-link convention for standalone shell actions (§4.3).
- ~~**A trailing-slash row (`/app/admin/`) in `lib/nav-groups.test.ts`**~~ *(#132)*. *(#134)* Resolved by the #134 amendment (§4.1, §8 item 1).
