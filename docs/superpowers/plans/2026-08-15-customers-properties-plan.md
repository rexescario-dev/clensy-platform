# Customers & Properties: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-08-15 |
| **Tracking** | [#2](https://github.com/rexescario-dev/clensy-platform/issues/2) (milestone M2 — Customers & Properties) |
| **Package/repo scope** | `apps/api` (new: `modules/customers`; modified: `app/app.module.ts`, `platform/database/data-source.ts`); `apps/web` (new: `/customers`, `/customers/[id]`; modified: `middleware.ts`); `packages/client` (new operation documents + regenerated codegen output) |
| **Depends on (Accepted)** | [Customers & Properties Specification](../specs/2026-08-15-customers-properties-design.md) — Status: Accepted, 2026-08-15. Also relies on the already-Accepted [Admin Foundation Specification](../specs/2026-08-14-admin-foundation-design.md) and [plan](2026-08-14-admin-foundation-plan.md) for `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`/`runAuditInTransaction`, and the `apps/web` bootstrap (Next.js, Apollo Client, `packages/ui`) they already shipped — none of that is re-implemented here. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |
| **Revision note** | First M5 pass returned the draft for targeted correction (not a redesign): the `AuditLogger` injection/`runAuditInTransaction` call shape was made explicit against the real `AdminsService` code rather than described abstractly; resulting-state non-empty validation was given an actual enforcement location (`CustomersService`/`PropertiesService.assertValid`, application-layer, not domain or GraphQL-only); the transaction-rollback test was split out of the mocked unit-test level into a real-Postgres service-level test (mirroring `admins.service.e2e-spec.ts`, including a new advisory-lock helper), since a mock cannot prove a real rollback — the same test-level mistake the Admin Foundation slice made and later corrected at its M7 review. Recommended items also applied: a `PartialType` schema-exclusion test for `UpdatePropertyInput`/`customerId`; an explicit no-DataLoader/N+1 tradeoff note; a complete UI field inventory (`notes`, `addressLine2`, `accessNotes`); a manual acceptance checklist for the web screens; a `PropertyResolver`-specific e2e step and an Analyst-role e2e check; explicit migration-authority wording for the hand-added FK constraint; and reworded §2/§3 headers so "spec-derived" no longer overstates constraints that are actually M4 clarification decisions. |
| **M5 decision** | **Accepted** — 2026-08-15. No remaining blockers. Ready for M6 Implementation. |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement exactly what the Accepted specification authorizes: `modules/customers` (`Customer`, `Property` domain objects; `CustomersService`/`PropertiesService` application layer; TypeORM infrastructure; GraphQL presentation per spec §4.5), gated by the existing `AuthGuard`/`@Roles()` per spec §4.3, audit-logged per spec §4.4, and the `apps/web` `/customers` + `/customers/[id]` screens per spec §4.6. Not a redesign of any of it — every behavioral decision below traces to the Accepted spec or is called out explicitly as an M4 implementation choice the spec deliberately left open.

## 2. Constraints (SHALL / SHALL NOT)

Not every constraint below is a verbatim restatement of the spec — some are M4 clarification decisions the spec deliberately left open (partial-update mechanics, exact exception types, the `ON DELETE` policy). Each is cited to a spec section where the *behavior* is normative; where the citation says "implements §X," the specific mechanism is this plan's choice, not the spec's. §3 collects the M4-only decisions separately for anything not directly traceable this way.

**SHALL** (traced to spec section):
- `Customer` domain object has no `properties` field; `Property` is reached only via `PropertiesService.listCustomerProperties`, never a domain- or ORM-level relation (§4.1, §4.5).
- `Property.customerId` is immutable after creation — no operation reassigns a property to a different customer in this slice (§4.1, §4.2).
- `Property.customerId → Customer.id` foreign key policy is `ON DELETE RESTRICT`, never `CASCADE` (§4.1).
- `id`, `createdAt`, `updatedAt` on both entities are server-generated and never accepted as client input on any mutation (§4.1).
- `updateCustomer`/`updateProperty` use **partial-update semantics**: omitted input fields retain their current value; provided fields are applied; the resulting full entity state is revalidated against §4.7's non-empty invariants (§4.2, §4.7).
- `getCustomer`/`getProperty` return `null` when the id does not exist; `updateCustomer`/`updateProperty`/`createProperty` throw `NotFoundException` when their target/parent id does not exist; `listCustomerProperties` throws `NotFoundException` when `customerId` does not exist (§4.2).
- `Customer.email`'s domain invariant is non-empty only; syntax validation is a presentation/input-layer concern, not a domain rule (§4.7).
- Every operation requires `AuthGuard`; no operation in this module is public (§4.3).
- `@Roles()` per the matrix in spec §4.3: Owner/Ops Manager/Customer Support may create and update customers and properties; Owner/Ops Manager/Scheduler/Customer Support/Analyst may view (get/list); Finance has no access in this slice.
- Each successful mutation (`createCustomer`, `updateCustomer`, `createProperty`, `updateProperty`) produces exactly one audit event, persisted in the same database transaction as its state change, using the existing `runAuditInTransaction` mechanism from `platform/audit` — a failed audit write rolls back the state change with it (§4.4, inherited from Admin Foundation spec §4.6). No new audit failure behavior, retry logic, or async delivery is introduced. See §3 for the exact call shape (identical to `AdminsService`'s, not a new mechanism).
- Audit `action`/`entityType` values are exactly: `customer.create`/`customer`, `customer.update`/`customer`, `property.create`/`property`, `property.update`/`property` (§4.4).
- GraphQL surface is exactly: `customer`, `customers`, `property`, `customerProperties`, `createCustomer`, `updateCustomer`, `createProperty`, `updateProperty` — no others (§4.5). `Customer.properties` is a GraphQL-only computed field resolved via `PropertiesService.listCustomerProperties(customer.id)`.
- GraphQL object types are explicitly-defined presentation types, not domain interfaces or TypeORM entities used directly (matches the Admin Foundation precedent this spec inherits).
- `/customers` and `/customers/:path*` are added to `apps/web/middleware.ts`'s route-group matcher, using the same cookie-presence-only UX-hint check already in place for `/admin` — no new auth mechanism (§4.6).
- One e2e covers create customer → add property → list, per spec §2/Phase 1 Design §5.

**SHALL NOT** (explicit spec/design non-goals — do not invent):
- No delete/deactivate operation for `Customer` or `Property` (spec §2).
- No change to `modules/bookings` (spec §2, §7).
- No customer-facing authentication or account (spec §2).
- No deduplication, uniqueness enforcement on email/phone, search, filtering, sorting, or pagination beyond a full-set list (spec §2).
- No standalone/global property list or `properties` module (spec §2).
- No geocoding, map display, or external address validation (spec §2).
- No REST surface for this module (spec §2, §5).
- No redesign of any Admin Foundation contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, session/JWT mechanics) (spec §7).

## 3. Implementation decisions (M4 choices)

The specification leaves these implementation details open; this plan fixes them for M6 execution so no implementer has to choose alone:

- **No TypeORM relation decorator anywhere for `Property.customerId`.** The column is a plain `@Column({ type: 'uuid' })`, and the foreign key constraint (`REFERENCES customer_entity(id) ON DELETE RESTRICT`) is added directly in the migration's raw SQL, not via `@ManyToOne`/`@OneToMany`. This is the concrete implementation of spec §4.5's ban on an ORM relation existing "merely to support GraphQL nesting" — using `@ManyToOne` even one-directionally would invite a later, easy addition of the reciprocal `@OneToMany` on `CustomerEntity`, which is exactly what the spec forbids. `PropertiesService` queries by `customerId` directly (`findBy({ customerId })`), never through a relation.
- **`UpdateCustomerInput`/`UpdatePropertyInput` use `PartialType(CreateXInput)`** (`@nestjs/graphql`), the same mechanism already used for `UpdateBookingInput extends PartialType(CreateBookingInput)`. Unlike `UpdateBookingInput`, neither adds an `id` field — the Accepted spec's GraphQL surface (§4.5) takes `id` as a separate mutation argument (`updateCustomer(id: ID!, input: UpdateCustomerInput!)`), matching `disableAdmin(id: ID!)`'s pattern, not `updateBooking`'s embedded-id pattern. `UpdatePropertyInput` never gains a `customerId` field at all (immutable, §2 above).
- **Resolver-to-command mapping MUST use object spread (`{ ...input, actorId }`), never manual per-field listing (`fullName: input.fullName, ...`).** `bookings`' `BookingResolver.updateBooking` builds its command by manually re-listing every field; for a fully-optional `PartialType` input, that pattern materializes an explicit `key: undefined` for every field the caller omitted, and the service's `Object.assign(entity, command)` would then overwrite the entity's existing value with `undefined` — silently violating this module's omitted-fields-retain-current-value guarantee (spec §4.2). Object spread only copies keys actually present in the parsed GraphQL input, which is the correct behavior here. This is a real, concrete divergence from the `bookings` precedent, made explicit so no implementer copies the unsafe pattern.
- **`CustomersService`/`PropertiesService` follow the `AdminsService` transaction/audit pattern exactly** — both the transaction wrapper *and* the audit call within it, since the two are easy to describe separately but are only correct together. Concretely, for each mutation:
  ```ts
  async create(command: CreateCustomerCommand): Promise<Customer> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(CustomerEntity, { /* ...fields */ });
        await manager.save(entity);
        await this.auditLogger.log({ actorId: command.actorId, action: 'customer.create', entityType: 'customer', entityId: entity.id });
        return entity;
      }),
    );
  }
  ```
  `runAuditInTransaction(manager, fn)` itself does not call `.log()` — it only stashes `manager` in `AsyncLocalStorage` for the duration of `fn` (see `platform/audit/infrastructure/audit-logger.service.ts`). The `this.auditLogger.log(...)` call inside `fn` is what actually persists the event, and it is the same `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger` constructor-injected dependency `AdminsService` uses — nothing new. `AuditLoggerService.log()` internally detects the ambient `manager` `runAuditInTransaction` set up and writes through it, which is what makes the audit write and the entity write share one transaction (and roll back together on failure). This is the entire mechanism; `CustomersService`/`PropertiesService` do not implement any transaction-detection logic of their own. `BookingsService`'s pattern (injected `Repository`, no transaction) is not followed here, because `bookings` predates Admin Foundation's audit integration and never had this constraint. Reads (`getCustomer`, `getProperty`, `listCustomers`, `listCustomerProperties`) use plain injected `Repository`s — no transaction needed for reads.
- **Resulting-state validation lives in the application service, not the domain layer and not GraphQL alone.** `domain/customer.ts`/`domain/property.ts` stay plain interfaces with no framework dependency (spec §2's "plain TS" requirement) and therefore cannot themselves throw a NestJS exception. `class-validator` decorators on `CreateCustomerInput`/`CreatePropertyInput` (inherited as optional by `UpdateCustomerInput`/`UpdatePropertyInput` via `PartialType`) validate only the fields a caller actually provided in a given request — they cannot express "the fields this update left untouched were already valid," and a service method is a public application-layer contract that must not assume its only caller is this GraphQL resolver. `CustomersService` therefore gets a private `assertValid(customer: Pick<Customer, 'fullName' | 'email' | 'phone'>): void` (throws `BadRequestException` — the same exception family `NotFoundException`/`ConflictException` already used by `AdminsService` belongs to — if `fullName`, `email`, or `phone` is empty/whitespace-only after `.trim()`), called on the merged entity state in both `create` (after building the new entity) and `update` (after `Object.assign(entity, command)`, before `save`). `PropertiesService` gets the equivalent `assertValid` checking `label`, `addressLine1`, `city`, `region`, `postalCode`. This is a new pattern for this codebase (no existing service currently re-validates field shape at the application layer — `AdminsService`/`BookingsService` only ever check existence/business-rule invariants there), introduced specifically because this module is the first to combine partial-update semantics with non-empty domain invariants; it does not change how `bookings`/`admins` work.
- **Email syntax validation**: `@IsEmail()` (`class-validator`) on `CreateCustomerInput.email`, consistent with spec §4.7's presentation-layer-only placement. No domain- or application-layer email format check — `assertValid` above checks only non-emptiness, matching the spec's explicit domain/presentation split.
- **`Property.customerId` gets a plain (non-unique) index** (`@Index()` on the column) — a reasonable default for a foreign-key column that every `listCustomerProperties` call filters on; not spec-mandated, low-risk, and consistent with normal indexing practice for this access pattern.
- **Two migrations, not one** — `AddCustomer` (Task 1) and `AddProperty` (Task 2, adds the FK to the already-existing `customer_entity` table) — mirrors the Admin Foundation plan's precedent of independently reviewable/revertible migrations per task, and matches this plan's own two-task Customer→Property sequencing (§5). Because `PropertyEntity.customerId` carries no TypeORM relation metadata (previous bullet), `pnpm migration:generate` cannot infer the foreign key — it only diffs entity column/table metadata. The generated `AddProperty` migration therefore only produces the table/column baseline; the FK constraint (`ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE RESTRICT`, and its `DROP CONSTRAINT` in `down()`) is hand-added and becomes part of the committed, authoritative migration file. If entity definitions change later and `migration:generate` is re-run to produce a *new* migration for that change, it must not be used to regenerate/replace this one — the hand-added constraint has no entity-metadata source to regenerate from and would silently disappear.
- **No DataLoader or batched loading for `Customer.properties`.** `customers { properties { ... } }` performs one `listCustomerProperties` query per customer in the result set (N+1), which is acceptable at Phase 1's customer volume and matches the spec's explicit non-goal of building any performance infrastructure this slice doesn't need (§2's search/filter/pagination deferral). This is a deliberate, recorded tradeoff — revisit with a DataLoader (or a join-based batch query) only if nested customer/property reads demonstrate an actual performance problem, not preemptively.
- **No new environment variables or secrets** — this slice introduces no new configuration surface.

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/modules/customers/**` (new) | `apps/api/src/modules/bookings/**` |
| `apps/api/src/app/app.module.ts` (composition root — registers `CustomersModule`) | `apps/api/src/platform/auth/**`, `apps/api/src/platform/audit/**` (consumed read-only, not modified) |
| `apps/api/src/platform/database/data-source.ts` (add new entities) | `apps/api/src/modules/admins/**` |
| `apps/web/app/customers/**` (new) | `apps/web/app/admin/**`, `apps/web/app/login/**` |
| `apps/web/middleware.ts` (extend `matcher` only) | Everything else in `apps/web/middleware.ts` |
| `packages/client/src/operations/customers.graphql`, `properties.graphql` (new), regenerated `src/generated/graphql.ts` | `packages/client/src/apollo-client.ts`, existing `admins.graphql`/`login.graphql`/etc. |
| — | `packages/ui/**` (consumed as-is; no new primitives needed — `Button`, `DataTable`, `FormField`, `StatusBadge` already cover this slice's UI) |

## 5. Contract inventory (only what the Accepted spec authorizes)

- `Customer { id, fullName, email, phone, notes, createdAt, updatedAt }` (`modules/customers/domain`)
- `Property { id, customerId, label, addressLine1, addressLine2, city, region, postalCode, accessNotes, createdAt, updatedAt }` (`modules/customers/domain`)
- GraphQL: `customer(id)`, `customers`, `property(id)`, `customerProperties(customerId)`, `createCustomer(input)`, `updateCustomer(id, input)`, `createProperty(customerId, input)`, `updateProperty(id, input)` (spec §4.5) — exactly these 8 operations, no others.

Exact internal service/command/file names beyond the above are implementation detail decided per-task below; the spec does not freeze them further and this plan does not either.

## 6. Slice sequence

```text
1. Customer  — domain, infrastructure, application, migration    (independent)
2. Property  — domain, infrastructure, application, migration    (depends on 1 — FK to customer_entity)
3. GraphQL presentation — CustomerResolver, PropertyResolver      (depends on 1 + 2)
4. apps/api composition root — register CustomersModule           (depends on 3)
5. packages/client operations + apps/web /customers screens       (depends on 4)
6. E2E acceptance                                                  (depends on 1-5)
```

Each numbered task below is an independently reviewable slice. Task 4 (composition root) is intentionally much smaller than the Admin Foundation plan's equivalent (its Task 6): that slice needed a bespoke `AuthModule.forRootAsync(...)` binding to resolve a circular-dependency problem; `CustomersModule` has no such cross-module binding to design — it only needs a single `imports` addition — so Task 4 here is a thin regression-check task, not a near-empty one to fold away.

## 7. TDD / verification strategy

Three test levels, matching the levels the Admin Foundation slice ended up at (its M7 code review found that a "unit" spec asserting real transactional rollback had, in practice, become a real-Postgres integration test wearing a unit-test path — `admins.service.spec.ts`/`admins.service.disable-concurrency.spec.ts` were relocated to `apps/api/test/*.e2e-spec.ts`) rather than repeating that mistake here:

1. **Mocked unit tests** (Jest, `bookings.service.spec.ts`'s mocked-`Repository`/`Test.createTestingModule` pattern) for logic that doesn't depend on real transactional behavior: `CustomersService`/`PropertiesService`'s not-found errors, `getX`/`listX` read paths, and `assertValid`'s rejection of empty fields. A mocked `DataSource`/`EntityManager` cannot prove a real rollback — this level does not attempt to.
2. **Real-Postgres service-level tests** (mirroring `apps/api/test/admins.service.e2e-spec.ts` exactly: a real `DataSource` against the same local Postgres, the service instantiated directly — `new CustomersService(dataSource, repo, auditLogger)` — with only `auditLogger` faked as a `{ log: jest.fn() }`, never the database) for the transactional-audit rollback guarantee (§2's SHALL list) and the partial-update/explicit-null-vs-omitted behavior against real persisted rows — the two things a mock cannot actually prove.
3. **Integration/e2e** (Jest + Supertest against a real Postgres via `AppModule`, mirroring `admin-foundation.e2e-spec.ts`'s use of `apps/api/test/helpers/seed-owner.ts`): the full GraphQL-request-to-database golden path in spec §2 (create customer → create property → list), plus RBAC-denied and view-only cases per the §4.3 matrix — proves the resolver/guard/service wiring end-to-end, which levels 1–2 don't touch.

Level 2 truncates (`.clear()`s) `customer_entity`/`property_entity` in `beforeEach`, mirroring `admins.service.e2e-spec.ts`; per `apps/api/test/helpers/admin-db-test-lock.ts`'s documented reason, that is unsafe to run concurrently with any other Jest spec *file* touching the same tables (Jest runs separate files as separate worker processes by default). Task 1 adds `apps/api/test/helpers/customer-db-test-lock.ts` (identical pattern, new arbitrary advisory-lock key), acquired only by the level-2 file. Level 3 (Task 6) follows `admin-foundation.e2e-spec.ts`'s precedent instead — unique-per-run fixture data (via `seed-owner.ts`) and assertions scoped to specific returned ids ("the list includes this id," never "the list has exactly N items") — so it does not truncate and does not need the lock, matching why `admin-foundation.e2e-spec.ts` itself never needed one either.

No test-framework changes — reuse the existing `apps/api` Jest config (level-1 unit specs under `apps/api/src/modules/customers/tests/`, levels 2–3 under `apps/api/test/`).

## 8. Task breakdown

### Task 1 — `Customer`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/customers/domain/customer.ts` — plain `Customer` interface (§4.1 of spec)
- `apps/api/src/modules/customers/infrastructure/persistence/customer.entity.ts` — TypeORM entity implementing `Customer`. `id` (`@PrimaryGeneratedColumn('uuid')`), `fullName`/`email`/`phone` (`@Column()`), `notes` (`@Column({ type: 'text', nullable: true })`), `createdAt` (`@CreateDateColumn({ type: 'timestamptz' })`), `updatedAt` (`@UpdateDateColumn({ type: 'timestamptz' })`). No relation decorator to `PropertyEntity` (§3 above).
- `apps/api/src/modules/customers/application/commands/create-customer.command.ts` — `{ actorId: string; fullName: string; email: string; phone: string; notes?: string | null }`
- `apps/api/src/modules/customers/application/commands/update-customer.command.ts` — `{ actorId: string; fullName?: string; email?: string; phone?: string; notes?: string | null }`
- `apps/api/src/modules/customers/application/services/customers.service.ts` — `CustomersService`:
  - `create(command)`: opens a transaction via `DataSource.transaction` wrapped in `runAuditInTransaction` (mirroring `AdminsService.create` exactly — §3's code shape); builds the entity's fields from `command` (`notes: command.notes ?? null`); calls `this.assertValid(entity)`; `manager.save(entity)`; `await this.auditLogger.log({ actorId: command.actorId, action: 'customer.create', entityType: 'customer', entityId: entity.id })`; returns the entity.
  - `update(id, command)`: same transaction/audit wrapper; `manager.findOneBy(CustomerEntity, { id })`, throws `NotFoundException('Customer ${id} not found')` if absent; applies `command` onto the entity via `Object.assign(entity, command)` — safe here because `command` is constructed by the resolver via spread (§3 above), so it only carries keys the caller actually provided; calls `this.assertValid(entity)` on the merged result; `manager.save(entity)`; logs `customer.update`; returns the entity.
  - `private assertValid(customer: Pick<Customer, 'fullName' | 'email' | 'phone'>): void` — throws `BadRequestException` if `fullName`, `email`, or `phone` is empty/whitespace-only after `.trim()` (§3's application-layer validation decision).
  - `getCustomer(id)`: injected `Repository<CustomerEntity>.findOneBy({ id })` — returns `null` if absent (no exception).
  - `listCustomers()`: injected `Repository<CustomerEntity>.find()`.
  - Constructor takes `DataSource`, the injected `Repository<CustomerEntity>` (for the two read methods), and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/customers/customers.module.ts` — `@Module({ imports: [TypeOrmModule.forFeature([CustomerEntity])], providers: [CustomersService], exports: [CustomersService] })` (Task 2 extends this with `PropertyEntity`/`PropertiesService`)
- `apps/api/src/modules/customers/tests/application/customers.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)
- `apps/api/test/helpers/customer-db-test-lock.ts` — advisory-lock helper, identical pattern to `admin-db-test-lock.ts` with a new arbitrary lock key; used only by the level-2 file below (§7 — level-3/Task 6 doesn't truncate and doesn't need it)
- `apps/api/test/customers-properties.service.e2e-spec.ts` — real-Postgres service-level tests (test level 2, §7); this task adds the file and its `Customer`/`CustomersService` `describe` block, acquiring/releasing the Task 1 lock helper in `beforeAll`/`afterAll` and `.clear()`-ing `CustomerEntity` in `beforeEach`; Task 2 extends the same file with a `Property`/`PropertiesService` block (and adds `PropertyEntity` to the `beforeEach` clear)

**Files (modified):**
- `apps/api/src/platform/database/data-source.ts` — add `CustomerEntity` to `entities`
- Generate migration: `pnpm migration:generate add customer` → new file under `platform/database/migrations/`

**Tests to write first (TDD) — level 1, `customers.service.spec.ts` (mocked `Repository`):**
- `update`: given a nonexistent `id`, throws `NotFoundException`.
- `assertValid` (exercised via `create`/`update` with a mocked repository): a command producing an empty/whitespace-only `fullName`, `email`, or `phone` throws `BadRequestException` before any repository call.
- `getCustomer`: returns the customer for an existing id; returns `null` for a nonexistent id.
- `listCustomers`: returns all customers (empty array when none exist).

**Tests to write first (TDD) — level 2, `customers-properties.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only — proof patterns identical to `admins.service.e2e-spec.ts`):**
- `create`: persists a `CustomerEntity` with the given fields, `notes` defaults to `null` when omitted; `auditLogger.log` called with `{ actorId, action: 'customer.create', entityType: 'customer', entityId }`. With `auditLogger.log` mocked to reject, `service.create(...)` rejects and the row does not exist afterward (real rollback proof).
- `update`: given an existing persisted customer, a command with only `phone` set leaves `fullName`/`email`/`notes` unchanged in the re-read row and updates only `phone`. A command with `notes: null` explicitly clears an existing `notes` value to `null` in the re-read row (proves the "explicit null clears, omitted key retains" distinction against real persisted state — the one thing a mock cannot demonstrate). With `auditLogger.log` mocked to reject, the update rolls back and the re-read row is unchanged from before the call.

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 2 — `Property`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/customers/domain/property.ts` — plain `Property` interface (§4.1 of spec)
- `apps/api/src/modules/customers/infrastructure/persistence/property.entity.ts` — TypeORM entity implementing `Property`. `id` (`@PrimaryGeneratedColumn('uuid')`), `customerId` (`@Column({ type: 'uuid' }) @Index()`, plain column, no relation decorator — §3 above), `label`/`addressLine1`/`city`/`region`/`postalCode` (`@Column()`), `addressLine2`/`accessNotes` (`@Column({ type: 'text', nullable: true })`), `createdAt`/`updatedAt` (`@CreateDateColumn`/`@UpdateDateColumn`, `type: 'timestamptz'`).
- `apps/api/src/modules/customers/application/commands/create-property.command.ts` — `{ actorId: string; customerId: string; label: string; addressLine1: string; addressLine2?: string | null; city: string; region: string; postalCode: string; accessNotes?: string | null }`
- `apps/api/src/modules/customers/application/commands/update-property.command.ts` — `{ actorId: string; label?: string; addressLine1?: string; addressLine2?: string | null; city?: string; region?: string; postalCode?: string; accessNotes?: string | null }` (no `customerId` field — immutable, §2 above)
- `apps/api/src/modules/customers/application/services/properties.service.ts` — `PropertiesService`:
  - `create(command)`: transaction + `runAuditInTransaction`; `manager.findOneBy(CustomerEntity, { id: command.customerId })`, throws `NotFoundException('Customer ${command.customerId} not found')` if absent (spec §4.7's existence check, done at the application layer before insert); builds the `PropertyEntity`'s fields; calls `this.assertValid(entity)`; `manager.save(entity)`; `await this.auditLogger.log({ actorId: command.actorId, action: 'property.create', entityType: 'property', entityId: entity.id })`; returns the entity.
  - `update(id, command)`: transaction + `runAuditInTransaction`; `manager.findOneBy(PropertyEntity, { id })`, throws `NotFoundException('Property ${id} not found')` if absent; `Object.assign(entity, command)` (same spread-sourced-command safety as `CustomersService.update`); calls `this.assertValid(entity)` on the merged result; `manager.save(entity)`; logs `property.update`; returns the entity.
  - `private assertValid(property: Pick<Property, 'label' | 'addressLine1' | 'city' | 'region' | 'postalCode'>): void` — throws `BadRequestException` if any of those five is empty/whitespace-only after `.trim()` (§3).
  - `getProperty(id)`: injected `Repository<PropertyEntity>.findOneBy({ id })` — `null` if absent.
  - `listCustomerProperties(customerId)`: first checks `Repository<CustomerEntity>.findOneBy({ id: customerId })`; throws `NotFoundException('Customer ${customerId} not found')` if absent (spec §4.2's missing-customer policy for this read path); otherwise `Repository<PropertyEntity>.findBy({ customerId })`.
  - Constructor takes `DataSource`, injected `Repository<PropertyEntity>`, injected `Repository<CustomerEntity>` (for the two existence checks above), and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/customers/tests/application/properties.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)

**Files (modified):**
- `apps/api/src/modules/customers/customers.module.ts` — add `PropertyEntity` to `TypeOrmModule.forFeature([...])`, add `PropertiesService` to `providers`/`exports`
- `apps/api/src/platform/database/data-source.ts` — add `PropertyEntity` to `entities`
- Generate migration: `pnpm migration:generate add property` → new file under `platform/database/migrations/`; hand-edit the generated migration to add the foreign key constraint TypeORM's entity-diff alone won't infer from a plain `@Column` (`ALTER TABLE property_entity ADD CONSTRAINT fk_property_customer FOREIGN KEY ("customerId") REFERENCES customer_entity(id) ON DELETE RESTRICT`, with the matching `DROP CONSTRAINT` in `down()`) — this committed migration is the sole, authoritative source of the FK; per §3, it must not be regenerated from entity metadata later
- `apps/api/test/customers-properties.service.e2e-spec.ts` — extend with the `Property`/`PropertiesService` `describe` block (Task 1 created the file); add `PropertyEntity` to the shared `beforeEach` `.clear()`

**Tests to write first (TDD) — level 1, `properties.service.spec.ts` (mocked `Repository`):**
- `update`: nonexistent `id` throws `NotFoundException`. No test attempts to update `customerId` — the command type has no such field, so this is a compile-time guarantee, not a runtime one.
- `assertValid` (exercised via `create`/`update` with mocked repositories): a command producing an empty/whitespace-only `label`, `addressLine1`, `city`, `region`, or `postalCode` throws `BadRequestException` before any repository call.
- `getProperty`: existing id returns the property; nonexistent id returns `null`.
- `listCustomerProperties`: nonexistent `customerId` throws `NotFoundException` (mocked customer-repository lookup returns `undefined`).

**Tests to write first (TDD) — level 2, `customers-properties.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only):**
- `create`: given a persisted `Customer`, persists a `PropertyEntity` referencing it and calls `auditLogger.log` with `property.create`. Given a nonexistent `customerId`, throws `NotFoundException` and persists no row. With `auditLogger.log` mocked to reject, the property row does not exist afterward (real rollback proof, same pattern as `Customer`'s).
- `update`: partial-update behavior against a real persisted row mirrors the `Customer` case (unset fields retain value; an explicit `null` clears a nullable field like `accessNotes`). With `auditLogger.log` mocked to reject, the update rolls back.
- `listCustomerProperties`: an existing customer with two persisted properties returns both; an existing customer with zero properties returns `[]`.

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 3 — GraphQL presentation

**Files (new):**
- `apps/api/src/modules/customers/presentation/graphql/customer.type.ts` — `@ObjectType('Customer')`: `id` (`ID`), `fullName`, `email`, `phone`, `notes` (nullable), `properties` (`[PropertyType!]!`, resolved exclusively via `@ResolveField` below — the base `CustomerResolver.customer`/`customers`/`createCustomer`/`updateCustomer` methods return a `toCustomerType()`-mapped object typed `Omit<CustomerType, 'properties'>` cast to `CustomerType`, since Apollo calls the field resolver for `properties` independently of whatever the parent object carries for that key — same pattern as any NestJS code-first resolver with a computed field), `createdAt`, `updatedAt`
- `apps/api/src/modules/customers/presentation/graphql/property.type.ts` — `@ObjectType('Property')`: `id`, `customerId` (`ID`), `label`, `addressLine1`, `addressLine2` (nullable), `city`, `region`, `postalCode`, `accessNotes` (nullable), `createdAt`, `updatedAt`
- `apps/api/src/modules/customers/presentation/graphql/create-customer.input.ts` — `@InputType()`: `fullName`, `email` (`@IsEmail()`), `phone`, `notes` (nullable, optional)
- `apps/api/src/modules/customers/presentation/graphql/update-customer.input.ts` — `@InputType() class UpdateCustomerInput extends PartialType(CreateCustomerInput) {}` (no additions — §3 above)
- `apps/api/src/modules/customers/presentation/graphql/create-property.input.ts` — `@InputType()`: `label`, `addressLine1`, `addressLine2` (nullable), `city`, `region`, `postalCode`, `accessNotes` (nullable) — no `customerId` (separate mutation arg)
- `apps/api/src/modules/customers/presentation/graphql/update-property.input.ts` — `@InputType() class UpdatePropertyInput extends PartialType(CreatePropertyInput) {}`
- `apps/api/src/modules/customers/presentation/graphql/customer.resolver.ts` — `CustomerResolver`:
  - `@Query(() => CustomerType, { name: 'customer', nullable: true })` `customer(@Args('id', { type: () => ID }) id)` → `CustomersService.getCustomer`, mapped, `@UseGuards(AuthGuard) @Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.CUSTOMER_SUPPORT, Role.ANALYST)` (view matrix)
  - `@Query(() => [CustomerType], { name: 'customers' })` → `CustomersService.listCustomers`, same guard/roles
  - `@Mutation(() => CustomerType)` `createCustomer` / `updateCustomer` → `@UseGuards(AuthGuard) @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)`, builds the command via `{ ...input, actorId: currentUser.id }` (Task 1/§3), calls `CustomersService.create`/`.update`
  - `@ResolveField(() => [PropertyType], 'properties')` `properties(@Parent() customer: CustomerType)` → `PropertiesService.listCustomerProperties(customer.id)` (§3 above; requires `PropertiesService` injected here too)
- `apps/api/src/modules/customers/presentation/graphql/property.resolver.ts` — `PropertyResolver`:
  - `@Query(() => PropertyType, { name: 'property', nullable: true })`, `@Query(() => [PropertyType], { name: 'customerProperties' })` (`@Args('customerId')`) — same view-matrix guard/roles as `CustomerResolver`'s queries
  - `@Mutation(() => PropertyType)` `createProperty` (`@Args('customerId') @Args('input')`) / `updateProperty` (`@Args('id') @Args('input')`) — same write-matrix guard/roles (`Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT`), same `{ ...input, actorId }` command-building rule
- `apps/api/src/modules/customers/tests/graphql/customer.resolver.spec.ts`, `property.resolver.spec.ts`

**Files (modified):**
- `apps/api/src/modules/customers/customers.module.ts` — add `CustomerResolver`, `PropertyResolver` to `providers`

**Tests to write first (TDD):**
- Resolver-level (assert via Nest's reflected metadata, same technique as `admin.resolver.spec.ts`): `createCustomer`/`updateCustomer`/`createProperty`/`updateProperty` are decorated with `AuthGuard` and `@Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)` (write matrix). `customer`/`customers`/`property`/`customerProperties` are decorated with `AuthGuard` and `@Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.CUSTOMER_SUPPORT, Role.ANALYST)` (view matrix — Finance excluded, per spec §4.3).
- `CustomerType`'s field set matches the domain object plus `properties`; no field leaks anything not in spec §4.1.
- `UpdatePropertyInput`'s field list (via `@nestjs/graphql`'s `getMetadataStorage().collectInputTypeMetadata(UpdatePropertyInput)` or an equivalent introspection of the generated schema) does not include `customerId` — belt-and-suspenders against a future edit accidentally reintroducing it onto the base `PartialType`, given `customerId`'s immutability is an explicit invariant (spec §4.1, §4.2), not just an incidental omission.

**Traceability:** spec §4.3, §4.5.

### Task 4 — `apps/api` composition root

**Files (modified):**
- `apps/api/src/app/app.module.ts` — add `CustomersModule` to `imports`, alongside `AuditModule`, `AdminsModule`, `AuthModule.forRootAsync(...)`, `BookingsModule`. No new cross-module binding is required — `CustomersModule` only consumes `AUDIT_LOGGER` (already globally available the same way `AdminsModule` consumes it) and `AuthGuard`/`@Roles()` (stateless, no module-level wiring needed beyond importing the guard class in the resolver files, exactly as `AdminResolver` already does).
- Run `pnpm migration:run` locally (dev-environment step, not a committed file change beyond the migrations already generated in Tasks 1 and 2).

**Tests:** none new — verification is that the full `AppModule` still boots and the existing `bookings`/`admin-foundation` e2e suites still pass unmodified (regression check).

**Traceability:** ties Tasks 1–3 into the running application; no new spec surface.

### Task 5 — `packages/client` operations + `apps/web` `/customers` screens

**Files (new):**
- `packages/client/src/operations/customers.graphql` — `query Customers { customers { id fullName email phone } }`, `query Customer($id: ID!) { customer(id: $id) { id fullName email phone notes properties { id label addressLine1 addressLine2 city region postalCode accessNotes } } }`, `mutation CreateCustomer($input: CreateCustomerInput!) { createCustomer(input: $input) { id } }`, `mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) { updateCustomer(id: $id, input: $input) { id } }`
- `packages/client/src/operations/properties.graphql` — `mutation CreateProperty($customerId: ID!, $input: CreatePropertyInput!) { createProperty(customerId: $customerId, input: $input) { id } }`, `mutation UpdateProperty($id: ID!, $input: UpdatePropertyInput!) { updateProperty(id: $id, input: $input) { id } }`
- Regenerate `packages/client/src/generated/graphql.ts` via `pnpm --filter @clensy/client codegen` (Task 3's schema must be current — run after Task 3/4 are in place)
- `apps/web/app/customers/page.tsx` — `useCustomersQuery`, `DataTable` (columns: name, email, phone; row links to `/customers/[id]`); inline "Add customer" form section below the table — **all three `CreateCustomerInput` fields plus `notes`** (`FormField`s for `fullName`/`email`/`phone`, plus a `notes` field; `useCreateCustomerMutation`, `refetch()` on success) — mirrors `apps/web/app/admin/page.tsx`'s inline-create-section pattern, no modal (no `Modal` primitive exists in `packages/ui`, consistent with the Admin Foundation plan's precedent for this same reason)
- `apps/web/app/customers/[id]/page.tsx` — `useCustomerQuery({ variables: { id } })`; customer fields shown with an inline edit form covering `fullName`/`email`/`phone`/`notes` (`FormField`s, `useUpdateCustomerMutation`); a `DataTable` of `data.customer.properties` (columns: label, address, city); inline "Add property" form section covering **all `CreatePropertyInput` fields** — `label`/`addressLine1`/`addressLine2`/`city`/`region`/`postalCode`/`accessNotes` (`useCreatePropertyMutation({ variables: { customerId: id, input } })`); per-row inline edit for an existing property, same full field set (`useUpdatePropertyMutation`) — same inline-section convention as the customer edit form, no modal. No form in this task silently drops an optional contract field (`notes`, `addressLine2`, `accessNotes`) from its inputs.
- `apps/web/app/customers/tests/`: none — matches the Admin Foundation plan's Task 8 precedent (web-layer behavior is verified by Task 6's e2e at the API level, plus the manual acceptance checklist below, per Phase 1 Design §3's stated testing approach for `apps/web`, not a dedicated web test suite)

**Files (modified):**
- `apps/web/middleware.ts` — `matcher: ['/admin', '/admin/:path*', '/customers', '/customers/:path*']`

**Tests:** none required beyond Task 6's e2e — matches the Admin Foundation plan's Task 8 rationale exactly (spec's verification requirement is expressed as an API-level e2e, not a web-layer test). Verification for this task specifically is the manual acceptance checklist below, run once against the dev server before Task 5 is considered done — it exists because the e2e suite proves the API contract, not that the web screens are actually wired to it:

```text
[ ] /customers loads and lists seeded customers
[ ] "Add customer" creates a customer and it appears in the list without a manual refresh
[ ] /customers/[id] loads an existing customer's fields and properties
[ ] Editing a customer field and submitting persists after a reload
[ ] "Add property" on a customer detail page creates a property and it appears in that customer's property list
[ ] Editing a property field and submitting persists after a reload
[ ] Visiting /customers or /customers/[id] with no session cookie redirects to /login (middleware matcher)
```

**Traceability:** spec §4.5, §4.6.

### Task 6 — E2E acceptance

This task proves the resolver/guard/service wiring end-to-end over real GraphQL requests — it does not re-prove what Task 1/2's level-2 real-Postgres service tests already cover (explicit-`null`-vs-omitted persistence, audit-failure rollback) at the service layer; duplicating those here would be redundant coverage of the same guarantee through a slower path, not additional confidence.

**Files (new):**
- `apps/api/test/customers-properties.e2e-spec.ts` — reuses `apps/api/test/helpers/seed-owner.ts` (Admin Foundation, unchanged) to seed and log in as the fixture Owner in `beforeAll`/`beforeEach`; unique-per-run data and id-scoped assertions throughout (§7 — no truncation, no lock needed, matching `admin-foundation.e2e-spec.ts`'s precedent):
  1. Log in as Owner → `createCustomer` succeeds → `createProperty(customerId)` succeeds → `customer(id)` query returns the customer with the new property nested under `properties` → `customers` query includes it → both `customer.create`/`property.create` audit events recorded (direct repository/DB read, no GraphQL query exposes audit events, matching the Admin Foundation precedent).
  2. `updateCustomer` with only `phone` set → re-fetch confirms `fullName`/`email` unchanged, `phone` updated → `customer.update` recorded.
  3. `updateProperty` on the property from step 1, with only `label` set → re-fetch (via `customerProperties`) confirms the address fields are unchanged and `label` updated → `property.update` recorded — proves `PropertyResolver`'s guard/command-spread wiring specifically, which no other GraphQL-level test in this task exercises.
  4. Use the existing Owner-only `createAdmin` mutation to create a Scheduler, a Customer Support, an Analyst, and a Finance admin for the RBAC checks below.
  5. Log in as the Scheduler → `customers` query succeeds (view-allowed) → `createCustomer` denied (write-restricted).
  6. Log in as the Analyst → `customers` query succeeds (view-allowed) — the one view-matrix role besides Scheduler not otherwise exercised by this suite or the Admin Foundation one.
  7. Log in as the Finance admin → `customers` query denied (no view access per §4.3's matrix) → `createCustomer` denied.
  8. `createProperty` with a nonexistent `customerId` (as Owner) → rejected with a not-found error, no property persisted.

**Traceability:** spec §2 (golden path), §4.2 (not-found/missing-parent policies), §4.3 (RBAC matrix).

## 9. Public surfaces requiring implementation

Already fixed by the spec/contract inventory (§5 above): `Customer`, `Property` domain shapes and the 8 GraphQL operations. No additional public surface is introduced anywhere in the task breakdown. Internal service/command/file names in the task breakdown are planning aids per M4 rule 12 — not frozen contracts.

## 10. Self-check (planner)

| Check | Status |
| --- | --- |
| Every major task traces to the Accepted specification | ✅ — each task cites spec section(s) |
| No task introduces new product semantics | ✅ — Task 4's composition-root change and Task 5's client/web scaffolding are execution necessities, not new capabilities |
| Task ordering executable without inventing missing work | ✅ — §6 hard-prerequisite chain (Customer before Property before presentation before web) |
| Deferred work explicitly identified | ✅ — §2 SHALL NOT list |
| Missing design semantics → returned to M2/M3 | N/A — none found; the Accepted spec's M3 revision already resolved every ambiguity this plan would otherwise have had to invent around |
| Public contract matches the Accepted spec exactly | ✅ — §9; 8 GraphQL operations, matching spec §4.5 exactly |

## 11. Non-goals of this plan

- Redesigning the Accepted specification.
- Plan Review decisions (M5) — this plan does not self-Accept.
- Any implementation activity (M6) — no code is written at this stage.
- New `packages/ui` primitives — this slice's UI is fully covered by `Button`, `DataTable`, `FormField`, `StatusBadge`, already shipped.
