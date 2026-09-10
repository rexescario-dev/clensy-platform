# Web Application Shell & Design System — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-10 |
| Tracking issue | Not filed |
| Depends on (Accepted) | [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) — `/app/*` layout, cookie-presence middleware, `logout` mutation, `clensy.sidebar.collapsed`, current `NAV_GROUPS` IA, `@clensy/ui` module primitives, `/app` → `/app/customers` placeholder redirect. [Admin Foundation](2026-08-14-admin-foundation-design.md) — `CurrentAdmin` `{ id, role }`, six `Role` values. [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) — web testing is manual; no Playwright suite. |
| Governing references | This document. It **does not** replace Dashboard UX Foundation for module primitives, drawer/`?detail=` conventions, or auth layering. It **does** replace that spec's visual description of the shell chrome (sidebar/header/user menu styling) for `apps/web`. |

**Revision (Accepted):** owner review requested six tightenings, applied in place: CSS-first Tailwind 4 pipeline wording (not a `tailwind.config.*` file); normative `@clensy/ui` source scanning; measurable no-flash constraint without document-root theming; BrandMark default mark constrained to token-driven geometry; Sign out forbids auth/GraphQL/Apollo refactors; Draft-to-Accepted process paragraph removed.

**Slice:** Shell + design system only (Slice 1 of a larger frontend modernization). Navigation IA, operations dashboard content, identity API, tenant branding, login redesign, and `@clensy/ui` → shadcn migration are later slices.

## 1. Thesis

`apps/web` already has a working `/app/*` shell (`AppShell`, grouped nav, collapse persistence, mobile drawer, `UserMenu` + `logout`). That chrome is handmade Tailwind 3 + `@clensy/ui` `Button`, with no brand mark, no theme, and a user area that can only honestly show `role`. This spec establishes a **reusable visual foundation and application chrome** for that same shell: Tailwind 4 + current shadcn/ui **inside `apps/web`**, semantic tokens, a themed `ShellChrome` subtree, presentational `BrandMark`, and a user menu that stays inside the existing `CurrentAdmin` contract.

shadcn is a **primitive toolkit for the new shell**, not the business/UI architecture, and not a mandate to rewrite `@clensy/ui` or module screens.

## 2. Scope

**In scope (normative):**

- Upgrade `apps/web` from Tailwind CSS 3.4 to Tailwind CSS 4; use the current shadcn/ui installation approach for Tailwind 4. One Tailwind pipeline — do not keep a Tailwind 3 JS config as a second source of truth.
- Semantic CSS-variable tokens in `apps/web` (zinc/neutral base). New shell styling uses those tokens only.
- shadcn primitives **required by this shell** land in `apps/web/components/ui/`. They are not added to `packages/ui`.
- Replace `AppShell` **in place**. `apps/web/app/app/layout.tsx` remains the single `/app/*` layout.
- `DashboardLayout` composition: themed `ShellChrome` (sidebar, header, user menu, mobile Sheet, shell-owned portals) + permanently light `<main>` content island.
- `BrandMark` with a fixed Clensy/Laundry default.
- Primary navigation **component and visual behavior** using today's groups, labels, and hrefs unchanged.
- Authenticated user area: role label + role initials + theme preference + existing logout behavior.
- Light / Dark / System theme for **shell chrome only**, default System, persisted as `clensy.theme`, following live OS changes when preference is System.
- Unit tests for role presentation and theme resolution; lint/build/Docker gates; manual golden-path acceptance.
- Tailwind 4 **compatibility fixes** in `@clensy/ui` or module pages only when the upgrade would otherwise break compile, scan, or existing visual/behavioral intent.

**Informative:** existing GraphQL operations (`currentAdmin`, `logout`, module queries), `packages/client` Apollo setup, three-layer auth (middleware UX gate / `AuthGuard` / `@Roles()`).

**Out of scope:**

