# Catalog — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-16 |
| **Tracking** | [#4](https://github.com/rexescario-dev/clensy-platform/issues/4) (milestone M4 — Catalog) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.3 (catalog row), §2.6 (cross-module dependency rules), §4 (M4), §5 (vertical-slice DoD). [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — this slice depends on it for `AuthGuard`, `@Roles()`, `@CurrentUser()`, and `AuditLogger` (including its transactional-audit rule); it does not redesign any of those contracts. [Cleaners & Teams](2026-08-16-cleaners-teams-design.md) (Accepted) — precedent for `manager.update()` over diffing `save()` on same-value updates, computed presentation-layer fields with an N+1 invariant, and the Postgres `23505` → `ConflictException` translation pattern; all reused here, not redesigned. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | M3 round 1 (reviewer: project owner) returned the draft for five mandatory changes, not a redesign: `AddOn` gained full lifecycle parity with `Service` (`description`, `active`, `UpdateAddOn`) — the initial draft's "immutable forever" model was identified as a business-model defect, since a permanently-unique, never-editable `name` and price would make a real price correction impossible without renaming the row. `Service.active` semantics were made explicit (Option B: "not retired," administrative reads return both active and inactive rows; a future consumer like M5 Bookings is responsible for filtering to active-only itself). Money representation renamed `priceCents` → `priceMinorUnits` throughout, decoupling it from USD (Clensy operates in PHP); no `currency` column was added, per the reviewer's simpler suggested path. `PricingRule` was made explicitly append-only (no `updatedAt` field at all — `createdAt` is the only meaningful timestamp for a row whose only ever state transition is an internal `active` flip performed by a later `CreatePricingRule` call, never a direct edit). `Service.name`/`AddOn.name` uniqueness was changed from case-sensitive to case-insensitive (expression unique index on `LOWER(name)`), with input trimmed before the check. A concurrency test for simultaneous `createPricingRule` calls was added to the Tests scope. `createPricingRule`'s GraphQL mutation was changed from positional arguments to an `input` object, matching every other mutation's shape. The `PricingRule` naming question (an alternative like `ServicePricing` was suggested) was considered and explicitly kept as-is — not a mandatory change; see §5. |
| **M3 decision** | **Accepted** — 2026-08-16. Round 1 fixes verified consistent across thesis, scope, domain contracts, application layer, RBAC, audit, GraphQL surface, web UI, and rationale (no remaining `priceCents`/USD language, no remaining "AddOn has no update/no active" language). No remaining design blocker. Ready for M4 Implementation Planning. |

## 1. Primary question & thesis

**Question:** What is "what Clensy sells and how it's priced" — the catalog of services, optional add-ons, and pricing that later milestones (M5 Bookings onward) will reference and snapshot — and what exactly does this slice own versus defer?

**Thesis:** `modules/catalog` owns three domain objects: `Service`, `AddOn`, and `PricingRule`. A `Service` is a cleaning service Clensy offers; an `AddOn` is a global optional extra, not scoped to any specific service; a `PricingRule` records one priced amount for exactly one `Service`, with at most one active at a time — "changing a service's price" is modeled as creating a new active `PricingRule` and deactivating the previous one, never as editing a price in place. The slice ships create/read/update for `Service`, create/read/update for `AddOn`, and create/read for `PricingRule` via `CreatePricingRule`/`GetActivePricing`, gated by the existing Admin Foundation RBAC, audit-logged on every mutation, exposed over GraphQL, and surfaced in `apps/web` at `/catalog`. No delete operation exists for any of the three objects in this slice.

## 2. Scope

### In scope (normative)

- `modules/catalog` domain: `Service`, `AddOn`, `PricingRule` (plain TS, no framework dependencies).
- Application layer: `CreateService`, `UpdateService`, `GetService`, `ListServices`, `CreateAddOn`, `UpdateAddOn`, `ListAddOns`, `CreatePricingRule`, `GetActivePricing`. `GetService` is not named in the issue's own Application bullet — it is a specification-authored addition; see §5. `UpdateAddOn` was added in M3 round 1 — see the Revision note above and §5.
- Infrastructure: TypeORM entities and repositories for all three objects, with `PricingRule.serviceId` as a foreign key to `Service.id`.
- Presentation: GraphQL resolver, object types, and input types only (GraphQL-only, no REST surface, per the issue's own Presentation bullet and Phase 1 Design §2.3).
- RBAC: every operation declares `@Roles(...)` per the matrix in §4.3; every operation requires `AuthGuard` (no public operations in this module).
- Audit: every mutation (`createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`) logs via the existing `AuditLogger` port.
- `apps/web`: `/catalog` (service list + create form), `/catalog/[id]` (service detail: edit + active price + set-new-price form), `/catalog/add-ons` (add-on list + create form), `/catalog/add-ons/[id]` (add-on detail: edit form, including retiring it via `active`); route-group auth gate extended to cover `/catalog`.
- Tests: unit tests for the application layer; one e2e covering create service → attach pricing → list active catalog (the issue's own DoD wording); a concurrency test asserting that two simultaneous `createPricingRule` calls for the same `serviceId` result in exactly one success, one `ConflictException`, and exactly one active `PricingRule` row remaining (§4.2, §4.7) — added in M3 round 1.

### Out of scope (normative)

- Delete for `Service`, `AddOn`, or `PricingRule` — not in the issue's DoD; Phase 1's no-delete-for-anything convention (§2 of every prior slice) applies here too.
- A price-history query (e.g. `pricingHistory(serviceId): [PricingRule!]!`) — inactive `PricingRule` rows are retained, not deleted (§4.1), so the data exists, but no query surfaces it in Phase 1.
- Service-to-`AddOn` attachment or compatibility rules — `AddOn` is global in this slice (§5); restricting which add-ons apply to which services is deferred until a stated need emerges.
- Tiered, date-effective, property-size-based, or formula-driven pricing — `PricingRule.priceMinorUnits` is a single flat amount per service. No discount engine, no multi-factor pricing.
- Any relationship to `modules/bookings` — M5's concern per Phase 1 Design §4 dependency order. This slice does not read from or write to `modules/bookings` at all.
- Currency formatting, localization, or multi-currency support (a `currency` column) — `priceMinorUnits` is a raw integer at the API layer with no currency field; Phase 1 implicitly assumes a single operating currency (PHP). Formatting a value like `150000` as `₱1,500.00` is `apps/web`'s concern, not this specification's. Introducing multi-currency later is a new, separately-specified capability, not automatically implied by the `MinorUnits` naming (§5).
- Search, filtering, sorting, or pagination beyond a simple list — `ListServices` and `ListAddOns` return the full set (both active and inactive — see §4.1's `Service.active` semantics), same precedent as Customers & Properties and Cleaners & Teams. A downstream consumer needing "active only" filters client-side or in its own query (§4.1).

## 3. Terminology

- **Service** — a `modules/catalog` domain object representing one cleaning service Clensy sells (e.g. "Standard Clean," "Deep Clean").
- **AddOn** — a `modules/catalog` domain object representing an optional extra chargeable alongside any `Service` (e.g. "Inside Fridge," "Interior Windows"). Global, not scoped to a specific `Service` — see §5.
- **PricingRule** — a `modules/catalog` domain object recording one priced amount for exactly one `Service`. At most one `PricingRule` per `Service` is active at any time. Establishing a new price is modeled as creating a new active `PricingRule` and deactivating the previous one, never as editing an existing `PricingRule`'s price in place. See §5 for why this name was kept over an alternative like `ServicePricing`.
- **Active pricing** — the currently active `PricingRule` for a given `Service`, returned by `GetActivePricing`; `null` if the service has never had a price set.
- **Minor units** — the smallest denomination of the operating currency (e.g. centavos for PHP), stored as an integer to avoid floating-point rounding. Phase 1 assumes PHP implicitly; no currency is stored (§2).
- **Actor** — the `AuthenticatedPrincipal` performing a mutation, threaded into `AuditLogger` calls as `actorId`, per the Admin Foundation contract (unchanged here).

## 4. Domain and behavioral contracts

### 4.1 Domain objects

`Service`:
- `id: string` (UUID, generated; not client-settable)
- `name: string` (required, non-empty after trimming; **MUST be unique, case-insensitively** — see §4.7)
- `description: string | null` (optional free text)
- `durationMinutes: number` (required, positive integer; specification-authored addition — not named in the issue's DoD, added because a service's duration is intrinsic to "what Clensy sells" and later milestones, M5 Bookings and M6 Jobs & Checklists, will need it to schedule work; see §5)
- `active: boolean` (default `true` at creation; specification-authored addition — see below for its precise semantics)
- `createdAt: Date` (set once at creation; not client-settable), `updatedAt: Date` (not client-settable; set on every successful `updateService` invocation, matching the codebase's existing "last mutation invocation, not last effective change" convention — see the Cleaners spec §4.1 for the full rationale, reused here unchanged)

**`Service.active` semantics (resolved M3 round 1):** `active` means "not administratively retired," not "available for a new booking" — this is Option B from the M3 review, chosen because `catalog` is an administrative module, not a booking-facing one. `ListServices`/`GetService` (Catalog's own reads) return both active and inactive services unconditionally; this slice adds no `activeOnly` argument and no separate `availableServices` query, because Catalog itself has no consumer that needs one yet. A downstream module that needs "services available for a new booking" (concretely, M5 Bookings) is responsible for filtering to `active: true` on its own side of the module boundary — Catalog's read contract does not do that filtering for it. `GetActivePricing`/`activePricing` also do not check `Service.active`: an inactive service that still has an active `PricingRule` is a valid, well-defined state (e.g. a retired service's historical price remains queryable), not an error.

`Service` does **not** contain a `priceMinorUnits` field — price lives exclusively on `PricingRule` (see below); this is a deliberate separation, not an omission (§5).

`AddOn`:
- `id: string` (UUID, generated; not client-settable)
- `name: string` (required, non-empty after trimming; **MUST be unique, case-insensitively** — see §4.7)
- `description: string | null` (optional free text, e.g. "Clean interior-facing windows up to 6 panels" — mirrors `Service.description`; added M3 round 1)
- `priceMinorUnits: number` (required, positive integer — see §5 for why money is an integer, and why it is not named `priceCents`)
- `active: boolean` (default `true` at creation; added M3 round 1 — lets a discontinued add-on be retired without deleting it or permanently blocking `name` uniqueness for a future, differently-priced replacement)
- `createdAt: Date`, `updatedAt: Date` (set on every successful `updateAddOn` invocation, same convention as `Service`)

**`AddOn` now has full lifecycle parity with `Service`: create, read, and update (including retiring it via `active`), still no delete** — this corrects the initial draft's model, where `AddOn` had a unique `name` and no update path at all, making a real-world price correction or rename impossible without either mutating history silently or permanently blocking the name for a replacement row. See §5 for the full rationale.

`PricingRule`:
- `id: string` (UUID, generated; not client-settable)
- `serviceId: string` (foreign key to `Service.id`; required; immutable after creation — a `PricingRule` is never reassigned to a different `Service`)
- `priceMinorUnits: number` (required, positive integer)
- `active: boolean` (set internally by `CreatePricingRule`'s deactivate-then-insert transaction, §4.2; **not** a client-settable input field — there is no way to directly flip a `PricingRule`'s `active` value)
- `createdAt: Date` (set once at creation; not client-settable)

**`PricingRule` is append-only (made explicit M3 round 1).** Once created, a `PricingRule`'s `serviceId`, `priceMinorUnits`, and `createdAt` are never mutated by any operation in this module. The only state transition an existing `PricingRule` row ever undergoes is its `active` flag flipping from `true` to `false`, performed exclusively and transactionally by a *later* `CreatePricingRule` call establishing a new active price for the same service (§4.2) — never a direct, standalone mutation, and never anything other than that one transition. `PricingRule` deliberately carries **no `updatedAt` field** — the only entity in this codebase without one. Giving it one would misleadingly suggest the row supports general-purpose editing, which it structurally cannot; for an append-only price-history model, `createdAt` alone is the meaningful timestamp.

At most one `PricingRule` per `serviceId` may have `active = true` at any time. Inactive `PricingRule` rows are retained, never deleted, forming an implicit price history — even though no query exposes that history in Phase 1 (§2).

The `PricingRule.serviceId → Service.id` foreign key does not cascade-delete on `Service` removal — moot in this slice specifically because no delete operation exists for `Service` (§2), but the FK's `ON DELETE` policy is still explicitly `RESTRICT` (the database's default-deny), matching the Cleaners spec's precedent of deciding this explicitly rather than inheriting a default. Following that same precedent, `PricingRule.serviceId` is a plain `@Column({ type: 'uuid' })` with no TypeORM relation decorator — the FK constraint is hand-added to the migration's raw SQL.

### 4.2 Application layer

Mirrors the `customers`/`cleaners` modules' `application/commands` + `application/services` split, with one service per domain object: `ServicesService`, `AddOnsService`, `PricingRulesService`. Each mutation method below owns its own transaction boundary: the entity write and the corresponding `AuditLogger.log()` call MUST execute within one database transaction, per the Admin Foundation transactional-audit rule — a restatement of an existing, Accepted contract, not a new one. Every name-uniqueness check below (`Service.name`, `AddOn.name`) trims the input before validating and comparing case-insensitively (§4.7).

- `CreateServiceCommand` → `ServicesService.createService` — creates with `active: true`. Throws `ConflictException` if `name` collides (case-insensitively) with an existing `Service` (§4.7).
- `UpdateServiceCommand` → `ServicesService.updateService` — partial-update semantics, identical shape to the Cleaners spec's `updateCleaner`: `UpdateServiceInput` fields are all optional; an omitted field retains its current value. Uses `manager.update()`, **not** `Object.assign(entity, changes)` + `manager.save(entity)` — TypeORM's `save()` diffs the in-memory entity against the persisted row and can produce a no-op `UPDATE` (no `updatedAt` bump) for a call that resubmits already-current values. This slice adopts that lesson from the Cleaners slice's M5 review from the outset, rather than repeating the mistake and catching it in a later review round. Throws `NotFoundException` if `id` does not exist; `ConflictException` if a provided `name` collides (case-insensitively) with a different existing `Service`. Every successful call bumps `updatedAt` and emits its audit event unconditionally — the same cross-module convention the Cleaners spec §4.4 establishes, reused here without re-litigation.
- `ServicesService.getService(id)` — returns `null` if `id` does not exist; `ServicesService.listServices()` — returns the full set, active and inactive alike (§2, §4.1).
- `CreateAddOnCommand` → `AddOnsService.createAddOn` — creates with `active: true`. Throws `ConflictException` if `name` collides (case-insensitively) with an existing `AddOn` (§4.7).
- `UpdateAddOnCommand` → `AddOnsService.updateAddOn` — partial-update semantics and `manager.update()` usage identical to `updateService` above, added M3 round 1. Throws `NotFoundException` if `id` does not exist; `ConflictException` if a provided `name` collides (case-insensitively) with a different existing `AddOn`. Every successful call bumps `updatedAt` and emits its audit event unconditionally, same convention as `updateService`.
- `AddOnsService.listAddOns()` — returns the full set, active and inactive alike, same reasoning as `listServices` (§4.1).
- `CreatePricingRuleCommand` → `PricingRulesService.createPricingRule(serviceId, priceMinorUnits)` — throws `NotFoundException` if `serviceId` does not reference an existing `Service`. Within one transaction: `manager.update(PricingRuleEntity, { serviceId, active: true }, { active: false })` (deactivates whatever is currently active for this service — a no-op `UPDATE` affecting 0 rows if none is currently active), then inserts the new `PricingRuleEntity` with `active: true`. **This operation's concurrency safety comes from PostgreSQL's own unique-index conflict detection under concurrent transactions, not from the application transaction's isolation level alone** (clarified M3 round 1): two concurrent `createPricingRule` calls for the same `serviceId` may both execute their deactivate step and both attempt their insert step before either commits, each believing it is the only writer; the partial unique index (§4.7) is what guarantees only one of the two inserts can ever succeed. The losing call's insert fails with a Postgres `23505` unique-violation, translated to `ConflictException('Pricing for this service was just updated — please retry')`, reusing the codebase's existing unique-violation-translation pattern (§4.7) for a concurrency-safety purpose rather than its usual duplicate-value purpose. Exactly one audit event is logged (`pricing_rule.create`) — the previous rule's deactivation is not independently audited, the same "one business action, one event" reasoning the Cleaners spec applies to `assignCleanerToTeam`'s reassignment case.
- `PricingRulesService.getActivePricing(serviceId)` — throws `NotFoundException` if `serviceId` does not reference an existing `Service`; otherwise returns the active `PricingRule` for that service, or `null` if the service exists but has never had one created. **This method is the single application-layer entry point for "what is the current price of this service"** (stated explicitly M3 round 1): both the standalone `activePricing(serviceId)` GraphQL query and the `Service.activePricing` computed field (§4.5) resolve through this same method — neither introduces its own separate repository query path.

### 4.3 RBAC (`@Roles()` matrix)

Every operation requires `AuthGuard` (authentication). No operation in this module is public.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / update service | ✓ | ✓ | | | | |
| Create / update add-on | ✓ | ✓ | | | | |
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
| `updateAddOn` | `add_on.update` | `add_on` | `AddOn.id` |
| `createPricingRule` | `pricing_rule.create` | `pricing_rule` | new `PricingRule.id` |

`createPricingRule`'s audit event is scoped to the new `PricingRule`'s own id, not the `Service` it prices — consistent with "the audit event describes the row that was created," the same convention the Cleaners spec applies. The deactivated previous rule is not separately referenced in `metadata` — no audit event in this codebase currently carries mutation-specific metadata beyond the four required fields (e.g. no `previousPriceMinorUnits`/`newPriceMinorUnits` pair), and introducing that pattern here would be new scope, not a reuse of an existing one; it remains a reasonable future addition, not adopted now.

**Failure semantics are inherited from the Admin Foundation `AuditLogger` contract, unchanged, not redesigned here:** all five mutations above MUST persist their audit event within the same database transaction as the state change they describe. No new audit failure behavior, retry logic, or async/queued delivery is introduced.

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
- `updateAddOn(id: ID!, input: UpdateAddOnInput!): AddOn!`
- `createPricingRule(input: CreatePricingRuleInput!): PricingRule!` — changed from positional `(serviceId: ID!, priceMinorUnits: Int!)` arguments to an input object in M3 round 1, for consistency with every other mutation in this module and this codebase, and so a future field (e.g. an effective-date) can be added to `CreatePricingRuleInput` without changing the mutation's shape. `CreatePricingRuleInput` carries exactly `serviceId: ID!` and `priceMinorUnits: Int!` in this slice — no new fields beyond what §4.2 already specifies.

`Service` GraphQL type additionally exposes an `activePricing: PricingRule` (nullable) computed field, backed by `PricingRulesService.getActivePricing(service.id)` — the same application-layer method the standalone `activePricing` query uses (§4.2). This is **presentation-layer computed data only** — not a field of the `Service` domain object itself (§4.1) — the same category as the Cleaners spec's `Cleaner.team`. **Resolving `services { activePricing { priceMinorUnits } }` over N services MUST NOT issue N separate `getActivePricing` calls** — the same N+1 invariant the Cleaners spec §4.5 states, carried forward unchanged: the implementation MUST batch or otherwise consolidate these lookups; no specific mechanism (e.g. DataLoader) is mandated by this specification.

`priceMinorUnits` is exposed on both the `AddOn` and `PricingRule` GraphQL types as a raw `Int!`. Currency formatting (e.g. rendering `150000` as `₱1,500.00`) is `apps/web`'s concern, not the GraphQL schema's (§2, §5).

### 4.6 Web UI

- `/catalog` — service list (`DataTable` from `packages/ui`): name, duration, active badge, active price (via `activePricing.priceMinorUnits`, formatted client-side); create-service form.
- `/catalog/[id]` — service detail: edit form (name, description, durationMinutes, active); current active price display; a "set new price" form that calls `createPricingRule` — there is no editable price field on the service-edit form itself, consistent with §4.2's create-not-edit pricing model.
- `/catalog/add-ons` — add-on list (`DataTable`: name, price, active badge) + create-add-on form, link to detail.
- `/catalog/add-ons/[id]` — add-on detail: edit form (name, description, priceMinorUnits, active) — added M3 round 1 alongside `UpdateAddOn`.
- Route-group auth gate: `apps/web/middleware.ts`'s `matcher` is extended to include `/catalog` and `/catalog/:path*`, using the same UX-hint-only cookie-presence check already in place for `/admin`, `/customers`, and `/cleaners`. The API's `@Roles()` guards remain the authoritative enforcement point.
- Forms use `FormField` from `packages/ui`; no screen hand-rolls its own inputs.

### 4.7 Validation invariants

- `Service.name` MUST be non-empty after trimming leading/trailing whitespace (normalized via `.trim()` before validation and persistence) at creation and, per the partial-update semantics in §4.2, in the resulting entity state after any update. MUST be unique **case-insensitively** — `"Standard Clean"`, `"standard clean"`, and `"STANDARD CLEAN"` may not coexist (changed from case-sensitive M3 round 1). Enforced at the database layer via a case-insensitive expression unique index (`CREATE UNIQUE INDEX ... ON service (LOWER(name))`, hand-added to the migration's raw SQL — TypeORM's `@Column({ unique: true })` cannot express a functional index) and translated at the application layer from the Postgres `unique_violation` (`23505`) into `ConflictException('Service name is already in use')`. The application layer also performs its own case-insensitive existence check before insert/update so the common-case error path is a clean `ConflictException` rather than a raw driver error; the database index remains the actual authority under concurrent requests.
- `Service.durationMinutes` MUST be a positive integer (`> 0`) at creation and in the resulting entity state after any update.
- `AddOn.name` MUST be non-empty after trimming and unique **case-insensitively**, enforced the same way as `Service.name` (own expression unique index, `ConflictException('Add-on name is already in use')`).
- `AddOn.priceMinorUnits` MUST be a positive integer (`> 0`) at creation and after any update — a zero-value add-on is not a meaningful catalog entry in Phase 1.
- `PricingRule.priceMinorUnits` MUST be a positive integer (`> 0`), same reasoning.
- `PricingRule.serviceId` MUST reference an existing `Service` — enforced at the application layer (`NotFoundException`, §4.2) and at the database layer (FK constraint, hand-added to the migration's raw SQL, no TypeORM relation decorator, per §4.1).
- **At most one active `PricingRule` per `serviceId`** — enforced by a partial unique index (`CREATE UNIQUE INDEX ... ON pricing_rule ("serviceId") WHERE active = true`, hand-added to the migration's raw SQL) plus the application-layer deactivate-then-insert transaction (§4.2). This was the first uniqueness invariant in this codebase that is conditional (`WHERE active = true`) rather than a plain column-level `@Column({ unique: true })`; M3 round 1 added the case-insensitive `Service.name`/`AddOn.name` expression indexes as a second kind of non-decorator-expressible constraint. Both are hand-added to the migration, the same escape hatch already used for the FK constraints in this and the Cleaners module.
- `NotFoundException`/`ConflictException` (both `@nestjs/common`) are used directly in `ServicesService`/`AddOnsService`/`PricingRulesService`, matching `AdminsService`/`CustomersService`/`CleanersService` today. This specification does not introduce module-specific domain error types.

## 5. Rationale

- **Price lives on `PricingRule`, not `Service`** — separating "what is sold" (`Service`) from "what it currently costs" (`PricingRule`) gives Catalog a clean price-history shape (inactive rows retained, §4.1) without ever mutating a price in place, which is exactly what M5 Bookings needs: a booking snapshots a price at booking time, and a later price change must not retroactively alter what a historical booking appears to have cost (Phase 1 Design §2.3). Putting price directly on `Service` and overwriting it on every price change would make that guarantee harder to reason about later, for no Phase 1 benefit.
- **`priceMinorUnits` as a positive integer, not a decimal/float, and not named around USD** (revised M3 round 1) — avoids floating-point rounding errors at the cent level, a well-established pattern for money columns; naming it `priceCents` in the initial draft coupled the schema to USD terminology for a Philippine product. This is the first money field in this codebase; it establishes that Catalog stores monetary amounts as integer minor units with an implicit single operating currency (PHP), not that a `currency` column exists — a later module (e.g. M5 Bookings) revisiting or extending this into explicit multi-currency support is that module's own specification decision (§7), not automatically inherited from this one.
- **`AddOn` is global, not scoped to specific services** — the simplest model that satisfies the issue's DoD, which names no per-service restriction. A service-to-add-on compatibility list is deferred (§2), not designed against — if a real operational need for it emerges, that is a new, separately-specified capability.
- **`durationMinutes` and `Service.active` are specification-authored additions beyond the issue's own bullet list** — see §4.1's inline rationale for each; both are minimal, clearly within "what Clensy sells" scope, and needed by concrete downstream consumers (scheduling in M5/M6, hiding a discontinued service).
- **`AddOn` gained `UpdateAddOn`, `active`, and `description` in M3 round 1** — the initial draft's rationale ("the issue's DoD lists no add-on update operation, so omit the field entirely rather than add a mutator-less one") was self-consistent but wrong about the underlying business need: with a unique `name` and no update path at all, a real-world price correction would have had no legal move — not "update," not "deactivate and recreate," not even "delete and recreate," since no delete operation exists either. The issue's narrow DoD wording did not anticipate that combination of constraints compounding into a permanently-stuck catalog record. `AddOn` now mirrors `Service`'s lifecycle shape exactly (create, read, update, no delete), which is also the more internally consistent design within this module — there was no principled reason for `AddOn` to have a different mutability model than `Service` in the same catalog.
- **`Service.active` means "not retired," and Catalog's own reads are unfiltered (Option B, resolved M3 round 1)** — `catalog` is an administrative module; forcing every list/get to hide inactive rows would make it harder to audit or reactivate a retired service. The alternative (Option A: `active` means "bookable," with `ListServices` filtering by default) would couple Catalog's own read contract to a booking-specific meaning it doesn't yet have a stated need for. The boundary is explicit: Catalog exposes the state, a future consumer applies the interpretation it needs.
- **`PricingRule` kept as its current name, not renamed to `ServicePricing` (considered, not adopted, M3 round 1)** — the reviewer noted the current model has no actual "rules" (formulas, tiers, property-size/day-of-week factors) and is really just a price version. That's accurate for what this slice ships. The name was kept anyway because it is deliberately aspirational: `PricingRule` names the shape this object is designed to grow into (§2's deferred tiered/formula-driven pricing) without a rename later, when that scope actually lands, forcing every reference across the codebase to change again. This is a naming bet, not a load-bearing contract decision — a future specification is free to revisit it when actual rule logic is added.
- **`Service.name`/`AddOn.name` uniqueness made case-insensitive, with trimming (M3 round 1)** — a plain case-sensitive unique constraint would let `"Standard Clean"` and `"standard clean"` coexist as distinct catalog rows, which is a data-integrity gap for names that exist to be human-selected (in `apps/web` dropdowns and elsewhere), not machine keys. An expression unique index on `LOWER(name)` is the DB-level authority; the application layer's own case-insensitive pre-check exists only to produce a clean `ConflictException` instead of a raw driver error in the common case.
- **RBAC read access is broader here than in the Cleaners spec** — a deliberate divergence, not an inconsistency: pricing and catalog data is need-to-know across most of the org in a way workforce identity data is not (§4.3). Writes remain restricted to Owner/Ops Manager in both modules, for the same managerial-decision reasoning.
- **Partial unique index for "at most one active `PricingRule` per service," with its concurrency guarantee stated explicitly (M3 round 1)** — the first conditional/partial uniqueness invariant in this codebase (§4.7); it reuses the existing `23505` → `ConflictException` translation pattern, applied here for concurrency safety rather than its usual duplicate-value purpose. The specification is now explicit (§4.2) that the guarantee comes from PostgreSQL's own index-conflict detection under concurrent transactions, not from application-level transaction isolation alone — a distinction worth stating because the deactivate-then-insert sequence, read on its own, could otherwise be mistaken for a self-sufficient serialization mechanism.
- **`createPricingRule` uses an input object, not positional arguments (M3 round 1)** — brings it in line with every other mutation in this specification and this codebase, and leaves room for a future field (e.g. an effective-date) without changing the mutation's shape.
- **`manager.update()` adopted for `updateService`/`updateAddOn` from the outset** — applies the lesson learned in the Cleaners slice's M5 round 3 review immediately, rather than waiting for a review round to catch the same mistake again in a new module.
- **No REST surface** — GraphQL-only is the Phase 1 default for every module without a pre-existing REST consumer (`bookings` is the sole legacy exception); `catalog` has none.

## 6. Acceptance criteria (for this specification)

- The domain objects, application operations, RBAC matrix, audit mapping, and GraphQL surface are confirmed correct against the project owner's intent, including the price-lives-on-`PricingRule`-not-`Service` decision and the `AddOn`-is-global decision (§4.1, §5).
- No open contradiction with the Accepted Phase 1 Design, Admin Foundation, or Cleaners & Teams specifications.
- Scope boundaries (§2) are explicit enough that M4 Implementation Planning does not need to make further scope decisions.
- `AddOn`'s lifecycle (create, read, update via `active`/`description`/`priceMinorUnits`/`name`, no delete) is confirmed to match `Service`'s shape, resolving the M3 round 1 immutability defect.
- `Service.active`'s "not retired, Catalog reads unfiltered" semantics (Option B) are confirmed, including that filtering to bookable-only services is explicitly a downstream consumer's responsibility, not this module's.
- Money representation (`priceMinorUnits` as a positive integer, no `currency` column, PHP implicit for Phase 1) is explicitly decided, not left ambiguous.
- The "at most one active `PricingRule` per service" invariant, its enforcement mechanism (partial unique index + transactional deactivate-then-insert + `23505` translation), and its concurrency guarantee's actual source (the database index, not application transaction isolation) are explicitly confirmed.
- Case-insensitive, trimmed uniqueness for `Service.name`/`AddOn.name` is explicitly confirmed as the enforced behavior.
- `durationMinutes` and `Service.active`, the two specification-authored additions beyond the issue's own bullet list, are confirmed (§4.1, §5).
- The kept-as-is `PricingRule` naming decision (§5) is acknowledged, not silently reopened, in M4 planning.

## 7. Non-goals

- Redesigning any Admin Foundation or Cleaners & Teams contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, the `manager.update()`/N+1/unique-violation-translation patterns) — all consumed or reused as-is.
- Any `modules/bookings` change — pricing-snapshot consumption is M5's concern per Phase 1 Design §4 dependency order; this slice does not touch `modules/bookings`.
- Service-to-`AddOn` attachment rules, tiered/date-effective/property-size-based pricing formulas, a price-history query, currency formatting/localization, and pagination/search/filtering — all explicitly deferred per §2/§4.1/§4.5/§4.7.
- Multi-currency support (an explicit `currency` field/column, or per-service/per-add-on currency selection) — Phase 1 assumes a single implicit operating currency (PHP); `priceMinorUnits` stores only an integer amount. Introducing multi-currency is a later, separately-specified change (§5), not automatically implied by the `MinorUnits` naming.
- Renaming `PricingRule` — considered and explicitly declined in this round (§5); revisit only if/when actual tiered or formula-driven pricing logic is added, not preemptively.
