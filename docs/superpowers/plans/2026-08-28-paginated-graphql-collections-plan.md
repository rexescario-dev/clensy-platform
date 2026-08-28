# Paginated nestjs-query GraphQL Collections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start M6 until M5 has Accepted this plan.**

**Goal:** Apply the fifth-draft platform collection contract — offset connections, default 20 / max 100, **clamp** via an authorized platform paging-normalization layer, **`totalCount` on root Query connections only**, deterministic sort, nested connections **without** `totalCount`, no alternate arrays — to the §4.2 inventory, with `property.bookings` as the first cross-module nest proof.

**Architecture:** Keep #29’s read stack (`ReadResolver` many + `Relatable` → owning-module QueryService → Clensy writes). nestjs-query 9.5.0 already ships on Booking; this plan changes paging and extends the same composition to the rest of the inventory. Nested many-relations are expected to use 9.5.0 Relatable/query-relation machinery through the owning-module QueryService, with inverse TypeORM relation metadata **preferred**. The exact mechanism is a Task 3 proof obligation; the parent module must not register the child QueryService merely to satisfy DI.

**Tech Stack:** NestJS, `@ptc-org/nestjs-query-{core,graphql,typeorm}` 9.5.0, TypeORM 1.1.x, GraphQL (code-first), `packages/client` codegen, Next.js `apps/web`.

