# nestjs-query GraphQL Reads — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product/platform contracts for this slice, not a process specification) |
| **Date** | 2026-08-28 |
| **Tracking** | [#29](https://github.com/rexescario-dev/clensy-platform/issues/29) |
| **Depends on (normative amendments)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) **§2.6** — this slice **amends** the “never TypeORM relations / never foreign entities” reading for **GraphQL read persistence metadata only** (see §4.1). Application-layer writes, dashboard reads, and domain objects remain bound by the original rule. [Bookings](2026-08-22-bookings-design.md) (Accepted) — this slice **amends** §4.1 (no relation decorators on Booking FKs) and §4.5 (DataLoader-style computed fields as the GraphQL relation mechanism) **for Booking GraphQL reads**. Write commands, REST, RBAC matrices, and audit actions are reused, not redesigned. |
| **Depends on (informative)** | [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger` / `runAuditInTransaction`, consumed as-is. [Customers & Properties](2026-08-15-customers-properties-design.md), [Cleaners & Teams](2026-08-16-cleaners-teams-design.md), [Catalog](2026-08-16-catalog-design.md) — identity/read contracts for write validation stay on application services; this slice adds TypeORM relation *metadata* from `BookingEntity` to those modules’ entities and minimum `@FilterableField` annotations on their GraphQL types so Booking can filter by relation scalars. Their resolvers, commands, and REST-less GraphQL write APIs are **not** migrated here. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) (Accepted) — `JobRelationLoaders` / `getBookingsByIds` stay Jobs-owned. Nested `booking { customer { … } }` after this slice is resolved by Booking’s nestjs-query relation resolvers, which MUST remain O(1) in parent count. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) — `/app/bookings` and `packages/client` operations remain valid against the additive read contract in §4.5. |
| **Followed by (informative)** | After Booking proves the architecture (§4.9), later slices MAY migrate Customer, Property, Cleaner, Team, Catalog, Jobs, Quality, and Dashboard onto the same read pattern. Those slices are **not** specified here. Quality (#7) and Operations Dashboard (#8) product work is independent and MUST NOT be blocked on this issue. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | Second draft, then M3. Addresses pre-implementation review: (1) lock the 9.5.0 resolver composition to published source, with generated schema as the proof; (2) replace “lazy relations” with “must not eagerly load; nestjs-query owns fetching”; (3) make owning-module-only `forFeature` a hard acceptance criterion; (4) separate GraphQL nullability from NotFound behavior and lock `booking(id: ID!): Booking!`. Also: `BookingsService.findOne` / `.findAll` remain the application-layer read API for REST, Jobs, and commands. Informed by a throwaway Booking probe of `@ptc-org/nestjs-query-*` **9.5.0** against Nest 11 / `@nestjs/graphql` 13 / GraphQL 17 (probe code removed; findings in §5). |
| **M3 decision** | **Accepted** — 2026-08-28. Round-1 human review approved the direction and required four tightenings, all now normative: exact 9.5.0 `Relatable`/`ReadResolver` composition with schema allowlist as proof; `eager: false` (not TypeORM `lazy: true`) plus nestjs-query-owned fetching; owning-module-only `forFeature([BookingEntity])` as a hard gate (foreign-entity registration is a spec-return); `booking(id: ID!): Booking!` + `NotFoundException` as two independent facts. Dual GraphQL vs application read paths preserved. No remaining design blocker. Ready for M4 Implementation Planning. |

## 1. Primary question & thesis

**Question:** Can Clensy stop writing per-module GraphQL relation loaders and still keep DDD layers, command-owned writes, RBAC, audit, and REST — and if so, what must change in §2.6 and the GraphQL read contract?

**Thesis:** The objective is not merely to use nestjs-query. The objective is to **remove repetitive GraphQL read/relation plumbing from every domain** while preserving Clensy’s domain/application architecture and command-owned business writes.

nestjs-query owns **standard GraphQL reads** (single get, list, filter, sort, relation traversal, relation batching). Clensy owns **business writes** (commands, application services, domain invariants, RBAC, audit). That split only pays for itself if TypeORM entities declare **real relations**. UUID-only columns plus documented virtual relations still N+1 (probe: 6 bookings → 6 `getCustomersByIds([oneId])` calls). A custom `findRelation` that calls bulk application methods is just the current DataLoader moved. Therefore this slice **amends** Phase 1 §2.6 and the Bookings persistence/GraphQL-relation contracts: `BookingEntity` gains unidirectional `@ManyToOne` relations (keeping existing camelCase UUID columns), GraphQL reads use nestjs-query `ReadResolver` + `Relatable` (not `CRUDResolver`), and list queries gain optional `filter` / `sorting` arguments. Generated create/update/delete and relation mutations stay off. REST stays on `BookingsService`. Domain `Booking` still holds ids, never foreign entities. Booking is the proving slice; other domains wait.

## 2. Scope

### In scope (normative)

- Platform decision: nestjs-query 9.5.0 (`@ptc-org/nestjs-query-core`, `@ptc-org/nestjs-query-graphql`, `@ptc-org/nestjs-query-typeorm`) as the GraphQL **read/relation** library for this proving slice.
- Amendment of Phase 1 Design §2.6 and Bookings spec §4.1 / §4.5 as specified in §4.1 and §4.5 of **this** document. Later stages treat those amendments as the Booking GraphQL-read rule; they MUST NOT silently extend them to writes, dashboard, or other modules.
- `BookingEntity` TypeORM relations to `CustomerEntity`, `PropertyEntity`, `ServiceEntity`, `TeamEntity` (unidirectional, **not eager**, `ON DELETE RESTRICT`, existing column names and FK constraint names preserved).
- Booking GraphQL **reads** implemented with nestjs-query composable resolvers: `ReadResolver` + `Relatable` (read-relations path; see §4.6).
- Booking GraphQL **writes** remain `createBooking` / `updateBooking` / `removeBooking` on a Clensy mutation resolver, mapping to existing commands / `BookingsService` / audit.
- Minimum `@FilterableField` annotations on related GraphQL types so `FilterableRelation` on Booking can filter by relation id and one natural scalar (`Customer.fullName`, `Property.addressLine1`, `Service.name`, `Team.name`). Those modules’ resolvers and commands are otherwise untouched.
- `packages/client` codegen against the new schema; existing `bookings.graphql` operation documents remain valid (optional args). No required `/app/bookings` UX redesign in this slice.
- Tests: application-layer write tests unchanged in intent; GraphQL schema tests asserting **absence** of generated CRUD/relation mutations; e2e proving relation loading is O(1) in parent count via **query count / SQL**, not via `getXByIds` spies (those bulk methods will no longer be on the GraphQL relation path).
- REST: no nestjs-query, no new routes, no auth/audit change (Bookings spec §4.4 / §5 stand).

### Out of scope (normative)

- Migrating Customer, Property, Cleaner, Team, Catalog, Jobs, Quality, or Dashboard **reads** onto nestjs-query.
- Inverse collections (`CustomerEntity.bookings`, `TeamEntity.bookings`, etc.).
- Generated `createOneBooking` / `updateOneBooking` / `deleteOneBooking` / `createMany*` / `updateMany*` / `deleteMany*`.
- Generated relation mutations (`setCustomerOnBooking`, `addCustomer`, `removeCustomer`, and equivalents).
- nestjs-query aggregations, subscriptions, federation, mongoose/sequelize adapters.
- Cursor or offset **paging** on `bookings` (Phase 1 lists stay unpaginated arrays; see §4.5).
- Row-level / tenant authorizers. Phase 1 auth remains role-based `AuthGuard` + `@Roles()`.
- Forcing REST through nestjs-query.
- Changing write validation: `BookingsService.create` still uses `CustomersService` / `PropertiesService` / `ServicesService` / `PricingRulesService` / `TeamsService` — never foreign repositories.
- Changing `Booking` domain shape (still ids + `pricingSnapshot`; still no `customer` object on the domain type).
- Removing `BookingsService.findOne` / `.findAll` / `.getBookingsByIds` because GraphQL no longer calls them. Those methods remain the application-layer read API.
- Quality (#7), Dashboard (#8), or any roadmap issue #9–#19.
- Recreating the throwaway probe.

### Informative (not a new product rule)

- Other modules SHOULD follow this pattern after Booking proves §4.9. That follow-on is a new spec each, not implied implementation permission here.

## 3. Terminology

- **Standard read** — GraphQL get-by-id and list queries, including filter, sort, and relation field resolvers, with no domain invariant beyond “this row exists and the caller’s role may view it.”
- **Business write** — a mutation whose behavior is specified as a Clensy command (validation chain, audit, status/lifecycle). Not generic persistence CRUD.
- **Persistence relation** — a TypeORM `@ManyToOne` / `@OneToMany` / `@OneToOne` on an entity. Distinct from a **domain reference** (an id on a plain domain type) and from a **GraphQL relation field** (a nested object on a DTO).
- **Unidirectional many-to-one** — the referencing entity declares `@ManyToOne` + `@JoinColumn`; the referenced entity does **not** declare the inverse collection.
- **Not eagerly loaded** — TypeORM `eager: false` (the default). GraphQL relation fetching is owned by nestjs-query. This is **not** TypeORM’s Promise-based `lazy: true` proxy relations; those are a separate mechanism and are not required by this specification.
- **Composable resolver** — nestjs-query 9.5.0 mixins (`ReadResolver`, `Relatable`) composed explicitly. Opposite of `CRUDResolver`, which always wires create/update/delete type factories (probe: `DeleteFilterType` runs even when `delete: { disabled: true }`).
- **Proving slice** — Booking is the only module whose GraphQL **reads** move in this specification. Success criteria in §4.9 gate any later module migration.

## 4. Domain and behavioral contracts

### 4.1 Persistence relations (amends Bookings spec §4.1 and Phase 1 §2.6)

**Amended §2.6 (Booking GraphQL reads, this slice):**

Phase 1 Design §2.6 continues to hold for:

- domain types (plain ids, no foreign entities);
- application services (no foreign repositories; writes still validate through owning modules’ application contracts);
- dashboard (application read contracts only);
- presentation adapters as internal module dependencies (GraphQL types of module A are not imported as application APIs of module B).

It is **amended** as follows for persistence metadata needed by GraphQL reads:

> A module’s TypeORM **entity** MAY declare unidirectional relations to another module’s TypeORM **entity** so the ORM and nestjs-query can batch GraphQL relation reads. That import is persistence metadata only. It MUST NOT be used to load, save, or validate foreign aggregates from the application layer. Owning modules remain the only registrants of their entities on `TypeOrmModule.forFeature` / `NestjsQueryTypeOrmModule.forFeature`. Inverse collections are out of scope until a later spec needs them.

**Booking domain object:** unchanged from Bookings spec §4.1 (`customerId` / `propertyId` / `serviceId` / `teamId` as ids). Domain still does **not** contain `Customer` / `Property` / `Service` / `Team` objects.

**BookingEntity:** keeps the existing UUID columns **and** adds matching relations. Column names stay camelCase (`customerId`, not `customer_id`). Existing FK constraint names stay (`fk_booking_customer`, `fk_booking_property`, `fk_booking_service`, `fk_booking_team`). `ON DELETE RESTRICT` unchanged. **Non-eager** (`eager: false`). No cascade persist/delete. Do **not** use TypeORM Promise-based `lazy: true` (`customer!: Promise<CustomerEntity>`).

Representative shape (normative intent; M4 confirms TypeORM 1.x decorator names and that dual `@Column` + `@ManyToOne` on the same FK compiles):

```ts
@Column({ type: 'uuid' })
@Index()
customerId!: string;

@ManyToOne(() => CustomerEntity, { nullable: false, eager: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'fk_booking_customer' })
customer!: CustomerEntity;
```

Same pattern for `property` / `propertyId` and `service` / `serviceId` (`nullable: false`). `team` / `teamId` is `nullable: true` (unassigned booking).

Writes and REST keep using `customerId` scalars on the entity. GraphQL relation resolvers use the ORM relation. Dual column + relation is intentional so application code never has to load a `CustomerEntity` to know the id.

**Loading contract (normative):**

> Relations MUST NOT be eagerly loaded. nestjs-query MUST control relation fetching and batching.

Desired path:

```text
GraphQL asks for customer
       ↓
nestjs-query relation machinery
       ↓
batched TypeORM query
```

Forbidden path:

```text
Booking query
       ↓
TypeORM automatically loads customer
       ↓
even when GraphQL did not request it
```

If the query does not select `team`, the team query MUST NOT run (§4.8).

**No inverse** `CustomerEntity.bookings` (or property/service/team inverses) in this slice. Adding them would reverse the dependency (customers infrastructure importing bookings), which this spec refuses.

**NestJS registration (hard acceptance criterion):**

`NestjsQueryTypeOrmModule.forFeature([BookingEntity])` (or equivalent) registers **BookingEntity only**. Related entities stay registered in their owning modules (`CustomersModule`, `CatalogModule`, `CleanersModule`). `autoLoadEntities` / the CLI `DataSource.entities` array already puts them on the shared DataSource.

9.5.0 TypeORM `RelationQueryService` resolves related classes via `repo.metadata.relations` and `repo.manager.connection.entityMetadatas`, not via a second `QueryService` token. That is the intended registration model.

**If 9.5.0 fundamentally requires Customer/Property/Service/Team `QueryService` providers to be registered or owned by `BookingsModule` for standard TypeORM relation resolution, that is a blocking defect of this architecture.** Diagnose which provider or DTO metadata is missing before concluding that. Do **not** add foreign `forFeature` registrations merely to satisfy DI. The implementation MUST NOT “solve” a missing-metadata problem by creating:

```text
BookingsModule
 ├── BookingEntity
 ├── CustomerEntity    ← foreign entity
 ├── PropertyEntity    ← foreign entity
 ├── ServiceEntity     ← foreign entity
 └── TeamEntity        ← foreign entity
```

That undermines the boundary this slice is trying to keep. The correct response is to **return this specification**, not to register foreign entities on Bookings.

**Migrations:** relation decorators become the TypeORM metadata for these four FKs. The next Booking migration MUST NOT rename columns or change `ON DELETE`. If `migration:generate` wants to drop/re-add the same constraints, M4 trims that noise (existing generate-script convention) or writes an explicit no-op/compat migration. Seed data unchanged in identity.

**Lookahead:** GraphQL lookahead (`enableLookAhead` on nestjs-query relation options) is allowed only if e2e query-count tests still show O(1) in N; it is not required.

### 4.2 Application layer (writes unchanged; two read paths)

`CreateBookingCommand` / `UpdateBookingCommand` / `BookingsService.create` / `.update` / `.remove` / `.findOne` / `.findAll` / `.getBookingsByIds` stay as specified in the Bookings and Jobs specs.

These are **two intentionally different access paths**:

```text
GraphQL READ
     ↓
nestjs-query QueryService
     ↓
TypeORM
```

```text
REST / commands / Jobs
     ↓
BookingsService
     ↓
TypeORM
```

GraphQL **list and get** no longer go through `BookingsService.findAll` / `.findOne`. nestjs-query’s TypeORM `QueryService` is the GraphQL read path.

REST, Jobs (`findOne` / `getBookingsByIds`), and Booking commands continue to call `BookingsService`. **Do not remove `findOne` / `findAll` / `getBookingsByIds` merely because GraphQL no longer uses them.** They remain the application-layer API.

GraphQL relation reads **do not** call `getCustomersByIds` / `getPropertiesByIds` / `getServicesByIds` / `getTeamsByIds`. Those methods remain for Jobs and any other application-layer batching. GraphQL Booking relations are ORM-batched instead.

If a future slice adds row-level rules inside `CustomersService.find*`, GraphQL Booking→Customer would **not** inherit them automatically. That is accepted for Phase 1 (no row-level auth, no soft-delete). A later authorizer/filter spec must close that gap before such rules exist.

### 4.3 RBAC

Unchanged matrices from Bookings spec §4.3:

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / update / delete booking | ✓ | ✓ | ✓ | ✓ | | |
| View booking (get, list, relation fields) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Enforcement:

- **Reads** (`booking`, `bookings`, and Booking relation field resolvers): existing `AuthGuard` + `@Roles(...VIEW_ROLES)` applied via nestjs-query resolver `guards` / `decorators` / relation `guards` options so field resolvers are not public.
- **Writes:** existing mutation resolver `@UseGuards(AuthGuard)` + `@Roles(...WRITE_ROLES)`.

nestjs-query’s `AuthorizerInterceptor` may still run (library default). This slice does **not** introduce a Clensy `Authorizer` that filters rows. Default allow-all authorizer + `AuthGuard` is the model. Role checks MUST be the Clensy guard, not an assumed equivalent inside nestjs-query CRUD authorization.

REST remains unauthenticated (Bookings spec §4.4).

### 4.4 Audit

Unchanged from Bookings spec §4.4. Reads emit no audit events. `createBooking` / `updateBooking` / `removeBooking` still log `booking.create` / `booking.update` / `booking.remove` inside `runAuditInTransaction`. nestjs-query MUST NOT emit write-side audit events because it MUST NOT own writes.

### 4.5 GraphQL contract (amends Bookings spec §4.5)

**Object type `Booking` fields (unchanged set):** `id`, `scheduledAt`, `status`, `pricingSnapshot`, `customer`, `property`, `service`, `team`, `createdAt`.

Still **no** schema fields `customerId` / `propertyId` / `serviceId` / `teamId`. Clients keep reading `booking.customer.id`. Relation names stay **singular** `service` and nullable `team` — not `services[]`, not `cleaner`.

`pricingSnapshot` remains a nested object (`priceMinorUnits`), not a TypeORM relation.

**Queries**

Current (runtime schema, generated client):

```graphql
booking(id: ID!): Booking      # nullable in SDL; resolver already throws NotFoundException
bookings: [Booking!]!
```

Proposed:

```graphql
booking(id: ID!): Booking!
bookings(
  filter: BookingFilter = {}
  sorting: [BookingSort!] = []
): [Booking!]!
```

**`booking(id)` nullability (locked — two independent facts):**

GraphQL field nullability and “throws when not found” are not the same contract.

| Layer | Current | This slice |
| --- | --- | --- |
| SDL | `booking(id: ID!): Booking` (nullable) | `booking(id: ID!): Booking!` (non-null) |
| Missing id | `BookingsService.findOne` → `NotFoundException` | nestjs-query `TypeOrmQueryService.getById` → `NotFoundException` (`Unable to find BookingEntity with id: …`) |
| Generated client | `booking: … \| null` | `booking: …` (no `| null`) |

9.5.0 `ReadResolver.findById` is implemented as `@Query(() => DTOClass)` **without** `nullable: true`, and it calls `this.service.getById`, which throws `NotFoundException` when missing. There is no supported `one.nullable` option on `ReadResolverOpts` that would restore a nullable SDL field. Overriding stock `findById` solely to keep a nullable schema that already throws is not this slice’s job.

The Accepted Bookings spec wrote `booking(id: ID!): Booking` without `!`. In GraphQL SDL that is nullable, and it matched the current `@Query(..., { nullable: true })`. Runtime never returned `null`; it threw. This slice **corrects the schema to match runtime and the library default**: non-null field + `NotFoundException`. That is a **codegen-visible** change (`BookingQuery.booking` loses `| null`) and is **not** a golden-path runtime change. Jobs’ `job(id): CleaningJob` (nullable, returns `null`) is a different module and is not restated here.

M4 MUST print the generated SDL for `Query.booking` and assert it is `Booking!`. If the installed 9.5.0 resolver unexpectedly emits a nullable field, that is a defect to fix in implementation, not a silent revert to `Booking`.

- **Paging:** `PagingStrategies.NONE`. Return type stays `[Booking!]!`, not a connection. Phase 1 volume does not justify paging (same deferral as Customers spec §2). Optional `filter`/`sorting` with defaults means today’s `query { bookings { id } }` remains valid.
- **Filter / sort:** enabled on Booking scalars that are `@FilterableField` (`id` unless disabled, `status`, `scheduledAt`, `createdAt`). `@FilterableRelation` on `customer`, `property`, `service`, `team` so callers MAY filter/sort parents by relation scalars (e.g. `filter: { customer: { fullName: { iLike: "Ada%" } } }`). Related-module GraphQL types gain the minimum `@FilterableField`s needed for that; they do **not** gain nestjs-query `ReadResolver`s in this slice.
- **No extra root queries** (`probeBooking`, `bookingConnection`, aggregates).

**Mutations (unchanged names and inputs):**

```graphql
createBooking(createBookingInput: CreateBookingInput!): Booking!
updateBooking(updateBookingInput: UpdateBookingInput!): Booking!
removeBooking(id: ID!): Booking!
```

`CreateBookingInput` / `UpdateBookingInput` stay Clensy types (ids on input for writes). They are **not** nestjs-query `CreateDTOClass` / `UpdateDTOClass`.

**Allowlisted schema (normative proof, not documentation of intent):**

The generated GraphQL schema MUST expose Booking reads as:

```text
booking
bookings
booking.customer
booking.property
booking.service
booking.team
```

plus the three existing Clensy mutations. It MUST NOT expose generated CRUD or relation mutations, including but not limited to:

```text
createOneBooking, createManyBookings,
updateOneBooking, updateManyBookings,
deleteOneBooking, deleteManyBookings,
setCustomerOnBooking, setPropertyOnBooking, setServiceOnBooking, setTeamOnBooking,
add* / remove* relation mutations,
subscription fields
```

**Relation field resolution:** many-to-one using `@FilterableRelation` (or `@Relation` if filter-on-relation is returned at M3). Collection paging on these four fields does not apply (they are not lists). `team` is `nullable: true` on the relation decorator. Nested `Customer.properties`, `Service.activePricing`, `Team.cleaners` stay those modules’ existing `@ResolveField`s.

**Client / web impact:**

```text
apps/api schema.gql
  → pnpm --filter @clensy/client codegen
  → apps/web useBookingsQuery / useBookingQuery
```

Existing `packages/client/src/operations/bookings.graphql` documents do not pass `filter`/`sorting`; they MUST keep compiling. `BookingQuery`’s `booking` field becomes non-null in generated types. No required DataTable behavior change in this slice. Using server filter in the UI is a later, optional change.

**Jobs:** `jobs { booking { id } }` still uses Jobs loaders + `getBookingsByIds`. `jobs { booking { customer { fullName } } }` uses Booking’s new relation resolvers and MUST be O(1) in job/booking count for the customer lookup.

### 4.6 Resolver composition

**Do not use `CRUDResolver` or `NestjsQueryGraphQLModule` auto `resolvers: [{ DTOClass, EntityClass }]`.** Probe: even with `create`/`update`/`delete` disabled, `CRUDResolver` still constructs delete/update filter types and requires `@FilterableField` at module-load time; it is the wrong allowlist.

**Verified 9.5.0 API** (source: `packages/query-graphql/src/resolvers/read.resolver.ts`, `relations/relations.resolver.ts`, `relations/update-relations.resolver.ts`, `query-graphql/src/index.ts`):

- Public exports include `ReadResolver`, `Relatable`, `ReadRelationsResolver`. `ReadRelationsMixin` exists internally but is not the documented composition entry point.
- `Relatable(DTOClass, opts: RelatableOpts)` is a mixin factory. `RelatableOpts` is `{ enableTotalCount?: boolean; enableAggregate?: boolean }` plus `BaseResolverOptions` (`guards`, `decorators`, …). The second argument is required in the 9.5.0 TypeScript signature (docs examples that omit it are incomplete).
- `Relatable` **always composes** `ReadRelationsMixin`, `UpdateRelationsMixin`, `RemoveRelationsMixin`, `AggregateRelationsMixin`, and `ReferencesRelationMixin`. That is not the same as exposing mutations.
- `UpdateOneRelationMixin` / `RemoveRelationsMixin` **return the base class unchanged** unless `relation.update?.enabled` / `relation.remove?.enabled` is true (9.5.0: `if (!relation.update?.enabled) return Base`). Relation mutations are **opt-in on the DTO decorator**, default off since v3.
- `ReadResolver(DTOClass, opts)` emits `booking` / `bookings` (names from `one.name` / `many.name`). `pagingStrategy: PagingStrategies.NONE` keeps `[Booking!]!`.
- `NestjsQueryGraphQLModule.forFeature` registers Booking DTO metadata / authorizers for **manually composed** resolvers (`dtos:` or equivalent) **without** an auto `resolvers: [{ DTOClass, EntityClass }]` CRUD entry. Whether `EntityClass` is required on a `dtos:` entry is an M4/M6 verification against 9.5.0, not a product contract.

**Required allowlist:**

```text
Expose:  ReadResolver (one + many) + Relatable read-relations
Do not:  CRUDResolver, CreateResolver, UpdateResolver, DeleteResolver,
         enabled update/remove on @FilterableRelation,
         aggregations, subscriptions
```

Composition (9.5.0-accurate; filename/class names are M4’s):

```ts
@Resolver(() => BookingDTO)
class BookingReadResolver extends Relatable(BookingDTO, {
  enableAggregate: false,
  enableTotalCount: false,
})(
  ReadResolver(BookingDTO, {
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { name: 'booking' },
    many: { name: 'bookings' },
    pagingStrategy: PagingStrategies.NONE,
  }),
) {
  constructor(
    @InjectQueryService(BookingEntity) readonly service: QueryService<BookingEntity>,
  ) {
    super(service);
  }
}

@Resolver(() => BookingDTO)
class BookingMutationResolver {
  /* existing createBooking / updateBooking / removeBooking */
}
```

The **proof** that generic writes and relation mutations are absent is the generated schema allowlist in §4.5, not the mixin names. M4 MUST add a schema-introspection test for that allowlist. If Relatable plus disabled relation-update still emits a mutation, that is a blocking implementation defect: switch to composing only `ReadResolver` + `ReadRelationsResolver` (also exported in 9.5.0) or an equivalent that produces the allowlisted schema — do not enable CRUD to make boot succeed.

Every `@FilterableRelation` / `@Relation` MUST set `update: { enabled: false }` and `remove: { enabled: false }` explicitly (library defaults are off; this spec makes that a reviewed invariant, not an accident).

`BookingDTO` is the GraphQL object type (`@ObjectType('Booking')`). It replaces `booking.type.ts`. Related types may keep their current class names (`CustomerType`, …) with added `@FilterableField`s.

Mutation resolvers return `BookingDTO` (assembler or a small mapper for scalars). Requested relation fields are filled by Relatable, not by `booking-relation.loaders.ts`.

### 4.7 Folder structure (Booking)

**Remain:** `domain/*`, `application/*` (including `BookingsService.findOne` / `.findAll` / `.getBookingsByIds`), `infrastructure/persistence/booking.entity.ts` (relations added), embeddable + seed, `presentation/rest/*`, `presentation/graphql/create-booking.input.ts`, `update-booking.input.ts`, `booking-pricing-snapshot.type.ts` (or renamed `.dto.ts` if that is only a rename), `tests/application/*`, `tests/rest/*`.

The framework is an implementation detail of the **presentation/read adapter**. It MUST NOT become the architecture of the entire domain.

**Replace / add:**

| Path | Fate |
| --- | --- |
| `presentation/graphql/booking.type.ts` | Replaced by `booking.dto.ts` (nestjs-query DTO) |
| `presentation/graphql/booking.resolver.ts` | Split: read mixin class + mutation resolver (names are M4’s) |
| `presentation/graphql/booking-relation.loaders.ts` | **Deleted** |
| `presentation/graphql/mappers.ts` | Deleted or reduced to mutation scalar mapping if `DefaultAssembler` does not cover writes’ return path |
| `tests/graphql/booking-relation.loaders.spec.ts` | **Deleted** |
| `tests/graphql/booking.resolver.spec.ts` | Kept; retargeted to schema allowlist + mutation RBAC (not loader plumbing) |
| `bookings.module.ts` | Wires nestjs-query `forFeature` + mutation resolver; stops providing `BookingRelationLoaders` |

Do not flatten `domain` / `application` / `infrastructure` / `presentation`.

Success looks like:

```text
Before: resolver + type + mapper + relation loader + loader tests + manual query plumbing
After:  DTO + ReadResolver composition + custom mutation resolver
```

while O(1) relation queries and the same write/security behavior hold.

### 4.8 Performance (mandatory)

For `bookings { customer { fullName } property { addressLine1 } service { name } team { name } }` over N bookings (N ≥ 6 in e2e):

- customer lookup: **O(1) in N** (one batched SELECT / IN / join-set, not N queries);
- same for property, service, team.

Mechanism: nestjs-query `FindRelationsLoader` + TypeORM `batchFindRelations` / `batchQueryRelations` (the path that **requires** ORM relations). Documented `RelationQueryService` virtual relations are **non-compliant** (probe: N calls of size 1).

Tests MUST inspect **generated SQL or TypeORM query count**, not `getCustomersByIds` spies. A passing spy on a method that is no longer on the path is not evidence.

Jobs nested `booking { customer { … } }` over N jobs MUST NOT regress to N customer queries.

No eager-loading of unused relations: if the query does not select `team`, the team query MUST NOT run.

### 4.9 Proving slice (scope boundary, not an M4 task list)

This specification’s implementation (once planned) is **Booking only**. Other domains MUST NOT be migrated in the same delivery.

Booking has proved the architecture when all of the following are true:

1. App boots with nestjs-query 9.5.0 on the current Nest/GraphQL stack.
2. Schema matches §4.5 (including `booking(id: ID!): Booking!` and absence of generated writes/relation mutations).
3. Relations resolve (`service` singular, `team` nullable).
4. §4.8 query-count tests pass.
5. View RBAC still holds on get/list/relation fields; write RBAC and audit still hold on the three mutations.
6. `createBooking` / `updateBooking` / `removeBooking` still go through `BookingsService`.
7. `BookingsService.findOne` / `.findAll` / `.getBookingsByIds` still exist and still serve REST and Jobs.
8. `packages/client` codegen succeeds; existing booking operation documents typecheck; `/app/bookings` golden path still works.
9. REST tests still pass without nestjs-query.
10. **Owning-module-only registration:** `BookingsModule` / Booking `NestjsQueryTypeOrmModule.forFeature` registers `BookingEntity` only. No Customer/Property/Service/Team **QueryService** is owned by Bookings. Relation reads still work.

Until then, Customer/Job/etc. keep their DataLoaders.

### 4.10 Web and REST

- **Web:** no required UX change. Codegen only. Filter/sort in the UI is optional later.
- **REST:** independent. Still `BookingsService` + existing DTOs. nestjs-query is GraphQL-only.

## 5. Rationale

- **Why nestjs-query at all.** Booking, Jobs, Cleaners, Catalog, and Customers each reinvent GraphQL relation batching. The probe confirmed 9.5.0 boots on this stack. The goal is a repeatable read/relation layer, not a one-module helper.
- **Why UUID-only FKs prevent the benefit.** Virtual `RelationQueryService` fans out `service.query` per parent DTO even when GraphQL DataLoader batches parents (probe: 6× size-1). Custom `findRelation` + `getXByIds` was 1× size-6 — the current loaders under a new name. Full benefit is TypeORM `batchFindRelations`.
- **Why M2 is required.** Phase 1 §2.6 and Bookings §4.1 forbid relation decorators specifically so `migration:generate` would not own FKs and modules would not import foreign entities. Adopting ORM relations without amending those documents would be an accidental architecture change. GraphQL `bookings` also cannot stay zero-argument under `ReadResolver` if we want filter/sort; that contract change must be reviewed.
- **Why not `CRUDResolver`.** Probe: disabled delete still built `GraphQLFilter` at load time; auto resolvers are the opposite of an allowlist. 9.5.0 documents `ReadResolver` and `Relatable` as the composable pieces. Relatable still *composes* update/remove mixins; those mixins no-op unless enabled on the DTO. Schema allowlist tests are the real gate.
- **Why not paging yet.** nestjs-query can page; Phase 1 lists are full-set by spec (Customers §2, Bookings §4.5, Jobs §2). OFFSET/cursor would break `bookings { id }` selection shape (`nodes`/`edges`). Filter/sort are additive; paging is not.
- **Why unidirectional ManyToOne.** Booking already depends on customers/catalog/cleaners at the application layer. Putting `@OneToMany` on `CustomerEntity` would make customers infrastructure depend on bookings — worse coupling for no Booking-list benefit.
- **Why not a shared entity package.** One proving slice does not justify a new persistence kernel. Revisit only if several modules migrate and entity-import edges become unmanageable.
- **Why GraphQL reads may skip `BookingsService.findAll`.** The library’s query path is TypeORM `QueryService`. Duplicating filter/sort in `BookingsService` would be a second query DSL. Writes stay on the service because that is where invariants and audit live. Application reads stay on the service because REST and Jobs still need them.
- **Why REST stays off nestjs-query.** Phase 1 Design §7: REST is a preserved comparison artifact, not a second GraphQL. No benefit in this slice.
- **Why `booking(id): Booking!`.** 9.5.0 ReadResolver has no nullable get-by-id option; `getById` throws; current Clensy `findOne` already throws. Aligning SDL with runtime avoids a fake `{ booking: null }` contract. Jobs’ nullable `job(id)` is a different, already-Accepted contract.

## 6. Acceptance criteria (for this specification)

- M3 confirms the §2.6 amendment is the intended exception (persistence metadata for GraphQL reads only) and is **not** permission to load foreign aggregates in `BookingsService`.
- M3 confirms TypeORM relations on `BookingEntity` (unidirectional, not eager, existing camelCase columns and `fk_booking_*` names, `RESTRICT`) are the relation source of truth for GraphQL reads.
- M3 confirms composable `ReadResolver` + `Relatable`, **not** `CRUDResolver`, and that the **generated schema allowlist** in §4.5 is the mutation-denylist proof.
- M3 confirms owning-module-only `forFeature([BookingEntity])` is a hard acceptance criterion: foreign-entity registration inside Bookings is a spec-return, not a workaround.
- M3 confirms the read-contract change: optional `filter`/`sorting`, **no** paging, `[Booking!]!` preserved; `booking(id: ID!): Booking!` + `NotFoundException` (schema correction; runtime already threw).
- M3 confirms writes, REST, audit, and RBAC matrices are unchanged in behavior, and that `BookingsService.findOne` / `.findAll` remain.
- M3 confirms Booking-only proving slice; no drive-by migration of other domains.
- §4.8 query-count requirement is accepted as the N+1 bar (SQL/query count, not bulk-method spies).
- Related-type `@FilterableField` minimum (not full module migration) is accepted.
- Open questions in §8 are either decided here or explicitly left for M4 without blocking the rest of the design.

## 7. Non-goals

- Redesigning Admin Foundation, Customers, Cleaners, Catalog, Jobs, or Dashboard **product** behavior.
- Implementing this slice (M6) or writing an implementation plan (M4) in this document.
- Flattening DDD folders because a library DTO exists.
- Replacing command mutations with generic CRUD.
- Adding paging, aggregations, or subscriptions “because the library can.”
- Shared kernel / entity package.
- Inverse ORM collections.
- Deleting application-layer reads because GraphQL switched path.
- Recreating the throwaway probe.

## 8. Risks and open decisions

| Item | Status in this draft |
| --- | --- |
| TypeORM **1.1.x** support for `JoinColumn.foreignKeyConstraintName` and dual `@Column` + `@ManyToOne` on the same FK | **M4 must verify** against the installed version; preserve constraint names in a hand-edited migration if the decorator cannot. If dual column + relation is illegal, M4 may use `@RelationId` **only** if `customerId` remains a writable scalar for REST/commands without loading the related entity. |
| nestjs-query TypeORM adapter resolving many-to-one without Bookings-owned foreign QueryServices | **Hard acceptance criterion** (§4.1, §4.9#10). Diagnose missing metadata first. If it fundamentally requires Bookings-owned foreign QueryServices, return this spec — do not add foreign `forFeature` merely to satisfy DI. |
| `Relatable` composing update/remove mixins | **Decided here:** allowed because those mixins no-op unless enabled. Schema allowlist test is the gate. Fallback: `ReadResolver` + `ReadRelationsResolver` if Relatable emits mutations anyway. |
| TypeORM Promise `lazy: true` vs `eager: false` | **Decided here:** relations are **non-eager** (`eager: false`). Do not use `lazy: true` / `Promise<CustomerEntity>`. nestjs-query controls fetching. |
| `booking(id)` SDL `Booking` vs `Booking!` | **Decided here:** `Booking!` + `NotFoundException`. Codegen loses `| null`. Runtime already threw. |
| `graphql` 17 vs nestjs-query peer `^16`; `class-validator` 0.15 vs peer `^0.14` | Probe booted; treat as accepted residual risk, not a redesign. |
| Filter-by-relation in the Booking slice vs scalar-only filters until related modules migrate | **Decided here** (FilterableRelation + minimum related `@FilterableField`s). M3 may narrow to `@Relation` without nested filters. |
| GraphQL lookahead | Optional, only if §4.8 still holds. |
| Default list sort | **None** (preserve current unspecified `find()` order). |
| nestjs-query default `AuthorizerInterceptor` + allow-all authorizer | Accepted for Phase 1; not a substitute for `AuthGuard`. |
| GraphQL reads bypassing `CustomersService` if that service later grows filters | Accepted Phase 1 gap; must be specified before row-level rules exist. |
| `packages/client` generating unused `BookingFilter` types | Additive; existing documents stay valid. |
| `getById` error message text (`Unable to find BookingEntity with id: …` vs `Booking ${id} not found`) | **M4 may wrap** to preserve the Clensy message if cheap; not a design blocker. GraphQL clients already treat either as an error. |

## 9. Traceability

| Upstream | This document |
| --- | --- |
| Phase 1 Design §2.6 | **Amends** (persistence-relation exception for GraphQL reads). Application/dashboard/domain rules unchanged. |
| Phase 1 Design §7 REST | Relies on (REST not redesigned). |
| Bookings spec §4.1 no relation decorators | **Amends** for `BookingEntity` only. |
| Bookings spec §4.2–4.4 writes/RBAC/audit | Relies on. |
| Bookings spec §4.5 computed fields + DataLoader-class N+1 | **Amends** mechanism (ORM + nestjs-query) and list arguments (filter/sort). Amends `booking(id)` SDL to `Booking!`. Field *set* and mutation names rely on. |
| Jobs spec N+1 / `getBookingsByIds` | Relies on for job→booking. Nested booking→customer after this slice uses Booking’s new resolvers. Jobs continues to call `BookingsService.findOne` / `getBookingsByIds`. |
| Admin Foundation | Relies on (`AuthGuard`, roles, audit). |
| Customers / Cleaners / Catalog | Relies on write-side application contracts; **adds** entity-import edges and minimum filterable GraphQL fields. Does not migrate those modules’ read APIs. |
