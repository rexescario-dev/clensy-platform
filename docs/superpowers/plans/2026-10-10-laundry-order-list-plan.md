# Laundry Order List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-10 |
| Tracking issue | [#163](https://github.com/rexescario-dev/clensy-platform/issues/163). Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#157](https://github.com/rexescario-dev/clensy-platform/issues/157) (closed, merged in #168 at `8cdd6b1`). Row cutover is [#161](https://github.com/rexescario-dev/clensy-platform/issues/161). |
| Scope | `apps/web` (laundry list page, two new `lib` modules, tests), `packages/web` (new `LaundryOrderDataTable`, `list` copy, exports), `packages/client` (`$filter` on the `LaundryOrders` operation, regenerated client), and one new `apps/api/test` e2e characterization file. No API source, schema, migration, or `@clensy/ui` change. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10 (merged in #167 at `7c59b82`). The governing text is §8.4.4, first bullet: "`/app/laundry` is the list: server-side filter on customer name, status, and fulfillment type; sort on the existing `LaundryOrderSortFields`; human-readable status and fulfillment labels; `formatMinorUnits` for money; kilograms rendered from integer grams; offset page size 20; a row opens `/app/laundry/[id]`." Also §4.9 (status-badge tones, still Accepted) and §4.4 (intake roles). |
| Relies on (Accepted) | [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157, Accepted and merged): `LAUNDRY_STATUS_TONE`, `LAUNDRY_ORDER_STATUSES`, `formatWeightGrams`, `canReceiveLaundryOrder`, and the `laundry` message catalog. [Paginated nestjs-query GraphQL collections](../specs/2026-08-28-paginated-graphql-collections-design.md): root connection with `totalCount`, max 100. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, copy keys, URL parameter names, and task order are planning decisions, not product semantics. |
| Edit anchors | New files are given in full. Edits to existing files are given as unified diffs against branch base `8cdd6b1` (`main`). Apply each by the quoted code, not by line number. |

**Goal:** Turn `/app/laundry` into the operations list that §8.4.4 describes. Staff can search customers on the server, filter by status and fulfillment, sort on the allowed fields, read human labels and the shared money and weight formats, and use a card list on a phone. The create button shows only for intake roles. Until the order page exists, a row keeps opening the drawer (see Cutover).

**Architecture:**

- **Where it lives.** The table component (columns, mobile card, toolbar) goes in `@clensy/web` next to the #157 laundry helpers, following the `BookingDataTable` precedent: presentational, props-driven, copy from the `laundry` namespace. URL state and GraphQL variables go in `apps/web/lib`, following `use-booking-table-url-state.ts`. Variables are typed with `@clensy/client` types, which `@clensy/web` must not import.
- **URL state (Task 4).** Keys: `q`, `status`, `fulfillment`, `sortBy`, `sortOrder`, `offset`. Every value is validated on parse, and anything unknown falls back to the default. Serializing keeps params the list does not own, so the drawer's `detail` survives a debounced search that lands after a row click. Any search, filter or sort change resets `offset` to 0. Page size is fixed at 20, with no page-size selector (the issue keeps `pageSize` 20).
- **Server filter (Task 5).** Search is `customer.fullName.iLike '%text%'`, with `%`, `_` and `\` escaped. A full UUID adds `id.eq` under `or`. Status and fulfillment are `eq`. Sort is the primary field, then `id ASC`, except when the primary field is `id`.
- **Page (Task 6).** The page owns the 300 ms debounce. Its input shows every keystroke, and the URL follows after a pause. Rows stay on screen while a new page loads, using the bookings `data ?? previousData` pattern. `DataTable` keeps rows on a background error. The drawer, the create form, and their code are unchanged.

## Spike result: partial order-id search (issue §Search and filters)

The issue asks for one spike of partial `id.iLike` on the Postgres `uuid` column. It was run at planning time against the local database (`clensy-platform-postgres-1`) and over GraphQL.

- SQL: `SELECT count(*) FROM laundry_order_entity WHERE id ILIKE '%1%'` fails with `ERROR: operator does not exist: uuid ~~* unknown`. `@ptc-org/nestjs-query-typeorm` 9.5.0 maps `iLike` to a plain `ILIKE` (`sql-comparison.builder.js`), so the GraphQL filter produces the same SQL.
- GraphQL: `laundryOrders(filter: { id: { iLike: "%3f2a9c1e%" } })` returns `errors`. This is pinned by Task 1.
- Also: `WHERE id = 'not-a-uuid'` fails with `invalid input syntax for type uuid`, so `id.eq` must only be sent for a full UUID.

**Decision (as the issue directs):** ship customer-name search plus exact-id match for a full UUID. No partial id search, and no migration or cast. The PR body MUST say so.

## Cutover (issue §Cutover)

#156 (order page) and #161 (cutover) are open. This PR merges first, so a row keeps opening the existing drawer (`openDetail(row.id)`), and `?detail=` keeps working with no redirect. The §8.4.4 criterion "a row opens `/app/laundry/[id]`" is met at #161, not here. The PR body MUST state: "Rows still open the drawer until the end-to-end issue (#161) switches them to `/app/laundry/[id]`." Create success also still opens the drawer. That flow belongs to #160.

## Global Constraints

Derived from the Accepted spec, the amendment and the issue. Every task's requirements implicitly include this section.

- Filtering, sorting and paging happen on the server, through `laundryOrders(filter, sorting, paging)`. There is no client-side slice of fetched rows.
- Sort is offered only on `LaundryOrderSortFields` (`createdAt`, `status`, `fulfillmentType`, `customerId`, `id`). Weight and total are never sortable. Default is `createdAt DESC`, and `id ASC` is the tie-breaker whenever the primary sort is not `id`.
- No new backend field is requested. The list selection stays the `LaundryOrderRow` fragment. Only the `$filter` variable is added.
- Labels: status through `t('status.<ENUM>')` and fulfillment through `t('fulfillment.<ENUM>')`. Money uses `formatMinorUnits`. Weight uses `formatWeightGrams`, with `—` for `null`. Badge tones come from `LAUNDRY_STATUS_TONE` (§4.9). Status is never shown by color alone.
- The create button shows only when `canReceiveLaundryOrder(role)` (INTAKE: TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT). ANALYST, FINANCE, SUPER_ADMIN and a still-loading role do not see it. The server stays authoritative.
- `DataTable` provides row activation (click, Enter, Space) on both rows and mobile cards. The mobile card adds no link, button, or second click handler.
- Do not modify `@clensy/ui`, `apps/api/src`, `apps/api/src/schema.gql`, or any migration. Add no dependency. `@clensy/web` does not import `@clensy/client`.
- The drawer, the intake form, and their helpers in `page.tsx` are unchanged. Only the list block, its imports, and the now-unused `OrderRow` type and `formatDate` helper change.

## Review Focus (decisions M5 should confirm or return)

1. **Customer column sort uses `customerId`.** §8.4.4 says "sort on the existing `LaundryOrderSortFields`", and the issue lists `customerId` among them. `customerId` is the only customer sort the server offers, so the Customer column's sort button sorts by `customerId`. That groups each customer's orders together, but it is **not alphabetical by name**. If M5 prefers no sort on Customer over a non-alphabetical one, drop `sortable` and `sortKey` from that column and the test's `toHaveLength(5)` becomes `4`. Nothing else changes.
2. **The Created sort cycle.** `DataTable` cycles asc → desc → none, and "none" resolves to the default `createdAt desc` (the bookings rule). Bookings' default column can never reach asc that way. `resolveLaundrySort` sends `createdAt desc` + "none" to `createdAt asc` instead, so Created toggles. This is presentation only.
3. **Clear control placement.** `DataTable.emptyMessage` is a string, and `@clensy/ui` is out of bounds. So "Clear search and filters" is a toolbar button, shown whenever a search or filter is active, not only when the result is empty. The empty message switches to "No laundry orders match these filters." when filters are active.
4. **Exact id.** The full id is visible in `title` and screen-reader text, not as the visible label. The visible label is the first 8 characters, monospace. Matching is case-insensitive (`toLowerCase()` before `eq`).
5. **No mobile sort control.** The issue requires mobile cards, not mobile sort. Below `sm`, the table headers are hidden. The URL sort still applies, and the default is newest first. A mobile sort select like bookings' is deferred.
6. **Status option order.** The status filter lists `LAUNDRY_ORDER_STATUSES` (enum-alphabetical, the #157 export). Sorting by status on the server follows the Postgres enum declaration order, which is lifecycle order (`RECEIVED`, `WEIGHED`, …, `REFUNDED`), not label order. Task 1 pins that.
7. **Issue wording note.** The issue says "There is no current `mobileRow` usage in `apps/web`". `BookingDataTable` (in `@clensy/web`, rendered by `apps/web`) already passes `mobileRow`. This plan follows its card shape and the issue's classes. This list is the first laundry consumer.

## Pre-validation (full)

Every task below was applied to the branch at `8cdd6b1`, then removed before this Draft was committed. All commands named in an `Expected:` line were run, with these results:

| Command | Result |
| --- | --- |
| `pnpm --filter api exec jest --config ./test/jest-e2e.json laundry-order-list-filters laundry.e2e-spec` | 8 passed (6 new + 2 existing) |
| `pnpm --filter api exec eslint test/laundry-order-list-filters.e2e-spec.ts` | clean |
| `pnpm --filter @clensy/client codegen` then `pnpm --filter @clensy/client build` / `test` / `lint` | additive types only; build clean; 10 passed; lint clean |
| `pnpm --filter @clensy/web test` / `build` / `lint` | 385 passed; clean; clean |
| `pnpm --filter web test` / `lint`, `pnpm --filter web exec tsc --noEmit -p .`, `pnpm --filter web build` | 621 passed; clean; clean; Next build succeeded |
| Mutation checks (Final verification) | each mutation failed its test; restored → 27 passed |

Environment note: on this machine `pnpm --filter @clensy/client build` and `test` first failed on unchanged `main` too, because `vitest` was not linked in `packages/client` (`TS2307: Cannot find module 'vitest'` in `session-signal.test.ts`). `pnpm install --frozen-lockfile --offline` linked it ("Lockfile is up to date"), and both then passed. If M6 sees the same error, run that install first. It changes no tracked file.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/test/laundry-order-list-filters.e2e-spec.ts` | Create (characterization) | 1 |
| `packages/client/src/operations/laundry.graphql` | Modify: `$filter` on `LaundryOrders` | 2 |
| `packages/client/src/generated/graphql.ts` | Regenerate (codegen output only) | 2 |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify: add `list` | 3 |
| `packages/web/src/laundry/laundry-order-data-table.tsx` / `.test.tsx` | Create | 3 |
| `packages/web/src/index.ts` | Modify: exports | 3 |
| `apps/web/lib/use-laundry-order-list-url-state.ts` / `.test.ts` | Create | 4 |
| `apps/web/lib/laundry-order-list-query.ts` / `.test.ts` | Create | 5 |
| `apps/web/lib/laundry-page-baseline.test.tsx` → `apps/web/lib/laundry-list-page.test.tsx` | Rename and rewrite (`git mv`) | 6 |
| `apps/web/app/app/laundry/page.tsx` | Modify: list block only | 6 |

---

### Task 1: Characterize the server filter and sort surface (issue §Search and filters, §Tests; spec §8.4.4)

**Characterization test.** It pins existing, already-correct API behavior that the list depends on, and it passes on first run. It also records the spike. No API code changes.

**Files:**
- Create: `apps/api/test/laundry-order-list-filters.e2e-spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedOwner } from './helpers/seed-owner';

// Characterization (#163): pins the existing `laundryOrders` filter and
// sort capabilities the redesigned list relies on. No API code changes in
// #163. Every assertion is scoped by a per-run name tag, because the
// bootstrap tenant is shared across suites and runs.
describe('laundryOrders list filters (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let tag: string;
  const ids: Record<'anaDelivery' | 'anaPickup' | 'benPickup', string> = {
    anaDelivery: '',
    anaPickup: '',
    benPickup: '',
  };

  const ORDERS = `query($f: LaundryOrderFilter, $s: [LaundryOrderSort!]) {
    laundryOrders(filter: $f, sorting: $s, paging: { limit: 50 }) {
      totalCount
      nodes { id status fulfillmentType customer { fullName } }
    }
  }`;

  function gql(query: string, variables?: object) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function nodeIds(
    filter: object,
    sorting?: object[],
  ): Promise<string[]> {
    const res = await gql(ORDERS, { f: filter, s: sorting });
    expect(res.body.errors).toBeUndefined();
    return res.body.data.laundryOrders.nodes.map((n: { id: string }) => n.id);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    const owner = await seedOwner(
      moduleFixture.get<Repository<AdminUserEntity>>(
        getRepositoryToken(AdminUserEntity),
      ),
    );
    const login = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation L($i: LoginInput!) { login(loginInput: $i) { success } }`,
        variables: { i: { email: owner.email, password: owner.password } },
      });
    cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
    tag = `${owner.id.slice(0, 8)}${Date.now()}`;

    async function customer(name: string): Promise<string> {
      const res = await gql(
        `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
        {
          i: {
            email: `${name.replace(/ /g, '-')}-${tag}@example.com`,
            fullName: `${name} ${tag}`,
            phone: '555-1',
          },
        },
      );
      return res.body.data.createCustomer.id;
    }
    async function receive(
      customerId: string,
      fulfillmentType: string,
    ): Promise<string> {
      const res = await gql(
        `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
        { i: { customerId, fulfillmentType } },
      );
      return res.body.data.receiveLaundryOrder.id;
    }

    const ana = await customer('Ana Reyes');
    const ben = await customer('Ben Cruz');
    ids.anaPickup = await receive(ana, 'PICKUP');
    ids.anaDelivery = await receive(ana, 'DELIVERY');
    ids.benPickup = await receive(ben, 'PICKUP');
    await gql(
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ id } }`,
      { i: { orderId: ids.anaDelivery, weightGrams: 1200 } },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches customer.fullName case-insensitively through the customer relation', async () => {
    const found = await nodeIds({
      customer: { fullName: { iLike: `%ana reyes ${tag}%` } },
    });
    expect(found.sort()).toEqual([ids.anaDelivery, ids.anaPickup].sort());
  });

  it('combines the name filter with an exact id match under or', async () => {
    const found = await nodeIds({
      or: [
        { customer: { fullName: { iLike: `%nobody ${tag}%` } } },
        { id: { eq: ids.benPickup } },
      ],
    });
    expect(found).toEqual([ids.benPickup]);
    // `or` is ANDed with a sibling filter.
    const pickups = await nodeIds({
      or: [
        { customer: { fullName: { iLike: `%ana reyes ${tag}%` } } },
        { id: { eq: ids.benPickup } },
      ],
      fulfillmentType: { eq: 'PICKUP' },
    });
    expect(pickups.sort()).toEqual([ids.anaPickup, ids.benPickup].sort());
  });

  it('ANDs status and fulfillmentType with the search clause', async () => {
    const name = { customer: { fullName: { iLike: `%${tag}%` } } };
    expect(await nodeIds({ ...name, status: { eq: 'WEIGHED' } })).toEqual([
      ids.anaDelivery,
    ]);
    expect(
      (await nodeIds({ ...name, fulfillmentType: { eq: 'PICKUP' } })).sort(),
    ).toEqual([ids.anaPickup, ids.benPickup].sort());
  });

  it('sorts by every LaundryOrderSortFields member with the id tie-breaker', async () => {
    const name = { customer: { fullName: { iLike: `%${tag}%` } } };
    for (const field of [
      'createdAt',
      'status',
      'fulfillmentType',
      'customerId',
      'id',
    ]) {
      const res = await gql(ORDERS, {
        f: name,
        s: [
          { direction: 'DESC', field },
          { direction: 'ASC', field: 'id' },
        ],
      });
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.laundryOrders.totalCount).toBe(3);
    }
    // Postgres orders an enum by declaration order (PICKUP, DELIVERY;
    // RECEIVED before WEIGHED), not by label. The id tie-breaker orders
    // the two equal PICKUP / RECEIVED rows.
    const pickups = [ids.anaPickup, ids.benPickup].sort();
    for (const field of ['fulfillmentType', 'status']) {
      expect(
        await nodeIds(name, [
          { direction: 'ASC', field },
          { direction: 'ASC', field: 'id' },
        ]),
      ).toEqual([...pickups, ids.anaDelivery]);
    }
  });

  it('treats an escaped % in the search text literally', async () => {
    expect(
      await nodeIds({ customer: { fullName: { iLike: `%${tag}\\%%` } } }),
    ).toEqual([]);
  });

  // The #163 spike: partial id search is not available on the uuid column.
  it('rejects a partial iLike on the uuid id', async () => {
    const res = await gql(ORDERS, {
      f: { id: { iLike: `%${ids.benPickup.slice(0, 8)}%` } },
    });
    expect(res.body.errors).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter api exec jest --config ./test/jest-e2e.json laundry-order-list-filters laundry.e2e-spec`
