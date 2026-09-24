# Customer & Property Tenant Isolation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-24 |
| **Tracking** | GitHub [#82](https://github.com/rexescario-dev/clensy-platform/issues/82) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (Accepted at M5) + implementation (process §2.8). Branch `feat/82-customer-property-tenant-isolation`. |
| **Package / repo** | `clensy-platform` — `apps/api` only |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: `Tenant`, `BOOTSTRAP_TENANT_ID`, principal `{ id, role, scope, tenantId }`, `AuditLogEvent.scope`/`tenantId`, two-tenant fixtures in `test/helpers/seed-tenant-admin.ts`). Also relies on [Customers & Properties](../specs/2026-08-15-customers-properties-design.md), [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md) and [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) as **extended/constrained by the RFC** (§8). |

> **For agentic workers:** Draft — **do not implement until M5 Accepts this plan.** After Accept, use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax. Do **not** invent product semantics; the Accepted specification wins.

**Goal:** Make Customer and Property tenant-owned — required `tenantId`, per-tenant email uniqueness, database-enforced same-tenant Property → Customer reference, and a principal-derived tenant predicate on every Customer/Property read and write path (services, nestjs-query list/count/relations, loaders, mutations).

**Architecture:** One migration adds `tenantId` to `customer_entity` and `property_entity`, backfills the bootstrap tenant, **validates** (fails closed on duplicate customer emails), then adds constraints — including a composite `(customerId, tenantId) → customer(id, tenantId)` FK that replaces the id-only `fk_property_customer`. `CustomersService` / `PropertiesService` take `tenantId` explicitly on every operation. nestjs-query read paths are constrained by `@Authorize` on `CustomerType` / `PropertyType` using a reusable `platform/` authorizer whose filter is ANDed with any client filter. Bookings and Laundry pass the principal's tenant when resolving customers/properties; the unauthenticated REST `/bookings` passes `null` and therefore fails closed.

**Tech Stack:** NestJS, TypeORM 1.1.x migrations (hand-written constraints), PostgreSQL, `@ptc-org/nestjs-query-*` 9.5.0, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.4 (Customer/Property rows only), §4.5, §4.6 (Customer/Property events only), §4.7 (backfill), §4.9.

## Delivery intent

Implement RFC §4.4–§4.5 for **Customer** and **Property** only. After this slice, a tenant principal can neither see nor write another tenant's customers or properties through any API path, the database rejects a property whose customer belongs to another tenant, and customer/property audit events carry the tenant. Booking, Laundry, Invoice and the other tables stay unscoped (their slices: #83–#87); they only change how they **ask** for a customer/property.

## Slice decisions (recorded during M4 clarification, 2026-09-24)

These resolve planning-level choices the RFC leaves to M4. None adds product semantics.

1. **Existing duplicate customer emails.** The migration MUST validate existing Customer rows for duplicates under the RFC's tenant-scoped, case-insensitive email uniqueness rule **before** creating the unique constraint. If duplicates exist, the migration MUST fail and report the conflicting customer IDs/emails without modifying those rows. Data remediation is a manual prerequisite; the migration MUST NOT merge, delete, or otherwise choose a canonical Customer. After remediation the migration is re-runnable. (RFC §4.4 supersedes the Customers spec's "email not required to be unique" non-goal; the RFC is authoritative.)
2. **Isolation mechanism.** GraphQL read paths use nestjs-query `@Authorize` on `CustomerType` / `PropertyType` constraining reads to `principal.tenantId`; service operations take `tenantId` explicitly. Client filters are **ANDed with**, never replace, the authorization filter — the authorizer is a **security invariant**, not a convenience filter. The reusable helper lives in `platform/`. No `AsyncLocalStorage`; no replacement of nestjs-query by handwritten resolvers.
3. **Audit.** `customer.create`, `customer.update`, `property.create`, `property.update` record `scope: TENANT` and `tenantId: principal.tenantId` in this slice (RFC §4.6). Other business modules remain for #90.
4. **Legacy REST `/bookings`.** `BookingsService` create accepts `tenantId: string | null`. GraphQL passes the principal's tenant; the unauthenticated REST controller passes `null`. Customer/property resolution with `null` never resolves a row ⇒ existing `NotFoundException`. REST GET/DELETE/PATCH keep working (bookings are not tenant-owned yet; `UpdateBookingCommand` has no customer/property). REST POST fails. **No principal means no tenant scope** — never bootstrap-tenant traffic. Removal/rebuild of REST stays with #85/#91.
5. **Duplicate email at runtime.** Case-insensitive duplicate within a tenant on `createCustomer` / `updateCustomer` ⇒ `ConflictException` (same idiom as `CleanersService.translateUniqueViolation`). No UI work.

## Global constraints

