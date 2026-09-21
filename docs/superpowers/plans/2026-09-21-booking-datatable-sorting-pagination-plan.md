# `BookingDataTable` Sorting, Cursor-Shaped Pagination, URL State, Loading UX, Status Badges & Mobile View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver every in-scope capability of issue #65 for `BookingDataTable`: server-side sorting with `aria-sort`, a pagination-strategy-neutral (`hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious`) navigation UI layered over the existing, unmodified `OffsetConnection` backend, page-owned URL state with safe fallback and reset-on-change, a non-blocking "keep rows visible" loading mode, a real shadcn `Badge` for booking status, and a mobile card view — without touching `BookingReadResolver`'s `pagingStrategy`, without amending #33, and without changing any of the other eleven `DataTable` call sites.

**Architecture:** Every new capability is an additive, optional extension to `@clensy/ui`'s existing `DataTable`/`Pagination` (new `sortKey`, `aria-sort`, `refreshing`, `mobileRow` on `DataTable`; a new discriminated-union `mode: 'page' | 'navigation'` on `Pagination`'s props — **not** `'cursor'`, per the spec's Post-Accept correction below) plus one new `Badge` primitive. `BookingDataTable` (`@clensy/web`) threads these through with Booking-specific configuration (a locally-declared `BookingSortKey` whitelist, a single centralized status→`{variant, labelKey}` lookup with a fallback, a mobile card renderer reusing the same row-level value derivations as the desktop columns) — it still imports nothing from `@clensy/client`/`@apollo/client`/`next-intl`. `apps/web/app/app/bookings/page.tsx` gains ownership of URL state (a new pure, independently-testable parse/serialize module plus a `next/navigation`-backed hook, following `use-detail-drawer.ts`'s existing manual-`URLSearchParams` pattern) and is the only place that translates that state into GraphQL `paging`/`sorting` variables (with a mandatory `id ASC` tie-breaker appended to every user-selected sort) and into the navigation-shaped `pagination` prop's `onNext`/`onPrevious`/`hasNextPage`/`hasPreviousPage`.

**Tech Stack:** TypeScript, React 19, Next.js (App Router), NestJS + `@ptc-org/nestjs-query-graphql` 9.5.x, Apollo Client + codegen (`@clensy/client`), `vitest` (+ `renderToStaticMarkup` for React, pure-function unit tests elsewhere — no `jsdom`/`@testing-library/react`/interaction simulation anywhere in this repository), Jest (`apps/api`), pnpm workspaces (`api`, `web`, `@clensy/ui`, `@clensy/web`, `@clensy/client`), shadcn/`radix-ui`/`class-variance-authority`/`lucide-react` (inside `packages/ui` only), Tailwind 4.