Expected: `Tests: 8 passed, 8 total`. Needs the local Postgres the other e2e suites use.

- [ ] **Step 3: Negative check (the escape assertion bites)**

In the "treats an escaped % … literally" test, temporarily change `` `%${tag}\\%%` `` to `` `%${tag}%%` `` (unescaped). Run the same command. Expected: that test fails, because three rows now match. Revert.

- [ ] **Step 4: Lint and commit**

Run: `pnpm --filter api exec eslint test/laundry-order-list-filters.e2e-spec.ts` — Expected: no output.

```bash
git add apps/api/test/laundry-order-list-filters.e2e-spec.ts
git commit -m "test(api): characterize the laundryOrders filters the order list uses (#163)"
```

---

### Task 2: Add `$filter` to the `LaundryOrders` operation (spec §8.4.4: server-side filter)

**Files:**
- Modify: `packages/client/src/operations/laundry.graphql`
- Regenerate: `packages/client/src/generated/graphql.ts`

- [ ] **Step 1: Edit the operation**

```diff
diff --git a/packages/client/src/operations/laundry.graphql b/packages/client/src/operations/laundry.graphql
--- a/packages/client/src/operations/laundry.graphql
+++ b/packages/client/src/operations/laundry.graphql
@@ -35,8 +35,12 @@ fragment LaundryOrderDetail on LaundryOrder {
   }
 }
 
-query LaundryOrders($paging: OffsetPaging, $sorting: [LaundryOrderSort!]) {
-  laundryOrders(paging: $paging, sorting: $sorting) {
+query LaundryOrders(
+  $paging: OffsetPaging
+  $filter: LaundryOrderFilter
+  $sorting: [LaundryOrderSort!]
+) {
+  laundryOrders(paging: $paging, filter: $filter, sorting: $sorting) {
     totalCount
     pageInfo {
       hasNextPage
```

