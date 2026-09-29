# Laundry & Billing Tenant Isolation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-30 |
| **Tracking** | GitHub [#87](https://github.com/rexescario-dev/clensy-platform/issues/87) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (to be Accepted at M5) + implementation (process §2.8). Branch `feat/87-laundry-billing-tenant-isolation`. |
| **Package / repo** | `clensy-platform` — `apps/api` only |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: principal `{ id, role, scope, tenantId }`, `BOOTSTRAP_TENANT_ID`, `test/helpers/seed-tenant-admin.ts`), [Customer & Property plan](2026-09-24-customer-property-tenant-isolation-plan.md) (#82: `tenantReadAuthorizer`, `requireTenantId`, `uq_customer_id_tenant`, and the carried-forward relation-filter finding I1), [Catalog plan](2026-09-28-catalog-tenant-isolation-plan.md) (#84: `uq_service_id_tenant`, `uq_add_on_id_tenant`, tenant-scoped `resolveEffectivePricing` / `getServicesByIds` / `getAddOnsByIds`, and the laundry-order cross-tenant pricing residual), [Booking plan](2026-09-28-booking-tenant-isolation-plan.md) (#85: `fieldResolverEnhancers: ['interceptors']`) and [Jobs & Checklists plan](2026-09-29-jobs-checklists-tenant-isolation-plan.md) (#86: owned-via-parent children, `schema:log` drift classification, audit tagging). Also relies on [Laundry Orders](../specs/2026-09-06-laundry-orders-lifecycle-design.md), [Laundry Invoices](../specs/2026-09-06-laundry-invoices-design.md), [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md), [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) and [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) §4.6 (audit), each **as extended/constrained by the RFC** (RFC §8). |

> **For agentic workers:** Draft — awaiting M5 Plan Review. Do **not** start any task until M5 Accepts this plan. After Accept, execute task by task (superpowers:executing-plans or superpowers:subagent-driven-development, as chosen at M5). Each task ends green on unit tests and `tsc` before the next task starts. Steps use checkbox (`- [ ]`) syntax. Do **not** invent product semantics; the Accepted specification wins. M6 constraints: no production-tenant provisioning, no unrelated refactoring, no push or PR as a side effect; do not weaken failing assertions to get a suite green.

**Goal:** Make LaundryOrder, LaundryOrderLine and Invoice tenant-owned, with database-enforced same-tenant references, the caller's tenant applied to every laundry and invoice read and write, tenant-tagged audit events, and a per-tenant, concurrency-safe invoice-number allocator that replaces the global sequence.

**Architecture:** One migration adds `tenantId` to `laundry_order_entity`, `laundry_order_line_entity` and `invoice_entity`, backfills them, **validates** existing references and invoice numbers, then adds NOT NULL, tenant FKs and `uq_laundry_order_id_tenant`. In the same migration it replaces the six id-only parent FKs with composite `(refId, "tenantId") → parent (id, "tenantId")` FKs, swaps `uq_invoice_number` for `uq_invoice_tenant_number (tenantId, invoiceNumber)`, creates `invoice_number_counter` seeded from the existing numbers, and drops `billing_invoice_number_seq`. `LaundryOrdersService` and `InvoicesService` take a tenant on every operation and put it in the same query as the id. `LaundryOrderType` and `InvoiceType` get `@Authorize(tenantReadAuthorizer())`. Every laundry and billing mutation uses `requireTenantId`.

**Tech Stack:** NestJS 11, TypeORM 1.1.x migrations (hand-written constraints), PostgreSQL, `@ptc-org/nestjs-query-*` 9.5.0, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.4 (LaundryOrder and Invoice rows; "laundry line → service or add-on"; "invoice → laundry order and customer"; Invoice uniqueness and allocation; `uq_invoice_laundry_order` stays), §4.5, §4.6 (audit), §4.7 (backfill), invariants 1, 4, 5, 6, 7, 8, 12.

## Delivery intent

Implement RFC §4.4–§4.6 for **LaundryOrder** and **Invoice**. After this slice:

- A tenant principal cannot see, count, filter to, detect, read or mutate another tenant's laundry order, its lines, an invoice or its lines through any GraphQL path.
- Relation filters on the `laundryOrders` and `invoices` roots (`customer`, `laundryOrder`) cannot match another tenant's rows. This is the acceptance criterion carried from #82 (PR #95, final review I1), and the #84 laundry-order cross-tenant pricing residual is closed (see "Residual exposures closed").
- The database rejects a laundry order whose customer, a line whose order / service / add-on, or an invoice whose laundry order / customer belongs to a different tenant than the row.
- Invoice numbers are unique per tenant and allocated per tenant from a transactional counter. Concurrent generates in one tenant get distinct numbers, and tenants number independently. The global `billing_invoice_number_seq` no longer exists.
- `laundry_order.*` and `invoice.generated` audit events carry `scope: TENANT` and the tenant id.

## Slice decisions (recorded during brainstorming, 2026-09-30)

These resolve planning-level choices the RFC leaves to M4. None adds product semantics beyond what the RFC authorizes; each one's source is named.

1. **Process.** The Accepted RFC is the architectural specification. No separate spec document is written; these decisions are the brainstorm record, and the plan is reviewed at M5 before any implementation (#84–#86 precedent).

2. **Tenant-owned resources: LaundryOrder, LaundryOrderLine and Invoice. InvoiceLine is owned via its Invoice (developer decision, 2026-09-30).**
   - RFC §4.4 lists LaundryOrder and Invoice as tenant-owned and names "laundry line → service or add-on" as a same-tenant reference the database must enforce. A composite FK from the line to `service_entity` / `add_on_entity` needs a `tenantId` on the line, so `laundry_order_line_entity` gets one.
   - `invoice_line_entity` gets **no** `tenantId`, composite FK or authorizer. Invoice lines reference no tenant-owned row except their invoice (the entity deliberately holds no catalog ids). They have no root query or mutation, and `invoiceId → invoice` already binds each line to one invoice (#86 ChecklistItem precedent).
   - Neither line type gets an authorizer. `LaundryOrder.lines` and `Invoice.lines` are reachable only from a tenant-authorized parent.

   ```text
   Customer (id, tenantId) ◀── (customerId, tenantId) ── LaundryOrder (id, tenantId)
      ▲                                                      ▲            ▲
      │ (customerId, tenantId)          (laundryOrderId, tenantId)   (laundryOrderId, tenantId)
      │                                                      │            │
   Invoice (id, tenantId, invoiceNumber) ────────────────────┘     LaundryOrderLine (id, tenantId)
      │ invoiceId (unchanged, id-only, CASCADE)                           │ (serviceId, tenantId) → Service (id, tenantId)
      ▼                                                                   │ (addOnId,   tenantId) → AddOn   (id, tenantId)
   InvoiceLine (id, invoiceId)

   invoice_number_counter (tenantId PK → Tenant, lastValue)
   ```

3. **Security invariants (normative for this slice).**
   - **I-1: a row's `tenantId` is authoritative for every tenant-owned row it references.** The application enforces it (tenant-scoped lookups before write; new rows take the tenant of the scoped parent or the caller). So does the database (composite FKs, Decision 4). RFC §4.4: "Application validation and database constraints MUST both prevent cross-tenant references".
   - **I-2: no laundry or invoice lookup uses a caller-supplied tenant.** The only tenant source is `AuthenticatedPrincipal.tenantId` (RFC §4.5, invariant 1). `tenantId` never appears as a GraphQL field, filterable field or input field on `LaundryOrder`, `LaundryOrderLine`, `Invoice` or `InvoiceLine`.
   - **I-3: invoice numbers are unique per tenant and allocated per tenant under concurrency** (RFC §4.4, invariant 5). The database enforces uniqueness (`uq_invoice_tenant_number`); allocation is the counter row upsert in the generate transaction (Decision 9).

4. **Composite FK invariant (implements I-1 in the database).**

   ```text
   laundry_order_entity      ("customerId",     "tenantId") → customer_entity      ("id", "tenantId")  -- fk_laundry_order_customer_tenant    ON DELETE RESTRICT
   laundry_order_line_entity ("laundryOrderId", "tenantId") → laundry_order_entity ("id", "tenantId")  -- fk_laundry_order_line_order_tenant  ON DELETE CASCADE
   laundry_order_line_entity ("serviceId",      "tenantId") → service_entity       ("id", "tenantId")  -- fk_laundry_order_line_service_tenant ON DELETE RESTRICT
   laundry_order_line_entity ("addOnId",        "tenantId") → add_on_entity        ("id", "tenantId")  -- fk_laundry_order_line_add_on_tenant  ON DELETE RESTRICT
   invoice_entity            ("laundryOrderId", "tenantId") → laundry_order_entity ("id", "tenantId")  -- fk_invoice_laundry_order_tenant      ON DELETE RESTRICT
   invoice_entity            ("customerId",     "tenantId") → customer_entity      ("id", "tenantId")  -- fk_invoice_customer_tenant           ON DELETE RESTRICT
   ```

   - They replace `fk_laundry_order_customer`, `fk_laundry_order_line_order`, `fk_laundry_order_line_service`, `fk_laundry_order_line_add_on`, `fk_invoice_laundry_order` and `fk_invoice_customer` in the same migration step, **keeping each original `ON DELETE` action**.
   - The referenced pairs are backed by `uq_customer_id_tenant` (#82), `uq_service_id_tenant` / `uq_add_on_id_tenant` (#84) and the new `uq_laundry_order_id_tenant`.
   - Default `MATCH SIMPLE`: the null side of a line's `serviceId` / `addOnId` pair is not checked against the catalog. The non-null side always is, because `tenantId` is NOT NULL.
   - `ck_laundry_order_line_target` (`num_nonnulls("serviceId", "addOnId") = 1`) is unchanged and still makes exactly one side non-null. The application still creates exactly one side per line (`price()` targets). `MATCH SIMPLE` therefore cannot leave a line with no checked catalog reference.
   - Unchanged: `fk_invoice_line_invoice`, `uq_invoice_laundry_order`, `ck_laundry_order_weight_non_negative` and `ck_laundry_order_line_target`. RFC §4.4: `uq_invoice_laundry_order` remains and is consistent with a single tenant.

5. **Read paths.**
   - **`laundryOrders` and `invoices`** (nestjs-query root lists and `totalCount`), and relation filters from them (`customer`, `laundryOrder`): constrained by `@Authorize(tenantReadAuthorizer<…>())` on `LaundryOrderType` and `InvoiceType`.
   - **Relation filters (#82 I1).** A relation filter joins the related table. With the root scoped to the caller's tenant, and every visible row's `customerId` / `laundryOrderId` bound to the same tenant by Decision 4, a relation filter can only ever match same-tenant related rows. This is the same argument #86 used for `jobs(filter: { booking })`.
   - **`laundryOrder(id)` and `invoice(id)`** (custom nullable queries): `getOrder(id, currentUser.tenantId)` / `getInvoice(id, currentUser.tenantId)`. A null tenant returns `null` without a query (#86 `getJob` precedent).
   - **`LaundryOrder.customer`, `Invoice.customer` and `Invoice.laundryOrder`** (nestjs-query relations): filtered by the target DTO's authorizer (`CustomerType` from #82, `LaundryOrderType` from this slice). The relations carry no `auth` override (Task 4 pins this).
   - **`LaundryOrder.lines` and `Invoice.lines`**: no authorizer (Decision 2), reachable only from an authorized parent.

6. **Write paths: every order or invoice lookup puts `tenantId` in the same query; never fetch-then-filter.** `tenantId` is never part of an update's SET list.
   - `lock(manager, id, tenantId)`: `findOne(LaundryOrderEntity, { lock: pessimistic_write, where: { id, tenantId } })`. Missing ⇒ the existing `NotFoundException('Laundry order … not found')`. Every transition verb, `weigh` and `price` go through it.
   - Every `manager.update(LaundryOrderEntity, …)` WHERE is `{ id, tenantId }`; every re-read is `findOneByOrFail(LaundryOrderEntity, { id, tenantId })`.
   - `receive`: the existing `getCustomer(customerId, tenantId)` pre-check stays, and the order is created with `tenantId: command.tenantId`.
   - `price`: lines are created with `tenantId: order.tenantId`, the tenant of the scoped, locked order. Catalog lookups keep `command.tenantId` (#84), which equals `order.tenantId` because `lock` matched on it.
   - `getOrderForInvoicing(id, tenantId: string)`: the order is `{ id, tenantId }` and the lines are `{ laundryOrderId: id, tenantId }`. The projection gains `tenantId`, the order row's tenant.
   - `generateFromOrder`:
     - order via `getOrderForInvoicing(laundryOrderId, command.tenantId)`;
     - the pre-check and the in-transaction race check are `{ laundryOrderId, tenantId: order.tenantId }`;
     - the invoice is created with `tenantId: order.tenantId`, and the number is allocated for `order.tenantId`;
     - re-read with `{ id, tenantId }`.
   - `uq_invoice_laundry_order` stays global. It is still the one-invoice-per-order mechanism, and it cannot collide across tenants because an order has one tenant.

7. **Cross-tenant = missing row (RFC §4.5).**
   - Lists and counts exclude other tenants' rows.
   - `laundryOrder(id)` / `invoice(id)` for another tenant's id return `null` with no error, exactly like a nonexistent id.
   - Every laundry mutation against another tenant's order ⇒ the existing 404 `Laundry order … not found`.
   - `generateInvoiceFromOrder` on another tenant's order ⇒ the existing 404 `Laundry order … not found`. This replaces the #84 interim 400 `Service … could not be resolved` (Task 5 updates that case).
   - `receiveLaundryOrder` with another tenant's customer ⇒ the existing 404 (#82).
   - Never 403 for another tenant's row. Role failure (including Super Admin) remains `Forbidden`.

8. **Mutations take the tenant from `requireTenantId(currentUser)`.**
   - `LaundryOrderTransitionCommand` and `WeighLaundryOrderCommand` gain `tenantId: string`.
   - `ReceiveLaundryOrderCommand.tenantId` narrows from `string | null` to `string`, because the order now needs a non-null tenant. `receiveLaundryOrder` switches from `user.tenantId` to `requireTenantId(user)`.
   - `PriceLaundryOrderCommand` and `GenerateInvoiceFromOrderCommand` already carry `tenantId` (#84); only their comments change.
   - A null-tenant principal ⇒ `ForbiddenException` before the service is called.
   - The `@Roles()` lists are unchanged, and `SUPER_ADMIN` is not added (RFC §4.2).

9. **Invoice-number allocation (developer decision, 2026-09-30; RFC §4.4, invariant 5, §10 "format deferred").**
   - **Table.** `invoice_number_counter ("tenantId" uuid PRIMARY KEY, "lastValue" bigint NOT NULL DEFAULT 0 CHECK ("lastValue" >= 0))`, with `fk_invoice_number_counter_tenant` → `tenant_entity(id)` `ON DELETE RESTRICT`. One row per tenant, holding the **last allocated** value.
   - **Allocation** runs inside the generate transaction on the transaction's `EntityManager`, never through a repository outside it:

     ```sql
     INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1)
     ON CONFLICT ("tenantId") DO UPDATE SET "lastValue" = "invoice_number_counter"."lastValue" + 1
     RETURNING "lastValue"
     ```

   - **Concurrency.** The upsert takes a row lock on the tenant's counter that is held until commit, so concurrent generates in one tenant serialize on it and each gets a distinct value. Tenants do not contend. The first generate for a tenant with no row inserts `1`. Two concurrent first inserts are resolved by `ON CONFLICT`, so one of them gets `2`. This is not read-then-increment, so the RFC's `MAX+1` prohibition is honored.
   - **Rollback.** A rolled-back generate, including a `uq_invoice_laundry_order` loser, rolls back its increment, so numbers are gapless per tenant.
   - **Format** is unchanged: `formatInvoiceNumber(value, resolveManilaYear(issueDate))` ⇒ `INV-{Manila year}-{NNNNNN}`, with no yearly reset. The value is per tenant, so two tenants may both hold `INV-2026-000001`; `uq_invoice_tenant_number` makes that legal and the old global `uq_invoice_number` is dropped.
   - **Relation to the Laundry Invoices spec.** That spec's "global, gap-tolerant sequence; do not fix gaps into a counter table" rule is **extended/constrained by the RFC** (RFC header "extends each with tenant ownership"; §4.4 "the global sequence MUST NOT remain the uniqueness or allocation mechanism"). The counter table is the RFC-compliant allocator, and gaplessness is a side effect, not a new product guarantee.
   - **`uq_invoice_tenant_number` violation** stays an integrity error (rethrown, never `ConflictException`), exactly as `uq_invoice_number` was (Laundry Invoices spec §4.6).

10. **Counter seeding (developer decision, 2026-09-30; RFC §4.7).**
    - The migration does **not** copy the global sequence value into any counter.
    - It first validates that every existing `invoiceNumber` matches `^INV-[0-9]{4}-[0-9]{6,}$`, and that no numeric suffix repeats within a tenant (the suffix is the allocation value; the year is presentation only).
    - Any violation ⇒ an explicit error naming the counts, and the transaction rolls back with nothing modified.
    - It then seeds one counter row per tenant that owns invoices, with `lastValue = MAX(suffix)` for that tenant. After the backfill that is exactly one row, for the bootstrap tenant.
    - The next bootstrap number is `MAX + 1`, so no issued number is reused. Values burned by the old sequence were never issued, so they are not reused either.
    - Tenants with no invoices get their row lazily on first generate.

11. **Audit (developer decision, 2026-09-30; RFC §4.6).**
    - Every `laundry_order.*` event and `invoice.generated` record `scope: AdminScope.TENANT` plus a `tenantId`.
    - For laundry events that is the scoped order's tenant, which equals `command.tenantId`. For `invoice.generated` it is `invoice.tenantId`, taken from the tenant-scoped order row, never an independently supplied request value.
    - This uses the existing `AuditLogger.log` fields (`tenantId?`, `scope?`), as `JobsService` and `TeamsService` do. No new audit format. `actorId`, `action`, `entityType` and `entityId` are unchanged.

12. **Migration backfill and validation (RFC §4.7).**
    - **Backfill.** Every existing laundry order and invoice is attached to the bootstrap tenant, per the RFC's literal rule (#85/#86 precedent). Every line takes its order's tenant (`UPDATE … FROM laundry_order_entity`), which is the bootstrap tenant after the order backfill.
    - **Validation**, before any constraint is created. It checks tenant mismatch only, since the id-only FKs are still in place and guarantee existence:
      - laundry order → customer;
      - line → service, only when `serviceId IS NOT NULL`;
      - line → add-on, only when `addOnId IS NOT NULL`;
      - invoice → customer;
      - invoice → laundry order;
      - line → order.
    - The last two cannot mismatch after the backfill and are checked anyway, so the guard does not depend on backfill order.
    - Also validated: the invoice-number format and per-tenant suffix uniqueness (Decision 10).
    - Any non-zero count ⇒ an explicit error naming the counts, and the single transaction rolls back.
    - In production every customer, service and add-on is already bootstrap-owned (#82, #84), so this is a fail-closed guard for dev/e2e databases with leftover test-tenant rows.

13. **`uq_laundry_order_id_tenant = UNIQUE ("id", "tenantId")`** exists only as the FK target of `fk_laundry_order_line_order_tenant` and `fk_invoice_laundry_order_tenant` (RFC §4.4). `invoice_entity` and `laundry_order_line_entity` get **no** `(id, tenantId)` unique, because nothing tenant-aware references them.

14. **Indexes.** `idx_laundry_order_tenant_created` on `("tenantId", "createdAt" DESC, "id")` and `idx_invoice_tenant_issue` on `("tenantId", "issueDate" DESC, "createdAt" DESC, "id")` match the root default sorts (#86 `idx_cleaning_job_tenant_scheduled` precedent). Lines use the existing `IDX_laundry_order_line_order_id` (the order predicate is the selective one).

## Residual exposures closed

| Source | Residual | Closed by | Pinned by |
| --- | --- | --- | --- |
| #82 I1 (PR #95; carried in #87's issue comment) | `invoices(filter: { customer: { fullName: { like: "A%" } } }) { totalCount }` and the `laundryOrders` equivalent as an existence/prefix oracle over other tenants' customers | Decisions 4, 5 | Task 6 case 2 |
| #84 | `priceLaundryOrder` / transitions on another tenant's unscoped order (`lock()` by id only); id-only `fk_laundry_order_line_service` / `_add_on` | Decisions 4, 6 | Task 6 cases 4, 10 |
| #84 | `generateInvoiceFromOrder` on another tenant's order failing late (400) instead of as a missing order | Decisions 6, 7 | Task 5 (catalog case 7 update), Task 6 case 4 |

**Still open after #87 (owned elsewhere):** booking audit tagging and the relation-level `guards`/`@Roles()` observation (#90); REST cleanup (#91); the two-tenant release gate (#92). With #87 shipped, every slice named by the interim "do not provision a second production tenant" rule (#82–#87) is delivered. Lifting that rule is a human decision and is **not** made by this plan.

## Global constraints

- SHALL derive the tenant **only** from `AuthenticatedPrincipal.tenantId` (I-2). SHALL NOT expose `tenantId` on `LaundryOrder`, `LaundryOrderFilter`, `LaundryOrderLine`, `Invoice`, `InvoiceFilter`, `InvoiceLine` or any laundry/billing input type.
- SHALL NOT hardcode `BOOTSTRAP_TENANT_ID` in any request path. It MAY appear only in the migration and tests.
- SHALL enforce, in the database:
  - `"tenantId" uuid NOT NULL` on `laundry_order_entity`, `laundry_order_line_entity` and `invoice_entity`, with `fk_laundry_order_tenant`, `fk_laundry_order_line_tenant` and `fk_invoice_tenant` → `tenant_entity(id)` `ON DELETE RESTRICT`;
  - `uq_laundry_order_id_tenant`;
  - the six composite FKs of Decision 4;
  - `uq_invoice_tenant_number UNIQUE ("tenantId", "invoiceNumber")`, replacing `uq_invoice_number`;
  - `invoice_number_counter` with `fk_invoice_number_counter_tenant` and its `CHECK`;
  - `idx_laundry_order_tenant_created`, `idx_invoice_tenant_issue`.

  The six id-only FKs, `uq_invoice_number` and `billing_invoice_number_seq` are removed. `uq_invoice_laundry_order`, `fk_invoice_line_invoice`, both `CHECK`s and every existing single-column index are unchanged.
- SHALL order the migration exactly:
  - **(0)** assert the bootstrap tenant exists;
  - **(1)** add nullable `tenantId` to the three tables;
  - **(2)** backfill (orders, then lines from orders, then invoices);
  - **(3)** validate references and invoice numbers (Decisions 10, 12);
  - **(4)** NOT NULL + tenant FKs on the three tables;
  - **(5)** `uq_laundry_order_id_tenant`;
  - **(6)** drop each id-only parent FK and add its composite replacement in the same step;
  - **(7)** swap `uq_invoice_number` → `uq_invoice_tenant_number`, create and seed `invoice_number_counter`, drop `billing_invoice_number_seq`;
  - **(8)** the two indexes.

  All in **one** migration; SHALL NOT split it. No committed state lacks a parent FK.
- SHALL treat `@Authorize` on `LaundryOrderType` and `InvoiceType` as a **security invariant**. No relation targeting either type, or either line type, may carry a relation-level `auth` or enable relation `update`/`remove`. Planning-time inventory of relations whose target is in {`LaundryOrderType`, `LaundryOrderLineType`, `InvoiceType`, `InvoiceLineType`}: `Invoice.laundryOrder`, `LaundryOrder.lines`, `Invoice.lines`. Task 4 pins this.
- SHALL allocate invoice numbers only through the counter upsert on the generate transaction's `EntityManager` (Decision 9). SHALL NOT read the counter and write it back, and SHALL NOT use `MAX(invoiceNumber)`.
- SHALL keep `@Roles()` sets unchanged and SHALL NOT add `SUPER_ADMIN` to any laundry or billing resolver (RFC §4.2).
- SHALL NOT change customer, catalog, booking, job or team tables, or `invoice_line_entity`.
- SHALL NOT use PostgreSQL RLS (invariant 12).
- SHALL NOT change `apps/web`, `packages/*`, GraphQL operation documents, or the public GraphQL schema. Adding `@Authorize` does not change the schema, and the invoice-number format is unchanged.

## Ownership boundaries

**This slice owns:**
- `apps/api/src/modules/laundry/**` and `apps/api/src/modules/billing/**`;
- one new migration in `apps/api/src/platform/database/migrations/`;
- `test/helpers/seed-tenant-admin.ts` (`removeTestTenants`);
- e2e suites that insert laundry orders or invoices, or pin #87 interim behaviour: `laundry.e2e-spec.ts`, `laundry.service.e2e-spec.ts`, `billing.e2e-spec.ts`, `billing.service.e2e-spec.ts`, `catalog.tenant-isolation.e2e-spec.ts`, `customers-properties.tenant-isolation.e2e-spec.ts` (only if it fails), `paginated-collections-allowlist.e2e-spec.ts` (only if it fails);
- stale `#87` code comments outside applied migrations.

**Must not change:**
- Customers / Catalog / Bookings / Jobs / Teams / Cleaners persistence, services, types or authorizers;
- `tenantReadAuthorizer` / `requireTenantId` / `AuthGuard` / `@CurrentUser()` / `@Roles()`, which are consumed as-is;
- the audit port and logger; `platform/graphql`; `apps/web`; `packages/*`.

## Contract inventory

| Surface | Change |
| --- | --- |
| `laundry_order_entity` | `tenantId` NOT NULL + `fk_laundry_order_tenant`; `uq_laundry_order_id_tenant`; `fk_laundry_order_customer_tenant` replacing `fk_laundry_order_customer`; `idx_laundry_order_tenant_created` |
| `laundry_order_line_entity` | `tenantId` NOT NULL + `fk_laundry_order_line_tenant`; `fk_laundry_order_line_{order,service,add_on}_tenant` replacing the id-only three (CASCADE / RESTRICT / RESTRICT kept) |
| `invoice_entity` | `tenantId` NOT NULL + `fk_invoice_tenant`; `fk_invoice_{laundry_order,customer}_tenant` replacing the id-only two; `uq_invoice_tenant_number` replacing `uq_invoice_number`; `idx_invoice_tenant_issue` |
| `invoice_number_counter` | new (Decision 9) |
| `billing_invoice_number_seq` | dropped |
| `LaundryOrder` / `LaundryOrderLine` / `Invoice` domain | + `tenantId: string` |
| `OrderForInvoicing` | + `tenantId: string` |
| Entities | + `tenantId` column and `tenant` relation on the three entities. Every relation whose FK became composite gets `createForeignKeyConstraints: false` (#82 `PropertyEntity` precedent). `InvoiceEntity` `@Unique('uq_invoice_tenant_number', ['tenantId', 'invoiceNumber'])` |
| `LaundryOrderTransitionCommand`, `WeighLaundryOrderCommand` | + `tenantId: string` |
| `ReceiveLaundryOrderCommand.tenantId` | `string \| null` → `string` |
| `LaundryOrdersService` | every mutation scoped per Decision 6 and audit-tagged (Decision 11); `getOrder(id, tenantId: string \| null)`; `getOrderForInvoicing(id, tenantId: string)` |
| `InvoicesService` | `generateFromOrder` scoped per Decision 6, counter allocation (Decision 9), audit-tagged; `getInvoice(id, tenantId: string \| null)` |
| New `allocateInvoiceNumber(manager: EntityManager, tenantId: string): Promise<number>` | billing infrastructure, in `modules/billing/infrastructure/persistence/invoice-number-counter.ts` |
| GraphQL `LaundryOrderType`, `InvoiceType` | `@Authorize(tenantReadAuthorizer<…>())` |
| GraphQL `LaundryOrderResolver`, `InvoiceResolver` | `laundryOrder(id)` / `invoice(id)` pass `currentUser.tenantId`; every mutation passes `requireTenantId(currentUser)` |

**Deferred:** booking audit tagging (#90); REST cleanup (#91); two-tenant release gate (#92); any UI; invoice number format changes (RFC §10).

## TDD / verification strategy

- **Unit (Jest):**
  - Services: the tenant predicate is in the same query for every lookup, lock and update; `tenantId` is absent from every SET list; new orders, lines and invoices carry the right tenant; audit tags; a null tenant on `getOrder` / `getInvoice` makes no repository call.
  - Allocator: the exact upsert SQL and parameters on the given manager.
  - Resolvers: the tenant comes from the principal, and a null-tenant principal on a mutation throws `ForbiddenException` before the service is called.
  - `@Authorize` metadata, the relation-inventory regression, and `tenantId` absent from the schema.
- **Migration e2e** (throwaway database, `add-job-checklist-tenant.migration.e2e-spec.ts` harness): bootstrap assertion; backfill; each validation abort leaves data untouched; the constraint swap keeps the original `ON DELETE` actions; the composite FKs reject each tenant-mismatched reference; a line with the null side is accepted; cascade still works; the counter is seeded from the max suffix and the sequence is gone; `down` restores.
- **Two-tenant API e2e** (real Postgres, `AppModule`): every Decision 5–11 case, the #82 I1 criterion, spoofing (I-2), audit tags, per-tenant numbering and concurrency (I-3), and the DB backstop (I-1).
- **Suite health:** Tasks 1–5 are coupled. After Task 1 the NOT NULL columns break e2e fixtures and service calls. Unit tests MUST be green at the end of every task. The full e2e suite MUST be green from Task 5 onward, except failures that already exist on `main`: record their names at the start of M6 by running `pnpm --filter api test:e2e` on `main`. Any other failure blocks.
- **Final gate (Task 7):**
  - `pnpm --filter api lint`, `test`, `test:e2e` and `build`;
  - `migration:run` against a fresh database, then `migration:revert` + `migration:run`;
  - `schema:log` drift classification and `pg_constraint` verification;
  - `git diff --stat main -- apps/web packages` empty;
  - generated GraphQL schema diff against `main` empty.

## Review Focus

These are failure modes the RFC implies but reviewers can easily miss. The task named for each item has the test that pins it.

1. **Relation filter as an oracle (#82 I1):**
   - As B, `invoices(filter: { customer: { fullName: { like: "<A prefix>%" } } }) { totalCount }` ⇒ `0`.
   - The same for `laundryOrders`, and `invoices(filter: { laundryOrder: { status: { eq: <A order status> } } })` ⇒ `0`.
   - As A, the same filters return A's rows (positive control). (Task 6 case 2)
2. **Concurrent invoice numbering (I-3):**
   - N parallel `generateInvoiceFromOrder` calls on N distinct priced orders in one tenant ⇒ N distinct numbers whose suffixes are exactly `{k+1 … k+N}`.
   - A racing duplicate generate on one order ⇒ one `ConflictException`, and the counter still advanced by exactly one.
   - Two tenants each get `…000001` on their first invoice. (Task 6 case 9; Task 3 unit for the SQL)
3. **Lock scoped by tenant:** as B, every one of the 14 laundry mutations on A's order ⇒ 404, and A's status, `weightGrams`, `totalMinorUnits`, lines and `updatedAt` are unchanged (Task 2 unit, Task 6 case 4).
4. **Invoice tenant from the order row, not the request:** the unit test asserts the created invoice's and the audit's `tenantId` come from `order.tenantId`. It uses a mock where `getOrderForInvoicing` returns `tenantId: 't1'` and the command carries `'t1'`, and checks that the service passes `command.tenantId` into `getOrderForInvoicing` (Task 3).
5. **Client input tries to supply or widen the tenant (I-2):**
   - `invoices(filter: { tenantId: … })` ⇒ schema error;
   - an `or`-widening filter ⇒ empty;
   - an `x-tenant-id` header is ignored;
   - `receiveLaundryOrder` input with `tenantId` ⇒ validation error (Task 6 case 7).
6. **Down-migration hazard:** `down` re-adds global `uq_invoice_number`. It MUST fail loudly, not silently, if two tenants hold the same number string. Task 1 case 7 pins the fail-loud behavior on a database that has one.

---

### Task 1: Schema — domain, entities, migration, test cleanup helper

**Spec:** §4.4 (references; `(id, tenantId)` uniqueness; Invoice uniqueness and allocation), §4.5 (NOT NULL, tenant FK, indexes), §4.7 (backfill before NOT NULL); Slice decisions 2, 4, 9, 10, 12, 13, 14.

**Files:**
- Modify: `apps/api/src/modules/laundry/domain/laundry-order.ts`, `domain/laundry-order-line.ts`, `apps/api/src/modules/billing/domain/invoice.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/laundry/infrastructure/persistence/laundry-order.entity.ts`, `laundry-order-line.entity.ts`, `apps/api/src/modules/billing/infrastructure/persistence/invoice.entity.ts`
- Create: `apps/api/src/platform/database/migrations/1790784000000-AddLaundryBillingTenant.ts`
- Modify: `apps/api/test/helpers/seed-tenant-admin.ts`
- Test: `apps/api/test/add-laundry-billing-tenant.migration.e2e-spec.ts`

**Interfaces:**
- Produces: `LaundryOrder.tenantId`, `LaundryOrderLine.tenantId`, `Invoice.tenantId` (`string`); entity `tenantId` / `tenant` on the three entities; the constraint, table and index names of the Global constraints.

- [ ] **Step 1: Write the failing migration e2e.**
  - **Harness:** the same as `test/add-job-checklist-tenant.migration.e2e-spec.ts`: a throwaway database, `connectionOptions` / `migrationsBefore` from `test/helpers/migration-db.ts`, the explicit `inTransaction` wrapper, sequential cases.
  - **Fixtures (raw SQL):** one bootstrap customer, service and add-on, plus a second tenant with its own customer, service and add-on. Laundry orders, lines and invoices are inserted with raw SQL (no `tenantId` before `up`). Invoice numbers are explicit strings, and the sequence is advanced with `nextval` to mimic history.

```ts
const NEW_CONSTRAINTS = [
  ['laundry_order_entity', 'fk_laundry_order_tenant'],
  ['laundry_order_entity', 'uq_laundry_order_id_tenant'],
  ['laundry_order_entity', 'fk_laundry_order_customer_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_order_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_service_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_add_on_tenant'],
  ['invoice_entity', 'fk_invoice_tenant'],
  ['invoice_entity', 'fk_invoice_laundry_order_tenant'],
  ['invoice_entity', 'fk_invoice_customer_tenant'],
  ['invoice_entity', 'uq_invoice_tenant_number'],
  ['invoice_number_counter', 'fk_invoice_number_counter_tenant'],
] as const;
const OLD_CONSTRAINTS = [
  ['laundry_order_entity', 'fk_laundry_order_customer'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_order'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_service'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_add_on'],
  ['invoice_entity', 'fk_invoice_laundry_order'],
  ['invoice_entity', 'fk_invoice_customer'],
  ['invoice_entity', 'uq_invoice_number'],
] as const;
```

Cases, in order:
1. **Bootstrap missing ⇒ abort.** With the bootstrap tenant row temporarily absent (the technique the job suite uses), `up` rejects with `/bootstrap tenant .* not found/`. None of the three tables has a `tenantId` column, and `billing_invoice_number_seq` still exists.
2. **Reference validation aborts (Decision 12).** Each sub-case inserts one offending row, expects `up` to reject with the given pattern, then checks that no table has `tenantId`, every `OLD_CONSTRAINTS` name still exists and the sequence still exists. It then deletes the row.
   - a laundry order on the **second tenant's customer** ⇒ `/AddLaundryBillingTenant: .*laundry order.*customer/`;
   - a bootstrap order with a line whose **non-null** `serviceId` is the second tenant's service ⇒ `/service/`;
   - the same with `addOnId` ⇒ `/add-on/`;
   - an invoice on a bootstrap order whose `customerId` is the second tenant's customer ⇒ `/invoice.*customer/`.
3. **Invoice-number validation aborts (Decision 10).** Same assertions as case 2.
   - an invoice numbered `LEGACY-7` ⇒ `/invoice number format/`;
   - two bootstrap invoices `INV-2025-000010` and `INV-2026-000010` (same suffix, different years) ⇒ `/duplicate invoice number/`.
4. **Happy path.** Insert:
   - two bootstrap orders with lines, one line with `serviceId` only and one with `addOnId` only (proving validation accepts the null side);
   - two invoices `INV-2026-000041` and `INV-2026-000042`, each with one invoice line;
   - `nextval` advanced to 45, so burned values exist.

   Run `up`, then check:
   - every order, line and invoice has `tenantId = BOOTSTRAP_TENANT_ID`, and all three columns are `NOT NULL`;
   - every `NEW_CONSTRAINTS` name exists in `pg_constraint` for its table, and no `OLD_CONSTRAINTS` name does;
   - `confdeltype` is `'c'` for `fk_laundry_order_line_order_tenant` and `'r'` for the other five composite FKs;
   - `idx_laundry_order_tenant_created` and `idx_invoice_tenant_issue` exist in `pg_indexes`;
   - `uq_invoice_laundry_order`, `fk_invoice_line_invoice`, `ck_laundry_order_line_target` and `ck_laundry_order_weight_non_negative` still exist;
   - `invoice_line_entity` has no `tenantId` column;
   - `SELECT to_regclass('billing_invoice_number_seq')` is `NULL`;
   - `invoice_number_counter` holds exactly one row, `(BOOTSTRAP_TENANT_ID, 42)`. That is the max suffix, **not** the sequence's 45 (Decision 10).
5. **Composite FKs reject mismatches (I-1).** Each case expects a rejection whose `error.driverError.constraint` names the matching FK:
   - a bootstrap-tenant order with the second tenant's customer ⇒ `fk_laundry_order_customer_tenant`;
   - a line with `tenantId` = the second tenant on a bootstrap order ⇒ `fk_laundry_order_line_order_tenant`;
   - a bootstrap line with the second tenant's service ⇒ `fk_laundry_order_line_service_tenant`, and the add-on equivalent ⇒ `fk_laundry_order_line_add_on_tenant`;
   - an invoice with `tenantId` = the second tenant on a bootstrap order ⇒ `fk_invoice_laundry_order_tenant`;
   - a bootstrap invoice with the second tenant's customer ⇒ `fk_invoice_customer_tenant`;
   - an invoice duplicating `(BOOTSTRAP, 'INV-2026-000042')` ⇒ `uq_invoice_tenant_number`.

   Then insert a second-tenant order, and an invoice for it numbered `INV-2026-000042`: it **succeeds**, because the number is unique per tenant only.
6. **Cascade kept.** Deleting an order that has no invoice deletes its lines.
7. **`down`.** `down` sets the sequence to `MAX(suffix)` over all invoices and uses `is_called = true` only when invoices exist.
   - First, with the case-5 second-tenant invoice still present, `down` rejects on re-adding `uq_invoice_number` (Review Focus 6: it fails loudly and the transaction rolls back).
   - Delete that invoice, then `down` succeeds:
     - every `OLD_CONSTRAINTS` name is restored with its original `ON DELETE` action;
     - every `NEW_CONSTRAINTS` name, both indexes and `invoice_number_counter` are gone;
     - the three `tenantId` columns are dropped;
     - `billing_invoice_number_seq` exists with `nextval` = 43;
     - existing rows survive.

- [ ] **Step 2: Run and confirm failure.** `pnpm --filter api test:e2e -- add-laundry-billing-tenant` ⇒ fails (migration module does not exist).

- [ ] **Step 3: Write the migration.**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for LaundryOrder, LaundryOrderLine and Invoice (#87; RFC
// §4.4, §4.5, §4.7). InvoiceLine is owned via its Invoice and is not touched
// (#87 slice decision 2). Step order is load-bearing and the whole migration
// is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on the three tables.
//   2. Backfill: orders and invoices to the bootstrap tenant; lines from
//      their order.
//   3. Validate tenant-consistent references and invoice numbers (slice
//      decisions 10, 12). Fails closed; the transaction rolls back.
//   4. NOT NULL + FK to `tenant_entity` (ON DELETE RESTRICT) on the three.
//   5. `UNIQUE (id, "tenantId")` on laundry orders — target of the line and
//      invoice composite FKs (slice decision 13).
//   6. Replace each id-only parent FK with its composite `(refId,
//      "tenantId")` FK in the same step, keeping its ON DELETE action (slice
//      decision 4). MATCH SIMPLE: the null side of a line's service/add-on
//      pair is not checked; `ck_laundry_order_line_target` keeps exactly one
//      side non-null.
//   7. Per-tenant invoice numbering (slice decisions 9, 10): per-tenant
//      unique, counter table seeded from the max existing suffix, global
//      sequence dropped.
//   8. Tenant-leading indexes matching the root default sorts.
const PARENT_FKS = [
  ['laundry_order_entity', 'fk_laundry_order_customer', 'fk_laundry_order_customer_tenant', 'customerId', 'customer_entity', 'RESTRICT'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_order', 'fk_laundry_order_line_order_tenant', 'laundryOrderId', 'laundry_order_entity', 'CASCADE'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_service', 'fk_laundry_order_line_service_tenant', 'serviceId', 'service_entity', 'RESTRICT'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_add_on', 'fk_laundry_order_line_add_on_tenant', 'addOnId', 'add_on_entity', 'RESTRICT'],
  ['invoice_entity', 'fk_invoice_laundry_order', 'fk_invoice_laundry_order_tenant', 'laundryOrderId', 'laundry_order_entity', 'RESTRICT'],
  ['invoice_entity', 'fk_invoice_customer', 'fk_invoice_customer_tenant', 'customerId', 'customer_entity', 'RESTRICT'],
] as const;

const TENANT_FKS = [
  ['laundry_order_entity', 'fk_laundry_order_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_tenant'],
  ['invoice_entity', 'fk_invoice_tenant'],
] as const;

const INVOICE_NUMBER_PATTERN = '^INV-[0-9]{4}-[0-9]{6,}$';

export class AddLaundryBillingTenant1790784000000 implements MigrationInterface {
  name = 'AddLaundryBillingTenant1790784000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddLaundryBillingTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    for (const [table] of TENANT_FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "tenantId" uuid`);
    }
    await queryRunner.query(`UPDATE "laundry_order_entity" SET "tenantId" = $1`, [BOOTSTRAP_TENANT_ID]);
    await queryRunner.query(
      `UPDATE "laundry_order_line_entity" l SET "tenantId" = o."tenantId" FROM "laundry_order_entity" o WHERE o."id" = l."laundryOrderId"`,
    );
    await queryRunner.query(`UPDATE "invoice_entity" SET "tenantId" = $1`, [BOOTSTRAP_TENANT_ID]);

    // Slice decision 12. Tenant mismatch only: the id-only parent FKs are
    // still in place here and already guarantee every non-null reference
    // exists.
    const problems: string[] = [];
    for (const [table, column, parent, label] of [
      ['laundry_order_entity', 'customerId', 'customer_entity', 'laundry order(s) reference a customer'],
      ['laundry_order_line_entity', 'laundryOrderId', 'laundry_order_entity', 'laundry line(s) reference an order'],
      ['laundry_order_line_entity', 'serviceId', 'service_entity', 'laundry line(s) reference a service'],
      ['laundry_order_line_entity', 'addOnId', 'add_on_entity', 'laundry line(s) reference an add-on'],
      ['invoice_entity', 'laundryOrderId', 'laundry_order_entity', 'invoice(s) reference a laundry order'],
      ['invoice_entity', 'customerId', 'customer_entity', 'invoice(s) reference a customer'],
    ] as const) {
      // An inner join skips NULL references (the unused side of a line).
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "${table}" c JOIN "${parent}" p ON p."id" = c."${column}" WHERE p."tenantId" <> c."tenantId"`,
      )) as { count: number }[];
      if (count > 0) {
        problems.push(`${count} ${label} in another tenant`);
      }
    }

    // Slice decision 10: every number must parse, and the numeric suffix
    // (the allocation value; the year is presentation only) must not repeat
    // within a tenant, before any counter is seeded from it.
    const [{ malformed }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS "malformed" FROM "invoice_entity" WHERE "invoiceNumber" !~ $1`,
      [INVOICE_NUMBER_PATTERN],
    )) as { malformed: number }[];
    if (malformed > 0) {
      problems.push(`${malformed} invoice(s) do not match the invoice number format`);
    } else {
      const [{ duplicates }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "duplicates" FROM (SELECT 1 FROM "invoice_entity" GROUP BY "tenantId", split_part("invoiceNumber", '-', 3)::bigint HAVING COUNT(*) > 1) d`,
      )) as { duplicates: number }[];
      if (duplicates > 0) {
        problems.push(`${duplicates} duplicate invoice number suffix(es) within a tenant`);
      }
    }
    if (problems.length > 0) {
      throw new Error(`AddLaundryBillingTenant: ${problems.join('; ')}`);
    }

    for (const [table, fk] of TENANT_FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "laundry_order_entity" ADD CONSTRAINT "uq_laundry_order_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    for (const [table, oldName, newName, column, parent, onDelete] of PARENT_FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${oldName}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${newName}" FOREIGN KEY ("${column}", "tenantId") REFERENCES "${parent}"("id", "tenantId") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(`ALTER TABLE "invoice_entity" DROP CONSTRAINT "uq_invoice_number"`);
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "uq_invoice_tenant_number" UNIQUE ("tenantId", "invoiceNumber")`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_number_counter" ("tenantId" uuid NOT NULL, "lastValue" bigint NOT NULL DEFAULT 0, CONSTRAINT "pk_invoice_number_counter" PRIMARY KEY ("tenantId"), CONSTRAINT "ck_invoice_number_counter_non_negative" CHECK ("lastValue" >= 0), CONSTRAINT "fk_invoice_number_counter_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") SELECT "tenantId", MAX(split_part("invoiceNumber", '-', 3)::bigint) FROM "invoice_entity" GROUP BY "tenantId"`,
    );
    await queryRunner.query(`DROP SEQUENCE "billing_invoice_number_seq"`);

    await queryRunner.query(
      `CREATE INDEX "idx_laundry_order_tenant_created" ON "laundry_order_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_tenant_issue" ON "invoice_entity" ("tenantId", "issueDate" DESC, "createdAt" DESC, "id")`,
    );
  }

  // Reverses 8 → 1, restoring the original id-only FKs, the global
  // `uq_invoice_number` and the sequence (positioned after the highest
  // existing suffix). Re-adding the global unique fails — and rolls the
  // revert back — if two tenants hold the same number string: that data
  // cannot be represented in the pre-#87 schema.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_invoice_tenant_issue"`);
    await queryRunner.query(`DROP INDEX "public"."idx_laundry_order_tenant_created"`);

    await queryRunner.query(`CREATE SEQUENCE "billing_invoice_number_seq"`);
    await queryRunner.query(
      `SELECT setval('billing_invoice_number_seq', m, true) FROM (SELECT MAX(split_part("invoiceNumber", '-', 3)::bigint) AS m FROM "invoice_entity") s WHERE m IS NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "invoice_number_counter"`);
    await queryRunner.query(`ALTER TABLE "invoice_entity" DROP CONSTRAINT "uq_invoice_tenant_number"`);
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "uq_invoice_number" UNIQUE ("invoiceNumber")`,
    );

    for (const [table, oldName, newName, column, parent, onDelete] of [...PARENT_FKS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${newName}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${oldName}" FOREIGN KEY ("${column}") REFERENCES "${parent}"("id") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(`ALTER TABLE "laundry_order_entity" DROP CONSTRAINT "uq_laundry_order_id_tenant"`);
    for (const [table, fk] of [...TENANT_FKS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "tenantId"`);
    }
  }
}
```

Format with Prettier as the repository's lint config requires; the long tuple lines above are compacted for the plan only. Confirm during M6 that the migrations glob in `data-source.ts` picks up the file, as it does `1790697600000-AddJobChecklistTenant.ts`.

- [ ] **Step 4: Domain + entities.**
   - **Domain.** `LaundryOrder`, `LaundryOrderLine` and `Invoice` gain `tenantId: string`, with a comment citing I-1. On `LaundryOrderLine` it is the order's tenant.
   - **`LaundryOrderEntity`:**
     - add a `tenantId` column plus a `tenant` `@ManyToOne(() => TenantEntity, …)` with `@JoinColumn({ name: 'tenantId', foreignKeyConstraintName: 'fk_laundry_order_tenant' })`, copying the `CleaningJobEntity` shape;
     - on `customer`, replace `onDelete` / `foreignKeyConstraintName` with `createForeignKeyConstraints: false`;
     - header comment: "`fk_laundry_order_customer_tenant` is hand-written in `AddLaundryBillingTenant`; `migration:generate` may propose dropping it or re-adding an id-only FK — do not apply that".
   - **`LaundryOrderLineEntity`:** `tenantId` + `tenant` (`fk_laundry_order_line_tenant`). On `order`, `service` and `addOn`, use `createForeignKeyConstraints: false`, keeping the relations (`order` backs the `lines` connection). The same comment names the three hand-written `_tenant` FKs.
   - **`InvoiceEntity`:**
     - `tenantId` + `tenant` (`fk_invoice_tenant`);
     - on `laundryOrder` and `customer`, use `createForeignKeyConstraints: false`;
     - `@Unique('uq_invoice_number', ['invoiceNumber'])` becomes `@Unique('uq_invoice_tenant_number', ['tenantId', 'invoiceNumber'])`;
     - update the header comment. The sequence sentence becomes: "numbers are allocated per tenant from the hand-written `invoice_number_counter` table (#87 slice decision 9); it has no entity".
   - **`InvoiceLineEntity`** is unchanged (Decision 2).
   - **ORM ownership check.** Every FK Decision 4 replaces is TypeORM-owned today, through a `@ManyToOne` + `@JoinColumn({ foreignKeyConstraintName })`. Re-confirm at M6 start with `grep -n "ManyToOne\|JoinColumn" apps/api/src/modules/{laundry,billing}/infrastructure/persistence/*.ts`. Any relation whose FK became composite MUST carry `createForeignKeyConstraints: false`.

- [ ] **Step 5: Cleanup helper.** In `removeTestTenants`, before the customer, service and add-on deletes, add:

   ```ts
   // Invoices first: `fk_invoice_laundry_order_tenant` / `_customer_tenant`
   // are ON DELETE RESTRICT (their lines go by `fk_invoice_line_invoice`
   // CASCADE). Then laundry orders (lines CASCADE via
   // `fk_laundry_order_line_order_tenant`; the line → service/add-on FKs are
   // RESTRICT, so orders must go before the catalog). The counter row
   // references the tenant (RESTRICT). By #87's composite FKs a test
   // tenant's order/invoice can only reference that tenant's rows.
   await dataSource.query(`DELETE FROM "invoice_entity" WHERE "tenantId" = ANY($1)`, [ids]);
   await dataSource.query(`DELETE FROM "laundry_order_entity" WHERE "tenantId" = ANY($1)`, [ids]);
   await dataSource.query(`DELETE FROM "invoice_number_counter" WHERE "tenantId" = ANY($1)`, [ids]);
   ```

   Keep the bootstrap-exclusion invariant unchanged.

- [ ] **Step 6: ORM drift check** (#86 Task 1 Step 6 method).
   - **Baseline**, recorded at M6 start on `main`: migrate a fresh database, then save `pnpm --filter api typeorm schema:log`.
   - **After this task:** repeat, and diff the two outputs. Classify every changed line into exactly one bucket:
     - **Expected (hand-written, not in entity metadata):**
       - proposed `DROP CONSTRAINT` of any of the six `_tenant` composite FKs or `uq_laundry_order_id_tenant`;
       - proposed `DROP INDEX` of `idx_laundry_order_tenant_created` / `idx_invoice_tenant_issue`;
       - the disappearance of any baseline proposal touching the six replaced id-only FKs, `uq_invoice_number` or `billing_invoice_number_seq`.
     - **Mapping defect (blocks):**
       - a proposed add of an id-only FK on `customerId`, `laundryOrderId`, `serviceId` or `addOnId` in the three tables;
       - any proposal touching `fk_laundry_order_tenant`, `fk_laundry_order_line_tenant`, `fk_invoice_tenant`, `uq_invoice_tenant_number` or a `tenantId` column. These are ORM-mapped and must show **no** drift.
     - **Unexplained:** anything else. Unexplained lines block until they are fixed in the entity (never by editing the migration to match) or recorded with a reason. TypeORM does not drop unknown tables, so `invoice_number_counter` is expected **not** to appear. If it does, classify it here and record it.
   - **Constraint verification** on the freshly migrated database: query `pg_constraint` with `pg_get_constraintdef(oid)` and confirm, for each of the six composite FKs, the exact column pair, the parent pair and `confdeltype` (`c` for the line → order FK, `r` otherwise). Confirm that no FK on the three tables has a single-column list of `customerId`, `laundryOrderId`, `serviceId` or `addOnId`.
   - Record both `schema:log` outputs, the classified diff and the constraint query results in the task report.

- [ ] **Step 7: Run.** `pnpm --filter api test:e2e -- add-laundry-billing-tenant` ⇒ PASS. `pnpm --filter api test` (unit) ⇒ PASS. TypeScript may now flag `LaundryOrder` / `Invoice` literals in unit specs without `tenantId`; add `tenantId: 'tenant-1'` there. Other e2e suites are expected to fail until Task 5.

- [ ] **Step 8: Commit.** `git commit -m "feat(87): add laundry/invoice tenant ownership, composite FKs and per-tenant invoice counter"`

---

### Task 2: `LaundryOrdersService` tenant-scoped on every operation, audit-tagged

**Spec:** §4.4 (application validation), §4.5 (same predicate on services and mutations; cross-tenant = missing row), §4.6; Slice decisions 6, 7, 8, 11; I-1, I-2.

**Files:**
- Modify: `apps/api/src/modules/laundry/application/commands/laundry-order-transition.command.ts`, `weigh-laundry-order.command.ts`, `receive-laundry-order.command.ts`, `price-laundry-order.command.ts` (comment only)
- Modify: `apps/api/src/modules/laundry/application/services/laundry-orders.service.ts`, `order-for-invoicing.ts`
- Test: `apps/api/src/modules/laundry/tests/application/laundry-orders.service.spec.ts`

**Interfaces:**
- Consumes: `LaundryOrder.tenantId`, `LaundryOrderLine.tenantId` (Task 1).
- Produces:
  - `LaundryOrderTransitionCommand { actorId; orderId; tenantId: string }`;
  - `WeighLaundryOrderCommand { actorId; orderId; weightGrams; tenantId: string }`;
  - `ReceiveLaundryOrderCommand.tenantId: string`;
  - `getOrder(id: string, tenantId: string | null): Promise<LaundryOrder | null>`;
  - `getOrderForInvoicing(id: string, tenantId: string): Promise<OrderForInvoicing | null>`;
  - `OrderForInvoicing.tenantId: string`.

- [ ] **Step 1: Write failing unit tests** (extend the existing mocks):
   - **Every transition verb** (`it.each` over the 12 verbs with their valid source status): `manager.findOne(LaundryOrderEntity, { lock: { mode: 'pessimistic_write' }, where: { id: 'o1', tenantId: 't1' } })`. `manager.update(LaundryOrderEntity, { id: 'o1', tenantId: 't1' }, …)`, with no `tenantId` key in the SET. `findOneByOrFail(LaundryOrderEntity, { id: 'o1', tenantId: 't1' })`. The audit call is `{ actorId, entityId: 'o1', action, entityType: 'laundry_order', tenantId: 't1', scope: AdminScope.TENANT }`.
   - **Lock miss:** `findOne` returning `null` ⇒ `NotFoundException('Laundry order o1 not found')`, with no `update` and no audit call.
   - **`weigh({ …, tenantId: 't1' })`:** the lock, the update WHERE (both RECEIVED and re-weigh branches) and the re-read carry `tenantId: 't1'`; the audit call is tagged.
   - **`price({ …, tenantId: 't1' })`:**
     - the lock carries the tenant;
     - every `manager.create(LaundryOrderLineEntity, …)` includes `tenantId: 't1'`, taken from the locked order row (make the mock order's `tenantId` `'t1'`);
     - `resolveEffectivePricing` still receives `'t1'`;
     - the update WHERE `{ id, tenantId }`, the re-read, and the tagged audit call.
   - **`receive({ …, tenantId: 't1' })`:** `getCustomer(customerId, 't1')` as today; `manager.create(LaundryOrderEntity, …)` includes `tenantId: 't1'`; the re-read is `{ id, tenantId: 't1' }`; the audit call is tagged.
   - **Reads:**
     - `getOrder('o1', 't1')` ⇒ `findOneBy({ id: 'o1', tenantId: 't1' })`, and `getOrder('o1', null)` ⇒ `null` with no call.
     - `getOrderForInvoicing('o1', 't1')` ⇒ `findOneBy({ id: 'o1', tenantId: 't1' })` and `lineRepository.find({ order: { createdAt: 'ASC' }, where: { laundryOrderId: 'o1', tenantId: 't1' } })`, and the result has `tenantId: 't1'`. A miss ⇒ `null` with no line query.
   - Replace the existing unscoped `getOrder` / `getOrderForInvoicing` tests with the scoped forms.

- [ ] **Step 2: Run** `pnpm --filter api test -- laundry-orders.service` ⇒ FAIL.

- [ ] **Step 3: Implement** per Step 1 and Decisions 6, 8 and 11:
   - `lock(manager, id, tenantId)`;
   - `transition(manager, lockedOrder, target, action, actorId)` uses `lockedOrder.tenantId` in the WHERE and in the audit;
   - `audit(actorId, action, entityId, tenantId)` adds `tenantId` and `scope: AdminScope.TENANT`;
   - import `AdminScope` from `platform/auth/domain/admin-scope`.

   Comment refreshes:
   - the `price` comment "`fk_laundry_order_line_service` / `_add_on` stay id-only until #87" becomes "application half of I-1; `fk_laundry_order_line_service_tenant` / `_add_on_tenant` are the database half";
   - `receive`'s "`fk_laundry_order_customer` is the actual check" becomes `fk_laundry_order_customer_tenant`;
   - the command-file comments cite #87 Slice decision 8, and `ReceiveLaundryOrderCommand` drops its "stays `string | null`" paragraph;
   - the `order-for-invoicing.ts` header adds: "`tenantId` is the order row's tenant; Billing stamps it on the invoice (#87 slice decision 6)".

- [ ] **Step 4: Run** `pnpm --filter api test -- laundry-orders.service` ⇒ PASS. The resolver and billing will not compile until Tasks 3–4; run with `--testPathPattern laundry-orders.service` for now.

- [ ] **Step 5: Commit.** `git commit -m "feat(87): scope LaundryOrdersService by tenant and tag laundry audit events"`

---

### Task 3: `InvoicesService` tenant-scoped, per-tenant number allocation, audit-tagged

**Spec:** §4.4 (Invoice uniqueness and allocation; invoice → laundry order and customer), §4.5, §4.6; invariant 5; Slice decisions 6, 7, 9, 11; I-1, I-3.

**Files:**
- Create: `apps/api/src/modules/billing/infrastructure/persistence/invoice-number-counter.ts`
- Modify: `apps/api/src/modules/billing/application/services/invoices.service.ts`, `application/commands/generate-invoice-from-order.command.ts` (comment), `domain/invoice-number.ts` (comment)
- Test: `apps/api/src/modules/billing/tests/application/invoices.service.spec.ts`; create `apps/api/src/modules/billing/tests/infrastructure/invoice-number-counter.spec.ts`

**Interfaces:**
- Consumes: `getOrderForInvoicing(id, tenantId)` / `OrderForInvoicing.tenantId` (Task 2); `Invoice.tenantId` (Task 1).
- Produces: `allocateInvoiceNumber(manager: EntityManager, tenantId: string): Promise<number>`; `getInvoice(id: string, tenantId: string | null): Promise<Invoice | null>`.

- [ ] **Step 1: Failing tests.**
   - **`invoice-number-counter.spec.ts`:** with a mock manager whose `query` resolves `[{ lastValue: '7' }]`, `allocateInvoiceNumber(manager, 't1')` resolves to `7` (a number, since `bigint` arrives as a string). The call is exactly:

     ```ts
     expect(manager.query).toHaveBeenCalledWith(
       'INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1) ON CONFLICT ("tenantId") DO UPDATE SET "lastValue" = "invoice_number_counter"."lastValue" + 1 RETURNING "lastValue"',
       ['t1'],
     );
     ```

     A second test checks that a value above `Number.MAX_SAFE_INTEGER` throws. That is unreachable in practice, but the bigint → number conversion must not silently lose precision.
   - **`invoices.service.spec.ts`:**
     - `generateFromOrder({ …, tenantId: 't1' })` calls `getOrderForInvoicing('o1', 't1')`;
     - the pre-check and the in-transaction race check are `findOneBy({ laundryOrderId: 'o1', tenantId: 't1' })`;
     - `allocateInvoiceNumber` is invoked with the **transaction** manager and `'t1'`. Spy on the module export, or assert the manager's `query` SQL. Remove the old `/nextval/i` assertion;
     - `manager.create(InvoiceEntity, …)` includes `tenantId: 't1'` and `invoiceNumber: formatInvoiceNumber(<allocated>, <Manila year>)`;
     - the re-read is `{ id, tenantId: 't1' }`;
     - the audit call is `{ …, action: 'invoice.generated', entityType: 'invoice', tenantId: 't1', scope: AdminScope.TENANT }`;
     - **Review Focus 4:** the mocked order carries `tenantId: 't1'`, and the created invoice's and the audit's `tenantId` equal the **order's** `tenantId`.
     - `getOrderForInvoicing` returning `null` ⇒ `NotFoundException('Laundry order o1 not found')`, and no transaction.
     - A `uq_invoice_tenant_number` violation from `save` is rethrown unchanged, not as a `ConflictException`. `uq_invoice_laundry_order` still maps to `ConflictException`.
     - `getInvoice('i1', 't1')` ⇒ `findOneBy({ id: 'i1', tenantId: 't1' })`, and `getInvoice('i1', null)` ⇒ `null` with no call.

- [ ] **Step 2: Run** `pnpm --filter api test -- billing` ⇒ FAIL.

- [ ] **Step 3: Implement.**

```ts
// apps/api/src/modules/billing/infrastructure/persistence/invoice-number-counter.ts
import { EntityManager } from 'typeorm';

// Per-tenant, concurrency-safe invoice-number allocation (#87 slice
// decision 9; RFC §4.4, invariant 5). MUST run on the generate
// transaction's manager: the upsert's row lock on the tenant's counter is
// held until commit, so concurrent generates in one tenant serialize and
// get distinct values, and a rolled-back generate rolls its increment back.
// Not read-then-increment. `invoice_number_counter` is hand-written in
// `AddLaundryBillingTenant` and has no entity.
const ALLOCATE_SQL =
  'INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1) ON CONFLICT ("tenantId") DO UPDATE SET "lastValue" = "invoice_number_counter"."lastValue" + 1 RETURNING "lastValue"';

export async function allocateInvoiceNumber(
  manager: EntityManager,
  tenantId: string,
): Promise<number> {
  const rows = (await manager.query(ALLOCATE_SQL, [tenantId])) as Array<{
    lastValue: string;
  }>;
  const value = Number(rows[0].lastValue);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Invoice number counter out of range for tenant ${tenantId}`);
  }
  return value;
}
```

   In `InvoicesService`:
   - remove `NUMBER_SEQUENCE` and the `nextval` query, and call `allocateInvoiceNumber(manager, order.tenantId)` in the same position inside the transaction, after the race check;
   - scope per Step 1;
   - in `saveInvoice`, update the comment from `uq_invoice_number` to `uq_invoice_tenant_number`.

   Comment refreshes:
   - `invoice-number.ts`: "the backing PostgreSQL sequence is global and never resets" becomes "the value comes from the tenant's `invoice_number_counter` row (#87 slice decision 9; RFC §4.4 replaces the global sequence) and never resets".
   - `GenerateInvoiceFromOrderCommand.tenantId`: "the principal's tenant; scopes the order lookup. The invoice's own `tenantId` is the scoped order row's (#87 slice decision 6)".

- [ ] **Step 4: Run** `pnpm --filter api test -- billing` ⇒ PASS for the service and counter specs. The resolver spec compiles after Task 4.

- [ ] **Step 5: Commit.** `git commit -m "feat(87): scope InvoicesService by tenant with per-tenant invoice numbering"`

---

### Task 4: GraphQL — `@Authorize`, scoped queries and mutations, relation regression

**Spec:** §4.5 (nestjs-query QueryService / ReadResolver / Relatable paths, relation resolvers, mutations); Slice decisions 5, 7, 8.

**Files:**
- Modify: `apps/api/src/modules/laundry/presentation/graphql/laundry-order.type.ts`, `laundry-order.resolver.ts`; `apps/api/src/modules/billing/presentation/graphql/invoice.type.ts`, `invoice.resolver.ts`
- Test: `apps/api/src/modules/laundry/tests/graphql/laundry-order.resolver.spec.ts`, `apps/api/src/modules/billing/tests/graphql/invoice.resolver.spec.ts`
- Create test: `apps/api/src/modules/laundry/tests/graphql/laundry-order-read.authorization.spec.ts`, `apps/api/src/modules/billing/tests/graphql/invoice-relations.authorization.spec.ts`

**Interfaces:**
- Consumes: Task 2 and 3 signatures.

- [ ] **Step 1: Failing tests.**
   - **`laundry-order.resolver.spec.ts`:**
     - `laundryOrder('o1', principal)` calls `getOrder('o1', principal.tenantId)`, and a principal with `tenantId: null` calls `getOrder('o1', null)`;
     - `it.each` over the 14 mutations: each passes `tenantId: principal.tenantId` in its command, and a `tenantId: null` principal ⇒ `ForbiddenException` with the service not called.
   - **`invoice.resolver.spec.ts`:** `invoice('i1', principal)` ⇒ `getInvoice('i1', principal.tenantId)`. `generateInvoiceFromOrder` keeps its existing tenant tests.
   - **`laundry-order-read.authorization.spec.ts`:** a tenant-authorizer `describe.each` over `[LaundryOrderType, InvoiceType]`, copied from `apps/api/src/modules/catalog/tests/graphql/service-read.resolver.spec.ts:118-150`. It checks:
     - the authorizer is registered;
     - `{ req: { user: { tenantId: 't-a' } } }` ⇒ `{ tenantId: { eq: 't-a' } }`;
     - no `req.user` ⇒ `{ id: { is: null } }`.

     In the same spec, build the schema from `[LaundryOrderReadResolver, LaundryOrderResolver, InvoiceReadResolver, InvoiceResolver]` as the catalog spec does at `:66-77`. Assert that `LaundryOrder`, `LaundryOrderFilter`, `LaundryOrderLine`, `Invoice`, `InvoiceFilter`, `InvoiceLine`, `ReceiveLaundryOrderInput`, `LaundryOrderRefInput`, `WeighLaundryOrderInput`, `PriceLaundryOrderInput` and `GenerateInvoiceFromOrderInput` have no `tenantId` field. If building a resolver in the schema factory requires unavailable providers, assert from the resolver-free schema instead and record it.
   - **`invoice-relations.authorization.spec.ts`** (its own file, because importing other modules' GraphQL types registers them globally):

```ts
// TEST-ONLY deep import, tied to the installed @ptc-org/nestjs-query-graphql
// 9.5.0 package layout (it does not re-export getRelations from the package
// root). Same pattern as #82-#86.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import { LaundryOrderLineType } from '../../../laundry/presentation/graphql/laundry-order-line.type';
import { LaundryOrderType } from '../../../laundry/presentation/graphql/laundry-order.type';
import { InvoiceLineType } from '../../presentation/graphql/invoice-line.type';
import { InvoiceType } from '../../presentation/graphql/invoice.type';

// #87 Slice decision 5 / Global constraints. nestjs-query gives a
// relation's own `auth` precedence over the target DTO's `@Authorize`, so an
// `auth` on any relation into a laundry/invoice type would bypass the tenant
// predicate. Planning-time inventory: Invoice.laundryOrder (defers to
// LaundryOrderType's authorizer), LaundryOrder.lines and Invoice.lines
// (owned via their authorized parent, slice decision 2).
describe('Relations targeting laundry / invoice types (tenant isolation, #87)', () => {
  it('matches the inventory, overrides no auth, and enables no relation mutations', () => {
    const targets = new Set<unknown>([
      LaundryOrderType,
      LaundryOrderLineType,
      InvoiceType,
      InvoiceLineType,
    ]);
    const owners = [
      ['LaundryOrder', LaundryOrderType],
      ['LaundryOrderLine', LaundryOrderLineType],
      ['Invoice', InvoiceType],
      ['InvoiceLine', InvoiceLineType],
      ['Customer', CustomerType],
    ] as const;
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({ ...many, ...one })) {
        if (!targets.has(relation.DTO)) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual([
      'Invoice.laundryOrder',
      'Invoice.lines',
      'LaundryOrder.lines',
    ]);
  });

  it('customer relations keep deferring to CustomerType’s authorizer', () => {
    expect(getRelations(InvoiceType as never).one?.customer.auth).toBeUndefined();
    expect(getRelations(LaundryOrderType as never).one?.customer.auth).toBeUndefined();
  });
});
```

   If `getRelations` stores the `lines` connections under a key other than `many` (for example `OffsetConnection` in 9.5.0), adapt the destructuring to that storage and record it. The expected inventory is unchanged.

- [ ] **Step 2: Run** `pnpm --filter api test -- laundry billing` ⇒ FAIL.

- [ ] **Step 3: Implement.**
   - `laundry-order.type.ts` / `invoice.type.ts`: add `@Authorize(tenantReadAuthorizer<…>())` above `@QueryOptions`, using the #82 comment wording. The `InvoiceType` comment also states that `laundryOrder` / `customer` relation filters are same-tenant by root scoping plus the composite FKs (#82 I1, Decision 5).
   - `laundry-order.resolver.ts`:
     - `laundryOrder(id, @CurrentUser() currentUser)` ⇒ `getOrder(id, currentUser.tenantId)`;
     - `run()` passes `tenantId: requireTenantId(user)`;
     - `weighLaundryOrder` and `receiveLaundryOrder` pass `tenantId: requireTenantId(user)`.
   - `invoice.resolver.ts`: `invoice(id, @CurrentUser() currentUser)` ⇒ `getInvoice(id, currentUser.tenantId)`.

- [ ] **Step 4: Run** `pnpm --filter api test` (whole unit suite) ⇒ PASS, and `pnpm --filter api build` ⇒ PASS (all call sites compile).

- [ ] **Step 5: Commit.** `git commit -m "feat(87): tenant-authorize laundry/invoice reads and scope their mutations"`

---

### Task 5: Existing e2e suites follow the new contract

**Spec:** RFC §4.5; Slice decisions 6, 7. No product change: this task brings existing tests in line with Tasks 1–4 and replaces the interim cases #82 and #84 marked "#87".

**Files** (verify at M6 start with `grep -rln "LaundryOrderEntity\|InvoiceEntity\|laundryOrdersService\.\|invoicesService\.\|#87\|nextval" apps/api/test`):
- Modify: `apps/api/test/laundry.e2e-spec.ts`, `laundry.service.e2e-spec.ts`, `billing.e2e-spec.ts`, `billing.service.e2e-spec.ts`, `catalog.tenant-isolation.e2e-spec.ts`
- Modify only if failing: `customers-properties.tenant-isolation.e2e-spec.ts`, `paginated-collections-allowlist.e2e-spec.ts`

- [ ] **Step 1: Run** `pnpm --filter api test:e2e` and list the failures. Every failure must be one of:
   - (a) a direct laundry or invoice insert without `tenantId`;
   - (b) a direct service call with the old signature;
   - (c) an interim #87 expectation;
   - (d) an assertion on the global sequence.

   Any other failure is a defect in Tasks 1–4: stop and fix it there.

- [ ] **Step 2: (a)/(b)/(d) laundry and billing suites.**
   - Pass the suite's bootstrap tenant constant as the new `tenantId` argument or command field.
   - Add `tenantId` to any direct insert.
   - Replace any assertion on `billing_invoice_number_seq` / `nextval` with the counter equivalent: the suffix equals the tenant's `invoice_number_counter.lastValue` after the call.
   - Keep every other assertion. Where a suite asserts audit rows, extend the `laundry_order.*` / `invoice.generated` rows to expect `tenantId` and `scope: 'TENANT'`.
   - **Bootstrap-counter drift:** bootstrap-tenant tests share one counter across suites. Assert format and monotonicity, never an absolute value.

- [ ] **Step 3: (b)/(c) `catalog.tenant-isolation.e2e-spec.ts`.**
   - Fixture calls to `laundryOrdersService.weigh(...)` gain `tenantId`.
   - Case 7 "generateInvoiceFromOrder on A's priced order is 400 for B" becomes "… is 404 for B (missing order, #87 Decision 7)": `errorStatus(asB)` is `404` and the message matches `/^Laundry order .* not found/`. The A success path is unchanged.
   - The `priceLaundryOrder` cases on **B's own** order with A's service/add-on keep the 400 "No effective price" (#84 still owns that application check; Decision 4's FK is the database half).
   - Refresh the "Laundry/Billing are not yet (#87)" comment.
   - `afterAll` may now rely on `removeTestTenants` for the laundry and invoice rows. Keep the explicit deletes only if ordering requires them.

- [ ] **Step 4: Run** `pnpm --filter api test:e2e` ⇒ all green, except the pre-existing `main` failures recorded at M6 start.

- [ ] **Step 5: Commit.** `git commit -m "test(87): align e2e fixtures and interim cases with tenant-owned laundry and invoices"`

---

### Task 6: Two-tenant laundry & billing isolation e2e (acceptance)

**Spec:** RFC §4.4, §4.5, §4.6, §4.9; Slice decisions 2–12; "Residual exposures closed"; #82 I1 acceptance criterion.

**Files:**
- Create: `apps/api/test/laundry-billing.tenant-isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: everything above. The setup mirrors `jobs-checklists.tenant-isolation.e2e-spec.ts`: `AppModule`, `cookieParser`, `applyPlatformPipes`, `createTestTenant` ×2, `seedTenantAdmin(TENANT_OWNER)` per tenant, `seedSuperAdmin`, `loginAs`, `gql` and `errorStatus` (copy these helpers verbatim from that file).
- Fixtures go through the application services. Per tenant:
  - one customer, with distinct `fullName` prefixes (`"Alpha…"` for A, `"Bravo…"` for B);
  - one active-priced service and add-on;
  - via GraphQL as that tenant's owner, one **priced** laundry order with a service line and an add-on line (`orderA`, `orderB`), one **received** order (`openA`, `openB`), and one invoice generated from the priced order (`invoiceA`, `invoiceB`).
- `afterAll` deletes the audit rows it can attribute, then calls `removeTestTenants`.

- [ ] **Step 1: Write the suite.** Numbered cases, each a `describe` or `it`:
  1. **Root scoping.**
     - As B, `laundryOrders(filter: { id: { in: [orderA, orderB, openA, openB] } }) { totalCount nodes { id } }` ⇒ only B's two orders, `totalCount: 2`.
     - As B, `invoices(filter: { id: { in: [invoiceA, invoiceB] } })` ⇒ only `invoiceB`.
     - As A ⇒ the mirror image.
     - As B, `laundryOrder(id: orderA.id) { id }` and `invoice(id: invoiceA.id) { id }` ⇒ no errors and `null`, identical to a random uuid.
  2. **Relation-filter oracle (#82 I1, Review Focus 1).** For each filter, as B ⇒ `nodes: []`, `totalCount: 0`; as A ⇒ A's row(s), `totalCount ≥ 1`:
     - `invoices(filter: { customer: { fullName: { like: "Alpha%" } } })`
     - `invoices(filter: { customer: { id: { eq: customerA.id } } })`
     - `laundryOrders(filter: { customer: { fullName: { like: "Alpha%" } } })`
     - `invoices(filter: { laundryOrder: { id: { eq: orderA.id } } })`
     - `invoices(filter: { laundryOrder: { status: { eq: <orderA.status> } }, customerId: { eq: customerA.id } })`
     - `invoices(filter: { or: [ { customer: { fullName: { like: "Alpha%" } } }, { id: { eq: invoiceA.id } } ] })`

     Use `it.each`. If a field is not filterable on the related DTO, drop that row and record it in the task report. The `id` rows always stay.
  3. **Nested paths.**
     - As B, `laundryOrder(id: orderA.id) { id customer { id } lines { nodes { id } } }` and `invoice(id: invoiceA.id) { id customer { id } laundryOrder { id } lines { nodes { id } } }` ⇒ no errors and `null`. The body contains none of A's customer, order, line or invoice-line ids.
     - As A, the same queries return them.
  4. **Cross-tenant mutations (Decision 7, Review Focus 3).**
     - As B, each of the 12 transition verbs, plus `weighLaundryOrder` and `priceLaundryOrder`, on `openA` ⇒ 404 `Laundry order … not found`. The tenant-scoped lock misses before any status check, so the source status is irrelevant. As a positive control, `weighLaundryOrder` on `openA` as A succeeds afterwards (run it last in this case).
     - As B, `generateInvoiceFromOrder({ laundryOrderId: orderA.id })` ⇒ 404. Use a second priced A order without an invoice, so the result is not masked by the one-invoice rule.
     - Afterwards a repository read shows A's orders with status, `weightGrams`, `totalMinorUnits`, line count and `updatedAt` unchanged, and no new invoice for them.
  5. **Cross-tenant references on own rows.** As B:
     - `receiveLaundryOrder({ customerId: customerA.id })` ⇒ 404 (#82, retained);
     - `priceLaundryOrder` on B's own weighed order with `baseServiceId: serviceA.id` ⇒ 400 "No effective price" (#84, retained), and the order is still `WEIGHED` with zero lines.
  6. **Tenant persistence (Decision 6).** The repository shows:
     - `orderB`, its lines and `invoiceB` all with `tenantId = tenantB`;
     - `invoiceB.customerId = orderB.customerId`.
  7. **Spoofing (I-2, Review Focus 5).** As B:
     - `invoices(filter: { tenantId: { eq: tenantA } })` and `laundryOrders(filter: { tenantId: … })` ⇒ GraphQL validation error;
     - `invoices(filter: { or: [{ id: { eq: invoiceA.id } }, { id: { is: null } }] }) { totalCount }` ⇒ `0`;
     - an added `x-tenant-id: tenantA` header on `invoices { nodes { id } }` ⇒ only B's rows;
     - `receiveLaundryOrder(input: { customerId: customerB.id, fulfillmentType: PICKUP, tenantId: tenantA })` ⇒ GraphQL validation error, and no row.
  8. **Role boundary.** The Super Admin cookie on `laundryOrders`, `laundryOrder(id)`, `invoices`, `invoice(id)`, `receiveLaundryOrder` and `generateInvoiceFromOrder` ⇒ 403 (role, RFC §4.2), with no A or B data in the body.
  9. **Per-tenant numbering and concurrency (I-3, Review Focus 2).**
     - **Ordering.** No A or B invoice may be generated between setup and this case (case 4's attempts fail before the transaction, so they allocate nothing).
     - **Independent numbering.** `invoiceA.invoiceNumber` and `invoiceB.invoiceNumber` both end in `-000001`, since both are fresh tenants. Both rows exist, which shows that a per-tenant duplicate string is legal.
     - **Parallel generates.** As A, create 5 more priced orders sequentially, then run `Promise.all` of 5 `generateInvoiceFromOrder` calls. All succeed, and the numeric suffixes are exactly `{2, 3, 4, 5, 6}`. A's `invoice_number_counter.lastValue` is `6` and B's is still `1`.
     - **Racing duplicate.** `Promise.all` of 2 `generateInvoiceFromOrder` calls on one new priced A order ⇒ exactly one success and one 409 `An invoice already exists for this laundry order`. The counter is then `7`, not `8`: the loser's increment rolled back.
  10. **Database backstop (I-1 database half).** Each insert rejects with a `QueryFailedError` whose `driverError.constraint` names the given FK:
      - a `laundry_order_entity` row with `tenantId: tenantB` and `customerId: customerA.id` ⇒ `fk_laundry_order_customer_tenant`;
      - a `laundry_order_line_entity` row with `tenantId: tenantB` on `openB` and `serviceId: serviceA.id` ⇒ `fk_laundry_order_line_service_tenant`, and the add-on equivalent ⇒ `fk_laundry_order_line_add_on_tenant`;
      - the same line with `tenantId: tenantA` on `openB` ⇒ `fk_laundry_order_line_order_tenant`;
      - an `invoice_entity` row with `tenantId: tenantB` and `laundryOrderId` = an A order with no invoice ⇒ `fk_invoice_laundry_order_tenant`;
      - `tenantId: tenantB`, `laundryOrderId` = a B order with no invoice and `customerId: customerA.id` ⇒ `fk_invoice_customer_tenant`.
  11. **Audit (Decision 11).**
      - The `audit_event_entity` rows with `entityType = 'laundry_order'` and `entityId = orderA.id` include `laundry_order.received`, `.weighed` and `.priced`, all with `tenantId = tenantA`, `scope = 'TENANT'` and `actorId` = A's owner.
      - The `invoice.generated` row for `invoiceA` has `tenantId = tenantA` and `scope = 'TENANT'`.

- [ ] **Step 2: Run** `pnpm --filter api test:e2e -- laundry-billing.tenant-isolation` ⇒ PASS. It is expected to pass on the first run because it verifies Tasks 1–5. If a case fails, fix the owning task's code, never the assertion, and record the fix in the task report.

- [ ] **Step 3: Commit.** `git commit -m "test(87): two-tenant laundry and billing isolation e2e"`

---

### Task 7: Documentation touch-points and final verification

**Spec:** process §2.8; RFC tracking row.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`, tracking row only: add "Laundry & Billing slice: #87 (PR …)" and move #87 out of "Remaining slices". This is a tracking-field update, not a design change.
- Modify: stale `#87` comments found by `grep -rn "#87" apps/api/src apps/api/test` that describe a now-false interim state (for example `price-laundry-order.command.ts`, `generate-invoice-from-order.command.ts`, `catalog.tenant-isolation.e2e-spec.ts`). Do not edit applied migration files (`AddCatalogTenant`, `CreateBillingInvoices`, `CreateLaundryOrders`).
- Modify: `README.md` only if it describes laundry/invoices as unscoped or mentions the invoice sequence (check it; expected no change).
- Modify: this plan's tracking row with the PR link.

- [ ] **Step 1: Comments and tracking.** Apply the edits above.
- [ ] **Step 2: Final gate.**
  - `pnpm --filter api lint`
  - `pnpm --filter api test`
  - `pnpm --filter api test:e2e`
  - `pnpm --filter api build`
  - `migration:run` against a fresh database (`pnpm --filter api migration:run`, per README)
  - `migration:revert` once on that database, then `migration:run` again. The fresh database has no invoices, so `down` succeeds; Task 1 case 7 covers the populated and fail-loud cases
  - the `schema:log` drift classification and `pg_constraint` verification of Task 1 Step 6, rerun on the final branch
  - `git diff --stat main -- apps/web packages` ⇒ empty
  - the generated GraphQL schema diff against `main` ⇒ **empty**

  Compare e2e results against the baseline failures recorded on `main` at M6 start. Record all outputs for the M6 Slice Completion Report.
- [ ] **Step 3: Commit.** `git commit -m "docs(87): document laundry/billing tenant isolation; refresh stale #87 comments"`

---

## Traceability

| RFC | Tasks |
| --- | --- |
| §4.2 principal-only tenant, no Super Admin bypass | 2, 3, 4, 6 (cases 7, 8) |
| §4.4 LaundryOrder / Invoice tenant-owned; laundry line → service/add-on and invoice → laundry order/customer same-tenant; `(id, tenantId)` uniqueness; `uq_invoice_laundry_order` retained | 1, 2, 3, 6 (cases 5, 6, 10) |
| §4.4 Invoice `(tenantId, invoiceNumber)` unique; tenant-scoped, concurrency-safe allocation; no global sequence; no `MAX+1` | 1, 3, 6 (case 9) |
| §4.5 predicate on services, nestjs-query, relations, mutations; filters cannot widen; missing-row semantics | 2, 3, 4, 5, 6 (cases 1–4, 7) |
| §4.6 tenant-scoped audit | 2, 3, 6 (case 11) |
| §4.7 backfill before NOT NULL | 1 |
| #82 I1 relation-filter oracle (issue #87 acceptance criterion) | 4, 6 (case 2) |
| #84 laundry-order cross-tenant pricing residual | 1, 2, 5, 6 (cases 4, 10) |

## Execution risks

- **Coupled task window (Tasks 1–5).** e2e is red between Task 1 and Task 5. Unit tests and `tsc` gate each task. Do not merge a partial branch.
- **Leftover dev data.** A developer database holding laundry orders or invoices on non-bootstrap customers (for example from #82/#84 two-tenant fixtures that were not cleaned up) makes `AddLaundryBillingTenant` abort by design (Decision 12). The same applies to non-conforming invoice numbers (Decision 10). The fix is to delete those rows and re-run. Mention this in the PR description.
- **`migration:generate` drift.** The composite FKs, the counter table and the indexes are hand-written, as in #82–#86. `schema:log` / `migration:generate` may propose dropping them. That is expected and classified in Task 1 Step 6, never applied.
- **Revert with multi-tenant invoices.** `down` cannot restore the global `uq_invoice_number` once two tenants share a number string. It fails and rolls back rather than renumbering (Task 1 case 7). Reverting after a second tenant has invoiced is therefore a data decision, not a migration step.
- **Counter contention.** Generates in one tenant serialize on the counter row for the rest of their transaction (catalog lookups run before the transaction, so the critical section is short). This is the intended concurrency mechanism (Decision 9), not a defect.