**Spec:** [docs/superpowers/specs/2026-09-21-booking-datatable-sorting-pagination-design.md](../specs/2026-09-21-booking-datatable-sorting-pagination-design.md) (Accepted, M3 2026-09-21; Post-Accept correction 2026-09-21 — `DataTableCursorPaginationProps`/`mode: 'cursor'` renamed to `DataTableNavigationPaginationProps`/`mode: 'navigation'`; `limit`'s type widened to `BookingPageSize = 10 | 20 | 25 | 50 | 100`; sort-cycling-to-`none` resolution stated explicitly — see the spec's identity table). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**Also relies on (Accepted, unmodified beyond what the spec authorizes):** [Reusable `DataTable` and `BookingDataTable`](../specs/2026-09-19-reusable-data-table-design.md) (#61) — every new `DataTable`/`Pagination` prop in this plan is additive to that spec's contract; the other eleven `<DataTable>` call sites receive zero code changes. [Paginated nestjs-query GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) (#33) — `BookingReadResolver`'s `pagingStrategy: PagingStrategies.OFFSET`, `defaultSort`, `maxResultsSize`, and `BookingConnection` shape are untouched by this plan; Task 6 only adds a stricter *assertion* against the schema that already exists. [`@clensy/ui` as the Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md) (#57) — the new `Badge` primitive is added via that spec's already-documented `npx shadcn@latest add <component>` workflow (`packages/ui/README.md`). [Reusable-Component `errorMessage` API](../specs/2026-09-20-component-error-message-api-design.md) (#63) — `BookingDataTable`'s `hasError`/`errorMessage`/`resolveMessage` contract is untouched; this plan only adds new, unrelated props alongside it.

**M5 decision:** Round 1 returned for revision, 2026-09-21 — 4 blocking findings (limit/`BookingPageSize` type contradiction; `cursor`-named public API contradicting the spec's own naming principle; a non-assertive `onSortChange` test; under-specified `mobileRow` test/architecture) plus several non-blocking improvements, all addressed in this revision (see per-task notes below and the spec's Post-Accept correction for the two items that required a spec-level fix). Round 2 pending.

## Global Constraints

- SHALL keep `BookingReadResolver`'s `pagingStrategy: PagingStrategies.OFFSET` and `BookingDTO`'s `@QueryOptions`/`@FilterableField` set exactly as they are today. SHALL NOT introduce `PagingStrategies.CURSOR`, a hand-rolled keyset resolver, or any change to `BookingConnection`'s GraphQL shape (spec §2, §6; #33).
- SHALL NOT modify `packages/client/src/operations/bookings.graphql`'s `Bookings` operation document — `$sorting`/`$paging` already exist; this plan only starts populating `$sorting` from `apps/web` (spec §4.2).
- SHALL make every new `DataTable`/`Pagination`/`DataTableColumn` prop **optional**, defaulting to today's exact rendered behavior when omitted, so none of the other eleven `<DataTable>` call sites (`admin`, `billing`, `catalog`, `catalog/add-ons`, `cleaners`, `cleaners/teams` ×2, `customers` ×2, `jobs`, `laundry`) needs a code change (spec §2, §4.1, §4.3).
- SHALL NOT change `nextSortState`'s existing `none → asc → desc → none` cycle logic (spec §4.3).
- SHALL name the URL parameter carrying pagination position `offset`, and SHALL NOT name any URL parameter, component prop, or exported type `cursor` — the underlying value is a literal offset, never an opaque token, and the public API (`Pagination`'s `mode: 'navigation'`, `DataTableNavigationPaginationProps`) uses that word precisely because `cursor` would misrepresent the pagination strategy (spec §3, §4.3, §4.6, §8; Post-Accept correction).
- SHALL restrict `BookingSortKey` to exactly `'scheduledAt' | 'status'` — SHALL NOT include `createdAt` (spec §4.5, §8).
- SHALL restrict the row-limit selector to exactly `BookingPageSize = 10 | 20 | 25 | 50 | 100`, with `20` as the default — matching the platform's existing `PLATFORM_PAGE_DEFAULT` (spec §4.6, Post-Accept correction).
- SHALL append a deterministic secondary tie-breaker (`{ field: 'id', direction: 'ASC' }`) to every `sorting` GraphQL variable this table constructs, not only the backend's own default (spec §4.6, §8).
- SHALL resolve a sortable column cycling back to its unsorted (`none`) state to the table's canonical default sort (`scheduledAt` `desc`), regardless of which column (`scheduledAt` or `status`) was clicked to reach it — `DataTable`'s `sort` prop is single-valued, not per-column (spec §4.6, Post-Accept correction).
- SHALL centralize the `BookingStatus → { Badge variant, translation key }` mapping in `BookingDataTable` as **one** lookup, never inline per-column JSX and never two independently-maintained maps, and SHALL provide an explicit fallback (`variant: 'outline'`, raw status string as label) for a status value outside the four known `BookingStatus` members (spec §4.5, §8).
- SHALL leave `StatusBadge` (`packages/ui/src/base/status-badge.tsx`) and its seven existing consumers completely untouched (spec §2, §5, §6).
- SHALL follow `use-detail-drawer.ts`'s existing manual `URLSearchParams`/`useSearchParams`/`usePathname`/`useRouter` pattern for the new URL-state hook — SHALL NOT introduce `nuqs` or any other routing/URL-state library (spec §4.6).
- SHALL keep every `parseBookingTableUrlState`/`serializeBookingTableUrlState`-style function pure (no `next/navigation` import), independently unit-testable without rendering, following the `nextSortState`/`resolveMessage`/`togglePageSelection` precedent (spec §4.6, §9).
- SHALL NOT introduce `jsdom`, `@testing-library/react`, or any interaction-simulation test mechanism (spec §2, §9). Every test that would otherwise need to simulate a click MUST instead assert against the pure function that click would call (e.g. `nextSortState` directly), not against a callback that is asserted to never fire.
- SHALL NOT implement row selection, bulk actions, column resize/reorder/visibility, client-side filtering, a `CustomerDataTable`, search/filter UI for Bookings, or a shadcn `Select` primitive (spec §2, §10 — explicit non-goals).
- SHALL NOT modify any file outside: `packages/ui/src/base/{data-table,pagination,badge}.{tsx,test.tsx}`, `packages/ui/src/index.ts`, `packages/web/src/bookings/**`, `packages/web/src/i18n/messages/en/bookings.ts`, `apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts`, `apps/web/app/app/bookings/page.tsx`, `apps/web/lib/use-booking-table-url-state.{ts,test.ts}`.

---

### Task 1: `@clensy/ui` `DataTable` — `sortKey` and `aria-sort`

**Files:**
- Modify: `packages/ui/src/base/data-table.tsx:9-16` (`DataTableColumn`), `:147-150` (`handleSortClick`), `:176-192` (sortable header render)
- Modify: `packages/ui/src/base/data-table.test.tsx`

**Interfaces:**
- Produces: `DataTableColumn.sortKey?: string` — consumed by Task 7 (`BookingDataTable`'s sortable columns).

- [ ] **Step 1: Write the failing tests**

Add to `data-table.test.tsx` (new `describe` block after the existing `DataTable` tests):

```ts
describe('DataTable — aria-sort and sortKey (#65)', () => {
  const columnsWithSortKey: DataTableColumn<Row>[] = [
    { key: 'name', header: 'Name', sortable: true, sortKey: 'displayName' },
  ];

  it('renders aria-sort="none" when unsorted, keyed off sortKey not key', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columnsWithSortKey} rows={rows} rowKey={(r) => r.id} sort={null} />,
    );
    expect(html).toContain('aria-sort="none"');
  });

  it('renders aria-sort="ascending"/"descending" matched against sortKey, not key', () => {
    const asc = renderToStaticMarkup(
      <DataTable
        columns={columnsWithSortKey}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'displayName', direction: 'asc' }}
      />,
    );
    expect(asc).toContain('aria-sort="ascending"');
    const desc = renderToStaticMarkup(
      <DataTable
        columns={columnsWithSortKey}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'displayName', direction: 'desc' }}
      />,
    );
    expect(desc).toContain('aria-sort="descending"');
  });

  // M5 round-1 finding: a prior draft of this test rendered with an
  // onSortChange spy and then asserted the spy was NEVER called — which
  // proves nothing about what onSortChange *reports*, only that
  // renderToStaticMarkup doesn't simulate clicks (already known). The
  // actual click→report behavior is a pure computation
  // (nextSortState(sort, column.sortKey ?? column.key)) and is tested
  // directly, the same way nextSortState's own cycle tests already work —
  // no rendering or callback-spy involved.
  it('the value a click would report is sortKey, not key, when sortKey differs (pure)', () => {
    const column = columnsWithSortKey[0];
    expect(nextSortState(null, column.sortKey ?? column.key)).toEqual({ key: 'displayName', direction: 'asc' });
  });

  it('a sortable column without sortKey still keys off key (backward compatible)', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={[{ key: 'name', header: 'Name', sortable: true }]}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
      />,
    );
    expect(html).toContain('aria-sort="ascending"');
  });

  it('renders no aria-sort attribute on a non-sortable column', () => {
    const html = renderToStaticMarkup(<DataTable columns={mixedColumns} rows={rows} rowKey={(r) => r.id} />);
    const idHeaderIndex = html.indexOf('>ID<');
    const idCellStart = html.lastIndexOf('<th', idHeaderIndex);
    expect(html.slice(idCellStart, idHeaderIndex)).not.toContain('aria-sort');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/ui test -- data-table`
Expected: FAIL — no `aria-sort` attribute exists yet; `sortKey` is not a recognized `DataTableColumn` field (TypeScript error under vitest).

- [ ] **Step 3: Write the minimal implementation**

In `data-table.tsx`, add `sortKey` to `DataTableColumn` (after `sortable?: boolean;`, line 13):

```ts
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: string | ((row: T) => ReactNode);
  sortable?: boolean;
  sortKey?: string;
  align?: 'center' | 'left' | 'right';
  width?: string;
}
```

Change `handleSortClick` (lines 147-150) to report `column.sortKey ?? column.key`:

```ts
  function handleSortClick(column: DataTableColumn<T>) {
    if (!column.sortable) return;
    onSortChange?.(nextSortState(sort, column.sortKey ?? column.key));
  }
```

Change the sortable header render (lines 170-197) to compare against `column.sortKey ?? column.key` and add `aria-sort`:

```tsx
            {columns.map((column) => {
              const effectiveSortKey = column.sortKey ?? column.key;
              const isSorted = column.sortable && sort?.key === effectiveSortKey;
              return (
                <TableHead
                  key={column.key}
                  className={ALIGN_CLASS[column.align ?? 'left']}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={column.sortable ? (isSorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium"
                      onClick={() => handleSortClick(column)}
                    >
                      {column.header}
                      {isSorted ? (
                        sort!.direction === 'asc' ? (
                          <ArrowUpIcon className="size-3.5" />
                        ) : (
                          <ArrowDownIcon className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDownIcon className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/ui test -- data-table`
Expected: PASS — all pre-existing `DataTable` tests plus the new `aria-sort`/`sortKey` tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/base/data-table.tsx packages/ui/src/base/data-table.test.tsx
git commit -m "feat(65): add DataTableColumn.sortKey and aria-sort to sortable headers"
```

---

### Task 2: `@clensy/ui` `DataTable` — `refreshing` (keep rows visible)

**Files:**
- Modify: `packages/ui/src/base/data-table.tsx:31-44` (`DataTableProps`), `:104-117` (function signature/destructure), `:154-270` (render — add the progress indicator, branch the body)
- Modify: `packages/ui/src/base/data-table.test.tsx`

**Interfaces:**
- Produces: `DataTableProps.refreshing?: boolean` — consumed by Task 9 (`BookingDataTable`) and Task 11 (Bookings page).

**Contract (M5 round-1 clarification):** `refreshing` takes precedence over `loading`, `error`, and the empty-state branch — a consumer that sets `refreshing: true` is asserting that `rows` is the (possibly stale) dataset to keep showing while a new request is pending. `DataTable` does not validate this; it is the consumer's responsibility to only set `refreshing` when `rows` represents genuinely-previously-displayed data (Task 11 satisfies this by deriving `refreshing` from whether data was already loaded, not merely from `loading`).

- [ ] **Step 1: Write the failing tests**

```ts
describe('DataTable — refreshing (#65)', () => {
  it('renders rows normally (not the loading branch) when refreshing is true, even if loading is also true', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} loading refreshing />,
    );
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  it('renders a progress indicator when refreshing is true', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} refreshing />,
    );
    expect(html).toContain('role="progressbar"');
  });

  it('omits the progress indicator when refreshing is false or omitted', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).not.toContain('role="progressbar"');
  });

  it('loading alone (refreshing omitted) still replaces the body as today (regression)', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} loading />,
    );
    expect(html).not.toContain('Alice');
  });

  // M5 round-1 finding: refreshing takes priority even over an empty rows
  // array — this is a deliberate consequence of the contract above (the
  // consumer's responsibility, not DataTable's to second-guess), pinned
  // here so a future change to this precedence is a visible, intentional
  // diff rather than an accidental regression.
  it('refreshing with an empty rows array renders the empty branch\'s absence, not a crash, and still shows the indicator', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={[]} rowKey={(r) => r.id} refreshing emptyMessage="Nothing here." />,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('Nothing here.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/ui test -- data-table`
Expected: FAIL — `refreshing` is not a recognized prop; no `role="progressbar"` is ever rendered.

- [ ] **Step 3: Write the minimal implementation**

Add `refreshing?: boolean;` to `DataTableProps` (after `toolbar?: ReactNode;`, line 43) and to the destructured props (after `toolbar,`, line 116). Insert a thin indicator immediately after the `{toolbar ? ... : null}` line (line 156) and change the `<TableBody>` branch condition so `refreshing` bypasses the `loading`/`error`/empty gates and renders `rows` directly (an empty `rows` under `refreshing` therefore renders an empty `<TableBody>`, not the empty-message branch — matching the test above):

```tsx
      {toolbar ? <div className="flex items-center justify-between gap-3 pb-3">{toolbar}</div> : null}
      {refreshing ? (
        <div role="progressbar" aria-label="Refreshing" className="h-0.5 w-full animate-pulse bg-primary/50" />
      ) : null}
      <Table>
        <TableHeader>{/* ...unchanged... */}</TableHeader>
        <TableBody>
          {refreshing ? (
            rows.map((row) => /* ...same row-rendering branch as the existing non-loading/non-error/non-empty case, unchanged... */)
          ) : loading ? (
            /* ...unchanged loading branch... */
          ) : error ? (
            /* ...unchanged error branch... */
          ) : rows.length === 0 ? (
            /* ...unchanged empty branch... */
          ) : (
            /* ...unchanged row-rendering branch... */
          )}
        </TableBody>
      </Table>
```

Implementation note for M6: extract the existing row-map body (lines 220-264) into a small local function and call it from both the `refreshing` and default branches — do not diverge the two copies.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/ui test -- data-table`
Expected: PASS — all tests including the five new ones and the pre-existing `loading`/`error`/empty tests (unchanged behavior when `refreshing` is omitted).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/base/data-table.tsx packages/ui/src/base/data-table.test.tsx
git commit -m "feat(65): add DataTable.refreshing to keep rows visible during background updates"
```

---

### Task 3: `@clensy/ui` `DataTable` — `mobileRow`

**Files:**
- Modify: `packages/ui/src/base/data-table.tsx:31-44` (`DataTableProps`), `:104-117`, `:154-270` (render)
- Modify: `packages/ui/src/base/data-table.test.tsx`

**Interfaces:**
- Produces: `DataTableProps.mobileRow?: (row: T) => ReactNode` — consumed by Task 9 (`BookingDataTable`).

**M5 round-1 correction:** the prior draft's tests asserted on the literal CSS class string `sm:hidden` — testing implementation styling, not behavior. Rewritten below to assert on rendered content/structure only; the responsive breakpoint itself is a manual-verification concern (Task 12).

- [ ] **Step 1: Write the failing tests**

```ts
describe('DataTable — mobileRow (#65)', () => {
  it('renders mobileRow output for each row when supplied', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        mobileRow={(row) => <div key={row.id}>Card: {row.name}</div>}
      />,
    );
    expect(html).toContain('Card: Alice');
    expect(html).toContain('Card: Bob');
  });

  it('renders no card content when mobileRow is omitted (backward-compatible default)', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).not.toContain('Card:');
  });

  it('still renders the desktop table when mobileRow is supplied', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        mobileRow={(row) => <div key={row.id}>Card: {row.name}</div>}
      />,
    );
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Alice'); // still present in the desktop table's own cell content
  });

  it('mobileRow respects loading/error/empty state the same as the desktop table', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nothing here."
        mobileRow={(row) => <div key={row.id}>Card: {row.name}</div>}
      />,
    );
    expect(html).toContain('Nothing here.');
    expect(html).not.toContain('Card:');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/ui test -- data-table`
Expected: FAIL — `mobileRow` is not a recognized prop; no card markup is ever rendered.

- [ ] **Step 3: Write the minimal implementation**

Add `mobileRow?: (row: T) => ReactNode;` to `DataTableProps` and its destructure, mirroring Task 2's pattern. Wrap the existing `<Table>...</Table>` in a `<div className="hidden sm:block">` and, when `mobileRow` is supplied, render a sibling `<div className="sm:hidden flex flex-col gap-2">` (the `sm:hidden` utility resolves to `display: none` below the breakpoint, which is also removed from the accessibility tree — no separate ARIA handling is needed) that reuses the **same** loading/error/empty/refreshing gating already computed for the desktop body — extract a single shared "what should the body currently show" computation (e.g. a small `bodyState: 'loading' | 'error' | 'empty' | 'rows'` value derived once from `loading`/`error`/`rows.length`/`refreshing`) and branch both the desktop `<TableBody>` and the mobile card list off that same value, rather than reimplementing the branching twice. When `mobileRow` is omitted, render exactly as today (no wrapping `div`, no breakpoint classes) — the desktop `<Table>` is not wrapped at all in that case.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/ui test -- data-table`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/base/data-table.tsx packages/ui/src/base/data-table.test.tsx
git commit -m "feat(65): add DataTable.mobileRow for breakpoint-gated card rendering"
```

---

### Task 4: `@clensy/ui` `Pagination` — pagination-strategy-neutral (`navigation`) mode

**Files:**
- Modify: `packages/ui/src/base/pagination.tsx` (whole file)
- Modify: `packages/ui/src/base/pagination.test.tsx`
- Modify: `packages/ui/src/base/data-table.tsx:6` (import — widen the `DataTablePaginationProps` type import, no logic change)

**Interfaces:**
- Produces: `DataTableOffsetPaginationProps`, `DataTableNavigationPaginationProps`, `DataTablePaginationProps` (now a union) — consumed by Task 9 (`BookingDataTable`) and Task 11 (Bookings page).

**M5 round-1 correction:** the prior draft named this `DataTableCursorPaginationProps`/`mode: 'cursor'`, directly contradicting the spec's own "pagination-strategy-neutral, honest naming" principle (the URL-naming rule already forbade `cursor`; the same reasoning applies to the type/prop name). The spec's Post-Accept correction renames it to `DataTableNavigationPaginationProps`/`mode: 'navigation'`; this task follows that rename.

- [ ] **Step 1: Write the failing tests**

Add to `pagination.test.tsx`:

```ts
describe('Pagination — navigation mode (#65)', () => {
  it('disables Previous when hasPreviousPage is false, enables when true', () => {
    const noPrev = renderToStaticMarkup(
      <Pagination mode="navigation" pageSize={20} hasNextPage hasPreviousPage={false} onNext={() => {}} onPrevious={() => {}} />,
    );
    expect(extractButtonByLabel(noPrev, 'Previous page')).toContain('disabled=""');
    const withPrev = renderToStaticMarkup(
      <Pagination mode="navigation" pageSize={20} hasNextPage hasPreviousPage onNext={() => {}} onPrevious={() => {}} />,
    );
    expect(extractButtonByLabel(withPrev, 'Previous page')).not.toContain('disabled=""');
  });

  it('disables Next when hasNextPage is false, enables when true', () => {
    const noNext = renderToStaticMarkup(
      <Pagination mode="navigation" pageSize={20} hasNextPage={false} hasPreviousPage onNext={() => {}} onPrevious={() => {}} />,
    );
    expect(extractButtonByLabel(noNext, 'Next page')).toContain('disabled=""');
  });

  it('renders totalCount when supplied, omits page-number text', () => {
    const html = renderToStaticMarkup(
      <Pagination mode="navigation" pageSize={20} totalCount={142} hasNextPage hasPreviousPage onNext={() => {}} onPrevious={() => {}} />,
    );
    expect(html).toContain('142');
    expect(html).not.toContain('Page ');
  });

  it('renders without a totalCount when it is not supplied', () => {
    const html = renderToStaticMarkup(
      <Pagination mode="navigation" pageSize={20} hasNextPage hasPreviousPage onNext={() => {}} onPrevious={() => {}} />,
    );
    expect(html).not.toContain('Page ');
  });

  it('offset (default) mode is completely unchanged — regression gate for the eleven untouched consumers', () => {
    const html = renderToStaticMarkup(<Pagination page={1} pageSize={20} totalCount={100} onPageChange={() => {}} />);
    expect(html).toContain('Page 1 of 5');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/ui test -- pagination`
Expected: FAIL — `Pagination` has no `mode`/`hasNextPage`/`hasPreviousPage`/`onNext`/`onPrevious` props yet.

- [ ] **Step 3: Write the minimal implementation**

Replace `pagination.tsx`'s type section and component with:

```tsx
import type { ChangeEvent } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from './button';

export interface DataTableOffsetPaginationProps {
  mode?: 'page';
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export interface DataTableNavigationPaginationProps {
  mode: 'navigation'; // not "cursor" — see spec Post-Accept correction
  pageSize: number;
  totalCount?: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export type DataTablePaginationProps = DataTableOffsetPaginationProps | DataTableNavigationPaginationProps;

function PageSizeSelect({
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange?: (pageSize: number) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onPageSizeChange?.(Number(event.currentTarget.value));
  }
  const options = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  return (
    <select
      aria-label="Rows per page"
      value={pageSize}
      onChange={handleChange}
      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option} / page
        </option>
      ))}
    </select>
  );
}

export function Pagination(props: DataTablePaginationProps) {
  if (props.mode === 'navigation') {
    const { pageSize, totalCount, hasNextPage, hasPreviousPage, onNext, onPrevious, pageSizeOptions, onPageSizeChange } = props;
    return (
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
        <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={!hasPreviousPage} onClick={onPrevious}>
          <ChevronLeftIcon /> Previous
        </Button>
        <div className="flex items-center gap-3">
          {totalCount !== undefined ? <span>Showing up to {pageSize} of {totalCount}</span> : null}
          {pageSizeOptions ? (
            <PageSizeSelect pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange} />
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={!hasNextPage} onClick={onNext}>
          Next <ChevronRightIcon />
        </Button>
      </div>
    );
  }

  const { page, pageSize, totalCount, onPageChange, pageSizeOptions, onPageSizeChange } = props;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
      <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeftIcon /> Previous
      </Button>
      <div className="flex items-center gap-3">
        <span>Page {page} of {pageCount}</span>
        {pageSizeOptions ? (
          <PageSizeSelect pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange} />
        ) : null}
      </div>
      <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next <ChevronRightIcon />
      </Button>
    </div>
  );
}
```

(`PageSizeSelect` is extracted only to avoid duplicating the M7-fixed "always include the current value as an option" logic between the two branches — a planning-level refactor, not a behavior change; the offset branch's rendered output is byte-for-byte identical to today's.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/ui test -- pagination`
Expected: PASS — all pre-existing offset-mode tests plus the new navigation-mode tests.

- [ ] **Step 5: Verify `DataTable` still typechecks against the widened type**

Run: `pnpm --filter @clensy/ui build`
Expected: succeeds — `data-table.tsx`'s `pagination?: DataTablePaginationProps` and `{pagination ? <Pagination {...pagination} /> : null}` (line 268) require no code change since `Pagination` now accepts its own widened prop type directly.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/base/pagination.tsx packages/ui/src/base/pagination.test.tsx
git commit -m "feat(65): add pagination-strategy-neutral navigation mode to Pagination"
```

---

### Task 5: `@clensy/ui` — new `Badge` primitive

**Files:**
- Create: `packages/ui/src/base/badge.tsx` (via shadcn CLI, not hand-authored)
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/src/base/badge.test.tsx`

**Interfaces:**
- Produces: `Badge`, `badgeVariants` (or the CLI's exact export names — confirm against the generated file) — consumed by Task 8 (`BookingDataTable`'s status column).

- [ ] **Step 1: Generate the primitive**

From `packages/ui`, run:

```bash
npx shadcn@latest add badge
```

Expected: creates `packages/ui/src/base/badge.tsx` following the same generated pattern as `button.tsx` (a `cva`-based `badgeVariants` with `default | secondary | destructive | outline` variants, a `Badge` component). If the CLI writes to a different path (e.g. `src/components/ui/badge.tsx`), move it to `packages/ui/src/base/badge.tsx` and fix its internal imports to match this package's relative-import convention (the same fixup `packages/ui/README.md`'s "Adding a new primitive" section already documents for `Table`/`Checkbox`).

- [ ] **Step 2: Export it**

Add to `packages/ui/src/index.ts`, alongside the other `base/` primitive exports (after the `Button`/`buttonVariants` export line):

```ts
export { Badge, badgeVariants } from './base/badge';
```

(Adjust the exact export names to match what the generated file actually exports — do not invent names the CLI didn't produce.)

- [ ] **Step 3: Write a minimal test**

Create `packages/ui/src/base/badge.test.tsx`, mirroring `button.test.tsx`'s own variant test structure — read `button.test.tsx` first for the exact assertion style used there, then write the equivalent for `Badge`'s four variants (`default`, `secondary`, `destructive`, `outline`) plus the omitted-variant default. **M5 round-1 note:** assert on `badgeVariants({ variant: '...' })`'s resolved class string (or `Badge`'s rendered `className`), not on an internal `data-slot` attribute value — the class-contract is the thing this repository already treats as the tested surface for `Button`, and coupling a test to a generated `data-slot` string risks breaking on an unrelated shadcn version bump.

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @clensy/ui test -- badge`
Expected: PASS.

- [ ] **Step 5: Verify build/lint**

Run: `pnpm --filter @clensy/ui build && pnpm --filter @clensy/ui lint`
Expected: both succeed; no new dependency beyond what `packages/ui/package.json` already has for `Button` (`class-variance-authority`, `cn`) is required for `Badge` (shadcn's Badge does not use `radix-ui` or `lucide-react`) — if the CLI adds an unexpected dependency, confirm it's genuinely needed by reading the generated file before accepting it.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/base/badge.tsx packages/ui/src/base/badge.test.tsx packages/ui/src/index.ts packages/ui/package.json
git commit -m "feat(65): add shadcn Badge primitive to @clensy/ui"
```

---

### Task 6: `apps/api` — confirm the booking sort-field whitelist by test

**Files:**
- Modify: `apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts:177-182`

**Interfaces:** None produced — verification only, per spec §4.2 item 2.

- [ ] **Step 1: Strengthen the existing `BookingSortFields` assertion**

The schema-allowlist test already builds the real schema and reads `BookingSortFields` (lines 177-182), but only asserts `arrayContaining(['id', 'scheduledAt'])` — not the full set. Change it to an exact-match assertion:

```ts
      const sortFields = schema.getType('BookingSortFields') as GraphQLEnumType;
      expect(sortFields).toBeDefined();
      const sortFieldNames = sortFields.getValues().map((value) => value.name).sort();
      // Whitelist proof (#65 spec §4.2 item 2): BookingSortFields exposes
      // exactly the four fields the schema currently permits sorting on
      // (id, scheduledAt, status, createdAt) — none of Booking's four
      // relations (customer/property/service/team) and no non-filterable
      // field (pricingSnapshot) is sortable.
      expect(sortFieldNames).toEqual(['createdAt', 'id', 'scheduledAt', 'status'].sort());
```

- [ ] **Step 2: Run the test to verify it currently passes (this is a proof, not a new feature)**

Run: `pnpm --filter api test -- booking.resolver.spec`
Expected: PASS. **If this fails**, the sort whitelist is not what §4.1/§4.2 of the spec assumes — STOP, do not proceed to Task 7, and return this finding to M2/M3 per the spec's own §4.2 item 2 ("If that assertion fails... this is a spec-return, not a license to ship an unvalidated `ORDER BY` surface").

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts
git commit -m "test(65): pin the exact BookingSortFields whitelist (id, scheduledAt, status, createdAt)"
```

---

### Task 7: `BookingDataTable` — sortable columns and `BookingSortKey`

**Files:**
- Modify: `packages/web/src/bookings/booking-data-table.tsx:1-4` (imports), `:20-28` (`BookingDataTableProps`), `:38-67` (function/columns)
- Modify: `packages/web/src/bookings/booking-data-table.test.tsx`

**Interfaces:**
- Produces: `BookingSortKey = 'scheduledAt' | 'status'`, `BookingDataTableProps.sort?: { key: BookingSortKey; direction: 'asc' | 'desc' } | null`, `BookingDataTableProps.onSortChange?: (...) => void` — consumed by Task 11 (Bookings page).
- Consumes: `DataTableColumn.sortKey` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add to `booking-data-table.test.tsx`:

```ts
  it('marks the Scheduled and Status columns sortable with the correct sortKey', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'scheduledAt', direction: 'asc' }}
      />,
    );
    expect(html).toContain('aria-sort="ascending"');
  });

  it('passes sort/onSortChange through to the underlying DataTable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'status', direction: 'desc' }}
      />,
    );
    expect(html).toContain('aria-sort="descending"');
  });

  it('customer/property/service/team/price columns are not sortable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} />,
    );
    const customerHeaderIndex = html.indexOf('>Customer<');
    const customerCellStart = html.lastIndexOf('<th', customerHeaderIndex);
    expect(html.slice(customerCellStart, customerHeaderIndex)).not.toContain('<button');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: FAIL — no columns are sortable yet; `BookingDataTableProps` has no `sort`/`onSortChange`.

