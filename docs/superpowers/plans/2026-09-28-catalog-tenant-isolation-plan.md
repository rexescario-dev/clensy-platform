# Catalog Tenant Isolation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-28 |
| **Tracking** | GitHub [#84](https://github.com/rexescario-dev/clensy-platform/issues/84) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (Accepted at M5) + implementation (process §2.8). Branch `feat/84-catalog-tenant-isolation`. |
| **Package / repo** | `clensy-platform` — `apps/api` only |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: `Tenant`, `BOOTSTRAP_TENANT_ID`, principal `{ id, role, scope, tenantId }`, `AuditLogEvent.scope`/`tenantId`, `test/helpers/seed-tenant-admin.ts`), the shipped [Customer & Property Tenant Isolation plan](2026-09-24-customer-property-tenant-isolation-plan.md) (#82: `tenantReadAuthorizer` / `tenantFilterFor`, `requireTenantId`, service null-tenant contract, constraint-name conflict mapping, relation-override regression pattern) and the shipped [Teams & Cleaners Tenant Isolation plan](2026-09-27-teams-cleaners-tenant-isolation-plan.md) (#83: per-tenant DataLoader `…LoaderFor(tenantId)`, consumer modules passing the caller's tenant into a lookup, `// #NN Task N` placeholder discipline). Also relies on [Catalog](../specs/2026-08-16-catalog-design.md), [Laundry Catalog Foundation](../specs/2026-09-06-laundry-catalog-foundation-design.md), [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md) and [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) as **extended/constrained by the RFC** (§8). |

> **For agentic workers:** Status **Draft** — awaiting M5 Plan Review. Do **not** start M6 until this plan is Accepted. Execution method is chosen at M5 (superpowers:subagent-driven-development or superpowers:executing-plans). Steps use checkbox (`- [ ]`) syntax. Do **not** invent product semantics; the Accepted specification wins.

**Goal:** Make Service, AddOn and PricingRule tenant-owned — required `tenantId`, per-tenant case-insensitive Service/AddOn name uniqueness, database-enforced same-tenant PricingRule → Service/AddOn references, and a principal-derived tenant predicate on every catalog read and write path (services, nestjs-query list/count/relations, the active-pricing DataLoader, mutations, and cross-module catalog lookups from Bookings, Laundry and Billing).

**Architecture:** One migration adds `tenantId` to `service_entity`, `add_on_entity` and `pricing_rule_entity`, backfills the bootstrap tenant, adds `UNIQUE (id, "tenantId")` to Service and AddOn, swaps the global `LOWER(name)` unique indexes for `("tenantId", LOWER(name))`, and replaces the id-only pricing-rule FKs with composite `(serviceId, tenantId)` / `(addOnId, tenantId)` FKs. `ServicesService`, `AddOnsService` and `PricingRulesService` take `tenantId` explicitly on every operation. nestjs-query read paths are constrained by `@Authorize(tenantReadAuthorizer())` on `ServiceType` / `AddOnType`. `Service.activePricing` reads the principal with `@CurrentUser()` and asks a per-tenant DataLoader (`ActivePricingLoader.loaderFor(tenantId)`). Bookings, Laundry and Billing pass the caller's tenant into every catalog lookup; their own tables stay unscoped until #85 / #87.

**Tech Stack:** NestJS, TypeORM 1.1.x migrations (hand-written constraints), PostgreSQL, `@ptc-org/nestjs-query-*` 9.5.0, `dataloader`, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.4 (Service / AddOn / PricingRule rows only), §4.5, §4.6 (catalog events only), §4.7 (backfill), §4.9.

## Delivery intent

Implement RFC §4.4–§4.6 for **Service**, **AddOn** and **PricingRule** only. After this slice, tenant-scoped catalog APIs cannot resolve or mutate another tenant's Service, AddOn, or PricingRule. Cross-module records that remain globally scoped are explicitly excluded; see **Known residual exposure**. In addition, the database rejects a pricing rule whose target belongs to another tenant, two tenants may each own a service or add-on with the same (case-insensitive) name, and catalog audit events carry the tenant. Booking, LaundryOrderLine and Invoice tables stay unscoped (#85, #87); those modules only change how they **ask** for catalog data.

**What this slice does and does not guarantee.** #84 guarantees that catalog operations themselves cannot resolve another tenant's catalog records through tenant-scoped APIs. #84 does **not** claim complete tenant isolation for modules whose own records remain globally scoped (Booking, LaundryOrder/LaundryOrderLine, Invoice). See **Known residual exposure** below.

## Slice decisions (recorded during brainstorming, 2026-09-28)

These resolve planning-level choices the RFC leaves to M4. None adds product semantics.

1. **One migration, safe order, no duplicate pre-check.** Today `service_entity` and `add_on_entity` names are **globally** unique case-insensitively (`uq_service_name_lower`, `uq_add_on_name_lower`, expression indexes on `LOWER("name")` — migrations `1786893419092-AddService`, `1786894582095-AddAddOn`; no later migration touches them). Backfilling every row to one tenant therefore cannot create a duplicate under `("tenantId", LOWER("name"))`. The migration order is load-bearing (see Global constraints) and runs in **one** transaction.
2. **Case-insensitive uniqueness is preserved, per tenant.** RFC §4.4: "unique per tenant on case-insensitive `name` (replaces global `LOWER(name)` uniqueness)". New unique **indexes** `uq_service_tenant_name_lower` / `uq_add_on_tenant_name_lower` on `("tenantId", LOWER("name"))`. `Alpha` in A and `alpha` in B both succeed; `Alpha` then `alpha` in one tenant ⇒ 409.
3. **Conflict messages unchanged; mapping by constraint name.** The application pre-check (`assertNameAvailable`) gains `AND tenantId = :tenantId`. The race-window fallback (`translateUniqueViolation`) maps a `23505` to `ConflictException('Service name is already in use')` / `('Add-on name is already in use')` **only** when the violated constraint is the new tenant-name index (or no constraint name is available), #82's `CustomersService.translateUniqueViolation` idiom, so an unrelated `23505` is not mislabelled.
4. **Read vs write null-tenant behaviour (two distinct rules, plus one framework exception).**
   - **Direct catalog service reads** with `tenantId === null` fail closed **without issuing a repository query**: `null` (`getService`, `resolveEffectivePricing`), `[]` (`getServicesByIds`, `getAddOnsByIds`, `listServices`, `listAddOns`, `getActivePricingForServiceIds`), or the operation's existing `NotFoundException` (`getActivePricing`, whose existing missing-service contract is 404).
   - **Writes** (`createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`) are **rejected before any query**. Their commands carry `tenantId: string` (a `null` cannot type-check into them), and every write resolver obtains it via `requireTenantId(currentUser)`, which throws `ForbiddenException` before the service is called. Writes never "return nothing".
   - **Exception — nestjs-query root reads** (`services`, `addOns` lists/counts, and the `Booking.service` relation) do not go through the catalog services. They are constrained by `@Authorize(tenantReadAuthorizer())`, which for a null tenant yields `tenantFilterFor(null)` (`{ id: { is: null } }`) and **may issue the resulting no-match query**. This is an intentional framework-level exception to the direct-service no-query rule (#82 / #83 precedent), not a second contract for the services.
5. **Composite FK invariant (explicit).** The database, not only the application, guarantees:

   ```text
   pricing_rule_entity ("serviceId", "tenantId") → service_entity ("id", "tenantId")   -- fk_pricing_rule_service_tenant
   pricing_rule_entity ("addOnId",   "tenantId") → add_on_entity  ("id", "tenantId")   -- fk_pricing_rule_add_on_tenant
   ```

   PostgreSQL requires the referenced column pair to be backed by a unique constraint, so `uq_service_id_tenant` / `uq_add_on_id_tenant` (`UNIQUE ("id", "tenantId")`) exist **as FK targets**, not as an extra product rule (RFC §4.4). Default `MATCH SIMPLE`: the null side of the XOR (`ck_pricing_rule_target`) is not checked, the non-null side is. The legacy/open partial unique indexes (`uq_pricing_rule_active_service`, `uq_pricing_rule_open_service`, `uq_pricing_rule_open_addon`) are **unchanged**: target ids are globally unique UUIDs, so those indexes need no `tenantId` to distinguish tenants; the composite FK is what establishes the tenant relationship. `pricing_rule_entity` gets **no** `UNIQUE (id, "tenantId")` — no table references `pricing_rule_entity.id` (verified: no FK in any migration; laundry/booking snapshots copy `pricingRuleId` as a plain value).
6. **Every catalog lookup puts `tenantId` in the same query.** This covers direct reads **and** indirect paths: `getServicesByIds` / `getAddOnsByIds` (`findBy({ id: In(ids), tenantId })`), the active-pricing batch (`findBy({ active: true, serviceId: In(ids), tenantId })`), `resolveEffectivePricing` (`AND rule."tenantId" = :tenantId`), the `createPricingRule` target existence check (`findOneBy(ServiceEntity | AddOnEntity, { id, tenantId })`), its close-open-interval `UPDATE` and its legacy `active` deactivation `UPDATE` (both also constrained by `tenantId`), `getActivePricing`'s service existence check and rule read, and `assertNameAvailable`. Never fetch by ids then filter in memory.
7. **Active-pricing loader tenant source: resolver → tenant → loader → tenant-scoped query** (#83 slice decision 4 pattern). `ServiceResolver.activePricing` reads `@CurrentUser()` and calls `this.loader.loaderFor(currentUser?.tenantId ?? null)`. `ActivePricingLoader` holds one `DataLoader` per tenant id; its batch function calls `getActivePricingForServiceIds(ids, tenantId)`. A `null` tenant resolves every key to `null` **without** a query. The loader does not inject GraphQL `CONTEXT`.
8. **PricingRule GraphQL surface.** `PricingRuleType` is **not** a nestjs-query DTO: it is not registered in `NestjsQueryGraphQLModule` `dtos`, has no `ReadResolver`, no connection and no relation. It is reachable only through (a) the custom `activePricing(serviceId)` query, (b) the `Service.activePricing` field resolver, and (c) the `createPricingRule` mutation result. All three are tenant-scoped by this plan (Decisions 4, 6, 7), so no `@Authorize` is added to `PricingRuleType` (it would have no effect on a non-nestjs-query type) and **no new GraphQL surface is introduced**. Task 8 pins that inventory with a schema-introspection assertion; if M6 finds any other directly queryable PricingRule field, it receives equivalent tenant scoping before this slice is complete.
9. **Cross-module propagation is a requirement, not a preference.** Laundry pricing and billing name resolution **must** receive the authenticated tenant context in #84. Leaving either path unchanged would cause its catalog lookup to fail closed once catalog services require tenant scope. Therefore:
   - `BookingsService` create validation passes `command.tenantId` (already present since #82) to `getService` and `getActivePricing`. The unauthenticated REST `POST /bookings` passes `null` and already fails closed on the #82 customer lookup (404) before any catalog lookup.
   - `PriceLaundryOrderCommand` gains `tenantId: string`; `LaundryOrderResolver.priceLaundryOrder` passes `requireTenantId(user)`; `LaundryOrdersService.price` passes it to `resolveEffectivePricing`. A cross-tenant `baseServiceId` / `addOnId` finds no rule ⇒ the existing `BadRequestException('No effective price for …')` (that operation's existing missing-row contract).
   - `GenerateInvoiceFromOrderCommand` gains `tenantId: string`; `InvoiceResolver.generateInvoiceFromOrder` passes `requireTenantId(user)`; `InvoicesService.buildLinePayloads(lines, tenantId)` passes it to `getServicesByIds` / `getAddOnsByIds`. A line whose catalog row is in another tenant ⇒ the existing `BadRequestException('… could not be resolved')`.
   - The booking, laundry-order(-line) and invoice **tables** are **not** scoped in #84.
10. **Audit.** `service.create`, `service.update`, `add_on.create`, `add_on.update`, `pricing_rule.create` record `scope: TENANT` and `tenantId: <command tenant>` (RFC §4.6). Booking / laundry / invoice audit tagging stays with #90.
11. **Dead-but-public service reads are scoped, not deleted.** `listServices` / `listAddOns` have no production caller (lists are served by nestjs-query) but are used by tests; they take `tenantId` like `TeamsService.listTeams` did in #83.

## Known residual exposure (security caveat — not merely a deferral)

Until #85 / #87 scope the referencing tables, the following remain **id-only** references and are capable of crossing tenant boundaries **at the database schema level**:

| Reference | Constraint | Closed by |
| --- | --- | --- |
| `booking_entity."serviceId"` → `service_entity.id` | `fk_booking_service` | #85 |
| `laundry_order_line_entity."serviceId"` → `service_entity.id` | `fk_laundry_order_line_service` | #87 |
| `laundry_order_line_entity."addOnId"` → `add_on_entity.id` | `fk_laundry_order_line_add_on` | #87 |

In #84 the **application** lookups on those write paths are tenant-scoped (Decision 9), so no API in this slice attaches another tenant's catalog row; the database does not yet back that up for these three tables.

**Service-name probe via the unscoped booking root.** `BookingDTO` declares `@FilterableRelation('service', () => ServiceType, …)`. `ServiceType`'s `@Authorize` covers relation **resolution**, not relation **filters** on another root: a client can filter the (unscoped) `bookings` root by fields of another tenant's service (e.g. `filter: { service: { name: { eq: … } } }`) and learn whether such a booking exists — an existence oracle over other tenants' service names. This is **known residual exposure** that #85 MUST close when it scopes the Booking root. Likewise, reading `booking { service { … } }` for another tenant's booking yields the interim `Cannot return null for non-nullable field Booking.service` error (#82 precedent for `Booking.customer`) until #85 hides the booking itself.

**Interim operating rule (same as #82 / #83):** **do not provision a second production tenant** before #85 and #87 have shipped.

## Global constraints

- SHALL derive the tenant for authorization **only** from `AuthenticatedPrincipal.tenantId` (RFC §4.5, invariant 1). SHALL NOT accept `tenantId` from GraphQL args, inputs, filters, headers, or REST bodies. SHALL NOT expose `tenantId` as a GraphQL field or writable input field on `Service` / `AddOn` / `PricingRule`.
- SHALL NOT hardcode `BOOTSTRAP_TENANT_ID` in any request path. It MAY appear only in the migration backfill, dev seed fixtures, and tests.
- SHALL apply Decision 4 exactly: direct catalog service reads with `tenantId === null` MUST return the fail-closed result without querying; writes are rejected before any query (`requireTenantId` ⇒ `ForbiddenException`; commands typed `tenantId: string`). nestjs-query root reads are constrained by `tenantFilterFor(null)` and may issue the resulting no-match query; this is an intentional framework-level exception to the direct-service no-query rule.
- SHALL put `tenantId` in the **same** database query as every id / id-list / name lookup (Decision 6). SHALL NOT fetch-then-filter.
- SHALL treat the `@Authorize` tenant filter as a **security invariant**. No relation declaration targeting `ServiceType` / `AddOnType` may carry a relation-level `auth` override. Planning-time inventory: exactly one such relation exists — `Booking.service` (`@FilterableRelation`, spreads `relationReadOpts`); `grep -rn "auth:" src/modules` finds none. Task 5 pins this with a regression test.
- SHALL make cross-tenant get/update/reference look exactly like a missing row: `null` for the nullable `service` query and object fields; the operation's existing `NotFoundException` / `BadRequestException` where it already throws one (RFC §4.5). SHALL NOT return `403` for another tenant's row. (`ForbiddenException` from `requireTenantId` is a role/scope failure for a principal with **no** tenant, not a cross-tenant signal.)
- SHALL keep `@Roles()` lists unchanged. SHALL NOT add `SUPER_ADMIN` to any catalog resolver (RFC §4.2).
- SHALL enforce, in the database: `"tenantId" uuid NOT NULL` with FK to `tenant_entity` (`ON DELETE RESTRICT`) on all three tables (`fk_service_tenant`, `fk_add_on_tenant`, `fk_pricing_rule_tenant`); `uq_service_id_tenant`, `uq_add_on_id_tenant`; unique indexes `uq_service_tenant_name_lower`, `uq_add_on_tenant_name_lower` on `("tenantId", LOWER("name"))`; composite FKs `fk_pricing_rule_service_tenant`, `fk_pricing_rule_add_on_tenant` (`ON DELETE RESTRICT`, `MATCH SIMPLE`); the global `uq_service_name_lower`, `uq_add_on_name_lower` and id-only `fk_pricing_rule_service`, `fk_pricing_rule_addon` removed (RFC §4.4–§4.5). `ck_pricing_rule_target` and the three pricing-rule partial unique indexes are unchanged.
- SHALL order the migration exactly: **(0)** assert bootstrap tenant exists → **(1)** add nullable `tenantId` to the three tables → **(2)** backfill → **(3)** NOT NULL + tenant FKs → **(4)** `(id, tenantId)` uniques on Service / AddOn (composite-FK prerequisites) → **(5)** drop the global `LOWER(name)` unique indexes → **(6)** create the `("tenantId", LOWER(name))` unique indexes → **(7)** replace the pricing-rule FKs with the composite FKs → **(8)** tenant list indexes. All in **one** migration transaction. SHALL NOT split it. No step creates a constraint before its prerequisite exists, and no committed state ever lacks name uniqueness or a pricing-rule FK.
- SHALL keep all five catalog mutations (`createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule` — there are no others) as **custom resolvers calling the services**. `ServiceReadResolver` / `AddOnReadResolver` are `ReadResolver`-only (`one: { disabled: true }`), so nestjs-query generates no catalog mutation. `@Authorize` is relied on for **reads only**; write isolation comes from the services' `{ id, tenantId }` lookups.
- SHALL NOT add `tenantId` to `booking_entity`, `laundry_order_line_entity`, `laundry_order_entity` or `invoice_entity`; SHALL NOT change `fk_booking_service`, `fk_laundry_order_line_service`, `fk_laundry_order_line_add_on` (#85, #87).
- SHALL NOT use PostgreSQL RLS (invariant 12).
- SHALL NOT change `apps/web`, `@clensy/web`, `@clensy/ui`, GraphQL operation documents, or the public GraphQL schema. Adding `tenantId` to application commands is not a schema change.
- SHALL keep the existing nullable/NotFound contracts of the Catalog and Laundry Catalog Foundation specs (`service` nullable; `activePricing(serviceId)` 404 on a missing service, `null` when no active rule; `updateService` / `updateAddOn` / `createPricingRule` 404 on a missing row).

## Ownership boundaries

**This slice owns:** `apps/api/src/modules/catalog/**`; one new migration in `apps/api/src/platform/database/migrations/`; the dev seed's `bookingFixtureService` gaining `tenantId`; the **call sites only** in `bookings.service.ts`, `laundry-orders.service.ts`, `price-laundry-order.command.ts`, `laundry-order.resolver.ts`, `invoices.service.ts`, `generate-invoice-from-order.command.ts`, `invoice.resolver.ts`; `test/helpers/seed-tenant-admin.ts` cleanup; test fixtures that create services / add-ons / pricing rules.

**Must not change:** Booking / Jobs / Cleaners / Customers / Laundry / Billing persistence, their nestjs-query types and authorization, `@Roles()` matrices, `AuthGuard` / principal loading, `tenantReadAuthorizer` / `requireTenantId` (consumed as-is), `apps/web`, REST routes or DTO shapes.

## Contract inventory

| Surface | Change |
| --- | --- |
| `service_entity`, `add_on_entity` | `tenantId uuid NOT NULL` + FK to tenant; `UNIQUE(id, tenantId)`; `("tenantId", LOWER(name))` unique index replacing the global `LOWER(name)` one; tenant-leading list index |
| `pricing_rule_entity` | `tenantId uuid NOT NULL` + FK to tenant; composite FKs to service / add-on replacing the id-only ones |
| `Service` / `AddOn` / `PricingRule` domain | add `tenantId: string` |
| `ServicesService` | `createService(command)`, `updateService(id, command)` — commands carry `tenantId: string`; `getService(id, tenantId)`, `getServicesByIds(ids, tenantId)`, `listServices(tenantId)` (`tenantId: string \| null`) |
| `AddOnsService` | `createAddOn(command)`, `updateAddOn(id, command)` — commands carry `tenantId: string`; `getAddOnsByIds(ids, tenantId)`, `listAddOns(tenantId)` |
| `PricingRulesService` | `createPricingRule(command)` — command carries `tenantId: string`; `getActivePricing(serviceId, tenantId)`, `getActivePricingForServiceIds(serviceIds, tenantId)`, `resolveEffectivePricing(target, asOf, tenantId)` |
| `ActivePricingLoader` | `loaderFor(tenantId: string \| null): DataLoader<string, PricingRule \| null>` replaces `loader`; `createActivePricingBatchFn(pricingRulesService, tenantId)` |
| GraphQL `ServiceType`, `AddOnType` | `@Authorize(tenantReadAuthorizer())`. No new public fields |
| GraphQL `service`, `activePricing(serviceId)` | pass `currentUser.tenantId` |
| GraphQL `createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule` | pass `requireTenantId(currentUser)` |
| `Service.activePricing` field resolver | `@CurrentUser()` → `loaderFor(currentUser?.tenantId ?? null)` |
| Relation `Booking.service` | constrained by `ServiceType`'s authorizer (nestjs-query falls back to the target's `@Authorize` when the relation has no `auth`). No code change on the declaration; Task 5 adds a regression guard |
| `PriceLaundryOrderCommand` | + `tenantId: string` |
| `GenerateInvoiceFromOrderCommand` | + `tenantId: string` |
| `AuditEvent` for catalog actions | `scope = TENANT`, `tenantId` = command tenant |

**Deferred (see Known residual exposure):** composite FKs for `booking.serviceId` (#85), `laundry_order_line.serviceId` / `.addOnId` (#87); the booking-root relation-filter oracle (#85); booking / laundry / invoice audit tagging (#90); REST `/bookings` removal (#85 / #91); two-tenant release gate (#92); any UI surfacing.

## TDD / verification strategy

- **Unit (Jest, mocked repositories / manager / query builders):** the three services' tenant predicates, read fail-closed (no repository call), write command typing, constraint-name Conflict mapping, audit tags; batch function passes `tenantId` and null-tenant makes no call; `loaderFor` memoizes per tenant; resolvers pass `currentUser.tenantId` / `requireTenantId(currentUser)` and a null-tenant principal on a write throws `ForbiddenException` before the service is called; `@Authorize` metadata on both types; relation-override regression; Bookings / Laundry / Billing pass the tenant to every catalog call.
- **Migration e2e (throwaway database, `add-team-cleaner-tenant.migration.e2e-spec.ts` precedent):** bootstrap-tenant assertion, backfill, constraint swap, composite FKs reject a tenant-mismatched pricing rule (service and add-on target), case-insensitive per-tenant uniqueness, `down` restores the previous schema.
- **Two-tenant API e2e (real Postgres, `AppModule`):** every RFC §4.9-style cross-tenant case for the catalog, including filter narrowing with `totalCount`, `Service.activePricing` and `activePricing(serviceId)`, cross-tenant writes from Catalog / Bookings / Laundry / Billing, uniqueness across tenants, PricingRule surface inventory, audit rows and the DB backstop.
- **Acceptance is behavioral.** Isolation is proven by cross-tenant outcomes (rows absent, counts scoped, lookups missing). Captured SQL is supporting evidence only.
- **Suite health:** Tasks 1–7 are coupled — after Task 1 the NOT NULL columns break e2e fixtures until Task 7. Unit tests MUST be green at the end of every task; the full e2e suite MUST be green from Task 7 onward (excepting failures pre-existing on `main`: record their names at the start of M6 by running `pnpm --filter api test:e2e` on `main`; any other failure blocks).
- Final gate: `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api build`, and `migration:run` against a fresh database; confirm `git diff --stat main -- apps/web packages` is empty and the generated GraphQL schema is unchanged.

## Review Focus

Failure modes the RFC implies that are easy to miss; each is pinned by a test in the named task.

1. **Name uniqueness across case vs across tenant** — `Alpha` in A and `alpha` in B ⇒ both succeed; `Alpha` then `alpha` in A ⇒ 409; the pre-check must include `tenantId` or B's create would be wrongly rejected by A's row (Task 1 migration e2e, Task 2/3 units, Task 8).
2. **Pricing rule attached to another tenant's service/add-on** — `createPricingRule(serviceId: <A's>)` as B ⇒ 404 and **no** side effect: A's open interval not closed, A's legacy active rule not deactivated. The target existence check, the close `UPDATE` and the deactivate `UPDATE` must all carry `tenantId` (Task 4, Task 8); the DB composite FK rejects a direct insert (Task 1, Task 8).
3. **Client filter tries to widen** — `services(filter: { id: { eq: <A's> } })` / `addOns(filter: { name: { eq: <A's name> } })` as B ⇒ `nodes: []` **and** `totalCount: 0` (Task 8).
4. **Batch/indirect lookups ignoring the tenant** — `getServicesByIds` / `getAddOnsByIds` / active-pricing batch / `resolveEffectivePricing` must put `tenantId` in the same query; the loader for `null` must not query; Laundry `price` and Billing `generateFromOrder` must pass the caller's tenant, not the row's or none (Tasks 2–6, Task 8).
5. **Update path writing `tenantId` where it must not** — `updateService` / `updateAddOn` must destructure `tenantId` out of the SET list (`manager.update(…, { id, tenantId }, changes)` with `changes` lacking `tenantId`) (Task 2, Task 3).

---

### Task 1: Schema — domain, entities, migration

**Spec:** §4.4 (Service / AddOn uniqueness, same-tenant PricingRule → Service / AddOn, `(id, tenantId)` uniqueness), §4.5 (NOT NULL, tenant FK, indexes), §4.7 (backfill before NOT NULL); Slice decisions 1, 2, 5.

**Files:**
- Modify: `apps/api/src/modules/catalog/domain/service.ts`, `domain/add-on.ts`, `domain/pricing-rule.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/catalog/infrastructure/persistence/service.entity.ts`, `add-on.entity.ts`, `pricing-rule.entity.ts`
- Create: `apps/api/src/platform/database/migrations/1790524800000-AddCatalogTenant.ts`
- Test: `apps/api/test/add-catalog-tenant.migration.e2e-spec.ts`

**Interfaces:**
- Produces: `Service.tenantId: string`, `AddOn.tenantId: string`, `PricingRule.tenantId: string`; constraint/index names `fk_service_tenant`, `fk_add_on_tenant`, `fk_pricing_rule_tenant`, `uq_service_id_tenant`, `uq_add_on_id_tenant`, `uq_service_tenant_name_lower`, `uq_add_on_tenant_name_lower` (consumed by Tasks 2–3 conflict mapping), `fk_pricing_rule_service_tenant`, `fk_pricing_rule_add_on_tenant`, `idx_service_tenant_created`, `idx_add_on_tenant_created`.

- [ ] **Step 1: Write the failing migration e2e**

Harness identical to `test/add-team-cleaner-tenant.migration.e2e-spec.ts` (throwaway database, `connectionOptions` / `migrationsBefore` from `test/helpers/migration-db.ts`, explicit `inTransaction` wrapper). Cases are sequential:

```ts
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddCatalogTenant1790524800000 } from '../src/platform/database/migrations/1790524800000-AddCatalogTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const TABLES = `'service_entity'::regclass, 'add_on_entity'::regclass, 'pricing_rule_entity'::regclass`;
const NEW_CONSTRAINTS = [
  'fk_service_tenant',
  'fk_add_on_tenant',
  'fk_pricing_rule_tenant',
  'uq_service_id_tenant',
  'uq_add_on_id_tenant',
  'fk_pricing_rule_service_tenant',
  'fk_pricing_rule_add_on_tenant',
];
const OLD_CONSTRAINTS = ['fk_pricing_rule_service', 'fk_pricing_rule_addon'];
const NEW_INDEXES = [
  'uq_service_tenant_name_lower',
  'uq_add_on_tenant_name_lower',
  'idx_service_tenant_created',
  'idx_add_on_tenant_created',
];
const OLD_INDEXES = ['uq_service_name_lower', 'uq_add_on_name_lower'];
const UNCHANGED = [
  'ck_pricing_rule_target',
  'uq_pricing_rule_active_service',
  'uq_pricing_rule_open_service',
  'uq_pricing_rule_open_addon',
];

// #84 Task 1. Same harness as the #82/#83 migration e2e: every `up`/`down`
// runs in a transaction exactly as TypeORM runs it. Sequential cases.
describe('AddCatalogTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddCatalogTenant1790524800000();
  const serviceA = randomUUID();
  const addOnA = randomUUID();
  const secondTenant = randomUUID();

  async function inTransaction(run: (r: QueryRunner) => Promise<void>) {
    await queryRunner.startTransaction();
    try {
      await run(queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async function constraintNames(): Promise<string[]> {
    const rows: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint WHERE conrelid IN (${TABLES})`,
    );
    return rows.map((row) => row.conname);
  }

  async function indexNames(): Promise<string[]> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('service_entity', 'add_on_entity', 'pricing_rule_entity')`,
    );
    return rows.map((row) => row.indexname);
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790524800000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    await queryRunner.query(
      `INSERT INTO "service_entity" ("id", "name", "durationMinutes") VALUES ($1, 'Deep Clean', 60)`,
      [serviceA],
    );
    await queryRunner.query(
      `INSERT INTO "add_on_entity" ("id", "name", "priceMinorUnits") VALUES ($1, 'Fridge', 500)`,
      [addOnA],
    );
    await queryRunner.query(
      `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "effectiveFrom") VALUES ($1, 1000, now())`,
      [serviceA],
    );
    await queryRunner.query(
      `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "active", "effectiveFrom") VALUES ($1, 500, false, now())`,
      [addOnA],
    );
  }, 60_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  it('fails with an explicit error when the bootstrap tenant is missing', async () => {
    const [tenant]: { name: string }[] = await queryRunner.query(
      `SELECT "name" FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(`DELETE FROM "tenant_entity" WHERE "id" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        `AddCatalogTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name IN ('service_entity','add_on_entity','pricing_rule_entity') AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
    } finally {
      await queryRunner.query(
        `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
        [BOOTSTRAP_TENANT_ID, tenant.name],
      );
    }
  });

  it('backfills the bootstrap tenant and swaps global constraints for tenant-aware ones', async () => {
    await inTransaction((r) => migration.up(r));

    const rows: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "service_entity"
       UNION ALL SELECT "tenantId" FROM "add_on_entity"
       UNION ALL SELECT "tenantId" FROM "pricing_rule_entity"`,
    );
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => row.tenantId))).toEqual(
      new Set([BOOTSTRAP_TENANT_ID]),
    );
    const constraints = await constraintNames();
    const indexes = await indexNames();
    expect(constraints).toEqual(expect.arrayContaining(NEW_CONSTRAINTS));
    expect(indexes).toEqual(expect.arrayContaining(NEW_INDEXES));
    expect([...constraints, ...indexes]).toEqual(expect.arrayContaining(UNCHANGED));
    for (const old of OLD_CONSTRAINTS) {
      expect(constraints).not.toContain(old);
    }
    for (const old of OLD_INDEXES) {
      expect(indexes).not.toContain(old);
    }
  });

  it('enforces tenant-scoped, case-insensitive name uniqueness', async () => {
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    // Same name (different case), other tenant: allowed.
    await queryRunner.query(
      `INSERT INTO "service_entity" ("name", "durationMinutes", "tenantId") VALUES ('deep clean', 60, $1)`,
      [secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "add_on_entity" ("name", "priceMinorUnits", "tenantId") VALUES ('FRIDGE', 500, $1)`,
      [secondTenant],
    );
    // Different case, same tenant: rejected (case-insensitive).
    await expect(
      queryRunner.query(
        `INSERT INTO "service_entity" ("name", "durationMinutes", "tenantId") VALUES ('DEEP CLEAN', 60, $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'uq_service_tenant_name_lower' },
    });
    await expect(
      queryRunner.query(
        `INSERT INTO "add_on_entity" ("name", "priceMinorUnits", "tenantId") VALUES ('fridge', 500, $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'uq_add_on_tenant_name_lower' },
    });
  });

  it('rejects a pricing rule whose target belongs to another tenant', async () => {
    // Closed interval + inactive: the open/active partial unique indexes are
    // checked immediately and would otherwise fire before the (end-of-
    // statement) FK check, masking it.
    await expect(
      queryRunner.query(
        `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`,
        [serviceA, secondTenant],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_pricing_rule_service_tenant' },
    });
    await expect(
      queryRunner.query(
        `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`,
        [addOnA, secondTenant],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_pricing_rule_add_on_tenant' },
    });
  });

  it('down restores the pre-tenant schema', async () => {
    await queryRunner.query(`DELETE FROM "service_entity" WHERE "tenantId" = $1`, [secondTenant]);
    await queryRunner.query(`DELETE FROM "add_on_entity" WHERE "tenantId" = $1`, [secondTenant]);
    await queryRunner.query(`DELETE FROM "tenant_entity" WHERE "id" = $1`, [secondTenant]);
    await inTransaction((r) => migration.down(r));

    // Column is gone from all three tables.
    const cols: unknown[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name IN ('service_entity','add_on_entity','pricing_rule_entity') AND column_name = 'tenantId'`,
    );
    expect(cols).toHaveLength(0);

    // Restored objects have their original definitions, not just their names.
    const defs: { conname: string; def: string }[] = await queryRunner.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname IN ('fk_pricing_rule_service', 'fk_pricing_rule_addon')`,
    );
    expect(Object.fromEntries(defs.map((row) => [row.conname, row.def]))).toEqual({
      fk_pricing_rule_service: 'FOREIGN KEY ("serviceId") REFERENCES service_entity(id) ON DELETE RESTRICT',
      fk_pricing_rule_addon: 'FOREIGN KEY ("addOnId") REFERENCES add_on_entity(id) ON DELETE RESTRICT',
    });
    const indexDefs: { indexname: string; indexdef: string }[] = await queryRunner.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('uq_service_name_lower', 'uq_add_on_name_lower')`,
    );
    for (const { indexdef } of indexDefs) {
      expect(indexdef).toMatch(/CREATE UNIQUE INDEX .* USING btree \(lower\(\(name\)::text\)\)$/);
    }
    expect(indexDefs).toHaveLength(2);

    // The pre-migration rows survive and global name uniqueness is back.
    const [{ count }]: { count: string }[] = await queryRunner.query(
      `SELECT count(*) FROM "pricing_rule_entity"`,
    );
    expect(Number(count)).toBe(2);

    const constraints = await constraintNames();
    const indexes = await indexNames();
    // `NEW_CONSTRAINTS` includes the three tenant FKs (fk_service_tenant,
    // fk_add_on_tenant, fk_pricing_rule_tenant); asserted absent below.
    expect(constraints).toEqual(expect.arrayContaining(OLD_CONSTRAINTS));
    expect(indexes).toEqual(expect.arrayContaining(OLD_INDEXES));
    for (const added of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(added);
    }
    for (const added of NEW_INDEXES) {
      expect(indexes).not.toContain(added);
    }
  });
});
```

M6 note on the `down` case: the expected `pg_get_constraintdef` / `indexdef` strings are written from PostgreSQL's documented rendering and have **not** been run at planning time. Before Step 4, capture the real definitions on `main`'s schema (`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname IN (…)`; `SELECT indexdef FROM pg_indexes WHERE indexname IN (…)`) and use exactly those as the expected values — the assertion's purpose is "down restores what `main` has", so `main` is the oracle.

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test:e2e -- add-catalog-tenant` → FAIL (migration module not found).

- [ ] **Step 3: Domain + entities**

`domain/service.ts`, `domain/add-on.ts`, `domain/pricing-rule.ts`: add `tenantId: string;` after `id`. In `add-on.ts`, change "global add-ons" to "tenant-owned add-ons (multi-tenant RFC §4.4), not scoped to any `Service`".

`service.entity.ts` — add the tenant column/relation (same shape as `TeamEntity` after #83) and replace the header comment:

```ts
// `name` deliberately has NO `unique` option (Catalog spec §3). Tenant
// ownership (#84): `tenantId` + `fk_service_tenant` are expressed here.
// `AddCatalogTenant` also hand-writes objects this metadata does not
// express, which `migration:generate` may propose dropping — do not apply
// that: `uq_service_id_tenant` (target of the composite
// `fk_pricing_rule_service_tenant`), `uq_service_tenant_name_lower`
// (case-insensitive `("tenantId", LOWER("name"))` expression index — the
// authority behind `ServicesService#assertNameAvailable`),
// `idx_service_tenant_created`.
@Entity()
export class ServiceEntity implements Service {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { nullable: false, eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenantId', foreignKeyConstraintName: 'fk_service_tenant' })
  tenant!: TenantEntity;

  @Column()
  name!: string;
  // … description, durationMinutes, active, createdAt, updatedAt unchanged
}
```

`add-on.entity.ts` — identical change with `fk_add_on_tenant`, `uq_add_on_id_tenant`, `fk_pricing_rule_add_on_tenant`, `uq_add_on_tenant_name_lower`, `idx_add_on_tenant_created`, `AddOnsService#assertNameAvailable`.

`pricing-rule.entity.ts` — add `tenantId` + `tenant` (`fk_pricing_rule_tenant`) after `id`; update the header comment's FK paragraph:

```ts
// `serviceId`/`addOnId` are plain columns with no relation decorators — their
// FK constraints are hand-added SQL, now the tenant-aware composite
// `fk_pricing_rule_service_tenant` (`("serviceId", "tenantId")` →
// `service_entity ("id", "tenantId")`) and `fk_pricing_rule_add_on_tenant`
// (same for add-ons), added by `AddCatalogTenant` (#84, RFC §4.4). Do not add
// a `@ManyToOne` or accept a `migration:generate` proposal to re-add an
// id-only FK. `tenantId` + `fk_pricing_rule_tenant` are expressed here.
```

(Import `JoinColumn`, `ManyToOne` from `typeorm` and `TenantEntity` from the path `TeamEntity` uses.)

- [ ] **Step 4: Migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for Service, AddOn and PricingRule (#84; RFC §4.4, §4.5,
// §4.7). Step order is load-bearing and the whole migration is one
// transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on the three tables.
//   2. Backfill every row to the bootstrap tenant.
//   3. NOT NULL + FKs to `tenant_entity` (ON DELETE RESTRICT).
//   4. `UNIQUE (id, "tenantId")` on service/add-on — required before any
//      composite FK can reference that pair.
//   5. Drop the global `LOWER(name)` unique indexes …
//   6. … and create `("tenantId", LOWER(name))` ones. No duplicate
//      pre-check: the global indexes being replaced already rule out
//      duplicates within one tenant (#84 slice decision 1).
//   7. Replace the id-only pricing-rule FKs with the composite ones. MATCH
//      SIMPLE: the null side of `ck_pricing_rule_target` is not checked.
//   8. Tenant-scoped list indexes for the two nestjs-query roots.
//
// `ck_pricing_rule_target` and the three pricing-rule partial unique
// indexes are untouched: target ids are globally unique UUIDs; the
// composite FK is what binds a rule to its target's tenant.
// `fk_booking_service`, `fk_laundry_order_line_service` and
// `fk_laundry_order_line_add_on` stay id-only — #85 / #87.
export class AddCatalogTenant1790524800000 implements MigrationInterface {
  name = 'AddCatalogTenant1790524800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddCatalogTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    for (const table of ['service_entity', 'add_on_entity', 'pricing_rule_entity']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "tenantId" uuid`);
    }
    for (const table of ['service_entity', 'add_on_entity', 'pricing_rule_entity']) {
      await queryRunner.query(`UPDATE "${table}" SET "tenantId" = $1`, [BOOTSTRAP_TENANT_ID]);
    }
    for (const [table, fk] of [
      ['service_entity', 'fk_service_tenant'],
      ['add_on_entity', 'fk_add_on_tenant'],
      ['pricing_rule_entity', 'fk_pricing_rule_tenant'],
    ]) {
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(`ALTER TABLE "service_entity" ADD CONSTRAINT "uq_service_id_tenant" UNIQUE ("id", "tenantId")`);
    await queryRunner.query(`ALTER TABLE "add_on_entity" ADD CONSTRAINT "uq_add_on_id_tenant" UNIQUE ("id", "tenantId")`);

    await queryRunner.query(`DROP INDEX "public"."uq_service_name_lower"`);
    await queryRunner.query(`DROP INDEX "public"."uq_add_on_name_lower"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_service_tenant_name_lower" ON "service_entity" ("tenantId", LOWER("name"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_add_on_tenant_name_lower" ON "add_on_entity" ("tenantId", LOWER("name"))`);

    await queryRunner.query(`ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_service"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_service_tenant" FOREIGN KEY ("serviceId", "tenantId") REFERENCES "service_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_addon"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_add_on_tenant" FOREIGN KEY ("addOnId", "tenantId") REFERENCES "add_on_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`CREATE INDEX "idx_service_tenant_created" ON "service_entity" ("tenantId", "createdAt" DESC, "id")`);
    await queryRunner.query(`CREATE INDEX "idx_add_on_tenant_created" ON "add_on_entity" ("tenantId", "createdAt" DESC, "id")`);
  }

  // Reverses 8 → 1. Restores the original objects under their original
  // names and definitions (`fk_pricing_rule_service` / `fk_pricing_rule_addon`
  // were `ON DELETE RESTRICT` with default ON UPDATE); fails (correctly) if
  // cross-tenant duplicate names now exist.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_add_on_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_service_tenant_created"`);
    await queryRunner.query(`ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_add_on_tenant"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_addon" FOREIGN KEY ("addOnId") REFERENCES "add_on_entity"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(`ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_service_tenant"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_service" FOREIGN KEY ("serviceId") REFERENCES "service_entity"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_add_on_tenant_name_lower"`);
    await queryRunner.query(`DROP INDEX "public"."uq_service_tenant_name_lower"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_add_on_name_lower" ON "add_on_entity" (LOWER("name"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_service_name_lower" ON "service_entity" (LOWER("name"))`);
    await queryRunner.query(`ALTER TABLE "add_on_entity" DROP CONSTRAINT "uq_add_on_id_tenant"`);
    await queryRunner.query(`ALTER TABLE "service_entity" DROP CONSTRAINT "uq_service_id_tenant"`);
    for (const [table, fk] of [
      ['pricing_rule_entity', 'fk_pricing_rule_tenant'],
      ['add_on_entity', 'fk_add_on_tenant'],
      ['service_entity', 'fk_service_tenant'],
    ]) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "tenantId"`);
    }
  }
}
```

M6 notes: (a) `1790524800000` is a planning placeholder timestamp that sorts after `1790438400000`; keep it unless a later-stamped migration lands on `main` first, in which case re-stamp (file name, class name, `name`, and the e2e's `migrationsBefore` argument together). (b) The `for` loops interpolate only compile-time literal table/constraint names — no caller input. If lint (`contextforge` conventions) objects to the loop form, unroll into explicit statements; behaviour is identical.

- [ ] **Step 5: Run** — migration e2e PASS; `pnpm --filter api test` PASS (unit fixtures building `Service` / `AddOn` / `PricingRule` objects may need `tenantId` added — do that here); `pnpm --filter api build` PASS.
- [ ] **Step 6: Commit** — `feat(84): add tenant ownership to catalog tables`

---

### Task 2: `ServicesService` tenant predicate

**Spec:** §4.4 (Service uniqueness), §4.5 (principal tenant; not-found semantics), §4.6; Slice decisions 3, 4, 6, 10, 11.

**Files:**
- Modify: `apps/api/src/modules/catalog/application/commands/create-service.command.ts`, `update-service.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/catalog/application/services/services.service.ts`
- Test: `apps/api/src/modules/catalog/tests/application/services.service.spec.ts`

**Interfaces:**
- Consumes: `Service.tenantId`, index `uq_service_tenant_name_lower` (Task 1).
- Produces: `createService(command: CreateServiceCommand /* { actorId, tenantId: string, name, description?, durationMinutes } */): Promise<Service>`; `updateService(id: string, command: UpdateServiceCommand /* { actorId, tenantId: string, …optional fields } */): Promise<Service>`; `getService(id: string, tenantId: string | null): Promise<Service | null>`; `getServicesByIds(ids: string[], tenantId: string | null): Promise<Service[]>`; `listServices(tenantId: string | null): Promise<Service[]>`. Consumed by Tasks 5, 6.

- [ ] **Step 1: Write the failing tests** (add to the existing spec; existing `createService` / `updateService` calls gain `tenantId: 't-a'`; import `AdminScope` from `../../../../platform/auth/domain/admin-scope`, `ConflictException` from `@nestjs/common`, `In` from `typeorm`)

```ts
describe('tenant predicate (#84)', () => {
  it('getService scopes by id and tenant', async () => {
    serviceRepository.findOneBy.mockResolvedValue(null);
    await expect(service.getService('s-1', 't-a')).resolves.toBeNull();
    expect(serviceRepository.findOneBy).toHaveBeenCalledWith({ id: 's-1', tenantId: 't-a' });
  });

  it('getServicesByIds puts tenantId in the same where as the id list', async () => {
    serviceRepository.findBy.mockResolvedValue([]);
    await service.getServicesByIds(['a', 'b'], 't-a');
    expect(serviceRepository.findBy).toHaveBeenCalledWith({ id: In(['a', 'b']), tenantId: 't-a' });
  });

  it('listServices scopes by tenant', async () => {
    serviceRepository.find.mockResolvedValue([]);
    await service.listServices('t-a');
    expect(serviceRepository.find).toHaveBeenCalledWith({ where: { tenantId: 't-a' } });
  });

  it.each([
    ['getService', () => service.getService('s-1', null), null],
    ['getServicesByIds', () => service.getServicesByIds(['a'], null), []],
    ['getServicesByIds (empty ids)', () => service.getServicesByIds([], 't-a'), []],
    ['listServices', () => service.listServices(null), []],
  ])('%s fails closed without a repository query', async (_label, call, expected) => {
    await expect(call()).resolves.toEqual(expected);
    expect(serviceRepository.findOneBy).not.toHaveBeenCalled();
    expect(serviceRepository.findBy).not.toHaveBeenCalled();
    expect(serviceRepository.find).not.toHaveBeenCalled();
  });

  it('createService persists the tenant, pre-checks the name within it, and tags the audit event', async () => {
    await service.createService({ actorId: 'u', tenantId: 't-a', name: ' Deep ', durationMinutes: 60 });
    expect(manager.create).toHaveBeenCalledWith(
      ServiceEntity,
      expect.objectContaining({ tenantId: 't-a', name: 'Deep' }),
    );
    expect(nameQueryBuilder.andWhere).toHaveBeenCalledWith('s.tenantId = :tenantId', { tenantId: 't-a' });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'service.create', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('updateService looks up and updates within the tenant and never writes tenantId', async () => {
    manager.findOneBy.mockResolvedValueOnce({ id: 's-1', tenantId: 't-a', name: 'Old', durationMinutes: 60 });
    manager.findOneByOrFail.mockResolvedValueOnce({ id: 's-1', tenantId: 't-a', name: 'New', durationMinutes: 60 });
    await service.updateService('s-1', { actorId: 'u', tenantId: 't-a', name: 'New' });
    expect(manager.findOneBy).toHaveBeenCalledWith(ServiceEntity, { id: 's-1', tenantId: 't-a' });
    const [, where, set] = manager.update.mock.calls[0] as [unknown, object, Record<string, unknown>];
    expect(where).toEqual({ id: 's-1', tenantId: 't-a' });
    expect(set).not.toHaveProperty('tenantId');
    expect(set).not.toHaveProperty('actorId');
    expect(manager.findOneByOrFail).toHaveBeenCalledWith(ServiceEntity, { id: 's-1', tenantId: 't-a' });
    expect(nameQueryBuilder.andWhere).toHaveBeenCalledWith('s.tenantId = :tenantId', { tenantId: 't-a' });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'service.update', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('updateService on another tenant’s service is NotFound with no write', async () => {
    manager.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.updateService('s-foreign', { actorId: 'u', tenantId: 't-b', name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('maps uq_service_tenant_name_lower to Conflict and rethrows other unique violations', async () => {
    manager.save.mockRejectedValueOnce({ code: '23505', driverError: { constraint: 'uq_service_tenant_name_lower' } });
    await expect(
      service.createService({ actorId: 'u', tenantId: 't-a', name: 'Deep', durationMinutes: 60 }),
    ).rejects.toThrow(new ConflictException('Service name is already in use'));

    const other = { code: '23505', driverError: { constraint: 'uq_service_id_tenant' } };
    manager.save.mockRejectedValueOnce(other);
    await expect(
      service.createService({ actorId: 'u', tenantId: 't-a', name: 'Deep', durationMinutes: 60 }),
    ).rejects.toBe(other);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- services.service` → FAIL.

- [ ] **Step 3: Implement**

```ts
const SERVICE_TENANT_NAME_CONSTRAINT = 'uq_service_tenant_name_lower';

createService(command: CreateServiceCommand): Promise<Service> {
  return this.dataSource.transaction((manager) =>
    runAuditInTransaction(manager, async () => {
      const name = command.name.trim();
      const entity = manager.create(ServiceEntity, {
        active: true,
        description: command.description ?? null,
        durationMinutes: command.durationMinutes,
        name,
        tenantId: command.tenantId,
      });
      this.assertValid(entity);
      await this.assertNameAvailable(manager, command.tenantId, name);
      await this.translateUniqueViolation(() => manager.save(entity));
      await this.auditLogger.log({
        actorId: command.actorId,
        entityId: entity.id,
        tenantId: command.tenantId,
        action: 'service.create',
        entityType: 'service',
        scope: AdminScope.TENANT,
      });
      return entity;
    }),
  );
}

// Reads: `tenantId: null` (no principal tenant scope, RFC §4.5) fails closed
// WITHOUT issuing a repository query (#84 slice decision 4).
getService(id: string, tenantId: string | null): Promise<Service | null> {
  if (tenantId === null) {
    return Promise.resolve(null);
  }
  return this.serviceRepository.findOneBy({ id, tenantId });
}

// Bulk lookup for Billing's invoice-line name resolution. `tenantId` MUST be
// in the same `where` as `id: In(ids)` — never fetch by ids then filter in
// memory (#84 slice decision 6). A foreign id is simply absent.
getServicesByIds(ids: string[], tenantId: string | null): Promise<Service[]> {
  if (ids.length === 0 || tenantId === null) {
    return Promise.resolve([]);
  }
  return this.serviceRepository.findBy({ id: In(ids), tenantId });
}

listServices(tenantId: string | null): Promise<Service[]> {
  if (tenantId === null) {
    return Promise.resolve([]);
  }
  return this.serviceRepository.find({ where: { tenantId } });
}
```

`updateService(id, command)`:
- `manager.findOneBy(ServiceEntity, { id, tenantId: command.tenantId })` → `NotFoundException` when null (message unchanged).
- `const { actorId, tenantId, ...changes } = command;` — `tenantId` is used for the `where` below, never in the SET list (comment it; #83 `updateCleaner` idiom).
- `assertNameAvailable(manager, tenantId, changes.name, id)` when `changes.name !== undefined`.
- `manager.update(ServiceEntity, { id, tenantId }, { ...changes, updatedAt: new Date() })`.
- `manager.findOneByOrFail(ServiceEntity, { id, tenantId })`.
- Audit with `tenantId`, `scope: AdminScope.TENANT`.

`assertNameAvailable(manager, tenantId: string, name: string, excludeId?: string)`: after `.where('LOWER(s.name) = LOWER(:name)', { name })` add `.andWhere('s.tenantId = :tenantId', { tenantId })`, then the existing optional `excludeId` clause. Update its comment: the authority is now `uq_service_tenant_name_lower`.

`translateUniqueViolation`: #82 `CustomersService` shape — read `err.driverError?.constraint ?? err.constraint`; throw `ConflictException('Service name is already in use')` only when that is `undefined` or `SERVICE_TENANT_NAME_CONSTRAINT`; otherwise rethrow.

Callers in other files will fail to type-check until Tasks 5–6. To keep `pnpm --filter api test` green per task:
- `BookingsService` create validation already has `command.tenantId` (#82) — wire it for real now: `getService(command.serviceId, command.tenantId)` (Task 6 adds its test).
- `ServiceResolver.createService` / `updateService` need a `string` tenant: wire `tenantId: requireTenantId(currentUser)` now, after the input spread (Task 5 adds their tests).
- Every other call site (`ServiceResolver.service`, `InvoicesService.buildLinePayloads`) gets a temporary `null` second argument with a `// #84 Task N` marker naming the task that wires it. Never pass `BOOTSTRAP_TENANT_ID`. `null` fails closed, so the temporary state can only hide rows, never leak them.
- Update those call sites' existing unit-test expectations for the extra argument; Tasks 5–6 change them to the real tenant.
- Task 8's final gate greps that no `// #84 Task` marker remains.

- [ ] **Step 4: Run** — PASS (`pnpm --filter api test`).
- [ ] **Step 5: Commit** — `feat(84): scope ServicesService by tenant`

---

### Task 3: `AddOnsService` tenant predicate

**Spec:** §4.4 (AddOn uniqueness), §4.5, §4.6; Slice decisions 3, 4, 6, 10, 11.

**Files:**
- Modify: `apps/api/src/modules/catalog/application/commands/create-add-on.command.ts`, `update-add-on.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/catalog/application/services/add-ons.service.ts`
- Test: `apps/api/src/modules/catalog/tests/application/add-ons.service.spec.ts`

**Interfaces:**
- Consumes: `AddOn.tenantId`, index `uq_add_on_tenant_name_lower` (Task 1).
- Produces: `createAddOn(command /* { actorId, tenantId: string, … } */): Promise<AddOn>`; `updateAddOn(id, command /* { actorId, tenantId: string, … } */): Promise<AddOn>`; `getAddOnsByIds(ids: string[], tenantId: string | null): Promise<AddOn[]>`; `listAddOns(tenantId: string | null): Promise<AddOn[]>`. Consumed by Tasks 5, 6.

- [ ] **Step 1: Write the failing tests** (the spec's existing mock setup mirrors `services.service.spec.ts`; its query-builder mock is named as in that file — use the existing name; the builder alias is `a`)

```ts
describe('tenant predicate (#84)', () => {
  it('getAddOnsByIds puts tenantId in the same where as the id list', async () => {
    addOnRepository.findBy.mockResolvedValue([]);
    await service.getAddOnsByIds(['a', 'b'], 't-a');
    expect(addOnRepository.findBy).toHaveBeenCalledWith({ id: In(['a', 'b']), tenantId: 't-a' });
  });

  it('listAddOns scopes by tenant', async () => {
    addOnRepository.find.mockResolvedValue([]);
    await service.listAddOns('t-a');
    expect(addOnRepository.find).toHaveBeenCalledWith({ where: { tenantId: 't-a' } });
  });

  it.each([
    ['getAddOnsByIds', () => service.getAddOnsByIds(['a'], null)],
    ['getAddOnsByIds (empty ids)', () => service.getAddOnsByIds([], 't-a')],
    ['listAddOns', () => service.listAddOns(null)],
  ])('%s fails closed without a repository query', async (_label, call) => {
    await expect(call()).resolves.toEqual([]);
    expect(addOnRepository.findBy).not.toHaveBeenCalled();
    expect(addOnRepository.find).not.toHaveBeenCalled();
  });

  it('createAddOn persists the tenant, pre-checks the name within it, and tags the audit event', async () => {
    await service.createAddOn({ actorId: 'u', tenantId: 't-a', name: 'Fridge', priceMinorUnits: 500 });
    expect(manager.create).toHaveBeenCalledWith(AddOnEntity, expect.objectContaining({ tenantId: 't-a' }));
    expect(nameQueryBuilder.andWhere).toHaveBeenCalledWith('a.tenantId = :tenantId', { tenantId: 't-a' });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'add_on.create', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('updateAddOn looks up and updates within the tenant and never writes tenantId', async () => {
    manager.findOneBy.mockResolvedValueOnce({ id: 'ao-1', tenantId: 't-a', name: 'Fridge', priceMinorUnits: 500 });
    manager.findOneByOrFail.mockResolvedValueOnce({ id: 'ao-1', tenantId: 't-a', name: 'Oven', priceMinorUnits: 500 });
    await service.updateAddOn('ao-1', { actorId: 'u', tenantId: 't-a', name: 'Oven' });
    expect(manager.findOneBy).toHaveBeenCalledWith(AddOnEntity, { id: 'ao-1', tenantId: 't-a' });
    const [, where, set] = manager.update.mock.calls[0] as [unknown, object, Record<string, unknown>];
    expect(where).toEqual({ id: 'ao-1', tenantId: 't-a' });
    expect(set).not.toHaveProperty('tenantId');
    expect(set).not.toHaveProperty('actorId');
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'add_on.update', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('updateAddOn on another tenant’s add-on is NotFound with no write', async () => {
    manager.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.updateAddOn('ao-foreign', { actorId: 'u', tenantId: 't-b', name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('maps uq_add_on_tenant_name_lower to Conflict and rethrows other unique violations', async () => {
    manager.save.mockRejectedValueOnce({ code: '23505', driverError: { constraint: 'uq_add_on_tenant_name_lower' } });
    await expect(
      service.createAddOn({ actorId: 'u', tenantId: 't-a', name: 'Fridge', priceMinorUnits: 500 }),
    ).rejects.toThrow(new ConflictException('Add-on name is already in use'));
    const other = { code: '23505', driverError: { constraint: 'uq_add_on_id_tenant' } };
    manager.save.mockRejectedValueOnce(other);
    await expect(
      service.createAddOn({ actorId: 'u', tenantId: 't-a', name: 'Fridge', priceMinorUnits: 500 }),
    ).rejects.toBe(other);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- add-ons.service` → FAIL.

- [ ] **Step 3: Implement** — exactly Task 2's changes applied to `AddOnsService`:
  - `createAddOn`: `manager.create(AddOnEntity, { …, tenantId: command.tenantId })`; `assertNameAvailable(manager, command.tenantId, name)`; audit `{ …, tenantId: command.tenantId, scope: AdminScope.TENANT }`.
  - `getAddOnsByIds(ids, tenantId)`: `if (ids.length === 0 || tenantId === null) return Promise.resolve([]);` then `findBy({ id: In(ids), tenantId })`; comment as Task 2 (Billing's name resolution; same-query rule).
  - `listAddOns(tenantId)`: null ⇒ `[]` without query; `find({ where: { tenantId } })`.
  - `updateAddOn(id, command)`: lookup `{ id, tenantId: command.tenantId }`; `const { actorId, tenantId, ...changes } = command;`; `assertNameAvailable(manager, tenantId, changes.name, id)`; `manager.update(AddOnEntity, { id, tenantId }, { ...changes, updatedAt: new Date() })`; `findOneByOrFail(AddOnEntity, { id, tenantId })`; audit tagged.
  - `assertNameAvailable(manager, tenantId, name, excludeId?)`: `.andWhere('a.tenantId = :tenantId', { tenantId })`.
  - `translateUniqueViolation`: constraint `ADD_ON_TENANT_NAME_CONSTRAINT = 'uq_add_on_tenant_name_lower'`; message unchanged.
  - Update the class header comment: "`AddOn` is tenant-owned (RFC §4.4) and not scoped to any `Service`".

Call sites: `AddOnResolver.createAddOn` / `updateAddOn` wire `tenantId: requireTenantId(currentUser)` now (Task 5 adds tests); `InvoicesService.buildLinePayloads`'s `getAddOnsByIds` gets the `null` placeholder with `// #84 Task 6`.

- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat(84): scope AddOnsService by tenant`

---

### Task 4: `PricingRulesService` tenant predicate

**Spec:** §4.4 (pricing rule → service or add-on same-tenant), §4.5, §4.6; Slice decisions 4, 5, 6, 10.

**Files:**
- Modify: `apps/api/src/modules/catalog/application/commands/create-pricing-rule.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/catalog/application/services/pricing-rules.service.ts`
- Test: `apps/api/src/modules/catalog/tests/application/pricing-rules.service.spec.ts`

**Interfaces:**
- Consumes: `PricingRule.tenantId`, `Service.tenantId`, `AddOn.tenantId` (Task 1).
- Produces: `createPricingRule(command: CreatePricingRuleCommand /* + tenantId: string */): Promise<PricingRule>`; `getActivePricing(serviceId: string, tenantId: string | null): Promise<PricingRule | null>`; `getActivePricingForServiceIds(serviceIds: string[], tenantId: string | null): Promise<PricingRule[]>`; `resolveEffectivePricing(target: { addOnId: string } | { serviceId: string }, asOf: Date, tenantId: string | null): Promise<PricingRule | null>`. Consumed by Tasks 5, 6.

- [ ] **Step 1: Write the failing tests** (extend the existing spec; existing `createPricingRule` calls gain `tenantId: 't-a'`; existing `getActivePricing` / `getActivePricingForServiceIds` / `resolveEffectivePricing` calls gain `'t-a'`. The spec already mocks `manager.findOneBy`, `manager.createQueryBuilder().update().set().where().returning().execute()`, `manager.update`, `manager.create`, `manager.save`, and `pricingRuleRepository.createQueryBuilder`; reuse those mocks — named here `closeQueryBuilder` and `resolveQueryBuilder`; use the spec's existing names.)

```ts
describe('tenant predicate (#84)', () => {
  it('createPricingRule checks the service target within the tenant', async () => {
    manager.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.createPricingRule({ actorId: 'u', tenantId: 't-b', serviceId: 's-a', priceMinorUnits: 100 }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.findOneBy).toHaveBeenCalledWith(ServiceEntity, { id: 's-a', tenantId: 't-b' });
    // No close, no deactivate, no insert (Review Focus 2).
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('createPricingRule checks the add-on target within the tenant', async () => {
    manager.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.createPricingRule({ actorId: 'u', tenantId: 't-b', addOnId: 'ao-a', priceMinorUnits: 100 }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.findOneBy).toHaveBeenCalledWith(AddOnEntity, { id: 'ao-a', tenantId: 't-b' });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('createPricingRule constrains close + deactivate by tenant, persists it, and tags the audit event', async () => {
    manager.findOneBy.mockResolvedValueOnce({ id: 's-a', tenantId: 't-a' });
    await service.createPricingRule({ actorId: 'u', tenantId: 't-a', serviceId: 's-a', priceMinorUnits: 100 });
    expect(closeQueryBuilder.where).toHaveBeenCalledWith(
      `"serviceId" = :targetId AND "tenantId" = :tenantId AND "effectiveTo" IS NULL`,
      { targetId: 's-a', tenantId: 't-a' },
    );
    expect(manager.update).toHaveBeenCalledWith(
      PricingRuleEntity,
      { active: true, serviceId: 's-a', tenantId: 't-a' },
      { active: false },
    );
    expect(manager.create).toHaveBeenCalledWith(
      PricingRuleEntity,
      expect.objectContaining({ tenantId: 't-a', serviceId: 's-a', addOnId: null }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pricing_rule.create', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('getActivePricing checks the service and reads the rule within the tenant', async () => {
    serviceRepository.findOneBy.mockResolvedValue({ id: 's-a', tenantId: 't-a' });
    pricingRuleRepository.findOneBy.mockResolvedValue(null);
    await service.getActivePricing('s-a', 't-a');
    expect(serviceRepository.findOneBy).toHaveBeenCalledWith({ id: 's-a', tenantId: 't-a' });
    expect(pricingRuleRepository.findOneBy).toHaveBeenCalledWith({ active: true, serviceId: 's-a', tenantId: 't-a' });
  });

  it('getActivePricing for another tenant’s service is NotFound', async () => {
    serviceRepository.findOneBy.mockResolvedValue(null);
    await expect(service.getActivePricing('s-a', 't-b')).rejects.toThrow(NotFoundException);
    expect(pricingRuleRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('getActivePricing with a null tenant is NotFound without a query', async () => {
    await expect(service.getActivePricing('s-a', null)).rejects.toThrow(NotFoundException);
    expect(serviceRepository.findOneBy).not.toHaveBeenCalled();
    expect(pricingRuleRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('getActivePricingForServiceIds puts tenantId in the same where as the id list', async () => {
    pricingRuleRepository.findBy.mockResolvedValue([]);
    await service.getActivePricingForServiceIds(['a', 'b'], 't-a');
    expect(pricingRuleRepository.findBy).toHaveBeenCalledWith({ active: true, serviceId: In(['a', 'b']), tenantId: 't-a' });
  });

  it.each([
    ['null tenant', () => service.getActivePricingForServiceIds(['a'], null)],
    ['empty ids', () => service.getActivePricingForServiceIds([], 't-a')],
  ])('getActivePricingForServiceIds fails closed without a query (%s)', async (_label, call) => {
    await expect(call()).resolves.toEqual([]);
    expect(pricingRuleRepository.findBy).not.toHaveBeenCalled();
  });

  it('resolveEffectivePricing adds the tenant to the query', async () => {
    resolveQueryBuilder.getOne.mockResolvedValue(null);
    await service.resolveEffectivePricing({ serviceId: 's-a' }, new Date(), 't-a');
    expect(resolveQueryBuilder.andWhere).toHaveBeenCalledWith('rule."tenantId" = :tenantId', { tenantId: 't-a' });
  });

  it('resolveEffectivePricing with a null tenant returns null without a query', async () => {
    await expect(service.resolveEffectivePricing({ addOnId: 'ao-a' }, new Date(), null)).resolves.toBeNull();
    expect(pricingRuleRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
```

(If the spec's mocks do not yet include `serviceRepository.findOneBy` / `pricingRuleRepository.findBy` / `.findOneBy` / `.createQueryBuilder`, add them in `beforeEach` in the existing style. If the existing close-`UPDATE` test asserts the old `where` string, update it to the new one.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- pricing-rules.service` → FAIL.

- [ ] **Step 3: Implement**

`createPricingRule`:
- Step 1 existence check: `manager.findOneBy(ServiceEntity, { id: target.id, tenantId: command.tenantId })` / `manager.findOneBy(AddOnEntity, { id: target.id, tenantId: command.tenantId })`. Messages unchanged. Comment: another tenant's target is indistinguishable from a missing one (RFC §4.5, §4.9).
- Step 3 close `UPDATE`:

```ts
          .where(
            `"${target.column}" = :targetId AND "tenantId" = :tenantId AND "effectiveTo" IS NULL`,
            { targetId: target.id, tenantId: command.tenantId },
          )
```

  Comment: the existence check already proved the target is in this tenant and the composite FK binds every rule to its target's tenant, so the tenant predicate never changes which row is closed — it makes the statement's scope self-evident (#84 slice decision 6).
- Step 4 legacy deactivate: `manager.update(PricingRuleEntity, { active: true, serviceId: target.id, tenantId: command.tenantId }, { active: false })`.
- Step 5 insert: add `tenantId: command.tenantId`.
- Step 6 audit: add `tenantId: command.tenantId`, `scope: AdminScope.TENANT`.

Reads:

```ts
// Existing contract: missing service ⇒ NotFound; `null` when no active rule.
// `tenantId: null` fails closed with that same NotFound, without a query
// (#84 slice decision 4). Another tenant's service is not found.
async getActivePricing(serviceId: string, tenantId: string | null): Promise<PricingRule | null> {
  const service =
    tenantId === null
      ? null
      : await this.serviceRepository.findOneBy({ id: serviceId, tenantId });
  if (!service) {
    throw new NotFoundException(`Service ${serviceId} not found`);
  }
  return this.pricingRuleRepository.findOneBy({ active: true, serviceId, tenantId });
}

getActivePricingForServiceIds(serviceIds: string[], tenantId: string | null): Promise<PricingRule[]> {
  if (serviceIds.length === 0 || tenantId === null) {
    return Promise.resolve([]);
  }
  return this.pricingRuleRepository.findBy({ active: true, serviceId: In(serviceIds), tenantId });
}

async resolveEffectivePricing(
  target: { addOnId: string } | { serviceId: string },
  asOf: Date,
  tenantId: string | null,
): Promise<PricingRule | null> {
  if (tenantId === null) {
    return null;
  }
  const qb = this.pricingRuleRepository.createQueryBuilder('rule');
  // … existing target branch unchanged …
  return qb
    .andWhere('rule."tenantId" = :tenantId', { tenantId })
    .andWhere('rule."effectiveFrom" <= :asOf', { asOf })
    .andWhere('(rule."effectiveTo" IS NULL OR rule."effectiveTo" > :asOf)', { asOf })
    .getOne();
}
```

(Note `getActivePricingForServiceIds` gains an empty-ids short-circuit — `In([])` is avoided; the batch function never passes `[]`, so this changes no observable behaviour.)

Call sites: `PricingRuleResolver.createPricingRule` wires `tenantId: requireTenantId(currentUser)` now (Task 5 adds tests). `PricingRuleResolver.activePricing` → `getActivePricing(serviceId, null) // #84 Task 5`; `createActivePricingBatchFn` → `getActivePricingForServiceIds([...serviceIds], null) // #84 Task 5`; `BookingsService` create validation → `getActivePricing(command.serviceId, command.tenantId)` (real now; Task 6 tests); `LaundryOrdersService.price` → `resolveEffectivePricing(…, asOf, null) // #84 Task 6`.

- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat(84): scope PricingRulesService by tenant`

---

### Task 5: GraphQL — `@Authorize`, resolvers, active-pricing loader, relation guard

**Spec:** §4.2 (roles unchanged, no Super Admin), §4.5 (principal-only tenant; filters narrow only; relations and loaders share the predicate; not-found semantics); Slice decisions 4, 7, 8.

**Files:**
- Modify: `apps/api/src/modules/catalog/presentation/graphql/service.type.ts`, `add-on.type.ts` (+ `@Authorize(tenantReadAuthorizer())`)
- Modify: `apps/api/src/modules/catalog/presentation/graphql/active-pricing.loader.ts`
- Modify: `apps/api/src/modules/catalog/presentation/graphql/service.resolver.ts`, `add-on.resolver.ts`, `pricing-rule.resolver.ts`
- Modify: `apps/api/src/modules/catalog/presentation/graphql/mappers.ts` (keep `tenantId` out of the GraphQL objects — the explicit field lists already do; no change unless the type checker requires it)
- Test: `apps/api/src/modules/catalog/tests/graphql/active-pricing.loader.spec.ts`, `service.resolver.spec.ts`, `add-on.resolver.spec.ts`, `pricing-rule.resolver.spec.ts`, `service-read.resolver.spec.ts`
- Create test: `apps/api/src/modules/catalog/tests/graphql/catalog-relations.authorization.spec.ts`

**Interfaces:**
- Consumes: `tenantReadAuthorizer` (`platform/auth/authorization/tenant-read.authorizer`), `requireTenantId` (`platform/auth/authorization/require-tenant-id`); Tasks 2–4 signatures.
- Produces: `createActivePricingBatchFn(pricingRulesService: Pick<PricingRulesService, 'getActivePricingForServiceIds'>, tenantId: string | null): DataLoader.BatchLoadFn<string, PricingRule | null>`; `ActivePricingLoader.loaderFor(tenantId: string | null): DataLoader<string, PricingRule | null>`. No new public GraphQL surface.

- [ ] **Step 1: Write the failing tests**

Loader (`active-pricing.loader.spec.ts`; replace the existing batch-function tests' call shape; `makeRule(serviceId)` is the spec's existing helper or a local one returning a `PricingRule` with `tenantId: 't-a'`):

```ts
describe('createActivePricingBatchFn (#84 tenant scope)', () => {
  it('asks the service for the ids within the given tenant and maps misses to null', async () => {
    const rule = makeRule('s-a');
    const pricingRulesService = { getActivePricingForServiceIds: jest.fn().mockResolvedValue([rule]) };
    const batchFn = createActivePricingBatchFn(pricingRulesService, 't-a');
    await expect(batchFn(['s-a', 'foreign'])).resolves.toEqual([rule, null]);
    expect(pricingRulesService.getActivePricingForServiceIds).toHaveBeenCalledWith(['s-a', 'foreign'], 't-a');
  });

  it('null tenant resolves every key to null without calling the service', async () => {
    const pricingRulesService = { getActivePricingForServiceIds: jest.fn() };
    const batchFn = createActivePricingBatchFn(pricingRulesService, null);
    await expect(batchFn(['a', 'b'])).resolves.toEqual([null, null]);
    expect(pricingRulesService.getActivePricingForServiceIds).not.toHaveBeenCalled();
  });
});

describe('ActivePricingLoader.loaderFor', () => {
  it('returns one DataLoader per tenant id, memoized for the request', () => {
    const loaders = new ActivePricingLoader({ getActivePricingForServiceIds: jest.fn() } as never);
    expect(loaders.loaderFor('t-a')).toBe(loaders.loaderFor('t-a'));
    expect(loaders.loaderFor('t-a')).not.toBe(loaders.loaderFor('t-b'));
    expect(loaders.loaderFor(null)).toBe(loaders.loaderFor(null));
  });

  it('batches loads within one tenant into one tenant-scoped call', async () => {
    const getActivePricingForServiceIds = jest.fn().mockResolvedValue([]);
    const loaders = new ActivePricingLoader({ getActivePricingForServiceIds } as never);
    const loader = loaders.loaderFor('t-a');
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(getActivePricingForServiceIds).toHaveBeenCalledTimes(1);
    expect(getActivePricingForServiceIds).toHaveBeenCalledWith(['a', 'b'], 't-a');
  });
});
```

Resolver specs (extend the existing ones; `principal = { id: 'u', role: Role.OPS_MANAGER, scope: AdminScope.TENANT, tenantId: 't-a' }`, `noTenant = { ...principal, tenantId: null }`):

```ts
// service.resolver.spec.ts
it('service(id) passes the caller tenant', async () => {
  servicesService.getService.mockResolvedValue(null);
  await expect(resolver.service('s-1', principal)).resolves.toBeNull();
  expect(servicesService.getService).toHaveBeenCalledWith('s-1', 't-a');
});

it('createService takes tenantId from the principal, after the input spread', async () => {
  servicesService.createService.mockResolvedValue(makeService());
  await resolver.createService({ name: 'Deep', durationMinutes: 60, tenantId: 'evil' } as never, principal);
  expect(servicesService.createService).toHaveBeenCalledWith(
    expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
  );
});

it('updateService takes tenantId from the principal, after the input spread', async () => {
  servicesService.updateService.mockResolvedValue(makeService());
  await resolver.updateService('s-1', { name: 'New', tenantId: 'evil' } as never, principal);
  expect(servicesService.updateService).toHaveBeenCalledWith(
    's-1',
    expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
  );
});

it('createService with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(
    resolver.createService({ name: 'Deep', durationMinutes: 60 } as never, noTenant),
  ).rejects.toThrow(ForbiddenException);
  expect(servicesService.createService).not.toHaveBeenCalled();
});

it('updateService with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(resolver.updateService('s-1', { name: 'X' } as never, noTenant)).rejects.toThrow(ForbiddenException);
  expect(servicesService.updateService).not.toHaveBeenCalled();
});

it('Service.activePricing uses the loader for the caller tenant', async () => {
  const load = jest.fn().mockResolvedValue(null);
  loader.loaderFor.mockReturnValue({ load });
  await expect(resolver.activePricing({ id: 's-1' }, principal)).resolves.toBeNull();
  expect(loader.loaderFor).toHaveBeenCalledWith('t-a');
  expect(load).toHaveBeenCalledWith('s-1');
});

it('Service.activePricing with no principal uses the null-tenant loader', async () => {
  const load = jest.fn().mockResolvedValue(null);
  loader.loaderFor.mockReturnValue({ load });
  await resolver.activePricing({ id: 's-1' }, undefined);
  expect(loader.loaderFor).toHaveBeenCalledWith(null);
});

// add-on.resolver.spec.ts — same four write cases for createAddOn / updateAddOn:
it('createAddOn takes tenantId from the principal, after the input spread', async () => {
  addOnsService.createAddOn.mockResolvedValue(makeAddOn());
  await resolver.createAddOn({ name: 'Fridge', priceMinorUnits: 500, tenantId: 'evil' } as never, principal);
  expect(addOnsService.createAddOn).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u', tenantId: 't-a' }));
});
it('updateAddOn takes tenantId from the principal, after the input spread', async () => {
  addOnsService.updateAddOn.mockResolvedValue(makeAddOn());
  await resolver.updateAddOn('ao-1', { name: 'Oven', tenantId: 'evil' } as never, principal);
  expect(addOnsService.updateAddOn).toHaveBeenCalledWith('ao-1', expect.objectContaining({ actorId: 'u', tenantId: 't-a' }));
});
it('createAddOn with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(resolver.createAddOn({ name: 'F', priceMinorUnits: 1 } as never, noTenant)).rejects.toThrow(ForbiddenException);
  expect(addOnsService.createAddOn).not.toHaveBeenCalled();
});
it('updateAddOn with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(resolver.updateAddOn('ao-1', { name: 'F' } as never, noTenant)).rejects.toThrow(ForbiddenException);
  expect(addOnsService.updateAddOn).not.toHaveBeenCalled();
});

// pricing-rule.resolver.spec.ts
it('activePricing(serviceId) passes the caller tenant', async () => {
  pricingRulesService.getActivePricing.mockResolvedValue(null);
  await expect(resolver.activePricing('s-1', principal)).resolves.toBeNull();
  expect(pricingRulesService.getActivePricing).toHaveBeenCalledWith('s-1', 't-a');
});
it('createPricingRule takes tenantId from the principal, after the input spread', async () => {
  pricingRulesService.createPricingRule.mockResolvedValue(makeRule('s-1'));
  await resolver.createPricingRule({ serviceId: 's-1', priceMinorUnits: 100, tenantId: 'evil' } as never, principal);
  expect(pricingRulesService.createPricingRule).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u', tenantId: 't-a' }));
});
it('createPricingRule with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(
    resolver.createPricingRule({ serviceId: 's-1', priceMinorUnits: 100 } as never, noTenant),
  ).rejects.toThrow(ForbiddenException);
  expect(pricingRulesService.createPricingRule).not.toHaveBeenCalled();
});
```

(`makeService` / `makeAddOn` / `makeRule` are the specs' existing fixture helpers, extended with `tenantId: 't-a'`; add a local helper if a spec has none. `loader` is the mocked `ActivePricingLoader` — change the existing mock from `{ loader: { load } }` to `{ loaderFor: jest.fn() }`.)

`@Authorize` metadata (in `service-read.resolver.spec.ts`; also add the `AddOnType` case there or in a new `add-on-read.resolver.spec.ts` if M6 prefers one file per type — #83 precedent):

```ts
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getAuthorizer from
// the package root, so this deep import is required.
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators';

// @Authorize metadata (mirrors #83's team.resolver.spec.ts).
describe.each([
  ['ServiceType', ServiceType],
  ['AddOnType', AddOnType],
])('%s tenant authorizer', (_name, DTO) => {
  it('is registered and constrains reads to the principal tenant', async () => {
    const Authorizer = getAuthorizer(DTO as never);
    expect(Authorizer).toBeDefined();
    const authorizer = new Authorizer!({}, undefined);
    await expect(
      authorizer.authorize(
        { req: { user: { id: 'u', tenantId: 't-a', role: Role.OPS_MANAGER, scope: AdminScope.TENANT } } },
        { operationGroup: 'read' } as never,
      ),
    ).resolves.toEqual({ tenantId: { eq: 't-a' } });
  });
});
```

Relation guard (`catalog-relations.authorization.spec.ts`, own file for the same schema-leak reason as #83's):

```ts
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getRelations from
// the package root, so this deep import is required.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { AddOnType } from '../../presentation/graphql/add-on.type';
import { ServiceType } from '../../presentation/graphql/service.type';

// Kept in its own file: importing the Bookings GraphQL types registers their
// object types globally, which would leak into the catalog resolver specs.
describe('Relations targeting Service/AddOn (tenant isolation, #84)', () => {
  // nestjs-query gives a relation's own `auth` precedence over the target
  // DTO's `@Authorize`, so an `auth` on any of these would silently bypass
  // the tenant predicate. Relation `update`/`remove` must stay disabled:
  // `@Authorize` is relied on for reads only.
  it('no relation targeting Service/AddOn overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO],
      ['Service', ServiceType],
      ['AddOn', AddOnType],
    ] as const;
    const targets: unknown[] = [ServiceType, AddOnType];
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({ ...many, ...one })) {
        if (!targets.includes(relation.DTO)) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found).toEqual(['Booking.service']);
  });
});
```

(Laundry / Billing GraphQL types expose `serviceId` / `addOnId` as plain id fields, not relations — verified at planning time by `grep -rn "ServiceType\|AddOnType" src --include=*.ts` outside `catalog/`, which finds only `booking.dto.ts`. If M6 finds another owner, add it to `owners` and to the expected list.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- catalog` → FAIL.

- [ ] **Step 3: Implement**

- `service.type.ts` / `add-on.type.ts`: `@Authorize(tenantReadAuthorizer())` above `@ObjectType`. No `tenantId` field.
- `active-pricing.loader.ts`:

```ts
// `tenantId` comes from the resolver (`@CurrentUser()`), never from ambient
// request state (#84 slice decision 7). `null` — no tenant scope — resolves
// every key to null without touching the service.
export function createActivePricingBatchFn(
  pricingRulesService: Pick<PricingRulesService, 'getActivePricingForServiceIds'>,
  tenantId: string | null,
): DataLoader.BatchLoadFn<string, PricingRule | null> {
  return async (serviceIds) => {
    if (tenantId === null) {
      return serviceIds.map(() => null);
    }
    const rules = await pricingRulesService.getActivePricingForServiceIds([...serviceIds], tenantId);
    const byServiceId = new Map(rules.map((rule) => [rule.serviceId, rule]));
    return serviceIds.map((id) => byServiceId.get(id) ?? null);
  };
}

// Request-scoped: fresh caches per GraphQL request. One DataLoader per tenant
// id, so a cached rule can only ever be served back to a caller of the tenant
// it was loaded for.
@Injectable({ scope: Scope.REQUEST })
export class ActivePricingLoader {
  private readonly loaders = new Map<string | null, DataLoader<string, PricingRule | null>>();

  constructor(private readonly pricingRulesService: PricingRulesService) {}

  loaderFor(tenantId: string | null): DataLoader<string, PricingRule | null> {
    let loader = this.loaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(createActivePricingBatchFn(this.pricingRulesService, tenantId));
      this.loaders.set(tenantId, loader);
    }
    return loader;
  }
}
```

  Keep the existing header comment about the separate `activePricing(serviceId)` code path.
- `ServiceResolver`:
  - `activePricing(@Parent() service, @CurrentUser() currentUser: AuthenticatedPrincipal | undefined)` → `this.loader.loaderFor(currentUser?.tenantId ?? null).load(service.id)`. Comment: tenant from the principal, never from the parent row; no principal ⇒ null-tenant loader ⇒ `null`.
  - `service(id, @CurrentUser() currentUser)` → `getService(id, currentUser.tenantId)`.
  - `createService` / `updateService`: `{ ...input, actorId: currentUser.id, tenantId: requireTenantId(currentUser) }` (already wired in Task 2 — confirm the order: `tenantId` **after** the spread).
- `AddOnResolver`: same for both mutations (already wired in Task 3). Update the header comment: "`AddOn` is tenant-owned (RFC §4.4)".
- `PricingRuleResolver`: `activePricing(serviceId, @CurrentUser() currentUser)` → `getActivePricing(serviceId, currentUser.tenantId)`; `createPricingRule` → `tenantId: requireTenantId(currentUser)` after the spread (already wired in Task 4). Add to the header comment: `PricingRuleType` is not a nestjs-query DTO; its only read paths are this query and `Service.activePricing`, both tenant-scoped (#84 slice decision 8).
- Update resolver header comments in the #82/#83 style (tenant only from the principal; reads pass it, writes require it). Replace all `// #84 Task 5` markers.

- [ ] **Step 4: Run** — PASS; `pnpm --filter api build` PASS; regenerate the schema the way the repo does (`pnpm --filter api build` / schema emit) and confirm `git diff` shows **no** schema change.
- [ ] **Step 5: Commit** — `feat(84): enforce tenant isolation on catalog GraphQL`

---

### Task 6: Consumers — Bookings, Laundry, Billing, seed

**Spec:** §4.4 (booking → service, laundry line → service / add-on same-tenant at the application layer), §4.5 (principal-only tenant; REST fail-closed); Slice decision 9.

**Files:**
- Modify: `apps/api/src/modules/bookings/application/services/bookings.service.ts` (create validation, ~line 277–290 — already wired in Tasks 2/4; this task adds tests)
- Modify: `apps/api/src/modules/laundry/application/commands/price-laundry-order.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/laundry/application/services/laundry-orders.service.ts` (`price`, ~line 188)
- Modify: `apps/api/src/modules/laundry/presentation/graphql/laundry-order.resolver.ts` (`priceLaundryOrder`)
- Modify: `apps/api/src/modules/billing/application/commands/generate-invoice-from-order.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/billing/application/services/invoices.service.ts` (`generateFromOrder`, `buildLinePayloads`)
- Modify: `apps/api/src/modules/billing/presentation/graphql/invoice.resolver.ts` (`generateInvoiceFromOrder`)
- Modify: `apps/api/src/modules/bookings/infrastructure/persistence/seed/booking-fixtures.seed-data.ts` (`bookingFixtureService` + `tenantId: BOOTSTRAP_TENANT_ID`)
- Test: `bookings.service.spec.ts`, `laundry-orders.service.spec.ts`, `laundry-order.resolver.spec.ts` (create if absent, following the other resolver specs' `Test.createTestingModule` shape), `invoices.service.spec.ts`, `invoice.resolver.spec.ts` (same)

**Interfaces:**
- Consumes: `ServicesService.getService` / `getServicesByIds`, `AddOnsService.getAddOnsByIds`, `PricingRulesService.getActivePricing` / `resolveEffectivePricing` (Tasks 2–4).
- Produces: `PriceLaundryOrderCommand.tenantId: string`; `GenerateInvoiceFromOrderCommand.tenantId: string`.

- [ ] **Step 1: Write the failing tests**

```ts
// bookings.service.spec.ts — arrange valid customer/property mocks as the existing create tests do
it('create looks up the service and its price within the command tenant', async () => {
  servicesService.getService.mockResolvedValue(null);
  await expect(service.create({ ...validCommand, tenantId: 't-b', serviceId: 's-a' })).rejects.toThrow(NotFoundException);
  expect(servicesService.getService).toHaveBeenCalledWith('s-a', 't-b');
  expect(pricingRulesService.getActivePricing).not.toHaveBeenCalled();
});

it('create reads the active price within the command tenant', async () => {
  servicesService.getService.mockResolvedValue({ id: 's-a', tenantId: 't-a', active: true });
  pricingRulesService.getActivePricing.mockResolvedValue(null);
  await expect(service.create({ ...validCommand, tenantId: 't-a', serviceId: 's-a' })).rejects.toThrow(BadRequestException);
  expect(pricingRulesService.getActivePricing).toHaveBeenCalledWith('s-a', 't-a');
});

// laundry-orders.service.spec.ts — arrange a WEIGHED order as the existing price tests do
it('price resolves every line’s effective pricing within the command tenant', async () => {
  pricingRulesService.resolveEffectivePricing.mockResolvedValue(perKgRule);
  await service.price({ ...validPriceCommand, tenantId: 't-a', addOns: [{ addOnId: 'ao-a' }] });
  expect(pricingRulesService.resolveEffectivePricing).toHaveBeenCalledWith({ serviceId: validPriceCommand.baseServiceId }, expect.any(Date), 't-a');
  expect(pricingRulesService.resolveEffectivePricing).toHaveBeenCalledWith({ addOnId: 'ao-a' }, expect.any(Date), 't-a');
});

it('price with another tenant’s service finds no rule and keeps the existing 400', async () => {
  pricingRulesService.resolveEffectivePricing.mockResolvedValue(null);
  await expect(service.price({ ...validPriceCommand, tenantId: 't-b' })).rejects.toThrow(BadRequestException);
});

// laundry-order.resolver.spec.ts
it('priceLaundryOrder passes requireTenantId(principal)', async () => {
  laundryOrdersService.price.mockResolvedValue(makeOrder());
  await resolver.priceLaundryOrder({ orderId: 'o-1', baseServiceId: 's-a', addOns: [] } as never, principal);
  expect(laundryOrdersService.price).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u', tenantId: 't-a' }));
});
it('priceLaundryOrder with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(
    resolver.priceLaundryOrder({ orderId: 'o-1', baseServiceId: 's-a', addOns: [] } as never, noTenant),
  ).rejects.toThrow(ForbiddenException);
  expect(laundryOrdersService.price).not.toHaveBeenCalled();
});

// invoices.service.spec.ts — arrange an eligible priced order with one service line and one add-on line
it('generateFromOrder resolves line names within the command tenant', async () => {
  await service.generateFromOrder({ actorId: 'u', tenantId: 't-a', laundryOrderId: 'o-1', paymentTerms: InvoicePaymentTerms.PAY_NOW });
  expect(servicesService.getServicesByIds).toHaveBeenCalledWith(['s-a'], 't-a');
  expect(addOnsService.getAddOnsByIds).toHaveBeenCalledWith(['ao-a'], 't-a');
});
it('generateFromOrder with a line whose service is in another tenant keeps the existing 400', async () => {
  servicesService.getServicesByIds.mockResolvedValue([]);
  await expect(
    service.generateFromOrder({ actorId: 'u', tenantId: 't-b', laundryOrderId: 'o-1', paymentTerms: InvoicePaymentTerms.PAY_NOW }),
  ).rejects.toThrow(new BadRequestException('Service s-a could not be resolved'));
});

// invoice.resolver.spec.ts
it('generateInvoiceFromOrder passes requireTenantId(principal)', async () => {
  invoicesService.generateFromOrder.mockResolvedValue(makeInvoice());
  await resolver.generateInvoiceFromOrder({ laundryOrderId: 'o-1', paymentTerms: InvoicePaymentTerms.PAY_NOW } as never, principal);
  expect(invoicesService.generateFromOrder).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u', tenantId: 't-a' }));
});
it('generateInvoiceFromOrder with a tenant-less principal is Forbidden before the service is called', async () => {
  await expect(
    resolver.generateInvoiceFromOrder({ laundryOrderId: 'o-1', paymentTerms: InvoicePaymentTerms.PAY_NOW } as never, noTenant),
  ).rejects.toThrow(ForbiddenException);
  expect(invoicesService.generateFromOrder).not.toHaveBeenCalled();
});
```

(`validCommand`, `validPriceCommand`, `perKgRule`, `makeOrder`, `makeInvoice` are the specs' existing fixtures, or small local ones built from the existing tests' arrange blocks. `principal` / `noTenant` as in Task 5. Match the exact `BadRequestException` message the existing code emits for a missing service line.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- bookings laundry billing invoice` → FAIL.

- [ ] **Step 3: Implement**

- `BookingsService` create validation: confirm `getService(command.serviceId, command.tenantId)` and `getActivePricing(command.serviceId, command.tenantId)` (wired in Tasks 2/4). Comment: application-level same-tenant check now; `fk_booking_service` stays id-only until #85. REST `POST /bookings` passes `tenantId: null` (#82) and fails closed on the customer lookup first.
- `PriceLaundryOrderCommand`: add `tenantId: string;` with a comment: the principal's tenant (`requireTenantId`); used only for the catalog pricing lookups — `laundry_order_entity` has no `tenantId` until #87.
- `LaundryOrdersService.price`: `resolveEffectivePricing(…, asOf, command.tenantId)`. Comment: another tenant's service / add-on has no rule in this tenant ⇒ the existing 400; `fk_laundry_order_line_service` / `_add_on` stay id-only until #87.
- `LaundryOrderResolver.priceLaundryOrder`: `this.service.price({ ...input, actorId: user.id, tenantId: requireTenantId(user) })`.
- `GenerateInvoiceFromOrderCommand`: add `tenantId: string;` with the matching comment (catalog name resolution only; `invoice_entity` has no `tenantId` until #87).
- `InvoicesService.generateFromOrder`: `this.buildLinePayloads(order.lines, command.tenantId)`; `buildLinePayloads(lines, tenantId: string)` passes `tenantId` to `getServicesByIds` / `getAddOnsByIds`.
- `InvoiceResolver.generateInvoiceFromOrder`: `{ ...input, actorId: user.id, tenantId: requireTenantId(user) }`.
- Seed: `bookingFixtureService = { id: …, tenantId: BOOTSTRAP_TENANT_ID, … }` (import from `platform/database/bootstrap-tenant`, as `bookingFixtureTeam` does).
- Replace the remaining `// #84 Task 6` markers.

- [ ] **Step 4: Run** — PASS (`pnpm --filter api test`), `pnpm --filter api build` PASS.
- [ ] **Step 5: Commit** — `feat(84): look up catalog in the caller tenant from bookings, laundry and billing`

---

### Task 7: Existing e2e fixtures and cleanup helper

**Spec:** §4.4 (required `tenantId`); verification only — no product change.

**Files:**
- Modify: `apps/api/test/helpers/seed-tenant-admin.ts` (`removeTestTenants`)
- Modify (as needed to compile/pass): every spec from `grep -rln -E "createService|createAddOn|createPricingRule|ServiceEntity|AddOnEntity|PricingRuleEntity|service_entity|add_on_entity|pricing_rule_entity|ServicesService|AddOnsService|PricingRulesService|\.price\(|generateFromOrder" test` — at planning time: `app.e2e-spec.ts`, `billing.e2e-spec.ts`, `billing.service.e2e-spec.ts`, `bookings.e2e-spec.ts`, `bookings-rest.e2e-spec.ts`, `bookings.service.e2e-spec.ts`, `catalog.e2e-spec.ts`, `catalog.service.e2e-spec.ts`, `customers-properties.service.e2e-spec.ts`, `customers-properties.tenant-isolation.e2e-spec.ts`, `jobs.e2e-spec.ts`, `jobs.service.e2e-spec.ts`, `laundry.e2e-spec.ts`, `laundry.service.e2e-spec.ts`, `property-bookings.e2e-spec.ts`, `teams-cleaners.tenant-isolation.e2e-spec.ts`

- [ ] **Step 1: Run the e2e suite to see the breakage** — `pnpm --filter api test:e2e` → FAIL (NOT NULL `tenantId`, changed service signatures).

- [ ] **Step 2: Fix fixtures**
  - Service calls gain `tenantId`. Where tenancy is incidental, use `BOOTSTRAP_TENANT_ID` and log in as a bootstrap-tenant admin (the existing `seed-owner` / `seedTenantAdmin` defaults), so GraphQL reads through `@Authorize` see the rows.
  - Direct repository inserts / raw SQL into `service_entity`, `add_on_entity`, `pricing_rule_entity` gain `tenantId`.
  - **The two existing tenant-isolation suites** (`customers-properties.tenant-isolation`, `teams-cleaners.tenant-isolation`) create one bootstrap-owned "bookable service + price" shared across their test tenants (their comments say "Catalog is not tenant-owned yet (#84)"). After this slice a tenant-B `createBooking` with that service ⇒ 404. Give each test tenant its own service + price created with that tenant's id, pass the matching one in each tenant's booking fixtures/mutations, and replace the "#84" comment. Do not change what those suites assert.
  - Service / add-on names stay unique per run where the spec already randomizes them; do not add randomization where a test asserts on a fixed value.
  - Assertions that relied on global uniqueness ("same name in any context ⇒ 409") move to "same tenant ⇒ 409"; cross-tenant cases belong to Task 8.
- [ ] **Step 3: Extend `removeTestTenants`** — after the `team_entity` delete and before deleting admins, delete `pricing_rule_entity`, then `service_entity` and `add_on_entity` rows `WHERE "tenantId" = ANY($1)` (pricing rules first — `fk_pricing_rule_*_tenant` is `ON DELETE RESTRICT`). Update its comment: callers whose tests insert a Booking / LaundryOrderLine referencing a test tenant's service or add-on MUST delete those first (`fk_booking_service`, `fk_laundry_order_line_service`, `fk_laundry_order_line_add_on` are `ON DELETE RESTRICT`).
- [ ] **Step 4: Run** — `pnpm --filter api test:e2e` → PASS, except failures recorded as pre-existing on `main` (record their names in the task report; any other failure blocks).
- [ ] **Step 5: Commit** — `test(84): give catalog fixtures a tenant`

---

### Task 8: Two-tenant isolation e2e + final gate

**Spec:** §4.2, §4.4, §4.5, §4.6, §4.9; Review Focus 1–5; Slice decisions 8, 9.

**Files:**
- Create: `apps/api/test/catalog.tenant-isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: everything above; helpers `createTestTenant`, `seedTenantAdmin`, `removeTestTenants`, `uniqueEmail`; login/`gql` helpers copied from `teams-cleaners.tenant-isolation.e2e-spec.ts` (that file keeps its own copies — do not extract a shared helper in this slice); `catalog-db-test-lock.ts` if the existing catalog e2e files take it.

- [ ] **Step 1: Write the suite** (it should pass immediately if Tasks 1–7 are right; to prove it can fail, temporarily remove `@Authorize` from `ServiceType` locally and confirm the list/filter cases fail, then restore — record the count in the task report, #82/#83 precedent)

Setup (`beforeAll`): two test tenants A and B; a `TENANT_OWNER` for each, logged in (`cookieA`, `cookieB`). Via services as each tenant: `serviceA` (`Deep ${run}`) with an active price (`createPricingRule`, `serviceId`), `addOnA` (`Fridge ${run}`) with a price (`addOnId`), `serviceB`, `addOnB` likewise. Customer + property per tenant (as in #83's suite). A booking row as A (via `BookingsService.create` with A's tenant/customer/property/`serviceA`). A laundry order as A received and weighed through `LaundryOrdersService` with A's tenant (existing `laundry.service.e2e` flow), left `WEIGHED` for the cross-tenant price case; a second A laundry order priced with `serviceA` + `addOnA` for the invoice case. `afterAll`: delete invoices, laundry orders (lines cascade or delete explicitly), bookings, then `removeTestTenants([tenantA, tenantB])`.

Cases (each `it` asserts `response.body.errors` explicitly):

1. **List + count scoped:** as B, `services(paging: { limit: 50 }) { totalCount nodes { id } }` and `addOns(...)` include B's ids and exclude A's.
2. **Widening filter (Review Focus 3):** as B, `services(filter: { id: { eq: serviceA.id } }) { totalCount nodes { id } }` ⇒ `nodes: []`, `totalCount: 0`; `services(filter: { name: { eq: serviceA.name } })` ⇒ same; `addOns(filter: { name: { eq: addOnA.name } })` ⇒ same.
3. **Get-by-id / active pricing:** as B, `service(id: serviceA.id)` ⇒ `null` (no errors, no 403); `activePricing(serviceId: serviceA.id)` ⇒ `errors[0].extensions.status === 404`; as A ⇒ A's rule.
4. **Loader (Review Focus 4):** as A, `services(filter: { id: { in: [serviceA.id] } }) { nodes { activePricing { id priceMinorUnits } } }` ⇒ A's rule; as B the same query ⇒ `nodes: []`; as B `service(id: serviceB.id) { activePricing { id } }` ⇒ B's rule.
5. **Interim residual-exposure guard — expected to be removed/replaced by #85.** Do not treat the exact GraphQL error text as a stable API contract; the only property this case protects is "no data from A's service reaches B". Put it in its own `describe('interim residual-exposure guard (remove/replace in #85)')` with a comment saying the same. As B, `bookings(filter: { id: { eq: bookingA.id } }) { nodes { service { id } } }` ⇒ `errors[0].message` matches `/Cannot return null for non-nullable field Booking\.service/` and no `serviceA.id` appears anywhere in the response body (#82 precedent; #85 makes the booking invisible instead).
6. **Cross-tenant catalog writes ⇒ 404 (not 403), no side effects (Review Focus 2):** as B — `updateService(id: serviceA.id, input: { name: "X" })`; `updateAddOn(id: addOnA.id, input: { name: "X" })`; `createPricingRule(input: { serviceId: serviceA.id, priceMinorUnits: 1 })`; `createPricingRule(input: { addOnId: addOnA.id, priceMinorUnits: 1 })`. Each ⇒ `errors[0].extensions.status === 404`. Then as A: `serviceA` / `addOnA` names unchanged; `activePricing(serviceId: serviceA.id)` still returns A's original rule id; `SELECT count(*) FROM pricing_rule_entity WHERE "serviceId" = $1 AND "effectiveTo" IS NULL` for `serviceA` is `1` and it is A's original rule.
7. **Cross-module catalog lookups:** as B — `createBooking` with B's customer/property and `serviceId: serviceA.id` ⇒ 404; `priceLaundryOrder` on a B-tenant weighed order (create one for B in setup) with `baseServiceId: serviceA.id` ⇒ 400 `No effective price for serviceId …`; with `baseServiceId: serviceB.id, addOns: [{ addOnId: addOnA.id }]` ⇒ 400 `No effective price for addOnId …`. As B, `generateInvoiceFromOrder` on A's priced laundry order ⇒ 400 `Service … could not be resolved` (the laundry order itself is unscoped until #87; the catalog name lookup is tenant-scoped). As A the same generate ⇒ succeeds (proves the positive path).
8. **Uniqueness (Review Focus 1):** as A `createService(name: "Shared ${run}")` and as B `createService(name: "shared ${run}")` ⇒ both succeed; as A `createService(name: "SHARED ${run}")` ⇒ 409 `Service name is already in use`; as A `updateService(serviceA, name: "shared ${run}")` ⇒ 409. Same for `createAddOn` ⇒ 409 `Add-on name is already in use`.
9. **Audit:** after A's `createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`, the `audit_event` rows for those entity ids have `tenantId = tenantA` and `scope = 'TENANT'`.
10. **Database backstop:** `dataSource.query(`INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`, [serviceA.id, tenantB])` rejects with constraint `fk_pricing_rule_service_tenant`; the add-on equivalent rejects with `fk_pricing_rule_add_on_tenant`. (Closed, inactive interval so the immediately-checked open/active partial unique indexes cannot fire first and mask the FK.)
11. **PricingRule surface inventory (Slice decision 8):** introspect `__schema { queryType { fields { name type { name ofType { name } } } } }` and `__type(name: "Service") { fields { name type { name } } }`: the only `Query` field whose (unwrapped) type is `PricingRule` is `activePricing`; the only `Service` field of type `PricingRule` is `activePricing`; there is no `pricingRules` query and no `PricingRuleConnection` / `PricingRuleOffsetConnection` type (`__type(name: …)` ⇒ `null`).

- [ ] **Step 2: Run** — `pnpm --filter api test:e2e -- catalog.tenant-isolation` → PASS.
- [ ] **Step 3: Final gate**

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
# fresh database: create an empty DB, point DB_NAME at it, then
pnpm --filter api migration:run
grep -rn "// #84 Task" apps/api/src apps/api/test   # expect no output
git diff --stat main -- apps/web packages           # expect no output
```

Also confirm the generated GraphQL schema and `@clensy/client` are unchanged.

- [ ] **Step 4: Commit** — `test(84): add two-tenant catalog isolation e2e`

---

## Traceability

| Task | RFC section(s) | Slice decision(s) |
| --- | --- | --- |
| 1 Schema + migration | §4.4 uniqueness/references, §4.5 DB constraints, §4.7 | 1, 2, 5 |
| 2 `ServicesService` | §4.4, §4.5, §4.6 | 3, 4, 6, 10, 11 |
| 3 `AddOnsService` | §4.4, §4.5, §4.6 | 3, 4, 6, 10, 11 |
| 4 `PricingRulesService` | §4.4 references, §4.5, §4.6 | 4, 5, 6, 10 |
| 5 GraphQL + loader | §4.2, §4.5 (loaders/relations share the predicate) | 4, 7, 8 |
| 6 Bookings / Laundry / Billing / seed | §4.4 references, §4.5 | 9 |
| 7 Fixtures | §4.4 (required `tenantId`) | — |
| 8 Isolation e2e | §4.2, §4.4–§4.6, §4.9 | all |

## Execution risks

- **Coupled suite:** e2e is red from Task 1 until Task 7 (see TDD strategy). Do not merge an intermediate state.
- **Expression-index conflict name:** Postgres reports a unique-**index** violation's name in `driverError.constraint` (as #82's `uq_customer_tenant_email` expression index proved). Task 8 case 8 exercises the race-window path only indirectly (the pre-check fires first); Task 1's migration e2e proves the name on real Postgres.
- **`@CurrentUser()` on field resolvers:** relies on `req.user` set by the parent operation's `AuthGuard`; both uses tolerate `undefined` (`currentUser?.tenantId ?? null`). Task 8 case 4 proves it end-to-end.
- **Laundry/billing e2e fixtures are the largest Task 7 surface** (they create catalog rows, price orders and generate invoices). Budget for it; do not weaken their assertions.
- **Operational:** local dev databases behind `main` need #68's, #82's and #83's migrations first; this migration asserts the bootstrap tenant and aborts cleanly otherwise.
