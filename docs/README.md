# docs

Product and architecture decisions live next to the work they govern.

| Area | Path |
| --- | --- |
| Architecture / product RFCs | [`superpowers/specs/`](superpowers/specs/) |
| Implementation plans | [`superpowers/plans/`](superpowers/plans/) |
| Engineering workflow (M1–M10) | [`workflows/`](workflows/) |

## Paginated GraphQL collections (#33)

Shipped in this slice. Offset connections (default 20 / max 100, clamp), `totalCount` on root Query collections only, nested connections without `totalCount`.

- Spec (Accepted): [2026-08-28-paginated-graphql-collections-design.md](superpowers/specs/2026-08-28-paginated-graphql-collections-design.md)
- Plan (Accepted): [2026-08-28-paginated-graphql-collections-plan.md](superpowers/plans/2026-08-28-paginated-graphql-collections-plan.md)

## Tenant identity foundation (#68)

Shipped in this slice (PR [#93](https://github.com/rexescario-dev/clensy-platform/pull/93)). This is the first delivery slice of the multi-tenant architecture. It adds a `Tenant` entity with one migration-created bootstrap tenant, an explicit `AdminScope` (`PLATFORM` | `TENANT`), and the roles `SUPER_ADMIN` and `TENANT_OWNER` (`OWNER` is retired by explicit per-account designation). The DB-authoritative principal is `{ id, role, scope, tenantId }`. Staff create/list/disable are limited to the Tenant Owner's own tenant, and `currentAdmin`/`admins`/`login` expose `scope` and `tenantId`. Business data (customers, bookings, catalog, …) is **not** tenant-scoped yet; that comes in later slices.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-23-tenant-identity-foundation-plan.md](superpowers/plans/2026-09-23-tenant-identity-foundation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md) (OWNER designation, irreversible)

## Customer & Property tenant isolation (#82)

Shipped in this slice (PR [#95](https://github.com/rexescario-dev/clensy-platform/pull/95)). Customer and Property are now tenant-owned:
- Both tables have a required `tenantId`.
- Customer emails are unique per tenant, ignoring case. A duplicate returns `Conflict`.
- A composite FK makes every property belong to a customer of the same tenant.

Every Customer/Property read and write uses the tenant of the logged-in user. That covers the services, the `customers`, `customerProperties`, `customer` and `property` queries, the create and update mutations, and the `customer`/`property` relations on Booking, Invoice and LaundryOrder. Another tenant's row behaves exactly like a missing one: null, NotFound, or an empty connection, never 403. Bookings and Laundry look customers up within the caller's tenant. The unauthenticated REST `POST /bookings` now fails with 404; its GET, PATCH and DELETE are unchanged. Booking, Invoice, LaundryOrder and the catalog are **not** tenant-scoped yet; that comes in later slices (#83–#87).

**Interim gap resolved:** relation filters on Booking, Invoice and LaundryOrder are tenant-scoped since #85 and #87 (their types carry the tenant read authorizer). See "Tenant-aware audit & security sweep (#90)" below for the current state.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-24-customer-property-tenant-isolation-plan.md](superpowers/plans/2026-09-24-customer-property-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md). The migration refuses to run if customers share an email.

## Teams & Cleaners tenant isolation (#83)

Shipped in this slice (PR [#96](https://github.com/rexescario-dev/clensy-platform/pull/96)). Team and Cleaner are now tenant-owned:
- Both tables have a required `tenantId`.
- Team names and cleaner emails are unique per tenant, case-sensitive. A duplicate returns `Conflict` (409) with the same messages as before.
- A composite FK keeps a cleaner's team in the same tenant.

Every Team/Cleaner read and write uses the tenant of the logged-in user. That covers the services, the `teams`/`cleaners` lists and counts, the `team`/`cleaner` queries, the four mutations (`createTeam`, `createCleaner`, `updateCleaner`, `assignCleanerToTeam`), and the `Team.cleaners`, `Cleaner.team`, `CleaningJob.team` and `Booking.team` relations. Another tenant's row behaves exactly like a missing one: null, NotFound, or empty, never 403. Bookings and Jobs look teams up within the caller's tenant. The unauthenticated REST `PATCH /bookings/:id` with a `teamId` now fails with 404 (`POST` was already 404 since #82); `GET`/`DELETE` and `PATCH` without a `teamId` are unchanged.

**Interim gap resolved:** `Booking.team` filters are tenant-scoped (#85), and the booking and job team foreign keys are tenant-aware composites (`fk_booking_team_tenant`, `fk_cleaning_job_team_tenant`; #85, #86).

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-27-teams-cleaners-tenant-isolation-plan.md](superpowers/plans/2026-09-27-teams-cleaners-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md). The migration needs no duplicate pre-check: the global uniques it replaces already rule out duplicates within one tenant.

## Catalog tenant isolation (#84)

Shipped in this slice (PR [#97](https://github.com/rexescario-dev/clensy-platform/pull/97)). Service, AddOn and PricingRule are now tenant-owned:
- All three tables have a required `tenantId`.
- Service and add-on names are unique per tenant, ignoring case. A duplicate returns `Conflict` (409) with the same messages as before (`Service name is already in use`, `Add-on name is already in use`).
- Composite FKs keep a pricing rule's service/add-on target in the same tenant as the rule.

Every Catalog read and write uses the tenant of the logged-in user. That covers the services, the `services`/`addOns` lists and counts, the `service` and `activePricing(serviceId)` queries, `Service.activePricing`, the five mutations (`createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`), and the `Booking.service` relation. Another tenant's row behaves exactly like a missing one: null, NotFound, or empty, never 403 — laundry pricing and invoice generation keep their existing 400s for a catalog row that can't be resolved in the caller's tenant. Bookings, laundry pricing and invoice generation now look catalog rows up within the caller's tenant.

**Interim gap resolved:** laundry order lines reference services and add-ons through tenant-aware composite foreign keys (`fk_laundry_order_line_service_tenant`, `fk_laundry_order_line_add_on_tenant`), and laundry orders are tenant-scoped (#87), so a tenant can no longer price another tenant's order.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-28-catalog-tenant-isolation-plan.md](superpowers/plans/2026-09-28-catalog-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md). The migration needs no duplicate pre-check: the global uniques it replaces already rule out duplicates within one tenant.

## Booking tenant isolation (#85)

Shipped in this slice (PR [#98](https://github.com/rexescario-dev/clensy-platform/pull/98)). Booking is tenant-owned: a required `tenantId`, composite FKs keep a booking's customer, property, service and team (when set) in the booking's tenant, and `uq_booking_id_tenant` is the FK target #86 will use.

Every Booking read and write uses the tenant of the logged-in user. That covers the `bookings` list/count (including relation filters on customer/property/service/team), the `booking(id)` query, the `createBooking`/`updateBooking`/`removeBooking` mutations, `Property.bookings`, `CleaningJob.booking`, and `createJobFromBooking`'s booking lookup. Another tenant's booking behaves exactly like a missing one — the existing not-found error or an empty list — never 403.

REST `/bookings` (kept for the REST/GraphQL comparison) now requires the session cookie and uses the same roles as GraphQL (reads: all tenant roles; writes: Tenant Owner, Ops Manager, Scheduler, Customer Support), takes the tenant from the logged-in user, writes the same audit events as GraphQL, and returns the same response shape as before. Unauthenticated requests get 401; a wrong role, or Super Admin, gets 403; a `tenantId` in the body gets 400. `AuthGuard` and `@CurrentUser()` now support HTTP routes as well as GraphQL.

GraphQL now runs interceptors on field resolvers (`fieldResolverEnhancers: ['interceptors']`) so nestjs-query relation tenant filters always apply — this fixed a cross-tenant read through `job(id) { booking }` and also tightens `Invoice.customer`, `LaundryOrder.customer` and `Property.bookings` when reached from custom queries.

**Interim gap resolved:** cleaning jobs are tenant-scoped (#86), which closes the cross-tenant job listing, the `jobs(filter: { booking: … })` oracle and the shared-authorizer fail-open path. Booking audit events are tenant-tagged since #90.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-28-booking-tenant-isolation-plan.md](superpowers/plans/2026-09-28-booking-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md).

## Tenant-aware audit & security sweep (#90)

Shipped in this slice (PR [#107](https://github.com/rexescario-dev/clensy-platform/pull/107)). Every audit event now records a scope that matches its principal. `AuditLogEvent` is a union of tenant (`TENANT` + tenant id), platform (`PLATFORM` + no tenant) and anonymous (no actor, scope or tenant; failed login only) events. The TypeScript compiler checks that shape when `tsc --noEmit` runs (CI does not run it yet). The `tenantAuditTags` / `principalAuditTags` helpers validate the values at runtime, and the `ck_audit_event_scope_tenant` CHECK stays as the last safeguard. Booking create/update/remove events, through GraphQL and REST, are now tagged with the caller's tenant like every other module. A login whose stored scope and tenant disagree is refused instead of producing a session.

**No audit backfill.** The feature has not been published and there is no real production data (the repository has no releases or deployments), so events recorded before #90 are left as they are (no scope or tenant) and no migration rewrites audit history.

**Sweep result.** The planning-time sweep identified no additional tenant-filtering gap within the reviewed surfaces: services and query builders, loaders, REST `/bookings`, and every nestjs-query read resolver, relation and custom object field. Two guard suites now check that metadata on every e2e run:
- `root-operation-authorization` classifies every root query and mutation as public, authenticated-only, or tenant with roles that exclude Super Admin.
- `tenant-read-authorizers` requires every nestjs-query read resolver, read surface, object field and tenant-owned entity to be tenant-scoped or explicitly allowlisted with a reason.

These suites are metadata checks that complement, not replace, the per-module two-tenant isolation tests. Since [#135](https://github.com/rexescario-dev/clensy-platform/issues/135), CI's **API e2e** job runs them, along with every other API e2e suite except the release gate, on every pull request and push to `main`. #135 also classified the two object fields #118 added (`CurrentAdmin.tenantLabelOverrides`, `TenantLabelOverrides.roles`) in the `tenant-read-authorizers` allowlist.

**Relation-field authorization ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106)).** The root operation is the unit of role authorization (RFC §4.2, relation-field rules). A relation field is authorized by the root query or mutation that reaches it, not by the target type's root roles. For example, Finance can read `invoice { customer }` because `invoice` admits Finance, while `customers` stays `Forbidden` to Finance. Every relation still applies the principal's tenant predicate. Relation fields declare no relation-level guards or `@Roles()`. Adding a relation is an authorization-policy review, because it changes what the reaching root operations return. `apps/api/test/relation-field-authorization.e2e-spec.ts` pins this, including a metadata guard against relation-level guards and `@Roles()`. Since #135 the guard reads metadata the way the runtime applies it: on the method, or on the resolver class, including metadata inherited from a base class. It also fails on a typed resolver whose type is not a schema object type, and it never invokes a getter.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-10-01-tenant-aware-audit-security-sweep-plan.md](superpowers/plans/2026-10-01-tenant-aware-audit-security-sweep-plan.md)
- Plan (Accepted, #135): [2026-10-06-tenant-read-sweep-and-guard-hardening-plan.md](superpowers/plans/2026-10-06-tenant-read-sweep-and-guard-hardening-plan.md)

## Legacy REST & surface cleanup (#91)

REST `/bookings` stays as the REST/GraphQL comparison surface. It is authenticated with the same session cookie, roles and tenant scope as GraphQL (#85), which resolves the RFC §10 "delete or rebuild" question: kept, authenticated, tenant-scoped. A new e2e guard (`apps/api/test/http-route-authorization.e2e-spec.ts`) checks every controller route on each run. The routes Nest declares must match the routes Express serves exactly. Each route must be listed in an exact classification table. Tenant routes must use `AuthGuard` with GraphQL's own view or write role set, which never includes Super Admin. Every tenant route must return 401 without a session. The only public route is GraphiQL, which is dev-only. The guard covers the controller routes `AppModule` registers. The Swagger routes are covered by their own suite. These are metadata and route-table checks; the two-tenant suites remain the runtime proof of isolation. REST cross-tenant references (another tenant's customer, property, service or team) are now pinned as 404 alongside the GraphQL cases.

Swagger (`/docs`, `/docs-json`, `/docs-yaml`) is now mounted only outside production, the same rule as GraphiQL. In production none of the three is served. Elsewhere they are unchanged and document the same REST paths and operations.

Removed: the unimplemented `apps/worker` placeholder and the empty legacy `packages/ui/src/domain/` directory. Domain composition lives in `@clensy/web`.