- [ ] **Step 3: Write the minimal implementation**

In `booking-data-table.tsx`, add `BookingSortKey` (exported, after the existing `BookingStatus` type, line 6):

```ts
export type BookingSortKey = 'scheduledAt' | 'status';

export interface BookingSortState {
  key: BookingSortKey;
  direction: 'asc' | 'desc';
}
```

Extend `BookingDataTableProps` (after `pagination: DataTablePaginationProps;`):

```ts
  sort?: BookingSortState | null;
  onSortChange?: (sort: BookingSortState | null) => void;
```

Extend the function signature/destructure to include `sort, onSortChange`, and change the `scheduledAt`/`status` column definitions:

```ts
    { header: t('columns.scheduled'), key: 'scheduledAt', sortable: true, sortKey: 'scheduledAt', render: (row) => formatScheduledAt(row.scheduledAt) },
    { header: t('columns.status'), key: 'status', sortable: true, sortKey: 'status', render: 'status' },
```

(The `status` column's `render` becomes the `Badge`-based renderer in Task 8 — this task only adds `sortable`/`sortKey`, leaving `render: 'status'` as-is to keep this task's diff isolated and independently reviewable.)

Pass `sort`/`onSortChange` through to the underlying `<DataTable>` call:

```tsx
    <DataTable
      columns={columns}
      rows={bookings}
      rowKey={(row) => row.id}
      emptyMessage={t('empty')}
      loading={loading}
      error={resolvedErrorMessage}
      onRowClick={onRowClick}
      pagination={pagination}
      sort={sort}
      onSortChange={onSortChange}
    />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/bookings/booking-data-table.tsx packages/web/src/bookings/booking-data-table.test.tsx
git commit -m "feat(65): make BookingDataTable's Scheduled/Status columns sortable"
```

