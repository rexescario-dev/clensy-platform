# Customers & Properties — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-15 |
| **Tracking** | [#2](https://github.com/rexescario-dev/clensy-platform/issues/2) (milestone M2 — Customers & Properties) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.3 (customers row), §2.6 (cross-module dependency rules), §4 (M2), §5 (vertical-slice DoD), §8 (Property extraction trigger). [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — this slice depends on it for `AuthGuard`, `@Roles()`, `@CurrentUser()`, and `AuditLogger`; it does not redesign any of those contracts. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |

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
- Any relationship to `bookings` — `bookings` still holds a fake `customerName` string in Phase 1 until its own M5 milestone reworks it to hold a real `customerId`/`propertyId`. This slice does not touch `modules/bookings`.
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
- `id: string` (UUID, generated)
- `fullName: string` (required, non-empty)
- `email: string` (required, non-empty; not required to be unique — see §2 out-of-scope)
- `phone: string` (required, non-empty)
- `notes: string | null` (optional free text — front-line staff context, e.g. gate codes shared at the customer level rather than a specific property)
- `createdAt: Date`, `updatedAt: Date`

`Property`:
- `id: string` (UUID, generated)
- `customerId: string` (required; foreign key to `Customer.id`)
- `label: string` (required, non-empty — e.g. "Home", "Downtown Office"; how staff distinguish a customer's multiple properties in lists and dropdowns)
- `addressLine1: string` (required, non-empty)
- `addressLine2: string | null` (optional)
- `city: string` (required, non-empty)
- `region: string` (required, non-empty — state/province)
- `postalCode: string` (required, non-empty)
- `accessNotes: string | null` (optional free text — gate codes, parking, pet warnings)
- `createdAt: Date`, `updatedAt: Date`

### 4.2 Application layer

Mirrors the existing `bookings` module's `application/commands` + `application/services` split (Phase 1 Design's established pattern, `apps/api/src/modules/bookings/`):

- `CreateCustomerCommand` → `CustomersService.createCustomer`
- `UpdateCustomerCommand` → `CustomersService.updateCustomer` — updates `fullName`, `email`, `phone`, `notes`; returns a domain error (surfaced as a GraphQL error, not a silent no-op) if `id` does not exist.
- `CustomersService.getCustomer(id)`, `CustomersService.listCustomers()`
- `CreatePropertyCommand` → `PropertiesService.createProperty` — validates `customerId` references an existing `Customer` before insert; returns a domain error if not.
- `UpdatePropertyCommand` → `PropertiesService.updateProperty` — updates the address/label/notes fields; `customerId` is immutable after creation (a property does not get reassigned to a different customer in this slice — if that need arises later, it is a new operation, not an implicit side effect of update).
- `PropertiesService.getProperty(id)`, `PropertiesService.listCustomerProperties(customerId)`

### 4.3 RBAC (`@Roles()` matrix)

Every operation requires `AuthGuard` (authentication). No operation in this module is public.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / update customer | ✓ | ✓ | | ✓ | | |
| Create / update property | ✓ | ✓ | | ✓ | | |
| View customer / property (get, list) | ✓ | ✓ | ✓ | ✓ | | ✓ |

Rationale: Customer Support is the front-line role that onboards customers and manages their records day-to-day, so it gets write access alongside Owner/Ops Manager. Scheduler needs to see customer/property details to schedule bookings against them but does not own the customer relationship, so it is read-only here. Analyst (read-only across Phase 1 by role design) gets view access for reporting. Finance has no stated need for customer contact/address data in this slice and is excluded; this is revisited if a later milestone (e.g. invoicing) introduces one.

### 4.4 Audit logging

Every mutation logs one `AuditLogger.log()` call after a successful write, following the existing `AuditLogEvent` contract unchanged:

| Mutation | `action` | `entityType` | `entityId` |
| --- | --- | --- | --- |
| `createCustomer` | `customer.create` | `customer` | new `Customer.id` |
| `updateCustomer` | `customer.update` | `customer` | `Customer.id` |
| `createProperty` | `property.create` | `property` | new `Property.id` |
| `updateProperty` | `property.update` | `property` | `Property.id` |

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

`Customer` GraphQL type additionally exposes a `properties: [Property!]!` field (resolved via `customerId`), so `apps/web`'s customer-detail screen can fetch a customer and its properties in one query without a second round trip through `customerProperties`. `customerProperties` remains available as a standalone query for cases that only need the property list.

### 4.6 Web UI

- `/customers` — list view (`DataTable` from `packages/ui`), one row per `Customer` (name, email, phone), link to detail.
- `/customers/[id]` — detail view: customer fields, edit form, and a nested `DataTable` of the customer's properties with an add/edit form per property.
- Route-group auth gate: `apps/web/middleware.ts`'s `matcher` is extended to include `/customers` and `/customers/:path*`, using the same UX-hint-only cookie-presence check already in place for `/admin` (§4.8 of the Admin Foundation spec — unchanged mechanism, just a wider matcher). The API's `@Roles()` guards remain the authoritative enforcement point; the frontend gate is UX layering only, consistent with Phase 1 Design §3.
- Forms use `FormField` from `packages/ui`; no screen hand-rolls its own inputs, per Phase 1 Design §3.

### 4.7 Validation invariants

- `Customer.fullName`, `.email`, `.phone` MUST be non-empty at creation and update. Format validation (e.g. email shape) happens at the GraphQL input layer; no external verification (no email-send, no phone-verify).
- `Property.customerId` MUST reference an existing `Customer` at creation. Enforced both at the application layer (explicit existence check returning a domain error before insert) and at the database layer (FK constraint) — the application-layer check exists to produce a clean GraphQL error instead of surfacing a raw FK-violation error to the client.
- `Property.label`, `.addressLine1`, `.city`, `.region`, `.postalCode` MUST be non-empty at creation and update.

## 5. Rationale

- **Nesting `Property` under `customers` rather than a standalone module** follows Phase 1 Design §2.3/§8 directly — a property has no lifecycle independent of its customer today (no property-only workflow exists in Phase 1). This RFC does not revisit that decision; if a future milestone needs one, §8's extraction trigger governs, not this document.
- **No delete operation** matches the issue's Definition of Done (create/read/update only) and mirrors the Admin Foundation precedent of shipping only the lifecycle operations a slice actually needs rather than full CRUD by default.
- **Customer Support gets write access, Scheduler does not** reflects the real division of labor implied by the role names themselves (support = record ownership, scheduling = record consumption) and is the one judgment call in this RFC most likely to be adjusted at review — flagged here explicitly rather than asserted silently.
- **No REST surface** — unlike `bookings`, which preserves a pre-existing REST API as a migration constraint (Phase 1 Design §2.3), `modules/customers` has no legacy consumer to preserve. GraphQL-only is the default going forward per Phase 1 Design §2.3 ("Presentation: GraphQL only").

## 6. Acceptance criteria (for this specification)

This specification is ready to move from Draft to Accepted at M3 when:
- The domain objects, application operations, RBAC matrix, audit mapping, and GraphQL surface above are confirmed correct against the project owner's intent (in particular the Scheduler/Customer Support/Finance/Analyst role assignments in §4.3, which are this RFC's own judgment call, not dictated by an existing accepted matrix).
- No open contradiction with the Accepted Phase 1 Design or Accepted Admin Foundation spec remains.
- Scope boundaries (§2) are explicit enough that M4 planning does not need to make further scope decisions.

## 7. Non-goals

- Redesigning any Admin Foundation contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, JWT/session mechanics) — all consumed as-is.
- Any `modules/bookings` change — deferred to M5 per Phase 1 Design §4 dependency order.
- Pagination, search, filtering, deduplication, delete/deactivate, or external address validation — all explicitly deferred per §2.
