# Dashboard UX Foundation — Design

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-08-17 |
| Tracking issue | [#24](https://github.com/rexescario-dev/clensy-platform/issues/24) |
| Milestone | M5 — Dashboard UX Foundation |
| Depends on (Accepted) | M2 Customers & Properties, M3 Cleaners & Teams, M4 Catalog — their shipped screens are this spec's migration targets |
| Governing references | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.5 (Shared Packages), §3 (Web Architecture & Testing), §4 (M5) |

## 1. Thesis

`apps/web` currently has no shared application shell: every protected page (`/admin`, `/customers`, `/cleaners`, `/catalog`, …) independently re-derives its own auth-check pattern, its own loading/empty/error markup, and its own table rendering, and `middleware.ts`'s route matcher must be hand-extended with every new top-level module (`apps/web/middleware.ts:29-37`). This spec establishes `/app/*` as the one protected-route boundary, a shared application shell (sidebar/header/user menu/logout) mounted once for every route under it, and a small set of reusable `packages/ui` primitives (data table, detail drawer, form dialog, confirmation dialog, feedback states) that M6–M9 (Bookings, Jobs & Checklists, Quality & Re-cleans, Operations Dashboard) consume instead of each inventing its own table, drawer, and dialog conventions. The existing Customers, Cleaners/Teams, and Catalog screens migrate onto these primitives as the proof that the patterns work before M6 needs them.

## 2. Scope

**In scope (normative):**

- Route reorganization: all authenticated screens move under `/app/*`; existing protected URLs redirect to their `/app/*` equivalents.
- A shared, mounted-once protected application shell: collapsible sidebar with persisted collapse state, header, current-admin identity display, logout.
- One new `logout` mutation in `modules/admins` (the smallest possible addition needed to support the shell — see §4.3 and §5).
- `packages/ui` primitives: an extended `DataTable`, `Modal` (base), `FormDialog`, `ConfirmDialog`, `DetailDrawer`, and feedback components (`Toast`/`ToastProvider`, `LoadingState`, `EmptyState`, `ErrorState`).
- Migration of the Customers, Cleaners/Teams, Catalog, and Admin screens onto the shared shell and primitives, including the overlay-vs-page reclassification in §4.7.
- Baseline responsive behavior (drawer-style nav on tablet/mobile) and accessibility (keyboard nav, focus trap/restore, Escape-to-close) built into the primitives.

**Informative (context, not new obligations):** the existing six-role RBAC matrix (`platform/auth`), the existing per-module GraphQL operations these screens already call, `packages/client`'s Apollo setup.

**Out of scope:**

- Any business-workflow redesign (Booking/Job/Quality domain rules, pricing, scheduling logic).
- New GraphQL operations beyond the one `logout` mutation in §4.3, new domain entities, new RBAC roles or permission rules.
- Operations Dashboard metrics or information architecture — that is M9's own design.
- Payments UX, notifications UX, a mobile-native application.
- A browser-automation test suite for `apps/web` (Phase 1 Design §7 already excludes this; unchanged here).

## 3. Terminology

- **App shell**: the persistent layout (sidebar + header + content slot) rendered once for every `/app/*` route via a shared Next.js layout.
- **Protected boundary**: the `/app/*` path prefix. Everything under it requires an authenticated session; everything outside it (`/login`, and future `/forgot-password`, `/reset-password`) does not and never renders the shell.
- **Primitive**: a `packages/ui` component that is content-agnostic — it owns interaction/visual behavior (open/close, loading/empty/error rendering, focus handling) and receives the actual field markup or row data from its caller. Primitives never import a domain type.
- **Detail drawer**: a right-side panel that slides in over the current page, background list remains visible and interactive-underneath is not required, closes via `X`/Escape/backdrop click.
- **Form dialog**: a centered, backdrop-blocking modal for a short create/edit form.
- **Confirmation dialog**: a centered, backdrop-blocking modal used only to confirm a destructive action.

## 4. Architecture & behavioral contracts

### 4.1 Route architecture

All authenticated routes move from their current top-level paths to `/app/*`:

| Today | Becomes |
| --- | --- |
| `/admin` | `/app/admin` |
| `/customers`, `/customers/[id]` | `/app/customers`, `/app/customers/[id]` |
| `/cleaners`, `/cleaners/[id]`, `/cleaners/teams`, `/cleaners/teams/[id]` | `/app/cleaners`, `/app/cleaners/[id]`, `/app/cleaners/teams`, `/app/cleaners/teams/[id]` |
| `/catalog`, `/catalog/[id]`, `/catalog/add-ons`, `/catalog/add-ons/[id]` | `/app/catalog`, `/app/catalog/[id]`, `/app/catalog/add-ons`, `/app/catalog/add-ons/[id]` |
| `/login` | unchanged — stays public, outside `/app/*` |

`/app` itself is a placeholder that redirects to `/app/customers` (the first available module) until M9 (Operations Dashboard) gives it real content — this mirrors the Phase 1 Design's existing statement that `/` "redirects to the first available module" before M9 exists (Phase 1 Design §3), just relocated under `/app`.

**Old-path redirects** (`/customers` → `/app/customers`, etc., including nested dynamic segments) are permanent so existing bookmarks/links don't 404. These are implemented as Next.js redirects (`next.config`) or thin server-redirect pages, not client-side-only navigation, so they work even for a cold, unauthenticated load.

**`middleware.ts` simplifies to a single matcher**, `/app/:path*` (replacing the current four-entry array that must be manually extended per module — `apps/web/middleware.ts:29-37`). Its existing behavior is otherwise unchanged: it is a UX-hint-only gate that checks for the session cookie's presence, not validity (Phase 1 precedent already documented in `middleware.ts`'s own comment) — that invariant is preserved, not revisited, by this spec.