---

### Task 8: `BookingDataTable` — status `Badge` with one centralized config and fallback

**Files:**
- Modify: `packages/web/src/bookings/booking-data-table.tsx` (status column `render`, new lookup)
- Modify: `packages/web/src/i18n/messages/en/bookings.ts`
- Modify: `packages/web/src/bookings/booking-data-table.test.tsx`

**Interfaces:** None new beyond internal rendering — `BookingDataTableProps` is unchanged by this task.

**M5 round-1 correction:** the prior draft split status→variant and status→label into two separate maps/functions. Consolidated below into **one** `BOOKING_STATUS_CONFIG` lookup (still satisfying the spec's "variant and translated label are two independent *values*, neither derived from the other" requirement — they are simply two fields of the same config entry now, not two parallel data structures to keep in sync).

- [ ] **Step 1: Write the failing tests**

```ts
  it('renders each BookingStatus as a Badge with the correct translated label', () => {
    for (const [status, label] of [
      ['PENDING', 'Pending'],
      ['CONFIRMED', 'Confirmed'],
      ['CANCELLED', 'Cancelled'],
      ['COMPLETED', 'Completed'],
    ] as const) {
      const html = renderToStaticMarkup(
        <BookingDataTable bookings={[{ ...booking, status }]} formatPrice={() => '₱0.00'} pagination={pagination} />,
      );
      expect(html).toContain(label);
      expect(html).not.toContain(`>${status}<`);
    }
  });

  it('falls back to an outline Badge with the raw status string for an unrecognized status', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[{ ...booking, status: 'SOME_FUTURE_STATUS' as never }]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
      />,
    );
    expect(html).toContain('SOME_FUTURE_STATUS');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: FAIL — status still renders the raw string, not a `Badge`.

- [ ] **Step 3: Write the minimal implementation**

Add one centralized, exhaustive-with-fallback config near the top of `booking-data-table.tsx` (after `formatScheduledAt`):

```ts
type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary';

interface BookingStatusConfig {
  variant: BadgeVariant;
  labelKey: string;
}

// One centralized status → { Badge variant, translation key } lookup — not
// two independently-maintained maps. row.status crosses a GraphQL API
// boundary this component does not control, so a status value outside the
// four known members (e.g. the backend ships a fifth status before this
// table is updated) must degrade safely rather than render undefined/throw.
const BOOKING_STATUS_CONFIG: Record<BookingStatus, BookingStatusConfig> = {
  PENDING: { variant: 'outline', labelKey: 'status.pending' },
  CONFIRMED: { variant: 'default', labelKey: 'status.confirmed' },
  COMPLETED: { variant: 'secondary', labelKey: 'status.completed' },
  CANCELLED: { variant: 'destructive', labelKey: 'status.cancelled' },
};

function bookingStatusBadge(status: BookingStatus, t: (key: string) => string): { variant: BadgeVariant; label: string } {
  const config = BOOKING_STATUS_CONFIG[status];
  if (!config) return { variant: 'outline', label: status };
  const label = t(config.labelKey);
  return { variant: config.variant, label: label === config.labelKey ? status : label }; // t() returns the key itself on a miss
}
```

Change the `status` column's `render`:

```ts
    {
      header: t('columns.status'),
      key: 'status',
      sortable: true,
      sortKey: 'status',
      render: (row) => {
        const { variant, label } = bookingStatusBadge(row.status, t);
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
```

Add `Badge` to the `@clensy/ui` import line (line 3).

Add the `status` namespace to `packages/web/src/i18n/messages/en/bookings.ts`:

```ts
export const bookings = {
  columns: { /* unchanged */ },
  empty: 'No bookings.',
  error: 'Unable to load bookings.',
  status: {
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
  },
  unassigned: 'Unassigned',
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/bookings/booking-data-table.tsx packages/web/src/bookings/booking-data-table.test.tsx packages/web/src/i18n/messages/en/bookings.ts
git commit -m "feat(65): render booking status as a translated, semantically-variant Badge"
```

---

### Task 9: `BookingDataTable` — `mobileRow`, `refreshing`, and widened `pagination` type

**Files:**
- Modify: `packages/web/src/bookings/booking-data-table.tsx`
- Modify: `packages/web/src/bookings/booking-data-table.test.tsx`

**Interfaces:**
- Produces: `BookingDataTableProps.refreshing?: boolean` (passthrough) — consumed by Task 11. `pagination: DataTablePaginationProps` now accepts the widened (navigation-capable) union from Task 4 with no interface text change (the imported type widened at its source).
- Consumes: `DataTable.mobileRow`/`refreshing` (Tasks 2, 3).

**M5 round-1 correction:** the mobile card content below now includes a booking reference (`row.id`) alongside customer/date/status/property/service/price — the prior draft omitted it, leaving the card without any per-booking identifier distinct from its position in the list.

- [ ] **Step 1: Write the failing tests**

```ts
  it('renders a mobile card with a booking reference, customer, date, and status for each booking', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={(m) => `₱${(m / 100).toFixed(2)}`} pagination={pagination} />,
    );
    expect(html).toContain(booking.id);
    expect(html).toContain('Jane Doe');
  });

  it('passes refreshing through to the underlying DataTable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} refreshing />,
    );
    expect(html).toContain('role="progressbar"');
  });

  it('accepts a navigation-shaped pagination prop', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={{ mode: 'navigation', pageSize: 20, hasNextPage: true, hasPreviousPage: false, onNext: () => {}, onPrevious: () => {} }}
      />,
    );
    expect(html).toContain('Jane Doe');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: FAIL — no `mobileRow` is wired up; `refreshing` is not a recognized prop; the navigation-shaped `pagination` object doesn't typecheck yet (it does structurally once Task 4 widens the imported type — verify whether this actually fails before writing code, since the type change may already make this pass; if so, skip re-asserting it and note in the commit that this test documents existing behavior).

