# Reusable `DataTable` and `BookingDataTable` — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-19 |
| Tracking issue | [#61](https://github.com/rexescario-dev/clensy-platform/issues/61) — "add reusable DataTable and refactor Bookings table" |
| Depends on (Accepted) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — established `packages/ui/src/base/` as the home for `DataTable` (already relocated there, §4.2/§4.3 of that spec), the `apps/web` consumes-only-through-`@clensy/ui` rule this spec's `DataTable` changes stay inside, and — directly load-bearing for §4.3 below — its own §4.1 rule that "`packages/ui` may use shadcn/`radix-ui` internally... a future replacement of the underlying primitive implementation stays inside `packages/ui`." [`@clensy/web` / `LoginForm`](2026-09-19-clensy-web-login-form-design.md) — established `@clensy/web` (not `packages/ui/src/domain/`, now legacy) as the home for business-domain composition, and the "host injects data/i18n, component takes plain values and callbacks" pattern this spec's `BookingDataTable` follows for price formatting (§4.4, §5). |
| Related (not a dependency) | [Bookings Design](2026-08-22-bookings-design.md) — the Bookings feature's original contract (columns, `?detail=` drawer convention, no search/filter/sort was ever specified or built — confirmed by reading the current implementation, §4.6). |
| Followed by | See §6 — enabling sorting/selection/page-size specifically for Bookings, a `CustomerDataTable`, cross-page select-all, wiring the Bookings toolbar slot to search/filters, and finalizing `BookingDataTable`'s exact `Booking` representation are all explicitly deferred. |
| Governing references | This document. It does not redesign `DataTable`'s existing pagination contract or Bookings' GraphQL/query behavior — it re-platforms the former onto shadcn-backed primitives (round 2 revision, §4.3) and relocates the latter's table rendering into a new domain component without changing what it fetches. |
| M3 decision | **Accepted** — 2026-09-19. Two review rounds: round 1 returned for revision, requiring `DataTable` to compose shadcn-generated `Table`/`Pagination`/`Checkbox` primitives now rather than deferring that to a later slice, plus clarifications on pagination-by-default vs. page-size-selection-opt-in wording, never-prune-`selectedKeys` selection semantics, and deferring `BookingDataTable`'s exact `Booking` representation to M4 (all resolved in round 2, §4.2–§4.4, §5). Round 2 accepted without further changes. No remaining design blocker. Ready for M4 Implementation Planning. **Post-Accept factual correction (2026-09-19, raised during M5 Plan Review):** the consumer count was miscounted throughout as "nine screens/call sites" — the correct count, re-verified by grep, is nine non-Bookings screens at eleven call sites (two of those nine files each contain two `<DataTable>` call sites) plus Bookings, i.e. ten screens / twelve call sites total. Corrected throughout this document (§1, §2, §4.1, §5, §7, §9); no normative requirement changed. |

## 1. Thesis

`packages/ui/src/base/data-table.tsx` already exists and is consumed, unmodified in its current form, by **ten screens** across `apps/web` (`admin`, `billing`, `catalog`, `catalog/add-ons`, `cleaners`, `cleaners/teams` (twice — team list and team-member list), `customers` (twice — customer list and property list), `jobs`, `laundry`, `bookings`) — **twelve `<DataTable>` call sites in total: eleven outside Bookings, one inside it** (verified by grep, exact count in §4.1 — an earlier draft of this spec miscounted this as "nine"; corrected here). None of those twelve call sites use anything beyond `columns`, `rows`, `rowKey`, `emptyMessage`, `loading`, `error`, `onRowClick`, and `pagination` (page/pageSize/totalCount/onPageChange). This spec keeps that same config-driven prop API (`columns`/`rows`, not children) so the **eleven non-Bookings call sites** need **zero code changes**, but re-platforms `DataTable`'s internal rendering onto three new shadcn-backed `@clensy/ui` building blocks — `Table` (primitive), `Pagination` (generic composition), and `Checkbox` (primitive) — rather than `DataTable`'s own hand-rolled `<table>` markup and hardcoded `slate-*` classes. `DataTable` becomes a behavior/composition layer over these, not a table primitive itself. This is a deliberate visual restyle of all ten consumer screens (semantic-token-based markup replacing the current hardcoded styling), accepted now rather than deferred, for the reason round 1 of this spec got wrong: doing it later means shipping a second, temporary non-shadcn table implementation this ticket already knows is wrong. `DataTable` also gains the capabilities issue #61 asks for (sorting, row selection, a toolbar extension point, and pagination that includes optional page-size selection) as controlled props — pagination itself is part of `DataTable` by default whenever a `pagination` prop is supplied (as it already is for all twelve call sites today); *page-size selection specifically* stays an additive opt-in (`pagination.pageSizeOptions`), so none of the **nine non-Bookings screens** gains a size selector merely from this restyle. `BookingDataTable`, a new `@clensy/web` domain component, is introduced to own Bookings-specific columns and rendering, and the Bookings page is thinned to compose it — the only consumer that adopts the new interactive capabilities, and only the ones it actually needs (none of them, this slice — see §4.6).

## 2. Scope

**In scope (normative):**

- A new shadcn-generated `Table` primitive family in `packages/ui/src/base/table.tsx` (`Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) — §4.2.
- A new shadcn-generated `Checkbox` primitive in `packages/ui/src/base/checkbox.tsx`, used for selection — §4.2.
- A new generic `Pagination` composition in `packages/ui/src/base/pagination.tsx`, built from the existing `Button` primitive plus `lucide-react` icons (no new dependency — both already present in `packages/ui`), taking the existing `DataTablePaginationProps` shape and rendering Previous/Next controls plus, when `pageSizeOptions` is supplied, a page-size `<select>` — §4.2.
- Rewriting `data-table.tsx` to compose `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Checkbox`, and `Pagination` internally, while keeping its external prop API (`columns`, `rows`, `rowKey`, `emptyMessage`, `loading`, `error`, `onRowClick`, `pagination`) unchanged in shape — §4.2, §4.3.
- New optional `DataTable` props for controlled sorting (`sort`/`onSortChange`), controlled row selection (`selection`), and a top toolbar slot (`toolbar`) — §4.2.
- New optional `DataTableColumn` fields (`sortable`, `align`, `width`) — §4.2.
- A new `packages/web/src/bookings/booking-data-table.tsx` exporting `BookingDataTable`, owning Bookings' existing seven columns (Customer, Property, Service, Scheduled, Status, Team, Price) and their exact current rendering, sourced from the current `apps/web/app/app/bookings/page.tsx` (§4.4).
- Adding `vitest` to `@clensy/web` (new wiring; the package has none today), following the precedent set when `@clensy/ui` gained it (§7).
- Refactoring `apps/web/app/app/bookings/page.tsx` to render `<BookingDataTable ... />` instead of an inline `<DataTable columns={...} ... />` call, removing the page's own `columns`/`BookingRow`/`formatScheduledAt` definitions in favor of `BookingDataTable`'s (§4.5).
- Unit tests for the new `Table`/`Checkbox`/`Pagination` primitives and `DataTable` capabilities in `packages/ui`, and for `BookingDataTable`'s column rendering in `packages/web`, following the existing `renderToStaticMarkup`-based convention (§7).
- A visual restyle of all ten `DataTable`-consuming screens, as the direct and accepted consequence of the markup change above — not a redesign of any of them (§5, §7).

**Informative:** the full ten-screen (twelve-call-site) inventory in §4.1; the actual (not assumed) current Bookings URL/search/filter/sort behavior in §4.6.

**Out of scope:**

- A shadcn `Select` primitive. The `Pagination` component's page-size control uses a plain `<select>`, matching this repository's existing native-form-control convention (every current dropdown in `apps/web` — booking status, team, customer, service — is a native `<select>`, not a shadcn one). `Checkbox` is added because selection has no equivalent native-control precedent to match and shadcn's own reference data-table pattern uses one; `Select` does have a native-control precedent, so it is deliberately not added (§5).
- Enabling sorting, row selection, or the page-size selector for Bookings itself. `BookingDataTable` does not set `sort`, `selection`, or `pagination.pageSizeOptions` this slice — Bookings had none of these before, and the issue's "preserve existing behavior" directive (not "add new interaction affordances") governs adoption, even though the underlying capability is delivered generically (§4.6, §5, §6).
- Adding URL query-parameter synchronization for page, limit, search, filters, or sorting to the Bookings page. The current Bookings page synchronizes **only** `?detail=<id>` (via `useDetailDrawer`) with the URL; `page` is local `useState`, and there is no search, filter, or sort UI anywhere in the current implementation — verified by reading the full page, not assumed from the issue's illustrative description (§4.6).
- A `CustomerDataTable` or any other domain-specific table. `BookingDataTable` establishes the pattern; a second consumer is a future slice (§6).
- Cross-page "select all" semantics. Selection operates on the current page's rendered rows only, though `DataTable` never prunes keys belonging to other pages from a consumer-supplied `selectedKeys` (§4.2, §5).
- Fixing the exact final shape of `BookingDataTable`'s `Booking` type (structural GraphQL-result pass-through vs. an explicit minimal view model + `apps/web`-side adapter). Both satisfy this spec's boundary requirement (no `@clensy/client` import); which one is chosen is deferred to M4 (§4.4, §6).
- Any change to the nine non-Bookings `DataTable` consumers' code, columns, or business behavior — their *rendered appearance* does change (restyle, in scope above); nothing about what they show or how they behave does (§4.1, §5).
- Introducing Vuetify, another table library, or a second design system (explicit issue constraint).
- `jsdom`/`@testing-library/react` or any component-rendering test framework — none exists in this repository today (§7).

## 3. Terminology

- **Generic capability vs. adoption:** this spec distinguishes what `DataTable` (in `@clensy/ui`) is *capable of* from what `BookingDataTable`/Bookings *turns on*. Issue #61's acceptance criteria are largely phrased at the capability level ("DataTable supports…"); this spec satisfies them there while keeping Bookings' actual on-screen interactive behavior unchanged except for the composition boundary itself (§4.6).
- **Restyle vs. redesign:** a restyle changes rendered classes/markup while preserving structure, content, and interaction (the same distinction the `Button` variant-vocabulary migration in the boundary spec relied on). This spec restyles all ten `DataTable`-consuming screens by construction (§4.3) but redesigns none of them — no column, action, or interaction changes outside Bookings.
- **Controlled state:** `sort` and `selection` follow the same pattern `pagination` already uses — `DataTable` renders from props and reports intent via callbacks; it never mutates `rows`, fetches data, or persists state itself. Confirmed for sorting: `onSortChange` is the *only* effect of a header click — `DataTable` does not reorder `rows` client-side under any configuration (§4.2).
- **Current page:** the set of rows in the `rows` prop at any given render — `DataTable` has no knowledge of rows on other pages. Selection interactions (§4.2) only ever add or remove *this page's* row keys from `selectedKeys`; a key belonging to another page that the consumer already put in `selectedKeys` is never touched.

## 4. Architecture & behavioral contracts

### 4.1 Consumer inventory (verified by grep)

| Consumer | Props used |
| --- | --- |
| `apps/web/app/app/admin/page.tsx` | `columns`, `rows`, `rowKey`, `pagination` |
| `apps/web/app/app/billing/page.tsx` | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/catalog/page.tsx` | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/catalog/add-ons/page.tsx` | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/cleaners/page.tsx` | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/cleaners/teams/page.tsx` (×2 — teams, team members) | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/customers/page.tsx` (×2 — customers, properties) | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/jobs/page.tsx` | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/laundry/page.tsx` | `columns`, `rows`, `rowKey`, `onRowClick`, `pagination` |
| `apps/web/app/app/bookings/page.tsx` | same set — **this is the only call site whose code this spec changes** (§4.5) |

**Exact count** (verified by grep, `grep -c '<DataTable' <file>` per file): 9 non-Bookings files, 11 non-Bookings call sites (`cleaners/teams/page.tsx` and `customers/page.tsx` each contribute 2; the other 7 files contribute 1 each) + Bookings' 1 file / 1 call site = **10 files, 12 call sites total**.

None passes (or could pass, since the props don't exist today) anything related to sorting, selection, or a toolbar. Every new prop added in §4.2 is optional and defaults to "not rendered" — the nine non-Bookings files above need **zero code changes**. They do render with new markup/classes after §4.3's restyle (in scope, §2); their columns, data, pagination behavior, and row-click behavior are otherwise identical.

### 4.2 New primitives and `DataTable` API (`packages/ui/src/base/`)

```ts
// table.tsx — shadcn-generated, verbatim pattern matching the other relocated
// primitives (avatar.tsx, button.tsx, ...): Table, TableHeader, TableBody,
// TableFooter, TableRow, TableHead, TableCell, TableCaption.

// checkbox.tsx — shadcn-generated. Zero new dependency: `radix-ui`'s Checkbox
// primitive is already available through the unified `radix-ui` package
// `packages/ui` already depends on (verified: `dependencies.radix-ui` in
// packages/ui/package.json is the consolidated package, not a per-primitive
// one). Supports `checked: boolean | 'indeterminate'` directly — no manual
// DOM `.indeterminate` ref hack needed for the "select all" header checkbox.

// pagination.tsx
export function Pagination(props: DataTablePaginationProps): ReactNode;
// Composes the existing Button primitive (Previous/Next) and, when
// `pageSizeOptions` is supplied, a plain `<select>` for page size (§2 —
// no shadcn Select). Exported publicly, independently usable outside
// DataTable (a future non-table paginated view could reuse it).

// data-table.tsx
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;          // new — renders a clickable, indicator-bearing header
  align?: 'left' | 'center' | 'right'; // new — default 'left', unchanged from today
  width?: string;               // new — passed through as a `style.width` on <TableHead>/<TableCell>
}

export interface DataTableSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTableSelectionProps<T> {
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  isRowSelectable?: (row: T) => boolean; // default: every row selectable
}

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];             // new — omit to keep today's fixed-size behavior
  onPageSizeChange?: (pageSize: number) => void; // new — required together with pageSizeOptions
}

export interface DataTableProps<T> {
  // ...all existing fields, unchanged in name and meaning...
  sort?: DataTableSortState | null;         // new
  onSortChange?: (sort: DataTableSortState | null) => void; // new
  selection?: DataTableSelectionProps<T>;   // new
  toolbar?: ReactNode;                      // new
}
```

Behavior:

- **Sorting.** A column with `sortable: true` renders its header as a button with a `lucide-react` indicator (neutral/asc/desc, matching the icon-usage precedent already in `dropdown-menu.tsx`/`sheet.tsx`). Clicking cycles `none → asc → desc → none` and calls `onSortChange` with the new state (or `null`); `DataTable` never reorders `rows` itself (§3) — the consumer (or its server) is responsible for actually sorting, matching the issue's explicit "`DataTable` must report sorting changes to its consumer rather than performing API requests" requirement. There is no `sortFn`/client-side comparator prop — "custom sorting" (mentioned in the issue) is therefore entirely a consumer/backend concern, not something `DataTable` executes.
- **Selection.** When `selection` is present, a `Checkbox` column is prepended: a header checkbox (checked when every selectable row on the current page is present in `selectedKeys`, `'indeterminate'` when some but not all are — computed only from the current page's row keys, never from `selectedKeys.length`) and a per-row `Checkbox` (disabled when `isRowSelectable` returns `false`). **`DataTable` never prunes `selectedKeys`:** toggling one row adds/removes only that row's key, preserving every other entry (including keys belonging to other pages); toggling "select all" adds/removes only the current page's selectable row keys, via a set-union/set-difference against the existing `selectedKeys` array — never a wholesale replacement. This keeps a future cross-page selection experience possible without `DataTable` needing to know about it now (§3, §5).
- **Toolbar.** `toolbar`, when present, renders inside a `flex items-center justify-between gap-3` row above the table. `DataTable` has no opinion on its contents (search box, filter selects, bulk-action buttons) — it is exactly the generic extension point the issue requires, carrying no search-specific assumption.
- **Pagination.** `DataTable` renders `Pagination` (§4.2 above) whenever a `pagination` prop is supplied — this is the "pagination is built into `DataTable` by default" the issue asks for, and is exactly what all twelve call sites already trigger today. `pagination.pageSizeOptions`, when present, additionally renders a page-size `<select>`; omitting it (as all twelve call sites do today) renders Previous/Next only, identical in *capability* to today. `DataTable` does not clamp or reset `page` itself when the size changes — that is the consumer's responsibility, consistent with `DataTable` never owning fetch/paging logic beyond rendering the controls.

### 4.3 `DataTable` composes primitives; it is not one itself

Per round-1 M3 feedback: `data-table.tsx` no longer contains its own `<table>`/`<thead>`/`<tbody>` markup or hardcoded `slate-*` classes. It imports and renders `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` (§4.2) for structure, `Checkbox` for selection, and `Pagination` for the footer — using the semantic theme tokens those primitives already carry (`border`, `bg-muted/50`, `text-muted-foreground`, …), the same tokens every other `base/` primitive consumes (per `packages/ui/README.md`'s theme-tokens section). `DataTable` itself contributes no markup of its own beyond composing these and mapping `columns`/`rows` into `TableHead`/`TableCell` children, plus the sorting/selection/toolbar behavior described in §4.2. This is a visual restyle of every existing consumer (§2, §7) — not a behavioral one: `columns`, `rows`, `rowKey`, `emptyMessage`, `loading`, `error`, `onRowClick`, and `pagination` all keep their exact current meaning and effect.

### 4.4 `BookingDataTable` (`packages/web/src/bookings/booking-data-table.tsx`)

Following `LoginForm`'s precedent (already-plain values and callbacks in, no GraphQL/i18n import) and `@clensy/web`'s own boundary (must not import `@clensy/client`, `@apollo/client`, or `next-intl`):

```ts
export interface BookingDataTableProps {
  bookings: Booking[];  // exact representation — structural pass-through vs. explicit view model — decided at M4, see below
  formatPrice: (minorUnits: number) => string; // host injects — see §4.6 of the LoginForm spec's precedent
  loading?: boolean;
  error?: string;
  onRowClick?: (booking: Booking) => void;
  pagination: DataTablePaginationProps;
}

export function BookingDataTable(props: BookingDataTableProps) { /* composes @clensy/ui DataTable */ }
```

- `BookingDataTable` owns the seven columns (Customer/Property/Service/Scheduled/Status/Team/Price) and the `formatScheduledAt` helper, moved (not duplicated) from `apps/web/app/app/bookings/page.tsx` — `formatScheduledAt` uses only `Date`/`toLocaleString()`, no app-specific dependency, so it relocates cleanly.
- **`Booking`'s exact shape is deferred to M4, not fixed by this spec.** Round-1 feedback correctly flagged that a full hand-written duplicate of the GraphQL `Booking` shape (as round 1 proposed) is a maintenance risk. Two options remain open, both compliant with `@clensy/web`'s boundary (neither imports `@clensy/client`):
  1. **Structural pass-through** — `BookingDataTable` declares a plain interface shaped like today's GraphQL result (`{ id, scheduledAt, status, pricingSnapshot: { priceMinorUnits }, customer: { fullName }, ... }`); `apps/web` passes its query result directly, relying on TypeScript structural typing (no import needed either direction).
  2. **Explicit minimal view model** — `BookingDataTable` declares a flatter `BookingDataTableItem` (`{ id, customerName, propertyAddress, serviceName, scheduledAt, status, teamName, priceMinorUnits }`); `apps/web` maps its query result into it before rendering.
  Option 1 costs `apps/web` nothing extra but couples `BookingDataTable`'s contract to the GraphQL result's nested shape by convention (not by import); option 2 adds an explicit adapter step but decouples the two shapes entirely. M4 picks one, using whichever keeps the `apps/web` call site (§4.5) closest to a thin composition layer without adding an adapter function whose only job is reshaping obviously-compatible data. `BookingStatus`'s four literal values (`'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'`) are declared locally in `@clensy/web` either way — never imported from `@clensy/client` — mirroring `LoginFormValues`'s already-established precedent of not importing a backend-generated type.
- Price formatting is host-injected (`formatPrice`), not owned by `BookingDataTable`, because `apps/web/lib/format-price.ts`'s `formatMinorUnits` lives in the application layer and `@clensy/web` must not import from it — the same boundary reason `LoginForm` takes translated strings instead of calling `next-intl` itself.
- No sorting, selection, or page-size props are wired up (§2, §4.6).

### 4.5 Bookings page after refactor

`apps/web/app/app/bookings/page.tsx` keeps: the GraphQL queries/mutations (`useBookingsQuery` and friends), `page` state, the create `FormDialog`, `useDetailDrawer`/`?detail=` wiring, and `BookingDetailDrawer`. It loses: the `columns` array, the `BookingRow` type, and `formatScheduledAt` — all moved into `BookingDataTable`. Its `<DataTable columns={...} rows={...} .../>` call becomes (shown here using option 1 from §4.4; a §4.4-option-2 adapter step would sit between `rows` and this call if M4 picks that instead):

```tsx
<BookingDataTable
  bookings={rows}
  formatPrice={formatMinorUnits}
  loading={loading}
  error={error ? 'Unable to load bookings.' : undefined}
  onRowClick={(booking) => openDetail(booking.id)}
  pagination={{ page, pageSize, totalCount: data?.bookings.totalCount ?? 0, onPageChange: setPage }}
/>
```

No other page behavior (create dialog, detail drawer, delete, job creation) changes.

### 4.6 What "preserve existing Bookings URL/pagination/search/sort/selection behavior" actually means here

Read directly off the current implementation, not assumed from the issue's illustrative description:

- **URL:** only `?detail=<id>` is synchronized (via `useDetailDrawer`). `page` is local component state, never reflected in the URL. This spec does not add URL sync for `page`, `pageSize`, or anything else — doing so would be a new behavior, not a preserved one (§2).
- **Search / filters:** none exist on the Bookings page today. Nothing to preserve; none is added.
- **Sorting:** none exists today (no sortable column, no sort UI). `DataTable` gains the generic capability (§4.2); `BookingDataTable` does not enable it (§2).
- **Selection:** none exists today (no checkboxes, no bulk actions). Same treatment as sorting.
- **Page size:** fixed at 20, no UI to change it, today. Pagination itself (Previous/Next) is unchanged — "by default" (issue's wording) is satisfied because `DataTable` always renders `Pagination` when a `pagination` prop exists, which Bookings already supplies. Page-*size* selection specifically is the one piece deliberately not enabled for Bookings this slice, same treatment as sorting/selection.

This resolves the apparent tension in the issue between "DataTable includes pagination and limit selection by default" (a `DataTable` *capability* requirement — pagination genuinely is unconditional whenever `pagination` is supplied; page-size selection is the one sub-piece that stays additive, satisfied generically in §4.2) and "preserve existing Bookings pagination behavior" (satisfied by `BookingDataTable` simply not enabling the page-size sub-capability this slice). Enabling it for Bookings specifically is recorded as a followed-by item (§6), not silently dropped.

## 5. Rationale

**Why extend `DataTable` in place instead of introducing a second, richer table component?** Ten screens (twelve call sites) already depend on today's `DataTable`'s config-driven API. A second component would either fork the nine non-Bookings screens' future onto a component nobody plans to touch, or require migrating all twelve call sites' *code* in one slice — a much larger, unrelated-feature-touching change than this ticket needs. Additive, optional props and an internal-only markup change get every capability the issue asks for with zero code changes to the other nine non-Bookings screens, verified by the §4.1 inventory.

**Why restyle `data-table.tsx` onto shadcn `Table`/`Checkbox`/`Pagination` now, reversing round 1's "defer it" position?** Round 1 treated this as optional, deferrable polish and weighed it against "don't touch unrelated screens." That traded a real but bounded cost (a one-time restyle of nine already-`DataTable`-shaped screens) against a durable one: `DataTable` would keep being *the one `base/` composition still built on hand-rolled markup and hardcoded colors* — exactly the "two visual languages" problem the boundary spec's Button migration was written to eliminate, reintroduced in a new component the same day this ticket asks `@clensy/ui` to grow. The boundary spec's own §4.1 anticipates exactly this: "`packages/ui` may use shadcn/`radix-ui` internally... a future replacement of the underlying primitive implementation stays inside `packages/ui`" — restyling `DataTable` is that replacement, done now instead of as a second, separately-reviewed migration later. The restyle is markup/class-only (§4.3, §3's restyle-vs-redesign distinction): no consumer's columns, data, or interactions change.

**Why `Checkbox` now but not `Select`?** Selection has no existing native-control precedent in this repository to stay consistent with — there is no "selection UI" anywhere today, native or otherwise, and shadcn's own reference data-table pattern (the issue's cited API reference) uses a `Checkbox`. Page-size selection, by contrast, *does* have an established local convention: every dropdown in `apps/web` today (booking status, team, customer, service) is a native `<select>`. Adding `Select` here would introduce a second, inconsistent dropdown visual language for one feature; adding `Checkbox` introduces a first (and needed) selection affordance with, per §4.2, zero new dependency cost.

**Why does `BookingDataTable` take a `formatPrice` callback instead of formatting price itself?** `apps/web/lib/format-price.ts`'s `formatMinorUnits` lives in the application layer and `@clensy/web` must not import from `apps/web` (its own documented boundary). `LoginForm` resolved the identical shape of problem — a display-formatting concern that's really the host's to own — by taking already-formatted/translated values and host callbacks rather than reaching into `apps/web`. `formatScheduledAt`, by contrast, has no such cross-boundary dependency (it only uses `Date`/`toLocaleString()`), so it safely relocates into `BookingDataTable` outright rather than being injected.

**Why defer `Booking`'s exact shape to M4 instead of deciding it here?** Both options in §4.4 satisfy every normative requirement this spec states (no `@clensy/client` import, presentational-only component); the difference is purely an internal-boundary ergonomics tradeoff (implicit structural coupling vs. an explicit adapter with no behavioral effect either way). That is exactly the kind of "how, not what" decision M4 is for, per this repository's own precedent (the boundary spec deferred the equivalent shadcn-CLI-workflow mechanics the same way).

**Why does selection preserve out-of-page keys instead of `DataTable` owning the full array?** `DataTable` never holds more than the current page's `rows` — it doesn't fetch data and has no visibility into rows on other pages (§3). If `DataTable` treated `selectedKeys` as fully its own and rewrote it wholesale on every interaction, a consumer could never build cross-page selection on top of it without fighting the component. Restricting every mutation this component performs to "this page's keys only" costs nothing today (no consumer needs cross-page selection yet) and keeps that door open, per round-1 feedback.

## 6. Followed-by: what this slice deliberately leaves for later

- Enable sorting, selection, and/or page-size selection specifically for the Bookings screen, once there's an actual product need for them (§2, §4.6).
- A `CustomerDataTable` (or other domain table) following the `BookingDataTable` pattern, once a second consumer needs one (§2).
- Wire the Bookings page's "+ New Booking" button (or a future search/filter UI) into `DataTable`'s new `toolbar` slot — not required this slice since the current button already renders correctly in `PageHeader`'s `actions` slot, unrelated to the table itself.
- Cross-page select-all semantics (§2, §5).
- A `no-restricted-imports`-style check (or equivalent) that `@clensy/web` never imports `@clensy/client`/`@apollo/client`/`next-intl`, mirroring the existing `apps/web`-only-through-`@clensy/ui` grep gate (§7) — worth doing, not required by this slice.
- A shadcn `Select` primitive, if a future feature needs one badly enough to justify a second dropdown convention alongside native `<select>` (§5).

## 7. Testing and acceptance

Consistent with this repository's existing frontend testing precedent (no `jsdom`/`@testing-library/react` anywhere; `vitest` + `renderToStaticMarkup` for component-shaped assertions, e.g. `packages/ui/src/base/button.test.tsx`):

**Automated — `packages/ui`:** unit coverage for `Table`'s primitive markup (mirroring `button.test.tsx`'s style for a relocated/generated primitive), `Checkbox`'s checked/unchecked/`'indeterminate'` states, `Pagination`'s Previous/Next disabled-at-bounds behavior and page-size `<select>` presence gated strictly on `pageSizeOptions`, and `data-table.tsx`'s own new coverage: sortable-header click cycling and `onSortChange` payloads (asc → desc → none), that `DataTable` never reorders `rows` regardless of `sort`, selection checkbox rendering and `onSelectionChange` payloads — including that toggling "select all" only adds/removes the current page's keys and never drops a pre-existing out-of-page key the test seeds into `selectedKeys` (§4.2, §5) — and `toolbar` content rendering.

**Automated — `packages/web`:** `vitest` added to this package (new; mirrors `@clensy/ui` gaining it in the boundary spec). Unit tests for `BookingDataTable` covering: each of the seven columns' rendered value (including the date/status/team/price formatting, with a stub `formatPrice`), `onRowClick` passthrough, and pagination prop passthrough to the underlying `DataTable`.

**Automated — Bookings page:** the concrete mechanism (e.g. mocking `@clensy/client`'s generated Apollo hooks, extending `apps/web/vitest.config.ts`'s `include` beyond today's `lib/**`/`i18n/**` to reach `app/**`, or a narrower structural check) is an implementation-planning decision (M4), not resolved here — this repository has no existing precedent for testing a GraphQL-backed `page.tsx` file today. The normative requirement this spec sets is: after the refactor, `BookingsPageContent` must be verifiably still wired to `BookingDataTable` with the same query variables, callbacks, and props enumerated in §4.5.

**Grep-verifiable acceptance gates:**

- No diff to any of the nine non-Bookings consumer files' own source beyond what a dependency-version/lockfile change would produce (their *rendered output* changes via `DataTable`'s internals, not their own code — §4.1).
- No hardcoded `slate-*` (or any other non-token) color/border/background utility class remains in `data-table.tsx` — it renders exclusively through `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Checkbox`, and `Pagination` (§4.3).
- No `import` of `@clensy/client`, `@apollo/client`, or `next-intl` anywhere under `packages/web/src/`.

**Build gates:** `pnpm --filter @clensy/ui build`/`lint`/`test`, `pnpm --filter @clensy/web build`/`lint`/`test`, and `pnpm --filter web build`/`lint`/`test` all succeed.

**Manual golden path:** the Bookings screen (list render, pagination Previous/Next, row click → detail drawer, create/edit/delete flows) behaves identically to today, restyled onto the new `Table`/`Pagination` tokens. Each of the other nine `DataTable`-consuming screens (`admin`, `billing`, `catalog`, `catalog/add-ons`, `cleaners`, `cleaners/teams`, `customers`, `jobs`, `laundry`) is spot-checked to confirm the restyle is cosmetic only — same columns, same data, same pagination and row-click behavior, new token-based appearance.

## 8. Non-goals

- A shadcn `Select` primitive for page-size (§2, §5, §6).
- Enabling sorting, selection, or page-size selection for Bookings itself (§2, §4.6, §6).
- URL synchronization for anything beyond the existing `?detail=` param (§2, §4.6).
- A `CustomerDataTable` or any second domain table (§2, §6).
- Cross-page select-all (§2, §5, §6).
- Any code change to the nine non-Bookings `DataTable` consumers (their rendered appearance changes as a restyle; their code, columns, and behavior do not) (§2, §4.1, §7).
- Fixing `BookingDataTable`'s exact `Booking` representation now rather than at M4 (§4.4, §6).
- Introducing Vuetify, another table library, a second design system, or a component-rendering test framework (§2, §7).

## 9. Acceptance criteria (for this specification)

- Accounts for every current `DataTable` consumer (all twelve call sites across ten screens — nine non-Bookings files at eleven call sites, plus Bookings), verified by grep, with an explicit statement that the nine non-Bookings screens need no code change while all ten restyle (§4.1, §2).
- States the exact new `Table`/`Checkbox`/`Pagination` primitives and `DataTable` API surface needed to satisfy issue #61's capability-level acceptance criteria, with behavior specified precisely enough that M4 doesn't need to re-derive it (§4.2).
- Resolves, with rationale, why `DataTable` is re-platformed onto shadcn-backed primitives in this slice rather than deferred, and why `Checkbox` is added but `Select` is not (§4.3, §5).
- Defines `BookingDataTable`'s exact contract, including how it respects `@clensy/web`'s existing documented boundary (no `@clensy/client`/`@apollo/client`/`next-intl` imports) for its price-formatting injection, while explicitly and deliberately deferring its `Booking` shape's structural-vs-view-model question to M4 with both options fully specified (§4.4, §5).
- States, using the current implementation as source of truth (not the issue's illustrative description), exactly what Bookings' URL/search/filter/sort/selection/page-size behavior is today and what "preserve" and "by default" therefore mean (§4.6).
- Distinguishes generic-capability delivery from Bookings-specific adoption everywhere the issue's acceptance criteria could otherwise be read as requiring both (§2, §4.6, §5).
- States precisely how selection must treat keys outside the current page (never pruned), closing the round-1 gap (§4.2, §5).
- Defines a testing and acceptance bar consistent with this repository's existing precedent, including grep-based regression gates that distinguish "no code change" from "restyled" for the nine untouched consumer screens, while explicitly deferring the one genuinely new testing-infrastructure decision (page-level GraphQL mocking) to M4 rather than deciding it here (§7). States the exact non-Bookings/total consumer counts precisely (nine files / eleven call sites vs. ten files / twelve call sites), correcting an earlier miscount so the acceptance gates in §7 have an unambiguous inventory to check against.