- [ ] **Step 2: Regenerate and check that the output is additive**

Run: `pnpm --filter @clensy/client codegen`, then `git diff --stat packages/client/src/generated/graphql.ts`.
Expected: one file, about `59 +++++-` lines. The diff adds `LaundryFulfillmentTypeFilterComparison`, `LaundryOrderFilter`, `LaundryOrderFilterCustomerFilter`, `LaundryOrderStatusFilterComparison`, and `filter?: LaundryOrderFilter | null | undefined` on `LaundryOrdersQueryVariables`, plus the updated document string. No existing type changes. If anything else changes, the local `apps/api/src/schema.gql` is out of date. Stop and report it. Do not commit unrelated regeneration.

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @clensy/client build` and `pnpm --filter @clensy/client lint` — Expected: both clean (see the Pre-validation environment note).

```bash
git add packages/client/src/operations/laundry.graphql packages/client/src/generated/graphql.ts
git commit -m "feat(client): accept a filter on the laundryOrders list query (#163)"
```

---

### Task 3: `LaundryOrderDataTable` and list copy (spec §8.4.4, §4.9; issue §Columns, §Mobile, §States, §Accessibility)

**Files:**
- Create: `packages/web/src/laundry/laundry-order-data-table.test.tsx`
- Create: `packages/web/src/laundry/laundry-order-data-table.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Modify: `packages/web/src/index.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LaundryOrderDataTable,
  type LaundryOrderDataTableProps,
  type LaundryOrderRow,
} from './laundry-order-data-table';

const order: LaundryOrderRow = {
  id: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
  createdAt: '2026-10-01T09:00:00.000Z',
  customer: { id: 'c1', fullName: 'Ana Reyes' },
  fulfillmentType: 'DELIVERY',
  status: 'AWAITING_PAYMENT',
  totalMinorUnits: 45000,
  weightGrams: 2500,
};

const noop = () => {};

// The mobile card list is the `sm:hidden` block DataTable renders after
// the desktop table.
function mobileMarkup(html: string): string {
  const start = html.indexOf('<div class="sm:hidden flex flex-col gap-2">');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start);
}

function render(overrides: Partial<LaundryOrderDataTableProps> = {}): string {
  return renderToStaticMarkup(
    <LaundryOrderDataTable
      filters={{ fulfillment: null, search: '', status: null }}
      filtersActive={false}
      formatPrice={(minorUnits) => `₱${(minorUnits / 100).toFixed(2)}`}
      onClearFilters={noop}
      onFulfillmentChange={noop}
      onRowClick={noop}
      onSearchChange={noop}
      onSortChange={noop}
      onStatusChange={noop}
      orders={[order]}
      pagination={{ onPageChange: noop, page: 1, pageSize: 20, totalCount: 1 }}
      sort={{ direction: 'desc', key: 'createdAt' }}
      {...overrides}
    />,
  );
}

describe('LaundryOrderDataTable', () => {
  it('renders the human status and fulfillment, formatted weight and total, and a short order id', () => {
    const html = render();
    expect(html).toContain('Ana Reyes');
    expect(html).toContain('Awaiting payment');
    expect(html).not.toContain('>AWAITING_PAYMENT<');
    expect(html).toContain('Delivery');
    expect(html).toContain('2.50 kg');
    expect(html).toContain('₱450.00');
    expect(html).toContain('<span aria-hidden="true">3f2a9c1e</span>');
    expect(html).toContain(`title="${order.id}"`);
    expect(html).toContain(`<span class="sr-only">${order.id}</span>`);
  });

  it('renders an em dash for an unweighed, unpriced order', () => {
    const html = render({ orders: [{ ...order, status: 'RECEIVED', totalMinorUnits: null, weightGrams: null }] });
    expect(html).toContain('Received');
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(4); // weight + total, desktop + mobile
  });

  it('offers sort only on LaundryOrderSortFields columns, never weight or total', () => {
    const html = render();
    const sortable = html.match(/aria-sort="[a-z]+"/g) ?? [];
    expect(sortable).toHaveLength(5);
    expect(html).toContain('aria-sort="descending"'); // createdAt desc
    expect(html).toMatch(/<th[^>]*>Weight<\/th>/);
    expect(html).toMatch(/<th[^>]*>Total<\/th>/);
  });

  it('labels the search field and both filters, with All plus human options', () => {
    const html = render();
    expect(html).toContain('for="laundry-order-search">Search by customer or order id</label>');
    expect(html).toContain('id="laundry-order-search"');
    expect(html).toContain('for="laundry-order-status-filter">Status</label>');
    expect(html).toContain('id="laundry-order-status-filter"');
    expect(html).toContain('for="laundry-order-fulfillment-filter">Fulfillment</label>');
    expect(html).toContain('id="laundry-order-fulfillment-filter"');
    expect(html).toContain('<option value="AWAITING_PICKUP">Awaiting pickup</option>');
    expect(html).toContain('<option value="PICKUP">Customer pickup</option>');
    // A controlled select marks its current option `selected` in static markup.
    expect(html.match(/<option value="" selected="">All<\/option>/g)).toHaveLength(2);
  });

  it('reflects the current filter values in the controls', () => {
    const html = render({ filters: { fulfillment: 'PICKUP', search: 'ana', status: 'READY' }, filtersActive: true });
    expect(html).toContain('value="ana"');
    expect(html).toContain('<option value="READY" selected="">Ready</option>');
    expect(html).toContain('<option value="PICKUP" selected="">Customer pickup</option>');
  });

  it('shows the plain empty copy without filters, and the filtered copy plus a clear control with them', () => {
    const plain = render({ orders: [] });
    expect(plain).toContain('No laundry orders.');
    expect(plain).not.toContain('Clear search and filters');

    const filtered = render({ filtersActive: true, orders: [] });
    expect(filtered).toContain('No laundry orders match these filters.');
    expect(filtered).not.toContain('No laundry orders.');
    expect(filtered).toContain('Clear search and filters');
  });

  it('shows the list error copy', () => {
    expect(render({ hasError: true, orders: [] })).toContain('Unable to load laundry orders.');
  });

  it('renders a mobile card with the customer, status, fulfillment, weight, total and no nested control', () => {
    const mobile = mobileMarkup(render());
    expect(mobile).toContain('rounded-md border border-slate-200 p-3');
    expect(mobile).toContain('<span class="min-w-0 break-words font-medium text-slate-900">Ana Reyes</span>');
    expect(mobile).toContain('Awaiting payment');
    expect(mobile).toContain('Delivery');
    expect(mobile).toContain('Weight: 2.50 kg');
    expect(mobile).toContain('Total: ₱450.00');
    // The card wrapper is DataTable's row hit target; the card adds none.
    const card = mobile.slice(mobile.indexOf('role="button"'), mobile.indexOf('border-t px-3 py-2'));
    expect(card.match(/role="button"/g)).toHaveLength(1);
    expect(card).not.toContain('<a ');
    expect(card).not.toContain('<button');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-data-table.test.tsx`
Expected: FAIL, because `./laundry-order-data-table` cannot be resolved.

- [ ] **Step 3: Add the copy**

```diff
diff --git a/packages/web/src/i18n/messages/en/laundry.ts b/packages/web/src/i18n/messages/en/laundry.ts
--- a/packages/web/src/i18n/messages/en/laundry.ts
+++ b/packages/web/src/i18n/messages/en/laundry.ts
@@ -60,6 +60,27 @@ export const laundry = {
     UNPAID: 'Unpaid',
     VOID: 'Void',
   },
+  list: {
+    columns: {
+      created: 'Created',
+      customer: 'Customer',
+      fulfillment: 'Fulfillment',
+      order: 'Order',
+      status: 'Status',
+      total: 'Total',
+      weight: 'Weight',
+    },
+    create: '+ New Laundry Order',
+    emptyFiltered: 'No laundry orders match these filters.',
+    filters: {
+      all: 'All',
+      clear: 'Clear search and filters',
+      fulfillment: 'Fulfillment',
+      status: 'Status',
+    },
+    search: 'Search by customer or order id',
+    title: 'Laundry',
+  },
   noActions: 'No further actions for this order.',
   paymentTerms: {
     PAY_NOW: 'Pay now',
```

- [ ] **Step 4: Write the component**