**Spec:** [Paginated nestjs-query GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) — Status: **Accepted** (fifth draft, 2026-08-28). Where this plan and that specification disagree, the specification wins and this plan must be revised.

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-08-28 |
| **Tracking** | [#33](https://github.com/rexescario-dev/clensy-platform/issues/33) |
| **Package/repo scope** | `apps/api` (platform paging + every §4.2 collection), `packages/client` (operation documents + codegen), `apps/web` (list/detail pages that select those collections). **Not** Quality (#7), Dashboard product (#8), Payments (#10), Admin GraphQL (`admins`). |
| **Depends on (Accepted)** | [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) (**Accepted**, fifth draft). Relies on [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md) (**Accepted**, #29) as **amended** by this RFC; [nestjs-query GraphQL Reads plan](2026-08-28-nestjs-query-graphql-reads-plan.md) (**Accepted**) is the Booking **read-stack** reference — **do not** copy `PagingStrategies.NONE`. Also relies on already-Accepted Customers, Cleaners, Catalog, Bookings, Jobs, Admin Foundation, Dashboard UX Foundation, and Phase 1 §2.6 as amended by the collections spec. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 plan; **M5** owns Accept. |
| **Packaging** | Same tracking issue/PR as the collections spec ([#33](https://github.com/rexescario-dev/clensy-platform/issues/33)). Do **not** open a plan-only merge PR. Do **not** `Closes #33` until M6 ships. |
| **Revision note** | Fourth draft of this plan, then M5. Pre-M5 corrections kept: nested `filter`/`sorting` not mandatory; schema proof distinct from runtime/config proof of 20/100/OFFSET; `customerProperties` must use a verified 9.5.0 connection path. **Supersedes** the 2026-08-28 plan (that plan required nested `totalCount` and treated nested COUNT O(1) as a Task 3 hard gate). Aligns with Accepted fifth-draft spec: root `totalCount` only; nested connections omit `totalCount`; clamp via authorized platform layer; O(1) nested **nodes** is a hard invariant. |
| **M5 decision** | **Accepted** — 2026-08-29. No plan blockers. Prior review items closed (spec/plan Status not confused; nested filter/sorting not over-specified; SDL vs runtime/config proof split; `customerProperties` 9.5.0 connection hard gate). Ready for M6 Implementation (Task 1 first; Task 2 clamp gate; Task 3 nested hard gate). This Accept supersedes the 2026-08-28 Accept of the second-draft plan. |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

**Issue-branch note (informative, not a skip):** the #33 branch may already contain Task 1–2 files (`platform/graphql/paging.ts`, `ClampPagingLimitPipe`, `applyPlatformPipes`, Booking OFFSET). M6 still executes each task’s **tests**. If they already pass and match this plan (root `totalCount` on, nested not yet present, clamp-before-`PropertyMax`), do not redo product work; proceed to Task 3. Do **not** treat that branch as fulfilling Task 3–8.

## 1. Delivery intent

Implement the fifth-draft spec’s migration inventory (§4.2): every listed GraphQL collection becomes a nestjs-query **offset connection** with platform paging (20 / 100, clamp). **Root Query** connections expose `totalCount`. **Nested** connections expose `nodes` + `pageInfo` only. Deterministic default sort (unique tie-breaker). Break Booking’s many-query. Add nested `property.bookings`. Replace Jobs full-list joins with bounded server reads. Update `packages/client` and in-scope `/app/*` list screens. Do **not** page REST or application `findAll` / `list*` methods. Do **not** migrate `admins`. Do **not** emit nestjs-query `one` onto modules whose get-by-id is still nullable. Do **not** expose nested `totalCount`. Do **not** treat a 9.5.0 reject of oversized `limit` as clamp.

## 2. Constraints (SHALL / SHALL NOT)

Traced only to the fifth-draft spec. Every task inherits this section.

**SHALL:**

- Expose every §4.2 field as an offset connection (`nodes`, `pageInfo`). No `[Entity!]!` for those fields. No alternate unpaginated array for the same collection (spec §4.1, §6#1).
- **Root Query** connections SHALL expose `totalCount`. **Nested** collection connections SHALL NOT. Enable root `totalCount` via the applicable 9.5.0 option (`enableTotalCount` on `@QueryOptions` / `ReadResolver` many). Nested `@OffsetConnection` / Relatable many-opts SHALL NOT enable `totalCount`. No custom nested count field (spec §4.1, §6#9).
- Default limit **20**, max **100**, from **one** platform source. `limit > 100` **clamps** to 100 (operation succeeds, no GraphQL error). Never `maxResultsSize: -1`. If 9.5.0 would reject oversized `limit`, use the authorized **platform paging-normalization layer** to rewrite `paging.limit` to 100 **before** 9.5.0 validates. Do **not** substitute reject for clamp (spec §4.1, §6#3).
- Deterministic default sort with a unique tie-breaker (normally `id`) on every paginated collection (spec §4.1, §6#4).
- Nested connection **nodes** SQL/query count **O(1) in parent N**; no per-parent child SELECT. Nested `totalCount` is not in the contract and SHALL NOT ship, including an O(N) nested COUNT (spec §4.3, §6#9).
- Owning-module-only `forFeature` / QueryService. Parent MUST NOT `forFeature` the child entity solely for DI. Importing a module that **already exported** the child’s QueryService is allowed; re-registering it is not (spec §4.3, §6#7).
- Inverse TypeORM collection metadata is **preferred** for the §4.3 table. Persistence only: not on domain objects, not used by application writes (spec §4.3, §6#8).
- Keep Clensy nullable get-by-id (`customer`, `property`, `cleaner`, `team`, `service`, `job`). Booking’s `booking(id): Booking!` stays as #29 shipped it. If `ReadResolver` would emit a colliding `one`, disable/do not register it (spec §4.1, §6#12).
- `customerProperties` keeps its name and required customer scope, **server-enforced**, and SHALL expose `totalCount` (it is a root Query field). Nested `customer.properties` SHALL NOT. No unscoped `properties` root (spec §4.2, §6#13).
- Jobs existence checks are server-side and bounded. Relation-existence filter is preferred, not guaranteed; uniqueness `ConflictException` remains the fallback. Do not invent `jobByBookingId` unless the connection/filter model cannot express existence (spec §4.5, §6#10).
- Writes stay Clensy mutations. Schema allowlist: no generated CRUD/relation mutations, aggregations, or subscriptions (spec §4.1, §6#6).
- Keep application `findOne` / `findAll` / `getXByIds` / `listCustomerProperties` / `listTeamCleaners` / `listJobs`. Removing one because GraphQL uses QueryService is a spec-return (spec §4.4).
- Update client documents and in-scope web pages in the same delivery as each schema break (spec §4.5, §6#5). Nested client selections SHALL NOT select `totalCount`.

**SHALL NOT:**

- Copy Booking’s shipped `PagingStrategies.NONE` / `[Booking!]!`.
- Copy Booking’s `ReadResolver` `one` onto nullable get-by-id modules.
- Enable `enableTotalCount` on nested `@OffsetConnection` to keep a shared GraphQL `*Connection` type. If 9.5.0 cannot omit nested `totalCount` without stripping it from the **root** connection of the same entity, **return the spec** (spec §4.1, §9).
- Accept O(N) nested node SELECTs, drop nested connections, or replace Relatable with Clensy `@ResolveField` arrays / a custom DataLoader outside QueryService (spec §4.3).
- Register foreign entities/QueryServices on a parent module merely to satisfy Relatable DI. If 9.5.0 **fundamentally requires** that, **return the spec** — do not “make DI work” (spec §4.3).
- Use TypeORM `lazy: true` / `eager: true` on these collections.
- Add `customer.bookings` / `team.bookings` / `service.bookings`, a `pricings` collection, root `properties`, root `checklists`, or migrate `admins`.
- Page REST. Start Quality, Dashboard product, or Payments.
- Flatten DDD folders or put inverse collections on domain objects.

## 3. Implementation decisions (M4 choices)

These are **planning decisions**, not new product semantics. If a proof contradicts a **spec** constraint, stop and return to M2/M3.

### 3.1 9.5.0 facts already verified in this planning pass

Inspected against installed/published **9.5.0** source and prior #33 measurement (not assumed from memory):

| Topic | 9.5.0 fact | Plan consequence |
| --- | --- | --- |
| Platform defaults | `NestjsQueryGraphQLModule.forRoot` only accepts `dataLoader`. Paging option *names* (`defaultResultSize`, `maxResultsSize`, `pagingStrategy`, `defaultSort`, `enableTotalCount`) appear on `@QueryOptions` / `ReadResolver` / `QueryArgsType`. Library defaults are **cursor**, `defaultResultSize: 10`, `maxResultsSize: 50`. | One **policy** (20 / 100 / OFFSET). Root surfaces enable `totalCount`; nested surfaces do **not**. Per-surface adapters — do not assume one TypeScript object is valid on every decorator. Do not expect `forRoot` to set 20/100. |
| Clamp vs validate | `PropertyMax` **rejects** `limit > max` (class-validator). It does **not** clamp. | Spec requires clamp and **authorizes** a platform paging-normalization layer. Task 1 unit-tests the rewrite. **Task 2** must prove, on a generated GraphQL resolver, that `limit: 1000` is rewritten to `100` **before** `PropertyMax` (≤100 nodes, no validation error). Keep `maxResultsSize: 100` as a bound. Never `-1`. ReadResolver `pipes:` is **too late** (global ValidationPipe already ran). Register the layer **ahead of** that ValidationPipe (global pipe order, interceptor, or equivalent). If even that cannot rewrite before 9.5.0 validates, **return the spec** — do not disable the max, do not change the product to reject. |
| Disable `one` | `ResolverQuery` skips registration when `opts.one.disabled === true`. | Modules with Clensy nullable get-by-id: `ReadResolver(..., { one: { disabled: true }, many: { name } })`. Booking keeps `one: { name: 'booking' }`. |
| Nested many | `ReadManyRelationMixin` / `QueryRelationsLoader` call **`this.service.queryRelations`** (the **parent** QueryService), batched by identical query JSON. | Preferred inverse `@OneToMany` on the parent entity is sufficient for Relatable **nodes**. Parent does **not** need the child’s QueryService if TypeORM relation metadata exists on the parent entity. |
| Nested count | `batchCountRelations` maps `getCount()` **per parent**. | Nested `totalCount` is **O(N)** in 9.5.0. The spec **forbids** nested `totalCount`. Task 3 proves the nested field has **no** `totalCount` and that **root** `BookingConnection.totalCount` remains. Do **not** enable nested `totalCount` and then return the spec for O(N) COUNT — that was the superseded plan. |
| Nested type name | 9.5.0 often emits `${parentDtoName}${relationBaseName}Connection` (e.g. `PropertyBookingConnection`) rather than reusing root `BookingConnection`. | Task 3 **depends** on a distinct nested type (or equivalent field-set split) so nested can omit `totalCount` while root keeps it. If the types are shared and `totalCount` cannot be split, **return the spec**. |
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

Do **not** ship one helper object that is spread into `@QueryOptions`, `ReadResolver`, and `@OffsetConnection` until Task 2 / Task 3 prove those surfaces accept the same shape. Adapters (small functions or inline option bags) supply the **applicable** 9.5.0 option names per surface. Duplication across surfaces is **required** because 9.5.0 has multiple option sites; tests MUST fail if any surface falls back to cursor / 10 / 50, if a **root** surface disables `totalCount`, or if a **nested** surface enables `totalCount` (Task 2 for root, Task 3 for nested, Task 8 sweep).

**Platform paging-normalization layer (authorized by spec §4.1):** a clamp transform (e.g. `ClampPagingLimitPipe`) that rewrites `paging.limit > 100` to `100`. **Task 1** unit-tests it in isolation (1000 → 100; 20 unchanged; omitted paging does not invent a limit). **Task 2** registers it so it runs **before** 9.5.0 `PropertyMax` / global `ValidationPipe` on generated resolvers (root and, once nests exist, nested paging args). Intended placement: a shared helper used from `main.ts` and every GraphQL/REST e2e that previously constructed `ValidationPipe` itself, with the clamp pipe **first**. That placement is an M4 mechanism, not a product contract. Do not register the clamp **only** on `ReadResolver` `pipes:` — that is too late.

Sort fields MUST be exposed as sortable in 9.5.0 (typically `@FilterableField`). Task 8 verifies every `defaultSort.field`: entity column exists → DTO field exists → sortable metadata exists → nestjs-query accepts it as a `SortField`. If a collection lacks the intended column, pick another deterministic pair **with a unique tie-breaker** rather than inventing a column.

### 3.3 Repeatable GraphQL composition

Copy Booking’s **read-stack**, not its paging. Shape to realize (exact decorator/option bags are proven per task against 9.5.0):

- `Relatable(DTO, { enableAggregate: false, … })` wrapping `ReadResolver(DTO, { guards, decorators, one, many, … })`
- Nullable get-by-id modules: `one: { disabled: true }`. Booking keeps `one: { name: 'booking' }`.
- Platform policy values on **every applicable 9.5.0 surface** for that DTO (DTO `@QueryOptions`, `ReadResolver` opts, nested `@OffsetConnection` / Relatable many-opts). **Root** many: OFFSET / 20 / 100 / `enableTotalCount: true`. **Nested** `@OffsetConnection`: OFFSET / 20 / 100 / **do not** enable `totalCount`. Do not assume one spread object; do not leave a surface on library cursor/10/50.
- Clamp layer from Task 2, once proven, applied uniformly (global registration covers nested paging args).

Keep the Clensy `*Resolver` for **mutations + nullable get-by-id**. Delete the Clensy **list** method and any `@ResolveField` that Relatable now owns. Do **not** use `CRUDResolver` or `resolvers: [{ DTOClass, EntityClass }]`. Register `dtos: [{ DTOClass }]` + `NestjsQueryTypeOrmModule.forFeature([OwningEntity])` + keep existing `TypeOrmModule.forFeature` for application repositories.

Many-to-one / one-to-one GraphQL fields that are **not** collections (`cleaner.team`, `job.booking`, `job.team`, `job.checklist`, `service.activePricing`, Booking’s four relations) stay objects. Do not turn them into connections.

### 3.4 Nested connections

Inventory nests use **`@OffsetConnection`**, not `@FilterableOffsetConnection`, unless a later task **proves** it needs relation filtering. Relation **filtering** is not implied by a nested connection (spec §4.1). Nested product contract is **paging** + `nodes` + `pageInfo` (and no `totalCount`). Nested `filter`/`sorting` arguments are **not** required unless the selected 9.5.0 connection mechanism naturally exposes them **and** an inventory task needs them (Task 7 existence is a **root** `jobs` filter, not a nested-connection requirement).

Nested option bag (illustrative — Task 3 proves which 9.5.0 keys this decorator actually accepts):

```ts
@OffsetConnection('bookings', () => BookingDTO, {
  nullable: false,
  enableTotalCount: false, // or omit; MUST NOT be true
  // platform 20/100/OFFSET/defaultSort via the keys this decorator supports
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
  update: { enabled: false },
  remove: { enabled: false },
})
```

Do not spread a root-query options object here until Task 3 confirms compatibility (root bags enable `totalCount`; nested bags must not).

Preferred persistence (subject to Task 3 proof):

```ts
// PropertyEntity — GraphQL inverse of BookingEntity.property
@OneToMany(() => BookingEntity, (booking) => booking.property)
bookings!: BookingEntity[];
```

`eager: false`. No cascade. No domain-object collection. Application/commands/REST MUST NOT read or assign `.bookings`.

**Cross-module cycle:** `BookingDTO` already imports `PropertyType`. `PropertyDTO` will reference `BookingDTO`. Break the TypeScript cycle with a lazy thunk on **one** side (`() => require('...').BookingDTO` or equivalent). Do not merge modules to dodge the import.

**Hard gate (Task 3):** prove nested `property.bookings` across module boundaries that satisfies **all** of: offset connection **without** nested `totalCount`; **root** `bookings` / `BookingConnection` still has `totalCount`; O(1) nested **nodes** in parent N; owning-module-only `forFeature`.

**O(1) proof path:** parents that Relatable receives **as a list in one load**. Use the still-unpaginated `customer.properties` array (Task 4 has not converted it yet):

```graphql
query ($id: ID!) {
  customer(id: $id) {
    properties {
      bookings { nodes { id } pageInfo { hasNextPage } }
    }
  }
}
```

Seed one customer with N properties (N=6 and N=12), each with ≥1 booking. That is the spec’s “number of parent nodes,” not N independent aliased `property(id:)` roots. Aliased `p1: property(id:) … pN: property(id:)` in one document is a **known GraphQL/DataLoader timing artifact** and MUST NOT be the O(1) pass/fail harness (it can fail to batch even when list-parent Relatable is O(1)).

CustomersModule MUST NOT `NestjsQueryTypeOrmModule.forFeature([BookingEntity])` (or `TypeOrmModule.forFeature` of Booking). If Relatable fails because a Booking **QueryService token** is missing:

1. Confirm it is not missing DTO metadata or TypeORM relation metadata.
2. Try **importing** `BookingsModule` **if and only if** Bookings already **exports** the existing Booking QueryService (re-export `NestjsQueryTypeOrmModule.forFeature([BookingEntity])`). That is allowed. Do **not** import BookingsModule if that creates a module cycle (Bookings already imports Customers) — then Relatable must work without the import.
3. If the parent must **own/register** Booking’s QueryService, **stop and return the spec**.

If TypeORM 1.1.x rejects `BookingEntity` `@ManyToOne` plus `PropertyEntity` `@OneToMany` on the same FK (dual mapping), **return the spec**. Do not invent a third persistence model. Do not switch to `RelationQueryService` virtual relations as a silent substitute for the preferred inverse.

If preferred inverse + Relatable cannot meet O(1) **nodes** and `forFeature`, M4 MAY try another **permitted** 9.5.0 Relatable/QueryService mechanism (spec §4.3). If **no** permitted mechanism works, **return the spec**. Do not accept O(N). Do not add Clensy `@ResolveField` arrays.

### 3.5 `customerProperties`

9.5.0 `ReadResolver` many is not assumed to accept an extra required `customerId` argument. Keep a **Clensy** query named `customerProperties` with required `customerId: ID!`.

Implement it with a **verified 9.5.0-supported connection construction path** (Task 4 inspects installed source). The implementation MUST preserve the same **root** Property connection semantics (`nodes`, `pageInfo`, **`totalCount`**, paging; filter/sorting if that 9.5.0 path exposes them on root connections). **Hard gate:** do **not** invent a custom GraphQL connection type, resolver, or paging model that bypasses nestjs-query’s established QueryService/connection path. If server-side customer scope cannot be imposed without that bypass, **return the spec**.

Concretely:

- keep a **Clensy** query named `customerProperties` with required `customerId: ID!`;
- enforce `customerId = argument` **authoritatively** regardless of any client-supplied `customerId` predicate; filters on **other** allowlisted fields remain applicable if the connection path exposes `filter`;
- reject a blank `customerId`;
- never expose unscoped `Query.properties`.

Do **not** assume `createFromPromise`, `mergeQuery`, a particular `QueryArgs` class, or `QueryService.count` until verified against installed 9.5.0. Disable Property `ReadResolver` many so `Query.properties` never appears. Relatable on Property still runs for `property.bookings`. `customerId` on the Property DTO MUST be filterable if the forced scope is expressed as a QueryService filter.

Nested `Customer.properties` MUST be a Property offset connection **without** `totalCount`. If 9.5.0 would share one `PropertyConnection` type and force `totalCount` onto the nest (or strip it from `customerProperties`), **return the spec** — do not enable nested `totalCount` to keep a shared type.

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

Every in-scope **root** operation document selects `nodes` (and `pageInfo` / `totalCount` where the UI pages). Nested selections select `nodes` + `pageInfo` as needed — **never** nested `totalCount`. Form pickers that need “all options” request `paging: { limit: 100 }` (covers Phase 1 volumes; do not assume an unpaginated array).

`DataTable` already accepts optional `pagination: { page, pageSize, totalCount, onPageChange }` (`packages/ui`). Wire **root** list screens to `totalCount` + offset. Nested lists use `hasNextPage` / further offset (or `limit` that covers the set). This is a data-contract change, not a visual redesign.

Pages that consume collections: `/app/bookings`, `/app/jobs`, `/app/customers`, `/app/cleaners`, `/app/cleaners/teams`, `/app/catalog`, `/app/catalog/add-ons`. Update each in the task that breaks that schema. `admins` documents stay arrays.

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/platform/graphql/paging.ts` (+ clamp transform + registration-before-ValidationPipe + tests) | `GraphqlModule.forRoot` Apollo/context; Auth; audit |
| Booking DTO/read-resolver paging + client/web bookings (+ jobs page’s `useBookingsQuery`) | Booking writes, REST, `BookingsService.find*` |
| Customers/Properties entities (preferred inverses), DTOs, read resolvers, `customerProperties` wrapper | Customers/Properties commands, `listCustomerProperties` **method existence** |
| Cleaners/Teams entities (preferred inverses), DTOs, read resolvers | Cleaners writes; `listTeamCleaners` existence |
| Catalog Service/AddOn DTOs + read resolvers | `activePricing` singleton, PricingRule create, no `pricings` query |
| Jobs/Checklist/Item DTOs + read resolvers + targeted existence UX | Job writes, uniqueness, `listJobs` existence |
| `packages/client` operation documents + codegen | Admin operations |
| In-scope `apps/web` list/detail data adapters | Dashboard product (#8), Quality, Payments |

## 5. Contract inventory (only what the fifth-draft spec authorizes)

Type names are illustrative. Product rule is the field set.

| Field | Kind | After this plan |
| --- | --- | --- |
| `customers` | root | `CustomerConnection!` **with** `totalCount` |
| `customer.properties` | nested | Property offset connection **without** `totalCount` |
| `customerProperties(customerId: ID!)` | root | Property connection **with** `totalCount`, server-scoped |
| `property.bookings` | nested | Booking offset connection **without** `totalCount` (new; type name MAY be `PropertyBookingConnection`) |
| `cleaners` / `teams` | root | connections **with** `totalCount` |
| `team.cleaners` | nested | Cleaner offset connection **without** `totalCount` |
| `services` / `addOns` | root | connections **with** `totalCount` |
| `jobs` | root | `CleaningJobConnection!` **with** `totalCount` |
| `checklist.items` | nested | ChecklistItem offset connection **without** `totalCount` |
| `bookings` | root | `BookingConnection!` **with** `totalCount` (break NONE) |
| `customer` / `property` / `cleaner` / `team` / `service` / `job` | one | unchanged nullable Clensy one |
| `booking(id)` | one | unchanged `Booking!` |
| `admins` | — | unchanged `[Admin!]!` |

## 6. Slice sequence

```text
1. Platform paging policy + isolated clamp transform   (does not prove 9.5.0 integration)
2. Booking OFFSET — 9.5.0 integration proof
     ├─ OFFSET connection, default 20, max 100
     ├─ clamp-before-PropertyMax (platform layer; mechanics gate)
     ├─ totalCount on ROOT bookings only
     ├─ deterministic sort
     └─ runtime/config proof of OFFSET / 20 / 100 (not GraphQL introspection)
3. property.bookings HARD GATE
     ├─ inverse metadata (preferred)
     ├─ parent QueryService / QueryRelationsLoader (or proven permitted equivalent)
     ├─ no foreign forFeature
     ├─ nested connection HAS NO totalCount
     ├─ root BookingConnection STILL HAS totalCount
     ├─ O(1) nested nodes (list-parent harness, not aliases)
     └─ nested clamp reuses Task 2 layer
     STOP if gate fails — return spec
4. Remaining Customers collections              (customers, customer.properties without totalCount, customerProperties with totalCount + nested O(1) nodes via customers.nodes)
5. Cleaners / Teams
6. Catalog
7. Jobs / checklist.items + existence UX (mechanisms to prove)
8. Allowlist sweep, codegen, e2e, web golden paths
```

Task 3 is a **hard prerequisite** for Tasks 4–7 nested work. Task 1 does **not** prove clamp-inside-9.5.0. Task 2 may ship before Task 3 (root paging does not need inverses). If Task 3 returns the spec, do not “finish the inventory” with Clensy `@ResolveField` arrays.

### Nested SQL O(1) measurement (Tasks 3, 4, 5, 7) — **nodes only**

Reuse `apps/api/test/helpers/capture-sql.ts`. For a **single** GraphQL operation that resolves **N parent objects** each requesting the nested connection **nodes** (and `pageInfo` as needed — **do not** select nested `totalCount`):

1. Capture **all** SQL during that operation.
2. Exclude known unrelated setup (migrations, seed, auth lookups) by running the operation twice or subtracting a baseline captured before the GraphQL call — the comparison is **within the GraphQL execution**.
3. Assert `queryCount(N=12) === queryCount(N=6)` **or** the two counts differ by a **fixed known constant independent of N** (e.g. one extra unrelated statement that does not scale).
4. Inspect the captured SQL (normalized: strip parameters/literals; keep verb + primary tables). Fail if the template set shows **one child SELECT per parent** (N copies of the same child query with different parent ids). Matching only the substring `booking_entity` is **not** sufficient.

Do **not** add a nested-`totalCount` measurement as a pass condition. Nested `totalCount` MUST be absent from the schema; selecting it is a GraphQL error.

## 7. TDD / verification strategy

**Schema proof (SDL / factory tests)** can show: connection types; `nodes`; `pageInfo`; root `totalCount` / nested absence of `totalCount`; arguments that exist (`paging`; `filter`/`sorting` on **root** collections per spec §4.1); absence of `edges`/`cursor` as the collection strategy; no denylisted CRUD; get-by-id nullability; `admins` still `[Admin!]!`. GraphQL introspection **cannot** prove nestjs-query `defaultResultSize`, `maxResultsSize`, or `pagingStrategy`. Do not write tests that try to read 20/100/OFFSET from SDL.

**Runtime / configuration proof** shows: omitted paging → 20 nodes; oversized `limit` → clamp 100 with no validation error; offset pages; default sort; 9.5.0 option bags / installed-source inspection (`pagingStrategy: OFFSET`, `defaultResultSize: 20`, `maxResultsSize: 100`, root `enableTotalCount: true`, nested `enableTotalCount` not true).

1. **Pipe unit tests (Task 1 only)** — clamp 1000→100 in isolation; 20 unchanged; missing paging unchanged. **Not** a 9.5.0 integration proof.
2. **Schema factory tests** (existing `*.resolver.spec.ts` pattern) — schema proof only (above). Nested fields: `paging` + `nodes`/`pageInfo`; nested `filter`/`sorting` only if the mechanism exposes them.
3. **E2E mechanics (Task 2)** — runtime proof: omitted paging → 20 nodes; `limit: 1000` → **≤100 nodes and no GraphQL/validation error** (clamp-before-`PropertyMax` gate); default sort stable across two offset pages with identical timestamps; selecting root `totalCount` vs omitting it (root COUNT only when selected if 9.5.0 supports that; if the library always counts, document as residual — still O(1) for root). Config proof: inspect Booking option bags / 9.5.0 source, not introspection.
4. **E2E nested O(1) nodes** — procedure in §6 (list parents; not table-name substring matching; not aliased independent roots).
5. **`customerProperties` (Task 4)** — server-owned `customerId` cannot be overridden; **root** `totalCount` works; paging applied; blank `customerId` rejected; construction path is a verified 9.5.0 connection mechanism.
6. **Application/REST tests** — still pass; do not delete `findAll` / `list*` tests.
7. **Client** — `pnpm --filter @clensy/client codegen` succeeds; generated types use `*Connection`; nested generated types do not require `totalCount`.
8. **Web** — golden paths on the pages in §3.8 (Phase 1 Design §7 — no browser suite). DataTable pagination on **root** lists uses `totalCount`. Nested UI uses `hasNextPage` / offset.

## 8. Traceability (spec → task)

| Spec contract | Task |
| --- | --- |
| One platform 20/100 source; clamp via authorized layer; not unlimited; not reject | 1 (policy), **2 (9.5.0 clamp gate)**, 8 |
| Booking `BookingConnection!` **with** `totalCount`; client + `/app/bookings` | 2 |
| Nested O(1) **nodes**; no nested `totalCount`; inverse preferred; `forFeature` gate; `property.bookings` proof; shared-type split | 3 |
| Dual ManyToOne + OneToMany on TypeORM 1.1.x | 3 |
| `customers`, `customer.properties` (no nested `totalCount`), server-scoped `customerProperties` (**with** `totalCount`) | 4 |
| `cleaners`, `teams`, `team.cleaners` | 5 |
| `services`, `addOns`; no `pricings` | 6 |
| `jobs`, `checklist.items`; Jobs targeted reads | 7 |
| Disable colliding `ReadResolver` `one` | 4–7 |
| Root `totalCount` only; nested omit | 2, 3, 8 |
| Default-sort fields exist and are sortable | 8 (and per-module as each DTO is added) |
| No alternate arrays; allowlist; `admins` untouched | 8 |
| Keep application list methods / writes / REST | all (negative: do not delete) |
| Quality / Dashboard / Payments | no task |

## 9. Task breakdown

### Task 1 — Platform paging policy + isolated clamp transform

**Files:**
- Create: `apps/api/src/platform/graphql/paging.ts` (constants `PLATFORM_PAGE_DEFAULT` / `PLATFORM_PAGE_MAX`; sort-table comments or exports — **not** a claimed-universal options object)
- Create: clamp transform (e.g. `clamp-paging-limit.pipe.ts`) as the **platform paging-normalization layer**
- Create: `apps/api/src/platform/graphql/tests/clamp-paging-limit.pipe.spec.ts`
- Create: `apps/api/src/platform/graphql/tests/paging.spec.ts`

**Steps:**

- [ ] **Write failing tests** for the clamp transform in isolation: `{ paging: { limit: 1000, offset: 0 } }` becomes `limit: 100`; `{ paging: { limit: 20, offset: 40 } }` unchanged; `{}` / `{ paging: { offset: 0 } }` does not invent a limit. For policy constants: `PLATFORM_PAGE_DEFAULT === 20`, `PLATFORM_PAGE_MAX === 100`.

- [ ] **Implement** the constants and isolated transform. Do **not** treat wiring onto the GraphQL request pipeline as done. Task 2 owns 9.5.0 integration (layer **before** `PropertyMax`).

- [ ] **Run** `pnpm --filter api test -- clamp-paging-limit.pipe.spec.ts paging.spec.ts` — pass.

- [ ] **Commit** `test: add platform paging policy constants and isolated clamp transform`

**Traceability:** spec §4.1, §6#3, §9 (forRoot vs shared constant; platform layer).

---

### Task 2 — Booking many-query becomes `BookingConnection!`

**Files:**
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts`
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking-read.resolver.ts`
- Modify: `apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts`
- Modify: `apps/api/test/bookings.e2e-spec.ts`
- Modify: `apps/api/src/main.ts` and GraphQL/REST e2e suites that construct `ValidationPipe` — register the clamp layer **before** that pipe (shared helper, e.g. `apply-platform-pipes.ts`)
- Modify: `packages/client/src/operations/bookings.graphql`
- Modify: `apps/web/app/app/bookings/page.tsx`
- Modify: `apps/web/app/app/jobs/page.tsx` (it calls `useBookingsQuery` / `useJobsQuery` — update **bookings** consumption here so the app still compiles; full Jobs existence rewrite is Task 7)
- Codegen: `packages/client/src/generated/graphql.ts`

**DTO / resolver change:**

Remove `@QueryOptions({ pagingStrategy: PagingStrategies.NONE })`. Apply platform **policy values** through the 9.5.0 option keys each **root** surface actually accepts: OFFSET, default 20, max 100, **`enableTotalCount: true`**. Keep `one: { name: 'booking' }` **enabled**. Keep the four `@FilterableRelation`s.

Wire the platform paging-normalization layer so it mutates `paging.limit` **before** 9.5.0 `PropertyMax`. Do **not** rely on `ReadResolver` method `pipes:` as the only registration — it runs too late. If the layer cannot rewrite before validation, **return the spec**. Do not set `maxResultsSize: -1`. Do not change the product to reject.

**Failing tests first:**

**Schema proof:** `Query.bookings` return type is non-null `BookingConnection`; args include `paging` and, per spec §4.1 for **root** collections, `filter` and `sorting`; `BookingConnection` has `nodes`, `pageInfo`, `totalCount`; `Query.booking` remains non-null `Booking`; denylisted mutations still absent; **not** cursor paging in SDL (no `edges`/`cursor` as the collection strategy). Do **not** assert default 20, max 100, or OFFSET from introspection.

**Runtime / config proof (required — not merely a regression):** execute the generated `bookings` resolver with `paging: { limit: 1000 }`. Success is **≤100 nodes (or all remaining if fewer than 100) and no GraphQL/class-validator error**. That proves `limit` was transformed to ≤100 **before** 9.5.0 `PropertyMax`. Unit-testing the pipe alone is insufficient. If the request errors with a max-allowed-value message, the integration is unproven — do not ship.

Also:

- Seed ≥ 21 bookings: omitted `paging` returns **20** nodes; `totalCount` ≥ 21.
- Two bookings with identical `scheduledAt`: order by `id ASC` is stable on `offset: 0` and `offset: 1`.
- Existing four-relation O(1) SQL proof still holds on `bookings { nodes { customer { id } … } }` (use §6 measurement, N=6 vs N=12).
- **Config inspection** (decorator option bags and/or installed 9.5.0 source, **not** GraphQL introspection): Booking root surfaces use OFFSET, `defaultResultSize: 20`, `maxResultsSize: 100`, `enableTotalCount: true`. Fail if source still sets cursor, default 10, max 50, `-1`, or `enableTotalCount: false` on a root surface.

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

**Traceability:** spec §4.1, §4.5, §4.7, §6#3, §6#5.

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
- Composition-root tests: if `TypeOrmQueryService` construction requires `repo.manager.connection.driver`, override `getQueryServiceToken(PropertyEntity)` in the existing customers composition-root spec rather than `forFeature(BookingEntity)`

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

1. **Schema proof:** `Property.bookings` is a non-null offset connection with the required **paging** argument and `nodes` / `pageInfo`. Nested `filter`/`sorting` are only required if the selected 9.5.0 `@OffsetConnection` mechanism naturally exposes them. The nested GraphQL type **MUST NOT** declare `totalCount`. `Query.bookings` / `BookingConnection` **MUST STILL** declare `totalCount`. `Query.property` still nullable; **no** `Query.properties`; **no** `allBookings`. Do **not** assert nested default 20 / max 100 / OFFSET from introspection.
2. Selecting `property { bookings { totalCount } }` is a GraphQL error (unknown field). Selecting `bookings { totalCount }` on the **root** query still works.
3. Module grep: `customers.module.ts` does not mention `BookingEntity` in any `forFeature` array. Strip `//` comments before grepping (`MUST NOT forFeature BookingEntity` in a comment is not a registration, but a naive grep can false-fail).
4. **Nested nodes harness (list parents):** one GraphQL operation as in §3.4 (`customer { properties { bookings { nodes } } }`). Seed N=6 and N=12 properties on **one** customer. Measure with the **§6 nested SQL O(1) procedure** (**nodes only**). Do **not** pass by counting only statements whose text includes `booking_entity`. Do **not** use N aliased `property(id:)` fields as the pass/fail harness.
5. **Runtime:** nested clamp — `bookings(paging: { limit: 1000 })` on one parent returns ≤100 nodes and **no** validation error (reuse Task 2 layer). Omitted nested paging returns ≤20 nodes.
6. **Config inspection** (nested `@OffsetConnection` option bag / 9.5.0 source, **not** introspection): do not enable nested `totalCount`; do not leave the nest on library cursor/10/50/`-1`.
7. Application unit tests still pass (they never touch `.bookings`).

**Hard stops (any → return spec, do not start Tasks 4–7 nests):**

- TypeORM dual mapping illegal.
- Parent must `forFeature` Booking (or otherwise own Booking’s QueryService).
- Nested **nodes** O(N) on the list-parent harness; no other **permitted** Relatable/QueryService mechanism meets O(1) + `forFeature`.
- Nested connection type includes `totalCount` **and** omitting it would strip `totalCount` from root `BookingConnection` (shared type). Do **not** enable nested `totalCount` to keep the shared type.
- Clensy `@ResolveField` array / custom DataLoader outside QueryService as a workaround.

**Commit** `feat: add nested property.bookings connection`

**Traceability:** spec §4.1 (type split), §4.2, §4.3, §6#7, §6#9, §6#11, §9.

---

### Task 4 — Customers collections (`customers`, `customer.properties`, `customerProperties`)

**Files:**
- Modify: `customer.entity.ts` — preferred `@OneToMany(() => PropertyEntity, (p) => p.customer) properties`
- Modify: `property.entity.ts` — dual `@Column customerId` + `@ManyToOne(() => CustomerEntity)` (Booking pattern). Application keeps writing `customerId` scalars.
- Migration: trim FK noise; keep existing customer FK name/ON DELETE
- Create: `customer.dto.ts` / convert `CustomerType`; `@OffsetConnection('properties', () => PropertyDTO, { enableTotalCount: false, … })`
- Create: `customer-read.resolver.ts` — `many: { name: 'customers' }`, `one: { disabled: true }`, **root** `enableTotalCount: true`
- Modify: `customer.resolver.ts` — delete `customers()` list and `properties` `@ResolveField`
- Modify: `property.resolver.ts` — replace array `customerProperties` with a Clensy query that meets §3.5 (**with** `totalCount`); keep `property(id)` nullable. Inspect installed 9.5.0 for a **supported connection construction path**. Do not copy an assumed `createFromPromise` / `mergeQuery` snippet. Do not invent a custom connection abstraction that bypasses QueryService.
- Modify: `customers.module.ts` — `forFeature` CustomerEntity + PropertyEntity only
- Tests: `customer.resolver.spec.ts`, `property.resolver.spec.ts`, `customers-properties.e2e-spec.ts`
- Client: `customers.graphql`, `properties.graphql`
- Web: `apps/web/app/app/customers/page.tsx`

**Failing tests:**

- **Schema:** `Query.customers` is `CustomerConnection!` **with** `totalCount` and `paging`; `Customer.properties` is a Property offset connection with **paging** + `nodes`/`pageInfo` **without** `totalCount` (nested `filter`/`sorting` only if the 9.5.0 nest exposes them); `Query.customer` nullable; `Query.customerProperties(customerId: ID!)` is a Property connection **with** `totalCount` and paging; **no** `Query.properties`.
- If 9.5.0 shares one `PropertyConnection` and cannot split `totalCount` between `customerProperties` and `customer.properties`, **return the spec**.
- **`customerProperties` 9.5.0 proof:** inspect installed connection-construction API; confirm it is a **supported** nestjs-query QueryService/connection path (not a hand-rolled connection type). If scope cannot be imposed on that path, **return the spec**. Then e2e:
  - `customerId: A` plus client `filter.customerId.eq: B` (only if `filter` exists on that field) returns **only A’s** properties (never B’s, never all) — argument is authoritative;
  - omitted paging returns ≤ 20; `paging.limit: 2` returns ≤ 2; `totalCount` equals A’s property count;
  - blank `customerId` is rejected (GraphQL error, not an unscoped list).
- Nested O(1) **nodes** through the **root collection** (second proof after Task 3 list-parent via unpaginated `customer.properties`):

```graphql
query {
  customers(paging: { limit: 20 }) {
    nodes {
      properties(paging: { limit: 20 }) { nodes { id } pageInfo { hasNextPage } }
    }
  }
}
```

Use §6 measurement at N=6 vs N=12 customers. Do **not** select nested `totalCount`.
- `listCustomerProperties` application tests still exist and pass.

**Client** documents: root lists select `nodes` + `totalCount` as needed; nested `properties` select `nodes` / `pageInfo` only. Customer detail pages `properties` until exhausted or `limit: 100`.

**Commit** `feat: paginate customer and property GraphQL collections`

**Traceability:** spec §4.2, §6#13.

---

### Task 5 — Cleaners and Teams

**Files:**
- `team.entity.ts` — `@OneToMany(() => CleanerEntity, (c) => c.team) cleaners`
- `cleaner.entity.ts` — dual `teamId` + `@ManyToOne(() => TeamEntity)` (nullable). Application/`assignCleanerToTeam` still writes `teamId`.
- Migration: trim; keep existing team FK
- Convert `CleanerType` / `TeamType` to DTOs with platform paging; Team `@OffsetConnection('cleaners', …)` **without** nested `totalCount`; root many **with** `totalCount`
- `CleanerReadResolver`: `many: { name: 'cleaners' }`, `one: { disabled: true }`
- `TeamReadResolver`: `many: { name: 'teams' }`, `one: { disabled: true }`, Relatable for `cleaners`
- Keep `cleaner.team` as the existing Clensy `@ResolveField` + `CleanerTeamLoaders` (object, not a collection) **unless** Relatable `@FilterableRelation('team')` is cleaner; do not do both
- Delete Clensy `cleaners()` / `teams()` lists and `TeamResolver.cleaners` `@ResolveField`
- `cleaners.module.ts`: `NestjsQueryTypeOrmModule.forFeature([CleanerEntity, TeamEntity])` only
- Tests + e2e `cleaners-teams.e2e-spec.ts`
- Client: `cleaners.graphql`, `teams.graphql`
- Web: `apps/web/app/app/cleaners/page.tsx`, `apps/web/app/app/cleaners/teams/page.tsx`

**Failing tests:** **Schema:** root connection types **with** `totalCount` and `paging`; `team.cleaners` is a Cleaner offset connection with **paging** + `nodes`/`pageInfo` **without** `totalCount` (nested `filter`/`sorting` only if the mechanism exposes them); `cleaner`/`team` one still nullable. **Runtime:** omitted root paging ≤ 20; nested `teams { nodes { cleaners { nodes { id } } } }` uses §6 O(1) **nodes** measurement in team N. `listTeamCleaners` still tested.

**Commit** `feat: paginate cleaner and team GraphQL collections`

**Traceability:** spec §4.2, Cleaners spec list contracts as amended.

---

### Task 6 — Catalog (`services`, `addOns`)

**Files:**
- Convert `ServiceType` / `AddOnType`; **no** `pricings` connection; keep `activePricing` `@ResolveField` + `ActivePricingLoader`
- `ServiceReadResolver` / `AddOnReadResolver`: many enabled **with** `totalCount`, `one: { disabled: true }` for `service`; addOn get-by-id stays as today (add a Clensy one only if one already exists — do not invent `addOn(id)` if the schema has none)
- Delete Clensy list methods
- `catalog.module.ts`: `forFeature` ServiceEntity + AddOnEntity (not PricingRule unless already required for writes)
- Tests + `catalog.e2e-spec.ts`
- Client: `services.graphql`, `add-ons.graphql`
- Web: `apps/web/app/app/catalog/page.tsx`, `apps/web/app/app/catalog/add-ons/page.tsx`

**Failing tests:** `Query.services` / `Query.addOns` are connections **with** `totalCount`; `activePricing` still a nullable singleton on `Service`; **no** `Query.pricings`; omitted paging ≤ 20.

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
- `JobReadResolver`: Relatable + `many: { name: 'jobs' }` **with** `totalCount`, `one: { disabled: true }`; keep Clensy `job(id)` nullable
- Checklist Relatable: `@OffsetConnection('items', …)` on Checklist DTO **without** nested `totalCount`; delete `ChecklistResolver.items` array `@ResolveField`
- `jobs.module.ts`: `forFeature` CleaningJobEntity, ChecklistEntity, ChecklistItemEntity only
- Client: `jobs.graphql` — `jobs { totalCount nodes { … checklist { id items { nodes { id label position completed completedAt } } } } }` (no `items { totalCount }`)
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

Checklist progress: `job.checklist.items.nodes` (limit 20 covers today’s three items). Nested items MUST NOT select `totalCount`.

**Failing tests:** **Schema:** `Query.jobs` is `CleaningJobConnection!` **with** `totalCount` and `paging`; `Checklist.items` is a ChecklistItem offset connection with **paging** + `nodes`/`pageInfo` **without** `totalCount` (nested `filter`/`sorting` only if the mechanism exposes them); `job(id)` nullable. **Runtime:** uniqueness e2e still conflicts on second `createJobFromBooking`; nested items use §6 O(1) **nodes** measurement; existence query with `limit: 1` does not scan all jobs (SQL `LIMIT` / node length 1). Document which §3.6 mechanism was proven.

Keep `JobsService.listJobs` tests.

**Commit** `feat: paginate jobs and checklist items; bound job existence reads`

**Traceability:** spec §4.2, §4.5, §6#10.

---

### Task 8 — Allowlist sweep, codegen, regression, web golden paths

**Files:** any leftovers from Tasks 2–7; `apps/api/src/schema.gql` (generated); `packages/client/src/generated/graphql.ts`; e2e suites listed in §7.

**Assert (schema / `schema.gql` — SDL only):**

- Every §4.2 **root** field is a `*Connection` with `totalCount`, `nodes`, and a `paging` argument (`filter`/`sorting` on roots per spec §4.1).
- Every §4.2 **nested** field is an offset connection with `nodes` / `pageInfo`, a `paging` argument, and **without** `totalCount` on that nested type. Nested `filter`/`sorting` are not required unless the mechanism exposes them.
- No leftover `[Booking!]!` / `[Customer!]!` / `[Property!]!` / `[Cleaner!]!` / `[Team!]!` / `[Service!]!` / `[AddOn!]!` / `[CleaningJob!]!` / `[ChecklistItem!]!` on those field names.
- No `allBookings`, `Query.properties`, `Query.checklists`, `Query.pricings`.
- `admins: [Admin!]!` **unchanged**.
- No `createOne*` / `updateOne*` / `deleteOne*` / `createMany*` / relation `add*`/`set*`/`remove*` for in-scope types.
- `customer` / `property` / `cleaner` / `team` / `service` / `job` one-queries remain nullable; `booking` remains non-null.
- No `edges`/`cursor` as the collection strategy.

**Assert (runtime / config — not introspection):**

- **Default-sort column gate:** for every §4.2 collection, the chosen `defaultSort` fields exist on the entity, exist on the DTO, are sortable in 9.5.0, and work as a sort e2e (or appear as accepted `SortField`s in **generated filter/sort input types**, which is SDL of those inputs — not proof of default 20/100). If a field is missing, the module task must have already switched pair (still unique tie-breaker) — Task 8 fails if any collection still points at a non-existent/unsortable field.
- Omitted paging → 20; `limit: 1000` → clamp 100; OFFSET pages (not cursor).
- Config inspection of option bags / 9.5.0 source: roots `enableTotalCount: true`; nests do not enable `totalCount`; no cursor/10/50/`-1` drift.

```bash
pnpm --filter @clensy/client codegen
pnpm --filter api test
pnpm --filter api test:e2e
```

Manual (Phase 1 §7): `/app/bookings`, `/app/jobs` (create job from booking, checklist progress), `/app/customers` (nested properties), `/app/cleaners`, `/app/cleaners/teams`, `/app/catalog`, `/app/catalog/add-ons`. Confirm DataTable page controls where **root** `totalCount` is selected. Nested lists use `hasNextPage` / offset. Confirm `/app/admin` list still works (unpaginated `admins`).

**Commit** `test: lock paginated collection schema allowlist`

**Traceability:** spec §4.1, §4.6, §6#1, §6#2, §6#6, §6#9, §6#14.

## 10. Execution / operational risks (not redesign)

- **Shared GraphQL connection type** that cannot omit nested `totalCount` without stripping root `totalCount` is a Task 3 (and Task 4 `PropertyConnection`) spec-return. Do not enable nested `totalCount` to keep the type.
- **Nested nodes O(N)** on the list-parent harness is a Task 3 spec-return. Do not accept O(N). Do not use aliased independent `property(id:)` roots as the O(1) gate (DataLoader tick artifact).
- **Clamp-before-`PropertyMax`:** Task 2 mechanics gate. Isolated pipe tests are not enough. Method-level `ReadResolver` `pipes:` is too late. If a platform layer registered **before** global ValidationPipe still cannot rewrite, return the spec — do not set `maxResultsSize: -1`, do not change the product to reject.
- **`customerProperties`:** Task 4 must use a verified 9.5.0 QueryService/connection path. A hand-rolled connection that bypasses nestjs-query is a spec-return, not a workaround.
- **`migration:generate` noise** on existing FKs — trim as in #29.
- **DTO import cycles** (Property ↔ Booking, Team ↔ Cleaner) — lazy thunk, not module merge.
- **Jobs page compiles after Task 2** but picker remains wrong until Task 7 — do not treat Task 2 as fulfilling §4.5.
- If Task 3 cannot satisfy the `forFeature` gate, TypeORM inverse mapping, O(1) nested **nodes**, **or** the root/nested `totalCount` type split, **return the spec**. Remaining same-module nests are not a substitute proof for `property.bookings`.

## 11. Out of scope (explicit)

Quality (#7), Operations Dashboard product (#8), Payments (#10), Admin GraphQL migration, paging REST / application `findAll`, cursor paging, aggregations, subscriptions, `customer.bookings` / `team.bookings` / `service.bookings`, root `properties` / `checklists`, catalog `pricings`, shared entity package, flattening DDD folders, nested `totalCount` / nested “showing X of Y”, rejecting oversized `limit` as clamp.

## 12. Self-check (planner)

| Check | Result |
| --- | --- |
| Every major spec contract has a task | Yes — §8 table |
| No new product semantics | Policy constants, clamp **layer placement**, sort columns, `customerProperties` wrapper *requirements*, Jobs filter *mechanism ladder*, OffsetConnection (not Filterable), nested `enableTotalCount: false` are M4 mechanisms for locked product rules — 9.5.0 factory APIs stay unproven until their task |
| Task order executable | Policy → Booking **integration proof** → **property.bookings gate** (no nested `totalCount`; O(1) nodes; type split) → other modules → allowlist |
| Deferred work named | §11 + `admins` + Quality/Dashboard/Payments |
| Missing design → would stop | Shared connection type cannot split `totalCount`; foreign `forFeature`; illegal dual mapping; nested nodes O(N) with no permitted mechanism; clamp layer cannot run before `PropertyMax` without `-1` |