- SHALL derive the tenant for authorization **only** from `AuthenticatedPrincipal.tenantId` (RFC §4.5, invariant 1). SHALL NOT accept `tenantId` from GraphQL args, inputs, filters, headers, or REST bodies. SHALL NOT expose `tenantId` as a writable input field.
- SHALL NOT hardcode `BOOTSTRAP_TENANT_ID` in any request path. It MAY appear only in the migration backfill, dev seed fixtures, and tests.
- SHALL treat `tenantId: null` passed to a customer/property service read as "no tenant scope": return `null` / `[]` / `NotFoundException` **without** querying for rows.
- SHALL make cross-tenant get/update/create-reference look exactly like a missing row: `null` for nullable queries (`customer`, `property`), `NotFoundException` where that operation already throws it (RFC §4.5). SHALL NOT return `403` for another tenant's row.
- SHALL keep `@Roles()` lists unchanged. SHALL NOT add `SUPER_ADMIN` to any customer/property resolver (RFC §4.2).
- SHALL enforce, in the database: `customer.tenantId` / `property.tenantId` NOT NULL with FK to `tenant_entity`; `UNIQUE (id, tenantId)` on both tables; `UNIQUE (tenantId, lower(email))` on customer; composite FK `property(customerId, tenantId) → customer(id, tenantId)`; id-only `fk_property_customer` removed (RFC §4.4–§4.5).
- SHALL order the migration **Tenant (exists) → backfill Customer/Property → validate → constraints/FKs/indexes**. Property → Customer SHALL NOT pass through a state where a tenant-mismatched pair is allowed once `tenantId` is NOT NULL: the composite FK replaces the id-only FK in the same constraint step.
- SHALL NOT add `tenantId` to Booking, LaundryOrder, Invoice, or any other table; SHALL NOT change their FKs to customer/property (#85, #87).
- SHALL NOT use PostgreSQL RLS (invariant 12).
- SHALL NOT change `apps/web`, `@clensy/web`, `@clensy/ui`, or GraphQL operation documents. If the M6 verification in Task 5 forces a schema-visible field, regenerate `@clensy/client` only; no UI edits.
- SHALL keep the existing nullable/NotFound contracts of the Customers spec (`customer`/`property` nullable; `listCustomerProperties` NotFound on missing customer).

## Ownership boundaries

**This slice owns:** `apps/api/src/modules/customers/**`; a new tenant authorizer in `apps/api/src/platform/auth/`; one new migration + duplicate-validation helper in `apps/api/src/platform/database/`; the dev seed's booking fixtures (`seed.ts`) gaining `tenantId`; the **call sites only** in `bookings.service.ts`, `booking.resolver.ts`, `booking.controller.ts`, `create-booking.command.ts`, `laundry-orders.service.ts`, `laundry-order.resolver.ts`, `receive-laundry-order.command.ts`; test fixtures that create customers/properties.

**Must not change:** Booking/Laundry/Billing/Jobs/Catalog/Cleaners persistence, their nestjs-query types and authorization, `@Roles()` matrices, `AuthGuard`/principal loading, `apps/web`, REST controller routes or DTO shapes.

## Contract inventory

| Surface | Change |
| --- | --- |
| `customer_entity`, `property_entity` | `tenantId uuid NOT NULL` + FK to tenant; `UNIQUE(id, tenantId)`; customer `UNIQUE(tenantId, lower(email))`; property composite FK to customer replacing `fk_property_customer`; tenant-leading indexes |
| `Customer` / `Property` domain | add `tenantId: string` |
| `CustomersService` | `create(command)` / `update(id, command)` — commands carry `tenantId: string`; `getCustomer(id, tenantId)`, `getCustomersByIds(ids, tenantId)`, `listCustomers(tenantId)`; duplicate email ⇒ `ConflictException` |
| `PropertiesService` | same shape: commands carry `tenantId`; `getProperty(id, tenantId)`, `getPropertiesByIds(ids, tenantId)`, `listCustomerProperties(customerId, tenantId)` |
| GraphQL `CustomerType`, `PropertyType` | `@Authorize(tenantReadAuthorizer())`. No new public fields (see Task 5 verification) |
| GraphQL `customer`, `property`, `createCustomer`, `updateCustomer`, `createProperty`, `updateProperty`, `customerProperties` | pass `currentUser.tenantId`; `customerProperties` ANDs `tenantId` into query **and** count filters |
| Relations `Booking.customer`, `Booking.property`, `Invoice.customer`, `LaundryOrder.customer`, `Customer.properties` | constrained automatically by the related DTO's authorizer (nestjs-query `authorizeRelation`) — verified by tests, no code on those types |
| `CreateBookingCommand` | + `tenantId: string \| null` |
| `ReceiveLaundryOrderCommand` | + `tenantId: string \| null` (resolver always passes principal's value) |
| `AuditEvent` for customer/property actions | `scope = TENANT`, `tenantId` = principal's tenant |

**Deferred:** Booking/Laundry/Invoice `tenantId` + composite FKs to customer/property (#85, #87); REST `/bookings` removal (#85/#91); other modules' audit tagging (#90); two-tenant release gate (#92); any UI surfacing of the Conflict error.

## TDD / verification strategy

- **Unit (Jest, mocked repositories/manager):** authorizer helper; duplicate-email validator; `CustomersService` / `PropertiesService` tenant predicates, fail-closed `null`, Conflict mapping, audit tags; resolvers pass `currentUser.tenantId`; `@Authorize` metadata present on both types; `BookingsService` / `LaundryOrdersService` pass tenant through.
- **Migration e2e (throwaway database, `add-tenant-and-admin-scope.migration.e2e-spec.ts` precedent):** backfill, duplicate abort leaves data untouched and re-run succeeds after remediation, composite FK rejects a tenant-mismatched property.
- **Two-tenant API e2e (real Postgres, `AppModule`):** every RFC §4.9-style cross-tenant case for customers/properties, including nestjs-query filter narrowing, relation reads, booking create and laundry receive with a foreign customer, and audit rows.
- **Suite health:** Tasks 2–7 are coupled — after Task 2 the NOT NULL columns break e2e fixtures until Task 7. Unit tests MUST be green at the end of every task; the full e2e suite MUST be green from Task 7 onward.
- Final gate: `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api build`, and a `migration:run` against a fresh database.

## Review Focus

Failure modes the RFC implies that are easy to miss; each is pinned by a test in the named task.

1. **Client filter tries to widen or assert another tenant** (`customers(filter: { id: { eq: <A's id> } })` as tenant B) — expect empty result, not A's row (Task 8; ANDing asserted in Task 5 unit test).
2. **`customerProperties` bypasses the authorizer** because it calls the QueryService directly, not through `ReadResolver` — its query **and** count must carry the tenant predicate (Task 5, Task 8).
3. **Relation read through an unscoped parent** (`bookings { customer }`, `invoices { customer }`) must use Customer's authorizer — a relation resolving another tenant's customer is a leak (Task 5 relation-authorizer test; Task 8 via `Customer.properties`).
4. **Same email, different case, same tenant** (`Jane@Example.com` vs `jane@example.com`) ⇒ Conflict; same email in two tenants ⇒ both succeed (Task 3, Task 8).
5. **`tenantId: null` reaching a service** (REST POST, or a platform principal if a role list were ever widened) must return nothing without querying (Task 3, Task 4, Task 6).

---

### Task 1: Tenant read authorizer (`platform/auth`)

**Spec:** §4.5 (principal-only tenant source; filters may narrow, never widen)

**Files:**
- Create: `apps/api/src/platform/auth/authorization/tenant-read.authorizer.ts`
- Test: `apps/api/src/platform/auth/tests/tenant-read.authorizer.spec.ts`

**Interfaces:**
- Produces: `tenantReadAuthorizer<DTO extends { id: string }>(): AuthorizerOptions<DTO>` and `tenantFilterFor(tenantId: string | null): Filter<{ id: string; tenantId: string }>`. Consumed by Task 5 (types) and Task 5 (`customerProperties`), and by later slices #83–#87.

- [ ] **Step 1: Write the failing tests**

```ts
import { tenantFilterFor, tenantReadAuthorizer } from '../authorization/tenant-read.authorizer';
import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';

const context = (user: unknown) => ({ req: { user } });
const authCtx = { many: true, operationGroup: 'read', operationName: 'query', readonly: true } as never;

describe('tenantReadAuthorizer', () => {
  it('constrains reads to the principal tenant', async () => {
    const filter = await tenantReadAuthorizer().authorize(
      context({ id: 'u', role: Role.SCHEDULER, scope: AdminScope.TENANT, tenantId: 't-a' }),
      authCtx,
    );
    expect(filter).toEqual({ tenantId: { eq: 't-a' } });
  });

  it('fails closed (matches no row) when the principal has no tenant', async () => {
    const filter = await tenantReadAuthorizer().authorize(
      context({ id: 'u', role: Role.SUPER_ADMIN, scope: AdminScope.PLATFORM, tenantId: null }),
      authCtx,
    );
    expect(filter).toEqual({ id: { is: null } });
  });

  it('fails closed when no principal is on the request', async () => {
    expect(await tenantReadAuthorizer().authorize(context(undefined), authCtx)).toEqual({ id: { is: null } });
  });

  it('tenantFilterFor mirrors the same rule', () => {
    expect(tenantFilterFor('t-a')).toEqual({ tenantId: { eq: 't-a' } });
    expect(tenantFilterFor(null)).toEqual({ id: { is: null } });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- tenant-read.authorizer` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { Filter } from '@ptc-org/nestjs-query-core';
import { AuthorizerOptions } from '@ptc-org/nestjs-query-graphql';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';

interface TenantOwned {
  id: string;
  tenantId: string;
}

// Multi-tenant spec §4.5: the only tenant source is the DB-loaded principal
// `AuthGuard` put on `req.user`. nestjs-query ANDs this filter with the
// client's, so a client filter can narrow rows but never widen them. A
// principal without a tenant (platform scope, or none) matches no row —
// `id` is the primary key and is never null.
export function tenantFilterFor(tenantId: string | null): Filter<TenantOwned> {
  return tenantId === null ? { id: { is: null } } : { tenantId: { eq: tenantId } };
}

export function tenantReadAuthorizer<DTO>(): AuthorizerOptions<DTO> {
  return {
    authorize: (context: { req?: { user?: AuthenticatedPrincipal } }) =>
      tenantFilterFor(context.req?.user?.tenantId ?? null) as Filter<DTO>,
  };
}
```

(Exact generic typing is an M6 detail; the returned filters are the contract.)

- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat(82): add principal-derived tenant read authorizer`

---

### Task 2: Schema — entities, duplicate-email validator, migration

**Spec:** §4.4 (Customer uniqueness, same-tenant reference, `(id, tenantId)` uniqueness), §4.5 (NOT NULL, tenant FK, indexes), §4.7 (backfill before NOT NULL); Slice decision 1.

**Files:**
- Modify: `apps/api/src/modules/customers/domain/customer.ts`, `domain/property.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/customers/infrastructure/persistence/customer.entity.ts`, `property.entity.ts`
- Create: `apps/api/src/platform/database/customer-email-duplicates.ts`
- Create: `apps/api/src/platform/database/migrations/<timestamp>-AddCustomerPropertyTenant.ts`
- Test: `apps/api/src/platform/database/tests/customer-email-duplicates.spec.ts` (same folder as `owner-designation.spec.ts`)
- Test: `apps/api/test/add-customer-property-tenant.migration.e2e-spec.ts`

**Interfaces:**
- Produces: `CustomerEmailDuplicateGroup { tenantId: string; email: string; customerIds: string[] }`, `class CustomerEmailDuplicateError extends Error`, `assertNoDuplicateCustomerEmails(groups: readonly CustomerEmailDuplicateGroup[]): void`.
- Produces DB names later tasks match on: `uq_customer_tenant_email` (Task 3 Conflict mapping), `fk_property_customer_tenant`, `uq_customer_id_tenant`, `uq_property_id_tenant`, `fk_customer_tenant`, `fk_property_tenant`.

- [ ] **Step 1: Failing unit tests for the validator**

```ts
describe('assertNoDuplicateCustomerEmails', () => {
  it('passes with no groups', () => {
    expect(() => assertNoDuplicateCustomerEmails([])).not.toThrow();
  });

  it('throws listing every duplicate email and customer id', () => {
    const run = () =>
      assertNoDuplicateCustomerEmails([
        { tenantId: 't', email: 'jane@example.com', customerIds: ['c1', 'c2'] },
        { tenantId: 't', email: 'bob@example.com', customerIds: ['c3', 'c4', 'c5'] },
      ]);
    expect(run).toThrow(CustomerEmailDuplicateError);
    expect(run).toThrow(/jane@example\.com.*c1.*c2/s);
    expect(run).toThrow(/bob@example\.com.*c3.*c4.*c5/s);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the helper (pure; message names each `tenantId`, lowercased email and customer ids, and states that manual remediation is required and no rows were changed). **Step 4: Run** → PASS.

- [ ] **Step 5: Entities.** Add to both entities:

```ts
@Column({ type: 'uuid' })
tenantId!: string;

@ManyToOne(() => TenantEntity, { nullable: false, eager: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'tenantId', foreignKeyConstraintName: 'fk_customer_tenant' }) // fk_property_tenant on Property
tenant!: TenantEntity;
```

On `PropertyEntity.customer`, keep the relation (Relatable needs it) but stop TypeORM owning the id-only FK: `@JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'fk_property_customer' })` becomes a join column with `createForeignKeyConstraints: false` on the `@ManyToOne` options. Add a comment in the style of `AddTenantAndAdminScope` listing the hand-written objects (`uq_customer_id_tenant`, `uq_property_id_tenant`, `uq_customer_tenant_email`, `fk_property_customer_tenant`) that `migration:generate` may propose to drop — do not apply that. **Planning:** if M6 finds TypeORM 1.1.x can express the composite FK and expression unique cleanly in metadata, that is acceptable provided the DB objects and names are identical.

- [ ] **Step 6: Migration e2e (failing first).** Precedent: throwaway database; run all migrations up to (not including) this one; insert a customer + property pair (no `tenantId` columns exist yet) and two customers `Jane@Example.com` / `jane@example.com`. Tests:
  1. `up` throws `CustomerEmailDuplicateError` naming both ids; afterwards `customer_entity` has **no** `tenantId` column and both customer rows are unchanged (TypeORM migration transaction rolled back).
  2. Change one email by hand (remediation), re-run `up` → succeeds; every customer/property row has `tenantId = BOOTSTRAP_TENANT_ID`.
  3. Insert a second tenant and a customer in it; inserting a property with `customerId` = that customer and `tenantId` = bootstrap fails with FK violation on `fk_property_customer_tenant`.
  4. Inserting a second customer with the same `lower(email)` in the bootstrap tenant fails on `uq_customer_tenant_email`; the same email in the second tenant succeeds.
  5. `down` then `up` round-trips.

- [ ] **Step 7: Implement migration `up`** (single transaction; order is load-bearing and is Global constraint "Tenant → backfill → validate → constraints"):
  1. `ALTER TABLE customer_entity ADD "tenantId" uuid` and same for `property_entity` (nullable).
  2. `UPDATE customer_entity SET "tenantId" = $1` and `UPDATE property_entity SET "tenantId" = $1` with `BOOTSTRAP_TENANT_ID`.
  3. Validate: `SELECT "tenantId", lower(email) AS email, array_agg(id ORDER BY id) AS "customerIds" FROM customer_entity GROUP BY 1, 2 HAVING count(*) > 1` → `assertNoDuplicateCustomerEmails(rows)` (throws → whole migration rolls back, data untouched). Also assert `SELECT count(*) FROM property_entity p JOIN customer_entity c ON c.id = p."customerId" WHERE p."tenantId" <> c."tenantId"` is 0.
  4. `SET NOT NULL` on both `tenantId` columns; FKs `fk_customer_tenant`, `fk_property_tenant` → `tenant_entity(id)` `ON DELETE RESTRICT`.
  5. `uq_customer_id_tenant UNIQUE (id, "tenantId")`, `uq_property_id_tenant UNIQUE (id, "tenantId")`.
  6. `CREATE UNIQUE INDEX uq_customer_tenant_email ON customer_entity ("tenantId", lower(email))`.
  7. `DROP CONSTRAINT fk_property_customer`; `ADD CONSTRAINT fk_property_customer_tenant FOREIGN KEY ("customerId", "tenantId") REFERENCES customer_entity(id, "tenantId") ON DELETE RESTRICT`.
  8. Indexes for tenant-scoped reads: `idx_customer_tenant_created ("tenantId", "createdAt" DESC, id)`, `idx_property_tenant_customer ("tenantId", "customerId")` (the existing `customerId` index stays).
  `down` reverses 8→1 (restoring `fk_property_customer`).
- [ ] **Step 8: Run** unit + the migration e2e → PASS. `pnpm --filter api build` compiles.
- [ ] **Step 9: Commit** — `feat(82): add tenant ownership to customer and property schema`

---

### Task 3: `CustomersService` tenant predicate, Conflict, audit tags

**Spec:** §4.4 (uniqueness), §4.5 (predicate, missing-row semantics), §4.6; Slice decisions 3, 5.

**Files:**
- Modify: `apps/api/src/modules/customers/application/commands/create-customer.command.ts`, `update-customer.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/customers/application/services/customers.service.ts`
- Test: `apps/api/src/modules/customers/tests/application/customers.service.spec.ts`

**Interfaces:**
- Consumes: `uq_customer_tenant_email` (Task 2).
- Produces: `getCustomer(id: string, tenantId: string | null): Promise<Customer | null>`, `getCustomersByIds(ids: string[], tenantId: string | null): Promise<Customer[]>`, `listCustomers(tenantId: string | null): Promise<Customer[]>`, `create(command)`, `update(id, command)` with `command.tenantId: string`.

- [ ] **Step 1: Failing tests** (extend the existing spec's mocked repository / manager):
  - `create` persists `tenantId: command.tenantId` and audits `{ action: 'customer.create', scope: AdminScope.TENANT, tenantId: command.tenantId, … }`.
  - `getCustomer('c1', 't-a')` calls `findOneBy({ id: 'c1', tenantId: 't-a' })`; `getCustomer('c1', null)` returns `null` and does **not** call the repository. Same pattern for `getCustomersByIds` (`findBy({ id: In(ids), tenantId })`, `[]` for `null`) and `listCustomers` (`find({ where: { tenantId } })`, `[]` for `null`).
  - `update` looks up `findOneBy(CustomerEntity, { id, tenantId })`; missing ⇒ `NotFoundException` (another tenant's id is indistinguishable). Audit tagged `customer.update` + tenant. `tenantId` is not copied onto the entity from the command (destructure it out like `actorId`).
  - `create` / `update` when `manager.save` rejects with `{ code: '23505', constraint: 'uq_customer_tenant_email' }` ⇒ `ConflictException('Email is already in use')`; any other error is rethrown unchanged.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Add `POSTGRES_UNIQUE_VIOLATION = '23505'` and a private `translateUniqueViolation` mirroring `CleanersService` (match `driverError.constraint ?? constraint` = `uq_customer_tenant_email`, falling back to `code` only as `CleanersService` does). Destructure `{ actorId, tenantId, ...fields }` in `update`. Add `scope: AdminScope.TENANT, tenantId: command.tenantId` to both audit calls.
- [ ] **Step 4: Run** → PASS (callers in other modules will fail typecheck until Tasks 5–6; unit specs for this file pass).
- [ ] **Step 5: Commit** — `feat(82): scope customers service to the principal tenant`

---

### Task 4: `PropertiesService` tenant predicate and audit tags

**Spec:** §4.4 (property → customer same tenant), §4.5, §4.6; Slice decision 3.

**Files:**
- Modify: `apps/api/src/modules/customers/application/commands/create-property.command.ts`, `update-property.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/customers/application/services/properties.service.ts`
- Test: `apps/api/src/modules/customers/tests/application/properties.service.spec.ts`

**Interfaces:**
- Produces: `getProperty(id, tenantId: string | null)`, `getPropertiesByIds(ids, tenantId: string | null)`, `listCustomerProperties(customerId, tenantId: string | null)`, `create(command)`, `update(id, command)` with `command.tenantId: string`.

- [ ] **Step 1: Failing tests:**
  - `create` checks the customer with `findOneBy(CustomerEntity, { id: command.customerId, tenantId: command.tenantId })`; a customer of another tenant ⇒ `NotFoundException('Customer … not found')` and nothing saved. Saved entity has `tenantId: command.tenantId`. Audit `property.create` tagged TENANT + tenant.
  - `getProperty` / `getPropertiesByIds` filter by `tenantId`; `null` ⇒ `null` / `[]` without querying.
  - `listCustomerProperties('c1', 't-a')` looks up the customer by `{ id, tenantId }` (missing ⇒ `NotFoundException`) then `findBy({ customerId, tenantId })`; `null` tenant ⇒ `NotFoundException` without querying.
  - `update` finds by `{ id, tenantId }`; missing ⇒ `NotFoundException`; `tenantId` not assigned from command; audit tagged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(82): scope properties service to the principal tenant`

---

### Task 5: GraphQL — authorizers on types, resolvers pass principal tenant

**Spec:** §4.2 (roles unchanged), §4.5 (nestjs-query, relations, filters never widen, missing-row semantics); Slice decision 2.

**Files:**
- Modify: `apps/api/src/modules/customers/presentation/graphql/customer.type.ts`, `property.type.ts`, `customer.resolver.ts`, `property.resolver.ts`
- Test: `apps/api/src/modules/customers/tests/graphql/customer.resolver.spec.ts`, `property.resolver.spec.ts`, `customer-read.resolver.spec.ts`, `property-read.resolver.spec.ts`, `customers.module.composition-root.spec.ts`

**Interfaces:**
- Consumes: `tenantReadAuthorizer`, `tenantFilterFor` (Task 1); Task 3/4 service signatures.

- [ ] **Step 1: M6 verification spike (first, before other changes).** In `customer-read.resolver.spec.ts` (or a composition-level test with the real `NestjsQueryGraphQLModule` + TypeORM against Postgres, whichever the existing spec already boots), apply `@Authorize(tenantReadAuthorizer())` to `CustomerType` **without** exposing `tenantId` and assert that `customers` issues SQL containing `"tenantId" = $n` (use `test/helpers/capture-sql.ts`). **If it works:** keep `tenantId` off the GraphQL type. **If nestjs-query 9.5.0 rejects or drops the unexposed field:** add `@FilterableField(() => ID, { filterOnly: true })` `tenantId` to `CustomerType` / `PropertyType` (hidden from output; a client filter on it is still ANDed with the authorizer, so asserting another tenant returns no rows — RFC §4.5), regenerate `@clensy/client`, and record the outcome in the PR.
- [ ] **Step 2: Failing tests:**
  - `getAuthorizer(CustomerType)` and `getAuthorizer(PropertyType)` are defined (metadata), and the authorizer returns `{ tenantId: { eq: 't-a' } }` for a tenant principal context.
  - `customer(id)` / `property(id)` call the service with `(id, currentUser.tenantId)`.
  - `createCustomer` / `updateCustomer` / `createProperty` / `updateProperty` build commands with `tenantId: currentUser.tenantId` and never from input.
  - `customerProperties` passes `mergeFilter(…, { customerId: { eq }, tenantId: { eq: currentUser.tenantId } })` to **both** `propertyQueryService.query` and `.count`, and a client filter is ANDed, not replaced (assert the merged filter contains the client predicate and the tenant predicate).
  - `@Roles()` metadata on every resolver method is unchanged (existing assertions keep passing).
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement.** `@Authorize(tenantReadAuthorizer())` on both types (nestjs-query then applies it to `customers`, `Customer.properties`, and to every `@FilterableRelation('customer' | 'property')` on Booking / Invoice / LaundryOrder via `authorizeRelation`). Resolvers take `@CurrentUser()` where they don't already and pass `currentUser.tenantId`. In `customerProperties`, add `@CurrentUser()` and merge `tenantFilterFor(currentUser.tenantId)` alongside the existing `customerId` scope (strip any client `tenantId` with `getFilterOmitting` the same way `customerId` is stripped).
- [ ] **Step 5: Run** unit suite → PASS.
- [ ] **Step 6: Commit** — `feat(82): enforce tenant predicate on customer and property GraphQL`

---

### Task 6: Consumers — Bookings and Laundry pass the tenant; REST fails closed

**Spec:** §4.4 (booking → customer/property, laundry → customer same tenant), §4.5 (REST rule); Slice decision 4.

**Files:**
- Modify: `apps/api/src/modules/bookings/application/commands/create-booking.command.ts` (+ `tenantId: string | null`, comment: `null` only from the unauthenticated REST controller ⇒ fails closed)
- Modify: `apps/api/src/modules/bookings/application/services/bookings.service.ts` (`resolveAndValidate` passes `command.tenantId` to `getCustomer` / `getProperty`)
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.resolver.ts` (`tenantId: currentUser.tenantId`)
- Modify: `apps/api/src/modules/bookings/presentation/rest/booking.controller.ts` (`tenantId: null` with a comment citing Slice decision 4 and #85/#91)
- Modify: `apps/api/src/modules/laundry/application/commands/receive-laundry-order.command.ts`, `laundry-orders.service.ts` (`receive` passes `command.tenantId`), `laundry-order.resolver.ts` (`tenantId: user.tenantId`)
- Modify: `apps/api/src/modules/bookings/**` loaders if any still call `getCustomersByIds` / `getPropertiesByIds` (grep at M6 start; pass the principal tenant from the request context the loader already has, or remove the dead call — do not introduce AsyncLocalStorage)
- Test: bookings / laundry service + resolver unit specs; `apps/api/test/bookings-rest.e2e-spec.ts`

- [ ] **Step 1: Failing tests:**
  - `BookingsService.create` with `tenantId: 't-a'` calls `getCustomer(customerId, 't-a')` and `getProperty(propertyId, 't-a')`; with `tenantId: null` ⇒ `NotFoundException('Customer … not found')` and no transaction opened.
  - GraphQL `createBooking` builds the command with `tenantId: currentUser.tenantId`; REST `create` builds it with `tenantId: null`.
  - `LaundryOrdersService.receive` calls `getCustomer(customerId, command.tenantId)`; resolver passes `user.tenantId`.
  - `bookings-rest.e2e-spec.ts` rewritten: the old "all succeed unauthenticated" case becomes (a) `POST /bookings` with a real customer/property ⇒ `404` and no booking row; (b) `GET /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id`, `DELETE /bookings/:id` on a booking inserted directly via repository still succeed unauthenticated and emit no audit event. Test name documents the fail-closed interim behavior.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** unit + `bookings-rest` e2e → PASS.
- [ ] **Step 5: Commit** — `feat(82): pass principal tenant from bookings and laundry; REST create fails closed`

---

### Task 7: Fixture sweep — seed and existing e2e specs

**Spec:** §4.7 (seed consumes bootstrap tenant); Slice decision 1 (per-tenant email uniqueness now enforced).

**Files:**
- Modify: `apps/api/src/platform/database/seed.ts` (`bookingFixtureCustomer` / `bookingFixtureProperty` gain `tenantId: BOOTSTRAP_TENANT_ID`; still upsert by fixed id)
- Create: `apps/api/test/helpers/unique-email.ts` — `uniqueEmail(prefix = 'customer'): string` → `` `${prefix}-${randomUUID()}@example.com` ``
- Modify: `customers-properties.e2e-spec.ts`, `customers-properties.service.e2e-spec.ts`, `bookings(.service).e2e-spec.ts`, `jobs(.service).e2e-spec.ts`, `laundry(.service).e2e-spec.ts`, `billing(.service).e2e-spec.ts`, and any unit spec constructing customer/property commands

- [ ] **Step 1:** Run `pnpm --filter api test:e2e` and record failures (expected: NOT NULL `tenantId`, missing command `tenantId`, duplicate `jane@example.com` in the bootstrap tenant).
- [ ] **Step 2:** Service-level specs pass `tenantId` from the seeded owner's principal (`seedOwner` already attaches to the bootstrap tenant) or from `createTestTenant`. Direct repository inserts set `tenantId`. Every customer email in a spec that does not truncate `customer_entity` uses `uniqueEmail()`; specs asserting on a specific email keep a literal only where the table is truncated under `acquireCustomerDbTestLock`.
- [ ] **Step 3:** `pnpm --filter api test` and `pnpm --filter api test:e2e` → all PASS. Run `pnpm db:seed` twice against a migrated dev DB → idempotent.
- [ ] **Step 4: Commit** — `test(82): attach customer fixtures to a tenant and use unique emails`

---

### Task 8: Two-tenant Customer/Property isolation e2e

**Spec:** §4.2, §4.4, §4.5, §4.6, §4.9 (worked examples applied to customers/properties).

**Files:**
- Create: `apps/api/test/customers-properties.tenant-isolation.e2e-spec.ts` (uses `createTestTenant`, `seedTenantAdmin(dataSource, Role.TENANT_OWNER, tenantId)` from `seed-tenant-admin.ts`, `removeTestTenants` in `afterAll` — extend `removeTestTenants` to delete that tenant's properties then customers first)

- [ ] **Step 1: Write the tests** (they should pass given Tasks 1–7; any failure is a leak to fix in the owning task, not in the test). Tenant A owner creates customer `cA` (email `shared-<uuid>@example.com`) and property `pA`; tenant B owner is logged in via cookie for every assertion below:
  1. `customer(id: cA)` ⇒ `null`; `property(id: pA)` ⇒ `null` (not an error, not 403).
  2. `customers` ⇒ contains none of A's rows; `customers(filter: { id: { eq: cA } })` ⇒ empty; `totalCount` excludes A.
  3. `customerProperties(customerId: cA)` ⇒ `NotFound` error.
  4. `updateCustomer(id: cA)` / `updateProperty(id: pA)` ⇒ `NotFound`; A's rows unchanged in DB.
  5. `createProperty(customerId: cA)` ⇒ `NotFound`; no property row created.
  6. `createBooking` with `customerId: cA, propertyId: pA` and a valid service ⇒ `NotFound` (RFC §4.9 "another tenant's id" example applied to customer).
  7. `receiveLaundryOrder` with `customerId: cA` ⇒ `NotFound`.
  8. Tenant B creates a customer with A's exact email ⇒ succeeds; B creates a second one with the same email in different case ⇒ `Conflict`.
  9. Tenant A reading `customer(id: cA) { properties { nodes { id } } }` sees `pA`; the audit rows for A's `customer.create` / `property.create` have `scope = 'TENANT'` and `tenantId = A`.
  10. Super Admin calling `customers` ⇒ `Forbidden` (regression guard; existing #68 test may already cover it — do not duplicate if so).
- [ ] **Step 2: Run** `pnpm --filter api test:e2e -- tenant-isolation` → PASS.
- [ ] **Step 3: Commit** — `test(82): two-tenant customer and property isolation e2e`

---

### Task 9: Final verification

- [ ] `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api build`.
- [ ] Fresh database: `migration:run` succeeds; `migration:generate` output reviewed — only the documented hand-written objects appear as drift.
- [ ] If Task 5 Step 1 added a schema-visible `tenantId`, `pnpm --filter @clensy/client codegen` and `pnpm --filter web build` pass; otherwise confirm the GraphQL schema is unchanged.
- [ ] Emit the M6 Slice Completion Report.

## Traceability

| Task | Spec |
| --- | --- |
| 1 | §4.5 (principal-only source, filters narrow only), invariants 1, 6 |
| 2 | §4.4 uniqueness + composite FK, §4.5 DB requirements, §4.7 backfill, invariant 4; Slice decision 1 |
| 3–4 | §4.4, §4.5 missing-row semantics, §4.6, invariants 7, 8; Slice decisions 3, 5 |
| 5 | §4.2, §4.5 nestjs-query / relations / filters, invariants 6, 7, 10; Slice decision 2 |
| 6 | §4.4 references, §4.5 REST rule, invariants 1, 11; Slice decision 4 |
| 7 | §4.7 seed consumes bootstrap tenant |
| 8 | §4.9 worked examples; acceptance evidence for §4.4–§4.6 |

## Risks (operational)

- **Local/shared dev and e2e databases already contain duplicate customer emails** (25 fixtures use `jane@example.com`). Per Slice decision 1 the migration will refuse to run there; reset those databases or remediate by hand before `migration:run`. This is expected, not a bug.
- nestjs-query authorizer on an unexposed column is unverified until Task 5 Step 1; the fallback is defined there.
- Between Task 2 and Task 7 the e2e suite is red by construction; do not push a partial branch expecting green CI.
- `generate` will keep proposing to drop the hand-written constraints/indexes; never apply that.
- Booking/Laundry/Invoice rows keep id-only FKs to customer/property until #85/#87, so the DB does not yet prevent a cross-tenant booking → customer reference; the application check (Task 6) is the only guard for those tables in the interim. In production only the bootstrap tenant has data until tenants are provisioned.

## Out of this plan

Booking / CleaningJob / LaundryOrder / Invoice / catalog / teams `tenantId` and their composite FKs; REST `/bookings` removal or rebuild; nestjs-query authorizers on non-customer types; audit tagging outside customers/properties; web UI; Super Admin anything; RLS.