- [ ] **Step 3: Write the minimal implementation**

Add `refreshing?: boolean;` to `BookingDataTableProps` and its destructure; pass it through to `<DataTable refreshing={refreshing} .../>`.

Add a `mobileRow` function inside `BookingDataTable` (reusing the exact same `formatScheduledAt`/`formatPrice`/`bookingStatusBadge` helpers the desktop columns use — no second data mapping, per spec §4.5/§5):

```tsx
  function renderMobileRow(row: Booking) {
    const { variant, label } = bookingStatusBadge(row.status, t);
    return (
      <div key={row.id} className="rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
          <Badge variant={variant}>{label}</Badge>
        </div>
        <div className="font-medium">{row.customer.fullName}</div>
        <div className="text-muted-foreground">{formatScheduledAt(row.scheduledAt)}</div>
        <div className="text-muted-foreground">{row.property.addressLine1}</div>
        <div className="flex items-center justify-between pt-1">
          <span>{row.service.name}</span>
          <span>{formatPrice(row.pricingSnapshot.priceMinorUnits)}</span>
        </div>
      </div>
    );
  }
```

Pass it to `<DataTable mobileRow={renderMobileRow} .../>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/bookings/booking-data-table.tsx packages/web/src/bookings/booking-data-table.test.tsx
git commit -m "feat(65): add BookingDataTable mobile card view and refreshing passthrough"
```