```tsx
'use client';

import type { ChangeEvent } from 'react';
import {
  Button,
  DataTable,
  Input,
  Label,
  StatusBadge,
  type DataTableColumn,
  type DataTablePaginationProps,
} from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { formatWeightGrams } from './format-weight-grams';
import {
  LAUNDRY_ORDER_STATUSES,
  LAUNDRY_STATUS_TONE,
  type LaundryFulfillmentType,
  type LaundryOrderStatus,
} from './laundry-order-status';

// The `LaundryOrderSortFields` members (lifecycle spec §8.4.4). Weight and
// total are not sortable on the server, so they are not offered.
export type LaundryOrderSortKey = 'createdAt' | 'customerId' | 'fulfillmentType' | 'id' | 'status';

export interface LaundryOrderSortState {
  direction: 'asc' | 'desc';
  key: LaundryOrderSortKey;
}

export interface LaundryOrderRow {
  id: string;
  createdAt: unknown;
  customer: { id: string; fullName: string };
  fulfillmentType: LaundryFulfillmentType;
  status: LaundryOrderStatus;
  totalMinorUnits: number | null;
  weightGrams: number | null;
  [key: string]: unknown;
}

export interface LaundryOrderListFilters {
  fulfillment: LaundryFulfillmentType | null;
  search: string;
  status: LaundryOrderStatus | null;
}

export interface LaundryOrderDataTableProps {
  filters: LaundryOrderListFilters;
  filtersActive: boolean;
  formatPrice: (minorUnits: number) => string;
  hasError?: boolean;
  loading?: boolean;
  onClearFilters: () => void;
  onFulfillmentChange: (fulfillment: LaundryFulfillmentType | null) => void;
  onRowClick?: (order: LaundryOrderRow) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: LaundryOrderSortState | null) => void;
  onStatusChange: (status: LaundryOrderStatus | null) => void;
  orders: LaundryOrderRow[];
  pagination: DataTablePaginationProps;
  refreshing?: boolean;
  sort: LaundryOrderSortState;
}

const FULFILLMENT_TYPES: readonly LaundryFulfillmentType[] = ['PICKUP', 'DELIVERY'];

// The existing laundry form select style (`@clensy/ui` has no Select).
const SELECT_CLASS =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

const SHORT_ID_LENGTH = 8;

export function LaundryOrderDataTable({
  filters,
  filtersActive,
  formatPrice,
  hasError,
  loading,
  onClearFilters,
  onFulfillmentChange,
  onRowClick,
  onSearchChange,
  onSortChange,
  onStatusChange,
  orders,
  pagination,
  refreshing,
  sort,
}: LaundryOrderDataTableProps) {
  const t = useClensyTranslations('laundry');

  const statusBadge = (status: LaundryOrderStatus) => (
    <StatusBadge label={t(`status.${status}`)} tone={LAUNDRY_STATUS_TONE[status]} />
  );
  const weight = (grams: number | null) => (grams === null ? '—' : formatWeightGrams(grams));
  const total = (minorUnits: number | null) => (minorUnits === null ? '—' : formatPrice(minorUnits));

  const columns: DataTableColumn<LaundryOrderRow>[] = [
    { header: t('list.columns.customer'), key: 'customer', render: 'customer.fullName', sortable: true, sortKey: 'customerId' },
    { header: t('list.columns.order'), key: 'id', render: (row) => <OrderId id={row.id} />, sortable: true, sortKey: 'id' },
    {
      header: t('list.columns.fulfillment'),
      key: 'fulfillmentType',
      render: (row) => t(`fulfillment.${row.fulfillmentType}`),
      sortable: true,
      sortKey: 'fulfillmentType',
    },
    { header: t('list.columns.status'), key: 'status', render: (row) => statusBadge(row.status), sortable: true, sortKey: 'status' },
    { header: t('list.columns.weight'), key: 'weight', render: (row) => weight(row.weightGrams) },
    { header: t('list.columns.total'), key: 'total', render: (row) => total(row.totalMinorUnits) },
    {
      header: t('list.columns.created'),
      key: 'createdAt',
      render: (row) => formatCreatedAt(row.createdAt),
      sortable: true,
      sortKey: 'createdAt',
    },
  ];

  // Content only: `DataTable` wraps each card in the row hit target
  // (click, Enter, Space), so nothing here is a link or a button.
  function renderMobileRow(row: LaundryOrderRow) {
    return (
      <div className="flex min-w-0 flex-col gap-1 rounded-md border border-slate-200 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 break-words font-medium text-slate-900">{row.customer.fullName}</span>
          {statusBadge(row.status)}
        </div>
        <div className="text-sm text-slate-600">
          {t(`fulfillment.${row.fulfillmentType}`)} · <OrderId id={row.id} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>
            {t('list.columns.weight')}: {weight(row.weightGrams)}
          </span>
          <span>
            {t('list.columns.total')}: {total(row.totalMinorUnits)}
          </span>
          <span>{formatCreatedAt(row.createdAt)}</span>
        </div>
      </div>
    );
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.currentTarget.value;
    onStatusChange(value === '' ? null : (value as LaundryOrderStatus));
  }

  function handleFulfillmentChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.currentTarget.value;
    onFulfillmentChange(value === '' ? null : (value as LaundryFulfillmentType));
  }

  const toolbar = (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-col gap-1 sm:w-72">
        <Label htmlFor="laundry-order-search">{t('list.search')}</Label>
        <Input
          id="laundry-order-search"
          type="search"
          value={filters.search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="laundry-order-status-filter">{t('list.filters.status')}</Label>
        <select
          id="laundry-order-status-filter"
          value={filters.status ?? ''}
          onChange={handleStatusChange}
          className={SELECT_CLASS}
        >
          <option value="">{t('list.filters.all')}</option>
          {LAUNDRY_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="laundry-order-fulfillment-filter">{t('list.filters.fulfillment')}</Label>
        <select
          id="laundry-order-fulfillment-filter"
          value={filters.fulfillment ?? ''}
          onChange={handleFulfillmentChange}
          className={SELECT_CLASS}
        >
          <option value="">{t('list.filters.all')}</option>
          {FULFILLMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`fulfillment.${type}`)}
            </option>
          ))}
        </select>
      </div>
      {filtersActive ? (
        <Button type="button" variant="outline" onClick={onClearFilters}>
          {t('list.filters.clear')}
        </Button>
      ) : null}
    </div>
  );

  return (
    <DataTable
      columns={columns}
      rows={orders}
      rowKey={(row) => row.id}
      emptyMessage={filtersActive ? t('list.emptyFiltered') : t('empty')}
      loading={loading}
      error={hasError ? t('error.list') : undefined}
      onRowClick={onRowClick}
      pagination={pagination}
      sort={sort}
      // DataTable reports a `key` only from this component's own column
      // `sortKey` values, all of which are `LaundryOrderSortKey` members.
      onSortChange={(next) => onSortChange(next as LaundryOrderSortState | null)}
      refreshing={refreshing}
      mobileRow={renderMobileRow}
      toolbar={toolbar}
    />
  );
}

// Same rendering as the previous list's Created column and the bookings
// table's `formatScheduledAt`. No date library.
function formatCreatedAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

// A short id is the visible label. The full id stays in `title` and in
// screen-reader text, so it is reachable for exact-id search.
function OrderId({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs" title={id}>
      <span aria-hidden="true">{id.slice(0, SHORT_ID_LENGTH)}</span>
      <span className="sr-only">{id}</span>
    </span>
  );
}
```

- [ ] **Step 5: Export it**

```diff
diff --git a/packages/web/src/index.ts b/packages/web/src/index.ts
--- a/packages/web/src/index.ts
+++ b/packages/web/src/index.ts
@@ -36,3 +36,11 @@ export { LaundryOrderProgress } from './laundry/laundry-order-progress';
 export type { LaundryOrderProgressProps } from './laundry/laundry-order-progress';
 export { laundryProgressSteps } from './laundry/laundry-progress-steps';
 export type { LaundryProgressState, LaundryProgressStep } from './laundry/laundry-progress-steps';
+export { LaundryOrderDataTable } from './laundry/laundry-order-data-table';
+export type {
+  LaundryOrderDataTableProps,
+  LaundryOrderListFilters,
+  LaundryOrderRow,
+  LaundryOrderSortKey,
+  LaundryOrderSortState,
+} from './laundry/laundry-order-data-table';
```

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-data-table.test.tsx` — Expected: `Tests 8 passed (8)`.
Run: `pnpm --filter @clensy/web test`, `pnpm --filter @clensy/web build`, `pnpm --filter @clensy/web lint` — Expected: all pass (385 tests at pre-validation), with no lint output. The managed lint enforces `number | null` member order and the module-private function order (`formatCreatedAt` before `OrderId`, `mobileMarkup` before `render` in the test).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/laundry/laundry-order-data-table.tsx packages/web/src/laundry/laundry-order-data-table.test.tsx packages/web/src/i18n/messages/en/laundry.ts packages/web/src/index.ts
git commit -m "feat(web): add the laundry order list table with filters and mobile cards (#163)"
```

---

### Task 4: List URL state (issue §Search and filters: URL, offset reset; §Tests: URL-state helper)

