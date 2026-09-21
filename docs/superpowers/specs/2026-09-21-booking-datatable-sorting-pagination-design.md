# `BookingDataTable` Sorting, Cursor-Shaped Pagination, URL State, Loading UX, Status Badges & Mobile View — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Kind | Architecture RFC (product/frontend + GraphQL-contract capability, not a process specification) |
| Date | 2026-09-21 |
| Tracking issue | [#65](https://github.com/rexescario-dev/clensy-platform/issues/65) — "enhance BookingDataTable with sorting, cursor pagination, URL state, loading UX, status badges, and mobile view" |
| Depends on (Accepted) | [Reusable `DataTable` and `BookingDataTable`](2026-09-19-reusable-data-table-design.md) (#61) — this spec is the explicit §6 "followed-by" item that design deferred: "Enable sorting, selection, and/or page-size selection specifically for the Bookings screen, once there's an actual product need for them" and "Adding URL query-parameter synchronization... to the Bookings page." It **extends** `DataTableColumn`, `DataTablePaginationProps`, and `DataTableProps` (§4.2 of that spec) additively, and **relies on** `DataTable`'s existing `sort`/`onSortChange` controlled-state contract (§3 of that spec: "`DataTable` never reorders `rows` client-side under any configuration") and its never-couples-to-GraphQL/routing boundary. [Paginated nestjs-query GraphQL Collections](2026-08-28-paginated-graphql-collections-design.md) (#33) — this spec **relies on**, and does **not** amend, its locked platform invariant: every GraphQL collection is an `OffsetPaging`/`OffsetConnection` (`nodes`, `pageInfo{hasNextPage,hasPreviousPage}`, root `totalCount`); "cursor paging... stays out of scope" is explicitly locked there (§7, §9). This spec's "cursor-shaped pagination" (§4.3 below) is a **frontend/UX abstraction over that existing connection**, not a new backend paging strategy — see §6's central rationale. [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) (#57) — this spec's new `Badge` primitive follows its established `base/` + `npx shadcn@latest add <component>` workflow (`packages/ui/README.md`, "Adding a new primitive") and its "`apps/web` has no shadcn knowledge of its own" rule. [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api-design.md) (#63) — this spec **relies on**, unchanged, `BookingDataTable`'s current `hasError?: boolean` / `errorMessage?: string` contract and `resolveMessage`/`t('error')` default-resolution pattern; nothing here reopens it. |
| Related (not a dependency) | [App Router i18n Architecture](2026-09-13-web-i18n-architecture-design.md) — the `ClensyI18nProvider`/`useClensyTranslations`/per-namespace default-messages catalog mechanism this spec's new `bookings.status.*` keys use, unchanged. |
| Followed by | See §7 — a `CustomerDataTable` or other second `DataTable` consumer adopting sorting/cursor pagination/mobile rendering; migrating the other nine non-Bookings `DataTable` screens onto mobile card rendering; reconciling `StatusBadge` and the new `Badge` into one status-presentation component; a true (non-offset-backed) cursor/keyset pagination architecture, should a future platform RFC amendment ever revisit #33's locked offset-only invariant, are all explicitly deferred. |
| Governing references | This document. It does not redesign #61's `DataTable` composition, #57's primitive-relocation architecture, #63's error-message contract, or #33's platform paging/connection invariant — it extends the first additively, follows the second's established workflow for one new primitive, leaves the third untouched, and builds Bookings-specific UX on top of the fourth without altering its backend contract. |
| M3 decision | **Accepted** — 2026-09-21. Round 1 returned three items with specific required changes (pagination-strategy-neutral terminology and honest `offset` URL naming, §3/§4.6/§6; `createdAt` excluded from `BookingSortKey`, §4.5; status→variant mapping and unknown-status fallback, §4.5), all applied (§8 records the resolutions). Round 2 accepted without further changes. No remaining design blocker at the time. Ready for M4 Implementation Planning. **Post-Accept correction (2026-09-21, raised during M5 Plan Review):** three internal defects surfaced once M4 tried to turn this document into an executable plan — (1) §4.3's cursor-mode `Pagination` type (`DataTableCursorPaginationProps`, `mode: 'cursor'`) contradicted this very document's own "pagination-strategy-neutral, honest naming" principle (§3, §6) by naming its public API `cursor` — renamed to `DataTableNavigationPaginationProps`/`mode: 'navigation'` throughout §3/§4.3/§4.6, no behavioral change; (2) §4.6's `limit` type (`10 | 25 | 50 | 100`) excluded `20`, the platform's own existing default page size (`PLATFORM_PAGE_DEFAULT`), while the same interface's default comment said `// default 20` — an internal contradiction that would not typecheck — corrected to `BookingPageSize = 10 | 20 | 25 | 50 | 100`, default `20`, no `"see §8"` forward reference needed since this resolves it directly; (3) §4.6 stated the default sort but not what a sortable column cycling back to its unsorted (`none`) state resolves to — added, normatively, that it resolves to the canonical default sort (`scheduledAt` `desc`) regardless of which column was cycled, since `DataTable`'s `sort` prop is a single table-wide state, not per-column. No other normative content changed; §8's three round-1 resolutions stand as recorded. |

## 1. Thesis

Issue #65 reads, on its surface, as requiring a new cursor/keyset pagination backend, a richer generic `DataTable`, and several Bookings-specific UX additions. Reading the *current* implementation first (per the issue's own "inspect before implementing" instruction) narrows that considerably: `BookingDTO`'s GraphQL collection (`bookings`) is **already** an `OffsetPaging`-backed `OffsetConnection` (`nodes`, `pageInfo{hasNextPage,hasPreviousPage}`, `totalCount`) per the platform-locked #33 RFC, already accepts a `$sorting: [BookingSort!]` variable the frontend simply never populates, and already restricts sortable/filterable fields to `@FilterableField`-decorated properties (`scheduledAt`, `status`, `createdAt`, plus `id`) — not the unrestricted arbitrary-field surface a naive reading of the issue implies. `@clensy/ui`'s `DataTable` (#61) already has a two-state `sort`/`onSortChange` contract, offset-shaped `Pagination`, and a `Checkbox`/`Table` composition to build from. The real gap is narrower and more precisely scoped than the issue's illustrative examples: (1) `DataTable` needs a third, explicitly-`none` sort affordance with `aria-sort`, not a new cycle; (2) `DataTable`'s pagination contract needs a **cursor-shaped alternative view** — `hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious` in place of raw page numbers — layered over the **same, unmodified** offset/connection backend (§6); (3) the Bookings page needs to own URL state, translate it into GraphQL variables, and reset pagination on sort/limit change, none of which exists today; (4) `DataTable` needs an explicit "keep rows, show a thin indicator" mode distinct from its existing full-replace `loading`, and an optional mobile-card render path; (5) `@clensy/ui` needs a real shadcn `Badge` (none exists — only the differently-shaped `StatusBadge`) for booking status. All five extensions are additive to `DataTable`'s existing prop API; none of #61's eleven other `DataTable` call sites, and none of #63's `errorMessage`/`hasError` contract, changes.

## 2. Scope

**In scope (normative):**

- `packages/ui/src/base/data-table.tsx`: `aria-sort` on sortable column headers, driven by the existing `sort`/`onSortChange` state (no cycle-logic change — `nextSortState`'s `asc → desc → none` cycle already matches the issue's required three states); a new optional `refreshing?: boolean` prop rendering a thin progress indicator below the header while keeping `rows` visible, distinct from the existing full-replace `loading`; a new optional `mobileRow?: (row: T) => ReactNode` prop rendering a breakpoint-gated card list alongside (not instead of) the existing table markup, sharing the same `rows`/`loading`/`error`/`emptyMessage`/`pagination`/`sort` state — §4.3–§4.5.
- `packages/ui/src/base/data-table.tsx`: a new optional `sortKey?: string` field on `DataTableColumn`, defaulting to `column.key` when the column is `sortable` and `sortKey` is omitted — lets a column's backend sort field differ from its display/row key — §4.3.
- `packages/ui/src/base/pagination.tsx`: widening `DataTablePaginationProps` into a discriminated union — the existing page-number shape (`mode?: 'page'`, unchanged) and a new navigation shape (`mode: 'navigation'`; `hasNextPage`, `hasPreviousPage`, `onNext`, `onPrevious`, `pageSize`, optional `totalCount`, `pageSizeOptions`, `onPageSizeChange`) — §4.3.
- A new shadcn-generated `Badge` primitive, `packages/ui/src/base/badge.tsx`, added via the established `npx shadcn@latest add badge` workflow from within `packages/ui` (`packages/ui/README.md`, "Adding a new primitive"), exported from `@clensy/ui`'s `index.ts` — §4.4.
- `packages/web/src/bookings/booking-data-table.tsx`: sortable columns with explicit `sortKey`s restricted to a locally-declared `BookingSortKey` union (`'scheduledAt' | 'status' | 'createdAt'`), a `sort`/`onSortChange` passthrough, a `Badge`-based status cell replacing the current raw-string `status` render, a `mobileRow` card renderer built from the same `Booking` row shape, and passthrough of the (now possibly cursor-shaped) `pagination`/`refreshing` props — §4.5.
- `packages/web/src/i18n/messages/en/bookings.ts`: a new `status` key (`{ pending, confirmed, cancelled, completed }`, exact key style matching the existing `columns.*` convention) — §4.7.
- `apps/web/app/app/bookings/page.tsx`: owning URL state (`sortBy`, `sortOrder`, `limit`, `offset`) via the same manual `URLSearchParams`/`next/navigation` pattern `use-detail-drawer.ts` already establishes (no new routing library); deriving `paging`/`sorting` GraphQL variables from that state with safe fallback for invalid/unsupported values, including a deterministic secondary tie-breaker on every constructed `sorting` value; resetting `offset` to `0` whenever sort key, sort order, or limit changes; computing `refreshing` (rows already present, a new request in flight) instead of the current unconditional `loading` passthrough — §4.6.
- A new `apps/web/lib/use-booking-table-url-state.ts` (or equivalently-scoped module) with pure, independently-testable parse/serialize/validate functions separated from the `next/navigation`-dependent hook itself, following the `nextSortState`/`resolveMessage`/`togglePageSelection` precedent of extracting pure logic for testing without interaction simulation — §4.6, §9.
- Tests per §9, following this repository's existing `vitest` + `renderToStaticMarkup`-or-pure-function convention (no `jsdom`/`@testing-library/react`/interaction simulation, consistent with every existing spec in this tree).

**Informative:** §4.1's exact current-state inventory (verified by reading the resolver, DTO, operation document, `DataTable`, `Pagination`, `BookingDataTable`, and the Bookings page — not assumed from the issue's illustrative examples).

**Out of scope:**

- Any change to `BookingReadResolver`'s or `BookingDTO`'s `pagingStrategy` (`PagingStrategies.OFFSET`, locked by #33), `BookingConnection`'s shape, or any GraphQL schema-breaking change. The `bookings` query's `$sorting`/`$paging` arguments already exist; this spec's backend work is limited to the frontend actually populating `$sorting` and to confirming (by test, not by new code) that the existing `@FilterableField`-driven `BookingSort` enum rejects non-whitelisted fields — §4.2, §6.
- Introducing `PagingStrategies.CURSOR`, a hand-rolled keyset-pagination resolver, or any new nestjs-query paging mechanism. §6 states why, and records the alternative as a followed-by item requiring its own #33 amendment, not silently adopted here.
- A `Select` shadcn primitive for the row-limit control — `Pagination`'s existing plain `<select>` (already used for `pageSizeOptions`, #61 §5's "no shadcn `Select`, matches this repo's native-`<select>` convention") is extended, not replaced.
- Retrofitting `refreshing`, `mobileRow`, cursor-mode `pagination`, or `sortKey` onto any of the other eleven `DataTable` call sites (`admin`, `billing`, `catalog`, `catalog/add-ons`, `cleaners`, `cleaners/teams` ×2, `customers` ×2, `jobs`, `laundry`). Every new prop is optional and additive; those screens need zero code changes and render identically (§4.1, §5).
- Row selection, bulk actions, column resizing/reordering/visibility, or client-side filtering — explicit issue constraints, and #61 already delivered/declined the adjacent selection capability.
- Migrating `StatusBadge` or its seven existing consumers (`jobs`, `billing`, `admin`, `catalog`, `catalog/add-ons`, `laundry`) onto the new `Badge`. `StatusBadge` is untouched; the two coexist deliberately this slice (§6).
- Search/filter UI for Bookings (still none today, per #61 §4.6) — "cursor resets when filters change" has no applicable filters to reset from in this slice.
- Any `CustomerDataTable` or second `DataTable` domain consumer.
- `jsdom`/`@testing-library/react` or any interaction-simulation test framework — none exists in this repository today.

## 3. Terminology

- **Pagination-strategy-neutral `DataTable` contract:** `DataTable`'s cursor-mode `Pagination` API (`hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious`) does not name or imply *how* the host determines those booleans — offset, true cursor tokens, or anything else. `DataTable` itself never learns which one Bookings uses. This is deliberately weaker than "cursor pagination": it is the abstraction the issue's own escape-hatch clause licenses reusing (§6), named precisely to avoid overclaiming cursor semantics the backend does not have. (Terminology tightened per M3 round 1 — see §6, §8.)
- **Pagination position:** the Bookings page's internal notion of "which page of results is currently requested," represented as a validated non-negative integer **offset** — named and stored as `offset`, never as `cursor`, anywhere this value is serialized (URL query param, internal variable, or test) — because it is a literal offset, not an opaque token. It is never exposed to `BookingDataTable`/`DataTable` as a raw page number; only the `hasNextPage`/`hasPreviousPage` booleans and the `onNext`/`onPrevious` callbacks cross that boundary.
- **Sort key vs. column key:** `DataTableColumn.key` identifies a column for rendering/keying (unchanged meaning). `DataTableColumn.sortKey` identifies the **backend** field a sortable column's clicks report through `onSortChange`'s `DataTableSortState.key`. They coincide for every sortable Booking column in this spec's inventory (§4.5) but are declared as distinct fields so a future column (e.g., a computed/derived display column) can diverge without `DataTable` needing to know why.
- **Refreshing vs. loading:** `loading` (existing, unchanged) means "no rows to show yet — replace the table body with `LoadingState`." `refreshing` (new) means "rows are already present and remain the ones to show — render them normally, plus a thin in-progress indicator." A consumer sets at most one of the two true at a time; `DataTable` does not infer either from `rows.length` itself (§4.3), matching the existing pattern of `BookingDataTable`'s host-supplied `hasError` (#63 §6) rather than component-inferred occurrence.
- **Whitelisted sort key:** a `BookingSortKey` union member (`'scheduledAt' | 'status'`), declared locally in `@clensy/web` (never imported from `@clensy/client`). This is a **strict subset** of what `BookingDTO` marks `@FilterableField` (which also includes `createdAt` and `id`) — narrowed further, per M3 round 1, to exactly the fields `BookingDataTable` has a visible column for (§4.5, §8.2). Declared the same way `BookingStatus`'s four literals already are in `booking-data-table.tsx` (#61 §4.4) — structural, not generated.

## 4. Architecture & behavioral contracts

### 4.1 Current state (verified by reading each file, not assumed from the issue)

| Concern | Current state | File |
| --- | --- | --- |
| Booking GraphQL paging | `PagingStrategies.OFFSET`, `defaultResultSize: 20`, `maxResultsSize: 100` (platform constants), `defaultSort: scheduledAt DESC, id ASC` | `apps/api/.../booking-read.resolver.ts:26-39`, `booking.dto.ts:43-51` |
| Booking GraphQL sortable/filterable fields | `@FilterableField` on `scheduledAt`, `status`, `createdAt` only (plus `id` via `@IDField`); relations (`customer`/`property`/`service`/`team`) are `@FilterableRelation`, not independently sortable | `booking.dto.ts:69-84` |
| `Bookings` operation document | Already declares `$sorting: [BookingSort!]`; the Bookings page never passes it | `packages/client/src/operations/bookings.graphql:1` |
| Bookings page pagination state | Local `useState<number>` page number, `pageSize` fixed at `20`, `page`/`pageSize` never in the URL; only `?detail=<id>` is URL-synchronized | `apps/web/app/app/bookings/page.tsx:69-73` (page state), `use-detail-drawer.ts` |
| `DataTable` sort | `sort?: DataTableSortState \| null`, `onSortChange`, `nextSortState` already cycles `none → asc → desc → none`; header shows a static `ChevronsUpDownIcon` when unsorted and a directional arrow when sorted; no `aria-sort` anywhere | `packages/ui/src/base/data-table.tsx:18-21,52-59,176-192` |
| `DataTable` pagination | `DataTablePaginationProps` is page-number-shaped only (`page`, `pageSize`, `totalCount`, `onPageChange`); `Pagination` renders "Page X of Y" | `packages/ui/src/base/pagination.tsx` |
| `DataTable` loading | `loading: true` fully replaces `<TableBody>` with `<LoadingState/>`; no intermediate "rows visible + in-progress" state | `packages/ui/src/base/data-table.tsx:200-206` |
| Booking status display | `BookingDataTable` renders the raw `status` string via `render: 'status'` — no Badge, no translation | `packages/web/src/bookings/booking-data-table.tsx:60` |
| `@clensy/ui` Badge | Does not exist. `StatusBadge` exists (`base/status-badge.tsx`) — a plain `<span>`, four hardcoded Tailwind tone classes, **not** shadcn-based, no variant vocabulary matching `ui.shadcn.com`'s Badge; consumed today by seven other screens (`jobs`, `billing`, `admin`, `catalog`, `catalog/add-ons`, `laundry`) — §4.4, §6 | `packages/ui/src/base/status-badge.tsx`, grep across `apps/web/app/app/**` |
| URL/search-param precedent | `use-detail-drawer.ts`'s manual `useSearchParams`/`usePathname`/`useRouter` + `URLSearchParams` pattern, reused verbatim in `customers/page.tsx`, `cleaners/page.tsx`, `catalog/page.tsx`. No `nuqs` or equivalent library present | `apps/web/lib/use-detail-drawer.ts` |
| Frontend test convention | `vitest` + `renderToStaticMarkup`; pure exported functions (`nextSortState`, `togglePageSelection`, `toggleSelectionKey`, `resolvePath`, `resolveMessage`) unit-tested directly without rendering or interaction simulation | `packages/ui/src/base/data-table.test.tsx`, `packages/web/src/i18n/resolve-message.ts` |

### 4.2 GraphQL contract: what actually changes (minimal, by design)

Because §4.1's inventory shows the connection, paging strategy, and field-level filterable/sortable whitelist already exist, this spec's GraphQL-layer changes are:

1. **No schema change.** `bookings(paging: OffsetPaging, filter: BookingFilter, sorting: [BookingSort!]): BookingConnection!` is unchanged. `packages/client/src/operations/bookings.graphql`'s `Bookings` operation already declares `$sorting`; no `.graphql` file edit is required for that variable to start being populated.
2. **Confirm, by test, that the sort whitelist is real** — not merely believed to be, since nestjs-query's exact behavior here is the one thing this spec asserts without having executed it. M4/M6 MUST add (or locate, if one already exists) an `apps/api` test asserting that a `sorting` value referencing a non-`@FilterableField` field (e.g., a relation field, or an entirely invented field name) is a GraphQL validation error, not a silently-ignored or silently-executed sort. If that assertion fails — i.e., nestjs-query's generated `BookingSort` is broader than `@FilterableField` implies — this is a spec-return, not a license to ship an unvalidated `ORDER BY` surface; a hand-authored whitelist/validation layer would then need its own design, which this spec does not provide.
3. **`sortKey`/`BookingSortKey` restricted to `'scheduledAt' | 'status'`** (§4.5) — a strict subset of what's already server-side sortable (`scheduledAt`, `status`, `createdAt`), further narrowed per M3 round 1 to exactly the fields with a visible `BookingDataTable` column (§4.5, §8.2) — not because anything wider is unsafe (item 2 already covers safety). `createdAt` stays `@FilterableField` on `BookingDTO` (untouched) but is not selectable through this table. Widening the whitelist later to include, e.g., a joined `customer.fullName` sort is out of scope (no current `@FilterableField`/sortable path for a relation's own scalar field) and not required by the issue.
4. Oversized/invalid `limit` is already clamped/bounded by `PLATFORM_PAGE_MAX` (100) and `defaultResultSize` (20) at the platform level (#33 §4.1) — the issue's "backend should validate the allowed maximum rather than trusting the client" is already satisfied; no new server-side validation is added by this spec.

### 4.3 `@clensy/ui`: `DataTable`/`Pagination` API extensions

```ts
// data-table.tsx
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: string | ((row: T) => ReactNode);
  sortable?: boolean;
  sortKey?: string;              // new — backend field name; defaults to `key`
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  // ...all existing fields, unchanged...
  refreshing?: boolean;          // new
  mobileRow?: (row: T) => ReactNode; // new
}
```

- **`aria-sort`.** Each sortable `<TableHead>` gets `aria-sort="ascending" | "descending" | "none"`, derived from `sort?.key === (column.sortKey ?? column.key)` exactly the way the existing icon branch already keys off `sort?.key === column.key` (`data-table.tsx:183`) — the fix is comparing against `column.sortKey ?? column.key` instead of always `column.key`, and adding the attribute; the icon branch's three states (neutral `ChevronsUpDownIcon`, `ArrowUpIcon`, `ArrowDownIcon`) already satisfy "appropriate sort icons for all three states" and need no new icon. `handleSortClick`/`onSortChange` likewise report `column.sortKey ?? column.key`, not always `column.key`. No change to `nextSortState`'s cycle logic — `none → asc → desc → none` already matches the issue's required three-state cycle exactly.
- **Keyboard accessibility.** Already satisfied: sortable headers render a native `<button type="button">` (`data-table.tsx:177`), reachable and activatable by Tab/Enter/Space with no additional wiring.
- **`refreshing`.** When `true`, `DataTable` renders a thin `role="progressbar"` (or `aria-busy` region — exact element left to M4) directly beneath `<TableHeader>`, and renders `rows` in `<TableBody>` normally — **not** the `loading`/error/empty branches — regardless of `loading`'s value. `refreshing` and `loading` are never both meaningfully `true` in a correct caller (loading implies no rows to keep visible); `DataTable` does not validate this — the consumer (§4.6) is responsible for setting at most one.
- **`mobileRow`.** When supplied, `DataTable` renders two sibling trees sharing every other prop unchanged: the existing `<Table>` wrapped in a desktop-only breakpoint class, and a new `sm:hidden`-equivalent list of `mobileRow(row)` results for the same `rows` (same loading/error/empty/pagination handling, not a second data path). Omitted `mobileRow` leaves rendering exactly as today (single table, no breakpoint wrapper) — the default, and the only behavior for every non-Booking consumer.

```ts
// pagination.tsx
export interface DataTableOffsetPaginationProps {
  mode?: 'page';                 // default; existing shape, unchanged
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export interface DataTableNavigationPaginationProps {
  mode: 'navigation';             // new — not "cursor": see identity table's Post-Accept correction
  pageSize: number;
  totalCount?: number;           // present when the connection's root totalCount was selected
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export type DataTablePaginationProps =
  | DataTableOffsetPaginationProps
  | DataTableNavigationPaginationProps;
```

`Pagination` branches on `props.mode === 'navigation'`: Previous/Next buttons are disabled from `hasPreviousPage`/`hasNextPage` (not `page <= 1`/`page >= pageCount`) and call `onPrevious`/`onNext` (not `onPageChange(page ± 1)`); the "Page X of Y" text is replaced with a `totalCount`-aware "Showing up to {pageSize} of {totalCount}" when `totalCount` is present, or omitted when it is not. The existing `mode: 'page'` (or omitted) branch is **byte-for-byte today's behavior** — every existing call site that never sets `mode` continues to render identically, satisfying #61's zero-code-change guarantee for its eleven non-Booking consumers (§4.1, §5). **Naming (Post-Accept correction):** `'navigation'`, not `'cursor'` — §3/§6's "pagination-strategy-neutral" principle applies to the public API surface itself, not only the URL parameter; a type or prop named `cursor` would claim a pagination strategy this component deliberately does not have.

### 4.4 `@clensy/ui`: new `Badge` primitive

Added via `npx shadcn@latest add badge` from `packages/ui` (the workflow `packages/ui/README.md` already documents), landing at `packages/ui/src/base/badge.tsx` using shadcn's standard `cva`-based variant vocabulary (`default | secondary | destructive | outline`, matching `Button`'s existing pattern in the same directory — `base/button.tsx:5-30`), exported from `@clensy/ui`'s `index.ts` alongside the other `base/` exports. `Badge` takes no Clensy-specific props — a generic, content-agnostic primitive, per #57's rule that `base/` primitives carry no domain knowledge.

`StatusBadge` (`base/status-badge.tsx`) is untouched: its four-tone API and seven existing consumers keep working exactly as today. `Badge` and `StatusBadge` coexist as two status-presentation options this slice — see §6 for why this is deliberate, not an oversight.

### 4.5 `BookingDataTable` (`packages/web/src/bookings/booking-data-table.tsx`)

```ts
export type BookingSortKey = 'scheduledAt' | 'status'; // whitelist (§4.2, §4.5, §8.2)

export interface BookingDataTableProps {
  bookings: Booking[];
  formatPrice: (minorUnits: number) => string;
  loading?: boolean;
  refreshing?: boolean;                       // new — passthrough to DataTable
  hasError?: boolean;                         // unchanged (#63)
  errorMessage?: string;                      // unchanged (#63)
  onRowClick?: (booking: Booking) => void;
  pagination: DataTablePaginationProps;        // now possibly cursor-shaped (§4.3)
  sort?: { key: BookingSortKey; direction: 'asc' | 'desc' } | null; // new
  onSortChange?: (sort: { key: BookingSortKey; direction: 'asc' | 'desc' } | null) => void; // new
}
```

- Columns gain `sortable: true, sortKey: 'scheduledAt'` (Scheduled) and `sortable: true, sortKey: 'status'` (Status) only. `BookingSortKey = 'scheduledAt' | 'status'` (**`createdAt` excluded** — decided at M3 round 1, §8.2). **Normative rule (per M3 round 1):** `BookingDataTable`'s sortable-column set MUST be limited to fields represented by a visible table column — a user must never be offered a sort control for a value the table doesn't display. `BookingDTO`'s broader server-side `@FilterableField` whitelist (which does include `createdAt`) stays exactly as-is; this rule constrains which of those fields *this table* exposes, not what the GraphQL DTO supports. Every other column (`customer`, `property`, `service`, `team`, `price`) stays `sortable: false` (or omits `sortable` entirely, matching the existing pattern for non-sortable columns; both render identically since `sortable` defaults to falsy), consistent with the issue's own "non-sortable columns must explicitly be able to opt out" example — an explicit `sortable: false` is used for clarity even though `undefined` is behaviorally equivalent.
- Status column: `render: (row) => <Badge variant={bookingStatusBadgeVariant(row.status)}>{t(\`status.${row.status.toLowerCase()}\`)}</Badge>`, where `bookingStatusBadgeVariant` is a locally-declared, centralized lookup (`Record<BookingStatus, BadgeVariant>` plus an explicit fallback — see below) — never a raw pass-through of `row.status`, and never inlined into the column's JSX (per M3 round 1: "centralized rather than allowing the table JSX to decide variants inline"). The status→translation-key path (`t('status.…')`) and the status→variant path (`bookingStatusBadgeVariant`) are two independent lookups off the same `row.status` — translated label text is never used to derive the Badge's variant, and vice versa. Confirmed mapping (M3 round 1): `PENDING → outline`, `CONFIRMED → default`, `COMPLETED → secondary`, `CANCELLED → destructive`.
- **Unknown-status fallback (normative, per M3 round 1):** `row.status` originates from a GraphQL response — an external-system boundary, not a value this component controls — so `bookingStatusBadgeVariant` and the translation lookup MUST both degrade safely for a status value outside the four known `BookingStatus` members (e.g., the backend ships a fifth status before the frontend is updated) rather than rendering `undefined`/crashing: an unrecognized status falls back to `variant: 'outline'` and displays the raw status string in place of a translated label. `BookingStatus` stays a closed four-member TS union (§4.1); this fallback exists for the runtime/API-boundary case that union cannot statically prevent.
- `mobileRow`: a card composed from the **same** `Booking` row object and the **same** `formatScheduledAt`/`formatPrice`/status-badge logic the desktop columns already use (no second data mapping) — reference/customer/date/status per the issue's minimum list, plus property and price as "important secondary information." Exact markup is an M4/M6 detail; the normative requirement is reuse of the same row-level value derivations, not a parallel implementation.
- `sort`/`onSortChange`/`refreshing`/cursor-shaped `pagination` are pure passthrough to the underlying `@clensy/ui` `DataTable` — `BookingDataTable` performs no GraphQL, routing, or offset/cursor translation itself (that stays in `apps/web`, per #61's and #57's boundary rules; `BookingDataTable` still imports nothing from `@clensy/client`/`@apollo/client`/`next-intl`).

### 4.6 Bookings page (`apps/web/app/app/bookings/page.tsx`)

Owns, in this order: URL state → validated table state → GraphQL variables → `BookingDataTable` props.

```ts
// apps/web/lib/use-booking-table-url-state.ts (new; exact filename/module boundary is M4's call)

// Post-Accept correction: includes 20 — the platform's own existing
// default page size (PLATFORM_PAGE_DEFAULT) — alongside the issue's
// suggested selector values, so the table's initial/default limit is
// itself always a selectable option (never a value the row-limit
// selector can't represent).
export type BookingPageSize = 10 | 20 | 25 | 50 | 100;

export interface BookingTableUrlState {
  sortBy: BookingSortKey;   // default 'scheduledAt' — matches today's existing default sort
  sortOrder: 'asc' | 'desc'; // default 'desc' — matches today's existing default sort
  limit: BookingPageSize;    // default 20 — see identity table's Post-Accept correction
  offset: number;            // default 0 — the "pagination position" (§3), never negative
}

// Pure, independently unit-testable (no next/navigation, no rendering):
export function parseBookingTableUrlState(searchParams: URLSearchParams): BookingTableUrlState;
export function serializeBookingTableUrlState(state: BookingTableUrlState): URLSearchParams;
```

- `parseBookingTableUrlState` MUST fall back to the stated defaults for any missing, malformed, or out-of-whitelist value (`sortBy` not in `BookingSortKey`, `sortOrder` not `'asc'|'desc'`, `limit` not one of the supported values, `offset` not a non-negative integer) — **never** forwarding an unvalidated raw value into GraphQL variables, per the issue's explicit acceptance criterion. This validation is the one place `BookingSortKey`'s whitelist is enforced client-side, independent of and in addition to the server-side enforcement in §4.2.
- **URL parameter naming (normative, per M3 round 1):** the query parameter carrying this state MUST be named `offset` (e.g. `?sortBy=scheduledAt&sortOrder=desc&limit=25&offset=25`), never `cursor` — the value is a literal, honestly-named offset, not an opaque cursor token, and naming it `cursor` would misrepresent the pagination strategy to anyone reading a shared URL or this codebase (§3, §6).
- The hook itself (`next/navigation`-dependent, not independently unit-testable per this repo's existing constraints — §4.1) wraps these pure functions with `useSearchParams`/`usePathname`/`useRouter`, following `use-detail-drawer.ts`'s `router.replace` (not `router.push`) convention for state changes that shouldn't grow browser history on every sort/limit click.
- **Reset rule:** changing `sortBy`, `sortOrder`, or `limit` always writes `offset: 0` in the same URL update — implemented as one `serializeBookingTableUrlState` call per state-changing action, not as a separate "then also reset" step, so the URL is never transiently inconsistent.
- **GraphQL variables and sort stability (normative, per M3 round 1):** `paging: { limit: state.limit, offset: state.offset }`; `sorting` MUST always be a two-element array — the user-selected primary key (`mapSortKeyToGraphQLField(state.sortBy)` at `state.sortOrder`) followed by the same deterministic secondary tie-breaker the backend's own `defaultSort` already uses (`id ASC` — `booking-read.resolver.ts:29-32`, `booking.dto.ts:45-48`), e.g. `[{ field: state.sortBy, direction }, { field: 'id', direction: SortDirection.ASC }]`. Without this, sorting by a non-unique field (`status`, where many bookings share a value) would leave row order among ties undefined by the database, which — combined with offset paging — can duplicate or skip rows across pages. This extends #33's "deterministic default sort with a unique tie-breaker" invariant to every **user-selected** sort this table can produce, not only the resolver's own default. (`mapSortKeyToGraphQLField` is a `BookingSortKey → BookingSortFields` enum mapping the generated `@clensy/client` types require — an M4 mechanism detail, not a new whitelist, since `BookingSortKey`'s members are already the whitelist.)
- **Default sort unchanged:** with no URL params present, `parseBookingTableUrlState` resolves `sortBy: 'scheduledAt', sortOrder: 'desc'` — matching `BookingReadResolver`'s existing `defaultSort` (`scheduledAt DESC, id ASC`) exactly, so a Bookings page visited with no query string behaves identically to today. This spec does not change the default sort to `createdAt`; `createdAt` is not a selectable `BookingSortKey` at all (§4.5, §8.2).
- **Sort cycling back to "none" (normative, Post-Accept correction):** `DataTable`'s `sort` prop is a single, table-wide state (§4.3 of #61's spec — not a per-column state), so exactly one column can be the active sort key at a time. When a sortable column's three-state cycle reaches its unsorted state (`onSortChange(null)`), the Bookings page resolves that back to the same canonical default this table always falls back to with no URL state at all — `sortBy: 'scheduledAt', sortOrder: 'desc'` — regardless of which column (`scheduledAt` or `status`) was actually clicked to reach `null`. This is consistent, not column-specific: "no active sort" and "the table's default sort" are the same state, matching the pre-#65 behavior where Bookings had no sort UI and always rendered in `scheduledAt DESC` order. A consumer inspecting only the clicked column's own `aria-sort` still observes the correct `none → ascending → descending → none` cycle on that column; the table-wide resolution to a concrete sort key is an internal consequence of `sort` being single-valued, not a violation of that per-column cycle.
- **Pagination-strategy-neutral `pagination` prop derivation:** `onNext` advances `offset` by `limit` and writes it to the URL (clamped so it never exceeds what `totalCount`/`hasNextPage` allows); `onPrevious` decreases `offset` by `limit`, floored at `0`; `hasNextPage`/`hasPreviousPage` come directly from `data.bookings.pageInfo`; `totalCount` from `data.bookings.totalCount`. No page number, and no value named or shaped like a cursor, is ever rendered or exposed to `BookingDataTable`/`DataTable` — only the boundary booleans and the two callbacks (§3, §6).
- **`refreshing` derivation:** `refreshing = loading && rows.length > 0` is the simplest correct expression **only if** the query's `data` is not cleared while a new request is in flight — Apollo's default `fetchPolicy: 'network-only'` behavior here (whether it clears `data` before resolving, and whether `previousData`/`keepPreviousData` is needed to keep `rows` populated through the request) is an M4 investigation, not decided by this spec; the **normative requirement** is that the row list a user is currently looking at does not disappear or flash empty while a sort/limit/pagination request is pending (§9's manual golden path is the acceptance bar). `loading` is passed to `BookingDataTable`/`DataTable` only for the genuine first-load-with-no-data case.

### 4.7 i18n

```ts
// packages/web/src/i18n/messages/en/bookings.ts
export const bookings = {
  columns: { /* unchanged */ },
  empty: 'No bookings.',
  error: 'Unable to load bookings.',
  status: {                    // new
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
  },
  unassigned: 'Unassigned',
};
```

Booking status labels are resolved through `BookingDataTable`'s existing `useClensyTranslations('bookings')` call (`t(\`status.${row.status.toLowerCase()}\`)`) — the same mechanism already used for column headers — never a hardcoded string in `BookingDataTable` (explicit issue requirement).

## 5. Rationale

**Why extend `DataTable`/`Pagination` in place rather than a second, Booking-specific table component?** Identical reasoning to #61 §5: eleven other screens already depend on today's config-driven API; every new prop here (`sortKey`, `refreshing`, `mobileRow`, cursor-mode `pagination`) is optional and defaults to today's exact behavior, so none of those eleven needs a code change (§2, §4.1).

**Why is `aria-sort` "the fix" instead of a new three-state cycle?** Reading `nextSortState` (`data-table.tsx:52-59`) shows the cycle is already `none → asc → desc → none` — three states, matching the issue's requirement exactly. The actual gap, verified by reading the render code, is that the sort-state comparison and the new `aria-sort` attribute both need to key off `column.sortKey ?? column.key` rather than always `column.key` — relevant once `sortKey` exists, not a pre-existing bug for today's zero sortable-column consumers.

**Why does `Badge` coexist with `StatusBadge` instead of replacing or wrapping it?** `StatusBadge`'s tone-based API (`neutral`/`success`/`warning`/`danger`) and `Badge`'s shadcn variant vocabulary (`default`/`secondary`/`destructive`/`outline`) are different shapes with no lossless mapping in either direction (`StatusBadge` has no `default`/`secondary`/`outline` equivalent; `Badge` has no `warning`). The issue asks specifically for "the shadcn Badge component... via `@clensy/ui`" for *Booking* status — not for a `StatusBadge` migration across its seven unrelated existing consumers, which would be a strictly larger, differently-scoped change the issue does not request and this spec's non-goals explicitly exclude. Reconciling the two into one component is recorded as a followed-by item (§7), the same way #57 recorded (and deferred) its own overlapping-component questions (`Modal`/`Dialog`, `DetailDrawer`/`Sheet`).

**Why a `mobileRow` render prop on the generic `DataTable` instead of a Bookings-only mobile component?** The issue requires the generic/reusable architecture (requirement 10) to include "responsive rendering support" as a capability, and requires desktop/mobile to "consume the same underlying column/data definitions... rather than maintaining two unrelated data mappings." Making `mobileRow` a `DataTable`-level prop, fed the same `rows` and `formatScheduledAt`/`formatPrice`/status-badge helpers `BookingDataTable`'s desktop columns already use, satisfies both: the capability lives generically in `@clensy/ui`, and Bookings' specific card content still comes from one row-level data derivation, not two.

**Why `refreshing` as a new, separate prop instead of overloading `loading`?** `loading: true` today unconditionally destroys `rows` from view (`data-table.tsx:200-206`) — correct for "nothing has loaded yet," wrong for "a sort/page change is in flight and stale rows are still valid to show." Two booleans with disjoint rendering branches, mirroring `hasError`/`errorMessage`'s existing separation-of-occurrence-from-content pattern (#63 §6), is simpler and more explicit than teaching `DataTable` to infer intent from `rows.length`, which would silently change behavior for any future `loading: true, rows: []-then-populated` timing this spec hasn't audited.

## 6. Rationale: a pagination-strategy-neutral `DataTable` contract over the existing offset backend (the central decision)

**Governing principle, locked at M3 round 1:** issue #65 must not be read as reinterpreting the existing offset-paginated implementation as true cursor pagination, and this spec does not do so. It provides a pagination-strategy-agnostic `DataTable` interface (`hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious`, no page-number UI) while retaining the platform's existing `OffsetConnection` implementation unchanged. #65 is a `DataTable`/Bookings UX enhancement, not a pagination-architecture change — that boundary is the acceptance bar for this section, not "does it look like cursor pagination."

Issue #65 states "Use cursor-based pagination rather than offset/page-number pagination" and "Do not introduce offset-based pagination" as explicit, repeated constraints. #33 (Accepted, platform-locked) states, with equal explicitness: "The approved contract is `limit`/`offset`... Cursor remains available in the library and stays out of scope," locked as a **platform invariant** applying to every GraphQL collection including Booking's, and states plainly that reopening it requires a reviewable amendment (the same mechanism #33 itself used against #29), not a silent per-ticket reinterpretation. Per this workflow's own invariants (`agent-workflow-design.md` §2.3: "Later stages MUST NOT redesign earlier Accepted artifacts"), this spec cannot introduce `PagingStrategies.CURSOR` or hand-rolled keyset pagination for Booking without that amendment — doing so inside a #65-scoped M2 would be exactly the silent redesign the workflow forbids.

The issue's own text, however, supplies the resolution: requirement 4's cursor-pagination contract is stated as "`limit`/`after`/`before` — **or the repository's established GraphQL connection/page-info convention if one already exists**." One does: #33's `OffsetConnection` (`nodes`, `pageInfo{hasNextPage,hasPreviousPage}`, root `totalCount`) is exactly "the repository's established GraphQL connection/page-info convention," already shipped for `bookings`. This spec reads that clause as license to satisfy #65's pagination requirements by building a cursor-**shaped** contract — `DataTable`'s `hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious`, an opaque `offset`-derived "pagination position" that never surfaces as a raw page number in any component prop or rendered UI, and URL state that reflects that position reproducibly (§4.3, §4.6) — entirely on top of the existing, unmodified `OffsetConnection`, rather than introducing a second, competing paging architecture for one entity. This satisfies every one of #65's *observable* acceptance criteria (no page-number UI, next/previous navigation, `pageInfo`-driven boundary knowledge, URL-reproducible state, reset-on-sort/limit-change) without amending #33, without touching `BookingReadResolver`'s locked `pagingStrategy`, and without leaving Booking as the platform's only cursor-paginated collection (a repo-convention fragmentation #33's own rationale specifically argues against for the paging model, and which this spec avoids for the same reason).

**The alternative this spec deliberately does not take:** a literal keyset/cursor resolver for Booking only, satisfying #65's *wire-level* wording exactly but requiring: (a) a `PagingStrategies.CURSOR` (or hand-rolled) implementation, (b) an explicit amendment to #33 narrowly carving out Booking as a locked exception to its own "why offset, not cursor" rationale, and (c) its own M2/M3 cycle for that amendment, since #33's own conventions (`prompt-library.md` §5) forbid a downstream spec silently redesigning an Accepted upstream one. That path is recorded as a followed-by item (§7), not adopted, because it is materially larger and cross-cutting relative to what #65 needs to actually ship, and because the issue's own wording already provides a narrower, compliant path.

**This is the one decision in this document most likely to warrant explicit reviewer confirmation rather than default M3 sign-off** — see §8.

## 7. Followed-by: what this slice deliberately leaves for later

- A `CustomerDataTable` or other second domain table adopting sorting/cursor pagination/mobile rendering, following `BookingDataTable`'s pattern (#61 §6, still open).
- Retrofitting `mobileRow` onto the other nine non-Booking `DataTable`-consuming screens (§2).
- Reconciling `StatusBadge` and the new `Badge` into one status-presentation component/migrating `StatusBadge`'s seven existing consumers (§5, §6).
- A true (non-offset-backed) cursor/keyset pagination architecture, should product need ever outgrow offset semantics (deep-page cost, concurrent-insert page drift) badly enough to justify amending #33 (§6).
- Exposing a `createdAt` sort/column pairing for Bookings, if `createdAt` visibility is ever wanted distinct from `scheduledAt` (§4.5, §8).

## 8. Decisions recorded at M3 round 1 (Design Review)

The following three items were flagged in this document's initial draft as open; they were resolved in an M3 round-1 review pass (design-review.md's "Returned for Revision" pattern — specific required changes, not a silent self-Accept) and are recorded here for traceability. §4 above already reflects each resolution normatively; nothing below is a new requirement.

1. **Pagination-strategy-neutral `DataTable` contract, not a cursor reinterpretation (§6).** Resolved: keep the existing `OffsetConnection` backend untouched; `DataTable`'s pagination API exposes only `hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious` with no page-number UI; the URL parameter carrying pagination position is named `offset`, never `cursor`, so it never misrepresents the underlying strategy (§3, §4.6, §6). No #33 amendment.
2. **`createdAt` excluded from `BookingSortKey` (§4.5).** Resolved: `BookingDataTable`'s sortable-column set is limited to fields with a visible column — `scheduledAt` and `status` only. `BookingDTO`'s server-side `@FilterableField` whitelist (which also includes `createdAt`) is unchanged; this is a narrower, table-level exposure decision, not a backend capability change. The Bookings default sort stays `scheduledAt DESC` (matching the existing, unchanged `BookingReadResolver` default) — `createdAt` was considered and rejected as a new default, since it isn't a field this table exposes at all (§4.6).
3. **`Booking` status → `Badge` variant mapping confirmed (§4.5).** `PENDING → outline`, `CONFIRMED → default`, `COMPLETED → secondary`, `CANCELLED → destructive` — confirmed as specified, centralized in a single lookup (not inlined per-column JSX), with an explicit fallback for a status value outside the four known members (§4.5).

Two additional normative requirements surfaced during this review pass and are folded into §4.5/§4.6 above, not listed as separate open decisions: (a) every `sorting` GraphQL variable this table constructs — not only the backend's own default — MUST include a deterministic secondary tie-breaker (`id ASC`), since sorting by `status` alone (a non-unique field) combined with offset paging can otherwise duplicate or skip rows across pages (§4.6); (b) the status→variant and status→translation lookups MUST degrade safely (fallback `outline` variant, raw status string) for a status value outside the closed `BookingStatus` union, since the value crosses a GraphQL API boundary this component does not control (§4.5).

## 9. Testing and acceptance

Consistent with this repository's existing precedent (`vitest` + `renderToStaticMarkup`, pure-function extraction for anything otherwise only reachable via interaction, no `jsdom`/`@testing-library/react` anywhere):

**`packages/ui` (new/extended coverage in `data-table.test.tsx`, `pagination.test.tsx`):**
- Sortable header's `aria-sort` renders `"none"`/`"ascending"`/`"descending"` correctly for each `sort` prop value, keyed off `sortKey` when present.
- `handleSortClick`/`onSortChange` report `column.sortKey ?? column.key`, verified with a column whose `sortKey` differs from its `key`.
- `refreshing: true` renders `rows` unchanged (not the `loading` branch) plus the progress indicator; `loading: true` still fully replaces the body as today.
- `mobileRow` renders its own markup from the same `rows`, independent of whether `loading`/`error`/empty branches are active.
- `Pagination`'s cursor-mode branch: `Previous`/`Next` disabled state driven by `hasPreviousPage`/`hasNextPage` (not page-number math); `onNext`/`onPrevious` called on click; the offset-mode branch's existing tests remain unchanged and passing (regression proof of §4.3's backward-compatibility claim).

**`packages/web` (extended `booking-data-table.test.tsx`):**
- Each `BookingStatus` value renders the corresponding `Badge` variant and translated label (via `ClensyI18nProvider` override, following the existing partial-override test pattern at `booking-data-table.test.tsx:63-74`) — not the raw enum string.
- Sortable columns (`scheduledAt`, `status`) pass `sortable`/`sortKey` through to the rendered header attributes; non-sortable columns do not.
- `mobileRow` output contains the required minimum fields (reference/customer/date/status) for a sample booking.
- `refreshing`/cursor-shaped `pagination` props pass through to the underlying `DataTable` unchanged (mirroring the existing "pagination passes through" test at line 43).

**`apps/web/lib/use-booking-table-url-state` (new, pure-function tests, no rendering/no `next/navigation`):**
- `parseBookingTableUrlState`: default state from empty `URLSearchParams`; each valid `sortBy`/`sortOrder`/`limit`/`offset` round-trips; each invalid/out-of-whitelist value (bad `sortBy`, bad `sortOrder`, unsupported `limit`, negative/non-numeric `offset`) falls back to its default rather than propagating.
- `serializeBookingTableUrlState`: round-trips through `parseBookingTableUrlState` for every valid state; omitted/default-valued fields' exact URL representation (present vs. omitted) is pinned by a test, resolving the issue's own "if default values are omitted... behavior must remain deterministic" requirement with an executable check.
- Reset-on-change: changing `sortBy`, `sortOrder`, or `limit` in the state passed to a "next state" helper always yields `offset: 0` — tested as a pure transformation, not via simulated clicks.

**Grep-verifiable acceptance gates:**
- No hardcoded booking status string reaches rendered output outside the `t('status.*')` lookup (i.e., no `{row.status}` interpolation remains in `booking-data-table.tsx`).
- `StatusBadge`'s seven existing call sites are unchanged (no accidental `Badge` substitution).
- No `apps/web` file imports `@clensy/ui`'s `Badge` other than `packages/web/src/bookings/booking-data-table.tsx` importing it via `@clensy/ui` (boundary unchanged — `apps/web` still has no shadcn-specific knowledge).

**Build gates:** `pnpm --filter @clensy/ui build`/`lint`/`test`, `pnpm --filter @clensy/web build`/`lint`/`test`, `pnpm --filter web build`/`lint`/`test`, and the relevant `apps/api` GraphQL test suite (§4.2 item 2) all succeed.

**Manual golden path:** Bookings screen — sort by Scheduled/Status (three-state cycle, correct rows, correct URL); change row limit (URL updates, cursor resets to the first page, correct rows); Next/Previous navigation (correct rows, boundary buttons disabled correctly at both ends, URL reproducible on refresh and via browser back/forward); a background sort/limit/page change keeps existing rows visible with a thin indicator, not a full-table flash; booking status renders as a translated, semantically-appropriate `Badge`; narrow-viewport (mobile) rendering shows the card list, not a horizontally-scrolled table, with sorting/limit controls still usable; empty-result and simulated-GraphQL-error states render correctly and do not regress `hasError`/`errorMessage` behavior (#63); every one of the other nine non-Booking `DataTable` screens is spot-checked to confirm zero behavior change.

## 10. Non-goals

- Amending #33's locked `OffsetPaging`/offset-only platform invariant, or introducing `PagingStrategies.CURSOR`/hand-rolled keyset pagination for Booking (§6, §7).
- A shadcn `Select` primitive (§2).
- Retrofitting any new `DataTable` prop (`refreshing`, `mobileRow`, cursor-mode `pagination`, `sortKey`) onto the other eleven `DataTable` call sites (§2).
- Migrating `StatusBadge` or its seven existing consumers onto `Badge` (§2, §5, §6, §7).
- Row selection, bulk actions, column resize/reorder/visibility, client-side filtering (§2 — explicit issue constraints).
- Search/filter UI for Bookings, or "cursor resets on filter change" (no filters exist to reset from) (§2).
- A `CustomerDataTable` or any second `DataTable` domain consumer (§2, §7).
- `jsdom`/`@testing-library/react` or any interaction-simulation test framework (§2, §9).

## 11. Acceptance criteria (for this specification)

- States the exact current GraphQL/`DataTable`/`BookingDataTable`/URL-state/testing baseline, verified by reading each file, and shows precisely how much of the issue's illustrative scope is already satisfied versus genuinely new (§4.1, §4.2).
- Resolves, with explicit rationale grounded in both the issue's own escape-hatch wording and #33's locked invariant, the apparent conflict between "cursor-based pagination... do not introduce offset-based pagination" and the platform's Accepted offset-only contract — without silently amending or violating either (§6).
- Records that resolution, plus the two smaller decisions (`createdAt` exclusion, status→variant mapping), as an explicit M3 round-1 review outcome rather than a silent self-Accept (§8).
- Specifies the exact new `DataTable`/`Pagination`/`BookingDataTable` prop surfaces precisely enough that M4 does not need to invent their shape, while keeping every addition optional and backward-compatible with the eleven non-Booking `DataTable` consumers (§4.3–§4.5, §2).
- Defines the `Badge` addition's mechanism (the already-established shadcn workflow) and explicitly addresses, rather than ignores, its overlap with the existing `StatusBadge` (§4.4, §5, §6).
- States precisely what "cursor state in the URL," "reset on sort/limit change," and "invalid values fall back safely" mean as pure, independently-testable functions, given this repository's no-interaction-simulation testing constraint (§4.6, §9).
- Defines a testing and acceptance bar consistent with this repository's existing precedent, covering every category the issue's own Tests section (§12) enumerates, and states explicitly what remains a manual (not automated) check and why (§9).

## 12. Traceability

| Upstream | This document |
| --- | --- |
| Reusable `DataTable` and `BookingDataTable` (#61) | **Extends** (`DataTableColumn`, `DataTablePaginationProps`, `DataTableProps`, `BookingDataTableProps`, all additively). **Relies on** `sort`/`onSortChange`'s existing controlled-state contract and `DataTable`'s GraphQL/routing-agnostic boundary. **Fulfills** its §6 followed-by item (sorting/URL-state for Bookings). |
| Paginated nestjs-query GraphQL Collections (#33) | **Relies on**, does **not** amend, the locked `OffsetPaging`/`OffsetConnection` platform invariant; builds a cursor-shaped frontend contract on top of it (§6). |
| `@clensy/ui` as the Shared UI System (#57) | **Relies on** the `base/` + shadcn-CLI-workflow convention for the new `Badge` primitive; unchanged boundary rule (`apps/web` has no shadcn knowledge). |
| Reusable-Component `errorMessage` API (#63) | **Relies on**, unchanged, `BookingDataTable`'s `hasError`/`errorMessage` contract. |
| App Router i18n Architecture | **Relies on** the existing `ClensyI18nProvider`/`useClensyTranslations` mechanism for the new `status.*` keys. |
