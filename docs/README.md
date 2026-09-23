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
