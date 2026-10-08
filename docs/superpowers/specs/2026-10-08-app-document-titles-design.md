# Page-Specific Document Titles for `/app` Pages — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-10-08 |
| Document kind | Architecture RFC |
| Tracking issue | [#143](https://github.com/rexescario-dev/clensy-platform/issues/143) — split from [#134](https://github.com/rexescario-dev/clensy-platform/issues/134) item 1, implemented in PR [#150](https://github.com/rexescario-dev/clensy-platform/pull/150), first deferred by the #132 amendment to the role-aware typed-URL spec (§11). Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| Depends on (Accepted) | [Role-Aware Experience for Typed URLs of Role-Hidden Pages](2026-10-04-role-aware-typed-urls-design.md) — **extended**: `PageVisibilityGate` becomes the owner of the `/app` document title (§4.3). This spec **supersedes** that spec's §4.3 requirement that the unavailable state "does not change the document `<title>`" and its §6 non-goal "Changing the document `<title>`", through a slice-local amendment (#143) to that spec. Its visibility rule, gate decision, rendering rows, copy and invariants are otherwise **relied upon** unchanged. [Web Shell and Design System](2026-09-10-web-shell-and-design-system-design.md) — **relied upon**: `apps/web/app/app/layout.tsx` remains the single `/app/*` layout; no layout file is added under `/app`. [Single App-Level `ClensyI18nProvider`](2026-10-02-single-app-i18n-provider-design.md) — **relied upon** unchanged; the title copy uses next-intl `nav` messages, not `@clensy/web`. [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — **relied upon**: no `@clensy/ui` change. |
| Related (not a dependency) | The #89 tenant-aware shell slice introduced `NAV_GROUPS[].labelKey` and `findActiveHref` in `apps/web/lib/nav-groups.ts`, reused here. |
| Followed by | None. |
| M3 decision | **Accepted** — 2026-10-08, at `c780fbc`, by the owner, on the second pass, with no further revision, together with the role-aware typed-URL spec's title amendment (#143). M4 implements it mechanically and MUST keep the locked decisions: `pageTitleKey` derived only from `NAV_GROUPS` and `PLATFORM_HOME_HREF`, sharing path matching but not `canViewPath`'s decision, with `undefined` becoming `nav.documentTitle.app` only at the gate; one React `<title>` contribution per gate row from `PageVisibilityGate`, describing the rendered row, with the loading row path-derived from the same resolver; titles formatted only through the §4.2 keys; no root `metadata.title`; `/login` keeps exactly one `Clensy` title (mechanism only is M4's); no `/app` layout added; visibility, gate decision, visible rows and API unchanged; verification by Vitest plus the recorded server-render and client-navigation evidence. |
| M3 history | First pass (2026-10-08) kept the architecture and returned four required changes and three hardening items, all applied without changing a decision. **Required:** `pageTitleKey`'s `undefined` is intentional and becomes the app title only at the gate (§4.1, §4.3, §5 invariant 1); title ownership is stated as one React `<title>` contribution per gate row, which React hoists into `<head>`, with no DOM relationship to the row's body (§3, §4.3, §5 invariant 2); the effective-title invariant has an explicit lifecycle, so a server loading title may legitimately change once the gate settles (§5 invariant 4); the announcement goal and the recorded browser check are limited to navigations whose resolved title changes (§2, §6, §8 item 5). **Hardening:** `pageTitleKey` shares `canViewPath`'s path matching, not its principal decision (§4.1); the server-loading property is a verification target, and the title contract doesn't depend on it (§4.3, §7, §8 item 5); M4 decides only `/login`'s mechanism (§4.4). |

## 1. Primary question and thesis

**Question:** Where does each `/app` page's document title come from, and what is it in each state the shell can render?

**Thesis:** The `/app` document title describes **the state actually rendered**, and it has exactly one owner: `PageVisibilityGate`, which already decides that state. A pure resolver derives the page name only from the existing navigation configuration (`NAV_GROUPS[].labelKey`) and the reserved platform path (`PLATFORM_HOME_HREF`), and falls back to the app name. The gate renders one React `<title>` for the row it renders, formatted only through localized message patterns: `Services · Clensy`, `Page unavailable · Clensy`, or `Clensy`. The root layout stops contributing a competing title, and `/login` keeps its own.

### 1.1 Background (state on `main` at `e74fae6`)

- The only title in `apps/web` is `metadata.title: 'Clensy'` in `apps/web/app/layout.tsx`. Every page, the unavailable state, `/login` and `/` share it.
- Every page under `apps/web/app/app/` is a `'use client'` component, so none of them can export `metadata` or `generateMetadata`.
- Next's App Router route announcer (`next@16.3.1`, `client/components/app-router-announcer.js`) reads `document.title` in an effect after each route-tree change. It falls back to the first `<h1>` only when the title is empty, and it announces **only when the text differs from the previous announcement**, never on the first load. Because every `/app` title is "Clensy", client-side navigation inside `/app` announces nothing.
- Next's documentation (`error.md`) recommends React's `<title>` component where a client component can't export `metadata`. React 19's client renderer inserts a rendered `<title>` *before* the first existing `head > title` (`mountHoistable`).
- **Server-render probe** (throwaway, 2026-10-08, not committed). A temporary `<title>` was added to the gate's row 0, and the app was built and started.
  - With the root `metadata.title` in place, `/app` server-rendered `<title>Clensy</title>` **first** and the gate's `<title>` second. `document.title` uses the first `<title>` in tree order, so the initial-load title would still be "Clensy".
  - With `title` removed from the root `metadata`, `/app` rendered exactly one `<title>`, the gate's. `/login` then rendered **no** `<title>`.
  - An unknown path such as `/app/does-not-exist` never reaches the `/app` layout. Next renders its root not-found page, titled "404: This page could not be found.", in both cases.
- Page names disagree in places: `/app/catalog`'s sidebar label is "Services" but its `PageHeader` reads "Catalog", and `/app/admin`'s label is "Staff" but its heading is "Staff Accounts". Several `PageHeader` titles are hard-coded English strings.

## 2. Scope

### In scope (normative)

- The document title of every route rendered by the `/app` layout, in every `PageVisibilityGate` row, including the unavailable state (§4.3).
- A pure page-title resolver in `apps/web/lib/nav-groups.ts` (§4.1).
- Three `nav` message keys for title copy (§4.2).
- Removing `title` from the root layout's `metadata`, and keeping `/login`'s title (§4.4).
- A slice-local amendment (#143) to the role-aware typed-URL spec, superseding its two "no title change" clauses (Depends-on row).

### Informative

- The resolved titles also become the text Next's route announcer reads on client-side navigation. This spec fixes the title; it does not change the announcer. The announcer announces only when `document.title` changes, so a navigation between two paths with the same title (for example two paths beneath `/app/catalog`, or two denied paths) is not announced.

### Out of scope (normative)

- Titles for `/` (it only redirects) and for Next's not-found and error pages, including unknown `/app/*` paths, which don't reach the `/app` layout (§1.1).
- Any change to `/login`'s title text (§4.4).
- Per-record titles for detail drawers (`?detail=`) or dialogs.
- Making `PageHeader` headings agree with nav labels, or moving hard-coded headings into message catalogs.
- Other `<head>` metadata (description, Open Graph, icons).

## 3. Terminology

- **Gate row** — one of `PageVisibilityGate`'s rendering rows as defined by role-aware typed-URL spec §4.2: row 0 (ungated path), allowed, denied (the unavailable state), loading on a gated path, error, and settled null. *Cached principal during refetch* evaluates as allowed or denied.
- **Page title key** — the `nav` message key that names a page: a `NAV_GROUPS` item's `labelKey`, or `platform.title`.
- **Resolved title** — the title for a path when the requested page (or nothing page-specific) is rendered: `nav.documentTitle.page` with the page title key's text, or `nav.documentTitle.app` when there is no page title key.
- **Unavailable title** — `nav.documentTitle.page` with `nav.unavailable.title`'s text.
- **Title contribution** — a React `<title>` element rendered by a component, or a `title` emitted from route `metadata`. React hoists a rendered `<title>` into the document `<head>`, so a contribution has no DOM relationship to the component's other output.
- Other terms (*gated path*, *platform path*, *shell-hidden page*, *unavailable state*) are as defined in role-aware typed-URL spec §3.

## 4. Contracts

### 4.1 `pageTitleKey`

**`pageTitleKey(pathname: string): string | undefined`** is exported from `apps/web/lib/nav-groups.ts`. It's a pure function and needs no principal. Evaluated in this order:

1. **Nav item.** If `findActiveHref(pathname)` returns href `h`, the result is the `labelKey` of the `NAV_GROUPS` item with href `h`.
2. **Platform path.** If `pathname` is a platform path, the result is `platform.title`.
3. **Otherwise** the result is `undefined`. This covers `/app`, the empty pathname, and any path no rule resolves.

`undefined` is intentional: it means "no page-specific title". `pageTitleKey` never returns the fallback key. The gate turns `undefined` into `nav.documentTitle.app` when it formats the title (§4.3), so the resolver stays a pure path-to-page-name function.

Requirements:

- **Single source.** It reads only `NAV_GROUPS` (through `findActiveHref`) and `PLATFORM_HOME_HREF`. It MUST NOT introduce any new list, map or table of paths, page names or titles. A future nav entry gets its title from its `labelKey` alone.
- **Shared path matching, not a shared decision.** Its path-to-navigation matching uses the same `findActiveHref` and platform-path rules as `canViewPath` (role-aware typed-URL spec §4.1), so segment-match, longest-match and trailing-slash behavior are inherited unchanged, and a path beneath a nav href resolves to that href's key. It does not inspect, call or reproduce `canViewPath`'s principal, role or scope decision.
- **Not authorization.** Like `isGatedPath` and `canViewPath`, it is a client-side presentation rule. Its documentation MUST say so.

### 4.2 Title copy

Three keys are added to `apps/web/messages/en/nav.json`:

| Key | English text | Use |
| --- | --- | --- |
| `nav.documentTitle.page` | `{page} · Clensy` | Every page-specific title; `{page}` is a resolved page name |
| `nav.documentTitle.app` | `Clensy` | The bare fallback |
| `nav.unavailable.title` | `Page unavailable` | The `{page}` value in the unavailable state |

Requirements:

- Titles MUST be produced only by formatting these patterns. Code MUST NOT concatenate a page name, a separator and the app name. Order and separator belong to the message, so a locale can change them.
- `{page}` is always the text of a page title key or of `nav.unavailable.title`, never a raw path or a role/scope label.
- `nav.unavailable.title` MUST NOT name a role, scope or page, and MUST NOT state or imply that an API operation was attempted or denied (as role-aware typed-URL spec §4.3 requires of the unavailable state's copy).

### 4.3 Ownership: `PageVisibilityGate` renders the title

For every gate row, `PageVisibilityGate` (role-aware typed-URL spec §4.2) renders exactly one React `<title>` contribution, and no other `/app` source contributes a title. React hoists it into `<head>`; it has no DOM relationship to the row's body. The title text for each row is:

| Gate row | Rendered body (unchanged) | Title text |
| --- | --- | --- |
| 0. Ungated path | the page (`children`) | resolved title |
| Allowed | the page | resolved title |
| Denied, including cross-scope and no-landing | the unavailable state | unavailable title |
| Loading on a gated path | `LoadingState` | resolved title |
| Error on a gated path | the page (pass-through) | resolved title |
| Settled null on a gated path | the page (pass-through) | resolved title |

Requirements:

- **Resolved title.** The resolved title is `nav.documentTitle.page` with the text of `pageTitleKey(pathname)` when it returns a key, and `nav.documentTitle.app` when it returns `undefined` (§4.1).
- **Rendered state, not requested route.** The title describes the row actually rendered. In the denied row it MUST be the unavailable title, never the requested page's name.
- **Loading row.** While a gated path is loading, the title is the resolved title of the requested path. It does not imply that the principal may view the page. Once the gate settles, the title is that of the settled row. The loading and allowed titles MUST come from the same `pageTitleKey` resolution, not a loading-specific mapping. This contract is per row. It doesn't depend on which row the server renders: if server data provisioning changes and the server renders a settled row, the server title is that row's title.
- **Sole owner.** The gate's contribution is the only one in the `/app` subtree. No page, shell component (`DashboardLayout`, `AppHeader`, sidebar) or `/app` layout renders a `<title>` or exports `metadata`/`generateMetadata` with a `title`.
- **Body unchanged.** Every row's visible output, the gate's visibility decision, its hooks and its mount rules (role-aware typed-URL spec §4.2, §5 invariants 4–6, 10) are unchanged. The `<title>` is the only addition.
- **Locale.** The gate formats the title with the same next-intl `nav` translations it already uses for the unavailable state.

### 4.4 Root layout and `/login`

- The root layout's `metadata` (`apps/web/app/layout.tsx`) MUST NOT set `title`, so it contributes no title that competes with the gate's (§1.1). `description` is unchanged.
- `/login` MUST have exactly one title contribution, and its text MUST equal `nav.documentTitle.app` ("Clensy"), as it does today. That boundary is fixed here. M4 decides only the mechanism, for example a React `<title>` in the login page or `metadata` in a server layout under `app/login/`. No mechanism may add a layout under `/app`.
- `/` and Next's not-found and error pages are out of scope (§2). With no root title, they keep whatever Next or their own files provide. The not-found page keeps Next's own title (§1.1).

### 4.5 Worked examples

| Principal | Path | Gate row | Title |
| --- | --- | --- | --- |
| any | `/app` | 0 | `Clensy` |
| `OPS_MANAGER`/`TENANT` | `/app/catalog` | allowed | `Services · Clensy` |
| `TENANT_OWNER`/`TENANT` | `/app/admin` | allowed | `Staff · Clensy` |
| `ANALYST`/`TENANT` | `/app/cleaners/teams/x` | allowed | `Teams · Clensy` |
| `SUPER_ADMIN`/`PLATFORM` | `/app/platform` | allowed | `Platform · Clensy` |
| `FINANCE`/`TENANT` | `/app/customers` | denied | `Page unavailable · Clensy` |
| `SCHEDULER`/`TENANT` | `/app/platform` | denied | `Page unavailable · Clensy` |
| not yet known | `/app/customers` (server render, cold load) | loading | `Customers · Clensy` |
| query error | `/app/bookings` | error | `Bookings · Clensy` |
| — | `/login` | n/a | `Clensy` |

## 5. Invariants (MUST / MUST NOT)

1. **One mapping.** `NAV_GROUPS` and `PLATFORM_HOME_HREF` are the only page-specific title sources. For every other `/app` route, `pageTitleKey` returns `undefined` and the gate renders `nav.documentTitle.app` as the effective title. No second page-to-title mapping exists in `apps/web`.
2. **One owner.** For every gate row, `PageVisibilityGate` renders exactly one React `<title>` contribution, and no other `/app` source contributes a title.
3. **Rendered state.** The title always describes the gate row actually rendered (§4.3).
4. **Effective title.** For a route rendered by the `/app` layout, with no competing root-layout title:
   - the server-rendered HTML contains the title for the server-rendered gate row;
   - after hydration, `document.title` equals the title for the currently rendered gate row;
   - after each client-side navigation or gate-state transition, it equals the title for the newly rendered row.

   So a cold load of `/app/customers` by a denied user legitimately moves from `Customers · Clensy` (loading, server) to `Page unavailable · Clensy` (denied).
5. **Message-owned format.** Titles are produced only from the §4.2 patterns.
6. **No disclosure.** The unavailable title names no role, scope or page.
7. **Unchanged visibility.** The visibility rule, the gate decision, the gate's visible rows and API behavior are unchanged. `pageTitleKey` is not authorization (role-aware typed-URL spec §5 invariant 1 applies to it).
8. **Single `/app` layout.** No layout file is added under `apps/web/app/app/`.

## 6. Goals and non-goals

**Goals**

- Tab and screen-reader users can tell `/app` pages apart by title.
- Client-side navigation that changes the resolved gate title changes `document.title`, allowing Next's route announcer to announce the new page or state (§2 Informative).
- A user who reaches a shell-hidden page hears and sees "Page unavailable" in the title, matching the unavailable state's `<h1>`.
- A new nav entry gets its title from its `labelKey`, with no extra step.

**Non-goals**

- Changing nav labels, page headings, `PageHeader`, or moving hard-coded headings into catalogs.
- Per-record or per-dialog titles.
- Titles for `/`, not-found or error pages; changing `/login`'s title text.
- New browser-test infrastructure (Playwright or similar) or CI jobs (§8 item 5 is recorded evidence).
- Changing the route announcer, the visibility rule, the gate's decision or rows, or the API.
- Other metadata (description, Open Graph, icons).

## 7. Rationale

- **The gate owns the title.** The title must describe the rendered state, and the gate is the one component that decides it (loading, allowed, denied, pass-through). A separate title component beside it would have to re-derive the denied decision from the principal, loading and error states, which makes two places decide "denied" that could disagree. Per-page titles would need a per-page mapping and still a client override for the unavailable state.
- **React `<title>`, not server `metadata`.** Pages are client components and can't export `metadata`. Server wrappers per page would add eleven files and a mapping, and the unavailable state is decided on the client anyway, so a client title mechanism is needed regardless. Next's own documentation points client components to React's `<title>`.
- **Nav labels as the page name.** `NAV_GROUPS` already maps routes to labels for the sidebar and the gate, so titles cost no new mapping and match what the user clicked ("Services" for `/app/catalog`). Using page headings would need a second mapping and first moving hard-coded headings into catalogs.
- **Bare "Clensy" fallback.** `/app` is a transient landing redirect and has no page of its own. A defined fallback makes the resolver total, without new copy or a route table.
- **Path-derived title while loading.** No principal is known during the server render: `apolloClient` (`packages/client`, provided by `app/apollo-provider.tsx`) has no server-side data fetching, so the gate's `useCurrentAdminQuery()` renders as loading on the server. Every gated page's server HTML is therefore the loading row today. That is an observed property of the current Apollo setup, not a contract: §8 item 5 verifies it, and the per-row title contract holds whichever row the server renders (§4.3). A path-derived title gives the initial load, which the browser announces itself, the requested page's name in the common allowed case. "Clensy" would leave the original problem in place on full loads. A denied user sees it change to "Page unavailable" once the principal loads. In-session navigation reads the cached principal and decides in the same commit (role-aware typed-URL spec §4.2), so the announcer reads the settled title.
- **"Page unavailable" as the unavailable page name.** It matches the rendered state, is short enough for a tab, and is the same on every denied path. Reusing the sentence-length message would make an awkward title.
- **Removing the root title.** The probe showed the root `metadata.title` is server-rendered before the gate's `<title>` and wins `document.title` until hydration (§1.1). Removing it is the only way to make the server HTML correct without moving the gate's output. `/login` would then have no title, so it gets its own (§4.4).
- **Message-owned format.** Order and separator are locale concerns. Keeping them in `nav.documentTitle.page` avoids hard-coding English punctuation in the resolver.

## 8. Verification contract

These are acceptance anchors for M4–M7. Test file names are planning decisions.

1. **Resolver** (unit, `apps/web/lib/nav-groups.test.ts`):
   - For every `NAV_GROUPS` item, derived from `NAV_GROUPS` itself, `pageTitleKey(href)` and `pageTitleKey(`${href}/nested`)` return that item's `labelKey`.
   - `/app/catalog` → `items.services`; `/app/catalog/add-ons` → `items.addOns`; `/app/cleaners/teams-extra` → `items.cleaners`; `/app/admin/` → `items.staff`.
   - `PLATFORM_HOME_HREF` and `${PLATFORM_HOME_HREF}/x` → `platform.title`.
   - `/app`, `''`, `/app/does-not-exist`, `/app/customers-old` and `/app/platformx` → `undefined`.
2. **Gate titles** (component tests, alongside the existing gate tests): in each gate row the gate's output contains **exactly one** `<title>` element, with the §4.3 text:
   - row 0 on `/app` → `Clensy`;
   - allowed → the resolved title (for example `Customers · Clensy`), and `Platform · Clensy` for a platform principal on `/app/platform`;
   - denied, cross-scope (both directions) and no-landing → `Page unavailable · Clensy`;
   - loading on a gated path → the resolved title, equal to the allowed title for the same path;
   - error and settled null on a gated path → the resolved title;
   - cached principal during refetch → the allowed or unavailable title, never a loading-specific one.

   The existing gate assertions (mounting, heading, home link) stay.
3. **Source regressions**, in the style of `web-shell-regressions.test.ts`:
   - The root `app/layout.tsx` `metadata` has no `title`.
   - No non-test source under `apps/web/app/app/` exports `metadata` or `generateMetadata`, and none renders a `<title>`.
   - Across non-test `apps/web` sources, `<title>` JSX appears only in `components/layout/page-visibility-gate.tsx` and, if M4 chooses a React `<title>` for it, `/login`'s title source.
   - `/login` has exactly one title source.
4. **Copy:** the three §4.2 keys exist in `apps/web/messages/en/nav.json` with the §4.2 text.
5. **Recorded acceptance evidence** (run at M6 and cited at M7; not a CI job). These are evidence for invariant 4, which Vitest can't fully reproduce:
   - **Server render.** Build and start the app, then fetch with a session cookie present. The server HTML for `/app` contains exactly one `<title>`, `Clensy`. For representative gated routes, at least `/app/customers` and `/app/platform`, it contains exactly one, and the record states which gate row the server rendered. Today that is expected to be the loading row, with the resolved title (`Customers · Clensy`, `Platform · Clensy`). For `/login` it contains exactly one, `Clensy`.
   - **Client navigation.** In a real browser with a seeded session, navigate through the sidebar between two `/app` pages with **distinct** resolved titles. Record that `document.title` changes to the new page's title, and that Next's route-announcer region text equals it. Where practical, also record a gate-state transition into the unavailable state, for example a cold load of a shell-hidden page moving from the loading title to `Page unavailable · Clensy`.
6. **Existing suites stay green:** `apps/web` unit/component tests, typecheck, lint and build. No API, `@clensy/ui` or `@clensy/web` source changes.

## 9. Traceability

| Dependency | Relationship |
| --- | --- |
| Role-aware typed-URL spec §4.2, §4.3, §6 | **Extended / superseded in part.** The gate gains title ownership (§4.3 here). Its §4.3 bullet "It does not change the document `<title>`" and its §6 non-goal "Changing the document `<title>`" are superseded, through a slice-local amendment (#143) to that spec. Everything else, including §4.1, the §4.2 rows and their visible output, §4.3's heading, link and copy, and §5, is relied upon unchanged. |
| Role-aware typed-URL spec §11 *(#132)* | **Resolves** the "page-specific document titles" deferral. |
| Web Shell and Design System | **Relied upon**: the single `/app/*` layout (invariant 8). |
| Single App-Level `ClensyI18nProvider` | **Relied upon**: titles use next-intl `nav`, inside the existing providers. |
| `@clensy/ui` Shared UI System | **Relied upon**: no change. |
| #89 shell slice (`NAV_GROUPS`, `findActiveHref`) | **Extended** with `pageTitleKey`; `labelKey` and `findActiveHref` are reused unchanged. |

## 10. Acceptance criteria (for this specification)

This specification, together with its slice-local amendment (#143) to the role-aware typed-URL spec, may move from Draft to Accepted at M3 when the reviewer agrees that:

1. The decision (the gate owns one React `<title>` describing the rendered row) is locked and justified, and the superseded #114 clauses are named explicitly (§1, §4.3, §7, §9).
2. `pageTitleKey`'s resolution order, its single-source requirement and the bare fallback are unambiguous (§4.1, §5 invariant 1).
3. The title for every gate row, including the loading row's path-derived title and the unavailable title, is specified without leaving product decisions to M4 (§4.3, §4.5).
4. The copy and the message-owned format are fixed (§4.2).
5. The root-title removal and `/login`'s retained title are justified by the recorded probe, with only `/login`'s mechanism left to M4 (§1.1, §4.4).
6. The verification contract, including the recorded server-render and client-navigation evidence, covers invariants 1–8 (§5, §8).
7. Nothing here changes the visibility rule, the gate's decision or visible rows, the single `/app` layout, or API behavior (§5 invariants 7–8, §9).

## 11. Explicit deferrals

- **Per-record titles** for detail drawers and dialogs (for example a customer's name while `?detail=` is open).
- **Heading/label alignment.** `/app/catalog`'s heading "Catalog" and `/app/admin`'s "Staff Accounts" differ from their nav labels; aligning them, or moving hard-coded `PageHeader` titles into catalogs, is a separate change.
- **Titles for `/`, not-found and error pages.**
- **Automated browser tests** for the server-render and client-navigation evidence (§8 item 5).
- **Additional locales** for the §4.2 keys.