**Files:**
- Create: `apps/web/lib/use-laundry-order-list-url-state.test.ts`
- Create: `apps/web/lib/use-laundry-order-list-url-state.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAUNDRY_ORDER_LIST_STATE,
  hasActiveLaundryFilters,
  laundryListFiltersCleared,
  parseLaundryOrderListState,
  resolveLaundrySort,
  serializeLaundryOrderListState,
  withLaundryFilterChange,
  withLaundryPage,
  type LaundryOrderListState,
} from './use-laundry-order-list-url-state';

const onPage3: LaundryOrderListState = { ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, offset: 40 };

describe('parseLaundryOrderListState', () => {
  it('defaults to createdAt desc, offset 0 and no search or filters', () => {
    expect(parseLaundryOrderListState(new URLSearchParams())).toEqual({
      fulfillment: null,
      offset: 0,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: null,
    });
  });

  it('reads every list key', () => {
    const params = new URLSearchParams('q=Ana&status=READY&fulfillment=PICKUP&sortBy=status&sortOrder=asc&offset=20');
    expect(parseLaundryOrderListState(params)).toEqual({
      fulfillment: 'PICKUP',
      offset: 20,
      search: 'Ana',
      sortBy: 'status',
      sortOrder: 'asc',
      status: 'READY',
    });
  });

  it('falls back to the default for malformed or unknown values', () => {
    const params = new URLSearchParams(
      'status=SHIPPED&fulfillment=COURIER&sortBy=weightGrams&sortOrder=up&offset=-20',
    );
    expect(parseLaundryOrderListState(params)).toEqual(DEFAULT_LAUNDRY_ORDER_LIST_STATE);
    expect(parseLaundryOrderListState(new URLSearchParams('offset=2.5')).offset).toBe(0);
    expect(parseLaundryOrderListState(new URLSearchParams('sortBy=totalMinorUnits')).sortBy).toBe('createdAt');
  });

  it('trims the search and caps it at 200 characters', () => {
    expect(parseLaundryOrderListState(new URLSearchParams('q=%20%20ana%20')).search).toBe('ana');
    expect(parseLaundryOrderListState(new URLSearchParams(`q=${'a'.repeat(250)}`)).search).toHaveLength(200);
  });
});

describe('serializeLaundryOrderListState', () => {
  it('writes sort and offset always, and search and filters only when set', () => {
    expect(serializeLaundryOrderListState(DEFAULT_LAUNDRY_ORDER_LIST_STATE).toString()).toBe(
      'sortBy=createdAt&sortOrder=desc&offset=0',
    );
    const state: LaundryOrderListState = {
      fulfillment: 'DELIVERY',
      offset: 20,
      search: 'Ana Reyes',
      sortBy: 'status',
      sortOrder: 'asc',
      status: 'PAID',
    };
    expect(parseLaundryOrderListState(serializeLaundryOrderListState(state))).toEqual(state);
  });

  it('keeps params it does not own, such as the drawer detail param, and replaces its own', () => {
    const base = new URLSearchParams('detail=o1&q=old&status=READY&offset=40');
    const params = serializeLaundryOrderListState(laundryListFiltersCleared(parseLaundryOrderListState(base)), base);
    expect(params.get('detail')).toBe('o1');
    expect(params.has('q')).toBe(false);
    expect(params.has('status')).toBe(false);
    expect(params.get('offset')).toBe('0');
  });
});

describe('withLaundryFilterChange', () => {
  it('resets the offset when the search, a filter or the sort changes', () => {
    expect(withLaundryFilterChange(onPage3, { search: 'ana' })).toMatchObject({ offset: 0, search: 'ana' });
    expect(withLaundryFilterChange(onPage3, { status: 'READY' })).toMatchObject({ offset: 0, status: 'READY' });
    expect(withLaundryFilterChange(onPage3, { fulfillment: 'PICKUP' })).toMatchObject({ fulfillment: 'PICKUP', offset: 0 });
    expect(withLaundryFilterChange(onPage3, { sortBy: 'status', sortOrder: 'asc' })).toMatchObject({
      offset: 0,
      sortBy: 'status',
      sortOrder: 'asc',
    });
    expect(withLaundryFilterChange(onPage3, { sortOrder: 'asc' })).toMatchObject({ offset: 0, sortOrder: 'asc' });
  });

  it('returns the same state when nothing changes, including whitespace-only search edits', () => {
    const searching = { ...onPage3, search: 'ana' };
    expect(withLaundryFilterChange(searching, { search: ' ana  ' })).toBe(searching);
    expect(withLaundryFilterChange(onPage3, { status: null })).toBe(onPage3);
  });
});

describe('withLaundryPage', () => {
  it('maps the 1-based page to an offset of 20 per page', () => {
    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 1).offset).toBe(0);
    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 3).offset).toBe(40);
  });
});

describe('laundryListFiltersCleared and hasActiveLaundryFilters', () => {
  it('clears search and both filters, keeps the sort, and returns to page 1', () => {
    const state: LaundryOrderListState = {
      fulfillment: 'PICKUP',
      offset: 40,
      search: 'ana',
      sortBy: 'status',
      sortOrder: 'asc',
      status: 'READY',
    };
    expect(hasActiveLaundryFilters(state)).toBe(true);
    const cleared = laundryListFiltersCleared(state);
    expect(cleared).toEqual({ fulfillment: null, offset: 0, search: '', sortBy: 'status', sortOrder: 'asc', status: null });
    expect(hasActiveLaundryFilters(cleared)).toBe(false);
  });

  it('does not treat a sort as a filter', () => {
    expect(hasActiveLaundryFilters({ ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, sortBy: 'status' })).toBe(false);
  });
});

describe('resolveLaundrySort', () => {
  it('uses the column sort DataTable reports', () => {
    expect(resolveLaundrySort(DEFAULT_LAUNDRY_ORDER_LIST_STATE, { direction: 'asc', key: 'status' })).toEqual({
      sortBy: 'status',
      sortOrder: 'asc',
    });
  });

  it('turns "no sort" into the createdAt desc default', () => {
    const statusDesc = { ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, sortBy: 'status' as const };
    expect(resolveLaundrySort(statusDesc, null)).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('lets Created reach ascending even though desc is the default', () => {
    expect(resolveLaundrySort(DEFAULT_LAUNDRY_ORDER_LIST_STATE, null)).toEqual({ sortBy: 'createdAt', sortOrder: 'asc' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter web exec vitest run lib/use-laundry-order-list-url-state.test.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 3: Write the module**

```ts
'use client';
import {
  LAUNDRY_ORDER_STATUSES,
  type LaundryFulfillmentType,
  type LaundryOrderSortKey,
  type LaundryOrderSortState,
  type LaundryOrderStatus,
} from '@clensy/web';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

// `/app/laundry` list state, kept in the URL so a refresh, or back from an
// order, restores it (lifecycle spec §8.4.4). The drawer's `detail` param
// is not one of these keys and is carried through untouched.
export interface LaundryOrderListState {
  fulfillment: LaundryFulfillmentType | null;
  offset: number;
  search: string;
  sortBy: LaundryOrderSortKey;
  sortOrder: 'asc' | 'desc';
  status: LaundryOrderStatus | null;
}

export type LaundryOrderListFilterChange = Partial<
  Pick<LaundryOrderListState, 'fulfillment' | 'search' | 'sortBy' | 'sortOrder' | 'status'>
>;

export const LAUNDRY_ORDER_PAGE_SIZE = 20;
export const LAUNDRY_SEARCH_DEBOUNCE_MS = 300;
export const LAUNDRY_SEARCH_MAX_LENGTH = 200;

export const DEFAULT_LAUNDRY_ORDER_LIST_STATE: Readonly<LaundryOrderListState> = {
  fulfillment: null,
  offset: 0,
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  status: null,
};

const PARAM = {
  fulfillment: 'fulfillment',
  offset: 'offset',
  search: 'q',
  sortBy: 'sortBy',
  sortOrder: 'sortOrder',
  status: 'status',
} as const;

const SORT_KEYS: readonly LaundryOrderSortKey[] = ['createdAt', 'customerId', 'fulfillmentType', 'id', 'status'];
const FULFILLMENT_TYPES: readonly LaundryFulfillmentType[] = ['DELIVERY', 'PICKUP'];

// Search, status or fulfillment narrows the list. Sort does not.
export function hasActiveLaundryFilters(state: LaundryOrderListState): boolean {
  return state.search !== '' || state.status !== null || state.fulfillment !== null;
}

// Clears search and both filters, keeps the sort, and returns to page 1.
export function laundryListFiltersCleared(state: LaundryOrderListState): LaundryOrderListState {
  return { ...state, fulfillment: null, offset: 0, search: '', status: null };
}

// Pure. Every missing, malformed or unknown value falls back to the
// default, so nothing unvalidated reaches a GraphQL variable.
export function parseLaundryOrderListState(params: URLSearchParams): LaundryOrderListState {
  const sortByRaw = params.get(PARAM.sortBy);
  const sortOrderRaw = params.get(PARAM.sortOrder);
  const statusRaw = params.get(PARAM.status);
  const fulfillmentRaw = params.get(PARAM.fulfillment);
  const offsetRaw = Number(params.get(PARAM.offset));

  return {
    fulfillment: FULFILLMENT_TYPES.includes(fulfillmentRaw as LaundryFulfillmentType)
      ? (fulfillmentRaw as LaundryFulfillmentType)
      : null,
    offset: Number.isSafeInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : DEFAULT_LAUNDRY_ORDER_LIST_STATE.offset,
    search: normalizeLaundrySearch(params.get(PARAM.search) ?? ''),
    sortBy: SORT_KEYS.includes(sortByRaw as LaundryOrderSortKey)
      ? (sortByRaw as LaundryOrderSortKey)
      : DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortBy,
    sortOrder: sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortOrder,
    status: LAUNDRY_ORDER_STATUSES.includes(statusRaw as LaundryOrderStatus) ? (statusRaw as LaundryOrderStatus) : null,
  };
}

// `DataTable` cycles a column asc → desc → none. "None" means the default
// sort, `createdAt` desc. Created is already desc by default, so its next
// step goes to asc instead of back to the same default.
export function resolveLaundrySort(
  current: LaundryOrderListState,
  next: LaundryOrderSortState | null,
): Pick<LaundryOrderListState, 'sortBy' | 'sortOrder'> {
  if (next) return { sortBy: next.key, sortOrder: next.direction };
  if (current.sortBy === 'createdAt' && current.sortOrder === 'desc') return { sortBy: 'createdAt', sortOrder: 'asc' };
  return { sortBy: DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortBy, sortOrder: DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortOrder };
}