- Navigation information architecture (laundry-first labels, hiding/regrouping Bookings, Jobs, Cleaners, Teams, Staff, Invoices, Reports, Settings).
- Operations dashboard content: metrics, recent orders, revenue chart, `/app` real page (the customers redirect stays).
- New GraphQL operations or fields (including `CurrentAdmin.email` / name / avatar).
- Tenant/company branding API, logo upload, persistence of brand props.
- Login page redesign or theme UI on `/login`.
- Moving shadcn into `packages/ui`; replacing `@clensy/ui` tables/drawers/dialogs/toasts with shadcn.
- Full module visual redesign (beyond TW4 compatibility fixes).
- Profile / Account settings routes.
- Notifications bell, Command palette, Card/Table/Tabs/Dialog/Badge except as not listed in §4.5.
- Playwright / browser-automation suite.
- API/DDD/Nest/TypeORM changes.

## 3. Terminology

- **Shell chrome:** sidebar, header, user menu, mobile nav Sheet, and any portal content those chrome widgets open.
- **ShellChrome / theme root:** the DOM subtree that may carry resolved dark appearance. The only allowed theme root.
- **Content island:** `/app/*` `<main>` and its descendants (existing module pages, `@clensy/ui`). Always light in this slice.
- **shadcn primitive:** a generated/copied component under `apps/web/components/ui/`. Content-agnostic. Must not import domain types or `@clensy/client`.
- **Clensy layout component:** `BrandMark`, `DashboardLayout`, `AppSidebar`, `AppHeader`, `UserMenu` under `apps/web/components/layout/`. These own Clensy composition; they consume shadcn primitives.
- **Preference vs resolved appearance:** preference is `light` | `dark` | `system`. Resolved appearance is only `light` | `dark`. System preference resolves via `prefers-color-scheme`.
- **Compatibility fix:** the smallest change that restores pre-upgrade compile success or visual/behavioral **intent** of a module/`@clensy/ui` surface after Tailwind 4. Not a redesign.
- **Escalation:** if a compatibility fix would require a non-trivial visual or behavioral change, stop. That is a separate scope decision, not silent work inside this slice.

## 4. Architecture & behavioral contracts

### 4.1 Placement

```text
apps/web/
  app/app/layout.tsx          ← still the only /app/* layout; mounts DashboardLayout
  components/
    ui/                       ← shadcn primitives listed in §4.5 only
    layout/                   ← DashboardLayout, ShellChrome, BrandMark, sidebar, header, UserMenu
  app/globals.css             ← Tailwind 4 + semantic tokens
packages/ui/                  ← unchanged as a design system; TW4 scan + compatibility fixes only
```

`DashboardLayout` replaces `AppShell` (same job: chrome + `{children}` + existing `@clensy/ui` `ToastProvider`). Do not introduce a second authenticated layout tree.

shadcn belongs to the web application's shell. `@clensy/ui` remains the module toolkit.

### 4.2 Tokens and tooling

