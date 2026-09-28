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

**Known interim gap:** relation *filters* on Booking, Invoice and LaundryOrder (for example `filter: { customer: { fullName: … } }`) are not tenant-scoped until #85/#87. Do not provision a second production tenant before those slices land.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-24-customer-property-tenant-isolation-plan.md](superpowers/plans/2026-09-24-customer-property-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md). The migration refuses to run if customers share an email.

## Teams & Cleaners tenant isolation (#83)

Shipped in this slice (PR [#96](https://github.com/rexescario-dev/clensy-platform/pull/96)). Team and Cleaner are now tenant-owned:
- Both tables have a required `tenantId`.
- Team names and cleaner emails are unique per tenant, case-sensitive. A duplicate returns `Conflict` (409) with the same messages as before.
- A composite FK keeps a cleaner's team in the same tenant.

Every Team/Cleaner read and write uses the tenant of the logged-in user. That covers the services, the `teams`/`cleaners` lists and counts, the `team`/`cleaner` queries, the four mutations (`createTeam`, `createCleaner`, `updateCleaner`, `assignCleanerToTeam`), and the `Team.cleaners`, `Cleaner.team`, `CleaningJob.team` and `Booking.team` relations. Another tenant's row behaves exactly like a missing one: null, NotFound, or empty, never 403. Bookings and Jobs look teams up within the caller's tenant. The unauthenticated REST `PATCH /bookings/:id` with a `teamId` now fails with 404 (`POST` was already 404 since #82); `GET`/`DELETE` and `PATCH` without a `teamId` are unchanged.

**Known interim gap:** `Booking.team` relation *filters* are not tenant-scoped, and the `booking`/`job` team foreign keys stay id-only, until #85/#86. Do not provision a second production tenant before those slices land.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-27-teams-cleaners-tenant-isolation-plan.md](superpowers/plans/2026-09-27-teams-cleaners-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md). The migration needs no duplicate pre-check: the global uniques it replaces already rule out duplicates within one tenant.

## Catalog tenant isolation (#84)

Shipped in this slice (PR [#97](https://github.com/rexescario-dev/clensy-platform/pull/97)). Service, AddOn and PricingRule are now tenant-owned:
- All three tables have a required `tenantId`.
- Service and add-on names are unique per tenant, ignoring case. A duplicate returns `Conflict` (409) with the same messages as before (`Service name is already in use`, `Add-on name is already in use`).
- Composite FKs keep a pricing rule's service/add-on target in the same tenant as the rule.

Every Catalog read and write uses the tenant of the logged-in user. That covers the services, the `services`/`addOns` lists and counts, the `service` and `activePricing(serviceId)` queries, `Service.activePricing`, the five mutations (`createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`), and the `Booking.service` relation. Another tenant's row behaves exactly like a missing one: null, NotFound, or empty, never 403 — laundry pricing and invoice generation keep their existing 400s for a catalog row that can't be resolved in the caller's tenant. Bookings, laundry pricing and invoice generation now look catalog rows up within the caller's tenant.

**Known interim gap:** `fk_laundry_order_line_service` and `fk_laundry_order_line_add_on` stay id-only until #87. `fk_booking_service` and `Booking.service` relation *filters* are now tenant-scoped — see #85 below. Until #87, a tenant can price another tenant's unscoped laundry order with its own catalog rows (a cross-tenant line reference); the owner's subsequent invoice generation then fails with the existing 400. Do not provision a second production tenant before that slice lands.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-28-catalog-tenant-isolation-plan.md](superpowers/plans/2026-09-28-catalog-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md). The migration needs no duplicate pre-check: the global uniques it replaces already rule out duplicates within one tenant.

## Booking tenant isolation (#85)

Shipped in this slice (branch `feat/85-booking-tenant-isolation`). Booking is tenant-owned: a required `tenantId`, composite FKs keep a booking's customer, property, service and team (when set) in the booking's tenant, and `uq_booking_id_tenant` is the FK target #86 will use.

Every Booking read and write uses the tenant of the logged-in user. That covers the `bookings` list/count (including relation filters on customer/property/service/team), the `booking(id)` query, the `createBooking`/`updateBooking`/`removeBooking` mutations, `Property.bookings`, `CleaningJob.booking`, and `createJobFromBooking`'s booking lookup. Another tenant's booking behaves exactly like a missing one — the existing not-found error or an empty list — never 403.

REST `/bookings` (kept for the REST/GraphQL comparison) now requires the session cookie and uses the same roles as GraphQL (reads: all tenant roles; writes: Tenant Owner, Ops Manager, Scheduler, Customer Support), takes the tenant from the logged-in user, writes the same audit events as GraphQL, and returns the same response shape as before. Unauthenticated requests get 401; a wrong role, or Super Admin, gets 403; a `tenantId` in the body gets 400. `AuthGuard` and `@CurrentUser()` now support HTTP routes as well as GraphQL.

GraphQL now runs interceptors on field resolvers (`fieldResolverEnhancers: ['interceptors']`) so nestjs-query relation tenant filters always apply — this fixed a cross-tenant read through `job(id) { booking }` and also tightens `Invoice.customer`, `LaundryOrder.customer` and `Property.bookings` when reached from custom queries.

**Known interim gap (until #86):** cleaning jobs are not tenant-scoped yet, so a tenant can still list another tenant's job (selecting its `booking` returns an error, not the booking) and can use `jobs(filter: { booking: … })` as an oracle over another tenant's booking scalar fields; nestjs-query's shared per-request authorizer also has a theoretical fail-open window reachable only through that unscoped job root. Booking audit events are not tenant-tagged until #90. Do not provision a second production tenant before #86 and #87 land.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-09-28-booking-tenant-isolation-plan.md](superpowers/plans/2026-09-28-booking-tenant-isolation-plan.md)
- Migrating an existing database: see "Database migrations" in the [root README](../README.md).