// Writes the list keys onto a copy of `base`, so params this list does not
// own (the drawer's `detail`) survive. Search and filters are omitted when
// empty. Sort and offset are always written, as on the bookings list.
export function serializeLaundryOrderListState(
  state: LaundryOrderListState,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of Object.values(PARAM)) params.delete(key);
  if (state.search !== '') params.set(PARAM.search, state.search);
  if (state.status !== null) params.set(PARAM.status, state.status);
  if (state.fulfillment !== null) params.set(PARAM.fulfillment, state.fulfillment);
  params.set(PARAM.sortBy, state.sortBy);
  params.set(PARAM.sortOrder, state.sortOrder);
  params.set(PARAM.offset, String(state.offset));
  return params;
}

export function useLaundryOrderListUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = parseLaundryOrderListState(searchParams);

  // Reads the live URL, not the render's `state`, so back-to-back calls
  // (a debounced search landing just after a filter change) compose.
  const setState = useCallback(
    (update: (current: LaundryOrderListState) => LaundryOrderListState) => {
      const base = new URLSearchParams(window.location.search);
      const current = parseLaundryOrderListState(base);
      const next = update(current);
      if (next === current) return;
      router.replace(`${pathname}?${serializeLaundryOrderListState(next, base).toString()}`);
    },
    [router, pathname],
  );

  return { setState, state };
}

// Applies a search, filter or sort change. Any real change returns to page
// 1 (the bookings reset rule). No change returns `state` itself, so a
// keystroke that only adds trailing space does not reset the page.
export function withLaundryFilterChange(
  state: LaundryOrderListState,
  change: LaundryOrderListFilterChange,
): LaundryOrderListState {
  const next: LaundryOrderListState = {
    ...state,
    ...change,
    search: change.search === undefined ? state.search : normalizeLaundrySearch(change.search),
  };
  const changed =
    next.search !== state.search ||
    next.status !== state.status ||
    next.fulfillment !== state.fulfillment ||
    next.sortBy !== state.sortBy ||
    next.sortOrder !== state.sortOrder;
  return changed ? { ...next, offset: 0 } : state;
}

// Pagination is 1-based in `DataTable`, offset-based in the URL.
export function withLaundryPage(state: LaundryOrderListState, page: number): LaundryOrderListState {
  return { ...state, offset: Math.max(0, page - 1) * LAUNDRY_ORDER_PAGE_SIZE };
}

function normalizeLaundrySearch(text: string): string {
  return text.trim().slice(0, LAUNDRY_SEARCH_MAX_LENGTH);
}
```

- [ ] **Step 4: Run it to see it pass, then commit**

Run: `pnpm --filter web exec vitest run lib/use-laundry-order-list-url-state.test.ts` — Expected: `Tests 14 passed (14)`.

```bash
git add apps/web/lib/use-laundry-order-list-url-state.ts apps/web/lib/use-laundry-order-list-url-state.test.ts
git commit -m "feat(web): keep laundry list search, filters, sort and page in the URL (#163)"
```

---

### Task 5: Server query variables (issue §Search and filters; §Tests: `customer.fullName.iLike` pinned)

Depends on Task 2 (`LaundryOrderFilter` type) and Task 4 (state type).

**Files:**
- Create: `apps/web/lib/laundry-order-list-query.test.ts`
- Create: `apps/web/lib/laundry-order-list-query.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { escapeLikePattern, laundryOrdersQueryVariables } from './laundry-order-list-query';
import { DEFAULT_LAUNDRY_ORDER_LIST_STATE, type LaundryOrderListState } from './use-laundry-order-list-url-state';

const ORDER_ID = '3F2A9C1E-0B7D-4E55-9A10-6C2B8D4E7F01';

function variables(change: Partial<LaundryOrderListState>) {
  return laundryOrdersQueryVariables({ ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, ...change });
}

describe('laundryOrdersQueryVariables', () => {
  it('defaults to page 1 of 20, createdAt DESC then id ASC, and no filter', () => {
    expect(laundryOrdersQueryVariables(DEFAULT_LAUNDRY_ORDER_LIST_STATE)).toEqual({
      filter: undefined,
      paging: { limit: 20, offset: 0 },
      sorting: [
        { direction: 'DESC', field: 'createdAt' },
        { direction: 'ASC', field: 'id' },
      ],
    });
  });

  it('searches customer.fullName with a server iLike contains match', () => {
    expect(variables({ search: 'ana' }).filter).toEqual({ customer: { fullName: { iLike: '%ana%' } } });
  });

  it('also matches the exact order id when the search is a full UUID', () => {
    expect(variables({ search: ORDER_ID }).filter).toEqual({
      or: [
        { customer: { fullName: { iLike: `%${ORDER_ID}%` } } },
        { id: { eq: ORDER_ID.toLowerCase() } },
      ],
    });
  });

  it('never sends a partial id match', () => {
    expect(JSON.stringify(variables({ search: '3f2a9c1e' }).filter)).not.toContain('"id"');
  });

  it('filters status and fulfillment with eq, alongside the search', () => {
    expect(variables({ fulfillment: 'PICKUP', search: 'ana', status: 'READY' }).filter).toEqual({
      customer: { fullName: { iLike: '%ana%' } },
      fulfillmentType: { eq: 'PICKUP' },
      status: { eq: 'READY' },
    });
  });

  it('pages by offset and keeps id ASC as the tie-breaker for a non-unique sort', () => {
    expect(variables({ offset: 40, sortBy: 'status', sortOrder: 'asc' })).toMatchObject({
      paging: { limit: 20, offset: 40 },
      sorting: [
        { direction: 'ASC', field: 'status' },
        { direction: 'ASC', field: 'id' },
      ],
    });
  });

  it('does not repeat id when id is the primary sort', () => {
    expect(variables({ sortBy: 'id', sortOrder: 'desc' }).sorting).toEqual([{ direction: 'DESC', field: 'id' }]);
  });
});