- Upgrade `apps/web` Tailwind **3.4 → 4**. Use current shadcn init/add for Tailwind 4 + React 19 / Next.js App Router as they exist at implementation time.
- **One Tailwind 4 styling pipeline.** Use the CSS-first Tailwind 4 configuration (`@import "tailwindcss"` and `@theme` as needed). Do not keep a Tailwind 3 JS config as a second source of truth.
- `transpilePackages` for `@clensy/client` and `@clensy/ui` remains.
- The Tailwind 4 source configuration MUST explicitly include `packages/ui/src` wherever automatic detection does not discover it. The migration MUST verify that utilities used by `@clensy/ui` continue to be emitted. Login and module pages must not go unstyled because scan paths dropped `packages/ui`.
- **Base palette:** shadcn zinc/neutral.
- **Semantic tokens** (light on `:root`, dark under the `.dark` selector used only on the theme root): at least `background`, `foreground`, `card`, `popover` (+ foregrounds), `muted`, `accent`, `primary` (+ foregrounds), `border`, `input`, `ring`, `destructive`, `radius`. Sidebar-specific tokens (`sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border`, `sidebar-ring`, and equivalents) if needed by composed chrome — not as an excuse to install shadcn `SidebarProvider`.
- New shell components style exclusively through those tokens (and Tailwind typography/spacing/radius utilities that resolve from them). `BrandMark` is token-driven; Slice 1 does not introduce a brand-specific hex outside the token set.
- `:root` always holds the **light** token set. Dark token values exist only when the theme root has resolved dark appearance (§4.3). `html` / `body` do not receive dark document styling.
- Type: system/ui sans (shadcn New York default is acceptable). Shell type scale: nav items `text-sm`; group labels `text-xs` uppercase tracking; brand name `text-sm font-semibold`; tagline `text-xs`; muted secondary copy uses `muted-foreground`.
- Space: default Tailwind scale. Expanded sidebar **14rem**; collapsed **4rem** (today's `w-56` / `w-16`). Header padding remains in the current 12–16px band.
- Radius: **0.5rem**, matching existing `@clensy/ui` controls at the chrome/island seam.

### 4.3 Theme scope and preference

**Modes:** `light` | `dark` | `system`. **Default: `system`.**

**Resolved appearance:** `light` and `dark` are explicit. `system` uses `prefers-color-scheme` and **must update** if the OS theme changes while the tab is open.

**Persistence:** client-side `localStorage` key `clensy.theme`. No cookie, no API, no user record. Missing or invalid stored value → `system`.

**Theme boundary:** The shell chrome wrapper is the theme root. All shell-owned descendants, including portal content rendered for shell interactions (dropdown, Sheet, tooltips), MUST inherit the resolved theme from that root. Content rendered under `/app/*` `<main>` MUST remain outside that themed subtree and MUST always resolve light tokens.

**Document rule:** At runtime, `html` and `body` MUST never receive `.dark`, `data-theme="dark"`, `color-scheme: dark`, or equivalent dark-theme state. The resolved dark state may exist only within the shell chrome subtree and its shell-owned portal roots.

**Control:** Light / Dark / System in the user dropdown only. Current preference is indicated. No theme UI on `/login`.

**Initial render:** The implementation MUST determine the effective shell theme before the themed chrome is visibly painted, including when `system` resolves to dark. Mechanism is intentionally unspecified. A helper that can only theme `document.documentElement` / `html` / `body` (including `next-themes` used in its default document-root mode) is **not** acceptable. The implementation MUST avoid a visible light→dark flash on initial load when the effective preference resolves to dark. It MAY use the smallest client-side bootstrap mechanism necessary to establish the shell theme before paint, provided that mechanism does not apply theme state to `html` or `body`.

**ToastProvider** remains `@clensy/ui` at layout level and is **not** migrated onto shadcn in this slice. Toasts that render in the content island stay light. Do not reparent toasts into `ShellChrome` solely to theme them.

### 4.4 Shell composition

```text
DashboardLayout
├── ShellChrome                 ← THEME ROOT
│   ├── AppSidebar
│   │   ├── BrandMark
│   │   ├── Primary nav
│   │   └── Collapse control (md+)
│   ├── AppHeader
│   │   ├── Mobile nav trigger (md:hidden)
│   │   └── UserMenu
│   └── Mobile Sheet            ← portal inside ShellChrome
└── main                        ← light content island; existing pages
```

Responsive behavior matches Dashboard UX Foundation §4.2, restyled: `md:` and up = sidebar rail + content; below `md:` = header + Sheet drawer. Collapse is desktop-only and persists under `clensy.sidebar.collapsed` (boolean, existing key — do not switch to shadcn's cookie).

### 4.5 shadcn primitives

Add **only:** `Button`, `Avatar`, `DropdownMenu`, `Separator`, `Sheet`, `Tooltip`, `Skeleton`.

Do **not** add the full shadcn `Sidebar` kit unless it can (1) persist desktop collapse exclusively as `clensy.sidebar.collapsed` and (2) live entirely under `ShellChrome` with no `html` / `documentElement` coupling. The default is to **compose** the rail from the primitives above.

Do **not** add Command, Card, Table, Tabs, Dialog, Badge, or a notifications control in this slice.

### 4.6 BrandMark

Presentational component:

```ts
type BrandMarkProps = {
  mark?: React.ReactNode;
  name: string;
  tagline?: string;
  compact?: boolean;
};
```

Slice 1 default (hardcoded at the call site, not from an API): `name="Clensy"` + `tagline="Laundry"`. The default mark is a small, implementation-defined geometric/iconographic mark using only shell semantic tokens. It MUST NOT introduce a brand-specific color, external image asset, remote resource, or tenant data. The exact visual geometry of the mark is an implementation detail; its color treatment and sizing are governed by shell tokens.

`compact` (collapsed rail): visual name/tagline hidden; mark remains. The brand remains programmatically identifiable to assistive technology. The implementation MUST avoid duplicate accessible names if the surrounding navigation landmark already provides the appropriate label.

No tenant API, upload, or persistence.

### 4.7 Navigation

Use the current structure as-is (labels and hrefs are the product IA; this slice does not change them):

```text
Operations:    Bookings /app/bookings, Jobs /app/jobs, Laundry /app/laundry, Invoices /app/billing
People:        Customers /app/customers, Cleaners /app/cleaners, Teams /app/cleaners/teams
Catalog:       Services /app/catalog, Add-ons /app/catalog/add-ons
Administration: Staff /app/admin
```

Active state: longest matching prefix among those hrefs (today's `findActiveHref` rule: `/app/cleaners/teams` highlights Teams, not Cleaners).

Collapsed desktop: control mark / first-letter affordance + Tooltip; group headings hidden.

Mobile Sheet: MUST preserve existing navigation semantics and provide modal focus management while open; closing MUST restore focus appropriately. Route changes MUST close the Sheet. Closed sheet remains inert (not merely `aria-hidden`) so focus cannot enter it.

### 4.8 Identity constraint

The shell MUST render only authenticated-user information available from the existing `CurrentAdmin` contract (`id`, `role`). It MUST NOT infer, fabricate, hardcode, or source identity information outside that contract. Until identity fields are added to the API, the user area displays role-derived initials and a human-readable role label only. Do not display `id` (UUID). Do not display a fake name, email, or "User".

**Closed role map** (normative):

| `role` | Label | Initials |
| --- | --- | --- |
| `OWNER` | Owner | OW |
| `OPS_MANAGER` | Ops Manager | OM |
| `SCHEDULER` | Scheduler | SC |
| `CUSTOMER_SUPPORT` | Customer Support | CS |
| `FINANCE` | Finance | FI |
| `ANALYST` | Analyst | AN |

Loading (`currentAdmin` in flight): Skeleton in the header identity slot — not a placeholder person. Absent/unauthenticated `currentAdmin` on a shell page: omit identity text/initials (middleware is UX-only; do not invent a user). A `role` value not in the map: render no label and no initials (fail closed). Do not guess.

**User dropdown:** role label; Light / Dark / System (current preference marked); Sign out.

**Sign out:** existing `logout` mutation. Success: `apolloClient.clearStore()` then `router.replace('/login')`. Failure (network or unsuccessful payload): do not navigate, do not clear the cache, show the existing inline copy `Unable to log out. Please try again.` No Profile / Account settings items. No changes to the `logout` GraphQL mutation, session-cookie behavior, Apollo setup, or existing error handling are permitted as part of this slice.

Future identity slice may extend `CurrentAdmin` and feed name/email/avatar into the same `UserMenu` without redesigning the shell tree.

### 4.9 Routing and auth (unchanged)

- `middleware.ts`: cookie-presence matcher `/app/:path*` → `/login`. No semantic change.
- `next.config.ts` `redirects()` array: **do not rewrite** as part of this slice.
- `/app` continues to redirect to `/app/customers`.
- `/` continues to redirect into `/app` (signed-out users still land on `/login` via middleware).
- `/login` stays public, outside the shell, no theme control.
- No new `/app/*` routes.
- GraphQL auth, session cookie, `credentials: 'include'` unchanged.

### 4.10 Compatibility

Intentional shell changes (shadcn, tokens, layout, theme, BrandMark, UserMenu) are in scope.

Infrastructure (Tailwind 4, PostCSS, `globals.css`, class scanning) is in scope.

Existing modules: preserve behavior, light UI intent, routes, and auth. Tailwind 4 migration fixes MUST preserve existing module behavior and visual intent. If a compatibility fix requires a non-trivial visual or behavioral change, stop and treat it as a separate scope decision rather than silently redesigning the module.

`Dockerfile.web` / `pnpm --filter web build` must still produce a working image.

## 5. Rationale

**Why shadcn in `apps/web` rather than `packages/ui`?** Module screens still depend on `@clensy/ui`. Putting shadcn in the shared package in this slice would mix two visual languages in one kit and invite accidental module adoption. A later unify-the-design-system spec can move primitives if needed.

**Why Tailwind 4 now?** Clensy web is unreleased. Staying on Tailwind 3 only to avoid touching unreleased module CSS would force a second migration when those pages are redesigned. Compatibility fixes are allowed; redesign is not.

**Why not `.dark` on `html`?** Module pages and `@clensy/ui` are light-only. Document-level dark would restyle the island or native controls even without `dark:` classes (`color-scheme`, inherited backgrounds). Theme belongs to `ShellChrome`.

**Why not extend `CurrentAdmin` for a name?** Slice 1 is API-free. A prettier mockup is not worth a GraphQL contract change. The closed role map is honest and testable.

**Why not shadcn Sidebar by default?** That kit's provider/cookie/`document` assumptions conflict with `clensy.sidebar.collapsed` and chrome-only theming. Composition is the smaller, spec-faithful path.

**Why keep `/app` → customers?** Operations dashboard content is Slice 3 / former M9. This spec does not invent metrics or GraphQL for a home page.

**Why no Playwright?** Phase 1 and Dashboard UX Foundation already deferred browser automation. This slice adds unit tests only where new closed logic exists (role map, theme resolution).

## 6. Testing and acceptance

Phase 1: no Playwright for `apps/web`. No API e2e as a substitute for frontend behavior. No screenshot-diff suite and no expanded a11y program beyond BrandMark compact naming and Sheet focus in §4.6–§4.7.

**Automated — role presentation:** a pure function from `Role` to `{ label, initials }`. Every table row in §4.8; unmapped input fails closed (no fabricated label/initials).

**Automated — theme resolution:** a pure function from stored preference + `prefers-color-scheme` to `{ preference, resolved }`. Missing/invalid storage → `system`; `light`/`dark` ignore OS; `system` tracks OS; OS change while `system` updates `resolved`; explicit `light`/`dark` do not follow OS. Smallest test runner that `apps/web` can run in CI; not a component-test framework.

**Build gates:** `pnpm --filter web lint` and `pnpm --filter web build` succeed. Docker web image still builds.

**Manual golden path:**

1. Signed out: `/` and `/app` reach `/login`. Login still works. `/login` has no theme control.
2. Signed in: `/app` redirects to `/app/customers`. Every sidebar href in §4.7 loads the same module as today.
3. Desktop: collapse persists as `clensy.sidebar.collapsed`; compact `BrandMark` is mark-only with AT identification per §4.6.
4. Mobile: Sheet opens/closes with modal focus management; route change closes it; closed sheet is inert.
5. User menu: role label + initials only; Sign out success → `/login`; failed logout stays on page with existing error copy.
6. Theme: default System; Light / Dark / System persist as `clensy.theme`; OS change updates chrome in System. At runtime, `html` and `body` MUST never receive `.dark`, `data-theme="dark"`, or equivalent dark-theme state. Chrome may be dark while Customers (and `@clensy/ui` dialogs/drawers/toasts used from `main`) stay light.
7. Old-path redirects in `next.config.ts` still work.
8. Escalation: if a TW4 fix would change module look/behavior beyond same intent, stop (§4.10).

## 7. Non-goals

- Slice 2: navigation IA / laundry-first labels / grouping or deprecating current items.
- Slice 3: dashboard home, metrics, recent orders, charts, dashboard GraphQL.
- Identity API (`name`, `email`, `avatar` on `CurrentAdmin`).
- Tenant branding persistence.
- Login visual redesign.
- `@clensy/ui` → shadcn migration.
- Module-by-module visual redesign.
- Playwright / browser automation.
- Applying dark theme to `html`, `body`, or `<main>`.
- Inventing or hardcoding a display name for the signed-in admin.
- New Nest/TypeORM/GraphQL fields or operations.
