# Laundry Intake Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | **Draft** (M4). Awaiting Plan Review (M5). |
| Date | 2026-10-13 |
| Tracking issue | [#160](https://github.com/rexescario-dev/clensy-platform/issues/160) "Redesign the laundry order creation modal". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#157](https://github.com/rexescario-dev/clensy-platform/issues/157) (closed; shared `laundry` copy, `canReceiveLaundryOrder`) and [#163](https://github.com/rexescario-dev/clensy-platform/issues/163) (closed; the list and its create button, merged in #170). Cutover navigation is [#161](https://github.com/rexescario-dev/clensy-platform/issues/161) (open). The order page is [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (open). |
| Branch | `feat/160-laundry-intake-modal`, from `main` at `47503f5`. One PR for this plan, its M5 record and the implementation. |
| Scope | `packages/web` (two presentational components, `laundry` copy, exports, static tests), `apps/web` (new intake dialog component, customer-search module, page wiring, tests), one new `apps/api/test` e2e characterization file. No API source, schema, migration, GraphQL operation, generated client, or `@clensy/ui` change. No new dependency. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: §8.4.4, second bullet: "Intake stays a `FormDialog` on the list. Customer selection can reach any customer the customers query returns, not only the first 100. Fulfillment is `PICKUP` (customer pickup) or `DELIVERY`, chosen at intake and immutable. The form says that the choice is fixed and that delivery does not schedule a route. Creating a customer inline is out of scope. Success opens `/app/laundry/[id]` for the new order." Also §8.2 ("No inline customer creation in the intake modal"), §8.6 (deferral of inline customer creation), §4.4 (`receiveLaundryOrder` RBAC: OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT). |
| Relies on (Accepted, merged) | [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157): `canReceiveLaundryOrder`, `LaundryFulfillmentType`, the `laundry` message catalog. [Laundry Order List plan](2026-10-10-laundry-order-list-plan.md) (#163): `escapeLikePattern`, `useDetailDrawer().openWithHref`, `hrefFor`, the native-History create-success open, and the jsdom page harness. [Role-aware typed URLs](../specs/2026-10-04-role-aware-typed-urls-design.md): `canViewPath`. [Clensy validation](../specs/2026-09-15-clensy-validation-design.md): `clensyResolver`, `normalizeApiValidationErrors`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #160 refines the spec's bullet with copy, layout and test requirements; it adds no product semantics beyond §8.4.4. File names, component and hook names, copy keys, element ids and task order are planning decisions, not product semantics. |
| Edit anchors | New files are given in full. Edits to existing files are given against `main` at `47503f5`. Apply each by the quoted code, not by line number. |
| Pre-validation | **None claimed.** Two read-only spikes ran at planning time and are recorded under [Planning spikes](#planning-spikes); no task's `Expected:` commands were run. |
| M7 | Application code changes, so `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. |

**Goal:** Replace the intake dialog on `/app/laundry` with the one §8.4.4 describes: a searchable customer picker that reaches every customer by name (not the first 100), an explained, fixed-at-intake fulfillment choice, `react-hook-form` validation, an in-dialog failure alert, one mutation per submit, and a success toast. Until the cutover (#161), a successful create still opens the existing drawer on the new order so it can be weighed.

**Architecture:**

- **Presentational pieces in `@clensy/web`** (the #163 `LaundryOrderDataTable` precedent: props-driven, copy from the `laundry` namespace, no `@clensy/client` import):
  - `LaundryCustomerPicker`: a WAI-ARIA combobox built from a native `<input>` and a `role="listbox"` popup. It owns only open/closed and the active option. The caller owns the text, the options, the search status and the selection.
  - `LaundryFulfillmentFieldset`: a `fieldset`/`legend` with two native radios, each with its label and description.
- **Data and form in `apps/web`:**
  - `lib/use-laundry-customer-search.ts`: the GraphQL variables (`fullName.iLike`, limit 20, escaped like the list) and a hook that debounces the text 300 ms and maps the query to `idle | loading | error | ready`. An empty text sends no query (`skip`).
  - `components/laundry/create-laundry-order-dialog.tsx`: `FormDialog` + `react-hook-form` + `clensyResolver`, the `receiveLaundryOrder` mutation, server field errors via `normalizeApiValidationErrors`, the generic `role="alert"`, and a synchronous in-flight guard.
  - `app/app/laundry/page.tsx`: opens the dialog (a new React `key` per opening resets it), shows the "Add a customer" link only when `canViewPath(principal, '/app/customers')`, and on success closes, toasts, refreshes and opens the drawer with `openWithHref` exactly as today.
- **Escape inside the dialog.** `Modal` closes on a `document`-level `keydown` Escape. The picker stops propagation of Escape only while its list is open, so the first Escape closes the list and the next one closes the dialog.

**Tech Stack:** React 19, Next.js 16 app router, Apollo Client (`@clensy/client` generated hooks), `react-hook-form` 7, `@clensy/validation`, Tailwind, Vitest (`renderToStaticMarkup` in `packages/web`; jsdom in `apps/web`), Jest + supertest e2e in `apps/api`.

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4 (with §8.2, §8.6, §4.4).

## Global Constraints

Derived from the Accepted spec and issue #160. Every task's requirements implicitly include this section.

- **SHALL** keep intake a `FormDialog` on the list (`Modal` + form + Cancel / submit), at the existing modal width (`max-w-lg`). No full-page wizard, no second page. Content stays `flex flex-col gap-4` (provided by `FormDialog`).
- **SHALL** title the dialog "New laundry order"; submit "Create order", and "Creating…" while submitting.
- **SHALL** search customers on the server: `customers(filter: { fullName: { iLike: "%<text>%" } }, paging: { limit: 20 })`, debounced ~300 ms, with `%`, `_` and `\` escaped as the list does. **SHALL NOT** query `customers` with `limit: 100` or unfiltered.
- **SHALL** show `fullName` with `phone`, or `email` when `phone` is empty, as `text-sm text-slate-500` secondary text.
- **SHALL** give the input `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; the list `role="listbox"`; each row `role="option"`. ArrowUp/ArrowDown move the active option, Enter selects, Escape closes the list.
- **SHALL** show "Searching…" (one line in the list), "No customers match.", and "Unable to search customers." inline. No full-page `LoadingState`.
- **SHALL** require a customer with the message "Select a customer.", through `react-hook-form` + `clensyResolver`. Server field errors map through `normalizeApiValidationErrors`. Any other failure shows "Unable to create laundry order." with `role="alert"` inside the dialog, keeps the fields and re-enables submit.
- **SHALL** render fulfillment as a `fieldset` with `legend` "Fulfillment", helper "This choice is fixed at intake.", and two native radios: `PICKUP` "Customer pickup" / "The customer collects the finished laundry."; `DELIVERY` "Delivery" / "The shop returns the finished laundry. This does not schedule a route." Rows `rounded-md border px-3 py-2`, `border-slate-300`, selected `border-slate-900`, `sm:grid sm:grid-cols-2 sm:gap-3`. Default `PICKUP`. Required.
- **SHALL NOT** add inline customer creation (spec §8.2, §8.6). An "Add a customer" link to `/app/customers` shows only when `canViewPath` allows that path. No nested dialog. No customer-create permission logic in this modal.
- **SHALL** call `receiveLaundryOrder({ customerId, fulfillmentType })`, the existing mutation. **SHALL NOT** add or change any GraphQL operation, resolver, schema or migration.
- **SHALL** on success close the dialog, `useToast().success("Laundry order created.")`, and open the existing drawer for the new id via `openWithHref` (pre-cutover). The `/app/laundry/[id]` navigation is #161's. The PR body MUST say so (see Task 6).
- **SHALL** send at most one mutation per submit, including two submits fired before React re-renders.
- **SHALL** reset customer, fulfillment (`PICKUP`) and errors on every opening.
- **SHALL** keep the create button limited to `canReceiveLaundryOrder` (FINANCE and ANALYST never see it; unchanged from #163).
- **SHALL** put every new user-facing string in `packages/web/src/i18n/messages/en/laundry.ts` and read it with `useClensyTranslations('laundry')`. Fulfillment labels reuse the existing `fulfillment.PICKUP` / `fulfillment.DELIVERY` keys.
- **SHALL NOT** modify `@clensy/ui`, `apps/api/src`, `apps/api/src/schema.gql`, any migration, `packages/client`, or `docs/workflows/**`. Add no dependency. `@clensy/web` does not import `@clensy/client`.
- **SHALL NOT** change the list, the drawer, `useDetailDrawer`, or the URL state. The page's only changes are the intake block, its imports, and the success handler.

## Review Focus

Inputs and conditions the spec implies that a person will meet. Each has a test in the owning task.

1. **Typing after a selection.** A user picks "Ana Reyes", then edits the text to "Ana R". The input no longer names the chosen customer, so the selection must clear and submit must say "Select a customer." rather than create an order for a customer the input no longer shows. (The issue states the clearing case; any edit is treated the same.) → Task 5, `clears the selection when the text changes after choosing`.
2. **Escape with the list open.** Escape must close the list, not the whole dialog and the typed text with it. → Task 3 (`closes the list with Escape...`) and Task 5 (`closes the list, then the dialog`).
3. **Namesakes.** Two customers with the same name must be told apart by phone, or email when phone is empty. → Task 3 static test, Task 1 e2e.
4. **A search still in flight or a stale result.** Results for "an" must not be selectable as results for "ana" once the text has changed; while the debounced text differs from the input, the list shows "Searching…" and no options. → Task 4 hook status, Task 5 `shows Searching…, then results`.
5. **Wildcard characters in a name.** "50% Off" is matched literally. → Task 4 variables test (escaping reuses the list's `escapeLikePattern`, already e2e-pinned for `%` in `laundry-order-list-filters.e2e-spec.ts`).

## Planning spikes

Read-only checks run at planning time, for M5. They are not pre-validation of any task.

- **Baseline suites at `47503f5`:** `pnpm --filter web test` → 29 files, 712 tests passed. `pnpm --filter @clensy/web test` → 13 files, 402 tests passed.
- **`next/link` under jsdom:** a throwaway `apps/web/lib` test rendered `<Link href="/app/customers">` with `next/navigation` mocked as the page harness mocks it. It rendered `href="/app/customers"` and passed. The file was deleted.
- **Customers query:** `packages/client/src/operations/customers.graphql` already declares `$filter: CustomerFilter` and `$sorting`; `CustomerFilter.fullName` is a `StringFieldComparison` (has `iLike`); `CustomerSortFields` includes `fullName` and `id`; nodes carry non-null `email` and `phone`. No client change or regeneration is needed.
- **RBAC:** `customer.type.ts` `VIEW_ROLES` (mirrored in `nav-groups.ts`) include every intake role (TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT), so `canViewPath` shows the link to all of them. `createCustomer` is OWNER, OPS_MANAGER, CUSTOMER_SUPPORT; a SCHEDULER `createCustomer` → `FORBIDDEN` is already e2e-pinned in `customers-properties.e2e-spec.ts` and is not duplicated here.
- **Escape:** `useDialogBehavior` listens for Escape on `document` (bubble). React 19 dispatches from the root container, so a synthetic `stopPropagation()` on the input's `keydown` keeps the event from `document`. Task 3 and Task 5 pin this.
- **Validation:** `required` treats `''` as empty (`packages/validation/src/rules.ts`, `isEmpty`). `formatMessage` substitutes `:attribute` from `options.attributes`, so a template of `':attribute'` with a per-field attribute prints a whole localized sentence per field.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/api/test/laundry-intake-customer-search.e2e-spec.ts` | Create | Characterization: SCHEDULER name search (paged, namesakes distinguishable) and SCHEDULER intake. |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify | `create.*` copy. |
| `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx` (+ `.test.tsx`) | Create | Fulfillment fieldset. |
| `packages/web/src/laundry/laundry-customer-picker.tsx` (+ `.test.tsx`) | Create | Combobox markup and keyboard. |
| `packages/web/src/index.ts` | Modify | Export both components and their types. |
| `apps/web/lib/laundry-customer-picker.interaction.test.tsx` | Create | jsdom keyboard, mouse, blur and Escape tests of the picker. |
| `apps/web/lib/use-laundry-customer-search.ts` (+ `.test.ts`) | Create | Search variables, debounce, status. |
| `apps/web/components/laundry/create-laundry-order-dialog.tsx` | Create | The intake form. |
| `apps/web/app/app/laundry/page.tsx` | Modify | Mount the dialog, link visibility, success handler. |
| `apps/web/lib/laundry-list-page.test.tsx` | Modify | Wrap in `ToastProvider`. |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Modify | Mocks, the existing create-race test, new intake tests. |

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Intake stays a `FormDialog`; title, labels, width | §8.4.4; #160 §Modal | 5 |
| Any customer reachable, not the first 100 | §8.4.4; #160 §Customer, AC1 | 1, 4, 5 |
| Searchable picker, keyboard, ARIA, states | #160 §Customer, §Accessibility | 3, 5 |
| Required customer, server errors, alert | #160 §Customer, §Submit | 5 |
| Fulfillment explained, fixed at intake, no route | §8.4.4; #160 §Fulfillment, AC2 | 2 |
| No inline customer creation; link gated by `canViewPath` | §8.2, §8.6; #160 §Inline customer creation, AC5 | 1, 5 |
| `receiveLaundryOrder`; no new mutation | §4.4; #160 AC6 | 1, 5 |
| Success: close, toast, drawer until #161 | §8.4.4 (navigation at #161); #160 §Submit, AC3 | 5, 6 |
| One mutation per submit | #160 §Submit, AC4 | 5 |
| Reset on open | #160 §States | 5 |
| FINANCE / ANALYST see no create button | §4.4; #160 §States | existing `laundry-list-page.test.tsx` (unchanged, re-run in 6) |

## Deferred (not in this plan)

- Navigating to `/app/laundry/[id]` on success, and removing the drawer: #161 (after #156).
- Inline customer creation: spec §8.6.
- Editing fulfillment after create, the customer form, and order-page sections: #160 §Out of scope.

---

### Task 1: Characterize the API reads and writes intake relies on

**Characterization test.** It pins behavior that already works and is expected to pass on first run. No API code changes.

**Files:**
- Create: `apps/api/test/laundry-intake-customer-search.e2e-spec.ts`

**Interfaces:**
- Consumes: `seedTenantAdmin(dataSource, role, tenantId)` from `apps/api/test/helpers/seed-tenant-admin.ts`; `BOOTSTRAP_TENANT_ID`; the `login`, `createCustomer`, `customers`, `receiveLaundryOrder`, `laundryOrder` GraphQL operations.
- Produces: nothing used by later tasks.

- [ ] **Step 1: Write the test**

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedTenantAdmin } from './helpers/seed-tenant-admin';

// Characterization (#160): pins the existing reads and writes the laundry
// intake modal relies on, as a SCHEDULER: the one intake role that cannot
// create customers (its createCustomer FORBIDDEN is pinned in
// customers-properties.e2e-spec.ts). No API code changes in #160. Names
// carry a per-run tag, because the bootstrap tenant is shared across suites
// and runs.
describe('laundry intake customer search (e2e)', () => {
  let app: INestApplication<App>;
  let ownerCookie: string;
  let schedulerCookie: string;
  let tag: string;
  const customerIds = { anaFirst: '', anaSecond: '' };

  const SEARCH = `query($f: CustomerFilter, $p: OffsetPaging, $s: [CustomerSort!]) {
    customers(filter: $f, paging: $p, sorting: $s) {
      totalCount
      nodes { id fullName email phone }
    }
  }`;

  function gql(cookie: string, query: string, variables?: object) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation L($i: LoginInput!) { login(loginInput: $i) { success } }`,
        variables: { i: { email, password } },
      });
    return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  }

  async function customer(name: string, slug: string, phone: string): Promise<string> {
    const res = await gql(
      ownerCookie,
      `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
      { i: { email: `${slug}-${tag}@example.com`, fullName: `${name} ${tag}`, phone } },
    );
    expect(res.body.errors).toBeUndefined();
    return res.body.data.createCustomer.id;
  }

  // The modal's variables (apps/web/lib/use-laundry-customer-search.ts).
  function searchVariables(text: string, limit = 20) {
    return {
      f: { fullName: { iLike: `%${text}%` } },
      p: { limit },
      s: [
        { direction: 'ASC', field: 'fullName' },
        { direction: 'ASC', field: 'id' },
      ],
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    const dataSource = moduleFixture.get(DataSource);
    const owner = await seedTenantAdmin(dataSource, Role.TENANT_OWNER, BOOTSTRAP_TENANT_ID);
    const scheduler = await seedTenantAdmin(dataSource, Role.SCHEDULER, BOOTSTRAP_TENANT_ID);
    ownerCookie = await login(owner.email, owner.password);
    schedulerCookie = await login(scheduler.email, scheduler.password);
    tag = `${scheduler.id.slice(0, 8)}${Date.now()}`;

    customerIds.anaFirst = await customer('Ana Reyes', 'ana-first', '555-0101');
    customerIds.anaSecond = await customer('Ana Reyes', 'ana-second', '555-0102');
    await customer('Ben Cruz', 'ben', '555-0103');
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds customers by a case-insensitive name fragment for a SCHEDULER, with phone and email for namesakes', async () => {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(`ana reyes ${tag}`));
    expect(res.body.errors).toBeUndefined();
    const { nodes, totalCount } = res.body.data.customers;
    expect(totalCount).toBe(2);
    expect(nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [customerIds.anaFirst, customerIds.anaSecond].sort(),
    );
    expect(nodes.map((node: { phone: string }) => node.phone).sort()).toEqual(['555-0101', '555-0102']);
    expect(new Set(nodes.map((node: { email: string }) => node.email)).size).toBe(2);
  });

  it('pages the filtered result on the server, so the limit never hides a match from the count', async () => {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(`ana reyes ${tag}`, 1));
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.customers.nodes).toHaveLength(1);
    expect(res.body.data.customers.totalCount).toBe(2);
  });

  it('lets a SCHEDULER receive an order for a customer found by search', async () => {
    const received = await gql(
      schedulerCookie,
      `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
      { i: { customerId: customerIds.anaSecond, fulfillmentType: 'DELIVERY' } },
    );
    expect(received.body.errors).toBeUndefined();
    const id = received.body.data.receiveLaundryOrder.id;
    const read = await gql(
      schedulerCookie,
      `query($id: ID!){ laundryOrder(id:$id){ id status fulfillmentType customer { id } } }`,
      { id },
    );
    expect(read.body.errors).toBeUndefined();
    expect(read.body.data.laundryOrder).toEqual({
      id,
      customer: { id: customerIds.anaSecond },
      fulfillmentType: 'DELIVERY',
      status: 'RECEIVED',
    });
  });
});
```

- [ ] **Step 2: Run it (characterization: expected to pass first time)**

Run: `pnpm --filter api test:e2e -- laundry-intake-customer-search`
Expected: PASS, 3 tests. If any fails, **stop**: the API does not behave as the spec and the #160 issue assume, and M6 must report it rather than change API code.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/laundry-intake-customer-search.e2e-spec.ts
git commit -m "test(api): characterize the customer search and intake the laundry modal relies on (#160)"
```