---

### Task 10: `apps/web` — pure URL-state parse/serialize + hook

**Files:**
- Create: `apps/web/lib/use-booking-table-url-state.ts`
- Create: `apps/web/lib/use-booking-table-url-state.test.ts`

**Interfaces:**
- Produces: `BookingPageSize`, `BookingTableUrlState`, `parseBookingTableUrlState(searchParams: URLSearchParams): BookingTableUrlState`, `serializeBookingTableUrlState(state: BookingTableUrlState): URLSearchParams`, `useBookingTableUrlState()` hook (returning a functional-update-capable setter) — consumed by Task 11.

**M5 round-1 corrections applied:** (1) `limit`'s type now includes `20` (`BookingPageSize = 10 | 20 | 25 | 50 | 100`), matching the spec's Post-Accept correction — the prior draft's `10 | 25 | 50 | 100` type did not admit the stated default of `20`, a genuine TypeScript compile error; (2) `setState` accepts either a `BookingTableUrlState` or an updater function `(current) => BookingTableUrlState`, so Task 11's rapid-Next-click case reads from the latest state rather than a `tableState` closure captured at render time.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/use-booking-table-url-state.test.ts` (plain `vitest`, no rendering, no `next/navigation` import):

```ts
import { describe, expect, it } from 'vitest';
import { parseBookingTableUrlState, serializeBookingTableUrlState } from './use-booking-table-url-state';

describe('parseBookingTableUrlState', () => {
  it('returns the canonical defaults for an empty URLSearchParams', () => {
    expect(parseBookingTableUrlState(new URLSearchParams())).toEqual({
      sortBy: 'scheduledAt',
      sortOrder: 'desc',
      limit: 20,
      offset: 0,
    });
  });

  it('parses every valid explicit value', () => {
    const params = new URLSearchParams('sortBy=status&sortOrder=asc&limit=50&offset=100');
    expect(parseBookingTableUrlState(params)).toEqual({ sortBy: 'status', sortOrder: 'asc', limit: 50, offset: 100 });
  });

  it('falls back to the default sortBy for an unwhitelisted value', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('sortBy=createdAt')).sortBy).toBe('scheduledAt');
    expect(parseBookingTableUrlState(new URLSearchParams('sortBy=customer')).sortBy).toBe('scheduledAt');
  });

  it('falls back to the default sortOrder for an invalid value', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('sortOrder=up')).sortOrder).toBe('desc');
  });

  it('falls back to the default limit for an unsupported value', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('limit=17')).limit).toBe(20);
    expect(parseBookingTableUrlState(new URLSearchParams('limit=abc')).limit).toBe(20);
  });

  it('accepts every supported page size, including the default (20)', () => {
    for (const limit of [10, 20, 25, 50, 100]) {
      expect(parseBookingTableUrlState(new URLSearchParams(`limit=${limit}`)).limit).toBe(limit);
    }
  });

  it('falls back to offset 0 for a negative or non-numeric offset', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('offset=-5')).offset).toBe(0);
    expect(parseBookingTableUrlState(new URLSearchParams('offset=abc')).offset).toBe(0);
  });

  it('never names the offset parameter "cursor"', () => {
    // Documents the spec §4.6/§8 requirement directly: a URL using `cursor`
    // instead of `offset` must NOT be treated as carrying pagination state.
    expect(parseBookingTableUrlState(new URLSearchParams('cursor=25')).offset).toBe(0);
  });
});

