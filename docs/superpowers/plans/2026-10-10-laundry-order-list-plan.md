# Laundry Order List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft (revision 1, for the second M5 pass) |
| M5 history | First pass (2026-10-10, owner, reviewed in five parts): **Returned for Revision** with P1 and P2 findings on Tasks 1–6. All are applied in this revision; see [M5 first-pass resolutions](#m5-first-pass-resolutions). The whole plan was pre-validated again. |
| Date | 2026-10-10 |
| Tracking issue | [#163](https://github.com/rexescario-dev/clensy-platform/issues/163). Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#157](https://github.com/rexescario-dev/clensy-platform/issues/157) (closed, merged in #168 at `8cdd6b1`). Row cutover is [#161](https://github.com/rexescario-dev/clensy-platform/issues/161). |
| Scope | `apps/web` (laundry list page, three new `lib` modules, an optional argument on `useDetailDrawer.open`, tests), `packages/web` (new `LaundryOrderDataTable`, a pure sort module, `list` copy, exports), `packages/client` (`$filter` on the `LaundryOrders` operation, regenerated client), and one new `apps/api/test` e2e characterization file. No API source, schema, migration, or `@clensy/ui` change. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10 (merged in #167 at `7c59b82`). The governing text is §8.4.4, first bullet: "`/app/laundry` is the list: server-side filter on customer name, status, and fulfillment type; sort on the existing `LaundryOrderSortFields`; human-readable status and fulfillment labels; `formatMinorUnits` for money; kilograms rendered from integer grams; offset page size 20; a row opens `/app/laundry/[id]`." Also §4.9 (status-badge tones, still Accepted) and §4.4 (intake roles). |
| Relies on (Accepted) | [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157, Accepted and merged): `LAUNDRY_STATUS_TONE`, `LAUNDRY_ORDER_STATUSES`, `formatWeightGrams`, `canReceiveLaundryOrder` (its role policy is tested there, in `laundry-order-actions.test.ts`), and the `laundry` message catalog. [Paginated nestjs-query GraphQL collections](../specs/2026-08-28-paginated-graphql-collections-design.md): root connection with `totalCount`, max 100. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, copy keys, URL parameter names, and task order are planning decisions, not product semantics. |
| Edit anchors | New files are given in full. Edits to existing files are given as unified diffs against branch base `8cdd6b1` (`main`). Apply each by the quoted code, not by line number. |

**Goal:** Turn `/app/laundry` into the operations list that §8.4.4 describes. Staff can search customers on the server, filter by status and fulfillment, sort on the allowed fields, read human labels and the shared money and weight formats, and use a card list on a phone. The create button shows only for intake roles. Until the order page exists, a row keeps opening the drawer (see Cutover).

**Architecture:**

- **Where it lives.** The table component (columns, mobile card, toolbar) and a pure sort module go in `@clensy/web` next to the #157 laundry helpers, following the `BookingDataTable` precedent: presentational, props-driven, copy from the `laundry` namespace. URL state, the search draft, and GraphQL variables go in `apps/web/lib`, following `use-booking-table-url-state.ts`. Variables are typed with `@clensy/client` types, which `@clensy/web` must not import.
- **Sort contract (Task 3).** The list owns its click transitions. `DataTable` only says which column was clicked, and `clickedLaundrySortKey` rejects any key or direction the list does not support. `nextLaundryOrderSort` applies this table:

  | Current sort | Click | Next |
  | --- | --- | --- |
  | anything else | column X | X asc |
  | X asc | X | X desc |
  | X desc, X ≠ Created | X | `null` (restore the default) |
  | Created desc (the default) | Created | Created asc |

  `null` means exactly one thing everywhere: restore `createdAt desc`. Created toggles asc ↔ desc, because "back to the default" from the default would be a click that does nothing. The header indicator (`aria-sort`) is rendered from the same state, so the indicator, the URL and the server sort cannot disagree. Task 6 pins that click by click.
- **URL state (Task 4).** Keys: `q`, `status`, `fulfillment`, `sortBy`, `sortOrder`, `offset`. Every value is validated on parse, and anything unknown falls back to the default. Serializing keeps params the list does not own, and the URL hash. Any search, filter or sort change resets `offset` to 0. A page that is not a positive safe integer means page 1. Page size is fixed at 20, with no page-size selector.
- **Composing updates (Task 4).** `router.replace` and `router.push` commit asynchronously, so `window.location` can lag. The hook keeps the URLs it has requested and not yet seen committed. Each update builds on the latest of them, so a debounced search that lands just after a filter change keeps both. A committed URL drops that entry and every earlier one. A commit of a URL the list never requested (an outside navigation) drops them all.
- **Search draft (Task 6).** `useLaundrySearchDraft` owns the 300 ms debounce. The input shows every keystroke; the URL follows after a pause. When the committed search changes from outside the box (clear, back/forward, a remount), the draft follows it, unless a keystroke is still waiting to commit.
- **Drawer open (Task 6).** A row click takes any waiting search out of the debounce and opens the drawer with one `push` that carries both the search and `detail`. `useDetailDrawer.open` gains an optional `base` params argument for that. No later `replace` can then drop `detail`.
- **Server filter (Task 5).** Search is `customer.fullName.iLike '%text%'`, with `%`, `_` and `\` escaped. Any canonical 8-4-4-4-12 hex UUID, of any version or variant and either case, adds `id.eq` under `or`. Status and fulfillment are `eq`. Sort is the primary field, then `id ASC`, except when the primary field is `id`. The API adds no tie-breaker; this builder does.
- **Page (Task 6).** Rows stay on screen while a new page loads, using the bookings `data ?? previousData` pattern. `DataTable` keeps rows on a background error. The drawer, the create form, and their code are unchanged.

## Spike result: partial order-id search (issue §Search and filters)

The issue asks for one spike of partial `id.iLike` on the Postgres `uuid` column. It was run at planning time against the local database (`clensy-platform-postgres-1`) and over GraphQL.

- SQL: `SELECT count(*) FROM laundry_order_entity WHERE id ILIKE '%1%'` fails with `ERROR: operator does not exist: uuid ~~* unknown`. `@ptc-org/nestjs-query-typeorm` 9.5.0 maps `iLike` to a plain `ILIKE` (`sql-comparison.builder.js`), so the GraphQL filter produces the same SQL.
- GraphQL: `laundryOrders(filter: { id: { iLike: "%3f2a9c1e%" } })` returns `errors`. This is pinned by Task 1.
- Also: `WHERE id = 'not-a-uuid'` fails with `invalid input syntax for type uuid`, so `id.eq` must only be sent for a UUID-shaped value. Postgres accepts any 8-4-4-4-12 hex value as a `uuid`, whatever its version bits. That is why the matcher checks shape only.

**Decision (as the issue directs):** ship customer-name search plus exact-id match for a full UUID. No partial id search, and no migration or cast. The PR body MUST say so.

## Cutover (issue §Cutover)

#156 (order page) and #161 (cutover) are open. This PR merges first, so a row keeps opening the existing drawer, and `?detail=` keeps working with no redirect. The §8.4.4 criterion "a row opens `/app/laundry/[id]`" is met at #161, not here. The PR body MUST state: "Rows still open the drawer until the end-to-end issue (#161) switches them to `/app/laundry/[id]`." Create success also still opens the drawer. That flow belongs to #160.

## Global Constraints

Derived from the Accepted spec, the amendment and the issue. Every task's requirements implicitly include this section.

- Filtering, sorting and paging happen on the server, through `laundryOrders(filter, sorting, paging)`. There is no client-side slice of fetched rows.
- Sort is offered only on `LaundryOrderSortFields`. The UI offers Order (`id`), Fulfillment, Status and Created. Customer is **not** sortable, because the server's only customer sort is `customerId`, which is not alphabetical (M5 finding). `customerId` stays a valid URL sort key, but no control offers it. Weight and total are never sortable. Default is `createdAt DESC`, and `id ASC` is the tie-breaker whenever the primary sort is not `id`.
- No new backend field is requested. The list selection stays the `LaundryOrderRow` fragment. Only the `$filter` variable is added.
- Labels: status through `t('status.<ENUM>')` and fulfillment through `t('fulfillment.<ENUM>')`. Money uses `formatMinorUnits`. Weight uses `formatWeightGrams`, with `—` for `null`. Badge tones come from `LAUNDRY_STATUS_TONE` (§4.9). Status is never shown by color alone.
- Created is rendered with `toLocaleString()`, as the issue requires ("`toLocaleString()` as today, unless a shared date helper already exists. Do not add a date library"). No shared date helper exists in `apps/web/lib`, `@clensy/web` or `@clensy/ui`; `BookingDataTable` uses the same bare call. An unparseable value renders as given.
- The create button shows only when `canReceiveLaundryOrder(role)` (INTAKE: TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT). ANALYST, FINANCE, SUPER_ADMIN and a still-loading role do not see it. The server stays authoritative.
- `DataTable` provides row activation (click, Enter, Space) on both rows and mobile cards. The mobile card adds no link, button, or second click handler.
- Do not modify `@clensy/ui`, `apps/api/src`, `apps/api/src/schema.gql`, or any migration. Add no dependency. `@clensy/web` does not import `@clensy/client`.
- The drawer, the intake form, and their helpers in `page.tsx` are unchanged. Only the list block, its imports, and the now-unused `OrderRow` type and `formatDate` helper change. `useDetailDrawer.open` gains only an optional argument; every existing caller is unaffected.

## M5 first-pass resolutions

| Part | Finding | Resolution |
| --- | --- | --- |
| 1, 4, 6 | [P1] Created sort cycle: `null` had two meanings; indicator, URL and server sort could disagree | Explicit click-transition table in `laundry-order-sort.ts` (Architecture). `null` only restores the default. Tested as a table (Task 3), with the four-row URL → server-sort table (Task 5) and click by click, against `aria-sort`, the URL and the GraphQL `sorting` (Task 6). `resolveLaundrySort` is gone. |
| 1, 3 | [P2] Customer sort implies alphabetical | Customer column not sortable. Four sortable columns. |
| 1, 4, 6 | [P2]/[P1] Debounced search vs. an open drawer; races between URL updates | Requested-URL tracking in the hook, and a drawer open that carries a waiting search in the same `push`. A jsdom test drives the real page with a router that commits only on demand: filter then search; search then row click; then a filter change while the drawer is open (Task 6). |
| 2 | [P1] `or` + sibling test could pass with the sibling ignored | The sibling is `status: WEIGHED`, which excludes one of the two `or` matches. A negative check removes it and sees the test fail (Task 1). |
| 2 | [P2] Sort characterization only checked acceptance | Expected order asserted for all five fields, both directions. Titled and commented: the request supplies the `id ASC` tie-breaker; the API adds none (Task 1). |
| 2, 5 | [P2] Wildcard test scope | Task 1's test is titled as a database characterization of `iLike` patterns. Task 5 tests raw `%`, `_` and `\` through the query builder, one case each. |
| 2 | Task 2: review the generated diff semantically | Step 2 now checks that the only removed lines are the two old document lines, and that `LaundryOrdersQueryVariables` gains `filter`. |
| 3 | [P1] Created formatting non-deterministic | Kept `toLocaleString()`, because the issue requires it and no shared helper exists (Global Constraints). Tested against `new Date(x).toLocaleString()` in the runner, and an invalid value renders as given. A fixed locale or timezone would be a product decision beyond #163. |
| 3 | [P1]/[P2] Unvalidated sort callback cast | `clickedLaundrySortKey` validates key and direction. Tests cover supported, unsupported key, unsupported direction, and `null`. The cast is gone. |
| 3 | [P2] Brittle HTML assertions | Removed class-order, `DataTable`-wrapper and slice-position assertions. The card is located by the issue's own classes and a balanced-`div` walk. Headers are checked by `aria-sort`. Clicks are tested in jsdom in `apps/web`. `@clensy/web` has no DOM test environment, and its table tests are static markup by precedent. |
| 4 | [P2] Invalid page numbers | Only a positive safe integer page with a safe offset counts; anything else is page 1. Tests for 0, −1, 1.5, `NaN`, `Infinity`, `MAX_SAFE_INTEGER`. |
| 4 | [P2] Hash and other params | Hash preserved on `replace`. Tests keep `utm_source`, a repeated `tab`, `detail` and `#orders`. |
| 5 | [P1] UUID contract | Documented as any canonical 8-4-4-4-12 hex UUID, either case, any version or variant (Spike result). Tests: v1, v7, nil, uppercase; no id match for a prefix, one digit short, no hyphens, a non-hex digit, braces. |
| 5 | `id ASC` under a DESC primary sort | Intended: it only makes equal rows page stably. Commented in the builder. |
| 6 | [P1] Unverified "four failures" | Both page test files were run against `8cdd6b1`'s page: 12 failed of 12. Recorded in Task 6 Step 2. |
| 6 | [P1] Search draft vs. URL | Sync rule in `useLaundrySearchDraft` (Architecture). jsdom tests: an outside change is followed; it is not followed while a keystroke waits; clear cancels a waiting keystroke. |
| 6 | [P1] Drawer test too weak | The drawer's query is asserted to receive the `detail` id, with the list filter kept alongside. jsdom covers `detail` surviving a waiting search and a later filter change. |
| 6 | [P2] "Page 2 of 1" | Split: offset reaches the query, and a consistent total (41) shows "Page 2 of 3". |
| 6 | [P2] Role matrix | Kept at page level. `canReceiveLaundryOrder` is tested against the intake policy in #157's `laundry-order-actions.test.ts`. |

## Review Focus (for the second M5 pass)

1. **Sort transitions.** Confirm the click table in Architecture, especially Created toggling asc ↔ desc instead of having a third "default" state that would look identical to desc.
2. **Shared hook change.** `useDetailDrawer.open(id, base?)` is used by nine pages. The new argument is optional, and every existing caller passes only the id (checked with `grep`).
3. **Requested-URL tracking.** If an outside navigation commits while a list update is still queued, the queued update still lands afterwards. That is inherent to queued router calls and is not made worse here. Pending entries are cleared on that outside commit, so later updates build on the committed URL.
4. **Exact id.** The full id is in `title` and screen-reader text, not the visible label. The visible label is the first 8 characters, monospace. Matching is case-insensitive.
5. **No mobile sort control.** Not required by the issue. Below `sm`, headers are hidden. The URL sort still applies, and the default is newest first. Deferred.
6. **Status option order and server status sort.** The filter lists `LAUNDRY_ORDER_STATUSES` (enum-alphabetical, the #157 export). The server sorts statuses in Postgres enum declaration order, which is lifecycle order. Task 1 pins it.
7. **Issue wording note.** The issue says "There is no current `mobileRow` usage in `apps/web`". `BookingDataTable` (in `@clensy/web`, rendered by `apps/web`) already passes `mobileRow`. This plan follows its card shape and the issue's classes.

## Pre-validation (full, revision 1)

Every task below was applied to the branch at `8cdd6b1`, then removed before this Draft was committed. All commands named in an `Expected:` line were run, with these results:

| Command | Result |
| --- | --- |
| `pnpm --filter api exec jest --config ./test/jest-e2e.json laundry-order-list-filters laundry.e2e-spec` | 8 passed (6 new + 2 existing) |
| Task 1 negative checks (unescaped pattern; sibling removed) | each failed 1 test; restored → 6 passed |
| `pnpm --filter api exec eslint test/laundry-order-list-filters.e2e-spec.ts` | clean |
| `pnpm --filter @clensy/client codegen`, the Task 2 semantic diff checks, then `build` / `test` / `lint` | only the two old document lines removed; build clean; 10 passed; lint clean |
| `pnpm --filter @clensy/web test` / `build` / `lint` | 402 passed; clean; clean |
| `pnpm --filter web test` / `lint`, `pnpm --filter web exec tsc --noEmit -p .`, `pnpm --filter web build` | 649 passed; clean; clean; Next build succeeded |
| Task 6 Step 2 (both page test files against `8cdd6b1`'s page) | 12 failed of 12 |
| Mutation checks (Final verification) | each mutation failed its test; restored → 55 + 25 passed |

Environment note: on this machine `pnpm --filter @clensy/client build` and `test` first failed on unchanged `main` too, because `vitest` was not linked in `packages/client` (`TS2307: Cannot find module 'vitest'` in `session-signal.test.ts`). `pnpm install --frozen-lockfile --offline` linked it ("Lockfile is up to date"), and both then passed. If M6 sees the same error, run that install first. It changes no tracked file.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/test/laundry-order-list-filters.e2e-spec.ts` | Create (characterization) | 1 |
| `packages/client/src/operations/laundry.graphql` | Modify: `$filter` on `LaundryOrders` | 2 |
| `packages/client/src/generated/graphql.ts` | Regenerate (codegen output only) | 2 |
| `packages/web/src/laundry/laundry-order-sort.ts` / `.test.ts` | Create | 3 |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify: add `list` | 3 |
| `packages/web/src/laundry/laundry-order-data-table.tsx` / `.test.tsx` | Create | 3 |
| `packages/web/src/index.ts` | Modify: exports | 3 |
| `apps/web/lib/use-laundry-order-list-url-state.ts` / `.test.ts` | Create | 4 |
| `apps/web/lib/laundry-order-list-query.ts` / `.test.ts` | Create | 5 |
| `apps/web/lib/laundry-page-baseline.test.tsx` → `apps/web/lib/laundry-list-page.test.tsx` | Rename and rewrite (`git mv`) | 6 |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Create (jsdom) | 6 |
| `apps/web/lib/use-laundry-search-draft.ts` | Create | 6 |
| `apps/web/lib/use-detail-drawer.ts` | Modify: optional `base` on `open` | 6 |
| `apps/web/app/app/laundry/page.tsx` | Modify: list block only | 6 |

---

### Task 1: Characterize the server filter and sort surface (issue §Search and filters, §Tests; spec §8.4.4)

**Characterization test.** It pins existing, already-correct API behavior that the list depends on, and it passes on first run. It also records the spike. No API code changes. It characterizes the server, not the web helpers: the request supplies the `id ASC` tie-breaker, and `iLike` patterns are written already escaped.

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
  const customerIds = { ana: '', ben: '' };

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

    customerIds.ana = await customer('Ana Reyes');
    customerIds.ben = await customer('Ben Cruz');
    // Received in this order, one request each, so createdAt is strictly
    // increasing: anaPickup, anaDelivery, benPickup.
    ids.anaPickup = await receive(customerIds.ana, 'PICKUP');
    ids.anaDelivery = await receive(customerIds.ana, 'DELIVERY');
    ids.benPickup = await receive(customerIds.ben, 'PICKUP');
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
    // `or` is ANDed with a sibling filter: the `or` matches anaDelivery
    // (WEIGHED) and benPickup (RECEIVED); the sibling must drop benPickup.
    const weighed = await nodeIds({
      or: [
        { customer: { fullName: { iLike: `%ana reyes ${tag}%` } } },
        { id: { eq: ids.benPickup } },
      ],
      status: { eq: 'WEIGHED' },
    });
    expect(weighed).toEqual([ids.anaDelivery]);
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

  // Orders by each field, both directions. The request supplies the
  // `id ASC` tie-breaker itself: the API does not add one, the web list's
  // query builder does. Postgres orders an enum by declaration order
  // (PICKUP before DELIVERY; RECEIVED before WEIGHED), not by label.
  it('orders by every LaundryOrderSortFields member when given the id ASC tie-breaker', async () => {
    const name = { customer: { fullName: { iLike: `%${tag}%` } } };
    const rows = [
      {
        id: ids.anaPickup,
        customerId: customerIds.ana,
        createdAt: 0,
        fulfillmentType: 0,
        status: 0,
      },
      {
        id: ids.anaDelivery,
        customerId: customerIds.ana,
        createdAt: 1,
        fulfillmentType: 1,
        status: 1,
      },
      {
        id: ids.benPickup,
        customerId: customerIds.ben,
        createdAt: 2,
        fulfillmentType: 0,
        status: 0,
      },
    ];
    for (const field of [
      'createdAt',
      'customerId',
      'fulfillmentType',
      'id',
      'status',
    ] as const) {
      for (const direction of ['ASC', 'DESC'] as const) {
        const sign = direction === 'ASC' ? 1 : -1;
        const expected = [...rows]
          .sort((x, y) => {
            const primary =
              x[field] < y[field] ? -1 : x[field] > y[field] ? 1 : 0;
            return primary !== 0 ? sign * primary : x.id < y.id ? -1 : 1;
          })
          .map((row) => row.id);
        const sorting =
          field === 'id'
            ? [{ direction, field }]
            : [
                { direction, field },
                { direction: 'ASC', field: 'id' },
              ];
        expect({
          direction,
          field,
          found: await nodeIds(name, sorting),
        }).toEqual({
          direction,
          field,
          found: expected,
        });
      }
    }
  });

  // Database characterization of `iLike` patterns, not of the web helper:
  // `\%` in a pattern is a literal percent sign. Escaping raw user text is
  // the web query builder's job, tested in laundry-order-list-query.test.ts.
  it('reads an escaped % in an iLike pattern literally', async () => {
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

- [ ] **Step 3: Negative checks (the assertions bite)**

1. In "reads an escaped % in an iLike pattern literally", change `` `%${tag}\\%%` `` to `` `%${tag}%%` `` (unescaped).
2. In the `or` test, delete the line `status: { eq: 'WEIGHED' },`.

Apply each one alone and run `pnpm --filter api exec jest --config ./test/jest-e2e.json laundry-order-list-filters`. Expected: `Tests: 1 failed, 5 passed`. Revert each.

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

- [ ] **Step 2: Regenerate and review the output's meaning**

Run: `pnpm --filter @clensy/client codegen`. Then:

1. `git diff -U0 packages/client/src/generated/graphql.ts | grep '^-[^-]'` — Expected: exactly the two old document lines, `query LaundryOrders($paging: OffsetPaging, $sorting: [LaundryOrderSort!]) {` and `laundryOrders(paging: $paging, sorting: $sorting) {`. No existing type loses or changes a line.
2. `git diff -U0 packages/client/src/generated/graphql.ts | grep '^+export type'` — Expected: exactly `LaundryFulfillmentTypeFilterComparison`, `LaundryOrderFilter`, `LaundryOrderFilterCustomerFilter`, `LaundryOrderStatusFilterComparison`.
3. Read the `LaundryOrdersQueryVariables` type. Expected: it now has `filter?: LaundryOrderFilter | null | undefined`, and the document string passes `filter: $filter`. `LaundryOrderFilter` has `customer`, `or`, `status`, `fulfillmentType` and `id`.

If anything else changed, the local `apps/api/src/schema.gql` is out of date. Stop and report it. Do not commit unrelated regeneration.

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @clensy/client build` and `pnpm --filter @clensy/client lint` — Expected: both clean (see the Pre-validation environment note).

```bash
git add packages/client/src/operations/laundry.graphql packages/client/src/generated/graphql.ts
git commit -m "feat(client): accept a filter on the laundryOrders list query (#163)"
```

---

### Task 3: Sort contract, `LaundryOrderDataTable` and list copy (spec §8.4.4, §4.9; issue §Columns, §Mobile, §States, §Accessibility)

**Files:**
- Create: `packages/web/src/laundry/laundry-order-sort.test.ts`
- Create: `packages/web/src/laundry/laundry-order-sort.ts`
- Create: `packages/web/src/laundry/laundry-order-data-table.test.tsx`
- Create: `packages/web/src/laundry/laundry-order-data-table.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Modify: `packages/web/src/index.ts`

- [ ] **Step 1: Write the failing sort test**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAUNDRY_ORDER_SORT,
  clickedLaundrySortKey,
  nextLaundryOrderSort,
  type LaundryOrderSortKey,
  type LaundryOrderSortState,
} from './laundry-order-sort';

const sort = (key: LaundryOrderSortKey, direction: 'asc' | 'desc'): LaundryOrderSortState => ({ direction, key });

describe('nextLaundryOrderSort', () => {
  it.each([
    // [current, clicked, next]
    [DEFAULT_LAUNDRY_ORDER_SORT, 'createdAt', sort('createdAt', 'asc')],
    [sort('createdAt', 'asc'), 'createdAt', sort('createdAt', 'desc')],
    [DEFAULT_LAUNDRY_ORDER_SORT, 'status', sort('status', 'asc')],
    [sort('status', 'asc'), 'status', sort('status', 'desc')],
    [sort('status', 'desc'), 'status', null],
    [sort('status', 'desc'), 'createdAt', sort('createdAt', 'asc')],
    [sort('createdAt', 'asc'), 'fulfillmentType', sort('fulfillmentType', 'asc')],
    [sort('id', 'desc'), 'id', null],
  ] as const)('%j + click %s → %j', (current, clicked, next) => {
    expect(nextLaundryOrderSort(current, clicked)).toEqual(next);
  });

  it('cycles a non-default column asc → desc → default, and Created asc ↔ desc', () => {
    const statusCycle = [sort('status', 'asc'), sort('status', 'desc'), null];
    let current: LaundryOrderSortState = DEFAULT_LAUNDRY_ORDER_SORT;
    for (const expected of statusCycle) {
      const next = nextLaundryOrderSort(current, 'status');
      expect(next).toEqual(expected);
      current = next ?? DEFAULT_LAUNDRY_ORDER_SORT; // null restores the default
    }
    expect(current).toEqual(DEFAULT_LAUNDRY_ORDER_SORT);

    const createdCycle = [sort('createdAt', 'asc'), sort('createdAt', 'desc'), sort('createdAt', 'asc')];
    current = DEFAULT_LAUNDRY_ORDER_SORT;
    for (const expected of createdCycle) {
      const next = nextLaundryOrderSort(current, 'createdAt');
      expect(next).toEqual(expected);
      current = next ?? DEFAULT_LAUNDRY_ORDER_SORT;
    }
  });
});

describe('clickedLaundrySortKey', () => {
  it('takes the clicked column from what DataTable reports, including its null', () => {
    // DataTable's `nextSortState`: a new column starts asc; asc → desc;
    // desc → null ("none") on the column that is already sorted.
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'asc', key: 'status' })).toBe('status');
    expect(clickedLaundrySortKey(sort('status', 'asc'), { direction: 'desc', key: 'status' })).toBe('status');
    // A click on Created while Created desc is reported as null. It is still a Created click.
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, null)).toBe('createdAt');
    expect(clickedLaundrySortKey(sort('status', 'desc'), null)).toBe('status');
  });

  it('rejects a key or direction the list does not support', () => {
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'asc', key: 'weightGrams' })).toBeUndefined();
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'asc', key: 'customer' })).toBeUndefined();
    expect(
      clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'sideways' as 'asc', key: 'status' }),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-sort.test.ts`
Expected: FAIL, because `./laundry-order-sort` cannot be resolved.

- [ ] **Step 3: Write the sort module**

```ts
import type { DataTableSortState } from '@clensy/ui';

// The `LaundryOrderSortFields` members (lifecycle spec §8.4.4). Weight and
// total are not server sort fields.
export type LaundryOrderSortKey = 'createdAt' | 'customerId' | 'fulfillmentType' | 'id' | 'status';

export interface LaundryOrderSortState {
  direction: 'asc' | 'desc';
  key: LaundryOrderSortKey;
}

export const LAUNDRY_ORDER_SORT_KEYS: readonly LaundryOrderSortKey[] = [
  'createdAt',
  'customerId',
  'fulfillmentType',
  'id',
  'status',
];

// The list's default sort: newest first. `null` from a sort transition
// always means "restore this default", nothing else.
export const DEFAULT_LAUNDRY_ORDER_SORT: Readonly<LaundryOrderSortState> = { direction: 'desc', key: 'createdAt' };

// Which column a `DataTable` sort callback came from. `DataTable` reports
// the clicked column's next state, or `null` after its own asc → desc →
// none cycle ends on the currently sorted column. A key or direction this
// list does not support returns `undefined`, so it never reaches URL state.
export function clickedLaundrySortKey(
  current: LaundryOrderSortState,
  reported: DataTableSortState | null,
): LaundryOrderSortKey | undefined {
  if (reported === null) return current.key;
  if (reported.direction !== 'asc' && reported.direction !== 'desc') return undefined;
  return isLaundryOrderSortKey(reported.key) ? reported.key : undefined;
}

export function isLaundryOrderSortKey(value: unknown): value is LaundryOrderSortKey {
  return LAUNDRY_ORDER_SORT_KEYS.includes(value as LaundryOrderSortKey);
}

// The list's own click transitions, independent of `DataTable`'s cycle:
//
// | Current sort    | Click     | Next                           |
// | --------------- | --------- | ------------------------------ |
// | anything else   | column X  | X asc                          |
// | X asc           | X         | X desc                         |
// | X desc, X ≠ Created | X     | null (default: Created desc)   |
// | Created desc    | Created   | Created asc                    |
//
// Created desc is the default, so "back to default" from it would be a
// click that does nothing. Created therefore toggles asc ↔ desc.
export function nextLaundryOrderSort(
  current: LaundryOrderSortState,
  clicked: LaundryOrderSortKey,
): LaundryOrderSortState | null {
  if (current.key !== clicked) return { direction: 'asc', key: clicked };
  if (current.direction === 'asc') return { direction: 'desc', key: clicked };
  if (clicked === DEFAULT_LAUNDRY_ORDER_SORT.key) return { direction: 'asc', key: clicked };
  return null;
}
```

Run the Step 2 command again. Expected: `Tests 11 passed (11)`.

- [ ] **Step 4: Write the failing table test**

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LaundryOrderDataTable,
  type LaundryOrderDataTableProps,
  type LaundryOrderRow,
} from './laundry-order-data-table';
import type { LaundryOrderSortState } from './laundry-order-sort';

// Static markup, as in the other @clensy/web table tests. Assertions are on
// text, labels, attributes and the issue's own card classes, not on
// DataTable's wrapper markup. Clicks are covered by apps/web's jsdom test.
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
const CARD_CLASSES = 'rounded-md border border-slate-200 p-3';

// The header's `aria-sort` value, or undefined when it is not sortable.
function headerSort(html: string, header: string): string | undefined {
  const match = new RegExp(`<th([^>]*)>(?:<button[^>]*>)?${header}<`).exec(html);
  expect(match).not.toBeNull();
  return /aria-sort="([a-z]+)"/.exec(match![1])?.[1];
}

// The mobile card element: the `<div>` carrying the issue's card classes,
// up to its matching `</div>`. Static markup has no DOM, so this walks the
// string's div tags.
function mobileCard(html: string): string {
  const start = html.lastIndexOf('<div', html.indexOf(CARD_CLASSES));
  expect(html.indexOf(CARD_CLASSES)).toBeGreaterThan(-1);
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  throw new Error('unbalanced card markup');
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
    expect(mobileCard(html)).toContain('Weight: —');
    expect(mobileCard(html)).toContain('Total: —');
  });

  it('renders Created with toLocaleString, and an unparseable value as given', () => {
    expect(render()).toContain(new Date(order.createdAt as string).toLocaleString());
    expect(render({ orders: [{ ...order, createdAt: 'not-a-date' }] })).toContain('not-a-date');
  });

  it('offers sort on Order, Fulfillment, Status and Created only', () => {
    const html = render();
    expect(html.match(/aria-sort="/g)).toHaveLength(4);
    for (const header of ['Order', 'Fulfillment', 'Status', 'Created']) expect(headerSort(html, header)).toBeDefined();
    for (const header of ['Customer', 'Weight', 'Total']) expect(headerSort(html, header)).toBeUndefined();
  });

  it.each([
    [{ direction: 'desc', key: 'createdAt' }, 'Created', 'descending'],
    [{ direction: 'asc', key: 'createdAt' }, 'Created', 'ascending'],
    [{ direction: 'asc', key: 'status' }, 'Status', 'ascending'],
    [{ direction: 'desc', key: 'fulfillmentType' }, 'Fulfillment', 'descending'],
    [{ direction: 'asc', key: 'id' }, 'Order', 'ascending'],
  ] as [LaundryOrderSortState, string, string][])('shows %j on the %s header as %s', (sort, header, ariaSort) => {
    const html = render({ sort });
    expect(headerSort(html, header)).toBe(ariaSort);
    expect(html.match(/aria-sort="(ascending|descending)"/g)).toHaveLength(1);
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

  it('renders a mobile card with the customer, status, fulfillment, weight and total, and no control of its own', () => {
    const card = mobileCard(render());
    expect(card).toContain('<span class="min-w-0 break-words font-medium text-slate-900">Ana Reyes</span>');
    expect(card).toContain('Awaiting payment');
    expect(card).toContain('Delivery');
    expect(card).toContain('Weight: 2.50 kg');
    expect(card).toContain('Total: ₱450.00');
    expect(card).not.toContain('<a ');
    expect(card).not.toContain('<button');
    expect(card).not.toContain('role="button"');
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-data-table.test.tsx`
Expected: FAIL, because `./laundry-order-data-table` cannot be resolved.

- [ ] **Step 6: Add the copy**

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

- [ ] **Step 7: Write the component**

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
import { clickedLaundrySortKey, nextLaundryOrderSort, type LaundryOrderSortState } from './laundry-order-sort';
import {
  LAUNDRY_ORDER_STATUSES,
  LAUNDRY_STATUS_TONE,
  type LaundryFulfillmentType,
  type LaundryOrderStatus,
} from './laundry-order-status';

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
  // The next sort after a header click, or `null` to restore the default
  // (`nextLaundryOrderSort`).
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
    // Not sortable: the server's only customer sort is `customerId`, which
    // groups orders but is not alphabetical, as a Customer heading implies.
    { header: t('list.columns.customer'), key: 'customer', render: 'customer.fullName' },
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
      // Only the clicked column is taken from DataTable. The next state is
      // the list's own transition, and an unsupported key is ignored.
      onSortChange={(reported) => {
        const clicked = clickedLaundrySortKey(sort, reported);
        if (clicked !== undefined) onSortChange(nextLaundryOrderSort(sort, clicked));
      }}
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

- [ ] **Step 8: Export both**

```diff
diff --git a/packages/web/src/index.ts b/packages/web/src/index.ts
--- a/packages/web/src/index.ts
+++ b/packages/web/src/index.ts
@@ -36,3 +36,17 @@ export { LaundryOrderProgress } from './laundry/laundry-order-progress';
 export type { LaundryOrderProgressProps } from './laundry/laundry-order-progress';
 export { laundryProgressSteps } from './laundry/laundry-progress-steps';
 export type { LaundryProgressState, LaundryProgressStep } from './laundry/laundry-progress-steps';
+export { LaundryOrderDataTable } from './laundry/laundry-order-data-table';
+export type {
+  LaundryOrderDataTableProps,
+  LaundryOrderListFilters,
+  LaundryOrderRow,
+} from './laundry/laundry-order-data-table';
+export {
+  DEFAULT_LAUNDRY_ORDER_SORT,
+  LAUNDRY_ORDER_SORT_KEYS,
+  clickedLaundrySortKey,
+  isLaundryOrderSortKey,
+  nextLaundryOrderSort,
+} from './laundry/laundry-order-sort';
+export type { LaundryOrderSortKey, LaundryOrderSortState } from './laundry/laundry-order-sort';
```

- [ ] **Step 9: Run the tests, typecheck and lint**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-data-table.test.tsx` — Expected: `Tests 14 passed (14)`.
Run: `pnpm --filter @clensy/web test`, `pnpm --filter @clensy/web build`, `pnpm --filter @clensy/web lint` — Expected: all pass (402 tests at pre-validation), with no lint output.

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/laundry/laundry-order-sort.ts packages/web/src/laundry/laundry-order-sort.test.ts packages/web/src/laundry/laundry-order-data-table.tsx packages/web/src/laundry/laundry-order-data-table.test.tsx packages/web/src/i18n/messages/en/laundry.ts packages/web/src/index.ts
git commit -m "feat(web): add the laundry order list table with filters, mobile cards and its sort contract (#163)"
```

---

### Task 4: List URL state (issue §Search and filters: URL, offset reset; §Tests: URL-state helper)

**Files:**
- Create: `apps/web/lib/use-laundry-order-list-url-state.test.ts`
- Create: `apps/web/lib/use-laundry-order-list-url-state.ts`

The pure helpers are unit-tested here. The hook's requested-URL tracking, hash handling and drawer interplay are exercised through the real page in Task 6's jsdom test.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAUNDRY_ORDER_LIST_STATE,
  hasActiveLaundryFilters,
  laundryListFiltersCleared,
  parseLaundryOrderListState,
  serializeLaundryOrderListState,
  withLaundryFilterChange,
  withLaundryPage,
  withLaundrySort,
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

  it('keeps every param it does not own, and replaces its own', () => {
    const base = new URLSearchParams('detail=o1&q=old&status=READY&offset=40&utm_source=mail&tab=a&tab=b');
    const params = serializeLaundryOrderListState(laundryListFiltersCleared(parseLaundryOrderListState(base)), base);
    expect(params.get('detail')).toBe('o1');
    expect(params.get('utm_source')).toBe('mail');
    expect(params.getAll('tab')).toEqual(['a', 'b']);
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

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
    'treats page %s as page 1',
    (page) => {
      expect(withLaundryPage(onPage3, page).offset).toBe(0);
    },
  );
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

describe('withLaundrySort', () => {
  // The four rows of the M5 sort table: URL state → effective server sort
  // is covered in laundry-order-list-query.test.ts; this pins the state.
  it('applies a column sort and returns to page 1', () => {
    expect(withLaundrySort(onPage3, { direction: 'asc', key: 'status' })).toMatchObject({
      offset: 0,
      sortBy: 'status',
      sortOrder: 'asc',
    });
    expect(withLaundrySort(onPage3, { direction: 'asc', key: 'createdAt' })).toMatchObject({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
  });

  it('restores createdAt desc for null, always', () => {
    const statusAsc = { ...onPage3, sortBy: 'status' as const, sortOrder: 'asc' as const };
    expect(withLaundrySort(statusAsc, null)).toMatchObject({ offset: 0, sortBy: 'createdAt', sortOrder: 'desc' });
    const createdAsc = { ...onPage3, sortOrder: 'asc' as const };
    expect(withLaundrySort(createdAsc, null)).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' });
    // Already the default: nothing changes, so the page is kept.
    expect(withLaundrySort(onPage3, null)).toBe(onPage3);
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
  DEFAULT_LAUNDRY_ORDER_SORT,
  LAUNDRY_ORDER_STATUSES,
  isLaundryOrderSortKey,
  type LaundryFulfillmentType,
  type LaundryOrderSortKey,
  type LaundryOrderSortState,
  type LaundryOrderStatus,
} from '@clensy/web';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

// `/app/laundry` list state, kept in the URL so a refresh, or back from an
// order, restores it (lifecycle spec §8.4.4). Params the list does not own,
// such as the drawer's `detail`, and the hash are carried through untouched.
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

export type LaundryOrderListUpdate = (current: LaundryOrderListState) => LaundryOrderListState;

export const LAUNDRY_ORDER_PAGE_SIZE = 20;
export const LAUNDRY_SEARCH_DEBOUNCE_MS = 300;
export const LAUNDRY_SEARCH_MAX_LENGTH = 200;

export const DEFAULT_LAUNDRY_ORDER_LIST_STATE: Readonly<LaundryOrderListState> = {
  fulfillment: null,
  offset: 0,
  search: '',
  sortBy: DEFAULT_LAUNDRY_ORDER_SORT.key,
  sortOrder: DEFAULT_LAUNDRY_ORDER_SORT.direction,
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
    sortBy: isLaundryOrderSortKey(sortByRaw) ? sortByRaw : DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortBy,
    sortOrder: sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortOrder,
    status: LAUNDRY_ORDER_STATUSES.includes(statusRaw as LaundryOrderStatus) ? (statusRaw as LaundryOrderStatus) : null,
  };
}

// Writes the list keys onto a copy of `base`, so params this list does not
// own survive. Search and filters are omitted when empty. Sort and offset
// are always written, as on the bookings list.
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

// `router.replace` and `router.push` commit asynchronously, so
// `window.location` can still show the previous URL when the next update
// runs (a debounced search landing just after a filter change). Each update
// therefore builds on the latest URL this list has *asked for*. That entry
// is dropped once the router commits it. A commit of some other URL (an
// outside navigation) drops every pending entry.
export function useLaundryOrderListUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pending = useRef<string[]>([]);

  const committed = searchParams.toString();
  useEffect(() => {
    const index = pending.current.indexOf(committed);
    pending.current = index === -1 ? [] : pending.current.slice(index + 1);
  }, [committed]);

  const state = parseLaundryOrderListState(searchParams);

  // The params `update` produces, built on the latest requested URL and
  // recorded as requested. For a navigation the caller makes itself, such
  // as opening the drawer with these params plus `detail`.
  const requestParams = useCallback((update: LaundryOrderListUpdate): URLSearchParams => {
    const base = new URLSearchParams(pending.current.at(-1) ?? window.location.search);
    const current = parseLaundryOrderListState(base);
    const next = update(current);
    const params = next === current ? base : serializeLaundryOrderListState(next, base);
    pending.current.push(params.toString());
    return params;
  }, []);

  const setState = useCallback(
    (update: LaundryOrderListUpdate) => {
      const before = pending.current.at(-1) ?? new URLSearchParams(window.location.search).toString();
      const params = requestParams(update);
      if (params.toString() === before) {
        pending.current.pop();
        return;
      }
      router.replace(`${pathname}?${params.toString()}${window.location.hash}`);
    },
    [router, pathname, requestParams],
  );

  return { requestParams, setState, state };
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

// Pagination is 1-based in `DataTable`, offset-based in the URL. Anything
// but a positive safe integer page, or a page whose offset is not a safe
// integer, means page 1.
export function withLaundryPage(state: LaundryOrderListState, page: number): LaundryOrderListState {
  const offset = Number.isSafeInteger(page) && page >= 1 ? (page - 1) * LAUNDRY_ORDER_PAGE_SIZE : 0;
  return { ...state, offset: Number.isSafeInteger(offset) ? offset : 0 };
}

// A sort transition from the table. `null` always restores the default
// sort (`nextLaundryOrderSort`). Changing the sort returns to page 1.
export function withLaundrySort(
  state: LaundryOrderListState,
  sort: LaundryOrderSortState | null,
): LaundryOrderListState {
  const { direction, key } = sort ?? DEFAULT_LAUNDRY_ORDER_SORT;
  return withLaundryFilterChange(state, { sortBy: key, sortOrder: direction });
}

function normalizeLaundrySearch(text: string): string {
  return text.trim().slice(0, LAUNDRY_SEARCH_MAX_LENGTH);
}
```

- [ ] **Step 4: Run it to see it pass, then commit**

Run: `pnpm --filter web exec vitest run lib/use-laundry-order-list-url-state.test.ts` — Expected: `Tests 19 passed (19)`.

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
import {
  DEFAULT_LAUNDRY_ORDER_LIST_STATE,
  parseLaundryOrderListState,
  withLaundrySort,
  type LaundryOrderListState,
} from './use-laundry-order-list-url-state';

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

  it.each([
    ['a v1 UUID', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    ['a v7 UUID', '01920c4e-7d2a-7cc3-9a40-1f0e5d6b8a21'],
    ['a nil-variant UUID', '00000000-0000-0000-0000-000000000000'],
    ['an uppercase UUID', ORDER_ID],
  ])('treats %s as a full id: any version or variant, either case', (_label, id) => {
    expect(variables({ search: id }).filter?.or?.[1]).toEqual({ id: { eq: id.toLowerCase() } });
  });

  it.each([
    ['a prefix', '3f2a9c1e'],
    ['one hex digit short', ORDER_ID.slice(0, -1)],
    ['no hyphens', ORDER_ID.replace(/-/g, '')],
    ['a non-hex digit', `${ORDER_ID.slice(0, -1)}g`],
    ['braces', `{${ORDER_ID}}`],
  ])('never sends an id match for %s', (_label, search) => {
    expect(JSON.stringify(variables({ search }).filter)).not.toContain('"id"');
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
  });

  // Raw search text → server filter. Only the outer % pair is a wildcard.
  it.each([
    ['%', '50%', '%50\\%%'],
    ['_', 'a_b', '%a\\_b%'],
    ['\\', 'a\\b', '%a\\\\b%'],
  ])('escapes a user-typed %s in the customer filter', (_character, search, pattern) => {
    expect(variables({ search }).filter).toEqual({ customer: { fullName: { iLike: pattern } } });
  });
});

// The M5 sort table: URL / UI state → effective server sort.
describe('effective server sort', () => {
  const sortingFor = (query: string) =>
    laundryOrdersQueryVariables(parseLaundryOrderListState(new URLSearchParams(query))).sorting;
  const createdDesc = [
    { direction: 'DESC', field: 'createdAt' },
    { direction: 'ASC', field: 'id' },
  ];

  it.each([
    ['no sort parameters', '', createdDesc],
    ['explicit Created ascending', 'sortBy=createdAt&sortOrder=asc', [
      { direction: 'ASC', field: 'createdAt' },
      { direction: 'ASC', field: 'id' },
    ]],
    ['explicit Created descending', 'sortBy=createdAt&sortOrder=desc', createdDesc],
    ['an unsupported sort', 'sortBy=weightGrams&sortOrder=up', createdDesc],
  ])('%s → %j', (_label, query, expected) => {
    expect(sortingFor(query)).toEqual(expected);
  });

  it('cleared sort (null) → createdAt DESC, id ASC', () => {
    const statusAsc = parseLaundryOrderListState(new URLSearchParams('sortBy=status&sortOrder=asc'));
    expect(laundryOrdersQueryVariables(withLaundrySort(statusAsc, null)).sorting).toEqual(createdDesc);
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

// Any canonical 8-4-4-4-12 hex UUID, either case. Version and variant are
// deliberately not checked: Postgres accepts every value of this shape,
// and rejects anything else with "invalid input syntax for type uuid".
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
// is not already `id`. The API does not add a tie-breaker; this does. It
// stays ASC for a DESC primary sort: it only makes equal rows page stably.
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

Run: `pnpm --filter web exec vitest run lib/laundry-order-list-query.test.ts` — Expected: `Tests 24 passed (24)`.

```bash
git add apps/web/lib/laundry-order-list-query.ts apps/web/lib/laundry-order-list-query.test.ts
git commit -m "feat(web): build the laundry list server filter and sort variables (#163)"
```

---

### Task 6: Wire the list page (spec §8.4.4; issue §Page structure, §States, Cutover, §Acceptance criteria)

**Files:**
- Rename and rewrite: `apps/web/lib/laundry-page-baseline.test.tsx` → `apps/web/lib/laundry-list-page.test.tsx`
- Create: `apps/web/lib/laundry-list-page.interaction.test.tsx`
- Create: `apps/web/lib/use-laundry-search-draft.ts`
- Modify: `apps/web/lib/use-detail-drawer.ts`
- Modify: `apps/web/app/app/laundry/page.tsx`

The #157 baseline was a characterization of the old list ("It is not a target"). This task replaces its assertions with the redesigned behavior. The old ones (`AWAITING_PAYMENT`, a `toFixed(2)` weight) intentionally stop holding.

The static test covers rendering and query wiring. The jsdom test drives the real page, URL-state hook and search-draft hook through clicks, typing and timers, with a router that commits navigations only when the test says so.

- [ ] **Step 1: Rename and write the static page test**

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
  orderQueryOptions: [] as unknown[],
  ordersQueryOptions: [] as unknown[],
  role: 'TENANT_OWNER' as string | undefined,
  search: '',
  totalCount: 1,
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
    useLaundryOrderQuery: (options: unknown) => {
      page.orderQueryOptions.push(options);
      return query();
    },
    useLaundryOrdersQuery: (options: unknown) => {
      page.ordersQueryOptions.push(options);
      return {
        data: { laundryOrders: { nodes: [order], totalCount: page.totalCount } },
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
  page.orderQueryOptions = [];
  page.ordersQueryOptions = [];
  page.role = 'TENANT_OWNER';
  page.search = '';
  page.totalCount = 1;
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
    // The header indicator shows the same sort the server received.
    expect(html).toMatch(/<th[^>]*aria-sort="ascending"[^>]*><button[^>]*>Status</);
  });

  it('labels the page from the URL offset and the server total', async () => {
    page.search = 'offset=20';
    page.totalCount = 41;
    const html = await renderPage();
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({ variables: { paging: { limit: 20, offset: 20 } } });
    expect(html).toContain('Page 2 of 3');
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

  it('keeps the drawer for ?detail= until the order page cutover, loading that order', async () => {
    page.search = `q=ana&detail=${order.id}`;
    const html = await renderPage();
    expect(page.orderQueryOptions.at(-1)).toMatchObject({ variables: { id: order.id } });
    // The drawer mounted; its idle mocked query renders the drawer's error state.
    expect(html).toContain('Unable to load laundry order.');
    // The list keeps its own filter alongside the drawer.
    expect(page.ordersQueryOptions.at(-1)).toMatchObject({
      variables: { filter: { customer: { fullName: { iLike: '%ana%' } } } },
    });
  });
});
```

- [ ] **Step 2: Write the jsdom interaction test**

```tsx
// @vitest-environment jsdom
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real `/app/laundry` page, URL-state hook and search-draft
// hook. The fake router queues every navigation and commits only when the
// test calls `commit()`, so the races the M5 review raised (a debounced
// search landing after a filter change, or after a row opened the drawer)
// happen deterministically.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER_ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const store = {
    calls: [] as { method: 'push' | 'replace'; url: string }[],
    committed: '',
    listeners,
    orderQueryIds: [] as string[],
    queued: [] as string[],
    sortingCalls: [] as unknown[],
  };
  return store;
});

function navigate(method: 'push' | 'replace', url: string) {
  nav.calls.push({ method, url });
  nav.queued.push(url);
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/laundry',
  useRouter: () => ({
    back: vi.fn(),
    push: (url: string) => navigate('push', url),
    replace: (url: string) => navigate('replace', url),
  }),
  useSearchParams: () => {
    const query = useSyncExternalStore(
      (listener) => {
        nav.listeners.add(listener);
        return () => nav.listeners.delete(listener);
      },
      () => nav.committed,
    );
    return new URLSearchParams(query);
  },
}));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const query = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  const row = {
    id: ORDER_ID,
    createdAt: '2026-10-01T09:00:00.000Z',
    customer: { id: 'c1', fullName: 'Ana Reyes' },
    fulfillmentType: 'DELIVERY',
    status: 'READY',
    totalMinorUnits: 45000,
    weightGrams: 2500,
  };
  return {
    useCancelLaundryOrderMutation: idle,
    useCompleteLaundryOrderMutation: idle,
    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: 'TENANT_OWNER' } } }),
    useCustomersQuery: () => ({ data: { customers: { nodes: [] } } }),
    useGenerateInvoiceFromOrderMutation: idle,
    useInvoiceForOrderQuery: query,
    useLaundryOrderQuery: (options: { variables: { id: string } }) => {
      nav.orderQueryIds.push(options.variables.id);
      return query();
    },
    useLaundryOrdersQuery: (options: { variables: { sorting: unknown } }) => {
      nav.sortingCalls.push(options.variables.sorting);
      return { data: { laundryOrders: { nodes: [row], totalCount: 1 } }, error: undefined, loading: false };
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

const { default: LaundryPage } = await import('../app/app/laundry/page');

let container: HTMLDivElement;
let root: Root;

// Commits every queued navigation in order, as the router would.
function commit() {
  act(() => {
    for (const url of nav.queued.splice(0)) {
      const [path, hash = ''] = url.split('#');
      nav.committed = path.split('?')[1] ?? '';
      window.history.replaceState(null, '', `${path}${hash ? `#${hash}` : ''}`);
      for (const listener of nav.listeners) listener();
    }
  });
}

function url(): URLSearchParams {
  return new URLSearchParams(nav.committed);
}

function start(query = '', hash = '') {
  nav.committed = query;
  window.history.replaceState(null, '', `/app/laundry${query ? `?${query}` : ''}${hash}`);
  act(() => root.render(<LaundryPage />));
}

function typeSearch(text: string) {
  const input = container.querySelector<HTMLInputElement>('#laundry-order-search')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function selectStatus(value: string) {
  const select = container.querySelector<HTMLSelectElement>('#laundry-order-status-filter')!;
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function clickHeader(label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('th button')].find((b) => b.textContent === label)!;
  act(() => button.click());
}

function ariaSort(label: string): string | null {
  const button = [...container.querySelectorAll<HTMLButtonElement>('th button')].find((b) => b.textContent === label)!;
  return button.closest('th')!.getAttribute('aria-sort');
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.calls = [];
  nav.queued = [];
  nav.orderQueryIds = [];
  nav.sortingCalls = [];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('/app/laundry list interactions', () => {
  it('keeps both a filter change and a debounced search that lands before the filter commits', () => {
    start();
    typeSearch('ana');
    act(() => vi.advanceTimersByTime(290));
    selectStatus('READY'); // queued, not committed
    act(() => vi.advanceTimersByTime(10)); // the search commit fires now
    commit();
    expect(url().get('q')).toBe('ana');
    expect(url().get('status')).toBe('READY');
    expect(url().get('offset')).toBe('0');
  });

  it('opens the drawer with a pending search in the same navigation, and nothing later drops detail', () => {
    start('status=READY&offset=20');
    typeSearch('ana');
    act(() => vi.advanceTimersByTime(100));
    act(() => container.querySelector<HTMLTableRowElement>('tr[role="button"]')!.click());
    act(() => vi.advanceTimersByTime(1000)); // the debounce would have fired by now
    commit();
    expect(url().get('detail')).toBe(ORDER_ID);
    expect(url().get('q')).toBe('ana');
    expect(url().get('status')).toBe('READY');
    expect(nav.calls.map((call) => call.method)).toEqual(['push']);
    expect(nav.orderQueryIds.at(-1)).toBe(ORDER_ID);

    // A filter change while the drawer is open keeps `detail`.
    selectStatus('PAID');
    commit();
    expect(url().get('detail')).toBe(ORDER_ID);
    expect(url().get('status')).toBe('PAID');
  });

  it('keeps unrelated params and the hash across list updates', () => {
    start('utm_source=mail&tab=a&tab=b', '#orders');
    selectStatus('READY');
    commit();
    expect(url().get('utm_source')).toBe('mail');
    expect(url().getAll('tab')).toEqual(['a', 'b']);
    expect(nav.calls.at(-1)!.url.endsWith('#orders')).toBe(true);
  });

  it('follows an outside change to the committed search, but not while a keystroke is waiting', () => {
    start('q=ana');
    const input = () => container.querySelector<HTMLInputElement>('#laundry-order-search')!.value;
    expect(input()).toBe('ana');

    act(() => {
      nav.committed = 'q=ben';
      for (const listener of nav.listeners) listener();
    });
    expect(input()).toBe('ben');

    typeSearch('benj');
    act(() => {
      nav.committed = 'q=carl';
      for (const listener of nav.listeners) listener();
    });
    expect(input()).toBe('benj');
  });

  it('clears the search and filters, including a keystroke still waiting', () => {
    start('q=ana&status=READY');
    typeSearch('anab');
    const clear = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Clear search and filters')!;
    act(() => clear.click());
    act(() => vi.advanceTimersByTime(1000));
    commit();
    expect(url().has('q')).toBe(false);
    expect(url().has('status')).toBe(false);
    expect(container.querySelector<HTMLInputElement>('#laundry-order-search')!.value).toBe('');
  });

  it('keeps the header indicator, URL and server sort in step through each click', () => {
    start();
    const steps: [string, string, string, string, unknown][] = [
      // [click, sortBy, sortOrder, header showing it, server sorting]
      ['Created', 'createdAt', 'asc', 'Created', [{ direction: 'ASC', field: 'createdAt' }, { direction: 'ASC', field: 'id' }]],
      ['Created', 'createdAt', 'desc', 'Created', [{ direction: 'DESC', field: 'createdAt' }, { direction: 'ASC', field: 'id' }]],
      ['Status', 'status', 'asc', 'Status', [{ direction: 'ASC', field: 'status' }, { direction: 'ASC', field: 'id' }]],
      ['Status', 'status', 'desc', 'Status', [{ direction: 'DESC', field: 'status' }, { direction: 'ASC', field: 'id' }]],
      ['Status', 'createdAt', 'desc', 'Created', [{ direction: 'DESC', field: 'createdAt' }, { direction: 'ASC', field: 'id' }]],
    ];
    expect(ariaSort('Created')).toBe('descending');
    for (const [click, sortBy, sortOrder, header, sorting] of steps) {
      clickHeader(click);
      commit();
      expect({ sortBy: url().get('sortBy'), sortOrder: url().get('sortOrder') }).toEqual({ sortBy, sortOrder });
      expect(ariaSort(header)).toBe(sortOrder === 'asc' ? 'ascending' : 'descending');
      expect(nav.sortingCalls.at(-1)).toEqual(sorting);
    }
    expect(ariaSort('Status')).toBe('none');
  });
});
```

- [ ] **Step 3: Run both against the current page to see them fail**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx`
Expected: `Tests 12 failed (12)`. This was recorded at planning time against `8cdd6b1`'s page, not assumed. The current page renders raw enums, sends no `filter` or `sorting`, shows the create button to every role, has no search or filter controls, and has no sortable headers.

- [ ] **Step 4: Add the search-draft hook**

```ts
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LAUNDRY_SEARCH_DEBOUNCE_MS } from './use-laundry-order-list-url-state';

// The list's search box. The input shows every keystroke (`draft`); the
// committed search (the URL) follows once typing pauses for
// `LAUNDRY_SEARCH_DEBOUNCE_MS`.
//
// Sync rule: when the committed search changes from outside the box (clear,
// back/forward, a remount from another URL), the draft follows it, unless a
// keystroke is still waiting to commit. A draft that differs from the
// committed search only by surrounding space is left as typed.
export function useLaundrySearchDraft(committedSearch: string, commit: (text: string) => void) {
  const [draft, setDraft] = useState(committedSearch);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingText = useRef<string | undefined>(undefined);
  const lastCommitted = useRef(committedSearch);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (lastCommitted.current === committedSearch) return;
    lastCommitted.current = committedSearch;
    if (pendingText.current !== undefined) return;
    setDraft((current) => (current.trim() === committedSearch ? current : committedSearch));
  }, [committedSearch]);

  const change = useCallback(
    (text: string) => {
      setDraft(text);
      pendingText.current = text;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pendingText.current = undefined;
        commit(text);
      }, LAUNDRY_SEARCH_DEBOUNCE_MS);
    },
    [commit],
  );

  // Cancels the waiting commit and returns its text, for a caller that
  // commits it inside its own navigation (opening the drawer).
  const takePending = useCallback((): string | undefined => {
    clearTimeout(timer.current);
    const text = pendingText.current;
    pendingText.current = undefined;
    return text;
  }, []);

  // Cancels any waiting commit and empties the box (clear filters).
  const reset = useCallback(() => {
    takePending();
    setDraft('');
  }, [takePending]);

  return { change, draft, reset, takePending };
}
```

- [ ] **Step 5: Let the drawer open with caller-built params**

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -28,9 +28,11 @@ export function useDetailDrawer(paramName = 'detail') {
 
   const activeId = searchParams.get(paramName);
 
-  const open = useCallback((id: string) => {
+  // `base` replaces the current params when the caller composes the URL
+  // itself (the laundry list commits a pending search in the same push).
+  const open = useCallback((id: string, base?: URLSearchParams) => {
     openedHereRef.current = true;
-    const params = new URLSearchParams(searchParams.toString());
+    const params = new URLSearchParams(base ?? searchParams.toString());
     params.set(paramName, id);
     router.push(`${pathname}?${params.toString()}`);
   }, [router, pathname, searchParams, paramName]);
```

- [ ] **Step 6: Edit the page**

Apply this diff. It changes imports, removes the unused `OrderRow` type and `formatDate` helper, adds the row-click and clear handlers, and replaces the list block. The drawer, `InvoiceSection`, the intake form, `STATUS_TONE`, `formatWeight`, and the transition mirror stay as they are, because #156, #160 and #161 own them.

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
 import { Suspense, useState } from 'react';
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
+  hasActiveLaundryFilters,
+  laundryListFiltersCleared,
+  useLaundryOrderListUrlState,
+  withLaundryFilterChange,
+  withLaundryPage,
+  withLaundrySort,
+} from '../../../lib/use-laundry-order-list-url-state';
+import { useLaundrySearchDraft } from '../../../lib/use-laundry-search-draft';
 
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
@@ -174,12 +174,19 @@ export default function LaundryPage() {
 }
 
 function LaundryPageContent() {
-  const [page, setPage] = useState(1);
-  const pageSize = 20;
+  const t = useClensyTranslations('laundry');
+  const { requestParams, setState: setListState, state: listState } = useLaundryOrderListUrlState();
   const ordersQuery = useLaundryOrdersQuery({
     fetchPolicy: 'network-only',
-    variables: { paging: { limit: pageSize, offset: (page - 1) * pageSize } },
+    notifyOnNetworkStatusChange: true,
+    variables: laundryOrdersQueryVariables(listState),
   });
+  const { data: adminData } = useCurrentAdminQuery();
+  const canCreate = canReceiveLaundryOrder(adminData?.currentAdmin.role);
+
+  const search = useLaundrySearchDraft(listState.search, (text) =>
+    setListState((current) => withLaundryFilterChange(current, { search: text })),
+  );
   const { data: customersData } = useCustomersQuery({
     fetchPolicy: 'network-only',
     variables: { paging: { limit: 100 } },
@@ -187,6 +194,23 @@ function LaundryPageContent() {
   const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
   const { activeId, open: openDetail, close: closeDetail } = useDetailDrawer();
 
+  function handleClearFilters() {
+    search.reset();
+    setListState(laundryListFiltersCleared);
+  }
+
+  // Until the order page cutover (#161), a row opens the drawer, so
+  // weighing, pricing and lifecycle actions stay reachable. A search still
+  // waiting to commit goes into the same navigation, so it is not lost and
+  // cannot later replace the URL without `detail`.
+  function handleRowClick(row: LaundryOrderRow) {
+    const pendingSearch = search.takePending();
+    const params = requestParams((current) =>
+      pendingSearch === undefined ? current : withLaundryFilterChange(current, { search: pendingSearch }),
+    );
+    openDetail(row.id, params);
+  }
+
   const [formOpen, setFormOpen] = useState(false);
   const [customerId, setCustomerId] = useState('');
   const [fulfillmentType, setFulfillmentType] =
@@ -215,53 +239,47 @@ function LaundryPageContent() {
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
+        onRowClick={handleRowClick}
+        filters={{ fulfillment: listState.fulfillment, search: search.draft, status: listState.status }}
+        filtersActive={hasActiveLaundryFilters(listState) || search.draft.trim() !== ''}
+        onSearchChange={search.change}
+        onStatusChange={(status) => setListState((current) => withLaundryFilterChange(current, { status }))}
+        onFulfillmentChange={(fulfillment) =>
+          setListState((current) => withLaundryFilterChange(current, { fulfillment }))
+        }
+        onClearFilters={handleClearFilters}
+        sort={{ direction: listState.sortOrder, key: listState.sortBy }}
+        onSortChange={(next) => setListState((current) => withLaundrySort(current, next))}
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

- [ ] **Step 7: Run them to see them pass, then run the app checks**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx` — Expected: `Tests 12 passed (12)`.
Run: `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit -p .`, `pnpm --filter web build` — Expected: all pass (649 tests at pre-validation), no lint or tsc output, and the Next build completes.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/app/laundry/page.tsx apps/web/lib/laundry-list-page.test.tsx apps/web/lib/laundry-list-page.interaction.test.tsx apps/web/lib/use-laundry-search-draft.ts apps/web/lib/use-detail-drawer.ts
git commit -m "feat(web): redesign the laundry order list with server search, filters and sort (#163)"
```

---

## Final verification (before the M6 handoff report)

- [ ] **Changed-file allowlist.** Any path outside the File Map fails verification:

```bash
expected='apps/api/test/laundry-order-list-filters.e2e-spec.ts
apps/web/app/app/laundry/page.tsx
apps/web/lib/laundry-list-page.interaction.test.tsx
apps/web/lib/laundry-list-page.test.tsx
apps/web/lib/laundry-order-list-query.test.ts
apps/web/lib/laundry-order-list-query.ts
apps/web/lib/laundry-page-baseline.test.tsx
apps/web/lib/use-detail-drawer.ts
apps/web/lib/use-laundry-order-list-url-state.test.ts
apps/web/lib/use-laundry-order-list-url-state.ts
apps/web/lib/use-laundry-search-draft.ts
packages/client/src/generated/graphql.ts
packages/client/src/operations/laundry.graphql
packages/web/src/i18n/messages/en/laundry.ts
packages/web/src/index.ts
packages/web/src/laundry/laundry-order-data-table.test.tsx
packages/web/src/laundry/laundry-order-data-table.tsx
packages/web/src/laundry/laundry-order-sort.test.ts
packages/web/src/laundry/laundry-order-sort.ts'
actual=$(git diff --name-only --no-renames 8cdd6b1...HEAD -- . ':!docs' | sort)
if [ "$actual" = "$(printf '%s\n' "$expected" | sort)" ]; then echo "allowlist OK"; else echo "allowlist FAILED"; diff <(printf '%s\n' "$expected" | sort) <(printf '%s\n' "$actual"); false; fi
```

Expected: `allowlist OK`.

- [ ] **Mutation checks.** Apply each mutation alone, run the named test file, confirm the stated failure, then revert.

  | # | File: replace → with | Test file | Expected |
  | --- | --- | --- | --- |
  | 1 | `use-laundry-order-list-url-state.ts`: `return changed ? { ...next, offset: 0 } : state;` → `return changed ? next : state;` | `lib/use-laundry-order-list-url-state.test.ts` | 3 failed |
  | 2 | `use-laundry-order-list-url-state.ts`: `const offset = Number.isSafeInteger(page) && page >= 1 ? (page - 1) * LAUNDRY_ORDER_PAGE_SIZE : 0;` → `const offset = Math.max(0, page - 1) * LAUNDRY_ORDER_PAGE_SIZE;` | `lib/use-laundry-order-list-url-state.test.ts` | 1 failed |
  | 3 | `laundry-order-list-query.ts`: `if (UUID.test(state.search)) {` → `if (true) {` | `lib/laundry-order-list-query.test.ts` | 10 failed |
  | 4 | `page.tsx`: `canCreate ? (` → `true ? (` | `lib/laundry-list-page.test.tsx` | 1 failed |
  | 5 | `laundry-order-sort.ts`: delete the line `if (clicked === DEFAULT_LAUNDRY_ORDER_SORT.key) return { direction: 'asc', key: clicked };` | `src/laundry/laundry-order-sort.test.ts` (in `packages/web`) | 2 failed |
  | 6 | `laundry-order-sort.ts`: `return isLaundryOrderSortKey(reported.key) ? reported.key : undefined;` → `return reported.key as LaundryOrderSortKey;` | `src/laundry/laundry-order-sort.test.ts` | 1 failed |
  | 7 | `use-laundry-order-list-url-state.ts`: `pending.current.at(-1) ?? window.location.search` → `window.location.search` | `lib/laundry-list-page.interaction.test.tsx` | 1 failed |
  | 8 | `page.tsx`: `openDetail(row.id, params);` → `void params; openDetail(row.id);` | `lib/laundry-list-page.interaction.test.tsx` | 1 failed |
  | 9 | `use-laundry-order-list-url-state.ts`: `${params.toString()}${window.location.hash}` → `${params.toString()}` | `lib/laundry-list-page.interaction.test.tsx` | 1 failed |
  | 10 | `use-laundry-search-draft.ts`: delete the `setDraft((current) => …)` line in the sync effect | `lib/laundry-list-page.interaction.test.tsx` | 1 failed |
  | 11 | `use-laundry-search-draft.ts`: delete `if (pendingText.current !== undefined) return;` | `lib/laundry-list-page.interaction.test.tsx` | 1 failed |
  | 12 | `laundry-order-data-table.tsx`: `onSortChange(nextLaundryOrderSort(sort, clicked))` → `onSortChange(reported as never)` | `lib/laundry-list-page.interaction.test.tsx` | 1 failed |

  After reverting, run `pnpm --filter web exec vitest run lib/use-laundry-order-list-url-state.test.ts lib/laundry-order-list-query.test.ts lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx` — Expected: `Tests 55 passed (55)`. Then run `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-sort.test.ts src/laundry/laundry-order-data-table.test.tsx` — Expected: `Tests 25 passed (25)`.
- [ ] **Full suites.** The Task 1 e2e command, `pnpm --filter @clensy/client build`, and `test`, `build` and `lint` for `@clensy/web` and `web` all pass.
- [ ] **Manual responsive and browser check (recorded in the M6 report).** Static and jsdom tests cannot prove layout. Run the app (`pnpm dev`, or the running `clensy-platform-web-1` container) and check:
  - At 375 px wide, `/app/laundry` shows cards with no horizontal page scroll, and the toolbar stacks.
  - At ≥ 640 px, it shows the table and the toolbar is a row.
  - Typing a customer name narrows the list after a pause. Choosing a status or fulfillment returns to page 1.
  - Refresh restores the filters.
  - Created toggles asc/desc. Status goes asc → desc → back to newest first.
  - A row opens the drawer, and closing it returns to the filtered list.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Server-side customer-name filter | §8.4.4; issue §Search and filters | 1, 2, 5, 6 |
| Status and fulfillment filters | §8.4.4 | 1, 3, 5, 6 |
| Sort on `LaundryOrderSortFields` only, `id ASC` tie-breaker, reset to page 1 | §8.4.4; issue §Columns | 1, 3, 4, 5, 6 |
| Human status and fulfillment labels; §4.9 tones | §8.4.4, §4.9 | 3 |
| `formatMinorUnits`; kilograms from integer grams | §8.4.4 | 3, 6 |
| Offset page size 20, `totalCount` | §8.4.4; paginated-collections spec | 4, 5, 6 |
| Row opens `/app/laundry/[id]` | §8.4.4 | **Deferred to #161** (Cutover); drawer retained, pinned in Task 6 |
| Create button only for intake roles | §4.4 (`receiveLaundryOrder` INTAKE); issue §Page structure | 6 |
| Filters in the URL; `detail` not reused, and preserved | issue §Search and filters | 4, 6 |
| Mobile cards, no horizontal overflow | issue §Mobile | 3; manual check |
| Loading, empty, filtered-empty, error states | issue §States | 3, 6 |
| Labelled search and native selects | issue §Accessibility | 3 |
| Exact-id search only, by spike | issue §Search and filters | Spike result; 1, 5 |
| Created as `toLocaleString()`; no date library | issue §Columns | 3 |

## Deferred (not in this plan)

- Row → `/app/laundry/[id]`, drawer removal, and the `?detail=` redirect (#161, after #156).
- The create modal contents and its success navigation (#160).
- A mobile sort control (Review Focus 5).
- Partial order-id search. It would need a schema-level change, which the issue rules out.
- Sorting by weight or total (not in `LaundryOrderSortFields`). Sorting customers by name (the server has no such sort field).
- A fixed locale or timezone for Created (a product decision beyond #163).

## Execution risks (operational only)

- The e2e suite needs the local Postgres with migrations applied. It writes rows into the shared bootstrap tenant. Assertions are scoped by a per-run tag, so repeated runs do not collide.
- `toLocaleString()` output depends on the runner's timezone and locale. Tests compare against the runner's own `toLocaleString()`, never a literal date string.

## Gate outcomes

*(Appended after M5.)*