---

### Task 2: Intake copy and the fulfillment fieldset

**Files:**
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Create: `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx`
- Create: `packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `LaundryFulfillmentType` (`./laundry-order-status`), `useClensyTranslations`.
- Produces: `LaundryFulfillmentFieldset({ name, onChange, value })`, `LaundryFulfillmentFieldsetProps`; copy keys under `laundry.create.*` used by Tasks 3 and 5:
  `create.addCustomer`, `create.creating`, `create.customer.{empty,error,label,required,searching}`, `create.failure`, `create.fulfillment.{description.DELIVERY,description.PICKUP,fixed,legend,required}`, `create.submit`, `create.success`, `create.title`.

- [ ] **Step 1: Write the failing test**

`packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryFulfillmentFieldset } from './laundry-fulfillment-fieldset';

const noop = () => {};

// Static markup, as in the other @clensy/web tests. Clicks are covered by
// apps/web's jsdom page test.
describe('LaundryFulfillmentFieldset', () => {
  it('explains both options and says the choice is fixed at intake', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    expect(html).toContain('<legend');
    expect(html).toContain('>Fulfillment</legend>');
    expect(html).toContain('This choice is fixed at intake.');
    expect(html).toContain('Customer pickup');
    expect(html).toContain('The customer collects the finished laundry.');
    expect(html).toContain('>Delivery<');
    expect(html).toContain('The shop returns the finished laundry. This does not schedule a route.');
  });

  it('uses two real radios in one group, each labelled and described', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    for (const option of ['PICKUP', 'DELIVERY']) {
      const input = new RegExp(`<input[^>]*id="fulfillment-${option}"[^>]*>`).exec(html)?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="fulfillment"');
      expect(input).toContain(`value="${option}"`);
      expect(input).toContain(`aria-describedby="fulfillment-${option}-description"`);
      expect(html).toContain(`for="fulfillment-${option}"`);
      expect(html).toContain(`id="fulfillment-${option}-description"`);
    }
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed"/);
  });

  it('checks the current value and borders the selected row darker', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="DELIVERY" onChange={noop} />);
    expect(/<input[^>]*id="fulfillment-DELIVERY"[^>]*>/.exec(html)?.[0]).toContain('checked=""');
    expect(/<input[^>]*id="fulfillment-PICKUP"[^>]*>/.exec(html)?.[0]).not.toContain('checked');
    expect(/<label[^>]*for="fulfillment-DELIVERY"[^>]*>/.exec(html)?.[0]).toContain('border-slate-900');
    expect(/<label[^>]*for="fulfillment-PICKUP"[^>]*>/.exec(html)?.[0]).toContain('border-slate-300');
    expect(html).toContain('rounded-md border px-3 py-2');
    expect(html).toContain('sm:grid sm:grid-cols-2 sm:gap-3');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-fulfillment-fieldset.test.tsx`
Expected: FAIL — cannot resolve `./laundry-fulfillment-fieldset`.

- [ ] **Step 3: Add the copy**

In `packages/web/src/i18n/messages/en/laundry.ts`, insert after the `confirm` block (keys stay in `sort-keys` order):

```ts
  create: {
    addCustomer: 'Add a customer',
    creating: 'Creating…',
    customer: {
      empty: 'No customers match.',
      error: 'Unable to search customers.',
      label: 'Customer',
      required: 'Select a customer.',
      searching: 'Searching…',
    },
    failure: 'Unable to create laundry order.',
    fulfillment: {
      description: {
        DELIVERY: 'The shop returns the finished laundry. This does not schedule a route.',
        PICKUP: 'The customer collects the finished laundry.',
      },
      fixed: 'This choice is fixed at intake.',
      legend: 'Fulfillment',
      required: 'Select how the finished laundry comes back.',
    },
    submit: 'Create order',
    success: 'Laundry order created.',
    title: 'New laundry order',
  },