### 4.2 Application shell

`apps/web/app/app/layout.tsx` (route segment `app/app/`, matching URL `/app`) renders the shell and wraps every child route:

- **Sidebar**: grouped nav links (Customers, Cleaners, Teams, Services, Add-ons — group headers are cosmetic text, not routes). Collapsible; collapse state persists in `localStorage` under key `clensy.sidebar.collapsed` (boolean). Active route highlighted by matching the current pathname's leading segment.
- **Header**: page title slot (supplied by each page via the `PageHeader` primitive, §4.4) plus the user menu.
- **User menu**: displays the current admin's name/email and role (via the existing `useCurrentAdminQuery`, already used by `admin/page.tsx`), and a **Log out** action (§4.3).
- **Responsive behavior**: below a tablet breakpoint, the sidebar becomes a drawer (hidden by default, opened via a header toggle) and closes automatically after a navigation.

The shell itself performs no auth check beyond what `middleware.ts` already provides — it is layout, not an authorization boundary. Pages that need the authenticated principal's identity (e.g. to gate an Owner-only action, as `admin/page.tsx` already does) continue to call `useCurrentAdminQuery` themselves; the shell does not inject or cache that identity for them in this slice.

### 4.3 Logout (new `logout` mutation)

The session cookie is `HttpOnly` (set via `Set-Cookie` on the `login` mutation response — `apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts`), so `apps/web` cannot clear it with client-side JavaScript. A working logout therefore requires one new server-side operation:

```graphql
type Mutation {
  logout: Boolean!
}
```

Resolved alongside `login` in `modules/admins/presentation/graphql/admin.resolver.ts`. Its handler sets an immediately expired `Set-Cookie` for `SESSION_COOKIE_NAME` (the same constant `login` already writes and `JwtStrategy` already reads — `apps/api/src/platform/auth/auth.constants.ts`) and returns `true`. It requires no request body and performs no audit-worthy state change (audit already excludes login itself), so it is unauthenticated-safe to call and needs no new RBAC rule.

This is a deliberate, narrow exception to the "no new GraphQL operations" scope boundary in §2 — it exists only because the shell's logout menu item (§4.2) has no other way to clear an `HttpOnly` cookie. See §5 for why this is preferable to alternatives.

Client flow: user menu → **Log out** → call `logout` mutation → on settlement (success or failure — a failed network call still means the user wants out) → `router.push('/login')`. No confirmation dialog; logout is reversible (the user just signs back in).

### 4.4 `packages/ui` primitive contracts

