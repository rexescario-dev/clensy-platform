# Paginated nestjs-query GraphQL Collections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start M6 until M5 has Accepted this plan.**

**Goal:** Apply the Accepted platform collection contract — offset connections, default 20 / max 100, `totalCount`, deterministic sort, nested connections, no alternate arrays — to the §4.2 inventory, with `property.bookings` as the first cross-module nest proof.

**Architecture:** Keep #29’s read stack (`ReadResolver` many + `Relatable` → owning-module QueryService → Clensy writes). nestjs-query 9.5.0 already ships on Booking; this plan changes paging and extends the same composition to the rest of the inventory. Nested many-relations resolve through the **parent** QueryService’s TypeORM relation metadata (`queryRelations` / `QueryRelationsLoader`), not by the parent module owning the child’s QueryService.

**Tech Stack:** NestJS, `@ptc-org/nestjs-query-{core,graphql,typeorm}` 9.5.0, TypeORM 1.1.x, GraphQL (code-first), `packages/client` codegen, Next.js `apps/web`.

**Spec:** [Paginated nestjs-query GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) — Status: **Accepted**, 2026-08-28.

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-08-28 |
| **Tracking** | [#33](https://github.com/rexescario-dev/clensy-platform/issues/33) |
| **Package/repo scope** | `apps/api` (platform paging + every §4.2 collection), `packages/client` (operation documents + codegen), `apps/web` (list/detail pages that select those collections). **Not** Quality (#7), Dashboard product (#8), Payments (#10), Admin GraphQL (`admins`). |
| **Depends on (Accepted)** | [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) (**Accepted**). Relies on [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md) (**Accepted**, #29) as **amended** by this RFC; [nestjs-query GraphQL Reads plan](2026-08-28-nestjs-query-graphql-reads-plan.md) (**Accepted**) is the Booking **read-stack** reference — **do not** copy `PagingStrategies.NONE`. Also relies on already-Accepted Customers, Cleaners, Catalog, Bookings, Jobs, Admin Foundation, Dashboard UX Foundation, and Phase 1 §2.6 as amended by the collections spec. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 plan; **M5 Accepted** |
| **Packaging** | Same tracking issue/PR as the Accepted spec ([#33](https://github.com/rexescario-dev/clensy-platform/issues/33)). Do **not** open a plan-only merge PR. Do **not** `Closes #33` until M6 ships. |
| **Revision note** | Second draft, then M5. Human plan review: un-lock `customerProperties` connection factory; clamp-before-`PropertyMax` is a Task 2 9.5.0 integration gate; nested O(1) is query-count invariance, not `booking_entity` string matching. Recommended: policy vs per-surface adapters; option-surface drift tests; default-sort column gate; authoritative `customerId` without `mergeQuery`; Jobs filters as mechanisms to prove; Task 3 aliases as a temporary harness. |
| **M5 decision** | **Accepted** — 2026-08-28. No plan blockers. 9.5.0 mechanics remain implementation-time proofs with explicit spec-return stops; do not promote those observations into architectural changes. Ready for M6 Implementation (Task 1 first; Task 2 clamp gate; Task 3 nested hard gate). |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement the Accepted spec’s migration inventory (§4.2): every listed GraphQL collection becomes a nestjs-query **offset connection** with platform paging (20 / 100, clamp), `totalCount`, and a deterministic default sort (unique tie-breaker). Break Booking’s many-query. Add nested `property.bookings`. Replace Jobs full-list joins with bounded server reads. Update `packages/client` and in-scope `/app/*` list screens. Do **not** page REST or application `findAll` / `list*` methods. Do **not** migrate `admins`. Do **not** emit nestjs-query `one` onto modules whose get-by-id is still nullable.

## 2. Constraints (SHALL / SHALL NOT)

Traced only to the Accepted spec. Every task inherits this section.

**SHALL:**

- Expose every §4.2 field as an offset connection (`nodes`, `pageInfo`, `totalCount`). No `[Entity!]!` for those fields. No alternate unpaginated array for the same collection (spec §4.1, §6#1).
- Default limit **20**, max **100**, from **one** platform source, enforced server-side. `limit > 100` **clamps** to 100. Never `maxResultsSize: -1` (spec §4.1, §6#3).
- Deterministic default sort with a unique tie-breaker (normally `id`) on every paginated collection (spec §4.1, §6#4).
- Enable `totalCount` on **root and nested** connections via the applicable 9.5.0 option (`enableTotalCount` on `@QueryOptions` and on `@OffsetConnection` / Relatable, not a custom field, not a global switch) (spec §4.1).
- Nested connection SQL/query count **O(1) in parent N**; no per-parent child query (spec §4.3, §6#9).
- Owning-module-only `forFeature` / QueryService. Parent MUST NOT `forFeature` the child entity solely for DI. Importing a module that **already exported** the child’s QueryService is allowed; re-registering it is not (spec §4.3, §6#7).
- Inverse TypeORM collection metadata is **preferred** for the §4.3 table, subject to proof. Persistence only: not on domain objects, not used by application writes (spec §4.3, §6#8).
- Keep Clensy nullable get-by-id (`customer`, `property`, `cleaner`, `team`, `service`, `job`). Booking’s `booking(id): Booking!` stays as #29 shipped it. If `ReadResolver` would emit a colliding `one`, disable/do not register it (spec §4.1, §6#12).
- `customerProperties` keeps its name and required customer scope, **server-enforced**. No unscoped `properties` root (spec §4.2, §6#13).
- Jobs existence checks are server-side and bounded. Relation-existence filter is preferred, not guaranteed; uniqueness `ConflictException` remains the fallback. Do not invent `jobByBookingId` unless the connection/filter model cannot express existence (spec §4.5, §6#10).
- Writes stay Clensy mutations. Schema allowlist: no generated CRUD/relation mutations, aggregations, or subscriptions (spec §4.1, §6#6).
- Keep application `findOne` / `findAll` / `getXByIds` / `listCustomerProperties` / `listTeamCleaners` / `listJobs`. Removing one because GraphQL uses QueryService is a spec-return (spec §4.4).
- Update client documents and in-scope web pages in the same delivery as each schema break (spec §4.5, §6#5).

**SHALL NOT:**

- Copy Booking’s shipped `PagingStrategies.NONE` / `[Booking!]!`.
- Copy Booking’s `ReadResolver` `one` onto nullable get-by-id modules.
- Register foreign entities/QueryServices on a parent module merely to satisfy Relatable DI. If 9.5.0 **fundamentally requires** that, **return the spec** — do not “make DI work” (spec §4.3).
- Use TypeORM `lazy: true` / `eager: true` on these collections.
- Add `customer.bookings` / `team.bookings` / `service.bookings`, a `pricings` collection, root `properties`, root `checklists`, or migrate `admins`.
- Page REST. Start Quality, Dashboard product, or Payments.
- Flatten DDD folders or put inverse collections on domain objects.

## 3. Implementation decisions (M4 choices)

These are **planning decisions**, not new product semantics. If a proof contradicts a **spec** constraint, stop and return to M2/M3.

### 3.1 9.5.0 facts already verified in this planning pass

Inspected against installed/published **9.5.0** source (not assumed from memory):

| Topic | 9.5.0 fact | Plan consequence |
| --- | --- | --- |
| Platform defaults | `NestjsQueryGraphQLModule.forRoot` only accepts `dataLoader`. Paging option *names* (`defaultResultSize`, `maxResultsSize`, `pagingStrategy`, `defaultSort`, `enableTotalCount`) appear on `@QueryOptions` / `ReadResolver` / `QueryArgsType`. Library defaults are **cursor**, `defaultResultSize: 10`, `maxResultsSize: 50`. | One **policy** (20 / 100 / OFFSET / `totalCount`). Per-surface adapters are M4-proven — do not assume one TypeScript object is valid on every decorator. Do not expect `forRoot` to set 20/100. |
| Clamp vs validate | `PropertyMax` **rejects** `limit > max` (class-validator). It does **not** clamp. | Spec requires clamp. Task 1 may unit-test a clamp transform in isolation. **Task 2** must prove, on a generated GraphQL resolver, that `limit: 1000` is transformed to `100` **before** `PropertyMax` runs (100 nodes, no validation error). Keep `maxResultsSize: 100` as a backstop. Never `-1`. If resolver/decorator pipes cannot execute at that stage, **return the spec** — do not disable the max. |
| Disable `one` | `ResolverQuery` skips registration when `opts.one.disabled === true`. | Modules with Clensy nullable get-by-id: `ReadResolver(..., { one: { disabled: true }, many: { name } })`. Booking keeps `one: { name: 'booking' }`. |
| Nested many | `ReadManyRelationMixin` / `QueryRelationsLoader` call **`this.service.queryRelations`** (the **parent** QueryService), batched by identical query JSON. | Preferred inverse `@OneToMany` on the parent entity is sufficient for Relatable. Parent does **not** need the child’s QueryService if TypeORM relation metadata exists on the parent entity. |
| Nested count | `batchCountRelations` maps `getCount()` **per parent**. | Selecting nested `totalCount` may be O(N) in 9.5.0. **Task 3 must measure this.** If nested `totalCount` is one query per parent, **return the spec** — do not drop nested `totalCount` and do not accept N queries. |
| `forRoot` | Already `{}` in `GraphqlModule`. | Leave it. Paging is not configured there. |

### 3.2 Platform paging policy (not a universal options object)

Create `apps/api/src/platform/graphql/paging.ts` as the **policy source**:

```ts
export const PLATFORM_PAGE_DEFAULT = 20;
export const PLATFORM_PAGE_MAX = 100;
```

Plus a default-sort table (M4 column choice; totality + unique `id` tie-breaker is the spec):

| Collection | Intended default sort |
| --- | --- |
| `bookings`, `jobs`, `property.bookings` | `scheduledAt DESC`, `id ASC` |
| `checklist.items` | `position ASC`, `id ASC` |
| all other §4.2 collections | `createdAt DESC`, `id ASC` |

Do **not** ship one helper object that is spread into `@QueryOptions`, `ReadResolver`, and `@OffsetConnection` until Task 2 / Task 3 prove those surfaces accept the same shape. Adapters (small functions or inline option bags) supply the **applicable** 9.5.0 option names per surface. Duplication across surfaces is **required** because 9.5.0 has multiple option sites; tests MUST fail if any surface falls back to cursor / 10 / 50 or disables `totalCount` (Task 2 for root, Task 3 for nested, Task 8 sweep).

`ClampPagingLimitPipe` (or equivalent transform) may live next to the policy. **Task 1** unit-tests it in isolation (1000 → 100; 20 unchanged; omitted paging does not invent a limit). Registering it on `ReadResolver` / `@OffsetConnection` `pipes:` is a **candidate** mechanism, not a locked 9.5.0 fact. Task 2 proves whether that (or another 9.5.0-supported hook) actually mutates generated `paging.limit` before `PropertyMax`.

Sort fields MUST be exposed as sortable in 9.5.0 (typically `@FilterableField`). Task 8 verifies every `defaultSort.field`: entity column exists → DTO field exists → sortable metadata exists → nestjs-query accepts it as a `SortField`. If a collection lacks the intended column, pick another deterministic pair **with a unique tie-breaker** rather than inventing a column.

### 3.3 Repeatable GraphQL composition

Copy Booking’s **read-stack**, not its paging. Shape to realize (exact decorator/option bags are proven per task against 9.5.0):

- `Relatable(DTO, { enableAggregate: false, … })` wrapping `ReadResolver(DTO, { guards, decorators, one, many, … })`
- Nullable get-by-id modules: `one: { disabled: true }`. Booking keeps `one: { name: 'booking' }`.
- Platform policy values on **every applicable 9.5.0 surface** for that DTO (DTO `@QueryOptions`, `ReadResolver` opts, nested `@OffsetConnection` / Relatable many-opts). Do not assume one spread object; do not leave a surface on library cursor/10/50.
- Clamp mechanism from Task 2, once proven, applied uniformly to root and nested generated resolvers.

Keep the Clensy `*Resolver` for **mutations + nullable get-by-id**. Delete the Clensy **list** method and any `@ResolveField` that Relatable now owns. Do **not** use `CRUDResolver` or `resolvers: [{ DTOClass, EntityClass }]`. Register `dtos: [{ DTOClass }]` + `NestjsQueryTypeOrmModule.forFeature([OwningEntity])` + keep existing `TypeOrmModule.forFeature` for application repositories.

Many-to-one / one-to-one GraphQL fields that are **not** collections (`cleaner.team`, `job.booking`, `job.team`, `job.checklist`, `service.activePricing`, Booking’s four relations) stay objects. Do not turn them into connections.

### 3.4 Nested connections

Inventory nests use **`@OffsetConnection`**, not `@FilterableOffsetConnection`, unless a later task **proves** it needs relation filtering. Relation **filtering** is not implied by a nested connection (spec §4.1).

Nested option bag (illustrative — Task 3 proves which 9.5.0 keys this decorator actually accepts):

```ts
@OffsetConnection('bookings', () => BookingDTO, {
  nullable: false,
  enableTotalCount: true, // or the equivalent nested 9.5.0 option
  // platform 20/100/OFFSET/defaultSort via the keys this decorator supports
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
  update: { enabled: false },
  remove: { enabled: false },
})
```

Do not spread a root-query options object here until Task 3 confirms compatibility.

Preferred persistence (subject to Task 3 proof):

```ts
// PropertyEntity — GraphQL inverse of BookingEntity.property
@OneToMany(() => BookingEntity, (booking) => booking.property)
bookings!: BookingEntity[];
```

`eager: false`. No cascade. No domain-object collection. Application/commands/REST MUST NOT read or assign `.bookings`.

**Cross-module cycle:** `BookingDTO` already imports `PropertyType`. `PropertyDTO` will reference `BookingDTO`. Break the TypeScript cycle with a lazy thunk on **one** side (`() => require('...').BookingDTO` or equivalent). Do not merge modules to dodge the import.

**Hard gate (Task 3):** prove nested `property.bookings` across module boundaries. Aliased `property(id:)` queries in **one GraphQL operation** are the **temporary proof harness** (N parent Property objects → nested bookings → bounded SQL). That is not a substitute for the later Task 4 proof through `customers { nodes { properties { … } } }`. CustomersModule MUST NOT `NestjsQueryTypeOrmModule.forFeature([BookingEntity])` (or `TypeOrmModule.forFeature` of Booking). If Relatable fails because a Booking **QueryService token** is missing:

1. Confirm it is not missing DTO metadata or TypeORM relation metadata.
2. Try **importing** `BookingsModule` **if and only if** Bookings already **exports** the existing Booking QueryService (re-export `NestjsQueryTypeOrmModule.forFeature([BookingEntity])`). That is allowed.
3. If the parent must **own/register** Booking’s QueryService, **stop and return the spec**.

If TypeORM 1.1.x rejects `BookingEntity` `@ManyToOne` plus `PropertyEntity` `@OneToMany` on the same FK (dual mapping), **return the spec**. Do not invent a third persistence model. Do not switch to `RelationQueryService` virtual relations as a silent substitute for the preferred inverse.

### 3.5 `customerProperties`

9.5.0 `ReadResolver` many is not assumed to accept an extra required `customerId` argument. Keep a **Clensy** query named `customerProperties` with required `customerId: ID!`.

Implement it with the **exact 9.5.0-supported connection construction mechanism** (Task 4 inspects installed source). The implementation MUST:

- return the same `PropertyConnection!` contract as other Property connections (`nodes`, `pageInfo`, `totalCount`);
- accept and apply `paging` / `filter` / `sorting` (same argument names/shapes as generated root connections, unless 9.5.0 cannot attach them to a custom query — in which case still produce an offset connection and prove paging/filter/sort work);
- enforce `customerId = argument` **authoritatively** regardless of any client-supplied `customerId` predicate; filters on **other** allowlisted fields remain applicable;
- reject a blank `customerId`;
- never expose unscoped `Query.properties`.

Do **not** assume `createFromPromise`, `mergeQuery`, a particular `QueryArgs` class, or `QueryService.count` until verified against installed 9.5.0. Disable Property `ReadResolver` many so `Query.properties` never appears. Relatable on Property still runs for `property.bookings`. `customerId` on the Property DTO MUST be filterable if the forced scope is expressed as a QueryService filter.

### 3.6 Jobs existence (spec §4.5)

Do **not** add `booking.jobs` (not in inventory). Do **not** add `jobByBookingId` unless Task 7 proves the connection/filter model cannot express existence.

**Mechanisms to prove** (in this order; none is locked until Task 7 verifies the generated filter SDL and a bounded e2e):

1. **Relation filter on existing object field `job.booking`.** Prove whether `@FilterableRelation('booking')` (or equivalent) yields a nested filter such as `jobs(filter: { booking: { id: { eq: $bookingId } } }, paging: { limit: 1 })`. Dual `@ManyToOne` on `CleaningJobEntity` is in play if that path needs ORM metadata. Application still writes `bookingId` scalars; no `job.booking` on the domain object. JobsModule MUST NOT `forFeature` BookingEntity.
2. **Scalar `bookingId` filter** if (1) cannot express existence without a new collection field.
3. **Clensy `jobByBookingId`** only if neither connection/filter path works.

Picker: first try a 9.5.0 relation-existence filter on `bookings` **without** adding a new GraphQL collection. If that requires `@FilterableOffsetConnection` / `booking.job(s)`, **do not add it**. Degrade to a **page** of `bookings` plus a bounded `jobs` page filtered to those ids + uniqueness `ConflictException`.

Do not leave `@ResolveField` and `@FilterableRelation` on the same field.

### 3.7 Filter allowlists (opt-in)

Only fields needed for default sort, id lookup, Jobs existence, and already-filterable Booking fields. Do not mark every column `@FilterableField`. Nested inventory connections are **not** filterable-from-parent unless Task 7 **proves** a relation filter is needed — and even then, do not add a new Booking collection.

Minimum `@FilterableField` per DTO: `id` plus every `defaultSort` column. Additional:

- `PropertyDTO.customerId` (forced scope)
- `CleaningJobDTO`: sortable/filterable metadata required by whichever §3.6 mechanism Task 7 proves (relation `booking` and/or `bookingId`)
- Booking: keep existing `scheduledAt`, `status`, `createdAt`
- `ChecklistItemDTO.position`, `completed` (progress / sort)

### 3.8 Client and web

Every in-scope operation document selects `nodes` (and `pageInfo` / `totalCount` where the UI pages). Form pickers that need “all options” request `paging: { limit: 100 }` (covers Phase 1 volumes; do not assume an unpaginated array).

`DataTable` already accepts optional `pagination: { page, pageSize, totalCount, onPageChange }` (`packages/ui`). Wire list screens to `totalCount` + offset. This is a data-contract change, not a visual redesign.

Pages that consume collections: `/app/bookings`, `/app/jobs`, `/app/customers`, `/app/cleaners`, `/app/cleaners/teams`, `/app/catalog`, `/app/catalog/add-ons`. Update each in the task that breaks that schema. `admins` documents stay arrays.

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/platform/graphql/paging.ts` (+ isolated clamp transform + tests) | `GraphqlModule.forRoot` Apollo/context; Auth; audit |
| Booking DTO/read-resolver paging + client/web bookings (+ jobs page’s `useBookingsQuery`) | Booking writes, REST, `BookingsService.find*` |
| Customers/Properties entities (preferred inverses), DTOs, read resolvers, `customerProperties` wrapper | Customers/Properties commands, `listCustomerProperties` **method existence** |
| Cleaners/Teams entities (preferred inverses), DTOs, read resolvers | Cleaners writes; `listTeamCleaners` existence |
| Catalog Service/AddOn DTOs + read resolvers | `activePricing` singleton, PricingRule create, no `pricings` query |
| Jobs/Checklist/Item DTOs + read resolvers + targeted existence UX | Job writes, uniqueness, `listJobs` existence |
| `packages/client` operation documents + codegen | Admin operations |
| In-scope `apps/web` list/detail data adapters | Dashboard product (#8), Quality, Payments |

## 5. Contract inventory (only what the Accepted spec authorizes)

| Field | After this plan |
| --- | --- |
| `customers` | `CustomerConnection!` |
| `customer.properties` | `PropertyConnection!` |
| `customerProperties(customerId: ID!)` | `PropertyConnection!`, server-scoped |
| `property.bookings` | `BookingConnection!` (new) |
| `cleaners` / `teams` / `team.cleaners` | connections |
| `services` / `addOns` | connections |
| `jobs` / `checklist.items` | connections |
| `bookings` | `BookingConnection!` (break NONE) |
| `customer` / `property` / `cleaner` / `team` / `service` / `job` | unchanged nullable Clensy one |
| `booking(id)` | unchanged `Booking!` |
| `admins` | unchanged `[Admin!]!` |

## 6. Slice sequence

```text
1. Platform paging policy + isolated clamp transform   (does not prove 9.5.0 integration)
2. Booking OFFSET — 9.5.0 integration proof
     ├─ OFFSET connection, default 20, max 100
     ├─ clamp-before-PropertyMax (mechanics gate)
     ├─ totalCount on root
     ├─ deterministic sort
     └─ option surfaces do not leak cursor/10/50
3. property.bookings HARD GATE
     ├─ inverse metadata
     ├─ parent QueryService / QueryRelationsLoader (or proven equivalent)
     ├─ no foreign forFeature
     ├─ O(1) nested nodes (alias harness)
     └─ O(1) nested totalCount (same harness)
     STOP if gate fails — return spec
4. Remaining Customers collections              (customers, customer.properties, customerProperties + nested O(1) via customers.nodes)
5. Cleaners / Teams
6. Catalog
7. Jobs / checklist.items + existence UX (mechanisms to prove)
8. Allowlist sweep, default-sort column gate, codegen, e2e, web golden paths
```

Task 3 is a **hard prerequisite** for Tasks 4–7 nested work. Task 1 does **not** prove clamp-inside-9.5.0. Task 2 may ship before Task 3 (root paging does not need inverses). If Task 3 returns the spec, do not “finish the inventory” with Clensy `@ResolveField` arrays.

### Nested SQL O(1) measurement (Tasks 3, 4, 5, 7)

Reuse `apps/api/test/helpers/capture-sql.ts`. For a **single** GraphQL operation that resolves **N parent objects** each requesting the nested connection:

1. Capture **all** SQL during that operation.
2. Exclude known unrelated setup (migrations, seed, auth lookups) by running the operation twice or subtracting a baseline captured before the GraphQL call — the comparison is **within the GraphQL execution**.
3. Assert `queryCount(N=12) === queryCount(N=6)` **or** the two counts differ by a **fixed known constant independent of N** (e.g. one extra unrelated statement that does not scale).
4. Inspect the captured SQL (normalized: strip parameters/literals; keep verb + primary tables). Fail if the template set shows **one child SELECT or COUNT per parent** (N copies of the same child query with different parent ids, or N COUNT queries). Matching only the substring `booking_entity` is **not** sufficient.

Run this **twice** in Task 3: (a) nested `nodes` only; (b) nested `totalCount` + `nodes`. If (b) scales with N, **return the spec**. Do not drop nested `totalCount`. Do not add a custom count field.

## 7. TDD / verification strategy

1. **Pipe unit tests (Task 1 only)** — clamp 1000→100 in isolation; 20 unchanged; missing paging unchanged. **Not** a 9.5.0 integration proof.
2. **Schema factory tests** (existing `*.resolver.spec.ts` pattern) — connection return types; `paging` arg present; `totalCount` on Connection type; no `Query.properties`; no denylisted CRUD/relation mutations; `one` still nullable where specified; `booking` still non-null; `admins` still `[Admin!]!`; paging strategy is OFFSET not cursor.
3. **E2E mechanics (Task 2)** — omitted paging → 20 nodes; `limit: 1000` → **100 nodes and no GraphQL/validation error** (clamp-before-`PropertyMax` gate); default sort stable across two offset pages with identical timestamps; selecting `totalCount` vs omitting it (root COUNT only when selected if 9.5.0 supports that; if the library always counts, document as residual — still O(1) for root).
4. **E2E nested O(1)** — procedure in §6 (not table-name substring matching).
5. **`customerProperties` (Task 4)** — server-owned `customerId` cannot be overridden; `totalCount` works; paging applied; blank `customerId` rejected.
6. **Application/REST tests** — still pass; do not delete `findAll` / `list*` tests.
7. **Client** — `pnpm --filter @clensy/client codegen` succeeds; generated types use `*Connection`.
8. **Web** — golden paths on the pages in §3.8 (Phase 1 Design §7 — no browser suite). DataTable pagination uses `totalCount`.

## 8. Traceability (spec → task)

| Spec contract | Task |
| --- | --- |
| One platform 20/100 source; clamp; not unlimited | 1 (policy), **2 (9.5.0 clamp gate)**, 8 |
| Booking `BookingConnection!`; client + `/app/bookings` | 2 |
| Nested O(1); inverse preferred; `forFeature` gate; `property.bookings` proof | 3 |
| Dual ManyToOne + OneToMany on TypeORM 1.1.x | 3 |
| `customers`, `customer.properties`, server-scoped `customerProperties` | 4 |
| `cleaners`, `teams`, `team.cleaners` | 5 |
| `services`, `addOns`; no `pricings` | 6 |
| `jobs`, `checklist.items`; Jobs targeted reads | 7 |
| Disable colliding `ReadResolver` `one` | 4–7 |
| `totalCount` root + nested; count only when selected | 2, 3 (nested O(1) gate), 8 |
| Default-sort fields exist and are sortable | 8 (and per-module as each DTO is added) |
| No alternate arrays; allowlist; `admins` untouched | 8 |
| Keep application list methods / writes / REST | all (negative: do not delete) |
| Quality / Dashboard / Payments | no task |

## 9. Task breakdown

### Task 1 — Platform paging policy + isolated clamp transform

**Files:**
- Create: `apps/api/src/platform/graphql/paging.ts` (constants `PLATFORM_PAGE_DEFAULT` / `PLATFORM_PAGE_MAX`; sort-table comments or exports — **not** a claimed-universal options object)
- Create: clamp transform (e.g. `clamp-paging-limit.pipe.ts`) as a **candidate** mechanism
- Create: `apps/api/src/platform/graphql/tests/clamp-paging-limit.pipe.spec.ts`
- Create: `apps/api/src/platform/graphql/tests/paging.spec.ts`

**Steps:**

- [ ] **Write failing tests** for the clamp transform in isolation: `{ paging: { limit: 1000, offset: 0 } }` becomes `limit: 100`; `{ paging: { limit: 20, offset: 40 } }` unchanged; `{}` / `{ paging: { offset: 0 } }` does not invent a limit. For policy constants: `PLATFORM_PAGE_DEFAULT === 20`, `PLATFORM_PAGE_MAX === 100`.

- [ ] **Implement** the constants and isolated transform. Do **not** treat wiring onto `ReadResolver` / `@OffsetConnection` as done. Task 2 owns 9.5.0 integration.

- [ ] **Run** `pnpm --filter api test -- clamp-paging-limit.pipe.spec.ts paging.spec.ts` — pass.

- [ ] **Commit** `test: add platform paging policy constants and isolated clamp transform`

**Traceability:** spec §4.1, §6#3, §9 (forRoot vs shared constant).

---

### Task 2 — Booking many-query becomes `BookingConnection!`

**Files:**
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts`
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking-read.resolver.ts`
- Modify: `apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts`
- Modify: `apps/api/test/bookings.e2e-spec.ts`
- Modify: `packages/client/src/operations/bookings.graphql`
- Modify: `packages/client/src/operations/jobs.graphql` only if it selects root `bookings` (it does not today — Jobs page uses `useBookingsQuery` from bookings.graphql)
- Modify: `apps/web/app/app/bookings/page.tsx`
- Modify: `apps/web/app/app/jobs/page.tsx` (it calls `useBookingsQuery` / `useJobsQuery` — update **bookings** consumption here so the app still compiles; full Jobs existence rewrite is Task 7)
- Codegen: `packages/client/src/generated/graphql.ts`

**DTO / resolver change:**

Remove `@QueryOptions({ pagingStrategy: PagingStrategies.NONE })` and Relatable `enableTotalCount: false` / ReadResolver `pagingStrategy: NONE`. Apply platform **policy values** through the 9.5.0 option keys each surface actually accepts (inspect installed typings). Keep `one: { name: 'booking' }` **enabled**. Keep the four `@FilterableRelation`s. Wire the clamp mechanism **only after** the mechanics gate below passes — if `pipes:` on `ReadResolver` does not run before `PropertyMax`, try another 9.5.0-supported hook (interceptor, custom paging type, etc.). If none can clamp without `maxResultsSize: -1`, **return the spec**.

**Failing tests first:**

Schema factory: `Query.bookings` return type is non-null `BookingConnection`; args include `filter`, `sorting`, `paging`; `BookingConnection` has `nodes`, `pageInfo`, `totalCount`; `Query.booking` remains non-null `Booking`; denylisted mutations still absent; **not** cursor paging (no `edges`/`cursor` as the collection strategy).

**Mechanics gate (required — not merely a regression):** execute the generated `bookings` resolver with `paging: { limit: 1000 }`. Success is **100 nodes (or all remaining if fewer than 100) and no GraphQL/class-validator error**. That proves `limit` was transformed to ≤100 **before** 9.5.0 `PropertyMax`. Unit-testing the pipe alone is insufficient. If the request errors with a max-allowed-value message, the integration is unproven — do not ship.

Also:

- Seed ≥ 21 bookings: omitted `paging` returns **20** nodes; `totalCount` ≥ 21.
- Two bookings with identical `scheduledAt`: order by `id ASC` is stable on `offset: 0` and `offset: 1`.
- Existing four-relation O(1) SQL proof still holds on `bookings { nodes { customer { id } … } }` (use §6 measurement, N=6 vs N=12).
- Schema/introspection: applicable option surfaces for Booking resolve to OFFSET / 20 / 100 / `totalCount` enabled — fail if any surface still implies cursor, default 10, max 50, or `enableTotalCount: false`.

**Client:**

```graphql
query Bookings($paging: OffsetPaging, $filter: BookingFilter, $sorting: [BookingSort!]) {
  bookings(paging: $paging, filter: $filter, sorting: $sorting) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage }
    nodes { id scheduledAt status pricingSnapshot { priceMinorUnits } customer { id fullName } property { id addressLine1 } service { id name } team { id name } }
  }
}
```

Keep `query Booking($id: ID!)` unchanged.

**Web:** `rows = data?.bookings.nodes ?? []`. Optional DataTable `pagination` from `totalCount` (page size 20). Jobs page: `bookingsData?.bookings.nodes` so TypeScript compiles; picker correctness is Task 7.

```bash
pnpm --filter @clensy/client codegen
pnpm --filter api test -- booking.resolver.spec.ts
pnpm --filter api test:e2e -- bookings.e2e-spec.ts
```

**Commit** `feat: paginate Booking GraphQL many-query`

**Traceability:** spec §4.1, §4.5, §4.7, §6#5.

---

### Task 3 — `property.bookings` proving nest (HARD GATE)

**Files:**
- Modify: `apps/api/src/modules/customers/infrastructure/persistence/property.entity.ts`
- New: `apps/api/src/platform/database/migrations/<generated>-AddPropertyBookingInverse.ts` (or skip if generate is empty after trim)
- Create/modify: Property GraphQL DTO (`property.type.ts` → add `@QueryOptions` + `@OffsetConnection('bookings', …)` **or** `property.dto.ts` replacing `PropertyType` while keeping `@ObjectType('Property')`)
- Create: `apps/api/src/modules/customers/presentation/graphql/property-read.resolver.ts` (Relatable; `one: { disabled: true }`, `many: { disabled: true }` — root Property many is Task 4’s `customerProperties`)
- Modify: `apps/api/src/modules/customers/customers.module.ts` — `NestjsQueryTypeOrmModule.forFeature([PropertyEntity])` (and CustomerEntity only if already needed; **not** BookingEntity), `dtos: [{ DTOClass: PropertyDTO }]`, register `PropertyReadResolver`
- Modify: `apps/api/src/modules/customers/presentation/graphql/property.resolver.ts` — keep `property(id)`, mutations; do **not** add `properties` many
- Modify: Booking DTO import of Property type if the class is renamed
- Tests: property schema spec + `apps/api/test/customers-properties.e2e-spec.ts` (or a focused nested e2e)

**Persistence (preferred inverse):**

```ts
@OneToMany(() => BookingEntity, (booking) => booking.property)
bookings!: BookingEntity[];
```

Do **not** set `eager: true` / `lazy: true`. Do **not** add the collection to `Property` domain. Do **not** read `.bookings` from `PropertiesService` / commands.

```bash
pnpm --filter api migration:generate AddPropertyBookingInverse
```

Hand-trim spurious drop/re-add of existing `fk_booking_property`. MUST NOT rename `propertyId` or change `ON DELETE RESTRICT`.

**DTO cycle:** Property DTO references BookingDTO via lazy thunk (§3.4).

**Failing tests first:**

1. Schema: `Property.bookings` is non-null `BookingConnection` with `paging`/`filter`/`sorting`; `Query.property` still nullable; **no** `Query.properties`; **no** `allBookings`. Nested option surface uses OFFSET / 20 / 100 / `totalCount` (fail if this nest leaked cursor/10/50).
2. Module grep: `customers.module.ts` does not mention `BookingEntity` in any `forFeature` array.
3. **Nested batching harness (deliberate, temporary):** one GraphQL operation with **N aliased** `property(id:)` fields, each selecting `bookings { nodes { id } }`. This proves “N parent Property objects → nested bookings → bounded SQL,” not the eventual `customers` root collection.

```graphql
query {
  p1: property(id: "…") { bookings { nodes { id } } }
  p2: property(id: "…") { bookings { nodes { id } } }
  # … N aliases
}
```

Seed N=6 and N=12 parents (each with ≥1 booking). Measure with the **§6 nested SQL O(1) procedure**. Do **not** pass by counting only statements whose text includes `booking_entity`.

4. Repeat the same harness with `bookings { totalCount nodes { id } }`. If statement count or per-parent COUNT/SELECT templates scale with N, **STOP and return the spec**. Do not disable nested `enableTotalCount`. Do not add a custom count field.

5. Nested clamp: `bookings(paging: { limit: 1000 })` on one parent returns ≤100 nodes and **no** validation error (reuse Task 2 mechanism).

6. Application unit tests still pass (they never touch `.bookings`).

**Hard stops:** TypeORM dual mapping illegal; parent must `forFeature` Booking; nested nodes O(N); nested `totalCount` O(N). Any of these → return spec, do not start Tasks 4–7 nests.

**Commit** `feat: add nested property.bookings connection`

**Traceability:** spec §4.2, §4.3, §6#7, §6#9, §6#11, §9.

---

### Task 4 — Customers collections (`customers`, `customer.properties`, `customerProperties`)

**Files:**
- Modify: `customer.entity.ts` — preferred `@OneToMany(() => PropertyEntity, (p) => p.customer) properties`
- Modify: `property.entity.ts` — dual `@Column customerId` + `@ManyToOne(() => CustomerEntity)` (Booking pattern). Application keeps writing `customerId` scalars.
- Migration: trim FK noise; keep existing customer FK name/ON DELETE
- Create: `customer.dto.ts` / convert `CustomerType`; `@OffsetConnection('properties', () => PropertyDTO, { enableTotalCount: true, … })`
- Create: `customer-read.resolver.ts` — `many: { name: 'customers' }`, `one: { disabled: true }`
- Modify: `customer.resolver.ts` — delete `customers()` list and `properties` `@ResolveField`
- Modify: `property.resolver.ts` — replace array `customerProperties` with a Clensy query that meets §3.5; keep `property(id)` nullable. Inspect installed 9.5.0 for how to build `PropertyConnection!` (do not copy an assumed `createFromPromise` / `mergeQuery` snippet).
- Modify: `customers.module.ts` — `forFeature` CustomerEntity + PropertyEntity only
- Tests: `customer.resolver.spec.ts`, `property.resolver.spec.ts`, `customers-properties.e2e-spec.ts`
- Client: `customers.graphql`, `properties.graphql`
- Web: `apps/web/app/app/customers/page.tsx`

**Failing tests:**

- `Query.customers` is `CustomerConnection!`; `Customer.properties` is `PropertyConnection!`; `Query.customer` nullable; `Query.customerProperties(customerId: ID!)` is `PropertyConnection!`; **no** `Query.properties`.
- **`customerProperties` 9.5.0 proof:** inspect installed connection-construction API; then e2e:
  - `customerId: A` plus client `filter.customerId.eq: B` returns **only A’s** properties (never B’s, never all) — argument is authoritative;
  - omitted paging returns ≤ 20; `paging.limit: 2` returns ≤ 2; `totalCount` equals A’s property count;
  - blank `customerId` is rejected (GraphQL error, not an unscoped list).
- Nested O(1) through the **root collection** (second proof after Task 3 aliases):

```graphql
query {
  customers(paging: { limit: 20 }) {
    nodes {
      properties(paging: { limit: 20 }) { nodes { id } }
    }
  }
}
```

Use §6 measurement at N=6 vs N=12 customers. Repeat with nested `totalCount` selected.
- `listCustomerProperties` application tests still exist and pass.

**Client** documents select `nodes`. Customer detail pages `properties` until exhausted or `limit: 100`.

**Commit** `feat: paginate customer and property GraphQL collections`

**Traceability:** spec §4.2, §6#13.

---

### Task 5 — Cleaners and Teams

**Files:**
- `team.entity.ts` — `@OneToMany(() => CleanerEntity, (c) => c.team) cleaners`
- `cleaner.entity.ts` — dual `teamId` + `@ManyToOne(() => TeamEntity)` (nullable). Application/`assignCleanerToTeam` still writes `teamId`.
- Migration: trim; keep existing team FK
- Convert `CleanerType` / `TeamType` to DTOs with platform paging; Team `@OffsetConnection('cleaners', …)`
- `CleanerReadResolver`: `many: { name: 'cleaners' }`, `one: { disabled: true }`
- `TeamReadResolver`: `many: { name: 'teams' }`, `one: { disabled: true }`, Relatable for `cleaners`
- Keep `cleaner.team` as the existing Clensy `@ResolveField` + `CleanerTeamLoaders` (object, not a collection) **unless** Relatable `@FilterableRelation('team')` is cleaner; do not do both
- Delete Clensy `cleaners()` / `teams()` lists and `TeamResolver.cleaners` `@ResolveField`
- `cleaners.module.ts`: `NestjsQueryTypeOrmModule.forFeature([CleanerEntity, TeamEntity])` only
- Tests + e2e `cleaners-teams.e2e-spec.ts`
- Client: `cleaners.graphql`, `teams.graphql`
- Web: `apps/web/app/app/cleaners/page.tsx`, `apps/web/app/app/cleaners/teams/page.tsx`

**Failing tests:** connection types; `team.cleaners` is `CleanerConnection!`; `cleaner`/`team` one still nullable; `listTeamCleaners` still tested; nested `teams { nodes { cleaners { nodes { id } } } }` uses §6 O(1) measurement in team N (nodes and `totalCount`).

**Commit** `feat: paginate cleaner and team GraphQL collections`

**Traceability:** spec §4.2, Cleaners spec list contracts as amended.

---

### Task 6 — Catalog (`services`, `addOns`)

**Files:**
- Convert `ServiceType` / `AddOnType`; **no** `pricings` connection; keep `activePricing` `@ResolveField` + `ActivePricingLoader`
- `ServiceReadResolver` / `AddOnReadResolver`: many enabled, `one: { disabled: true }` for `service`; addOn get-by-id stays as today (add a Clensy one only if one already exists — do not invent `addOn(id)` if the schema has none)
- Delete Clensy list methods
- `catalog.module.ts`: `forFeature` ServiceEntity + AddOnEntity (not PricingRule unless already required for writes)
- Tests + `catalog.e2e-spec.ts`
- Client: `services.graphql`, `add-ons.graphql`
- Web: `apps/web/app/app/catalog/page.tsx`, `apps/web/app/app/catalog/add-ons/page.tsx`

**Failing tests:** `Query.services` / `Query.addOns` are connections; `activePricing` still a nullable singleton on `Service`; **no** `Query.pricings`; omitted paging ≤ 20.

**Commit** `feat: paginate catalog GraphQL collections`

**Traceability:** spec §4.2, §2 out of scope `pricings`.

---

### Task 7 — Jobs, `checklist.items`, targeted existence

**Files:**
- `checklist.entity.ts` — `@OneToMany(() => ChecklistItemEntity, (i) => i.checklist) items`
- `checklist-item.entity.ts` — dual `checklistId` + `@ManyToOne(() => ChecklistEntity)`
- Migration: trim; keep existing item FK
- Convert `CleaningJobType`, `ChecklistType`, `ChecklistItemType`
- Prove §3.6 mechanism 1 (relation filter on `job.booking`) against generated SDL; if it needs dual `@ManyToOne` on `CleaningJobEntity`, add it. JobsModule still MUST NOT `forFeature` BookingEntity. If (1) fails, prove (2) then (3).
- If Relatable owns `job.booking`, delete the booking method from `JobRelationLoaders` (keep team/checklist loaders). Do not leave `@ResolveField` and `@FilterableRelation` on the same field.
- `JobReadResolver`: Relatable + `many: { name: 'jobs' }`, `one: { disabled: true }`; keep Clensy `job(id)` nullable
- Checklist Relatable: `@OffsetConnection('items', …)` on Checklist DTO; delete `ChecklistResolver.items` array `@ResolveField`
- `jobs.module.ts`: `forFeature` CleaningJobEntity, ChecklistEntity, ChecklistItemEntity only
- Client: `jobs.graphql` — `jobs { nodes { … checklist { id items { nodes { id label position completed completedAt } } } } }`
- Web: `apps/web/app/app/jobs/page.tsx`, booking drawer job toggle in `bookings/page.tsx`

**Jobs UX (replace full-list join):**

Booking drawer uses whichever §3.6 mechanism Task 7 **proved** (relation filter, `bookingId` filter, or `jobByBookingId`). Illustrative **only if** mechanism 1 is proven:

```graphql
query JobByBooking($bookingId: ID!) {
  jobs(filter: { booking: { id: { eq: $bookingId } } }, paging: { limit: 1 }) {
    nodes { id }
  }
}
```

Create vs View from `nodes[0]` (or the equivalent one-record payload). Do **not** call `useJobsQuery()` for the full list.

Jobs picker: follow §3.6. After implementation, grep `apps/web` for `jobsData?.jobs.find` / `bookingsData?.bookings.filter` without `.nodes` — those must be gone.

Checklist progress: `job.checklist.items.nodes` (limit 20 covers today’s three items).

**Failing tests:** `Query.jobs` is `CleaningJobConnection!`; `Checklist.items` is `ChecklistItemConnection!`; `job(id)` nullable; uniqueness e2e still conflicts on second `createJobFromBooking`; nested items use §6 O(1) measurement; existence query with `limit: 1` does not scan all jobs (SQL `LIMIT` / node length 1). Document which §3.6 mechanism was proven.

Keep `JobsService.listJobs` tests.

**Commit** `feat: paginate jobs and checklist items; bound job existence reads`

**Traceability:** spec §4.2, §4.5, §6#10.

---

### Task 8 — Allowlist sweep, codegen, regression, web golden paths

**Files:** any leftovers from Tasks 2–7; `apps/api/src/schema.gql` (generated); `packages/client/src/generated/graphql.ts`; e2e suites listed in §7.

**Assert (schema or `schema.gql` grep):**

- Every §4.2 field is a `*Connection` with `totalCount` and `nodes`.
- No leftover `[Booking!]!` / `[Customer!]!` / `[Property!]!` / `[Cleaner!]!` / `[Team!]!` / `[Service!]!` / `[AddOn!]!` / `[CleaningJob!]!` / `[ChecklistItem!]!` on those field names.
- No `allBookings`, `Query.properties`, `Query.checklists`, `Query.pricings`.
- `admins: [Admin!]!` **unchanged**.
- No `createOne*` / `updateOne*` / `deleteOne*` / `createMany*` / relation `add*`/`set*`/`remove*` for in-scope types.
- `customer` / `property` / `cleaner` / `team` / `service` / `job` one-queries remain nullable; `booking` remains non-null.
- **Default-sort column gate:** for every §4.2 collection, the chosen `defaultSort` fields exist on the entity, exist on the DTO, are sortable in 9.5.0, and appear as accepted `SortField`s (schema or a sort e2e). If a field is missing, the module task must have already switched pair (still unique tie-breaker) — Task 8 fails if any collection still points at a non-existent/unsortable field.
- Applicable option surfaces still OFFSET / 20 / 100 / `totalCount` (no cursor/10/50 drift).

```bash
pnpm --filter @clensy/client codegen
pnpm --filter api test
pnpm --filter api test:e2e
```

Manual (Phase 1 §7): `/app/bookings`, `/app/jobs` (create job from booking, checklist progress), `/app/customers` (nested properties), `/app/cleaners`, `/app/cleaners/teams`, `/app/catalog`, `/app/catalog/add-ons`. Confirm DataTable page controls where `totalCount` is selected. Confirm `/app/admin` list still works (unpaginated `admins`).

**Commit** `test: lock paginated collection schema allowlist`

**Traceability:** spec §4.1, §4.6, §6#1, §6#2, §6#6, §6#14.

## 10. Execution / operational risks (not redesign)

- **Nested `totalCount` O(N)** in 9.5.0 `batchCountRelations` is the highest-likelihood spec-return. Prove with the §6 procedure in Task 3 **before** migrating other nests.
- **Clamp-before-`PropertyMax`:** Task 2 mechanics gate. Isolated pipe tests are not enough. If generated-resolver pipes never see `paging.limit` in time, return the spec — do not set `maxResultsSize: -1`.
- **`customerProperties` connection factory** is Task 4 source inspection, not a locked API.
- **`migration:generate` noise** on existing FKs — trim as in #29.
- **DTO import cycles** (Property ↔ Booking, Team ↔ Cleaner) — lazy thunk, not module merge.
- **Jobs page compiles after Task 2** but picker remains wrong until Task 7 — do not treat Task 2 as fulfilling §4.5.
- If Task 3 cannot satisfy the `forFeature` gate or TypeORM inverse mapping, **return the spec**. Remaining same-module nests are not a substitute proof for `property.bookings`.

## 11. Out of scope (explicit)

Quality (#7), Operations Dashboard product (#8), Payments (#10), Admin GraphQL migration, paging REST / application `findAll`, cursor paging, aggregations, subscriptions, `customer.bookings` / `team.bookings` / `service.bookings`, root `properties` / `checklists`, catalog `pricings`, shared entity package, flattening DDD folders.

## 12. Self-check (planner)

| Check | Result |
| --- | --- |
| Every major spec contract has a task | Yes — §8 table |
| No new product semantics | Policy constants, clamp *candidate*, sort columns, `customerProperties` wrapper *requirements*, Jobs filter *mechanism ladder*, OffsetConnection (not Filterable) are M4 mechanisms for locked product rules — 9.5.0 factory APIs stay unproven until their task |
| Task order executable | Policy → Booking **integration proof** → **property.bookings gate** → other modules → allowlist |
| Deferred work named | §11 + `admins` + Quality/Dashboard/Payments |
| Missing design → would stop | Nested totalCount O(N); foreign `forFeature`; illegal dual mapping; clamp not applicable before `PropertyMax` without `-1` |
