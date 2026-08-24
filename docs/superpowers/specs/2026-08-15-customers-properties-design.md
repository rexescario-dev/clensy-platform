# Customers & Properties — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-15 |
| **Tracking** | [#2](https://github.com/rexescario-dev/clensy-platform/issues/2) (milestone M2 — Customers & Properties) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.3 (customers row), §2.6 (cross-module dependency rules), §4 (M2), §5 (vertical-slice DoD), §8 (Property extraction trigger). [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — this slice depends on it for `AuthGuard`, `@Roles()`, `@CurrentUser()`, and `AuditLogger` (including its transactional-audit rule, §4.6 there); it does not redesign any of those contracts. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | First M3 pass returned the draft for contract-precision tightening (not a redesign): `Customer.properties` was clarified as presentation-layer-only (no domain/ORM relation); `getCustomer`/`getProperty` nullability, `listCustomerProperties`'s missing-customer policy (`NotFoundException`, not an empty list), `Update*Input` partial-update semantics, and audit failure semantics (inherited from Admin Foundation's transactional rule) were all made explicit; Finance's absence from the RBAC matrix, FK delete behavior, timestamp lifecycle, and the email domain/presentation validation split were documented. All applied in this version. |
| **M3 decision** | **Accepted** — 2026-08-15. No remaining design blocker; corrections above applied. Ready for M4 Implementation Planning. |

## 1. Primary question & thesis

**Question:** What is the customer/property record-keeping workflow that every later booking-related milestone (M5 Bookings onward) will reference by identity — and what exactly does it own versus defer?

**Thesis:** `modules/customers` owns two domain objects, `Customer` and `Property`, with `Property` nested under `Customer` (no independent lifecycle, no standalone module — Phase 1 Design §2.3, §8). The slice ships full create/read/update for both, gated by the existing Admin Foundation RBAC, audit-logged on every mutation, exposed over GraphQL, and surfaced in `apps/web` at `/customers` (list, detail-with-properties, create/edit forms). No delete operation exists for either object in this slice.

## 2. Scope

### In scope (normative)

- `modules/customers` domain: `Customer`, `Property` (plain TS, no framework dependencies).
- Application layer: `CreateCustomer`, `UpdateCustomer`, `GetCustomer`, `ListCustomers`, `CreateProperty`, `UpdateProperty`, `GetProperty`, `ListCustomerProperties`.
- Infrastructure: TypeORM entities and repositories for both objects, with `Property.customerId` as a required foreign key to `Customer.id`.
- Presentation: GraphQL resolver, object types, and input types only (no REST surface — unlike `bookings`, this module has no pre-existing REST consumer to preserve).
- RBAC: every operation declares `@Roles(...)` per the matrix in §4.3; every operation requires `AuthGuard` (no public operations in this module).
- Audit: every mutation (`createCustomer`, `updateCustomer`, `createProperty`, `updateProperty`) logs via the existing `AuditLogger` port.
- `apps/web`: `/customers` (list), `/customers/[id]` (detail, showing the customer's properties), create/edit forms for both objects; route-group auth gate extended to cover `/customers`.
- Tests: unit tests for the application layer; one e2e covering create customer → add property → list (Phase 1 Design §3, §5).

### Out of scope (normative)

- Delete/deactivate for `Customer` or `Property` — the issue's Definition of Done lists no delete operation; only create/read/update exist in this slice.
- Any relationship to `bookings` — at the time of this slice, `bookings` still held a fake `customerName` string, reworked to hold a real `customerId`/`propertyId` by its own M6 milestone (see the [Bookings spec](2026-08-22-bookings-design.md)). This slice does not touch `modules/bookings`.
- Customer-facing accounts or authentication — a `Customer` is a record `apps/web` staff manage, not a principal who can log in. Distinct from `AdminUser` entirely.
- Deduplication or uniqueness enforcement on customer email/phone — real households can share contact details; detecting/merging duplicate customer records is a deferred concern, not solved here.
- Search, filtering, sorting, or pagination beyond a simple list — `ListCustomers` and `ListCustomerProperties` return the full set for their scope. Phase 1's customer volume does not yet justify pagination; revisit when it does.
- A standalone/global property list or `properties` module — explicitly rejected by Phase 1 Design §2.3/§8 unless the extraction trigger there fires.
- Geocoding, map display, or address validation against an external service — addresses are free-text fields captured as given.

## 3. Terminology

- **Customer** — a `modules/customers` domain object representing a person or household Clensy provides service to. Owns identity fields (name, email, phone) but is not an authentication principal.
- **Property** — a `modules/customers` domain object representing a physical address a `Customer` wants cleaned. Always belongs to exactly one `Customer` (`customerId`); has no lifecycle independent of its owning `Customer` (Phase 1 Design §2.3).
- **Actor** — the `AuthenticatedPrincipal` performing a mutation, threaded into `AuditLogger` calls as `actorId`, per the Admin Foundation contract (unchanged here).

## 4. Domain and behavioral contracts

### 4.1 Domain objects

`Customer`:
- `id: string` (UUID, generated; not client-settable)
- `fullName: string` (required, non-empty)
- `email: string` (required, non-empty; not required to be unique — see §2 out-of-scope)
- `phone: string` (required, non-empty)
- `notes: string | null` (optional free text — front-line staff context, e.g. gate codes shared at the customer level rather than a specific property)
- `createdAt: Date` (set once at creation; not client-settable), `updatedAt: Date` (set on every successful mutation of this record; not client-settable)

`Customer` does **not** contain a `properties` field — the domain object owns only its own scalar fields. `Property` is reached from `Customer` only through `PropertiesService.listCustomerProperties`, never through a domain-level or ORM-level relation (see §4.5).

`Property`:
- `id: string` (UUID, generated; not client-settable)
- `customerId: string` (required; foreign key to `Customer.id`; immutable after creation, §4.2)
- `label: string` (required, non-empty — e.g. "Home", "Downtown Office"; how staff distinguish a customer's multiple properties in lists and dropdowns)
- `addressLine1: string` (required, non-empty)
- `addressLine2: string | null` (optional)
- `city: string` (required, non-empty)
- `region: string` (required, non-empty — state/province)
- `postalCode: string` (required, non-empty)
- `accessNotes: string | null` (optional free text — gate codes, parking, pet warnings)
- `createdAt: Date` (set once at creation; not client-settable), `updatedAt: Date` (set on every successful mutation of this record; not client-settable)

The `Property.customerId → Customer.id` foreign key does **not** cascade-delete: since this slice exposes no delete operation for either object (§2), the FK's `ON DELETE` policy is `RESTRICT` (or the database's equivalent default-deny), not `CASCADE`. This is stated so a later slice that *does* add customer deletion must make that cascade decision explicitly rather than inheriting a permissive default set here.

### 4.2 Application layer

Mirrors the existing `bookings` module's `application/commands` + `application/services` split (Phase 1 Design's established pattern, `apps/api/src/modules/bookings/`):

- `CreateCustomerCommand` → `CustomersService.createCustomer`
- `UpdateCustomerCommand` → `CustomersService.updateCustomer` — **partial-update semantics**: `UpdateCustomerInput` fields are all optional; an omitted field retains its current value, a provided field is applied. After applying provided fields, the *resulting* full entity state is revalidated against §4.7 (a provided field cannot make a required field empty, and an omitted required field can never be empty because it was already valid). Throws `NotFoundException` if `id` does not exist, matching the existing convention in `admins.service.ts`/`bookings.service.ts` (never a silent no-op).
- `CustomersService.getCustomer(id)` — returns `null` if `id` does not exist (nullable GraphQL type, §4.5); `CustomersService.listCustomers()`.
- `CreatePropertyCommand` → `PropertiesService.createProperty` — validates `customerId` references an existing `Customer` before insert; throws `NotFoundException` if not, same convention as above.
- `UpdatePropertyCommand` → `PropertiesService.updateProperty` — same **partial-update semantics** as `updateCustomer`: `UpdatePropertyInput` fields are all optional, omitted fields retain their current value, and the resulting full entity state is revalidated against §4.7. Throws `NotFoundException` if `id` does not exist. `customerId` is not a field of `UpdatePropertyInput` at all — it is immutable after creation and can only be set via `createProperty` (a property does not get reassigned to a different customer in this slice — if that need arises later, it is a new operation, not an implicit side effect of update).
- `PropertiesService.getProperty(id)` — returns `null` if `id` does not exist; `PropertiesService.listCustomerProperties(customerId)` — throws `NotFoundException` if `customerId` does not exist. Unlike `createProperty`'s existence check (which guards a write), this one guards a query that is explicitly scoped to a single customer: silently returning `[]` for a typo'd or stale `customerId` would make that mistake indistinguishable from "this customer genuinely has no properties," so it is surfaced as an error instead.

### 4.3 RBAC (`@Roles()` matrix)

Every operation requires `AuthGuard` (authentication). No operation in this module is public.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / update customer | ✓ | ✓ | | ✓ | | |
| Create / update property | ✓ | ✓ | | ✓ | | |
| View customer / property (get, list) | ✓ | ✓ | ✓ | ✓ | | ✓ |

Rationale: Customer Support is the front-line role that onboards customers and manages their records day-to-day, so it gets write access alongside Owner/Ops Manager. Scheduler needs to see customer/property details to schedule bookings against them but does not own the customer relationship, so it is read-only here. Analyst (read-only across Phase 1 by role design) gets view access for reporting.

Finance's absence here is a **deliberate, temporary M2 boundary, not an architectural exclusion**: Finance has no stated need for customer contact/address data in *this* slice. A later milestone that gives Finance a real reason to read customer/property data (e.g. invoicing) MUST add that capability to Finance explicitly in that milestone's own specification — it MUST NOT be granted implicitly by inheriting from another role or by loosening this matrix without a stated reason.

### 4.4 Audit logging

Every mutation logs one `AuditLogger.log()` call, following the existing `AuditLogEvent` contract unchanged:

| Mutation | `action` | `entityType` | `entityId` |
| --- | --- | --- | --- |
| `createCustomer` | `customer.create` | `customer` | new `Customer.id` |
| `updateCustomer` | `customer.update` | `customer` | `Customer.id` |
| `createProperty` | `property.create` | `property` | new `Property.id` |
| `updateProperty` | `property.update` | `property` | `Property.id` |

**Failure semantics are inherited from the Admin Foundation `AuditLogger` contract, unchanged, not redesigned here:** all four mutations above are state-changing operations (unlike `login`, which has no accompanying state change), so each MUST persist its audit event within the same database transaction as the state change it describes, per the Admin Foundation spec's transactional-audit rule (§4.6 there) — if the audit write fails, the state change rolls back with it. This slice introduces no new audit failure behavior, retry logic, or async/queued delivery.

No audit event is logged for read operations, matching the Admin Foundation precedent (audit covers mutations, not reads).

### 4.5 GraphQL operation surface

Queries:
- `customer(id: ID!): Customer`
- `customers: [Customer!]!`
- `property(id: ID!): Property`
- `customerProperties(customerId: ID!): [Property!]!`

Mutations:
- `createCustomer(input: CreateCustomerInput!): Customer!`
- `updateCustomer(id: ID!, input: UpdateCustomerInput!): Customer!`
- `createProperty(customerId: ID!, input: CreatePropertyInput!): Property!`
- `updateProperty(id: ID!, input: UpdatePropertyInput!): Property!`

`Customer` GraphQL type additionally exposes a `properties: [Property!]!` field. This is **presentation-layer computed data only** — it is not a field of the `Customer` domain object (§4.1) and requires no TypeORM relation, bidirectional association, or ORM-level eager/lazy loading on the `Customer` entity. The resolver backing this field calls `PropertiesService.listCustomerProperties(customer.id)`, the same application-layer method the standalone `customerProperties` query uses; the GraphQL layer is the only place the two are connected. This lets `apps/web`'s customer-detail screen fetch a customer and its properties in one query without a second round trip, while keeping the domain/infrastructure layers unaware that this nesting exists. `customerProperties` remains available as a standalone query for cases that only need the property list.

### 4.6 Web UI

- `/customers` — list view (`DataTable` from `packages/ui`), one row per `Customer` (name, email, phone), link to detail.
- `/customers/[id]` — detail view: customer fields, edit form, and a nested `DataTable` of the customer's properties with an add/edit form per property.
- Route-group auth gate: `apps/web/middleware.ts`'s `matcher` is extended to include `/customers` and `/customers/:path*`, using the same UX-hint-only cookie-presence check already in place for `/admin` (§4.8 of the Admin Foundation spec — unchanged mechanism, just a wider matcher). The API's `@Roles()` guards remain the authoritative enforcement point; the frontend gate is UX layering only, consistent with Phase 1 Design §3.
- Forms use `FormField` from `packages/ui`; no screen hand-rolls its own inputs, per Phase 1 Design §3.

### 4.7 Validation invariants

- `Customer.fullName`, `.email`, `.phone` MUST be non-empty at creation and, per the partial-update semantics in §4.2, in the resulting entity state after any update. **The domain invariant for `email` is non-empty only** — the domain layer has no concept of email syntax. Email format/syntax validation (e.g. RFC 5322 shape) is a presentation/input-layer concern owned by the GraphQL input types (`CreateCustomerInput`/`UpdateCustomerInput`) for this slice; a future presentation layer (or a future domain rule) MUST NOT assume the domain already guarantees syntactic validity. No external verification (no email-send, no phone-verify) is performed either way.
- `Property.customerId` MUST reference an existing `Customer` at creation. Enforced both at the application layer (explicit existence check throwing `NotFoundException` before insert, §4.2) and at the database layer (FK constraint) — the application-layer check exists to produce a clean GraphQL error instead of surfacing a raw FK-violation error to the client.
- `Property.label`, `.addressLine1`, `.city`, `.region`, `.postalCode` MUST be non-empty at creation and, per the partial-update semantics in §4.2, in the resulting entity state after any update.

## 5. Rationale

- **Nesting `Property` under `customers` rather than a standalone module** follows Phase 1 Design §2.3/§8 directly — a property has no lifecycle independent of its customer today (no property-only workflow exists in Phase 1). This RFC does not revisit that decision; if a future milestone needs one, §8's extraction trigger governs, not this document.
- **No delete operation** matches the issue's Definition of Done (create/read/update only) and mirrors the Admin Foundation precedent of shipping only the lifecycle operations a slice actually needs rather than full CRUD by default.
- **Customer Support gets write access, Scheduler does not** reflects the real division of labor implied by the role names themselves (support = record ownership, scheduling = record consumption). M3 reviewed this split without challenge; the RBAC row it did flag (Finance) is addressed in §4.3's rationale.
- **No REST surface** — unlike `bookings`, which preserves a pre-existing REST API as a migration constraint (Phase 1 Design §2.3), `modules/customers` has no legacy consumer to preserve. GraphQL-only is the default going forward per Phase 1 Design §2.3 ("Presentation: GraphQL only").

## 6. Acceptance criteria (for this specification)

Met as of the M3 decision above:
- The domain objects, application operations, RBAC matrix, audit mapping, and GraphQL surface are confirmed correct against the project owner's intent, including the Scheduler/Customer Support/Finance/Analyst role assignments in §4.3.
- No open contradiction with the Accepted Phase 1 Design or Accepted Admin Foundation spec.
- Scope boundaries (§2) are explicit enough that M4 planning does not need to make further scope decisions.
- Every ambiguity M3 identified (GraphQL/domain layering of `properties`, not-found and missing-parent policies, partial-update semantics, audit failure inheritance) is now resolved normatively — M4 should not need to invent behavior in any of these areas.

## 7. Non-goals

- Redesigning any Admin Foundation contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, JWT/session mechanics) — all consumed as-is.
- Any `modules/bookings` change — deferred to M5 per Phase 1 Design §4 dependency order.
- Pagination, search, filtering, deduplication, delete/deactivate, or external address validation — all explicitly deferred per §2.
