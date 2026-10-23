# Dashboard UX Foundation — Design

| Field | Value |
| --- | --- |
| Status | Accepted. [Amendment #180](#8-amendment-180--form-dialog-dismissal-while-submitting) **Accepted** — 2026-10-16; where §8.3 qualifies a sentence in §4.4 or §4.6, §8.3 governs. |
| Amendment #194 | **Draft** — 2026-10-23 (M2). Tracking [#194](https://github.com/rexescario-dev/clensy-platform/issues/194). Slice-local; does not replace this specification or reopen Amendment #180. See [§9](#9-amendment-194--confirmation-dialog-dismissal-while-confirming). The rest of this specification stays Accepted. |
| Amendment #180 | **Accepted** — 2026-10-16 (M3), by the owner, reviewing `7a18433`. Tracking [#180](https://github.com/rexescario-dev/clensy-platform/issues/180). Slice-local; does not replace this specification. M2 review applied two wording corrections (§8.2 user-initiated dismissal; §8.4 `Modal` exception tied to the `FormDialog` guard). M3 findings: compatibility with §4.4 and §4.6, submission lifecycle, scope boundaries, and acceptance criteria all pass; no design blocker; no further spec edits. Ready for M4. |
| Date | 2026-08-17 |
| Tracking issue | [#24](https://github.com/rexescario-dev/clensy-platform/issues/24) |
| Milestone | M5 — Dashboard UX Foundation |
| Depends on (Accepted) | M2 Customers & Properties, M3 Cleaners & Teams, M4 Catalog — their shipped screens are this spec's migration targets |
| Governing references | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.5 (Shared Packages), §3 (Web Architecture & Testing), §4 (M5) |

**Revision (M3 round 1):** resolved the drawer URL mechanism as a `detail` search param rather than a nested dynamic route (§3, §4.4, §4.7); corrected logout failure semantics so a failed `logout` call never claims the session was destroyed (§4.3); replaced "protected boundary" with precise three-layer authentication/authorization language throughout (§3, §4.1); defined `PageHeader` (§4.4); resolved `DetailDrawer`'s ARIA role, `FormDialog`'s `<form>` ownership, and keyboard activation for interactive table rows (§4.4, §4.6); added Admin/Staff to the sidebar information architecture (§4.2); marked `/app` → `/app/customers` as explicitly temporary (§4.1); scoped pagination as presentation-only, not server-side (§7); added a golden-path manual-verification acceptance criterion (§6).

**Revision (M3 round 2, Accepted):** fixed inconsistent "five route groups" wording to name the four route areas directly (§4.7, §6); relaxed `DetailDrawer`'s close behavior from a prescribed `router.back()`/`router.replace` mechanism to a behavioral requirement, leaving the history-detection mechanism to M4 (§4.4); documented `logout`'s idempotency when called without a valid session — no privilege-escalation surface (§4.3); gave `ConfirmDialog` the same concrete TypeScript contract as the other primitives (§4.4).

## 1. Thesis

`apps/web` currently has no shared application shell: every protected page (`/admin`, `/customers`, `/cleaners`, `/catalog`, …) independently re-derives its own auth-check pattern, its own loading/empty/error markup, and its own table rendering, and `middleware.ts`'s route matcher must be hand-extended with every new top-level module (`apps/web/middleware.ts:29-37`). This spec establishes `/app/*` as the one authenticated application route boundary (§3 — a routing/UX boundary, not the security boundary), a shared application shell (sidebar/header/user menu/logout) mounted once for every route under it, and a small set of reusable `packages/ui` primitives (data table, detail drawer, form dialog, confirmation dialog, feedback states) that M6–M9 (Bookings, Jobs & Checklists, Quality & Re-cleans, Operations Dashboard) consume instead of each inventing its own table, drawer, and dialog conventions. The existing Customers, Cleaners/Teams, and Catalog screens migrate onto these primitives as the proof that the patterns work before M6 needs them.

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
- **Authenticated application route boundary**: the `/app/*` path prefix — where the shell renders and where a signed-in admin is expected to be. This is a routing/UX boundary, not the security boundary; see §4.1 for the three enforcement layers and why only `platform/auth` is authoritative. Everything outside `/app/*` (`/login`, and future `/forgot-password`, `/reset-password`) never renders the shell.
- **Primitive**: a `packages/ui` component that is content-agnostic — it owns interaction/visual behavior (open/close, loading/empty/error rendering, focus handling) and receives the actual field markup or row data from its caller. Primitives never import a domain type.
- **Detail drawer**: a right-side panel, driven by a `detail` search param on its list page's URL (not a nested route — §4.4), that slides in over the current page. The background list stays visually visible but is inert while the drawer is open. Closes via `X`/Escape/backdrop click.
- **Form dialog**: a centered, backdrop-blocking modal for a short create/edit form.
- **Confirmation dialog**: a centered, backdrop-blocking modal used only to confirm a destructive action.

## 4. Architecture & behavioral contracts

### 4.1 Route architecture

All authenticated routes move from their current top-level paths to `/app/*`. Entities that get a `DetailDrawer` (§4.4, §4.7) have no `[id]` route under `/app/*` at all — their old `[id]` path redirects straight to the list page with a `detail` search param, not to an equivalent dynamic segment:

| Today | Becomes |
| --- | --- |
| `/admin` | `/app/admin` |
| `/customers` | `/app/customers` |
| `/customers/[id]` | `/app/customers?detail=[id]` |
| `/cleaners` | `/app/cleaners` |
| `/cleaners/[id]` | `/app/cleaners?detail=[id]` |
| `/cleaners/teams` | `/app/cleaners/teams` |
| `/cleaners/teams/[id]` | `/app/cleaners/teams?detail=[id]` |
| `/catalog` | `/app/catalog` |
| `/catalog/[id]` | `/app/catalog?detail=[id]` |
| `/catalog/add-ons` | `/app/catalog/add-ons` |
| `/catalog/add-ons/[id]` | `/app/catalog/add-ons?detail=[id]` |
| `/login` | unchanged — stays public, outside `/app/*` |

`/app` itself is a placeholder that redirects to `/app/customers` (the first available module) until M9 (Operations Dashboard) gives it real content — this mirrors the Phase 1 Design's existing statement that `/` "redirects to the first available module" before M9 exists (Phase 1 Design §3), just relocated under `/app`. **This redirect is temporary M5–M8 behavior**; M9 replaces it with real dashboard content, at which point `/app` stops redirecting (§7).

**Old-path redirects** (`/customers` → `/app/customers`, `/customers/[id]` → `/app/customers?detail=[id]`, etc.) are permanent so existing bookmarks/links don't 404. These are implemented as Next.js redirects (`next.config`) or thin server-redirect pages, not client-side-only navigation, so they work even for a cold, unauthenticated load.

**`middleware.ts` simplifies to a single matcher**, `/app/:path*` (replacing the current four-entry array that must be manually extended per module — `apps/web/middleware.ts:29-37`). Its existing behavior is otherwise unchanged: it is a UX-hint-only gate that checks only for the session cookie's presence, not its validity.

**Three separate layers enforce access, and only one of them is authoritative:**

1. `middleware.ts` (cookie-presence UX gate) — redirects an obviously-signed-out browser to `/login` before it even renders a page. Not security; a stale or invalid cookie still passes this layer.
2. `platform/auth`'s `AuthGuard` (JWT validation + `AdminUser` lookup) — the actual authentication boundary, enforced server-side on every GraphQL request regardless of what `apps/web` does.
3. `@Roles()` (RBAC) — the actual authorization boundary, also server-side.

This spec does not change that layering (Phase 1 precedent, preserved as-is) — it only gives layer 1 a simpler matcher. Nothing under `/app/*` should be described as "protected" in a way that implies the frontend enforces it; it doesn't, and isn't meant to.

### 4.2 Application shell

`apps/web/app/app/layout.tsx` (route segment `app/app/`, matching URL `/app`) renders the shell and wraps every child route:

- **Sidebar**: grouped nav links — PEOPLE (Customers, Cleaners, Teams), CATALOG (Services, Add-ons), ADMINISTRATION (Staff, linking to `/app/admin` — the route is not renamed in this milestone; a future `/app/admins` or `/app/staff` rename is a separate, later decision, not part of M5). Group headers are cosmetic text, not routes. Collapsible; collapse state persists in `localStorage` under key `clensy.sidebar.collapsed` (boolean). Active route highlighted by matching the current pathname's leading segment.
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

Resolved alongside `login` in `modules/admins/presentation/graphql/admin.resolver.ts`. Its handler sets an immediately expired `Set-Cookie` for `SESSION_COOKIE_NAME` (the same constant `login` already writes and `JwtStrategy` already reads — `apps/api/src/platform/auth/auth.constants.ts`) and returns `true`. It requires no request body and performs no audit-worthy state change (audit already excludes login itself), so it is unauthenticated-safe to call and needs no new RBAC rule. Calling it without a valid session is idempotent — it expires a cookie that either already carried no valid session or didn't exist, and returns `true` either way; there is no privilege-escalation surface from calling `logout` unauthenticated.

This is a deliberate, narrow exception to the "no new GraphQL operations" scope boundary in §2 — it exists only because the shell's logout menu item (§4.2) has no other way to clear an `HttpOnly` cookie. See §5 for why this is preferable to alternatives.

Client flow — success and failure are handled differently, because a failed `logout` call must never be presented as if the session were destroyed:

- **Success** (`logout` resolves `true`): clear the Apollo cache (`apolloClient.clearStore()`) so no stale authenticated data lingers, then `router.replace('/login')` — `replace`, not `push`, so the visited-page history doesn't retain an entry the user could reach again via Back.
- **Failure** (network error, or the mutation rejects): do **not** navigate and do **not** clear the Apollo cache — the cookie may still be present and valid, so treat the session as unchanged. Show an inline message on the user menu ("Unable to log out. Please try again.") and leave the current page as-is. No "log out anyway" fallback in this slice (out of scope — see §7); a user who wants to be certain can wait and retry.

No confirmation dialog before logout itself — logout is safe/reversible (the user just signs back in) — but its failure path must not be silently treated as success.

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

A screen that has no pagination need (e.g. a short Cleaners list) simply omits `pagination` — the table is not forced into paginating data that doesn't need it. This prop only defines the **presentation** contract (page/pageSize/totalCount/onPageChange); it does not introduce or redesign any server-side pagination/query contract — a screen without paginated data (like every screen migrated in this slice) simply never supplies it, and the API-side pagination questions M6 (Bookings) may eventually need are entirely out of scope here (§7).

When `onRowClick` is provided, the row must be keyboard-reachable and activate on Enter/Space — either via `role="button" tabIndex={0}` plus a `keydown` handler on the `<tr>`, or by rendering an accessible link/button within the row. A bare `onClick` with no keyboard equivalent does not satisfy this contract.

**`PageHeader`** — renders the header's title/description/primary-action slot (§4.2):

```ts
export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode; // e.g. a "+ New Customer" Button
}
```

**`Modal`** — the base primitive Phase 1 Design §2.5 already anticipated (`packages/ui: ... Modal ...`) but that doesn't exist yet. A centered, backdrop-blocking container: `{ open, onClose, title, children }`. Closes on Escape and backdrop click, traps focus while open, restores focus to the triggering element on close. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at its title.

**`FormDialog`** — composes `Modal` for the create/edit case:

```ts
export interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  submitting?: boolean;
  children: ReactNode;
}
```

`FormDialog` renders the `<form>` element itself and calls `onSubmit` on the form's native submit event (so pressing Enter in a field submits, not just clicking the button) — callers supply only their `FormField`s as `children` and must not render their own `<form>` wrapper. `FormDialog` owns the submit button's disabled/loading state (from `submitting`) and the Cancel action.

> **Amendment #180 (Accepted, 2026-10-16).** While `submitting` is true, a `FormDialog` refuses user-initiated dismissal, including the Escape and backdrop-click closing that `Modal` otherwise provides. See §8.3.1. This sentence and `Modal`'s "Closes on Escape and backdrop click" are otherwise unchanged.

**`ConfirmDialog`** — composes `Modal` for destructive confirmations:

```ts
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  confirming?: boolean;
}
```

`ConfirmDialog` owns the Cancel and Confirm actions; `confirming` disables both and exposes the pending state while `onConfirm` is in flight.

> **Amendment #194 (Draft, 2026-10-23).** While `confirming` is true, a `ConfirmDialog` refuses user-initiated dismissal, including the Escape and backdrop-click closing that `Modal` otherwise provides. See §9.3.1. This sentence is otherwise unchanged.

**`DetailDrawer`** — the right-side overlay (§3): `{ open, onClose, title, children, widthClassName? }`, default width in the 360–480px range. `role="dialog"`, `aria-modal="true"` (same as `Modal` — sliding in from the side doesn't make it a `complementary` landmark), `aria-labelledby` pointing at its title. Unlike `Modal`, the backdrop is non-blocking *visually* (the background list stays visible so the user keeps spatial context) but is inert while open — no click, focus, or keyboard interaction reaches the content behind it; a click on the backdrop itself still closes the drawer.

`DetailDrawer` is driven by state the caller owns, not internal state: each list page reads a `detail` search param (`useSearchParams`) to decide whether the drawer is open and for which row. Opening it (row click) does `router.push` to add `?detail=<id>` to the current URL — a new history entry, so browser Back closes the drawer and returns to the plain list URL.

Closing behavior is a **requirement, not a prescribed mechanism** — M4 (Implementation Planning) chooses the safest way to satisfy it: closing via `X`, Escape, or backdrop click must return to the list URL with `detail` removed, whether the drawer was reached by row-click navigation (where the previous history entry is the same list page) or by a direct/shared `?detail=` link (where it isn't, and blindly calling `router.back()` could navigate somewhere outside the app entirely). A same-page-origin flag set at the moment the drawer is opened via row click, checked before deciding between `router.back()` and `router.replace`, is one reasonable implementation — not the only one, and not mandated here. The list page (`page.tsx`) stays mounted underneath at all times regardless of mechanism — no parallel or intercepting Next.js routes are introduced for this.

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

Built into `Modal`/`DetailDrawer` once, not per call site: Escape closes; focus is trapped while open and restored to the triggering element on close; the container has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at its title (§4.4 — both `Modal`-based components and `DetailDrawer` use the same role, since both are modal in behavior regardless of screen position); all interactive elements inside primitives have visible focus states; interactive `DataTable` rows are keyboard-reachable and Enter/Space-activatable (§4.4).

> **Amendment #180 (Accepted, 2026-10-16).** "Escape closes" has one exception: Escape does not close a `FormDialog` that is submitting, and it does not reach a dialog underneath that one. See §8.3.2.

> **Amendment #194 (Draft, 2026-10-23).** The same exception covers a `ConfirmDialog` that is confirming. See §9.3.2.

### 4.7 Migration scope

Each existing list+detail pair migrates as follows. The migration scope is bounded to exactly the existing Customers, Cleaners/Teams, Catalog, and Admin route areas.

| Module | List page | Today's detail | Becomes |
| --- | --- | --- | --- |
| Customers | `/app/customers` uses `DataTable` (loading/error/pagination as needed) | `/customers/[id]/page.tsx` (full page) | `DetailDrawer`, opened by row click; URL becomes `/app/customers?detail=[id]` (§4.1, §4.4 — search param, not a route segment) so refresh/bookmark/back-forward keep working |
| Cleaners & Teams | `/app/cleaners`, `/app/cleaners/teams` | `/cleaners/[id]`, `/cleaners/teams/[id]` (full pages) | `DetailDrawer`, same `?detail=` rule on each respective list page |
| Catalog (Services, Add-ons) | `/app/catalog`, `/app/catalog/add-ons` | `/catalog/[id]`, `/catalog/add-ons/[id]` (full pages) | `DetailDrawer`, same `?detail=` rule on each respective list page |
| Admin (staff accounts) | `/app/admin` | inline create form, no detail view today | Create moves to `FormDialog`; list uses `DataTable`; no new detail view is introduced (out of scope — not requested) |

Admin migrates alongside the other three route areas — it gets the shell, `DataTable`, and `FormDialog` like the rest, it simply has no `DetailDrawer` because it has no detail view today and this spec doesn't add one.

Each list page's inline "create" form (currently rendered directly on the page, e.g. `customers/page.tsx`) becomes a `FormDialog` opened from a "+ New X" header action, per §4.5.

### 4.8 What stays outside the shell

`/login` (and future `/forgot-password`, `/reset-password`) render no sidebar, header, or authenticated navigation — they are outside `/app/*` and otherwise untouched by this spec. One required change: `login/page.tsx` currently does `router.push('/admin')` on success; it must instead push `/app` (which redirects to `/app/customers` per §4.1). This is a one-line change to an existing call site, not new behavior — §7 defers the separate question of what the post-login landing page *should* be once M9 ships real dashboard content.

## 5. Rationale

**Why an explicit `/app/*` prefix, not Next.js route groups (`(app)`) with no URL prefix?** A real path segment makes `middleware.ts`'s matcher a single `/app/:path*` pattern instead of the hand-maintained array it is today (§4.1) — the exact maintenance smell this milestone exists to remove. A route group alone doesn't fix that; the matcher would still need per-module entries.

**Why extend `DataTable` in place instead of adding a `DataTableV2`?** Three modules already depend on the current shape; a parallel implementation would leave two competing table conventions mid-migration, which is precisely what this milestone exists to prevent. All new props are optional so existing call sites are unaffected until they opt in.

**Why does `DetailDrawer` update the URL instead of being pure client state?** Deep-linkability (refresh/bookmark/back-forward) was an explicit product requirement from the original UX discussion this ticket formalizes.

**Why a `detail` search param instead of a nested `[id]` route or Next.js parallel/intercepting routes?** A nested route (`/app/customers/[id]/page.tsx`) resolves to a *different page component* than the list — it cannot render "list + drawer over it" without parallel (`@drawer`) and intercepting (`(.)[id]`) routes, real Next.js routing machinery that this milestone doesn't need to introduce. A search param keeps exactly one page component (`customers/page.tsx`) mounted at all times, which both is the list and decides whether to also render the drawer — simpler, and sufficient for every entity in this slice's migration scope (§4.7). If a future milestone needs a true canonical `/app/customers/[id]` URL for some other reason, that's a deliberate, separate decision, not something this spec should introduce speculatively.

**Why is `logout` the one new GraphQL operation allowed?** The session cookie is `HttpOnly` by design (XSS mitigation) — clearing it is only possible from a server response's `Set-Cookie` header. The alternative (no real logout, or a non-`HttpOnly` cookie to allow client-side clearing) either fails the shell's stated requirement or weakens an existing security property; adding one narrowly-scoped mutation is the smaller change.

**Why `packages/ui` for these primitives rather than `apps/web/components`?** Phase 1 Design §2.5 already drew this boundary (API/domain-agnostic → `packages/ui`) and already named `DataTable` and `Modal` as belonging there. `DetailDrawer`/`FormDialog`/`ConfirmDialog` take the same shape — generic containers with no domain knowledge — so they follow the same rule; only the field markup rendered inside them is module-specific and stays in `apps/web`.

## 6. Acceptance criteria (for this specification)

This Draft may move to Accepted once Design Review (M3) confirms:

- The `/app/*` redirect map (§4.1) is exhaustive against every route that exists in `apps/web/app` today (verified against the current tree, not assumed).
- Every `packages/ui` primitive in §4.4 has a prop contract concrete enough to plan against without further design decisions at M4.
- The `DataTable` extension is confirmed additive/non-breaking against its three existing call sites.
- The `logout` mutation's necessity and shape (§4.3) is agreed as the intended, minimal exception to "no new GraphQL operations."
- The migration scope (§4.7) is bounded to exactly the existing Customers, Cleaners/Teams, Catalog, and Admin route areas — no silent expansion to Bookings/Jobs/Quality, which don't exist yet.
- Old-path redirects (§4.1) and the login/logout flow (§4.3) are included in verification, not just the new screens — a stale bookmark or a failed logout are exactly the failure modes this migration risks introducing.
- The shell, `DataTable`, `DetailDrawer`, `FormDialog`, and responsive behavior are demonstrated end-to-end on at least one migrated module (Customers) before this spec is considered implementation-ready — a single golden path: log in → land on `/app` (redirects to `/app/customers`) → create a customer via `FormDialog` → see it appear in the `DataTable` → click the row → `DetailDrawer` opens with `?detail=` in the URL → edit and see a success toast → close the drawer (Back) → log out → land on `/login`. Manual verification is sufficient (§7); no browser-automation suite is required.

## 7. Non-goals

- No redesign of Booking, Job, or Quality workflows or their (not-yet-built) screens — those are M6–M8's own design work, which will consume but not redefine the patterns here.
- No Operations Dashboard information architecture or metrics — M9's own design.
- No new RBAC roles, permissions, or audit events beyond `logout`'s explicit exemption (§4.3).
- No change to `middleware.ts`'s session-cookie-presence-only semantics (Phase 1 precedent, unchanged).
- No decision here about what `/app` (or post-login landing) should be once M9 ships real dashboard content — `/app/customers` is only this milestone's placeholder default, and the redirect is explicitly temporary M5–M8 behavior (§4.1).
- No server-side pagination or query-contract redesign — `DataTable`'s `pagination` prop (§4.4) is a presentation contract only; API-side pagination for any future paginated list (e.g. M6 Bookings) is that milestone's own concern.
- No "log out anyway" override for a failed `logout` call, and no client-side fallback for clearing the `HttpOnly` session cookie if the mutation is unreachable (§4.3) — a failed logout simply fails visibly and can be retried.
- No browser-automation test suite for `apps/web` (Phase 1 Design §7, unchanged).

---

## 8. Amendment #180 — Form dialog dismissal while submitting

| Field | Value |
| --- | --- |
| **Status** | **Accepted** — 2026-10-16 (M3). |
| **Date** | 2026-10-16 |
| **Tracking** | [#180](https://github.com/rexescario-dev/clensy-platform/issues/180) "Keep form dialogs open while a submit is in flight". Follow-up from [#160](https://github.com/rexescario-dev/clensy-platform/issues/160) / PR [#179](https://github.com/rexescario-dev/clensy-platform/pull/179): M7 triage T5-a, listed under Deferred in the [Laundry Intake Modal plan](../plans/2026-10-13-laundry-intake-modal-plan.md). |
| **Kind** | Slice-local amendment of this specification. Not a second specification. |
| **Depends on** | This specification (Accepted 2026-08-17): §4.4 (`Modal`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`) and §4.6 (accessibility invariants). It **constrains** §4.4 and §4.6 for one state of one primitive, and **relies on** everything else unchanged. |
| **Owner decisions (brainstorm, 2026-10-16)** | (1) A refused dismissal shows nothing at all: no visual change, no busy message, no extra announcement. (2) The fix lives only in `@clensy/ui`, with no caller edits. (3) Programmatic closing stays available. (4) A submitting `FormDialog` on top swallows Escape. (5) The guard covers every user-initiated close path, present and future. (6) The contract here is behavioral. The mechanism is an M4 decision. |

### 8.1 Question and thesis

**Question:** §4.4 says `Modal` closes on Escape and backdrop click, and that `FormDialog` owns the disabled state of its buttons while `submitting`. Nothing says what happens when a user tries to dismiss a `FormDialog` while its submit is in flight. Today the dialog closes. A failed submit is then silent, because the dialog that would show the error is gone. And the user can reopen the dialog and submit again while the first request is pending. What should a submitting `FormDialog` do with a dismissal request?

**Thesis:** While `submitting` is true, a `FormDialog` refuses every user-initiated dismissal and nothing else changes. Escape does not close it and does not fall through to any dialog underneath. A backdrop click does not close it. Cancel stays disabled, as today. When `submitting` becomes false, after success or failure, dismissal works exactly as before. The caller's control of `open` is never overridden.

### 8.2 Terminology

- **Submitting** — the `FormDialog` `submitting` prop is `true`. It is caller-owned (§4.4), and every current caller passes it.
- **User-initiated dismissal** — any action through which a user can request that a dialog close, including Escape, a backdrop click, Cancel, and any close affordance added later. The primitive must decide whether to honor the request before invoking the caller's `onClose` callback.
- **Programmatic close** — the caller setting `open` to `false`, for example after a successful submit. It is not a dismissal request and is never refused.
- **Topmost dialog** — the most recently opened dialog that is still open, across `Modal`-based components and `DetailDrawer`. Shipped behavior already routes one Escape press to the topmost dialog only. This amendment makes that behavior normative for the case below.

### 8.3 Contract

#### 8.3.1 `FormDialog` while submitting

While a `FormDialog` is open and submitting:

1. **Escape** does not close it (see §8.3.2 for stacking).
2. **A backdrop click** does not close it.
3. **Cancel** stays disabled, as §4.4 already requires.
4. **Any other user-initiated dismissal path**, present or added later, does not close it. The refusal is enforced in one place for the primitive, not separately at each path.
5. **A refused dismissal has no effect.** It shows no message, changes nothing visually, makes no screen-reader announcement and calls no caller `onClose`. It is discarded, not queued: the dialog does not close later when submitting ends.
6. **Everything else is unchanged.** The submit button stays disabled, the submit label stays as the caller sets it, the `<form>` and its native submit event behave as before, focus stays trapped inside the dialog and the title and ARIA attributes do not change.
7. **Programmatic close still works.** If the caller sets `open` to `false` while submitting is still true, the dialog closes, and focus is restored as §4.4 requires.

#### 8.3.2 Escape with stacked dialogs

1. A single Escape press is still handled only by the topmost dialog.
2. If the topmost dialog is a submitting `FormDialog`, the press is **consumed**. That dialog stays open, and no dialog underneath it closes or receives the press as a close request.
3. If the topmost dialog is anything else, Escape behaves as before, even when a submitting `FormDialog` is open underneath it.

#### 8.3.3 When submitting is false

When `submitting` is false, which includes after it returns to false following either a successful or a failed submit, a `FormDialog` behaves exactly as before this amendment. Escape, a backdrop click and Cancel each close it through `onClose`. There is no settle delay and no leftover blocked state.

### 8.4 What this amendment changes, and what it does not

On acceptance, §8.3 qualifies these Accepted sentences and nothing else:

- §4.4 `Modal`: "Closes on Escape and backdrop click". The rule that `Modal` closes on Escape and backdrop click continues to apply generally. When `Modal` is used by a submitting `FormDialog`, that dialog's dismissal guard takes precedence.
- §4.6: "Escape closes". The same exception applies, and Escape is consumed rather than passed to a lower dialog.

Unchanged, and still Accepted whether or not this amendment is accepted:

- The `FormDialog`, `Modal`, `ConfirmDialog` and `DetailDrawer` prop contracts in §4.4, as they read to callers. M4 may add a non-breaking internal or optional option to support §8.3, but no caller is required to change.
- `ConfirmDialog` dismissal, including while `confirming`. This amendment makes no decision about it.
- `DetailDrawer` dismissal, including its URL-based close requirement.
- Focus trapping, focus moving in on open, focus restoration on close, `role="dialog"`, `aria-modal` and `aria-labelledby` (§4.4, §4.6).
- Every `FormDialog` caller in `apps/web` and `packages/web`, and its copy, toasts, error display and submit guard.
- All other sections of this specification, including §6 and its golden path.

### 8.5 Invariants

- A submitting `FormDialog` MUST NOT close because of a user-initiated dismissal.
- A refused dismissal MUST NOT call the caller's `onClose`, MUST NOT be replayed when submitting ends and MUST NOT produce any visual or announced feedback.
- An Escape press refused by a topmost submitting `FormDialog` MUST NOT close, or reach as a close request, any dialog beneath it.
- The guard MUST NOT block, delay or override a programmatic close, meaning the caller setting `open` to `false`.
- When submitting is false, `FormDialog` dismissal MUST be identical to its behavior before this amendment.
- `ConfirmDialog` and `DetailDrawer` dismissal MUST NOT change as a side effect of this amendment.
- The change MUST be confined to `@clensy/ui`. No `FormDialog` caller MAY need an edit to receive it.

### 8.6 Rationale

- **Why refuse instead of close and recover.** The failure cases in #180 (a silent failed submit, a second submit from a reopened dialog, the first success closing the reopened dialog) all need the dialog to be gone while the request is in flight. Keeping it open removes all three. Changing the error path at each caller would not.
- **Why no feedback (owner decision 1).** The disabled Cancel and submit buttons, and the caller's pending submit label, already tell the user a save is running. A second busy cue would add a UI state and an announcement for something the user can already see.
- **Why swallow Escape instead of passing it down (owner decision 4).** If the press fell through, Escape on a submitting dialog would close whatever is under it, such as a drawer, while the dialog on top stays. That is a worse surprise than doing nothing.
- **Why in the primitive (owner decision 2).** All nine current `FormDialog` callers already pass `submitting`, so a fix in `@clensy/ui` reaches every one of them, and future callers get it by default. That is the reason §4.4 put these behaviors in shared primitives.
- **Why behavioral, not an API (owner decision 6).** The options (a dismissible flag on `Modal`, a guarded `onClose` inside `FormDialog`, or something else) differ only in mechanism. §8.3.2 constrains them all: whichever is chosen must still recognize the topmost dialog when it refuses the dismissal, so that Escape is consumed and does not fall through.

### 8.7 Non-goals and deferrals

- No change to `ConfirmDialog` while `confirming`. If it needs the same guard, that is a separate issue.
- No change to `DetailDrawer`.
- No new close affordance, such as an `X` button, on `Modal` or `FormDialog`.
- No busy indicator, toast, live-region message or copy change.
- No change to how callers track or set `submitting`, and no new submit-in-flight guard at any caller.
- No cancellation or abort of an in-flight request.

### 8.8 Acceptance criteria (for this amendment)

Amendment #180 may move from Draft to Accepted once Design Review (M3) confirms:

- §8.3.1 states that, while submitting, Escape, a backdrop click and every other user-initiated dismissal path leave a `FormDialog` open, that Cancel stays disabled, and that a refused dismissal produces no feedback and is not replayed.
- §8.3.3 states that once submitting is false again, after success or failure, Escape, the backdrop and Cancel close the dialog as before.
- §8.3.2 keeps topmost-only Escape handling and states that a topmost submitting `FormDialog` consumes the press without closing itself or any dialog beneath.
- §8.4 and §8.5 preserve the behavior when submitting is false (Cancel, Escape, backdrop), the dismissal behavior of `ConfirmDialog` and `DetailDrawer`, and programmatic close.
- The amendment names no implementation API and leaves the mechanism to M4.
- The verification it requires is concrete enough to plan against: `@clensy/ui` tests cover the submitting and the idle states, including stacked Escape, and the existing laundry intake page tests keep passing.
- The rest of this specification stays Accepted and is not reopened.

## 9. Amendment #194 — Confirmation dialog dismissal while confirming

| Field | Value |
| --- | --- |
| **Status** | **Draft** — 2026-10-23 (M2). |
| **Date** | 2026-10-23 |
| **Tracking** | [#194](https://github.com/rexescario-dev/clensy-platform/issues/194) "Decide whether ConfirmDialog should refuse dismissal while confirming". Deferred by Amendment #180 (§8.4, §8.7). |
| **Kind** | Slice-local amendment of this specification. Not a second specification. |
| **Depends on** | This specification (Accepted 2026-08-17): §4.4 (`Modal`, `ConfirmDialog`), §4.6 (accessibility invariants). Amendment #180 (Accepted 2026-10-16): §8.2 terminology, §8.3.2 stacked Escape. It **constrains** §4.4 and §4.6 for one state of one more primitive, **extends** §8.3.2 to that primitive, **qualifies** the §8.4, §8.5 and §8.7 sentences that kept `ConfirmDialog` unchanged, and **relies on** everything else unchanged. |
| **Owner decisions (brainstorm, 2026-10-23)** | (1) A confirming `ConfirmDialog` behaves like a submitting `FormDialog`: once the action starts, the dialog stays open until the action settles. (2) Before confirming and after settling, dismissal works as today. (3) Failures keep their existing feedback locations at each caller; no caller error handling is redesigned. (4) The dismissal guard is not a substitute for disabling the Confirm action or for a caller's own duplicate-action protection. (5) "Settles" means the confirmation operation has completed, by success or by failure, so a rejected action cannot leave the dialog locked. (6) Scope is the shared `ConfirmDialog` contract only, following #180. No new global action lifecycle. |

### 9.1 Question and thesis

**Question:** Amendment #180 made a submitting `FormDialog` refuse user-initiated dismissal and left `ConfirmDialog` unchanged. Today, while `confirming` is true, `ConfirmDialog` disables Cancel and Confirm, but Escape and a backdrop click still close it. Should a confirmation stay dismissible while its action runs?

**Thesis:** No. While `confirming` is true, a `ConfirmDialog` refuses every user-initiated dismissal, exactly as §8.3 specifies for a submitting `FormDialog`. When `confirming` becomes false, after success or failure, dismissal works exactly as before. The caller's control of `open` is never overridden.

**Why now.** The shipped callers were checked on 2026-10-23:

- **Staff** (`apps/web/app/app/admin/page.tsx`) passes `confirming`. A mid-action Escape closes the dialog today, but failures show inline on the page and the row's Disable buttons stay disabled while the mutation runs, so no second action can start.
- **Bookings delete** (`apps/web/app/app/bookings/page.tsx`, inside the booking `DetailDrawer`) passes `confirming`. The "Delete booking" trigger is not disabled while the delete runs. After a mid-action Escape, the user can reopen the dialog and confirm a second delete, and the first delete's `finally` then closes the reopened dialog. This is the same class of failure #180 removed from `FormDialog`.
- **Laundry** (`apps/web/app/app/laundry/page.tsx`) closes its dialog itself before starting the action and never passes `confirming`. This amendment does not affect it.

### 9.2 Terminology

- **Confirming** — the `ConfirmDialog` `confirming` prop is `true`. It is caller-owned (§4.4).
- **Settled** — `confirming` has returned to `false` after the caller's confirmation operation completed, whether it succeeded or failed. `ConfirmDialog` holds no in-flight state of its own: the guard reads `confirming` and nothing else, so it lifts the moment the caller clears `confirming`. Both shipped callers derive `confirming` from the mutation's loading flag, which clears on success and on rejection.
- **User-initiated dismissal**, **programmatic close** and **topmost dialog** — as defined in §8.2.

### 9.3 Contract

#### 9.3.1 `ConfirmDialog` while confirming

While a `ConfirmDialog` is open and confirming:

1. **Escape** does not close it (see §9.3.2 for stacking).
2. **A backdrop click** does not close it.
3. **Cancel and Confirm** stay disabled, as §4.4 already requires.
4. **Any other user-initiated dismissal path**, present or added later, does not close it. The refusal is enforced in one place for the primitive, not separately at each path.
5. **A refused dismissal has no effect.** It shows no message, changes nothing visually, makes no screen-reader announcement and calls no caller `onClose`. It is discarded, not queued: the dialog does not close later when confirming ends.
6. **Everything else is unchanged.** The title, description, button labels, focus trap and ARIA attributes do not change. `onConfirm`'s rejection handling (§4.4; the swallowed rejection in `confirm-dialog.tsx`) does not change.
7. **Programmatic close still works.** If the caller sets `open` to `false` while confirming is still true, the dialog closes, and focus is restored as §4.4 requires.

#### 9.3.2 Escape with stacked dialogs

§8.3.2 applies to a confirming `ConfirmDialog` as it does to a submitting `FormDialog`:

1. A single Escape press is still handled only by the topmost dialog.
2. If the topmost dialog is a confirming `ConfirmDialog`, the press is **consumed**. That dialog stays open, and no dialog underneath it, such as the booking `DetailDrawer`, closes or receives the press as a close request.
3. If the topmost dialog is anything else, Escape behaves as before, even when a confirming `ConfirmDialog` is open underneath it.

#### 9.3.3 When confirming is false

When `confirming` is false, which includes after it returns to false following either a successful or a failed action, a `ConfirmDialog` behaves exactly as before this amendment. Escape, a backdrop click and Cancel each close it through `onClose`. There is no settle delay and no leftover blocked state. Whether the dialog then closes on its own is the caller's existing behavior, unchanged; both shipped callers that pass `confirming` close it themselves in a `finally`.

### 9.4 What this amendment changes, and what it does not

On acceptance, §9.3 qualifies these Accepted sentences and nothing else:

- §4.4 `Modal`: "Closes on Escape and backdrop click". When `Modal` is used by a confirming `ConfirmDialog`, that dialog's dismissal guard takes precedence, as §8.4 already says for a submitting `FormDialog`.
- §4.6 "Escape closes", and its §8.3.2 exception: the exception now also covers a confirming `ConfirmDialog`.
- §8.4 "`ConfirmDialog` dismissal, including while `confirming`. This amendment makes no decision about it.", §8.5 "`ConfirmDialog` and `DetailDrawer` dismissal MUST NOT change as a side effect of this amendment." and §8.7 "No change to `ConfirmDialog` while `confirming`.": these described Amendment #180's own scope and stay true of it. This amendment is the separate issue §8.7 anticipated. They no longer describe current `ConfirmDialog` behavior.

Unchanged, and still Accepted whether or not this amendment is accepted:

- The `ConfirmDialog`, `FormDialog`, `Modal` and `DetailDrawer` prop contracts in §4.4, as they read to callers. M4 may add a non-breaking internal or optional option to support §9.3, but no caller is required to change.
- `ConfirmDialog` dismissal when `confirming` is false or omitted, which covers the Laundry caller.
- `FormDialog` behavior and Amendment #180 (§8.3) in full.
- `DetailDrawer` dismissal, including its URL-based close requirement.
- Focus trapping, focus moving in on open, focus restoration on close, `role="dialog"`, `aria-modal` and `aria-labelledby` (§4.4, §4.6).
- Every `ConfirmDialog` caller in `apps/web` and `packages/web`, including when and how it sets `confirming`, when it closes the dialog, its copy, and where its success and failure feedback appear.
- All other sections of this specification, including §6 and its golden path.

### 9.5 Invariants

- A confirming `ConfirmDialog` MUST NOT close because of a user-initiated dismissal.
- A refused dismissal MUST NOT call the caller's `onClose`, MUST NOT be replayed when confirming ends and MUST NOT produce any visual or announced feedback.
- An Escape press refused by a topmost confirming `ConfirmDialog` MUST NOT close, or reach as a close request, any dialog beneath it.
- The guard MUST NOT block, delay or override a programmatic close.
- The guard MUST depend only on `confirming`. `ConfirmDialog` MUST NOT keep its own in-flight lock, so a settled action, including a rejected `onConfirm`, never leaves the dialog undismissable.
- When confirming is false, `ConfirmDialog` dismissal MUST be identical to its behavior before this amendment.
- `FormDialog` and `DetailDrawer` dismissal MUST NOT change as a side effect of this amendment.
- The change MUST be confined to `@clensy/ui`. No `ConfirmDialog` caller MAY need an edit to receive it.

### 9.6 Rationale

- **Why refuse instead of close and recover (owner decision 1).** The caller check in §9.1 found that early closing does not lose feedback today: both callers that pass `confirming` show failures outside the dialog. The real risk is a second action. In Bookings, a mid-action Escape lets the user reopen the dialog and confirm again, and the first action's `finally` closes the reopened dialog. Keeping the dialog open while confirming removes that path in the primitive, for every caller.
- **Why one dismissal policy for both primitives.** `FormDialog` and `ConfirmDialog` both compose `Modal`, both own a pending flag, and both run an in-flight mutation. Two different answers to "can I dismiss this while it saves?" would be an inconsistency with no user benefit.
- **Why key the guard off `confirming` only (owner decision 5).** `confirming` is caller-owned and both callers clear it when the mutation settles either way, so the dialog cannot stay locked after a rejection. If `ConfirmDialog` tracked `onConfirm`'s promise itself, it would change behavior for callers that do not pass `confirming`, such as Laundry, and add a second source of truth. This mirrors §8.3, which keys off `submitting`.
- **Why not more (owner decisions 4 and 6).** The guard closes the Escape-and-reopen path, but it does not replace disabling Confirm, which §4.4 already requires, or a caller's own duplicate-action protection. Redesigning caller error handling or adding a shared action lifecycle is outside what #194 asked.
- **Why no feedback and why swallow Escape.** For the same reasons as §8.6: the disabled buttons already show that the action is running, and an Escape that fell through would close the booking drawer while the confirmation on top stayed open.
- **Why behavioral, not an API.** As in §8.6, the mechanism is an M4 decision. §9.3.2 constrains it: whatever is chosen must keep topmost-only Escape handling so a refused press is consumed.

### 9.7 Non-goals and deferrals

- No change to `FormDialog` or `DetailDrawer`.
- No change to any `ConfirmDialog` caller, including the Bookings "Delete booking" trigger, which stays enabled while a delete runs. Disabling it is caller-side duplicate-action hardening and, if wanted, a separate issue.
- No change to the Laundry caller's choice to close its dialog before starting the action and not pass `confirming`.
- No error-display slot on `ConfirmDialog`, and no change to where callers show success or failure.
- No new close affordance, busy indicator, toast, live-region message or copy change.
- No in-flight tracking of `onConfirm` inside `ConfirmDialog`, and no cancellation or abort of an in-flight action.
- No shared action-lifecycle abstraction across primitives.

### 9.8 Acceptance criteria (for this amendment)

Amendment #194 may move from Draft to Accepted once Design Review (M3) confirms:

- §9.3.1 states that, while confirming, Escape, a backdrop click and every other user-initiated dismissal path leave a `ConfirmDialog` open, that Cancel and Confirm stay disabled, and that a refused dismissal produces no feedback and is not replayed.
- §9.3.3 states that once confirming is false again, after success or failure, Escape, the backdrop and Cancel close the dialog as before, and §9.2 and §9.5 define "settled" so a rejected action cannot leave the dialog locked.
- §9.3.2 keeps topmost-only Escape handling and states that a topmost confirming `ConfirmDialog` consumes the press without closing itself or any dialog beneath, including the booking `DetailDrawer`.
- §9.4 and §9.5 preserve behavior when confirming is false or omitted, programmatic close, `FormDialog` and `DetailDrawer` dismissal, and every caller's feedback locations.
- §9.4 states exactly which Amendment #180 sentences it qualifies, without reopening Amendment #180.
- The amendment names no implementation API and leaves the mechanism to M4.
- The verification it requires is concrete enough to plan against: `@clensy/ui` tests cover the confirming and the idle states, including stacked Escape over a `DetailDrawer` and a rejected `onConfirm`. The characterization tests in `packages/ui/src/base/dialogs/confirm-dialog.test.tsx` that pin today's "still closes while confirming" behavior are replaced by tests of §9.3. The existing `apps/web` and `packages/web` tests keep passing, including the Laundry list page tests.
- The rest of this specification, including Amendment #180, stays Accepted and is not reopened.