All of the following are content-agnostic (§3) and live in `packages/ui/src/`, exported from `packages/ui/src/index.ts` alongside the existing `Button`, `FormField`, `DataTable`, `StatusBadge`.

**`DataTable` (extended in place — not a parallel `DataTableV2`)**. Current contract (`packages/ui/src/data-table.tsx`) is `{ columns, rows, rowKey, emptyMessage }`; every existing caller (`admin`, `customers`, `cleaners`, `catalog` list pages) must keep compiling unchanged, so new props are additive and optional:

```ts
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;      // existing
  loading?: boolean;          // new — renders a loading row/skeleton instead of `rows`
  error?: string;             // new — renders an error row with this message instead of `rows`
  onRowClick?: (row: T) => void; // new — rows become interactive when provided
  pagination?: DataTablePaginationProps; // new, optional — omit for an unpaginated table
}
```

A screen that has no pagination need (e.g. a short Cleaners list) simply omits `pagination` — the table is not forced into paginating data that doesn't need it.

**`Modal`** — the base primitive Phase 1 Design §2.5 already anticipated (`packages/ui: ... Modal ...`) but that doesn't exist yet. A centered, backdrop-blocking container: `{ open, onClose, title, children }`. Closes on Escape and backdrop click, traps focus while open, restores focus to the triggering element on close.

**`FormDialog`** — composes `Modal` for the create/edit case: `{ open, onClose, title, onSubmit, submitLabel, submitting, children }`. `children` is the form's field markup (each screen supplies its own `FormField`s); `FormDialog` owns the submit-button disabled/loading state and Cancel action.

**`ConfirmDialog`** — composes `Modal` for destructive confirmations: `{ open, onClose, onConfirm, title, description, confirmLabel, confirming }`.

**`DetailDrawer`** — the right-side overlay (§3): `{ open, onClose, title, children, widthClassName? }`, default width in the 360–480px range. Unlike `Modal`, the backdrop is non-blocking visually (background list stays visible) but a click on it still closes the drawer.

**Feedback components**: `ToastProvider`/`useToast()` (mutation success/failure messages), `LoadingState`, `EmptyState` (message + optional action slot), `ErrorState` (message + optional retry action) — used both standalone (e.g. inside a `DetailDrawer` while its own query loads) and as what `DataTable` renders internally for its `loading`/`error`/empty-`rows` cases.

### 4.5 Dialog vs. drawer vs. full page

A single rule for this and future milestones, so nothing reinvents its own interaction model:

| Interaction | Pattern |
| --- | --- |
| Create a simple entity | `FormDialog` |
| Edit a simple entity | `FormDialog` |
| Inspect a simple entity | `DetailDrawer` |
| Confirm a destructive action | `ConfirmDialog` |
| Complex entity detail / multi-step workflow | Full page (unchanged — this spec does not touch Booking/Job/Quality, which M6–M8 will design) |

"Simple entity" for this slice means: Customer, Cleaner, Team, Service, Add-on — each already a single-panel edit form in its current full page (see §4.7).

### 4.6 Accessibility invariants

Built into `Modal`/`DetailDrawer` once, not per call site: Escape closes; focus is trapped while open and restored to the triggering element on close; the container has an appropriate `role` (`dialog` for `Modal`-based components, `complementary` or `dialog` for `DetailDrawer`) and `aria-labelledby` pointing at its title; all interactive elements inside primitives have visible focus states.

### 4.7 Migration scope

Each existing list+detail pair migrates as follows:

| Module | List page | Today's detail | Becomes |
| --- | --- | --- | --- |
| Customers | `/app/customers` uses `DataTable` (loading/error/pagination as needed) | `/customers/[id]/page.tsx` (full page) | `DetailDrawer`, opened by row click; URL still updates to `/app/customers/[id]` (§4.1 rule: deep-linkable) so refresh/bookmark/back-forward keep working |
| Cleaners & Teams | `/app/cleaners`, `/app/cleaners/teams` | `/cleaners/[id]`, `/cleaners/teams/[id]` (full pages) | `DetailDrawer`, same URL-preserving rule |
| Catalog (Services, Add-ons) | `/app/catalog`, `/app/catalog/add-ons` | `/catalog/[id]`, `/catalog/add-ons/[id]` (full pages) | `DetailDrawer`, same URL-preserving rule |
| Admin (staff accounts) | `/app/admin` | inline create form, no detail view today | Create moves to `FormDialog`; list uses `DataTable`; no new detail view is introduced (out of scope — not requested) |