```

`create.fulfillment.required` is never shown in practice (a radio is always checked); it exists so the `required` rule never falls back to untranslated English.

- [ ] **Step 4: Write the component**

`packages/web/src/laundry/laundry-fulfillment-fieldset.tsx`:

```tsx
'use client';

import { useClensyTranslations } from '../i18n/use-clensy-translations';
import type { LaundryFulfillmentType } from './laundry-order-status';

export interface LaundryFulfillmentFieldsetProps {
  name: string;
  onChange: (value: LaundryFulfillmentType) => void;
  value: LaundryFulfillmentType;
}

const OPTIONS: readonly LaundryFulfillmentType[] = ['PICKUP', 'DELIVERY'];

// How the finished laundry comes back, chosen once at intake (lifecycle spec
// §8.4.4: immutable after create; delivery does not schedule a route). Two
// native radios in a fieldset; each whole row is the radio's label.
export function LaundryFulfillmentFieldset({ name, onChange, value }: LaundryFulfillmentFieldsetProps) {
  const t = useClensyTranslations('laundry');
  const helperId = `${name}-fixed`;

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={helperId}>
      <legend className="text-sm font-medium text-slate-700">{t('create.fulfillment.legend')}</legend>
      <p id={helperId} className="text-sm text-slate-500">
        {t('create.fulfillment.fixed')}
      </p>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
        {OPTIONS.map((option) => {
          const inputId = `${name}-${option}`;
          const descriptionId = `${inputId}-description`;
          const checked = value === option;
          return (
            <label
              key={option}
              htmlFor={inputId}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${checked ? 'border-slate-900' : 'border-slate-300'}`}
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={option}
                checked={checked}
                required
                aria-describedby={descriptionId}
                onChange={() => onChange(option)}
                className="mt-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">{t(`fulfillment.${option}`)}</span>
                <span id={descriptionId} className="text-sm text-slate-500">
                  {t(`create.fulfillment.description.${option}`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 5: Export it**

In `packages/web/src/index.ts`, after the `LaundryOrderProgress` exports:

```ts
export { LaundryFulfillmentFieldset } from './laundry/laundry-fulfillment-fieldset';
export type { LaundryFulfillmentFieldsetProps } from './laundry/laundry-fulfillment-fieldset';
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web build`
Expected: all pass (the new file's 3 tests included); lint clean (`sort-keys` on the catalog); `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/i18n/messages/en/laundry.ts packages/web/src/laundry/laundry-fulfillment-fieldset.tsx packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx packages/web/src/index.ts
git commit -m "feat(web): explain the laundry fulfillment choice at intake (#160)"
```

---

### Task 3: The customer picker

**Files:**
- Create: `packages/web/src/laundry/laundry-customer-picker.tsx`
- Create: `packages/web/src/laundry/laundry-customer-picker.test.tsx`
- Modify: `packages/web/src/index.ts`
- Create: `apps/web/lib/laundry-customer-picker.interaction.test.tsx`

**Interfaces:**
- Consumes: Task 2's `create.customer.*` copy.
- Produces (Tasks 4–5 rely on these exact names):

```ts
export interface LaundryCustomerOption { id: string; email: string; fullName: string; phone: string }
export type LaundryCustomerSearchStatus = 'error' | 'idle' | 'loading' | 'ready';
export interface LaundryCustomerPickerProps {
  id: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange: (text: string) => void;
  onSelect: (option: LaundryCustomerOption) => void;
  options: readonly LaundryCustomerOption[];
  query: string;
  status: LaundryCustomerSearchStatus;
}
export function LaundryCustomerPicker(props: LaundryCustomerPickerProps): JSX.Element
```

Element ids: input `${id}`, listbox `${id}-listbox`, option `${id}-option-${option.id}`, error `${id}-error`.

- [ ] **Step 1: Write the failing static test**

`packages/web/src/laundry/laundry-customer-picker.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryCustomerPicker, type LaundryCustomerPickerProps } from './laundry-customer-picker';

const noop = () => {};
const ANA = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const ANA_NO_PHONE = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };

function render(props: Partial<LaundryCustomerPickerProps> = {}): string {
  return renderToStaticMarkup(
    <LaundryCustomerPicker
      id="customer"
      query="ana"
      options={[]}
      status="idle"
      onQueryChange={noop}
      onSelect={noop}
      {...props}
    />,
  );
}

function input(html: string): string {
  return /<input[^>]*>/.exec(html)![0];
}

// Static markup: the closed state, the popup's content (rendered `hidden`
// while closed) and the error wiring. Keyboard and mouse are covered by
// apps/web/lib/laundry-customer-picker.interaction.test.tsx.
describe('LaundryCustomerPicker', () => {
  it('labels a combobox that controls a listbox and starts collapsed', () => {
    const html = render();
    expect(html).toContain('<label for="customer"');
    expect(html).toContain('>Customer</label>');
    const field = input(html);
    expect(field).toContain('id="customer"');
    expect(field).toContain('role="combobox"');
    expect(field).toContain('aria-controls="customer-listbox"');
    expect(field).toContain('aria-expanded="false"');
    expect(field).toContain('aria-autocomplete="list"');
    expect(field).toContain('autoComplete="off"'.toLowerCase());
    expect(field).not.toContain('aria-activedescendant');
    expect(html).toMatch(/<ul[^>]*id="customer-listbox"[^>]*role="listbox"/);
  });

  it('lists each match with phone, or email when there is no phone, as secondary text', () => {
    const html = render({ options: [ANA, ANA_NO_PHONE], status: 'ready' });
    expect(html).toContain('id="customer-option-c1"');
    expect(html).toContain('id="customer-option-c2"');
    expect((html.match(/role="option"/g) ?? []).length).toBe(2);
    expect(html).toContain('<span class="block text-sm text-slate-500">555-0101</span>');
    expect(html).toContain('<span class="block text-sm text-slate-500">ana.r@example.com</span>');
  });

  it('shows one line for searching, no matches, and a failed search', () => {
    expect(render({ status: 'loading' })).toContain('Searching…');
    expect(render({ status: 'ready' })).toContain('No customers match.');
    const failed = render({ status: 'error' });
    expect(failed).toMatch(/role="alert"[^>]*>Unable to search customers\./);
    expect(render({ options: [ANA], status: 'ready' })).not.toContain('No customers match.');
    expect(render({ status: 'loading' })).not.toContain('role="option"');
  });

  it('wires a validation error to the input', () => {
    const html = render({ error: 'Select a customer.' });
    const field = input(html);
    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('aria-describedby="customer-error"');
    expect(field).toContain('border-red-500');
    expect(html).toContain('<p id="customer-error" class="text-sm text-red-600">Select a customer.</p>');
  });
});
```

(`renderToStaticMarkup` prints `autoComplete` as `autocomplete`; the assertion lowercases the literal for that reason.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-customer-picker.test.tsx`
Expected: FAIL — cannot resolve `./laundry-customer-picker`.

- [ ] **Step 3: Write the component**

`packages/web/src/laundry/laundry-customer-picker.tsx`:

```tsx
'use client';

import { useState, type KeyboardEvent, type Ref } from 'react';
import { useClensyTranslations } from '../i18n/use-clensy-translations';

export interface LaundryCustomerOption {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

export type LaundryCustomerSearchStatus = 'error' | 'idle' | 'loading' | 'ready';

export interface LaundryCustomerPickerProps {
  id: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange: (text: string) => void;
  onSelect: (option: LaundryCustomerOption) => void;
  options: readonly LaundryCustomerOption[];
  query: string;
  status: LaundryCustomerSearchStatus;
}

const INPUT_CLASSES =
  'rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

// The laundry intake customer search (#160). @clensy/ui has no Combobox and
// this slice adds no dependency, so this is the WAI-ARIA editable combobox
// with a listbox popup, built from a native input. It owns only whether the
// list is open and which option is active; the caller owns the text, the
// server search, the options and the selection. The label, input and error
// follow FormField's markup and classes.
//
// Escape closes an open list and stops there, so the surrounding Modal,
// which listens for Escape on `document`, stays open. With the list closed,
// Escape reaches the Modal as usual.
export function LaundryCustomerPicker({
  id,
  error,
  inputRef,
  onQueryChange,
  onSelect,
  options,
  query,
  status,
}: LaundryCustomerPickerProps) {
  const t = useClensyTranslations('laundry');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const expanded = open && status !== 'idle';
  const selectable = status === 'ready' ? options : [];
  const active = expanded && activeIndex < selectable.length ? activeIndex : -1;

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function select(option: LaundryCustomerOption) {
    onSelect(option);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = selectable.length;
      if (!expanded) {
        setOpen(true);
        setActiveIndex(count === 0 ? -1 : event.key === 'ArrowDown' ? 0 : count - 1);
        return;
      }
      if (count === 0) return;
      if (event.key === 'ArrowDown') setActiveIndex(active + 1 >= count ? 0 : active + 1);
      else setActiveIndex(active <= 0 ? count - 1 : active - 1);
      return;
    }
    if (event.key === 'Enter' && expanded) {
      // Enter belongs to the list while it is open; it never submits the form.
      event.preventDefault();
      if (active >= 0) select(selectable[active]);
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {t('create.customer.label')}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={expanded}
        aria-activedescendant={active >= 0 ? `${id}-option-${selectable[active].id}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(event.target.value.trim() !== '');
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
        className={`${INPUT_CLASSES} ${error ? 'border-red-500' : 'border-slate-300'}`}
      />
      <div
        hidden={!expanded}
        className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
      >
        <ul id={listboxId} role="listbox" aria-label={t('create.customer.label')} className="max-h-60 overflow-y-auto">
          {selectable.map((option, index) => {
            const secondary = option.phone !== '' ? option.phone : option.email;
            return (
              <li
                key={option.id}
                id={`${id}-option-${option.id}`}
                role="option"
                aria-selected={index === active}
                // Keeps focus in the input, so blur does not close the list
                // before the click selects.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
                className={`cursor-pointer px-3 py-2 ${index === active ? 'bg-slate-100' : ''}`}
              >
                <span className="block text-sm text-slate-900">{option.fullName}</span>
                <span className="block text-sm text-slate-500">{secondary}</span>
              </li>
            );
          })}
        </ul>
        {status === 'loading' ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.searching')}
          </p>
        ) : null}
        {status === 'ready' && options.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.empty')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p role="alert" className="px-3 py-2 text-sm text-red-600">
            {t('create.customer.error')}
          </p>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Export it**

In `packages/web/src/index.ts`, after the Task 2 exports:

```ts
export { LaundryCustomerPicker } from './laundry/laundry-customer-picker';
export type {
  LaundryCustomerOption,
  LaundryCustomerPickerProps,
  LaundryCustomerSearchStatus,
} from './laundry/laundry-customer-picker';
```

- [ ] **Step 5: Run the static test**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-customer-picker.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing keyboard test**

`apps/web/lib/laundry-customer-picker.interaction.test.tsx`:

```tsx
// @vitest-environment jsdom
import {
  LaundryCustomerPicker,
  type LaundryCustomerOption,
  type LaundryCustomerSearchStatus,
} from '@clensy/web';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real @clensy/web picker in jsdom: keyboard, mouse, blur, and
// Escape against a `document` listener standing in for Modal's.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS: LaundryCustomerOption[] = [
  { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' },
  { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' },
  { id: 'c3', email: 'ben@example.com', fullName: 'Ben Cruz', phone: '555-0103' },
];

let container: HTMLDivElement;
let root: Root;
let selected: string[];
const submits = vi.fn();
const documentEscapes = vi.fn();

function Harness({ status }: { status: LaundryCustomerSearchStatus }) {
  const [query, setQuery] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submits();
      }}
    >
      <LaundryCustomerPicker
        id="customer"
        query={query}
        options={OPTIONS}
        status={query.trim() === '' ? 'idle' : status}
        onQueryChange={setQuery}
        onSelect={(option) => {
          selected.push(option.id);
          setQuery(option.fullName);
        }}
      />
    </form>
  );
}

function field(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#customer')!;
}

function type(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Returns whether the event was not cancelled, as dispatchEvent does.
function press(key: string): boolean {
  let notCancelled = true;
  act(() => {
    notCancelled = field().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
  return notCancelled;
}

function render(status: LaundryCustomerSearchStatus = 'ready') {
  act(() => root.render(<Harness status={status} />));
}

// Stands in for Modal's `document`-level Escape listener.
function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') documentEscapes();
}

beforeAll(() => document.addEventListener('keydown', onDocumentKeyDown));
afterAll(() => document.removeEventListener('keydown', onDocumentKeyDown));

beforeEach(() => {
  selected = [];
  submits.mockReset();
  documentEscapes.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('LaundryCustomerPicker interactions', () => {
  it('opens the list as the user types and closes it on blur', () => {
    render();
    expect(field().getAttribute('aria-expanded')).toBe('false');
    type('an');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector<HTMLElement>('#customer-listbox')!.parentElement!.hidden).toBe(false);
    act(() => field().dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves the active option with ArrowDown and ArrowUp, wrapping at both ends', () => {
    render();
    type('a');
    const active = () => field().getAttribute('aria-activedescendant');
    expect(active()).toBeNull();
    press('ArrowDown');
    expect(active()).toBe('customer-option-c1');
    expect(container.querySelector('#customer-option-c1')!.getAttribute('aria-selected')).toBe('true');
    press('ArrowDown');
    expect(active()).toBe('customer-option-c2');
    press('ArrowDown');
    expect(active()).toBe('customer-option-c3');
    press('ArrowDown');
    expect(active()).toBe('customer-option-c1');
    press('ArrowUp');
    expect(active()).toBe('customer-option-c3');
  });

  it('selects the active option with Enter, and Enter does not reach the form', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(press('Enter')).toBe(false); // cancelled
    expect(selected).toEqual(['c2']);
    expect(field().value).toBe('Ana Reyes');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(submits).not.toHaveBeenCalled();
  });

  it('closes the list with Escape without letting the dialog see it, then lets the next Escape through', () => {
    render();
    type('a');
    press('Escape');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().value).toBe('a');
    expect(documentEscapes).not.toHaveBeenCalled();
    press('Escape');
    expect(documentEscapes).toHaveBeenCalledTimes(1);
  });

  it('selects an option by click, keeping focus in the input', () => {
    render();
    type('b');
    const option = container.querySelector<HTMLElement>('#customer-option-c3')!;
    let notCancelled = true;
    act(() => {
      notCancelled = option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(notCancelled).toBe(false);
    act(() => option.click());
    expect(selected).toEqual(['c3']);
    expect(field().value).toBe('Ben Cruz');
  });

  it('offers no option while a search is still running', () => {
    render('loading');
    type('a');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(container.textContent).toContain('Searching…');
    press('ArrowDown');
    expect(field().getAttribute('aria-activedescendant')).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
  });
});
```

- [ ] **Step 7: Run it**

Run: `pnpm --filter web exec vitest run lib/laundry-customer-picker.interaction.test.tsx`
Expected: PASS, 6 tests. (It was red until Steps 3–4 existed: `LaundryCustomerPicker` is not exported from `@clensy/web` on `main`. M6 MUST confirm red by running this step once with the Step 4 export temporarily reverted, and record it.)

- [ ] **Step 8: Lint, typecheck, full package tests**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web build && pnpm --filter web lint`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/laundry/laundry-customer-picker.tsx packages/web/src/laundry/laundry-customer-picker.test.tsx packages/web/src/index.ts apps/web/lib/laundry-customer-picker.interaction.test.tsx
git commit -m "feat(web): searchable laundry customer picker (#160)"
```

---

### Task 4: Customer search variables and debounce

**Files:**
- Create: `apps/web/lib/use-laundry-customer-search.ts`
- Create: `apps/web/lib/use-laundry-customer-search.test.ts`

**Interfaces:**
- Consumes: `escapeLikePattern` (`./laundry-order-list-query`), `useCustomersQuery`, `CustomersQueryVariables` (`@clensy/client`), `LaundryCustomerOption`, `LaundryCustomerSearchStatus` (`@clensy/web`, Task 3).
- Produces (Task 5):
  - `LAUNDRY_CUSTOMER_SEARCH_LIMIT = 20`, `LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS = 300`
  - `laundryCustomerSearchVariables(text: string): CustomersQueryVariables`
  - `useLaundryCustomerSearch(query: string): { options: readonly LaundryCustomerOption[]; status: LaundryCustomerSearchStatus }`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/use-laundry-customer-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS,
  LAUNDRY_CUSTOMER_SEARCH_LIMIT,
  laundryCustomerSearchVariables,
} from './use-laundry-customer-search';

describe('laundryCustomerSearchVariables', () => {
  it('filters fullName with a contains iLike, 20 at most, by name then id', () => {
    expect(laundryCustomerSearchVariables('ana')).toEqual({
      filter: { fullName: { iLike: '%ana%' } },
      paging: { limit: 20 },
      sorting: [
        { direction: 'ASC', field: 'fullName' },
        { direction: 'ASC', field: 'id' },
      ],
    });
    expect(LAUNDRY_CUSTOMER_SEARCH_LIMIT).toBe(20);
    expect(LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('matches %, _ and \\ literally, as the list search does', () => {
    expect(laundryCustomerSearchVariables('50% off_a\\b').filter).toEqual({
      fullName: { iLike: '%50\\% off\\_a\\\\b%' },
    });
  });
});
```

The hook's statuses are exercised through the page in Task 5 (debounce, Searching…, results, empty, error).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run lib/use-laundry-customer-search.test.ts`
Expected: FAIL — cannot resolve `./use-laundry-customer-search`.

- [ ] **Step 3: Implement**

`apps/web/lib/use-laundry-customer-search.ts`:

```ts
'use client';
import { useCustomersQuery, type CustomersQueryVariables } from '@clensy/client';
import type { LaundryCustomerOption, LaundryCustomerSearchStatus } from '@clensy/web';
import { useEffect, useState } from 'react';
import { escapeLikePattern } from './laundry-order-list-query';

export const LAUNDRY_CUSTOMER_SEARCH_LIMIT = 20;
export const LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

// The intake modal's customer search (lifecycle spec §8.4.4: any customer
// the customers query returns, not only the first 100). A contains match on
// the name, on the server, escaped like the list's own search.
export function laundryCustomerSearchVariables(text: string): CustomersQueryVariables {
  return {
    filter: { fullName: { iLike: `%${escapeLikePattern(text)}%` } },
    paging: { limit: LAUNDRY_CUSTOMER_SEARCH_LIMIT },
    sorting: [
      { direction: 'ASC', field: 'fullName' },
      { direction: 'ASC', field: 'id' },
    ],
  };
}

// The trimmed text is searched once typing pauses. An empty text sends no
// query. While the searched text lags the input, the status is `loading`
// and no option is offered, so a result for an older text is never chosen
// for the newer one.
export function useLaundryCustomerSearch(query: string): {
  options: readonly LaundryCustomerOption[];
  status: LaundryCustomerSearchStatus;
} {
  const text = query.trim();
  const [searched, setSearched] = useState(text);

  useEffect(() => {
    const timer = setTimeout(() => setSearched(text), LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const result = useCustomersQuery({
    fetchPolicy: 'network-only',
    skip: searched === '',
    variables: laundryCustomerSearchVariables(searched),
  });

  if (text === '') return { options: [], status: 'idle' };
  if (searched !== text || result.loading) return { options: [], status: 'loading' };
  if (result.error) return { options: [], status: 'error' };
  return { options: result.data?.customers.nodes ?? [], status: 'ready' };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter web exec vitest run lib/use-laundry-customer-search.test.ts && pnpm --filter web lint`
Expected: PASS, 2 tests; lint clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/use-laundry-customer-search.ts apps/web/lib/use-laundry-customer-search.test.ts
git commit -m "feat(web): server-side customer search for laundry intake (#160)"
```

---

### Task 5: The intake dialog on `/app/laundry`

**Files:**
- Create: `apps/web/components/laundry/create-laundry-order-dialog.tsx`
- Modify: `apps/web/app/app/laundry/page.tsx`
- Modify: `apps/web/lib/laundry-list-page.test.tsx`
- Modify: `apps/web/lib/laundry-list-page.interaction.test.tsx`

**Interfaces:**
- Consumes: Task 2 `LaundryFulfillmentFieldset` and copy; Task 3 `LaundryCustomerPicker`; Task 4 `useLaundryCustomerSearch`; `useReceiveLaundryOrderMutation`; `FormDialog`, `useToast`, `ToastProvider` (`@clensy/ui`); `clensyResolver`, `normalizeApiValidationErrors`, `Rules` (`@clensy/validation`); `canViewPath` (`apps/web/lib/nav-groups.ts`); the page's existing `hrefFor`, `openWithHref`, `ordersQuery`.
- Produces: `CreateLaundryOrderDialog({ onClose, onCreated, open, showAddCustomerLink })`. #161 changes only the page's `handleCreated`.

Element ids used by the tests: customer input `#laundry-customer`, error `#laundry-customer-error`, radios `#laundry-fulfillment-PICKUP` / `#laundry-fulfillment-DELIVERY`.

- [ ] **Step 1: Update the page tests' mocks and harness (no behavior asserted yet)**

`apps/web/lib/laundry-list-page.test.tsx`, wrap the render in `ToastProvider` (the page now calls `useToast`, which throws outside a provider; the app provides it in `dashboard-layout.tsx`):

```diff
+import { ToastProvider } from '@clensy/ui';
 import { renderToStaticMarkup } from 'react-dom/server';
@@
 async function renderPage(): Promise<string> {
   const { default: LaundryPage } = await import('../app/app/laundry/page');
-  return renderToStaticMarkup(<LaundryPage />);
+  return renderToStaticMarkup(
+    <ToastProvider>
+      <LaundryPage />
+    </ToastProvider>,
+  );
 }
```

`apps/web/lib/laundry-list-page.interaction.test.tsx`:

1. Add to the `nav` hoisted object (keep its keys sorted):

```ts
  // Every `useCustomersQuery` options object, in render order.
  customerQueries: [] as { skip?: boolean; variables?: { filter?: unknown; paging?: { limit?: number } } }[],
  customerSearchError: undefined as Error | undefined,
  customers: [] as { id: string; email: string; fullName: string; phone: string }[],
  // Every `receiveLaundryOrder` input, in call order.
  receiveCalls: [] as unknown[],
  // Settles the pending `receiveLaundryOrder` call with an error.
  rejectReceive: (() => {}) as (error: unknown) => void,
  role: 'TENANT_OWNER',
```

2. Replace these three entries of the `@clensy/client` mock:

```diff
-    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: 'TENANT_OWNER' } } }),
-    useCustomersQuery: () => ({ data: { customers: { nodes: [{ id: 'c1', fullName: 'Ana Reyes' }] } } }),
+    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: nav.role, scope: 'TENANT' } } }),
+    useCustomersQuery: (options: (typeof nav.customerQueries)[number]) => {
+      nav.customerQueries.push(options);
+      if (options.skip) return { data: undefined, error: undefined, loading: false };
+      return nav.customerSearchError
+        ? { data: undefined, error: nav.customerSearchError, loading: false }
+        : { data: { customers: { nodes: nav.customers } }, error: undefined, loading: false };
+    },
@@
-    useReceiveLaundryOrderMutation: () => [
-      () =>
-        new Promise((resolve) => {
-          nav.resolveReceive = (id: string) => resolve({ data: { receiveLaundryOrder: { id } } });
-        }),
-      { loading: false },
-    ],
+    useReceiveLaundryOrderMutation: () => [
+      (options: { variables: { input: unknown } }) => {
+        nav.receiveCalls.push(options.variables.input);
+        return new Promise((resolve, reject) => {
+          nav.resolveReceive = (id: string) => resolve({ data: { receiveLaundryOrder: { id } } });
+          nav.rejectReceive = reject;
+        });
+      },
+      { loading: false },
+    ],
```

3. Import `ToastProvider` and render inside it in `start`:

```diff
+import { ToastProvider } from '@clensy/ui';
@@
-  act(() => root.render(<LaundryPage />));
+  act(() =>
+    root.render(
+      <ToastProvider>
+        <LaundryPage />
+      </ToastProvider>,
+    ),
+  );
```

4. Reset in `beforeEach`:

```ts
  nav.customerQueries = [];
  nav.customerSearchError = undefined;
  nav.customers = [
    { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' },
    { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' },
  ];
  nav.receiveCalls = [];
  nav.rejectReceive = () => {};
  nav.resolveReceive = () => {};
  nav.role = 'TENANT_OWNER';
```

5. Add helpers after `statusSelect`:

```ts
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function customerField(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#laundry-customer')!;
}

function typeCustomer(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(customerField(), text);
    customerField().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressInCustomer(key: string) {
  act(() => {
    customerField().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
}

function openCreate() {
  act(() => button('+ New Laundry Order').click());
}

// Types, waits out the debounce, and clicks the first match.
function chooseCustomer(text = 'Ana') {
  typeCustomer(text);
  act(() => vi.advanceTimersByTime(300));
  act(() => document.querySelector<HTMLElement>('#laundry-customer-listbox [role="option"]')!.click());
}

// react-hook-form validates asynchronously, so a submit settles in an async act.
async function submitCreate(times = 1) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      dialog()!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
}
```

6. Update the existing create-race test. A customer must now be chosen, and the submit must settle (the mutation is called after async validation) before the URL race is staged:

```diff
   it('opens the new order after create with the live list URL, natively, before React re-renders', async () => {
     start('tab=a&status=PAID', '#orders');
-    act(() => button('+ New Laundry Order').click());
-    act(() => {
-      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
-    });
+    openCreate();
+    chooseCustomer();
+    await submitCreate();
+    expect(nav.receiveCalls).toHaveLength(1);
```

The rest of that test is unchanged.

- [ ] **Step 2: Run the page tests to see the current state**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx`
Expected: FAIL — the create-race test cannot find `#laundry-customer` (the old dialog has a `<select>`). All other existing tests pass.

- [ ] **Step 3: Write the failing intake tests**

Append to `apps/web/lib/laundry-list-page.interaction.test.tsx`:

```tsx
describe('/app/laundry intake modal', () => {
  it('searches customers by name on the server, 20 at most, never the first 100 unfiltered', () => {
    start();
    expect(nav.customerQueries.every((options) => options.skip === true)).toBe(true);
    openCreate();
    typeCustomer('  ana ');
    expect(nav.customerQueries.at(-1)?.skip).toBe(true); // debouncing
    act(() => vi.advanceTimersByTime(300));
    expect(nav.customerQueries.at(-1)).toMatchObject({
      skip: false,
      variables: { filter: { fullName: { iLike: '%ana%' } }, paging: { limit: 20 } },
    });
    for (const options of nav.customerQueries) {
      expect(options.skip === true || options.variables?.paging?.limit === 20).toBe(true);
      expect(options.skip === true || options.variables?.filter !== undefined).toBe(true);
    }
  });

  it('shows Searching…, then results with phone or email, then No customers match.', () => {
    start();
    openCreate();
    typeCustomer('ana');
    expect(dialog()!.textContent).toContain('Searching…');
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.map((option) => option.textContent)).toEqual(['Ana Reyes555-0101', 'Ana Reyesana.r@example.com']);
    nav.customers = [];
    typeCustomer('zz');
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()!.textContent).toContain('No customers match.');
  });

  it('shows a failed search inline', () => {
    nav.customerSearchError = new Error('down');
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('Unable to search customers.');
  });

  it('requires a customer: "Select a customer.", focus on the field, and no mutation', async () => {
    start();
    openCreate();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
    expect(customerField().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(customerField());
  });

  it('clears the selection when the text changes after choosing', async () => {
    start();
    openCreate();
    chooseCustomer();
    expect(customerField().value).toBe('Ana Reyes');
    typeCustomer('Ana R');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
    typeCustomer('');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
  });

  it('creates with the chosen customer and fulfillment, toasts, and opens the drawer on the new order (pre-cutover)', async () => {
    start('status=PAID');
    openCreate();
    expect(dialog()!.textContent).toContain('New laundry order');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!.checked).toBe(true);
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'DELIVERY' }]);
    await act(async () => nav.resolveReceive('new-order'));
    expect(dialog()).toBeNull();
    expect(document.body.textContent).toContain('Laundry order created.');
    // Until #161, the new order opens in the drawer so it can be weighed.
    expect(url().get('detail')).toBe('new-order');
    expect(url().get('status')).toBe('PAID');
    expect(nav.orderQueryIds.at(-1)).toBe('new-order');
    expect(nav.routerCalls).toEqual([]);
  });

  it('sends one mutation for two submits fired before React re-renders', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate(2);
    expect(nav.receiveCalls).toHaveLength(1);
    expect(button('Creating…').disabled).toBe(true);
    await act(async () => nav.resolveReceive('new-order'));
    expect(nav.receiveCalls).toHaveLength(1);
  });

  it('stays open on failure with an alert, the fields intact, and submit re-enabled', async () => {
    start();
    openCreate();
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await submitCreate();
    await act(async () => nav.rejectReceive(new Error('Network down')));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('Unable to create laundry order.');
    expect(customerField().value).toBe('Ana Reyes');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.checked).toBe(true);
    expect(button('Create order').disabled).toBe(false);
    expect(url().get('detail')).toBeNull();
    await submitCreate();
    expect(nav.receiveCalls).toHaveLength(2);
  });

  it('shows a server field error under the customer field instead of the generic alert', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    await act(async () =>
      nav.rejectReceive({ graphQLErrors: [{ extensions: { originalError: { message: ['customerId must be a string'] } } }] }),
    );
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
  });

  it('resets customer, fulfillment and errors each time it opens', async () => {
    start();
    openCreate();
    await submitCreate(); // "Select a customer."
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    act(() => button('Cancel').click());
    expect(dialog()).toBeNull();
    openCreate();
    expect(customerField().value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!.checked).toBe(true);
    expect(document.querySelector('#laundry-customer-error')).toBeNull();
  });

  it('closes the list on the first Escape and the dialog on the next', () => {
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(customerField().getAttribute('aria-expanded')).toBe('true');
    pressInCustomer('Escape');
    expect(dialog()).not.toBeNull();
    expect(customerField().getAttribute('aria-expanded')).toBe('false');
    pressInCustomer('Escape');
    expect(dialog()).toBeNull();
  });

  it('lets a SCHEDULER create, offers a link to customers, and no customer form', async () => {
    nav.role = 'SCHEDULER';
    start();
    openCreate();
    const link = dialog()!.querySelector<HTMLAnchorElement>('a[href="/app/customers"]');
    expect(link?.textContent).toBe('Add a customer');
    expect(dialog()!.querySelectorAll('input:not([type="radio"])')).toHaveLength(1); // the customer search only
    expect(dialog()!.textContent).not.toContain('Full name');
    chooseCustomer();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'PICKUP' }]);
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`
Expected: FAIL — `#laundry-customer` is not a combobox (the old `<select>`), no toast, no link; the static page test still passes.

- [ ] **Step 5: Write the dialog**

`apps/web/components/laundry/create-laundry-order-dialog.tsx`:

```tsx
'use client';

import { useReceiveLaundryOrderMutation } from '@clensy/client';
import { FormDialog } from '@clensy/ui';
import { clensyResolver, normalizeApiValidationErrors, type Rules } from '@clensy/validation';
import {
  LaundryCustomerPicker,
  LaundryFulfillmentFieldset,
  useClensyTranslations,
  type LaundryFulfillmentType,
} from '@clensy/web';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLaundryCustomerSearch } from '../../lib/use-laundry-customer-search';

interface CreateLaundryOrderFormValues {
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
}

export interface CreateLaundryOrderDialogProps {
  onClose: () => void;
  onCreated: (orderId: string) => void;
  open: boolean;
  showAddCustomerLink: boolean;
}

const DEFAULT_VALUES: CreateLaundryOrderFormValues = { customerId: '', fulfillmentType: 'PICKUP' };

const RULES = {
  customerId: 'required',
  fulfillmentType: 'required|in:DELIVERY,PICKUP',
} satisfies Rules<CreateLaundryOrderFormValues>;

const API_FIELDS: (keyof CreateLaundryOrderFormValues)[] = ['customerId', 'fulfillmentType'];

// The laundry intake form (lifecycle spec §8.4.4, #160): a customer found by
// server-side search and a fulfillment chosen once. The page owns opening,
// remounting per opening, and what happens after a create. Creating a
// customer here is out of scope (§8.2, §8.6); the optional link leaves for
// the customers page instead.
export function CreateLaundryOrderDialog({ onClose, onCreated, open, showAddCustomerLink }: CreateLaundryOrderDialogProps) {
  const t = useClensyTranslations('laundry');
  const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
  const form = useForm<CreateLaundryOrderFormValues>({
    defaultValues: DEFAULT_VALUES,
    // Each field's whole sentence is its `:attribute`, so the `required`
    // and `in` templates print the catalog copy ("Select a customer.").
    resolver: clensyResolver<CreateLaundryOrderFormValues>(RULES, {
      attributes: {
        customerId: t('create.customer.required'),
        fulfillmentType: t('create.fulfillment.required'),
      },
      messages: { in: ':attribute', required: ':attribute' },
    }),
  });
  const [customerQuery, setCustomerQuery] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const search = useLaundryCustomerSearch(customerQuery);
  // `submitting` disables the buttons only once React re-renders. This guard
  // also drops a second submit fired before that: one mutation per create.
  const inFlight = useRef(false);
  const submitting = creating || form.formState.isSubmitting;

  async function handleValid(values: CreateLaundryOrderFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFormError(undefined);
    try {
      const result = await receive({ variables: { input: values } });
      const orderId = result.data?.receiveLaundryOrder.id;
      if (orderId) onCreated(orderId);
      else setFormError(t('create.failure'));
    } catch (error) {
      const fieldErrors = normalizeApiValidationErrors(error, API_FIELDS);
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          form.setError(field as keyof CreateLaundryOrderFormValues, { message: messages[0], type: 'server' });
        }
      } else {
        setFormError(t('create.failure'));
      }
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('create.title')}
      onSubmit={form.handleSubmit(handleValid)}
      submitLabel={submitting ? t('create.creating') : t('create.submit')}
      submitting={submitting}
    >
      <Controller
        control={form.control}
        name="customerId"
        render={({ field, fieldState }) => (
          <LaundryCustomerPicker
            id="laundry-customer"
            inputRef={field.ref}
            query={customerQuery}
            options={search.options}
            status={search.status}
            error={fieldState.error?.message}
            // Any edit after a selection drops it: the input must name the
            // customer the order is created for.
            onQueryChange={(text) => {
              setCustomerQuery(text);
              if (field.value !== '') field.onChange('');
            }}
            onSelect={(option) => {
              setCustomerQuery(option.fullName);
              field.onChange(option.id);
            }}
          />
        )}
      />
      {showAddCustomerLink ? (
        <Link
          href="/app/customers"
          className="self-start text-sm text-slate-700 underline focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {t('create.addCustomer')}
        </Link>
      ) : null}
      <Controller
        control={form.control}
        name="fulfillmentType"
        render={({ field }) => (
          <LaundryFulfillmentFieldset name="laundry-fulfillment" value={field.value} onChange={field.onChange} />
        )}
      />
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
    </FormDialog>
  );
}
```

- [ ] **Step 6: Wire the page**

`apps/web/app/app/laundry/page.tsx`:

Imports:

```diff
   useCurrentAdminQuery,
-  useCustomersQuery,
   useGenerateInvoiceFromOrderMutation,
@@
   usePriceLaundryOrderMutation,
-  useReceiveLaundryOrderMutation,
   useRefundLaundryOrderMutation,
@@
-import type {
-  LaundryFulfillmentType,
-  LaundryOrderStatus,
-} from '@clensy/client';
+import type { LaundryOrderStatus } from '@clensy/client';
 import {
   Button,
   ConfirmDialog,
   DetailDrawer,
   ErrorState,
-  FormDialog,
   LoadingState,
   PageHeader,
   StatusBadge,
+  useToast,
 } from '@clensy/ui';
@@
 import { Suspense, useState } from 'react';
+import { CreateLaundryOrderDialog } from '../../../components/laundry/create-laundry-order-dialog';
 import { formatMinorUnits } from '../../../lib/format-price';
 import { laundryOrdersQueryVariables } from '../../../lib/laundry-order-list-query';
+import { canViewPath } from '../../../lib/nav-groups';
 import { useDetailDrawer } from '../../../lib/use-detail-drawer';
```

(Checked at planning time on `47503f5`: `FormDialog` and `LaundryFulfillmentType` are used in `page.tsx` only by the intake block, so both imports go.)

In `LaundryPageContent`:

```diff
   const { data: adminData } = useCurrentAdminQuery();
   const canCreate = canReceiveLaundryOrder(adminData?.currentAdmin.role);
+  const principal = adminData?.currentAdmin;
+  const toast = useToast();
@@
-  const { data: customersData } = useCustomersQuery({
-    fetchPolicy: 'network-only',
-    variables: { paging: { limit: 100 } },
-  });
-  const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
   // Only the History-API entry points: `open`/`close` would route through
```

Replace the form state and `handleCreate`:

```diff
   const [formOpen, setFormOpen] = useState(false);
-  const [customerId, setCustomerId] = useState('');
-  const [fulfillmentType, setFulfillmentType] =
-    useState<LaundryFulfillmentType>('PICKUP');
-  const [formError, setFormError] = useState<string | undefined>(undefined);
+  // A new key per opening remounts the dialog, so every opening starts with
+  // no customer, customer pickup, and no errors (#160).
+  const [formKey, setFormKey] = useState(0);

   function openCreateForm() {
-    setCustomerId('');
-    setFulfillmentType('PICKUP');
-    setFormError(undefined);
+    setFormKey((key) => key + 1);
     setFormOpen(true);
   }

-  async function handleCreate() {
-    setFormError(undefined);
-    try {
-      const result = await receive({
-        variables: { input: { customerId, fulfillmentType } },
-      });
-      setFormOpen(false);
-      await ordersQuery.refetch();
-      const newId = result.data?.receiveLaundryOrder.id;
-      // Only the destination URL is built here (live list state, hash,
-      // `detail`), so this open is a native write like the rest of the
-      // list. The create flow itself belongs to #160.
-      if (newId) openWithHref(hrefFor((current) => current, { set: { detail: newId } }));
-    } catch {
-      setFormError('Unable to create laundry order.');
-    }
-  }
+  // Until the order page cutover (#161), a new order opens in the drawer,
+  // so it can still be weighed; #161 sends it to `/app/laundry/[id]`. Only
+  // the destination URL is built here (live list state, hash, `detail`), so
+  // this open is a native write like the rest of the list. The order
+  // exists, so a failed list refresh does not keep it from opening; the
+  // list shows its own error.
+  async function handleCreated(orderId: string) {
+    setFormOpen(false);
+    toast.success(t('create.success'));
+    await ordersQuery.refetch().catch(() => undefined);
+    openWithHref(hrefFor((current) => current, { set: { detail: orderId } }));
+  }
```

Remove `const customers = customersData?.customers.nodes ?? [];`.

Replace the whole `<FormDialog …>…</FormDialog>` intake block with:

```tsx
      <CreateLaundryOrderDialog
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(orderId) => void handleCreated(orderId)}
        showAddCustomerLink={principal ? canViewPath(principal, '/app/customers') : false}
      />
```

- [ ] **Step 7: Run the page tests**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx`
Expected: PASS — every existing test (create-race included) and the 12 new intake tests.

- [ ] **Step 8: Typecheck, lint, the whole web suite**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: all pass. The `use-detail-drawer.guard.test.ts` guard (no `router.refresh`, no marker-dropping writes) MUST stay green with the new `components/laundry` file in its scan.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/laundry/create-laundry-order-dialog.tsx apps/web/app/app/laundry/page.tsx apps/web/lib/laundry-list-page.test.tsx apps/web/lib/laundry-list-page.interaction.test.tsx
git commit -m "feat(web): redesign the laundry order creation modal (#160)"
```

---

### Task 6: Final verification and PR

**Files:** none changed, except this plan's gate records.

- [ ] **Step 1: Scope check**

Run: `git diff --name-only main...HEAD`
Expected: exactly the files in the [File map](#file-map), plus this plan. Nothing under `apps/api/src`, `packages/ui`, `packages/client`, `packages/validation`, `docs/workflows`, or any lockfile/`package.json`.

- [ ] **Step 2: Every suite and build**

Run, each to completion:

```bash
pnpm --filter @clensy/web test
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web build
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
pnpm --filter api test:e2e -- laundry-intake-customer-search laundry-order-list-filters laundry.e2e
pnpm lint
```

Expected: all pass. Record each command's result in the M6 Slice Completion Report's Validation table.

- [ ] **Step 3: Manual browser checks**

Run the app (`pnpm dev`, web on :3001) against the local API and database. Check, and record viewport, role and result in the PR:

1. Desktop, TENANT_OWNER: open "+ New Laundry Order". Focus is in the Customer field. Type part of a name: "Searching…", then matches with phone or email. ArrowDown/ArrowUp/Enter choose one; Escape closes the list and a second Escape closes the dialog. Fulfillment rows show both descriptions and "This choice is fixed at intake."; the selected row has the dark border; the two rows sit side by side.
2. Submit with no customer: "Select a customer." under the field, field focused, no request in the network panel.
3. Create: dialog closes, "Laundry order created." toast, drawer opens on the new order, which can be weighed.
4. A customer created after the first 100 (by name order) is found by name.
5. Below 640 px: the dialog fits without horizontal scroll; the fulfillment rows stack; the result list is usable with the soft keyboard.
6. SCHEDULER: can create; the dialog has the "Add a customer" link and no customer form.
7. FINANCE and ANALYST: no "+ New Laundry Order" button.

- [ ] **Step 4: Open the PR**

Push `feat/160-laundry-intake-modal` and open the PR against `main` with `gh pr create` (`workflow.providers.pullRequests: github`). The body MUST include:
- "Closes #160."
- **Cutover:** "Until the end-to-end issue (#161) switches it to `/app/laundry/[id]`, a successful create still opens the existing drawer on the new order, so it can be weighed."
- No new GraphQL mutation, no API, schema or `@clensy/ui` change, no new dependency.
- The manual check table from Step 3.

---

## Self-review (planner)

| Check | Result |
| --- | --- |
| Every major task traces to the Accepted spec | Yes; see [Traceability](#traceability). |
| No task introduces new product semantics | Yes. One UI decision is called out for M5: any edit after a selection clears it (Review Focus 1); the issue states the clearing case and the spec is silent. A failed list refresh after a successful create no longer suppresses opening the new order (Task 5 Step 6), per the issue's "do not leave the drawer closed". |
| Task order executable without inventing work | Yes: 1 is independent; 2 → 3 (copy) → 4 (types) → 5 → 6. |
| Deferred work explicitly identified | Yes; see [Deferred](#deferred-not-in-this-plan). |
| Missing design semantics | None found. |
| Pre-validation claim | None claimed. |
| Characterization tests labelled | Task 1. |