describe('escapeLikePattern', () => {
  it('escapes the ILIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('50% off_now\\x')).toBe('50\\% off\\_now\\\\x');
    expect(variables({ search: '50%' }).filter).toEqual({ customer: { fullName: { iLike: '%50\\%%' } } });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter web exec vitest run lib/laundry-order-list-query.test.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 3: Write the module**

```ts
import type { LaundryOrderFilter, LaundryOrderSort, LaundryOrdersQueryVariables } from '@clensy/client';
import { LAUNDRY_ORDER_PAGE_SIZE, type LaundryOrderListState } from './use-laundry-order-list-url-state';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres `ILIKE` treats `%` and `_` as wildcards and `\` as the default
// escape, so a customer named "50% Off" is matched literally.
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// The server-side filter for the list (lifecycle spec §8.4.4). Customer
// name is a contains match on the `customer` relation. A full UUID also
// matches the order id exactly: partial `iLike` on the uuid column is
// rejected by Postgres (#163 spike), and `eq` with a non-UUID errors, so
// `id` is only added for a full UUID.
export function laundryOrderListFilter(state: LaundryOrderListState): LaundryOrderFilter | undefined {
  const filter: LaundryOrderFilter = {};
  if (state.search !== '') {
    const byName: LaundryOrderFilter = { customer: { fullName: { iLike: `%${escapeLikePattern(state.search)}%` } } };
    if (UUID.test(state.search)) {
      filter.or = [byName, { id: { eq: state.search.toLowerCase() } }];
    } else {
      Object.assign(filter, byName);
    }
  }
  if (state.status !== null) filter.status = { eq: state.status };
  if (state.fulfillment !== null) filter.fulfillmentType = { eq: state.fulfillment };
  return Object.keys(filter).length === 0 ? undefined : filter;
}

// Primary sort, then `id ASC` as the tie-breaker whenever the primary key
// is not already `id`.
export function laundryOrderListSorting(state: LaundryOrderListState): LaundryOrderSort[] {
  const primary: LaundryOrderSort = { direction: state.sortOrder === 'asc' ? 'ASC' : 'DESC', field: state.sortBy };
  return state.sortBy === 'id' ? [primary] : [primary, { direction: 'ASC', field: 'id' }];
}

export function laundryOrdersQueryVariables(state: LaundryOrderListState): LaundryOrdersQueryVariables {
  return {
    filter: laundryOrderListFilter(state),
    paging: { limit: LAUNDRY_ORDER_PAGE_SIZE, offset: state.offset },
    sorting: laundryOrderListSorting(state),
  };
}
```

- [ ] **Step 4: Run it to see it pass, then commit**

Run: `pnpm --filter web exec vitest run lib/laundry-order-list-query.test.ts` — Expected: `Tests 8 passed (8)`.

```bash
git add apps/web/lib/laundry-order-list-query.ts apps/web/lib/laundry-order-list-query.test.ts
git commit -m "feat(web): build the laundry list server filter and sort variables (#163)"
```

---

### Task 6: Wire the list page (spec §8.4.4; issue §Page structure, §States, Cutover, §Acceptance criteria)

**Files:**
- Rename and rewrite: `apps/web/lib/laundry-page-baseline.test.tsx` → `apps/web/lib/laundry-list-page.test.tsx`
- Modify: `apps/web/app/app/laundry/page.tsx`

The #157 baseline was a characterization of the old list ("It is not a target"). This task replaces its assertions with the redesigned behavior. The old ones (`AWAITING_PAYMENT`, `2.50 kg` from `toFixed(2)`) intentionally stop holding.

- [ ] **Step 1: Rename and write the failing test**

Run: `git mv apps/web/lib/laundry-page-baseline.test.tsx apps/web/lib/laundry-list-page.test.tsx`, then replace its content with:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The redesigned `/app/laundry` list (#163). Replaces the #157 baseline
// characterization, which pinned the raw enum labels and 2-decimal weight
// this issue removes.
const order = {
  id: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
  createdAt: '2026-10-01T09:00:00.000Z',
  customer: { id: 'c1', fullName: 'Ana Reyes' },
  fulfillmentType: 'DELIVERY',
  status: 'AWAITING_PAYMENT',
  totalMinorUnits: 45000,
  weightGrams: 2505,
};

const page = vi.hoisted(() => ({
  ordersQueryOptions: [] as unknown[],
  role: 'TENANT_OWNER' as string | undefined,
  search: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/laundry',
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(page.search),
}));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const query = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  return {
    useCancelLaundryOrderMutation: idle,
    useCompleteLaundryOrderMutation: idle,
    useCurrentAdminQuery: () => ({
      data: page.role === undefined ? undefined : { currentAdmin: { role: page.role } },
    }),
    useCustomersQuery: () => ({ data: { customers: { nodes: [] } } }),
    useGenerateInvoiceFromOrderMutation: idle,
    useInvoiceForOrderQuery: query,
    useLaundryOrderQuery: query,
    useLaundryOrdersQuery: (options: unknown) => {
      page.ordersQueryOptions.push(options);
      return {
        data: { laundryOrders: { nodes: [order], totalCount: 1 } },
        error: undefined,
        loading: false,
        previousData: undefined,
        refetch: vi.fn(),
      };
    },
    useMarkLaundryOrderAwaitingDeliveryMutation: idle,
    useMarkLaundryOrderAwaitingPaymentMutation: idle,
    useMarkLaundryOrderAwaitingPickupMutation: idle,
    useMarkLaundryOrderDamagedMutation: idle,
    useMarkLaundryOrderLostMutation: idle,
    useMarkLaundryOrderPaidMutation: idle,
    useMarkLaundryOrderReadyMutation: idle,
    usePriceLaundryOrderMutation: idle,
    useReceiveLaundryOrderMutation: idle,
    useRefundLaundryOrderMutation: idle,
    useRejectLaundryOrderMutation: idle,
    useServicesQuery: query,
    useStartLaundryProcessingMutation: idle,
    useWeighLaundryOrderMutation: idle,
  };
});

async function renderPage(): Promise<string> {
  const { default: LaundryPage } = await import('../app/app/laundry/page');
  return renderToStaticMarkup(<LaundryPage />);
}

beforeEach(() => {
  page.ordersQueryOptions = [];
  page.role = 'TENANT_OWNER';
  page.search = '';
});

describe('/app/laundry list', () => {
  it('shows human status and fulfillment labels and the shared weight and money formats', async () => {
    const html = await renderPage();
    expect(html).toContain('Ana Reyes');
    expect(html).toContain('Awaiting payment');
    expect(html).not.toContain('>AWAITING_PAYMENT<');
    expect(html).toContain('Delivery');
    expect(html).toContain('2.505 kg');
    expect(html).toContain('₱450.00');
  });

  it('queries page 1 of 20 by createdAt DESC, id ASC, with no filter by default', async () => {
    await renderPage();
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({
      variables: {
        filter: undefined,
        paging: { limit: 20, offset: 0 },
        sorting: [
          { direction: 'DESC', field: 'createdAt' },
          { direction: 'ASC', field: 'id' },
        ],
      },
    });
  });

  it('sends the URL search and filters to laundryOrders as a server filter', async () => {
    page.search = 'q=ana&status=READY&fulfillment=PICKUP&sortBy=status&sortOrder=asc&offset=20';
    const html = await renderPage();
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({
      variables: {
        filter: {
          customer: { fullName: { iLike: '%ana%' } },
          fulfillmentType: { eq: 'PICKUP' },
          status: { eq: 'READY' },
        },
        paging: { limit: 20, offset: 20 },
        sorting: [
          { direction: 'ASC', field: 'status' },
          { direction: 'ASC', field: 'id' },
        ],
      },
    });
    expect(html).toContain('value="ana"');
    expect(html).toContain('Clear search and filters');
    expect(html).toContain('Page 2 of 1'); // the page comes from the URL offset, not local state
  });

  it('shows the create button only to intake roles', async () => {
    for (const role of ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT']) {
      page.role = role;
      expect(await renderPage()).toContain('+ New Laundry Order');
    }
    for (const role of ['ANALYST', 'FINANCE', 'SUPER_ADMIN', undefined]) {
      page.role = role;
      expect(await renderPage()).not.toContain('+ New Laundry Order');
    }
  });

  it('keeps the drawer as the row target until the order page cutover', async () => {
    page.search = `detail=${order.id}`;
    const html = await renderPage();
    // The drawer for `?detail=` still mounts (its query is idle here).
    expect(html).toContain('Unable to load laundry order.');
  });
});
```

- [ ] **Step 2: Run it to see it fail against the current page**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx`
Expected: `Tests 4 failed | 1 passed (5)`. The current page renders `AWAITING_PAYMENT` and a `toFixed(2)` weight, sends no `filter` or `sorting`, and shows the create button to every role. The drawer test already passes, which is intended: it pins the retained drawer (verified at planning time against `8cdd6b1`'s page).

- [ ] **Step 3: Edit the page**

Apply this diff. It changes imports, removes the unused `OrderRow` type and `formatDate` helper, and replaces the list block. The drawer, `InvoiceSection`, the intake form, `STATUS_TONE`, `formatWeight`, and the transition mirror stay as they are, because #156, #160 and #161 own them.

```diff
diff --git a/apps/web/app/app/laundry/page.tsx b/apps/web/app/app/laundry/page.tsx
--- a/apps/web/app/app/laundry/page.tsx
+++ b/apps/web/app/app/laundry/page.tsx
@@ -31,7 +31,6 @@ import type {
 import {
   Button,
   ConfirmDialog,
-  DataTable,
   DetailDrawer,
   ErrorState,
   FormDialog,
@@ -39,22 +38,28 @@ import {
   PageHeader,
   StatusBadge,
 } from '@clensy/ui';
-import type { DataTableColumn, StatusTone } from '@clensy/ui';
+import type { StatusTone } from '@clensy/ui';
+import {
+  LaundryOrderDataTable,
+  canReceiveLaundryOrder,
+  useClensyTranslations,
+  type LaundryOrderRow,
+} from '@clensy/web';
 import Link from 'next/link';
-import { Suspense, useState } from 'react';
+import { Suspense, useEffect, useRef, useState } from 'react';
 import { formatMinorUnits } from '../../../lib/format-price';
+import { laundryOrdersQueryVariables } from '../../../lib/laundry-order-list-query';
 import { useDetailDrawer } from '../../../lib/use-detail-drawer';
-
-type OrderRow = {
-  id: string;
-  status: LaundryOrderStatus;
-  fulfillmentType: LaundryFulfillmentType;
-  weightGrams: number | null;
-  totalMinorUnits: number | null;
-  createdAt: unknown;
-  customer: { id: string; fullName: string };
-  [key: string]: unknown;
-};
+import {
+  LAUNDRY_ORDER_PAGE_SIZE,
+  LAUNDRY_SEARCH_DEBOUNCE_MS,
+  hasActiveLaundryFilters,
+  laundryListFiltersCleared,
+  resolveLaundrySort,
+  useLaundryOrderListUrlState,
+  withLaundryFilterChange,
+  withLaundryPage,
+} from '../../../lib/use-laundry-order-list-url-state';
 
 const STATUS_TONE: Record<LaundryOrderStatus, StatusTone> = {
   AWAITING_DELIVERY: 'warning',
@@ -135,11 +140,6 @@ const VERB_LABEL: Record<RefVerb, string> = {
   startProcessing: 'Start processing',
 };
 
-function formatDate(value: unknown): string {
-  const d = new Date(value as string);
-  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
-}
-
 function formatWeight(grams: number | null): string {
   return grams === null ? '—' : `${(grams / 1000).toFixed(2)} kg`;
 }
@@ -174,12 +174,36 @@ export default function LaundryPage() {
 }
 
 function LaundryPageContent() {
-  const [page, setPage] = useState(1);
-  const pageSize = 20;
+  const t = useClensyTranslations('laundry');
+  const { state: listState, setState: setListState } = useLaundryOrderListUrlState();
   const ordersQuery = useLaundryOrdersQuery({
     fetchPolicy: 'network-only',
-    variables: { paging: { limit: pageSize, offset: (page - 1) * pageSize } },
+    notifyOnNetworkStatusChange: true,
+    variables: laundryOrdersQueryVariables(listState),
   });
+  const { data: adminData } = useCurrentAdminQuery();
+  const canCreate = canReceiveLaundryOrder(adminData?.currentAdmin.role);
+
+  // The input shows every keystroke. The URL, and so the query, follows
+  // once typing pauses.
+  const [searchDraft, setSearchDraft] = useState(listState.search);
+  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
+  useEffect(() => () => clearTimeout(searchTimer.current), []);
+
+  function handleSearchChange(text: string) {
+    setSearchDraft(text);
+    clearTimeout(searchTimer.current);
+    searchTimer.current = setTimeout(
+      () => setListState((current) => withLaundryFilterChange(current, { search: text })),
+      LAUNDRY_SEARCH_DEBOUNCE_MS,
+    );
+  }
+
+  function handleClearFilters() {
+    clearTimeout(searchTimer.current);
+    setSearchDraft('');
+    setListState(laundryListFiltersCleared);
+  }
   const { data: customersData } = useCustomersQuery({
     fetchPolicy: 'network-only',
     variables: { paging: { limit: 100 } },
@@ -215,53 +239,51 @@ function LaundryPageContent() {
     }
   }
 
-  const columns: DataTableColumn<OrderRow>[] = [
-    { header: 'Customer', key: 'customer', render: (r) => r.customer.fullName },
-    { header: 'Fulfillment', key: 'fulfillment', render: (r) => r.fulfillmentType },
-    {
-      header: 'Status',
-      key: 'status',
-      render: (r) => (
-        <StatusBadge label={r.status} tone={STATUS_TONE[r.status]} />
-      ),
-    },
-    { header: 'Weight', key: 'weight', render: (r) => formatWeight(r.weightGrams) },
-    {
-      header: 'Total',
-      key: 'total',
-      render: (r) =>
-        r.totalMinorUnits === null ? '—' : formatMinorUnits(r.totalMinorUnits),
-    },
-    { header: 'Created', key: 'created', render: (r) => formatDate(r.createdAt) },
-  ];
-
-  const rows = (ordersQuery.data?.laundryOrders.nodes ?? []) as OrderRow[];
+  // Rows stay on screen while a new page, sort or filter loads, and after
+  // a background error (the bookings list pattern).
+  const effectiveData = ordersQuery.data ?? ordersQuery.previousData;
+  const rows: LaundryOrderRow[] = effectiveData?.laundryOrders.nodes ?? [];
   const customers = customersData?.customers.nodes ?? [];
 
   return (
     <div className="flex flex-col gap-8">
       <PageHeader
-        title="Laundry"
+        title={t('list.title')}
         actions={
-          <Button type="button" onClick={openCreateForm}>
-            + New Laundry Order
-          </Button>
+          canCreate ? (
+            <Button type="button" onClick={openCreateForm}>
+              {t('list.create')}
+            </Button>
+          ) : undefined
         }
       />
 
-      <DataTable
-        columns={columns}
-        rows={rows}
-        rowKey={(r) => r.id}
-        emptyMessage="No laundry orders."
-        loading={ordersQuery.loading}
-        error={ordersQuery.error ? 'Unable to load laundry orders.' : undefined}
-        onRowClick={(r) => openDetail(r.id)}
+      <LaundryOrderDataTable
+        orders={rows}
+        formatPrice={formatMinorUnits}
+        loading={ordersQuery.loading && !effectiveData}
+        refreshing={ordersQuery.loading && Boolean(effectiveData)}
+        hasError={Boolean(ordersQuery.error)}
+        // Until the order page cutover (#161), a row keeps opening the
+        // drawer, so weighing, pricing and lifecycle actions stay reachable.
+        onRowClick={(row) => openDetail(row.id)}
+        filters={{ fulfillment: listState.fulfillment, search: searchDraft, status: listState.status }}
+        filtersActive={hasActiveLaundryFilters(listState) || searchDraft.trim() !== ''}
+        onSearchChange={handleSearchChange}
+        onStatusChange={(status) => setListState((current) => withLaundryFilterChange(current, { status }))}
+        onFulfillmentChange={(fulfillment) =>
+          setListState((current) => withLaundryFilterChange(current, { fulfillment }))
+        }
+        onClearFilters={handleClearFilters}
+        sort={{ direction: listState.sortOrder, key: listState.sortBy }}
+        onSortChange={(next) =>
+          setListState((current) => withLaundryFilterChange(current, resolveLaundrySort(current, next)))
+        }
         pagination={{
-          onPageChange: setPage,
-          page,
-          pageSize,
-          totalCount: ordersQuery.data?.laundryOrders.totalCount ?? 0,
+          onPageChange: (page) => setListState((current) => withLaundryPage(current, page)),
+          page: listState.offset / LAUNDRY_ORDER_PAGE_SIZE + 1,
+          pageSize: LAUNDRY_ORDER_PAGE_SIZE,
+          totalCount: effectiveData?.laundryOrders.totalCount ?? 0,
         }}
       />
 
```

- [ ] **Step 4: Run it to see it pass, then run the app checks**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx` — Expected: `Tests 5 passed (5)`.
Run: `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit -p .`, `pnpm --filter web build` — Expected: all pass (621 tests at pre-validation), no lint or tsc output, and the Next build completes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/app/laundry/page.tsx apps/web/lib/laundry-list-page.test.tsx
git commit -m "feat(web): redesign the laundry order list with server search, filters and sort (#163)"
```

---

## Final verification (before the M6 handoff report)

- [ ] **Changed-file allowlist.** Run `git diff --name-status 8cdd6b1...HEAD -- . ':!docs'`. Expected: exactly the File Map entries: `A` for the seven new files, `M` for `page.tsx`, `laundry.graphql`, `graphql.ts`, `laundry.ts` and `index.ts`, and `R` for the baseline → list-page test. Any other path fails verification:

```bash
expected='apps/api/test/laundry-order-list-filters.e2e-spec.ts
apps/web/app/app/laundry/page.tsx
apps/web/lib/laundry-list-page.test.tsx
apps/web/lib/laundry-order-list-query.test.ts
apps/web/lib/laundry-order-list-query.ts
apps/web/lib/laundry-page-baseline.test.tsx
apps/web/lib/use-laundry-order-list-url-state.test.ts
apps/web/lib/use-laundry-order-list-url-state.ts
packages/client/src/generated/graphql.ts
packages/client/src/operations/laundry.graphql
packages/web/src/i18n/messages/en/laundry.ts
packages/web/src/index.ts
packages/web/src/laundry/laundry-order-data-table.test.tsx
packages/web/src/laundry/laundry-order-data-table.tsx'
actual=$(git diff --name-only --no-renames 8cdd6b1...HEAD -- . ':!docs' | sort)
if [ "$actual" = "$(printf '%s\n' "$expected" | sort)" ]; then echo "allowlist OK"; else echo "allowlist FAILED"; diff <(printf '%s\n' "$expected" | sort) <(printf '%s\n' "$actual"); false; fi
```

Expected: `allowlist OK`.

- [ ] **Mutation checks.** Apply each mutation, run the named test file, confirm it fails, then revert:
  1. `use-laundry-order-list-url-state.ts`: `return changed ? { ...next, offset: 0 } : state;` → `return changed ? next : state;`. Run `lib/use-laundry-order-list-url-state.test.ts`. Expected: 1 failed.
  2. `laundry-order-list-query.ts`: `if (UUID.test(state.search)) {` → `if (true) {`. Run `lib/laundry-order-list-query.test.ts`. Expected: 4 failed.
  3. `page.tsx`: `canCreate ? (` → `true ? (`. Run `lib/laundry-list-page.test.tsx`. Expected: 1 failed.

  After reverting, run all three files. Expected: `Tests 27 passed (27)`.
- [ ] **Full suites.** The Task 1 e2e command, `pnpm --filter @clensy/client build`, and `test`, `build` and `lint` for `@clensy/web` and `web` all pass.
- [ ] **Manual responsive check (recorded in the M6 report).** Run the app (`pnpm dev`, or the running `clensy-platform-web-1` container). At 375 px wide, `/app/laundry` shows cards with no horizontal page scroll, and the toolbar stacks. At ≥ 640 px it shows the table, and the toolbar is a row. Typing a customer name narrows the list after a pause. Choosing a status or fulfillment returns to page 1. Refresh restores the filters. A row opens the drawer, and closing it returns to the filtered list.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Server-side customer-name filter | §8.4.4; issue §Search and filters | 1, 2, 5, 6 |
| Status and fulfillment filters | §8.4.4 | 1, 3, 5, 6 |
| Sort on `LaundryOrderSortFields` only, `id ASC` tie-breaker, reset to page 1 | §8.4.4; issue §Columns | 1, 3, 4, 5 |
| Human status and fulfillment labels; §4.9 tones | §8.4.4, §4.9 | 3 |
| `formatMinorUnits`; kilograms from integer grams | §8.4.4 | 3, 6 |
| Offset page size 20, `totalCount` | §8.4.4; paginated-collections spec | 5, 6 |
| Row opens `/app/laundry/[id]` | §8.4.4 | **Deferred to #161** (Cutover); drawer retained, pinned in Task 6 |
| Create button only for intake roles | §4.4 (`receiveLaundryOrder` INTAKE); issue §Page structure | 6 |
| Filters in the URL; `detail` not reused | issue §Search and filters | 4 |
| Mobile cards, no horizontal overflow | issue §Mobile | 3; manual check |
| Loading, empty, filtered-empty, error states | issue §States | 3, 6 |
| Labelled search and native selects | issue §Accessibility | 3 |
| Exact-id search only, by spike | issue §Search and filters | Spike result; 1, 5 |

## Deferred (not in this plan)

- Row → `/app/laundry/[id]`, drawer removal, and the `?detail=` redirect (#161, after #156).
- The create modal contents and its success navigation (#160).
- A mobile sort control (Review Focus 5).
- Partial order-id search. It would need a schema-level change, which the issue rules out.
- Sorting by weight or total (not in `LaundryOrderSortFields`).

## Execution risks (operational only)

- The e2e suite needs the local Postgres with migrations applied. It writes rows into the shared bootstrap tenant. Assertions are scoped by a per-run tag, so repeated runs do not collide.
- `toLocaleString()` output depends on the runner's timezone and locale. No test asserts a date string.

## Gate outcomes

*(Appended after M5.)*