Each list page's inline "create" form (currently rendered directly on the page, e.g. `customers/page.tsx`) becomes a `FormDialog` opened from a "+ New X" header action, per §4.5.

### 4.8 What stays outside the shell

`/login` (and future `/forgot-password`, `/reset-password`) render no sidebar, header, or authenticated navigation — they are outside `/app/*` and otherwise untouched by this spec. One required change: `login/page.tsx` currently does `router.push('/admin')` on success; it must instead push `/app` (which redirects to `/app/customers` per §4.1). This is a one-line change to an existing call site, not new behavior — §7 defers the separate question of what the post-login landing page *should* be once M9 ships real dashboard content.

## 5. Rationale

**Why an explicit `/app/*` prefix, not Next.js route groups (`(app)`) with no URL prefix?** A real path segment makes `middleware.ts`'s matcher a single `/app/:path*` pattern instead of the hand-maintained array it is today (§4.1) — the exact maintenance smell this milestone exists to remove. A route group alone doesn't fix that; the matcher would still need per-module entries.

**Why extend `DataTable` in place instead of adding a `DataTableV2`?** Three modules already depend on the current shape; a parallel implementation would leave two competing table conventions mid-migration, which is precisely what this milestone exists to prevent. All new props are optional so existing call sites are unaffected until they opt in.

**Why does `DetailDrawer` update the URL instead of being pure client state?** Deep-linkability (refresh/bookmark/back-forward) was an explicit product requirement from the original UX discussion this ticket formalizes, and costs nothing extra — Next.js's `useParams`/dynamic segments already give every migrated page a `[id]` route to read.

**Why is `logout` the one new GraphQL operation allowed?** The session cookie is `HttpOnly` by design (XSS mitigation) — clearing it is only possible from a server response's `Set-Cookie` header. The alternative (no real logout, or a non-`HttpOnly` cookie to allow client-side clearing) either fails the shell's stated requirement or weakens an existing security property; adding one narrowly-scoped mutation is the smaller change.

**Why `packages/ui` for these primitives rather than `apps/web/components`?** Phase 1 Design §2.5 already drew this boundary (API/domain-agnostic → `packages/ui`) and already named `DataTable` and `Modal` as belonging there. `DetailDrawer`/`FormDialog`/`ConfirmDialog` take the same shape — generic containers with no domain knowledge — so they follow the same rule; only the field markup rendered inside them is module-specific and stays in `apps/web`.

## 6. Acceptance criteria (for this specification)

This Draft may move to Accepted once Design Review (M3) confirms:

- The `/app/*` redirect map (§4.1) is exhaustive against every route that exists in `apps/web/app` today (verified against the current tree, not assumed).
- Every `packages/ui` primitive in §4.4 has a prop contract concrete enough to plan against without further design decisions at M4.
- The `DataTable` extension is confirmed additive/non-breaking against its three existing call sites.
- The `logout` mutation's necessity and shape (§4.3) is agreed as the intended, minimal exception to "no new GraphQL operations."
- The migration scope (§4.7) is bounded to exactly the four existing route groups — no silent expansion to Bookings/Jobs/Quality, which don't exist yet.

## 7. Non-goals

- No redesign of Booking, Job, or Quality workflows or their (not-yet-built) screens — those are M6–M8's own design work, which will consume but not redefine the patterns here.
- No Operations Dashboard information architecture or metrics — M9's own design.
- No new RBAC roles, permissions, or audit events beyond `logout`'s explicit exemption (§4.3).
- No change to `middleware.ts`'s session-cookie-presence-only semantics (Phase 1 precedent, unchanged).
- No decision here about what `/app` (or post-login landing) should be once M9 ships real dashboard content — `/app/customers` is only this milestone's placeholder default.
- No browser-automation test suite for `apps/web` (Phase 1 Design §7, unchanged).
