# nestjs-query GraphQL Reads — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-08-28 |
| **Tracking** | [#29](https://github.com/rexescario-dev/clensy-platform/issues/29) |
| **Package/repo scope** | `apps/api` (Booking GraphQL reads + `BookingEntity` relations + minimum `@FilterableField` on related GraphQL types; mechanical `BookingType` → `BookingDTO` import updates in Jobs presentation only); `packages/client` (codegen). **Not** Customer/Property/Cleaner/Team/Catalog/Jobs/Quality/Dashboard read migrations. |
| **Depends on (Accepted)** | [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md) — Status: Accepted, 2026-08-28. Relies on already-Accepted [Phase 1 Design](../specs/2026-08-14-clensy-platform-phase1-design.md) §2.6 as **amended by that spec**, [Bookings](../specs/2026-08-22-bookings-design.md), [Jobs & Checklists](../specs/2026-08-27-jobs-checklists-design.md), [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md), [Customers & Properties](../specs/2026-08-15-customers-properties-design.md), [Cleaners & Teams](../specs/2026-08-16-cleaners-teams-design.md), [Catalog](../specs/2026-08-16-catalog-design.md), [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md). |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |
| **Revision note** | First draft, then M5 Accept, then post-Accept plan corrections (not a redesign): foreign `QueryService` ownership as the hard gate; verify 9.5.0 DTO registration instead of hardcoding `dtos: [{ EntityClass }]`; SQL proof is O(1) in N (N=6 vs N=12), not exactly one statement; non-eager (not TypeORM `lazy: true`); no Clensy `@ResolveField` for the four Booking relations; application layer must keep UUID scalars; related-type `id` metadata is additive not a blind `@Field` replace. |
| **M5 decision** | **Accepted** — 2026-08-28. Post-Accept tightenings applied the same day (implementation-plan corrections only; architecture unchanged). Ready for M6 Implementation. |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement the Accepted spec’s Booking proving slice: TypeORM persistence relations on `BookingEntity`, nestjs-query 9.5.0 as the GraphQL **read/relation** layer, Clensy-owned write mutations, REST unchanged, domain/application layers unchanged. Prove O(1) relation loading with SQL/query counts. Do **not** migrate any other domain’s reads.

## 2. Constraints (SHALL / SHALL NOT)

**SHALL** (traced to spec):

- Install `@ptc-org/nestjs-query-core`, `@ptc-org/nestjs-query-graphql`, `@ptc-org/nestjs-query-typeorm` at **9.5.0** (§2).
- `BookingEntity` unidirectional `@ManyToOne` to Customer/Property/Service/Team; keep camelCase UUID columns and `fk_booking_*` / `ON DELETE RESTRICT`; `eager: false`; no cascade; no inverse collections (§4.1).
- `NestjsQueryTypeOrmModule.forFeature` in Bookings registers **BookingEntity only**. BookingsModule MUST NOT own foreign `QueryService`s (§4.1, §4.9#10).
- GraphQL reads: `ReadResolver` + `Relatable`; **not** `CRUDResolver`; no auto `resolvers: [{ DTOClass, EntityClass }]` CRUD entry (§4.6).
- Schema allowlist: `booking`, `bookings`, `booking.customer|property|service|team`, plus `createBooking` / `updateBooking` / `removeBooking`. No generated CRUD or relation mutations (§4.5).
- `booking(id: ID!): Booking!`; missing id → `NotFoundException`. `bookings(filter, sorting): [Booking!]!` with `PagingStrategies.NONE` (§4.5).
- Writes stay on `BookingsService` + commands + audit + RBAC (§4.2–4.4).
- Keep `BookingsService.findOne` / `.findAll` / `.getBookingsByIds` for REST and Jobs (§4.2, §4.9#7).
- Application/commands/REST keep using `customerId` / `propertyId` / `serviceId` / `teamId` scalars; they MUST NOT read or assign `booking.customer` (etc.) (§4.1, §4.2).
- N+1 proof is SQL/query count **independent of parent N**, not `getXByIds` spies (§4.8).
- Existing `packages/client` booking operation documents keep compiling (§4.5).

**SHALL NOT:**

- Register Customer/Property/Service/Team **QueryServices** (or their entities) on `BookingsModule` merely to satisfy DI. If 9.5.0 **fundamentally requires** Bookings-owned foreign QueryServices for standard TypeORM relation resolution, **stop and return the spec** (§4.1).
- Use TypeORM Promise-based `lazy: true` (`customer!: Promise<CustomerEntity>`). Relations are **non-eager** (`eager: false`); nestjs-query controls fetching (§4.1, §8).
- Implement Clensy `@ResolveField()` methods for Booking `customer` / `property` / `service` / `team`. Relatable / nestjs-query relation resolution owns those fields (§4.5, §4.6).
- Enable relation `update`/`remove`, paging, aggregations, subscriptions (§2, §4.5).
- Remove application-layer reads because GraphQL switched path (§4.2).
- Flatten DDD folders; migrate other domains; force REST through nestjs-query; recreate the probe (§2, §4.7, §7).

## 3. Implementation decisions (M4 choices)

- **`NestjsQueryGraphQLModule.forRoot({})` lives in `GraphqlModule`**, next to the existing `GraphQLModule.forRoot`. That is platform GraphQL infrastructure, not a Bookings concern. `forFeature` stays on `BookingsModule`.
- **`pnpm --filter api add` the three packages at 9.5.0.** Peer warnings (`graphql` 17 vs ^16, `class-validator` 0.15 vs ^0.14) are Accepted residual risk; do not downgrade Clensy’s versions.
- **Do not enable `enableLookAhead` in this slice.** Prove relation loading is O(1) in parent count via SQL capture. Do not treat nestjs-query internal names (`FindRelationsLoader`, `batchQueryRelations`) as the acceptance criterion — verify observed query behavior against 9.5.0.
- **Dual `@Column` + `@ManyToOne` on the same FK** is the first attempt (spec §4.1). Verify against TypeORM 1.1.x in Task 2. Fallback (only if dual mapping is illegal): drop the redundant `@Column` and keep a scalar `customerId` via `@RelationId((b) => b.customer)` **if and only if** REST/commands can still write `customerId` without loading `CustomerEntity`. If neither works, return to M2/M3 — do not invent a third persistence model.
- **Class names:** `BookingDTO` (`@ObjectType('Booking')`), `BookingReadResolver`, `BookingMutationResolver`. Jobs keep resolving `Booking` by GraphQL name; update TypeScript imports from `BookingType` → `BookingDTO`.
- **Mutation return path** keeps a small `toBookingDto(booking: Booking)` mapper (today’s `toBookingType`) so writes still return identity+scalars. Relatable field resolvers fill relations. Do not delete this mapper just because reads use `QueryService`.
- **Do not implement `@ResolveField()` for `customer` / `property` / `service` / `team`.** `@FilterableRelation` is DTO metadata (filter participation + relation declaration). Relation *resolution* is Relatable / nestjs-query machinery. Keeping the old `@ResolveField` loaders alongside `@FilterableRelation` defeats the slice.
- **Read RBAC** is applied via `ReadResolver` `guards: [AuthGuard]` and `decorators: [Roles(...VIEW_ROLES)]`. Relation fields get the same `guards` on each `@FilterableRelation` (or equivalent 9.5.0 relation option). Mutation RBAC stays on `BookingMutationResolver` methods as today.
- **`getById` message text** (`Unable to find BookingEntity with id: …`) is left as the library default unless wrapping is a one-liner; spec §8 says this is not a design blocker.
- **SQL capture helper** `apps/api/test/helpers/capture-sql.ts` wraps `DataSource.logger`. Count statements whose SQL mentions `customer_entity` / `property_entity` / `service_entity` / `team_entity` (confirmed table names). Preferred shape is one batched `IN (...)` per relation; a **fixed constant >1** (e.g. COUNT + SELECT) is compliant if independent of N and not a per-parent pattern.
- **GraphQL DTO registration** uses the 9.5.0 API required for **manually composed** resolvers. Verify whether `EntityClass` on a `dtos:` entry is required for DTO/authorizer metadata or only for auto-generated CRUD `resolvers:` entries. Do not copy the auto-resolver `{ DTOClass, EntityClass }` shape just because docs show it.
- **Jobs presentation import updates are mechanical**, not a Jobs read migration: `cleaning-job.type.ts` and `job.resolver.ts` point at `BookingDTO` instead of `BookingType`. `JobRelationLoaders` / `getBookingsByIds` stay.

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/package.json` + lockfile (three nestjs-query deps) | Other apps/packages’ dependencies |
| `platform/graphql/graphql.module.ts` (`NestjsQueryGraphQLModule.forRoot`) | Auth, audit, database `synchronize` |
| `modules/bookings/infrastructure/persistence/booking.entity.ts` + one migration | Other modules’ entities / inverse collections |
| `modules/bookings/presentation/graphql/**` (DTO, read+mutation resolvers, delete loaders) | `domain/*`, `application/*` method contracts, `presentation/rest/*` |
| Minimum `@FilterableField` on Customer/Property/Service/Team GraphQL types | Those modules’ resolvers, commands, REST, loaders |
| `packages/client` codegen output | `apps/web` UX (no required redesign) |
| Jobs files that import `BookingType` / `toBookingType` (rename only) | Jobs loaders, Jobs GraphQL operations, `BookingsService` |

## 5. Contract inventory (only what the Accepted spec authorizes)

- Persistence: four unidirectional many-to-ones on `BookingEntity`; UUID columns retained.
- GraphQL queries: `booking(id: ID!): Booking!`, `bookings(filter: BookingFilter = {}, sorting: [BookingSort!] = []): [Booking!]!`
- GraphQL relations: `customer`, `property`, `service` (non-null); `team` (nullable)
- GraphQL mutations: existing three Clensy operations only
- REST: unchanged
- Application: `BookingsService` write + `findOne`/`findAll`/`getBookingsByIds` retained

## 6. Slice sequence

```text
1. Install nestjs-query 9.5.0 + forRoot          (unblocks everything)
2. BookingEntity non-eager relations + migration (hard gate: dual FK mapping)
3. Related DTO filter metadata
4. BookingDTO + ReadResolver + Relatable
   HARD GATE: allowlisted schema; relations resolve;
   no generated writes; no Bookings-owned foreign QueryServices
5. Unit/schema tests (allowlist, Booking!, RBAC, no @ResolveField, UUID grep)
6. E2E SQL O(1) in N (N=6 vs N=12) + Jobs + codegen + web
```

If Task 2 or Task 4 hits a spec-return condition, **stop**. Do not continue to Tasks 5–6 with a workaround.

## 7. TDD / verification strategy

1. **Schema unit tests** (`booking.resolver.spec.ts` retargeted): field set; no `*Id` fields; `Query.booking` type is non-null `Booking`; `Query.bookings` is `[Booking!]!` with optional `filter`/`sorting`; Mutation type has exactly the three Clensy booking mutations (plus unrelated module mutations from the factory’s resolver list) and **none** of the denylisted names; write methods still carry `AuthGuard` + WRITE_ROLES.
2. **Application/REST tests:** no intentional behavior change. They MUST still pass. Do not delete `findOne`/`findAll` tests.
3. **GraphQL e2e** (`apps/api/test/bookings.e2e-spec.ts`): replace `getCustomersByIds` (etc.) spies with SQL capture. Measure the same four-relation query at **N=6 and N=12**. For each related table, the statement count MUST be **constant across N** (preferred: 1 batched `IN (...)`; a fixed constant >1 is compliant if it is not a per-parent pattern). A query that omits `team` MUST issue **zero** SQL mentioning `team_entity`. Keep existing **view** RBAC e2e (Finance/Analyst read) as well as write RBAC/audit. Missing `booking(id)` MUST return a GraphQL error (NotFound), not `{ booking: null }`.
4. **Jobs e2e:** nested `jobs { booking { customer { fullName } } }` over N jobs MUST NOT issue N customer queries (SQL capture or equivalent). `getBookingsByIds` spy for `jobs { booking { id } }` stays — that path is still Jobs-owned.
5. **Client:** `pnpm --filter @clensy/client codegen` succeeds; `BookingQuery['booking']` is non-null in generated types; existing operation documents typecheck.
6. **Web:** manual `/app/bookings` golden path (Phase 1 Design §7 — no browser suite).

## 8. Traceability (spec → task)

| Spec contract | Task |
| --- | --- |
| 9.5.0 packages + boot | 1 |
| `BookingEntity` relations, not eager, FK names, dual scalars | 2 |
| Owning-module-only QueryService / `forFeature` | 4 (gate), 2 (entities exist on DataSource) |
| Related filter metadata | 3 |
| `ReadResolver` + `Relatable`, no `CRUDResolver`, no `@ResolveField` for four relations | 4, 5 |
| Schema allowlist / `Booking!` / no paging / no generated mutations | 4, 5 |
| Custom writes, RBAC, audit | 4, 5, 6 |
| Keep `BookingsService.find*` + UUID scalars in application/REST | 4, 5 (grep), 6 |
| Delete loaders | 4 |
| §4.8 SQL O(1) in N (not exactly-one) + unselected team | 6 |
| Client codegen | 6 |
| Booking-only proving slice | no task for other domains |

## 9. Task breakdown

### Task 1 — Install nestjs-query 9.5.0 and platform `forRoot`

**Files:**
- Modify: `apps/api/package.json`, `pnpm-lock.yaml`
- Modify: `apps/api/src/platform/graphql/graphql.module.ts`

**Steps:**

```bash
pnpm --filter api add @ptc-org/nestjs-query-core@9.5.0 @ptc-org/nestjs-query-graphql@9.5.0 @ptc-org/nestjs-query-typeorm@9.5.0
```

In `GraphqlModule`, import `NestjsQueryGraphQLModule.forRoot({})` alongside the existing `NestGraphQLModule.forRoot`. Do not change Apollo driver, `autoSchemaFile`, or `context`.

**Verify:** `pnpm --filter api exec nest start --entryFile main` (or the existing e2e compile path) still boots. Peer warnings are acceptable.

**Traceability:** spec §2, §4.6.

---

### Task 2 — `BookingEntity` relations + migration

**Files:**
- Modify: `apps/api/src/modules/bookings/infrastructure/persistence/booking.entity.ts`
- New: `apps/api/src/platform/database/migrations/<generated>-AddBookingRelations.ts`

**Entity shape (normative intent from spec §4.1):**

```ts
@Column({ type: 'uuid' })
@Index()
customerId!: string;

@ManyToOne(() => CustomerEntity, { nullable: false, eager: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'fk_booking_customer' })
customer!: CustomerEntity;
```

Repeat for `property` / `service` (`nullable: false`) and `team` (`nullable: true`, `teamId: string | null`). Do **not** add inverses. Do **not** set `eager: true`. Do **not** set `lazy: true` (no `Promise<CustomerEntity>`). No cascade.

BookingEntity **may import** `CustomerEntity` (etc.) as TypeORM relation *metadata* (spec §4.1). That is not module ownership. Do **not** add those classes to `BookingsModule` `forFeature`.

**Migration:**

```bash
pnpm --filter api migration:generate AddBookingRelations
```

Hand-trim spurious drop/re-add of other modules’ FKs (existing convention). The generated up() MUST NOT rename `customerId`/`propertyId`/`serviceId`/`teamId` and MUST NOT change `ON DELETE RESTRICT`. If generate wants to drop and recreate `fk_booking_*` with the same name/action, delete those statements (no-op migration is allowed). If generate is empty because metadata now matches the existing FKs, commit an empty-commented migration **or** skip the file and document “no schema diff” in the PR — either is fine as long as `migration:run` on a seeded DB succeeds.

**Hard stop:** if TypeORM 1.1.x rejects dual `@Column` + `@ManyToOne`, try `@RelationId` fallback from §3. If that cannot preserve writable UUID scalars for REST/commands, **return the spec**. Do not register foreign entities.

**Verify:** `pnpm --filter api migration:run`; application unit tests still pass (they use `customerId` scalars).

**Traceability:** spec §4.1.

---

### Task 3 — Minimum `@FilterableField` on related types

**Files (modify only GraphQL types, not resolvers):**
- `apps/api/src/modules/customers/presentation/graphql/customer.type.ts` — `id`, `fullName`
- `apps/api/src/modules/customers/presentation/graphql/property.type.ts` — `id`, `addressLine1`
- `apps/api/src/modules/catalog/presentation/graphql/service.type.ts` — `id`, `name`
- `apps/api/src/modules/cleaners/presentation/graphql/team.type.ts` — `id`, `name`

Replace those fields’ `@Field()` with nestjs-query filter metadata **only where needed**. Preserve existing GraphQL scalar and nullability semantics.

Do **not** blindly replace `id` decorators. Today these types use `@Field(() => ID)`, not `@IDField`. Add the minimum metadata 9.5.0 requires for Booking `FilterableRelation` (typically `@FilterableField(() => ID)` or `@IDField(() => ID)` on `id`, plus `@FilterableField()` on the named scalar). If an existing decorator already provides that metadata, leave it.

Leave every other field as `@Field()`. Do not add `ReadResolver`s.

**Traceability:** spec §2, §4.5.

---

### Task 4 — Booking GraphQL read adapter (the proving composition)

**Files:**
- Create: `apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts`
- Create: `apps/api/src/modules/bookings/presentation/graphql/booking-read.resolver.ts`
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.resolver.ts` → mutation-only (`BookingMutationResolver`), `@Resolver(() => BookingDTO)`
- Modify: `apps/api/src/modules/bookings/presentation/graphql/mappers.ts` — `toBookingDto`; keep FK ids on the runtime object for Jobs nested parents
- Modify: `apps/api/src/modules/bookings/bookings.module.ts`
- Delete: `booking.type.ts`, `booking-relation.loaders.ts`
- Modify (mechanical): Jobs `cleaning-job.type.ts`, `job.resolver.ts`, `jobs/.../mappers.ts` imports

**DTO (do not copy this blindly if 9.5.0 decorator order differs; match installed typings):**

```ts
@ObjectType('Booking')
@QueryOptions({ pagingStrategy: PagingStrategies.NONE })
@FilterableRelation('customer', () => CustomerType, {
  nullable: false,
  update: { enabled: false },
  remove: { enabled: false },
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
})
@FilterableRelation('property', () => PropertyType, { /* same, nullable: false */ })
@FilterableRelation('service', () => ServiceType, { /* same, nullable: false */ })
@FilterableRelation('team', () => TeamType, { /* same, nullable: true */ })
export class BookingDTO {
  @IDField(() => ID) id!: string;
  @FilterableField() scheduledAt!: Date;
  @FilterableField(() => BookingStatus) status!: BookingStatus;
  @Field(() => BookingPricingSnapshotType) pricingSnapshot!: BookingPricingSnapshotType;
  @FilterableField() createdAt!: Date;
}
```

No `customerId` `@Field`. Relation names MUST match TypeORM property names (`customer`, not `customerId`).

`@FilterableRelation` declares the relation for filtering and for Relatable. It is **not** a substitute you combine with a hand-written `@ResolveField()`. `BookingMutationResolver` MUST NOT define `customer` / `property` / `service` / `team` field resolvers. Delete the four methods from today’s `booking.resolver.ts` when splitting.

**Read resolver:**

```ts
@Resolver(() => BookingDTO)
export class BookingReadResolver extends Relatable(BookingDTO, {
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
    @InjectQueryService(BookingEntity)
    readonly service: QueryService<BookingEntity>,
  ) {
    super(service);
  }
}
```

**Module registration (verify against 9.5.0; do not fight the installed API):**

- `NestjsQueryTypeOrmModule.forFeature([BookingEntity])` — Booking QueryService only.
- Register `BookingDTO` with `NestjsQueryGraphQLModule.forFeature` using the 9.5.0 API required for **manually composed** resolvers (`dtos:` and/or equivalent). **Do not** use `resolvers: [{ DTOClass, EntityClass }]` (that is the auto CRUD path).
- Verify whether `EntityClass` on a `dtos:` entry is required for authorizer/DTO metadata or only for generated resolvers. Omit it if the installed typings allow `dtos: [{ DTOClass: BookingDTO }]`.
- Keep `TypeOrmModule.forFeature([BookingEntity])` because `BookingsService` injects `@InjectRepository(BookingEntity)`.
- Providers: `BookingReadResolver`, `BookingMutationResolver`, `BookingsService`, `BookingSeeder`. **Not** `BookingRelationLoaders`.

**Hard gate (QueryService ownership, not “if anything fails”):**

1. Relation reads fail? **First** determine exactly which provider or GraphQL DTO metadata is missing (DataSource entity metadata vs Booking QueryService vs related DTO filter metadata vs a related QueryService token).
2. Related DTO metadata belongs on the owning modules’ GraphQL types (Task 3) — that is allowed.
3. If the missing piece is a Customer/Property/Service/Team **QueryService that BookingsModule would have to register/own**, **stop and return the spec**. Do not add `NestjsQueryTypeOrmModule.forFeature([CustomerEntity, …])` (or `TypeOrmModule.forFeature` of those entities) on Bookings merely to satisfy DI.

If Relatable emits denylisted mutations despite `update/remove.enabled: false`, switch composition to `ReadResolver` + `ReadRelationsResolver` (both exported in 9.5.0) before considering any other workaround.

**Do not delete** `BookingsService.findOne` / `.findAll` / `.getBookingsByIds`. Mutation methods keep calling `create` / `update` / `remove`. Application code continues to write `customerId` scalars, not `booking.customer = …`.

**Traceability:** spec §4.2, §4.5, §4.6, §4.7, §4.9#10.

---

### Task 5 — Schema and unit tests

**Files:**
- Modify: `apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts`
- Delete: `apps/api/src/modules/bookings/tests/graphql/booking-relation.loaders.spec.ts`

Replace loader-method tests with schema factory tests using `BookingReadResolver` + `BookingMutationResolver` + the same related resolvers as today. If `GraphQLSchemaFactory` cannot see Relatable fields, introspect the schema from `AppModule` / generated `schema.gql` instead.

Assert:

- `Booking` fields: exactly the nine names in spec §4.5; no `*Id`
- `Query.booking` return type is **non-null** `Booking` (`GraphQLNonNull`)
- `Query.bookings` return type is non-null list of non-null `Booking`; args include optional `filter` and `sorting`; **no** `paging`
- `Mutation` field names include `createBooking`, `updateBooking`, `removeBooking` and do **not** include any string matching `/^(create|update|delete)(One|Many)Booking/`, `/^set(Customer|Property|Service|Team)OnBooking/`, `/^(add|remove).*(Booking|Customer|Property|Service|Team)/`
- Mutation methods still have `AuthGuard` + WRITE_ROLES
- Retarget existing `actorId` wiring tests onto `BookingMutationResolver` (constructor no longer takes loaders)
- `BookingMutationResolver` / `BookingReadResolver` source has **no** `@ResolveField` for `customer` / `property` / `service` / `team`

**Architectural grep (static, not a runtime test):** from `apps/api/src/modules/bookings/{domain,application,presentation/rest}` plus `booking.entity.ts` write paths, assert there is no application/command/REST assignment or read of `.customer`, `.property`, `.service`, or `.team` relation properties (UUID columns `customerId` etc. remain). Persistence relation *declarations* on `BookingEntity` are the exception.

Keep REST and application specs as-is.

**Traceability:** spec §4.1, §4.5, §4.6, §4.3.

---

### Task 6 — E2E SQL proof, Jobs nested path, client codegen

**Files:**
- Create: `apps/api/test/helpers/capture-sql.ts`
- Modify: `apps/api/test/bookings.e2e-spec.ts` (replace bulk-method spies; add missing-id + unselected-team cases; seed N≥6 bookings for the batch query)
- Modify: `apps/api/test/jobs.e2e-spec.ts` only as needed so `jobs { booking { customer { fullName } } }` is asserted O(1) in customer SQL (job→booking `getBookingsByIds` spy remains)
- `packages/client`: run codegen; commit generated output

**SQL helper sketch:**

```ts
export function captureSql(dataSource: DataSource): { stop: () => string[] } {
  const queries: string[] = [];
  const logger = dataSource.logger;
  const original = logger.logQuery.bind(logger);
  logger.logQuery = (query: string, params?: unknown[]) => {
    queries.push(query);
    return original(query, params);
  };
  return { stop: () => queries };
}
```

Enable query logging for the test (`dataSource.setOptions({ logging: ['query'] })` if `logQuery` is otherwise a no-op). Count with a case-insensitive match on table names.

**O(1) in N, not exactly-one SQL:**

Run the four-relation list query at **N = 6** and **N = 12** (seed extra bookings in the suite). For each of `customer_entity`, `property_entity`, `service_entity`, `team_entity`:

```text
count(SQL mentioning table, N=6)  === count(SQL mentioning table, N=12)
count is independent of N
no per-parent pattern (N statements for N parents)
```

A single batched `IN (...)` per relation is preferred. A fixed constant >1 (e.g. one COUNT + one SELECT) is compliant. Do not “fix” a constant 2 by inventing lookahead/joins.

A second request omitting `team` has **0** statements mentioning `team_entity`.

Keep the existing **view** RBAC steps (Finance/Analyst succeed at read) as well as write RBAC/audit.

Missing id:

```graphql
query { booking(id: "00000000-0000-0000-0000-000000000099") { id } }
```

Expect `errors` present and `data.booking` absent/null-with-error — not a successful `{ booking: null }` payload.

**Codegen:**

```bash
pnpm --filter @clensy/client codegen
```

Existing `bookings.graphql` documents must typecheck. Generated `BookingQuery['booking']` is non-optional.

**Manual:** `/app/bookings` list + drawer still works.

**Traceability:** spec §4.8, §4.9, §4.5, §4.10.

## 10. Execution / operational risks (not redesign)

- If Task 4 cannot resolve relations without Bookings-owned foreign **QueryServices**, that is a **spec-return**, not a planning gap. Missing related **DTO filter metadata** is Task 3, not a foreign `forFeature`.
- `migration:generate` noise on other FKs is expected; trim as in prior Booking/Jobs plans.
- Jobs nested `booking { customer }` uses Booking’s new relation resolvers once `BookingDTO` is the `Booking` object type; if that regresses N+1, fix Booking relations, not Jobs loaders.
- Do not start Customer/Job nestjs-query migrations in this PR.

## 11. Out of scope (explicit)

Quality (#7), Dashboard (#8), paging, aggregations, inverse ORM collections, shared entity package, deleting `BookingsService.findOne`/`findAll`, REST-through-nestjs-query, recreating the probe.