describe('serializeBookingTableUrlState', () => {
  it('round-trips every valid state through parseBookingTableUrlState', () => {
    const state = { sortBy: 'status' as const, sortOrder: 'asc' as const, limit: 50 as const, offset: 100 };
    expect(parseBookingTableUrlState(serializeBookingTableUrlState(state))).toEqual(state);
  });

  it('produces a URL using "offset", never "cursor"', () => {
    const params = serializeBookingTableUrlState({ sortBy: 'scheduledAt', sortOrder: 'desc', limit: 20, offset: 40 });
    expect(params.has('offset')).toBe(true);
    expect(params.has('cursor')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- use-booking-table-url-state`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/lib/use-booking-table-url-state.ts`:

```ts
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type BookingSortKey = 'scheduledAt' | 'status';
export type BookingPageSize = 10 | 20 | 25 | 50 | 100;

export interface BookingTableUrlState {
  sortBy: BookingSortKey;
  sortOrder: 'asc' | 'desc';
  limit: BookingPageSize;
  offset: number;
}

const DEFAULT_STATE: BookingTableUrlState = { sortBy: 'scheduledAt', sortOrder: 'desc', limit: 20, offset: 0 };
const SORT_KEYS: readonly BookingSortKey[] = ['scheduledAt', 'status'];
const LIMITS: readonly BookingPageSize[] = [10, 20, 25, 50, 100];

// Pure: no next/navigation dependency, independently unit-testable.
// Every branch MUST fall back to DEFAULT_STATE's corresponding field for
// any missing, malformed, or out-of-whitelist value — never forwards an
// unvalidated value to a caller that will use it in a GraphQL variable.
export function parseBookingTableUrlState(searchParams: URLSearchParams): BookingTableUrlState {
  const sortByRaw = searchParams.get('sortBy');
  const sortBy = SORT_KEYS.includes(sortByRaw as BookingSortKey) ? (sortByRaw as BookingSortKey) : DEFAULT_STATE.sortBy;

  const sortOrderRaw = searchParams.get('sortOrder');
  const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : DEFAULT_STATE.sortOrder;

  const limitRaw = Number(searchParams.get('limit'));
  const limit = LIMITS.includes(limitRaw as BookingPageSize) ? (limitRaw as BookingPageSize) : DEFAULT_STATE.limit;

  const offsetRaw = Number(searchParams.get('offset'));
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : DEFAULT_STATE.offset;

  return { sortBy, sortOrder, limit, offset };
}

// Named "offset", never "cursor" (spec §3/§4.6/§8) — the value is a literal
// offset, not an opaque token. Every field is always written explicitly
// (not omitted at default values) for deterministic, easily-testable URLs.
export function serializeBookingTableUrlState(state: BookingTableUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('sortBy', state.sortBy);
  params.set('sortOrder', state.sortOrder);
  params.set('limit', String(state.limit));
  params.set('offset', String(state.offset));
  return params;
}

type BookingTableUrlStateUpdate = BookingTableUrlState | ((current: BookingTableUrlState) => BookingTableUrlState);

export function useBookingTableUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = parseBookingTableUrlState(searchParams);

  // Accepts a value or an updater function so rapid, back-to-back calls
  // (e.g. fast Next clicks) each compute from the state the previous call
  // just wrote, not from a `state` closure captured once per render.
  const setState = useCallback(
    (update: BookingTableUrlStateUpdate) => {
      const current = parseBookingTableUrlState(new URLSearchParams(window.location.search));
      const next = typeof update === 'function' ? update(current) : update;
      router.replace(`${pathname}?${serializeBookingTableUrlState(next).toString()}`);
    },
    [router, pathname],
  );

  return { state, setState };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- use-booking-table-url-state`
Expected: PASS.

- [ ] **Step 5: Verify build/lint**

Run: `pnpm --filter web build && pnpm --filter web lint`
Expected: both succeed (the hook itself is unused until Task 11 wires it up — confirm no "unused export" lint failure; if the lint config flags this, it will resolve once Task 11 imports it, so a transient warning here is acceptable only if Task 11 lands in the same PR, which it does per this plan's sequencing).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/use-booking-table-url-state.ts apps/web/lib/use-booking-table-url-state.test.ts
git commit -m "feat(65): add pure Bookings table URL-state parse/serialize + hook"
```

---

### Task 11: `apps/web` Bookings page — wire URL state, GraphQL variables, and navigation pagination

**Files:**
- Modify: `apps/web/app/app/bookings/page.tsx:1-33` (imports), `:65-72` (state/query), `:163-176` (`<BookingDataTable>` call)

**Interfaces:**
- Consumes: `useBookingTableUrlState` (Task 10); `BookingDataTable`'s `sort`/`onSortChange`/`refreshing`/navigation-shaped `pagination` (Tasks 7, 9); `@clensy/client`'s `BookingSortFields`/`SortDirection` string-literal types (`'createdAt' | 'id' | 'scheduledAt' | 'status'`, `'ASC' | 'DESC'` — confirmed in `packages/client/src/generated/graphql.ts`).

There is no automated test covering `page.tsx` itself (`apps/web/vitest.config.ts`'s `include` does not reach `app/**` — unchanged by this plan, per the reusable-data-table spec's own deferral of that infrastructure question). This task's verification is typecheck/lint/build plus Task 12's manual golden path.

- [ ] **Step 1: Replace local page/pageSize state with URL state**

In `apps/web/app/app/bookings/page.tsx`, add the import (after line 33):

```ts
import { useBookingTableUrlState } from '../../../lib/use-booking-table-url-state';
```

Replace lines 67-72:

```ts
  const { state: tableState, setState: setTableState } = useBookingTableUrlState();
  const sortingVariable = [
    { field: tableState.sortBy, direction: tableState.sortOrder === 'asc' ? 'ASC' : 'DESC' },
    { field: 'id', direction: 'ASC' }, // deterministic tie-breaker (spec §4.6, §8) — required whenever the
                                        // primary key (e.g. status) is non-unique, not only for the default sort.
  ] as const;
  const { data, loading, previousData, error, refetch } = useBookingsQuery({
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    variables: {
      paging: { limit: tableState.limit, offset: tableState.offset },
      sorting: sortingVariable,
    },
  });
```

(`previousData` and `notifyOnNetworkStatusChange: true` are Apollo's standard mechanism for keeping stale rows visible during a background refetch — confirm this is available on the generated `useBookingsQuery` hook's return type; if `previousData` is not exposed, fall back to manually tracking the last non-empty `data` in a `useRef`/`useState` pair. Either mechanism satisfies the spec's normative requirement (§4.6) that rows don't disappear during a pending request — the exact mechanism is a planning/M6 detail, not a spec requirement.)

- [ ] **Step 2: Derive `refreshing` and the row source**

Immediately before the `rows` computation (originally line ~146):

```ts
  const effectiveData = data ?? previousData;
  const rows: Booking[] = effectiveData?.bookings.nodes ?? [];
  // M5 round-1 correction: keyed off effectiveData (the actual displayed
  // dataset), not strictly previousData — the UI invariant is "something
  // is currently on screen while a request is pending," which holds
  // whenever effectiveData exists, whether it came from `data` (e.g. a
  // fast-resolving refetch that already landed) or `previousData`.
  const refreshing = loading && Boolean(effectiveData);
  const initialLoading = loading && !effectiveData;
```

- [ ] **Step 3: Wire the navigation-shaped `pagination` prop and `sort`/`onSortChange`**

Replace the `<BookingDataTable>` call (lines 163-176):

```tsx
        <BookingDataTable
          bookings={rows}
          formatPrice={formatMinorUnits}
          loading={initialLoading}
          refreshing={refreshing}
          hasError={Boolean(error)}
          onRowClick={(booking) => openDetail(booking.id)}
          sort={{ key: tableState.sortBy, direction: tableState.sortOrder }}
          onSortChange={(next) =>
            setTableState((current) => ({
              ...current,
              // Sort-cycling-to-none resolution (spec §4.6, Post-Accept
              // correction): DataTable.sort is single-valued, so cycling
              // ANY sortable column back to its unsorted state resolves to
              // the table's one canonical default (scheduledAt desc), not
              // to "no sort" — nestjs-query always needs a deterministic
              // order, and this table had no sort UI (hence this exact
              // default) before #65 existed.
              sortBy: next?.key ?? 'scheduledAt',
              sortOrder: next?.direction ?? 'desc',
              offset: 0, // reset rule (spec §4.6, §8): sort change always resets offset
            }))
          }
          pagination={{
            mode: 'navigation',
            pageSize: tableState.limit,
            totalCount: effectiveData?.bookings.totalCount,
            hasNextPage: effectiveData?.bookings.pageInfo.hasNextPage ?? false,
            hasPreviousPage: effectiveData?.bookings.pageInfo.hasPreviousPage ?? false,
            onNext: () => setTableState((current) => ({ ...current, offset: current.offset + current.limit })),
            onPrevious: () =>
              setTableState((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) })),
            pageSizeOptions: [10, 20, 25, 50, 100],
            onPageSizeChange: (limit) =>
              setTableState((current) => ({ ...current, limit: limit as BookingTableUrlState['limit'], offset: 0 })), // reset rule: limit change resets offset
          }}
        />
```

- [ ] **Step 4: Verify `web` typechecks, lints, and builds**

Run: `pnpm --filter web build && pnpm --filter web lint`
Expected: both succeed. Pay particular attention to: `sortingVariable`'s literal-typed array matching `BookingSort[]`'s exact shape (`{ field: BookingSortFields; direction: SortDirection }`); `pagination`'s object matching `DataTableNavigationPaginationProps` exactly (all required fields present, `mode: 'navigation'` not `'cursor'`); `BookingTableUrlState` imported where referenced in the `onPageSizeChange` cast.

- [ ] **Step 5: Run the `web` test suite**

Run: `pnpm --filter web test`
Expected: PASS — Task 10's new tests plus every pre-existing `web` test, unchanged (this task does not touch any tested `lib/**`/`i18n/**` file beyond adding the one new import).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/app/bookings/page.tsx
git commit -m "feat(65): wire Bookings page URL state, sorting, and navigation pagination into BookingDataTable"
```

---

### Task 12: Full verification sweep

**Files:** None (verification only).

**Interfaces:** N/A.

- [ ] **Step 1: Run every affected package's full build/lint/test**

```bash
pnpm --filter @clensy/ui build
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui test
pnpm --filter @clensy/web build
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web test
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test
pnpm --filter api test -- bookings
```

Expected: all succeed.

- [ ] **Step 2: Grep-verifiable acceptance gates (spec §9)**

```bash
grep -n "PagingStrategies" apps/api/src/modules/bookings/presentation/graphql/booking-read.resolver.ts apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts
grep -rn "row.status}" packages/web/src/bookings/booking-data-table.tsx
grep -rn "StatusBadge" apps/web/app/app/jobs/page.tsx apps/web/app/app/billing/page.tsx apps/web/app/app/admin/page.tsx apps/web/app/app/catalog/page.tsx apps/web/app/app/catalog/add-ons/page.tsx apps/web/app/app/laundry/page.tsx
grep -rn "'Badge'" apps/web
grep -rn "cursor" packages/ui/src/base/pagination.tsx packages/ui/src/base/data-table.tsx apps/web/lib/use-booking-table-url-state.ts apps/web/app/app/bookings/page.tsx packages/web/src/bookings/booking-data-table.tsx
```

Expected: (1) both files still show `PagingStrategies.OFFSET` — unchanged; (2) no match — no raw status interpolation remains; (3) all six `StatusBadge` call sites unchanged (still present, still `StatusBadge`, not `Badge`); (4) no `apps/web` file imports `Badge` other than transitively through `@clensy/web` (confirm no direct `'@clensy/ui'` `Badge` import inside `apps/web/app/**`); (5) the fifth command's only matches should be the deliberate "never `cursor`"-documenting test cases and comments (`use-booking-table-url-state.test.ts`'s `cursor=25` literal and its explanatory comments) — no match inside any of the five production `.ts`/`.tsx` files themselves (`pagination.tsx`, `data-table.tsx`, `use-booking-table-url-state.ts`'s own implementation code, `page.tsx`, `booking-data-table.tsx`).

- [ ] **Step 3: Manual golden path**

Start the app (`pnpm --filter web dev`, or this repository's `run` skill if available) and verify in a browser at `/app/bookings`:

- Sorting: click "Scheduled" — cycles none→asc→desc→none, rows reorder correctly each time, URL updates (`sortBy=scheduledAt&sortOrder=asc` etc.), `aria-sort` on the header matches (inspect via devtools accessibility tree or view-source). Repeat for "Status" — confirm that cycling Status back to `none` returns the table to `scheduledAt desc` order (and the URL reflects `sortBy=scheduledAt&sortOrder=desc`), per the spec's sort-cycling-to-default resolution — the Status header's own `aria-sort` correctly reads `none` at that point.
- Row limit: change the page-size selector (10/20/25/50/100, with 20 as the pre-selected default) — URL's `limit` updates, `offset` resets to `0`, rows re-fetch at the new size.
- Pagination: click Next — URL's `offset` advances by `limit`, rows update, Previous becomes enabled; click Previous back to the start — Previous becomes disabled again; Next is disabled when `hasNextPage` is false (last page). Click Next rapidly several times in a row and confirm the offset advances correctly each time (no dropped/duplicated increments) — the functional `setState` update this plan uses is specifically meant to prevent that.
- URL reproducibility: copy the URL after sorting/paginating, open it in a new tab (or hard-refresh) — table state matches exactly. Use browser back/forward after a few sort/page changes — state restores correctly at each step.
- Invalid URL values: manually edit the URL to `?sortBy=nonsense&limit=999&offset=-5` and load it — table falls back to defaults, does not error, does not send the raw values to GraphQL (confirm via network tab).
- Non-blocking loading: trigger a sort/page change and observe — existing rows stay visible with a thin progress indicator below the header, not a full-table spinner flash.
- Status badges: each booking status renders as a `Badge` with the correct variant/color and a translated label, not the raw enum string.
- Mobile: narrow the viewport (or use devtools device emulation) — the table is replaced by a card list showing a booking reference, customer, date, status, property, service, and price; sorting and limit controls remain reachable and usable.
- Empty/error: temporarily force zero results or a query failure — the empty/error states render correctly and existing `hasError`/`errorMessage` behavior (#63) is unregressed.
- Regression spot-check: visit `/app/customers`, `/app/cleaners`, `/app/catalog`, `/app/jobs`, `/app/laundry`, `/app/billing`, `/app/admin`, `/app/catalog/add-ons`, `/app/cleaners/teams` — confirm each renders and behaves identically to before this plan (no sorting/mobile/refreshing UI appears on any of them, since none passes the new props).

- [ ] **Step 4: Commit (only if Step 2/3 surfaced follow-up fixes)**

```bash
git status
```

Expected: clean working tree beyond what Tasks 1-11 already committed, unless Steps 2-3 required a fix — in which case make the minimal fix, re-run the relevant task's tests, and commit separately with a `fix(65): ...` message.

- [ ] **Step 5: Stop for manual review — do not proceed further**

This plan's scope ends here. Do not push any branch, open or update a pull request, merge anything, or make any further code change beyond what Steps 1-4 verified. Report the verification results (Step 1's build/lint/test output, Step 2's grep results, Step 3's manual test outcomes) and the final `git log`/`git status` to the requester, then wait for explicit review and approval before any PR or push activity begins.
