# Multi-Tenant Architecture — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product behavior and platform contracts, not a process specification) |
| **Date** | 2026-09-23 |
| **Tracking** | Delivered per slice. Identity slice: [#68](https://github.com/rexescario-dev/clensy-platform/issues/68) (PR [#93](https://github.com/rexescario-dev/clensy-platform/pull/93)). Remaining slices: [#82](https://github.com/rexescario-dev/clensy-platform/issues/82)–[#92](https://github.com/rexescario-dev/clensy-platform/issues/92) under program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| **Depends on (Accepted)** | [Admin Foundation](2026-08-14-admin-foundation-design.md) — **constrains**: §2 out-of-scope “Multi-tenancy of any kind”; §3 `AdminUser` / `Role` / `AuthenticatedPrincipal`; §4.1 JWT/principal; §4.2 `@Roles()`; §4.4–§4.5 staff lifecycle and Owner-only staff management; §4.7 `@CurrentUser()`; §4.9 `currentAdmin` / `admins`. Cookie JWT, `AuthGuard`, disabled-account rejection, and login indistinguishability are **relied upon**, not redesigned. [nestjs-query GraphQL Reads](2026-08-28-nestjs-query-graphql-reads-design.md) — **constrains** the Phase 1 “no row-level / tenant authorizers” deferral: tenant isolation becomes mandatory on GraphQL reads (see §4.5). RBAC via `AuthGuard` + `@Roles()` remains. [Paginated GraphQL Collections](2026-08-28-paginated-graphql-collections-design.md) — **constrains** the same authorizer deferral; offset paging, max page size, and default sorts are **relied upon**. [Customers & Properties](2026-08-15-customers-properties-design.md), [Bookings](2026-08-22-bookings-design.md), [Jobs & Checklists](2026-08-27-jobs-checklists-design.md), [Cleaners & Teams](2026-08-16-cleaners-teams-design.md), [Catalog](2026-08-16-catalog-design.md), [Laundry Catalog Foundation](2026-09-06-laundry-catalog-foundation-design.md), [Laundry Orders](2026-09-06-laundry-orders-lifecycle-design.md), [Laundry Invoices](2026-09-06-laundry-invoices-design.md) — **extends** each with tenant ownership and same-tenant reference rules; operational `@Roles()` matrices are **retained** with `OWNER` replaced as specified in §4.3. [`@clensy/ui` Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) and [`@clensy/web` Login Form](2026-09-19-clensy-web-login-form-design.md) — **relied upon** for the UI layering rule in §4.8. [Web Shell and Design System](2026-09-10-web-shell-and-design-system-design.md) — **relied upon** that shell is not an authorization boundary; this RFC does not redesign shell chrome. |
| **Followed by** | Implementation planning (M4) per delivery slice. A **separate** Accepted RFC is required before Super Admin may read or write tenant business data, manage tenants as a product API, or gain any bypass of §4.5. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | Pre-M3: same-tenant parent references require composite (or equivalent) FKs, not id-only FKs; invoice-number allocation must be concurrency-safe (format still deferred). |
| **M3 decision** | **Accepted** — 2026-09-23. No remaining architectural blocker. The two pre-review clarifications close M4 semantic gaps (same-tenant FK enforcement; invoice allocation under concurrency). Ready for M4 Implementation Planning per delivery slice. Implementation GitHub issues MAY be created from this Accepted RFC; they MUST NOT precede it. |

## 1. Primary question & thesis

**Question:** How does Clensy evolve from a single-namespace admin console into a multi-tenant SaaS **without** weakening backend isolation, silently reinterpreting `OWNER`, or introducing a parallel stack?

**Thesis:** Keep `AdminUser`, cookie JWT `{ sub }`, `AuthGuard` + `@Roles()`, TypeORM, GraphQL, and nestjs-query. Add `Tenant`, an **explicit** platform-vs-tenant **scope** on identity (not inferred from null `tenantId`), and `SUPER_ADMIN` / `TENANT_OWNER` alongside the existing operational tenant roles. Every current business resource is **tenant-owned**. Tenant context for authorization comes **only** from the principal loaded from the database. Application services, GraphQL reads (including nestjs-query), loaders, and mutations apply the same tenant predicate; the database enforces `tenantId` and composite uniqueness. PostgreSQL RLS is not part of this architecture. Super Admin has **no** implicit access to tenant business data.

## 2. Scope

### In scope (normative)

- Identity: keep `AdminUser`; add `Tenant`; explicit **scope** discriminator; nullable `tenantId` only for platform identities; no membership table; no rename to `User`.
- Roles: `SUPER_ADMIN` (platform-only), `TENANT_OWNER` (tenant-only), retain `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST`; retire `OWNER` only after explicit per-account designation (§4.3).
- Ownership: all listed business resources are tenant-owned; per-tenant uniqueness; same-tenant references (§4.4).
- Isolation: session-derived tenant context; application + GraphQL + loader enforcement; database constraints; cross-tenant not-found semantics; REST `/bookings` production rule (§4.5).
- Principal and `currentAdmin` contracts extended with scope and tenant id (§4.2).
- Staff management: `TENANT_OWNER` manages staff **of their tenant only**; last-active `TENANT_OWNER` per tenant cannot be disabled (§4.3).
- Audit: tenant-scoped events carry `tenantId`; platform events use explicit platform scope with `tenantId` null (§4.6).
- UI layering when a tenant-owned resource’s presentation is changed (§4.8).
- Migration **behavior** for existing data and `OWNER` accounts (§4.7) — not an execution plan.

### Informative

- Discovery that the current system is globally scoped (no `tenantId`, nestjs-query allow-all reads, unauthenticated REST `/bookings`) motivates this RFC; it is not restated as a second specification.
- Delivery slicing, GitHub issue breakdown, and deploy order are M4 / project-planning concerns, not this RFC.

### Out of scope (normative)

- Super Admin APIs to create/suspend tenants, impersonate, or read/write customers, bookings, catalog, jobs, laundry, or invoices — **deferred** to a future Accepted RFC. This RFC forbids an implicit bypass; it does not invent those capabilities.
- Membership tables, multi-tenant membership, tenant switching, tenant id or slug in URLs.
- Renaming `AdminUser` to `User`; customer-facing login; OAuth/SSO; refresh-token rotation.
- PostgreSQL row-level security.
- Subscriptions, plans, billing of tenants, custom branding.
- Collapsing operational roles into a single `Staff` role.
- Silently treating existing `OWNER` as Tenant Owner or as Super Admin.
- Treating `apps/web` middleware, navigation, or hidden UI as authorization.
- Redesigning offset pagination, booking URL `offset`, or default sorts.
- Extracting `packages/auth` (stub remains until a second consumer exists).
- Implementation sequencing, task lists, or production code.

## 3. Terminology

- **Tenant** — a customer organization of the SaaS. Has a stable id. This RFC does not require a public slug, status workflow, or self-serve creation API.
- **Scope** — an explicit identity property: `PLATFORM` or `TENANT`. MUST NOT be inferred from `tenantId` being null.
- **Super Admin** — an `AdminUser` with `scope = PLATFORM` and role `SUPER_ADMIN`. MUST NOT belong to a tenant (`tenantId` MUST be null).
- **Tenant Owner** — an `AdminUser` with `scope = TENANT` and role `TENANT_OWNER`. Belongs to exactly one tenant.
- **Staff** — product name for tenant-scoped operational users: roles `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST`. Each belongs to exactly one tenant.
- **AdminUser** — the only authenticatable identity (unchanged name). Customers remain CRM records, not logins.
- **AuthenticatedPrincipal** — `platform/auth` request identity: `{ id, role, scope, tenantId }` where `tenantId` is `string` for tenant principals and `null` for platform principals.
- **Tenant predicate** — the requirement that a row’s `tenantId` equals the principal’s `tenantId` for tenant-scoped operations.
- **Bootstrap tenant** — the single tenant to which existing business rows and designated `TENANT_OWNER` / staff accounts are attached when tenancy is introduced.
- **`OWNER`** — the current global staff-admin role. After designation and migration it MUST NOT remain in the role enum. It is **not** a synonym for Tenant Owner or Super Admin.

## 4. Contracts

### 4.1 Tenant and identity

- There is a `Tenant` entity with at least: `id` (UUID primary key), `name`, created/updated timestamps. Additional lifecycle fields are deferred.
- `AdminUser` is retained. Add: `scope` (`PLATFORM` | `TENANT`) and `tenantId` (UUID, nullable).
- Database MUST enforce:
  - `scope = PLATFORM` ⇒ `tenantId IS NULL` AND `role = SUPER_ADMIN`
  - `scope = TENANT` ⇒ `tenantId IS NOT NULL` AND `role ∈ { TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST }`
- Super Admin MUST NOT belong to a tenant. Tenant Owner and Staff belong to **exactly one** tenant. No membership table.
- `AdminUser.email` remains **globally** unique (stored lowercase, as today). Login stays `login(email, password)` with no tenant selector; a per-tenant unique staff email would make login ambiguous.
- JWT remains `{ sub }` (plus `iat` / `exp`). It MUST NOT carry `role`, `scope`, or `tenantId`. Every authenticated request reloads the active `AdminUser` and derives principal fields from the database (same disabled-account rule as Admin Foundation §4.1).
- `AuthenticatedPrincipal` MUST include `id`, `role`, `scope`, and `tenantId` (`null` only when `scope = PLATFORM`).
- GraphQL `currentAdmin` MUST expose `id`, `role`, `scope`, and `tenantId` (nullable). Clients MUST NOT infer Super Admin from `tenantId == null` alone; they MUST use `scope`.
- `packages/auth` is not introduced as a second auth implementation.

### 4.2 Authentication and authorization (RBAC)

- `AuthGuard` + `@Roles(...)` (OR list) remain the role gate. Tenant isolation is **additional**, not a replacement for RBAC.
- Public GraphQL operations remain `login` and `logout` unless a later Accepted spec adds others.
- A tenant principal MAY call a business operation only if **both** hold: (1) role is in that operation’s `@Roles()` list (or the operation is authenticated-only), and (2) the tenant predicate holds for every tenant-owned row read or written.
- A platform principal (`SUPER_ADMIN`) is **not** added to tenant business resolvers by this RFC (customers, properties, bookings, jobs, checklists, laundry, invoices, services, add-ons, pricing rules, teams, cleaners). Those operations therefore deny Super Admin the same way they deny any role not on `@Roles()` (`Forbidden`). Super Admin MUST NOT receive tenant business rows. A future Accepted RFC is required before Super Admin may be added to those resolvers or given a documented bypass of the tenant predicate. Role mismatch remains `Forbidden` (as today). Cross-tenant access by a **tenant** principal remains missing-row semantics (§4.5), not `403` used to disclose another tenant’s row.
- UI visibility MUST NOT be treated as authorization (Admin Foundation §4.8 / web shell).

### 4.3 Roles and staff lifecycle

The role enum after migration:

| Role | Allowed scope | Meaning |
| --- | --- | --- |
| `SUPER_ADMIN` | `PLATFORM` only | Platform administrator. Business-data APIs are out of scope for this RFC. |
| `TENANT_OWNER` | `TENANT` only | Administrator of one tenant (staff lifecycle for that tenant). |
| `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST` | `TENANT` only | Existing operational matrices, now tenant-scoped. |

- Do **not** keep or reuse the identifier `OWNER` after migration. Do **not** rename `OWNER` in place to mean Tenant Owner.
- Wherever an Accepted module spec’s `@Roles()` list includes `OWNER`, that slot is **replaced by `TENANT_OWNER`** for the tenant-scoped operation. Other roles on that list are unchanged. Super Admin is **not** added to those lists by this RFC.
- Staff create / list / disable (today Owner-only): callable by `TENANT_OWNER`, and only for `AdminUser` rows of **that** tenant. A Tenant Owner MUST NOT create `SUPER_ADMIN` or assign `scope = PLATFORM`. A Tenant Owner MUST NOT create or disable users of another tenant.
- Last-active-Owner lock becomes: the system MUST NOT disable the last active `TENANT_OWNER` **of that tenant**. Super Admin last-account rules are deferred with Super Admin APIs.
- Self-disable remains forbidden.
- Role remains assigned at creation; this RFC does not add a role-update operation.
- **Existing `OWNER` accounts:** each MUST be **explicitly designated** as either `TENANT_OWNER` of the bootstrap tenant or `SUPER_ADMIN`. Designation MUST NOT be inferred from the `OWNER` role. If any `OWNER` row lacks a designation, the migration MUST fail and MUST NOT proceed.

### 4.4 Resource ownership

All of the following are tenant-owned (required `tenantId`, same tenant as the acting tenant principal):

Customer, Property, Booking, CleaningJob, Checklist, LaundryOrder, Invoice, Service, AddOn, PricingRule, Team, Cleaner.

There is **no** platform-shared catalog or workforce in this RFC.

**Uniqueness (per tenant), in addition to existing non-tenant rules:**

| Resource | Constraint |
| --- | --- |
| Customer | unique `(tenantId, lower(email))` |
| Cleaner | unique `(tenantId, email)` (email remains stored uniquely as today, scoped by tenant) |
| Team | unique `(tenantId, name)` |
| Service | unique per tenant on case-insensitive `name` (replaces global `LOWER(name)` uniqueness) |
| AddOn | unique per tenant on case-insensitive `name` (same) |
| Invoice | unique `(tenantId, invoiceNumber)`; invoice-number **allocation** MUST be tenant-scoped (the global sequence MUST NOT remain the uniqueness or allocation mechanism), MUST be concurrency-safe for that tenant, and MUST NOT use a naive `MAX(invoiceNumber)+1` (or equivalent read-then-increment) that can duplicate numbers under concurrent generates |

Pricing-rule target XOR, partial unique active/open rules, `UQ_cleaning_job_booking_id`, and `uq_invoice_laundry_order` remain, and MUST be consistent with a single tenant (a booking/job/invoice cannot span tenants).

**References:** a tenant-owned row MAY only reference other tenant-owned rows of the **same** `tenantId` (booking → customer, property, service, team; laundry line → service or add-on; job → booking; invoice → laundry order and customer; property → customer; cleaner → team; pricing rule → service or add-on). Application validation and database constraints MUST both prevent cross-tenant references.

A single-column foreign key such as `booking.customerId → customer.id` does **not** by itself guarantee both rows share `tenantId`. Database enforcement MUST be **tenant-aware**: composite foreign keys (or an equivalent database constraint) that bind the child `(referencedId, tenantId)` to the parent `(id, tenantId)`, for example conceptually `(customerId, tenantId) → (customer.id, customer.tenantId)`. Independent FKs to `id` plus a separate FK to `Tenant` are **not** sufficient. Referenced parents MUST therefore expose a uniqueness constraint on `(id, tenantId)` (primary key on `id` remains); that uniqueness exists so the composite FK is valid, not as an extra product rule.

If a referenced resource is tenant-owned, a consumer resource MUST NOT be treated as isolated until those references are same-tenant-safe. Delivery order of slices is an M4 concern; this paragraph is an isolation completeness rule, not a task sequence.

`AdminUser` for tenant scope references `Tenant`. Super Admin does not.

### 4.5 Isolation architecture

- For tenant principals, tenant id used for authorization MUST come **exclusively** from `AuthenticatedPrincipal.tenantId` (database lookup). Client-supplied `tenantId` (GraphQL arguments, filters, headers, URL, body) is **never** an authorization input.
- GraphQL `filter` / `sorting` / paging MAY **narrow** or order rows **inside** the tenant. They MUST NOT expand visible tenant scope. A filter that omits `tenantId` still returns only the principal’s tenant. A filter that asserts another tenant MUST NOT return those rows (equivalent to no matching rows).
- The same tenant predicate MUST apply to: application services, nestjs-query QueryService / ReadResolver / Relatable paths, relation resolvers, batch loaders (including `getCustomersByIds` / `getBookingsByIds` and equivalents), and mutations.
- Tenant-owned tables MUST have required `tenantId`, indexes suitable for tenant-scoped list/get, a foreign key to `Tenant`, **tenant-aware** parent references as specified in §4.4 (composite FKs or equivalent — not independent id-only FKs), and the composite uniques in §4.4. **PostgreSQL RLS is not used** in this architecture.
- **Cross-tenant reads and mutations** (including get-by-id): behave as if the resource **does not exist** (`null` or `NotFoundException` according to that operation’s existing missing-row contract). They MUST NOT use `403 Forbidden` solely to signal “exists in another tenant” (existence disclosure). Role failure remains `Forbidden` as today.
- Super Admin has **no implicit tenant-data bypass**. Adding Super Admin to a business resolver or skipping the tenant predicate requires a **future Accepted RFC** that names those operations.
- REST `GET/POST/PATCH/DELETE /bookings` (current unauthenticated comparison surface) MUST NOT remain a production tenant surface. Until it uses the **same** cookie-JWT authentication and tenant isolation as GraphQL, it MUST be removed or clearly isolated as lab-only (not reachable as a production API). Leaving it unauthenticated after tenant data exists is forbidden.

### 4.6 Audit

- Tenant-scoped actions: `AuditEvent` MUST record `tenantId` equal to the principal’s tenant (and actor id as today).
- Platform Super Admin actions (when such APIs exist): `AuditEvent` MUST record explicit platform scope and `tenantId = null`. `tenantId` null MUST NOT be used as the only signal that an event is a platform event.
- Failed login remains `actorId` null; it has no tenant.
- Secrets still MUST NOT appear in `metadata` (Admin Foundation §4.6).
- Transactional vs best-effort audit rules from Admin Foundation remain.

### 4.7 Existing-data migration behavior

When tenant columns become required:

- Exactly one **bootstrap tenant** is created.
- All existing tenant-owned business rows are attached to that tenant **before** `tenantId` is made NOT NULL.
- Existing non-`OWNER` `AdminUser` rows become `scope = TENANT` on the bootstrap tenant, **keeping their operational role**.
- Existing `OWNER` rows are handled only via §4.3 designation (`TENANT_OWNER` on bootstrap tenant or `SUPER_ADMIN`). Undesignated `OWNER` ⇒ migration failure.
- `OWNER` is removed from the enum only after no `OWNER` rows remain.

This section states required outcomes. It does not order engineering tasks.

### 4.8 Presentation boundary

When a tenant-owned resource’s web UI is changed under this architecture:

- Generic primitives and composition stay in `@clensy/ui`.
- Domain components (tables, forms, detail views specific to that resource) belong in `@clensy/web`.
- `apps/web` routes compose those components, wire GraphQL, and handle routing. They MUST NOT become the home of new domain implementations for that resource.
- Do not add domain components to `packages/ui/src/domain/` (legacy).
- Shell, middleware, and navigation MAY later reflect `scope` / role for UX; they MUST NOT be the isolation mechanism.

A resource is not considered migrated under this RFC until **both** its security boundary (§4.5) and this presentation boundary hold for the surfaces that were changed.

### 4.9 Worked examples

**Tenant Staff fetches `customer(id)` for another tenant’s UUID.** Role is allowed. The service/query applies the tenant predicate, finds no row, returns `null` (existing nullable `customer` query) — not the foreign customer, not `403`.

**Tenant Staff lists `bookings` with a nestjs-query filter omitting tenant.** Result is only that tenant’s bookings.

**Tenant Owner calls `admins`.** Result is only that tenant’s `AdminUser` rows, not Super Admins and not other tenants.

**Super Admin calls `customers` under this RFC.** Not authorized to receive tenant customer data (not in the tenant business API). A future RFC would be required to change this.

**Booking create with another tenant’s `serviceId`.** Validation fails as not found / invalid reference (same-tenant rule), not as a successful cross-tenant attach.

## 5. Invariants (MUST / MUST NOT)

1. Tenant authorization context for tenant users MUST come from the authenticated principal. Client `tenantId` MUST NOT authorize.
2. Scope MUST be explicit. Super Admin MUST NOT be inferred from null `tenantId`. Super Admin MUST NOT have a tenant.
3. JWT MUST NOT be the source of role, scope, or tenant.
4. Tenant-owned rows MUST carry `tenantId`. Cross-tenant references MUST NOT persist. Database constraints MUST make same-tenant parent references hold (composite FKs or equivalent); id-only FKs alone MUST NOT be treated as sufficient.
5. Per-tenant invoice-number allocation MUST be concurrency-safe and MUST NOT permit duplicate numbers for that tenant. A unique constraint is required but not sufficient by itself if allocation is racy.
6. GraphQL filters MUST NOT widen tenant scope.
7. Loaders, services, nestjs-query, and mutations MUST share the tenant predicate.
8. Cross-tenant access MUST look like a missing resource, not a distinct “wrong tenant” disclosure.
9. `OWNER` MUST NOT be silently reinterpreted. Migration MUST fail if an `OWNER` is undesignated.
10. Super Admin MUST NOT implicitly bypass tenant business isolation.
11. REST `/bookings` MUST NOT stay an unauthenticated production API once tenant data exists.
12. PostgreSQL RLS MUST NOT be required by this RFC.
13. Navigation and middleware MUST NOT be the security boundary.
14. This RFC MUST NOT be implemented before M3 Accept and an Accepted M4 plan for the slice being built.

## 6. Goals and non-goals

**Goals**

- Multiple tenants can use one Clensy deployment without seeing each other’s data.
- Preserve current authentication mechanics and operational RBAC matrices, scoped to a tenant.
- Make isolation enforceable in API and database, not only in the UI.
- Keep the existing Next.js / NestJS / GraphQL / TypeORM / PostgreSQL stack.

**Non-goals**

- Super Admin control plane and Super Admin access to tenant business data.
- Multi-membership, tenant URLs, branding, tenant billing.
- RLS, new identity providers, customer login.
- A second design system or domain components in `@clensy/ui`.

## 7. Rationale

- **Keep `AdminUser` and `{ sub }` JWT:** login, cookie session, and per-request DB lookup already match Admin Foundation; putting tenant in the token would recreate the stale-permission problem the project already rejected for role.
- **Explicit scope:** `tenantId` null is a storage convenience for platform rows; using it as the Super Admin test would confuse “unset during migration” with “platform identity.”
- **No membership table:** product is exactly-one-tenant for Owner/Staff; a join table would imply switching that this RFC forbids.
- **Additive roles:** laundry, jobs, catalog, and invoices already encode six operational roles; collapsing to three Staff buckets would discard Accepted matrices. Reusing `OWNER` as Tenant Owner would grant today’s global staff-admin meaning to tenant operators or, worse, map every Owner to Super Admin.
- **Fail migration on undesignated `OWNER`:** privilege direction cannot be guessed.
- **All business resources tenant-owned:** independent operators do not share services, prices, or cleaners; global unique names/emails would collide on the second tenant; Booking/Laundry FKs would otherwise attach tenant customers to a shared catalog.
- **Global unique `AdminUser.email`:** login has no tenant picker.
- **Application filters + DB constraints, no RLS:** every access path already goes through TypeORM/nestjs-query; RLS is easy to skip and is not needed to state the contract. Id-only FKs cannot express “same tenant as parent”; tenant-aware composite FKs (or equivalent) catch reference bugs the application might miss.
- **Concurrency-safe invoice allocation:** uniqueness alone does not prevent two concurrent generates from choosing the same next number; allocation MUST be safe under concurrency (format remains deferred).
- **Not-found vs 403:** avoids confirming that a UUID exists in another tenant.
- **No Super Admin bypass:** capabilities are not agreed; an implicit skip would leak the entire former global dataset to a platform role.

## 8. Traceability

| Upstream | This RFC |
| --- | --- |
| Admin Foundation | Constrains out-of-scope multi-tenancy; extends principal and roles; retains cookie JWT, `AuthGuard`, `@Roles()`, login/audit semantics |
| nestjs-query reads / paginated collections | Constrains “no tenant authorizer”; paging/sort contracts unchanged |
| Module specs (customers … invoices) | Extends with `tenantId` and same-tenant FKs; replaces `OWNER` with `TENANT_OWNER` on existing matrices |
| `@clensy/ui` / `@clensy/web` | Relied upon for §4.8 |
| Web shell | Relied upon: chrome is not authz |

## 9. Acceptance criteria (for this specification)

M3 may Accept this RFC when:

1. Identity, scope, roles, ownership, uniqueness, isolation, audit, `OWNER` designation, REST `/bookings`, and Super Admin non-bypass are unambiguous enough that M4 cannot invent a second tenant-id source or an implicit Super Admin data bypass.
2. `OWNER` vs `TENANT_OWNER` vs `SUPER_ADMIN` cannot be reasonably confused.
3. Cross-tenant GraphQL get/list/filter/loader/mutation behavior is specified.
4. Deferrals (Super Admin control plane, membership, RLS, tenant URLs/branding) are explicit.
5. No section silently reinterprets an Accepted upstream RFC except where §8 says it constrains or extends that RFC.

## 10. Explicit deferrals

- Super Admin tenant administration and any Super Admin access to tenant business data.
- Tenant slug, URL, status/lifecycle workflow, who creates tenants in product UI.
- Staff permission changes beyond replacing `OWNER` with `TENANT_OWNER` on existing lists.
- Role-update / email-update for staff.
- Exact invoice number **format** beyond tenant-scoped uniqueness, concurrency-safe allocation, and not using the global sequence.
- Shell/nav item visibility per role (UX follow-on; not a security control).
- Whether REST `/bookings` is deleted or rebuilt as authenticated GraphQL-equivalent (both satisfy §4.5 if not left unauthenticated in production).
