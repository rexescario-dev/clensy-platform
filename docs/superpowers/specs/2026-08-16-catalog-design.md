# Catalog — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-16 |
| **Tracking** | [#4](https://github.com/rexescario-dev/clensy-platform/issues/4) (milestone M4 — Catalog) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.3 (catalog row), §2.6 (cross-module dependency rules), §4 (M4), §5 (vertical-slice DoD). [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — this slice depends on it for `AuthGuard`, `@Roles()`, `@CurrentUser()`, and `AuditLogger` (including its transactional-audit rule); it does not redesign any of those contracts. [Cleaners & Teams](2026-08-16-cleaners-teams-design.md) (Accepted) — precedent for `manager.update()` over diffing `save()` on same-value updates, computed presentation-layer fields with an N+1 invariant, and the Postgres `23505` → `ConflictException` translation pattern; all reused here, not redesigned. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | None — initial draft. |
| **M3 decision** | Pending. |

## 1. Primary question & thesis

**Question:** What is "what Clensy sells and how it's priced" — the catalog of services, optional add-ons, and pricing that later milestones (M5 Bookings onward) will reference and snapshot — and what exactly does this slice own versus defer?

**Thesis:** `modules/catalog` owns three domain objects: `Service`, `AddOn`, and `PricingRule`. A `Service` is a cleaning service Clensy offers; an `AddOn` is a global optional extra, not scoped to any specific service; a `PricingRule` records one priced amount for exactly one `Service`, with at most one active at a time — "changing a service's price" is modeled as creating a new active `PricingRule` and deactivating the previous one, never as editing a price in place. The slice ships create/read/update for `Service`, create/read for `AddOn` (no update — see §2), and create/read for `PricingRule` via `CreatePricingRule`/`GetActivePricing`, gated by the existing Admin Foundation RBAC, audit-logged on every mutation, exposed over GraphQL, and surfaced in `apps/web` at `/catalog`. No delete operation exists for any of the three objects in this slice.

## 2. Scope

### In scope (normative)

- `modules/catalog` domain: `Service`, `AddOn`, `PricingRule` (plain TS, no framework dependencies).
- Application layer: `CreateService`, `UpdateService`, `GetService`, `ListServices`, `CreateAddOn`, `ListAddOns`, `CreatePricingRule`, `GetActivePricing`. `GetService` is not named in the issue's own Application bullet — it is a specification-authored addition; see §5.
- Infrastructure: TypeORM entities and repositories for all three objects, with `PricingRule.serviceId` as a foreign key to `Service.id`.
- Presentation: GraphQL resolver, object types, and input types only (GraphQL-only, no REST surface, per the issue's own Presentation bullet and Phase 1 Design §2.3).
- RBAC: every operation declares `@Roles(...)` per the matrix in §4.3; every operation requires `AuthGuard` (no public operations in this module).
- Audit: every mutation (`createService`, `updateService`, `createAddOn`, `createPricingRule`) logs via the existing `AuditLogger` port.
- `apps/web`: `/catalog` (service list + create form), `/catalog/[id]` (service detail: edit + active price + set-new-price form), `/catalog/add-ons` (add-on list + create form); route-group auth gate extended to cover `/catalog`.
- Tests: unit tests for the application layer; one e2e covering create service → attach pricing → list active catalog (the issue's own DoD wording).

### Out of scope (normative)

- `UpdateAddOn` or any deactivate/delete operation for `AddOn` — the issue's Definition of Done lists `CreateAddOn`/`ListAddOns` only. As a direct consequence, `AddOn` carries no `active` field in this slice (§4.1) — a field nothing can ever change would be dead capability from day one, not a forward-looking convenience.
- Delete for `Service` or `PricingRule` — not in the issue's DoD.
- A price-history query (e.g. `pricingHistory(serviceId): [PricingRule!]!`) — inactive `PricingRule` rows are retained, not deleted (§4.1), so the data exists, but no query surfaces it in Phase 1.
- Service-to-`AddOn` attachment or compatibility rules — `AddOn` is global in this slice (§5); restricting which add-ons apply to which services is deferred until a stated need emerges.
- Tiered, date-effective, property-size-based, or formula-driven pricing — `PricingRule.priceCents` is a single flat amount per service. No discount engine, no multi-factor pricing.
- Any relationship to `modules/bookings` — M5's concern per Phase 1 Design §4 dependency order. This slice does not read from or write to `modules/bookings` at all.
- Currency formatting or localization — `priceCents` is a raw integer at the API layer; formatting it as `$12.00` (or any other currency/locale) is `apps/web`'s concern, not this specification's.
- Search, filtering, sorting, or pagination beyond a simple list — `ListServices` and `ListAddOns` return the full set, same precedent as Customers & Properties and Cleaners & Teams.

## 3. Terminology

- **Service** — a `modules/catalog` domain object representing one cleaning service Clensy sells (e.g. "Standard Clean," "Deep Clean").
- **AddOn** — a `modules/catalog` domain object representing an optional extra chargeable alongside any `Service` (e.g. "Inside Fridge," "Interior Windows"). Global, not scoped to a specific `Service` — see §5.
- **PricingRule** — a `modules/catalog` domain object recording one priced amount for exactly one `Service`. At most one `PricingRule` per `Service` is active at any time. Establishing a new price is modeled as creating a new active `PricingRule` and deactivating the previous one, never as editing an existing `PricingRule`'s price in place.
- **Active pricing** — the currently active `PricingRule` for a given `Service`, returned by `GetActivePricing`; `null` if the service has never had a price set.
- **Actor** — the `AuthenticatedPrincipal` performing a mutation, threaded into `AuditLogger` calls as `actorId`, per the Admin Foundation contract (unchanged here).

## 4. Domain and behavioral contracts

### 4.1 Domain objects

`Service`:
- `id: string` (UUID, generated; not client-settable)
- `name: string` (required, non-empty; **MUST be unique** — see §4.7)
- `description: string | null` (optional free text)
- `durationMinutes: number` (required, positive integer; specification-authored addition — not named in the issue's DoD, added because a service's duration is intrinsic to "what Clensy sells" and later milestones, M5 Bookings and M6 Jobs & Checklists, will need it to schedule work; see §5)
- `active: boolean` (default `true` at creation; specification-authored addition, same category as `durationMinutes` — lets a discontinued service be hidden from new selection via `UpdateService` without deleting its historical `PricingRule` rows)
- `createdAt: Date` (set once at creation; not client-settable), `updatedAt: Date` (not client-settable; set on every successful `updateService` invocation, matching the codebase's existing "last mutation invocation, not last effective change" convention — see the Cleaners spec §4.1 for the full rationale, reused here unchanged)

`Service` does **not** contain a `priceCents` field — price lives exclusively on `PricingRule` (see below); this is a deliberate separation, not an omission (§5).

`AddOn`:
- `id: string` (UUID, generated; not client-settable)
- `name: string` (required, non-empty; **MUST be unique** — see §4.7)
- `priceCents: number` (required, positive integer — whole US cents; see §5 for why money is an integer, not a decimal/float)
- `createdAt: Date`, `updatedAt: Date` (set once at creation; `updatedAt` never changes post-creation in this slice — there is no `UpdateAddOn`, §2)

`AddOn` has no `active` field and no update or delete operation in this slice (§2) — once created, an `AddOn`'s name and price are immutable for Phase 1.

`PricingRule`:
- `id: string` (UUID, generated; not client-settable)
- `serviceId: string` (foreign key to `Service.id`; required; immutable after creation — a `PricingRule` is never reassigned to a different `Service`)
- `priceCents: number` (required, positive integer)
- `active: boolean` (set internally by `CreatePricingRule`'s deactivate-then-insert transaction, §4.2; **not** a client-settable input field — there is no way to directly flip a `PricingRule`'s `active` value)
- `createdAt: Date`, `updatedAt: Date` (set once at creation; a `PricingRule` row's `active` flip during a later `CreatePricingRule` call does not update its own `updatedAt` — see §4.2's `manager.update()` note, which targets the *previous* rule's row via a bulk predicate, not a per-entity re-save)

At most one `PricingRule` per `serviceId` may have `active = true` at any time. Inactive `PricingRule` rows are retained, never deleted, forming an implicit price history — even though no query exposes that history in Phase 1 (§2).

The `PricingRule.serviceId → Service.id` foreign key does not cascade-delete on `Service` removal — moot in this slice specifically because no delete operation exists for `Service` (§2), but the FK's `ON DELETE` policy is still explicitly `RESTRICT` (the database's default-deny), matching the Cleaners spec's precedent of deciding this explicitly rather than inheriting a default. Following that same precedent, `PricingRule.serviceId` is a plain `@Column({ type: 'uuid' })` with no TypeORM relation decorator — the FK constraint is hand-added to the migration's raw SQL.

### 4.2 Application layer

Mirrors the `customers`/`cleaners` modules' `application/commands` + `application/services` split, with one service per domain object: `ServicesService`, `AddOnsService`, `PricingRulesService`. Each mutation method below owns its own transaction boundary: the entity write and the corresponding `AuditLogger.log()` call MUST execute within one database transaction, per the Admin Foundation transactional-audit rule — a restatement of an existing, Accepted contract, not a new one.

- `CreateServiceCommand` → `ServicesService.createService` — creates with `active: true`. Throws `ConflictException` if `name` collides with an existing `Service` (§4.7).
- `UpdateServiceCommand` → `ServicesService.updateService` — partial-update semantics, identical shape to the Cleaners spec's `updateCleaner`: `UpdateServiceInput` fields are all optional; an omitted field retains its current value. Uses `manager.update()`, **not** `Object.assign(entity, changes)` + `manager.save(entity)` — TypeORM's `save()` diffs the in-memory entity against the persisted row and can produce a no-op `UPDATE` (no `updatedAt` bump) for a call that resubmits already-current values. This slice adopts that lesson from the Cleaners slice's M5 review from the outset, rather than repeating the mistake and catching it in a later review round. Throws `NotFoundException` if `id` does not exist; `ConflictException` if a provided `name` collides with a different existing `Service`. Every successful call bumps `updatedAt` and emits its audit event unconditionally — the same cross-module convention the Cleaners spec §4.4 establishes, reused here without re-litigation.
- `ServicesService.getService(id)` — returns `null` if `id` does not exist; `ServicesService.listServices()` — returns the full set (§2, no filtering).
- `CreateAddOnCommand` → `AddOnsService.createAddOn` — throws `ConflictException` if `name` collides with an existing `AddOn` (§4.7).
- `AddOnsService.listAddOns()` — returns the full set.
- `CreatePricingRuleCommand` → `PricingRulesService.createPricingRule(serviceId, priceCents)` — throws `NotFoundException` if `serviceId` does not reference an existing `Service`. Within one transaction: `manager.update(PricingRuleEntity, { serviceId, active: true }, { active: false })` (deactivates whatever is currently active for this service — a no-op `UPDATE` affecting 0 rows if none is currently active), then inserts the new `PricingRuleEntity` with `active: true`. The partial unique index (§4.7) makes that insert fail with a Postgres `23505` unique-violation if a concurrent call for the same `serviceId` committed its own new active row first between this call's deactivate step and its insert step; that case is translated to `ConflictException('Pricing for this service was just updated — please retry')`, reusing the codebase's existing unique-violation-translation pattern (§4.7) for a concurrency-safety purpose rather than its usual duplicate-value purpose. Exactly one audit event is logged (`pricing_rule.create`) — the previous rule's deactivation is not independently audited, the same "one business action, one event" reasoning the Cleaners spec applies to `assignCleanerToTeam`'s reassignment case.
- `PricingRulesService.getActivePricing(serviceId)` — throws `NotFoundException` if `serviceId` does not reference an existing `Service`; otherwise returns the active `PricingRule` for that service, or `null` if the service exists but has never had one created.

### 4.3 RBAC (`@Roles()` matrix)

Every operation requires `AuthGuard` (authentication). No operation in this module is public.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / update service | ✓ | ✓ | | | | |
| Create add-on | ✓ | ✓ | | | | |
| Create pricing rule | ✓ | ✓ | | | | |
| View service / add-on / active pricing (get, list) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Rationale: what Clensy sells and its current price is need-to-know information across most of the org — Scheduler needs it to build a booking, Customer Support needs it to answer customer pricing questions, Finance needs it for revenue tracking, Analyst for reporting — so read access is broad, unlike the Cleaners spec's narrower view matrix (workforce identity is not similarly broadly needed). Writes (creating or changing what's sold and for how much) remain Owner/Ops Manager only, the same managerial-decision boundary the Cleaners spec applies to workforce writes.

### 4.4 Audit logging

Every mutation logs one `AuditLogger.log()` call, following the existing `AuditLogEvent` contract unchanged:

| Mutation | `action` | `entityType` | `entityId` |
| --- | --- | --- | --- |
| `createService` | `service.create` | `service` | new `Service.id` |
| `updateService` | `service.update` | `service` | `Service.id` |
| `createAddOn` | `add_on.create` | `add_on` | new `AddOn.id` |
| `createPricingRule` | `pricing_rule.create` | `pricing_rule` | new `PricingRule.id` |

`createPricingRule`'s audit event is scoped to the new `PricingRule`'s own id, not the `Service` it prices — consistent with "the audit event describes the row that was created," the same convention the Cleaners spec applies. The deactivated previous rule is not separately referenced in `metadata` — no audit event in this codebase currently carries mutation-specific metadata beyond the four required fields, and introducing that pattern here would be new scope, not a reuse of an existing one.

**Failure semantics are inherited from the Admin Foundation `AuditLogger` contract, unchanged, not redesigned here:** all four mutations above MUST persist their audit event within the same database transaction as the state change they describe. No new audit failure behavior, retry logic, or async/queued delivery is introduced.

No audit event is logged for read operations, matching precedent.

### 4.5 GraphQL operation surface

Queries:
- `service(id: ID!): Service`
- `services: [Service!]!`
- `addOns: [AddOn!]!`
- `activePricing(serviceId: ID!): PricingRule`

Mutations:
- `createService(input: CreateServiceInput!): Service!`
- `updateService(id: ID!, input: UpdateServiceInput!): Service!`
- `createAddOn(input: CreateAddOnInput!): AddOn!`
- `createPricingRule(serviceId: ID!, priceCents: Int!): PricingRule!`

`Service` GraphQL type additionally exposes an `activePricing: PricingRule` (nullable) computed field, backed by `PricingRulesService.getActivePricing(service.id)`. This is **presentation-layer computed data only** — not a field of the `Service` domain object itself (§4.1) — the same category as the Cleaners spec's `Cleaner.team`. **Resolving `services { activePricing { priceCents } }` over N services MUST NOT issue N separate `getActivePricing` calls** — the same N+1 invariant the Cleaners spec §4.5 states, carried forward unchanged: the implementation MUST batch or otherwise consolidate these lookups; no specific mechanism (e.g. DataLoader) is mandated by this specification.

`priceCents` is exposed on both the `AddOn` and `PricingRule` GraphQL types as a raw `Int!`. Currency formatting (e.g. rendering `1200` as `$12.00`) is `apps/web`'s concern, not the GraphQL schema's (§5).

### 4.6 Web UI

- `/catalog` — service list (`DataTable` from `packages/ui`): name, duration, active badge, active price (via `activePricing.priceCents`, formatted client-side); create-service form.
- `/catalog/[id]` — service detail: edit form (name, description, durationMinutes, active); current active price display; a "set new price" form that calls `createPricingRule` — there is no editable price field on the service-edit form itself, consistent with §4.2's create-not-edit pricing model.
- `/catalog/add-ons` — add-on list (`DataTable`: name, price) + create-add-on form. No edit or detail page — `AddOn` has no update operation in this slice (§2).
- Route-group auth gate: `apps/web/middleware.ts`'s `matcher` is extended to include `/catalog` and `/catalog/:path*`, using the same UX-hint-only cookie-presence check already in place for `/admin`, `/customers`, and `/cleaners`. The API's `@Roles()` guards remain the authoritative enforcement point.
- Forms use `FormField` from `packages/ui`; no screen hand-rolls its own inputs.

### 4.7 Validation invariants

- `Service.name` MUST be non-empty at creation and, per the partial-update semantics in §4.2, in the resulting entity state after any update. MUST be unique — enforced at the database layer (`@Column({ unique: true })`) and translated at the application layer from the Postgres `unique_violation` (`23505`) into `ConflictException('Service name is already in use')`, the exact existing pattern from `AdminsService`/`CleanersService`, reused, not reinvented.
- `Service.durationMinutes` MUST be a positive integer (`> 0`) at creation and in the resulting entity state after any update.
- `AddOn.name` MUST be non-empty and unique, enforced the same way as `Service.name` (`ConflictException('Add-on name is already in use')`).
- `AddOn.priceCents` MUST be a positive integer (`> 0`) — a $0 add-on is not a meaningful catalog entry in Phase 1.
- `PricingRule.priceCents` MUST be a positive integer (`> 0`), same reasoning.
- `PricingRule.serviceId` MUST reference an existing `Service` — enforced at the application layer (`NotFoundException`, §4.2) and at the database layer (FK constraint, hand-added to the migration's raw SQL, no TypeORM relation decorator, per §4.1).
- **At most one active `PricingRule` per `serviceId`** — enforced by a partial unique index (`CREATE UNIQUE INDEX ... ON pricing_rule ("serviceId") WHERE active = true`, hand-added to the migration's raw SQL) plus the application-layer deactivate-then-insert transaction (§4.2). This is the first uniqueness invariant in this codebase that is conditional (`WHERE active = true`) rather than a plain column-level `@Column({ unique: true })` — it cannot be expressed as a TypeORM decorator, so it is hand-added to the migration, the same escape hatch already used for the FK constraints in this and the Cleaners module.
- `NotFoundException`/`ConflictException` (both `@nestjs/common`) are used directly in `ServicesService`/`AddOnsService`/`PricingRulesService`, matching `AdminsService`/`CustomersService`/`CleanersService` today. This specification does not introduce module-specific domain error types.

## 5. Rationale

- **Price lives on `PricingRule`, not `Service`** — separating "what is sold" (`Service`) from "what it currently costs" (`PricingRule`) gives Catalog a clean price-history shape (inactive rows retained, §4.1) without ever mutating a price in place, which is exactly what M5 Bookings needs: a booking snapshots a price at booking time, and a later price change must not retroactively alter what a historical booking appears to have cost (Phase 1 Design §2.3). Putting price directly on `Service` and overwriting it on every price change would make that guarantee harder to reason about later, for no Phase 1 benefit.
- **`priceCents` as a positive integer, not a decimal/float** — avoids floating-point rounding errors at the cent level, a well-established pattern for money columns. This is the first money field in this codebase; it sets the precedent for how M5 Bookings' pricing snapshot should represent money, though that module's own specification makes that decision for itself rather than inheriting this one automatically (§7).
- **`AddOn` is global, not scoped to specific services** — the simplest model that satisfies the issue's DoD, which names no per-service restriction. A service-to-add-on compatibility list is deferred (§2), not designed against — if a real operational need for it emerges, that is a new, separately-specified capability.
- **`durationMinutes` and `Service.active` are specification-authored additions beyond the issue's own bullet list** — see §4.1's inline rationale for each; both are minimal, clearly within "what Clensy sells" scope, and needed by concrete downstream consumers (scheduling in M5/M6, hiding a discontinued service).
- **No `UpdateAddOn`, no `AddOn.active` field** — the issue's DoD lists no add-on update operation. Adding a mutator-less `active` field anyway would create dead capability from day one; better to omit the field entirely than add one nothing can ever change, once a slice has no operation to change it.
- **RBAC read access is broader here than in the Cleaners spec** — a deliberate divergence, not an inconsistency: pricing and catalog data is need-to-know across most of the org in a way workforce identity data is not (§4.3). Writes remain restricted to Owner/Ops Manager in both modules, for the same managerial-decision reasoning.
- **Partial unique index for "at most one active `PricingRule` per service"** — the first conditional/partial uniqueness invariant in this codebase (§4.7); it reuses the existing `23505` → `ConflictException` translation pattern, applied here for concurrency safety rather than its usual duplicate-value purpose.
- **`manager.update()` adopted for `updateService` from the outset** — applies the lesson learned in the Cleaners slice's M5 round 3 review immediately, rather than waiting for a review round to catch the same mistake again in a new module.
- **No REST surface** — GraphQL-only is the Phase 1 default for every module without a pre-existing REST consumer (`bookings` is the sole legacy exception); `catalog` has none.

## 6. Acceptance criteria (for this specification)

- The domain objects, application operations, RBAC matrix, audit mapping, and GraphQL surface are confirmed correct against the project owner's intent, including the price-lives-on-`PricingRule`-not-`Service` decision and the `AddOn`-is-global decision (§4.1, §5).
- No open contradiction with the Accepted Phase 1 Design, Admin Foundation, or Cleaners & Teams specifications.
- Scope boundaries (§2) are explicit enough that M4 Implementation Planning does not need to make further scope decisions.
- Money representation (`priceCents` as a positive integer) is explicitly decided, not left ambiguous.
- The "at most one active `PricingRule` per service" invariant and its enforcement mechanism (partial unique index + transactional deactivate-then-insert + `23505` translation) are explicitly confirmed.
- `durationMinutes` and `Service.active`, the two specification-authored additions beyond the issue's own bullet list, are confirmed or rejected by review (§4.1, §5).

## 7. Non-goals

- Redesigning any Admin Foundation or Cleaners & Teams contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, the `manager.update()`/N+1/unique-violation-translation patterns) — all consumed or reused as-is.
- Any `modules/bookings` change — pricing-snapshot consumption is M5's concern per Phase 1 Design §4 dependency order; this slice does not touch `modules/bookings`.
- Service-to-`AddOn` attachment rules, tiered/date-effective/property-size-based pricing formulas, a price-history query, `AddOn` update/deactivate, currency formatting/localization, and pagination/search/filtering — all explicitly deferred per §2/§4.1/§4.5/§4.7.
- A cross-module money-representation standard — this specification decides `priceCents` for `catalog` only; a later module (e.g. M5 Bookings) adopting, revisiting, or extending it is that module's own specification decision, not automatically inherited from this one.
