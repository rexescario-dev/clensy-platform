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
