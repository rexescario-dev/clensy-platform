# Paginated nestjs-query GraphQL Collections — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product/platform GraphQL-read contracts, not a process specification) |
| **Date** | 2026-08-28 |
| **Tracking** | [#33](https://github.com/rexescario-dev/clensy-platform/issues/33) |
| **Depends on (normative amendments)** | [nestjs-query GraphQL Reads](2026-08-28-nestjs-query-graphql-reads-design.md) (**Accepted**, #29) — this RFC **amends** §2 (paging out of scope), §4.5 (`PagingStrategies.NONE`, `bookings: [Booking!]!`), §4.1 / non-goals (inverse collections out of scope), and the Booking-only proving-slice boundary. It **relies on** that spec’s read-stack: `ReadResolver` + `Relatable`, QueryService, owning-module-only `forFeature`, command-owned writes, non-eager TypeORM relations, no `CRUDResolver`. Booking is the **read-stack implementation reference**; its `PagingStrategies.NONE` is **explicitly not** the contract to replicate. [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) **§2.6** — this RFC **further amends** the persistence-metadata exception so a module’s TypeORM entity MAY declare a **unidirectional inverse collection** (`@OneToMany`) to another module’s entity as the **preferred** representation of an ORM-backed nested GraphQL connection (subject to M4 proof). Application-layer writes, dashboard reads, and domain objects remain bound by the original §2.6 rule. |
| **Depends on (normative, list contracts)** | [Customers & Properties](2026-08-15-customers-properties-design.md) §4.5 — amends `customers: [Customer!]!`, `customerProperties: [Property!]!`, and nested `Customer.properties: [Property!]!` to connections; adds nested `Property.bookings`. [Cleaners & Teams](2026-08-16-cleaners-teams-design.md) — amends `cleaners` / `teams` / nested `Team.cleaners` to connections. [Catalog](2026-08-16-catalog-design.md) — amends `services` / `addOns` to connections; does **not** invent a `pricings` collection; `activePricing` stays a singleton. [Bookings](2026-08-22-bookings-design.md) §4.5 as already amended by #29 — further amends the many-query return type to `BookingConnection!`. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) — amends `jobs: [CleaningJob!]!` and nested `Checklist.items: [ChecklistItem!]!` to connections; **replaces** the Phase-1-unpaginated client-side `bookings`/`jobs` full-list join (§4.5 / §4.6) with a targeted server read. |
| **Depends on (informative)** | [Admin Foundation](2026-08-14-admin-foundation-design.md) — `AuthGuard`, `@Roles()`, audit consumed as-is. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) — list screens already have optional DataTable pagination; **root** connections feed that with `totalCount` / `pageInfo`. Nested lists feed next/previous from `pageInfo` only. |
| **Followed by (informative)** | After M3 Accept of **this revision**: M4 must produce a **revised** implementation plan for [#33](https://github.com/rexescario-dev/clensy-platform/issues/33). The previously Accepted 2026-08-28 plan is **not** authoritative for nested `totalCount` (that plan required nested `totalCount` and O(1) nested COUNT — 9.5.0 cannot do both). Quality (#7), Operations Dashboard (#8), and Payments (#10) remain independent product slices; when those specs exist they **MUST** inherit this RFC’s **platform** collection invariant. Admin GraphQL (`admins`) is a **legacy deferred exception** until its own migration spec. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — **M2** architecture RFC. **Acceptance gate:** M3 design review (**Accepted**). **Implementation planning:** M4. **Implementation:** M6. |
| **Revision note** | Fifth draft after M3 **Returned for Revision** of the fourth draft. Closes two feasibility gaps without redesigning the RFC: (1) oversized `limit` is **clamp-to-100**, not a library-reject that M4 may substitute; a **platform paging-normalization layer** is authorized solely for that clamp because 9.5.0 MAY reject `limit > max` rather than rewrite it. (2) O(1) nested **nodes** is a **hard** invariant; M4 may choose among 9.5.0 Relatable/QueryService mechanisms that satisfy it and the `forFeature` gate, but MUST return this spec if none do — not accept O(N). Carries forward the fourth-draft `totalCount` split (root required, nested forbidden). |
| **M3 decision** | **Accepted** — 2026-08-28 (fifth draft). Prior return closed: oversized `limit` is clamp (platform paging-normalization layer authorized; library reject is not a substitute); O(1) nested **nodes** is a hard invariant (M4 chooses among Relatable/QueryService mechanisms inside the `forFeature` gate; failure returns this spec). No remaining design blocker. Ready for M4 Implementation Planning (revised plan; the 2026-08-28 plan is not authoritative for nested `totalCount`). |

## 1. Primary question & thesis

**Question:** Now that Booking GraphQL reads on nestjs-query 9.5.0 are proven, what is the **platform-wide** GraphQL contract for collection fields — including paging, nested collections, and the remaining modules — without turning writes into generic CRUD?

**Thesis:** Two related contracts, not one:

> **Platform invariant:** Every GraphQL collection **introduced or migrated** on the platform MUST be a nestjs-query **offset-paginated connection**. This applies equally to **root queries and relation fields**; relation cardinality or current row count does not create an exception. **Introduced** includes collections added by future feature specs, including nested relation fields.

> **This RFC’s migration scope:** that invariant is applied to the existing collection inventory in §4.2. Existing Admin GraphQL (`admins`) is an explicit **legacy exception** until its own migration spec. This RFC MUST NOT add other new unpaginated collections.

> **`totalCount` split (locked):** every **root Query** collection connection MUST expose `totalCount`. Every **nested** collection connection MUST NOT. Nested paging uses `nodes` + `pageInfo` (`hasNextPage` / `hasPreviousPage`) and the same 20/100 offset policy. This is not an exception to the offset-connection invariant; it is which fields that connection type carries.

> **Oversized `limit` (locked):** a requested `limit > 100` MUST be **clamped to 100**. The operation MUST succeed without a GraphQL error. 9.5.0 `maxResultsSize` (or equivalent) remains the library **bound** (never unlimited `-1`). Because 9.5.0 MAY **reject** an oversized client `limit` rather than rewrite it, this RFC **authorizes a platform paging-normalization layer** whose sole purpose is that clamp (see §4.1). M4 MUST NOT treat a library reject as satisfying this RFC.

> **O(1) nested nodes (locked):** nested connection **nodes** MUST load in **O(1) SQL/query count with respect to parent N**. That is a hard platform invariant, not an M4 product choice. Inverse TypeORM metadata is the **preferred** 9.5.0 representation. M4 may select any 9.5.0 Relatable/QueryService relation mechanism that stays inside the read stack and the owning-module `forFeature` gate. If no such mechanism meets O(1), nested connections under this architecture are **not implementable** — return this spec (see §4.3).

That is a deliberate architectural amendment of #29, not a reinterpretation of #29 and not an M8 cleanup of already-specified code.

The canonical **read** architecture for **collection/connection** fields remains:

> **ReadResolver (many) + Relatable → QueryService → owning-module `forFeature` only**

Existing Clensy get-by-id queries stay Clensy (nullable where already specified). Writes remain Clensy commands/mutations. Domain objects still hold ids, never foreign entities. TypeORM inverse collections, **where used**, are persistence metadata for nested GraphQL connections, not application-layer aggregate loading.

Booking is the implementation reference for that read stack. Booking’s shipped `PagingStrategies.NONE` / `[Booking!]!` many-query is the **defect this RFC removes**, not the pattern to copy.

## 2. Scope

### In scope (normative)

- Platform invariant: every GraphQL collection **introduced or migrated** on the platform is a nestjs-query connection using **`OffsetPaging`** (not cursor, not `PagingStrategies.NONE`, not `[Entity!]!`). Applies to root queries **and** relation fields; small cardinality is not an exception.
- This RFC’s migration scope: apply that invariant to the inventory in §4.2 (including Booking’s breaking many-query change). Admin GraphQL is a legacy exception, not in this inventory.
- Central paging policy: **default 20**, **maximum 100**, defined once at platform level. Oversized `limit` **clamps to 100** (not a library reject). 9.5.0 `maxResultsSize` (or equivalent) is the library bound; a **platform paging-normalization layer** is authorized solely to provide clamp semantics if 9.5.0 would otherwise reject. Not independently per module; not a client convention.
- Connection shape: 9.5.0 OffsetConnection (`nodes`, `pageInfo`) on every root **and** nested collection. **`totalCount` is required on root Query connections and forbidden on nested object-type connections** (see §4.1). Enable root `totalCount` via the applicable 9.5.0 option (not a custom count field, not a single global switch).
- Deterministic **default sort** on every paginated collection, including a unique tie-breaker (stable across offset pages).
- Breaking change of Booking’s many-query: `bookings: [Booking!]!` → `BookingConnection!`, including `packages/client` operation documents and `/app/bookings`.
- Migration of the **existing** collection inventory in §4.2 onto the same read stack as Booking (#29), including nested collections.
- Unidirectional-inverse TypeORM collection metadata as the **preferred** persistence representation for nested connections in §4.2. M4 proves **which** 9.5.0 Relatable/QueryService mechanism satisfies O(1) nested **nodes** and the `forFeature` gate; it does **not** decide whether O(1) is mandatory (see §4.3). Owning-module-only `forFeature` / QueryService registration remains a hard gate (#29 §4.1 / §4.9#10).
- Replacement of Jobs UX that is correct **only** because `bookings` and `jobs` are unpaginated full lists (Jobs spec §4.5 / §4.6).
- Filter and sorting on collection queries (`filter`, `sorting`, plus `paging`). Filterable/sortable fields are an **allowlist per DTO**; relation filtering is opt-in.
- Schema allowlist discipline from #29: no generated create/update/delete, no relation mutations, no aggregations, no subscriptions. No alternate unpaginated array field for the same collection.

### Informative (not a new product rule)

- M4 will sequence module-by-module work. This specification does **not** order Customer vs Property vs Job. Completeness is “the inventory in §4.2 satisfies the invariant,” not a particular ship order.
- Quality, Dashboard, Payments, and future modules are not implemented here. Their future specs MUST use this collection contract rather than re-litigating paging.

### Out of scope (normative)

- Quality & Re-cleans (#7) and Operations Dashboard (#8) product work.
- Payments, invoices, credits (#10) — no Payment GraphQL collection exists; do not invent one.
- Admin GraphQL (`admins: [Admin!]!`, `currentAdmin`, create/disable admin). No requirement in this RFC to migrate the Admin API.
- A `pricings` / `pricingRules` **collection** query. Catalog keeps `activePricing` as a **singleton** (`PricingRule` or null). A price-history list remains Catalog’s existing deferral.
- A new unbounded root `properties` query. Property lists stay `customerProperties` (standalone, customer-scoped) and nested `customer.properties`.
- A new root `checklists` query. Checklist remains `job.checklist: Checklist!` (singular). The collection is `checklist.items`.
- Nested booking inverses **not** listed in §4.2 (`customer.bookings`, `team.bookings`, `service.bookings`).
- Cursor paging, aggregations, subscriptions, federation.
- Generated `createOne*` / `updateOne*` / `deleteOne*` / `createMany*` / relation `add*` / `set*` / `remove*` mutations.
- Changing write validation, audit matrices, RBAC matrices, or REST. REST and application-layer `findAll` / `getXByIds` remain; they are **not** required to page in this RFC.
- Registering foreign entities / QueryServices on a module **solely** to satisfy DI. Same spec-return as #29.
- TypeORM Promise-based `lazy: true`. Relations stay `eager: false`; nestjs-query owns fetching.
- Row-level / tenant authorizers. Phase 1 auth remains `AuthGuard` + `@Roles()`.
- Flattening DDD folders; forcing dashboard reads through GraphQL; implementing this RFC (M6) or planning tasks (M4) in this document.
- Nested `totalCount`, a custom nested count field, or nested DataTable “showing X of Y” that needs exact cardinality. Nested lists page with `hasNextPage` / offset.

## 3. Terminology

- **Collection field** — any GraphQL field whose value is a **list of objects** (root query or nested). Not a single object (`booking.customer`, `job.checklist`, `service.activePricing`, `cleaner.team`) and not a scalar/list-of-scalars.
- **Root collection field** — a collection on the GraphQL `Query` type (`bookings`, `customers`, `customerProperties`, `jobs`, …).
- **Nested collection field** — a collection on an object type (`property.bookings`, `customer.properties`, `team.cleaners`, `checklist.items`).
- **Connection** — this RFC’s required collection return type: 9.5.0 OffsetConnection (`nodes`, `pageInfo`). **Root** connections MUST also expose `totalCount`. **Nested** connections MUST NOT. `totalCount` is not intrinsic to OffsetConnection; this RFC requires it to be enabled only on root Query connections via the applicable 9.5.0 option.
- **Offset paging** — `paging: { limit, offset }` (`PagingStrategies.OFFSET`). Opposite of cursor connections and of `PagingStrategies.NONE` (bare array).
- **Platform paging policy** — the single pair (default limit **20**, max limit **100**) that every in-scope connection uses, enforced server-side. Oversized client `limit` is **clamped** to 100.
- **Platform paging-normalization layer** — an authorized platform component whose **sole** normative purpose is to rewrite `paging.limit > 100` to `100` before 9.5.0 validates or executes the page, so clamp semantics hold even if the library would reject. It MUST NOT invent a second paging model, change 20/100, or replace nestjs-query connections.
- **Read stack** — #29’s GraphQL-read architecture for **collection/connection** fields: composable `ReadResolver` (many) + `Relatable`, TypeORM `QueryService`, owning-module `forFeature` only, Clensy mutations for writes. One-queries (get-by-id) that are still Clensy stay Clensy (see §4.1).
- **Unidirectional inverse collection** — a TypeORM `@OneToMany` (or equivalent collection mapping) on the referenced entity. **Preferred** persistence representation for ORM-backed nested connections in this RFC’s inventory where an FK already exists. It is **not** claimed as the only nestjs-query relation mechanism. Persistence metadata only: MUST NOT appear on the domain object and MUST NOT be used by application services to load, save, or validate foreign aggregates.
- **Targeted read** — a GraphQL query that answers one existence or lookup question with a connection page (typically `paging: { limit: 1 }` plus a filter), as opposed to downloading an entire unpaginated list and joining it on the client.
- **Legacy deferred collection** — a collection field that exists today but this RFC does **not** migrate (`admins`). It is not part of the architecture going forward and is not permission to leave §4.2 fields as arrays.

## 4. Domain and behavioral contracts

### 4.1 Platform GraphQL collection contract

**Platform invariant (normative):**

> Every GraphQL collection **introduced or migrated** on the platform MUST be exposed as a nestjs-query connection using `OffsetPaging`. This applies equally to root queries and relation fields; relation cardinality or current row count does not create an exception. **Introduced** includes collections added by future feature specs, including nested relation fields.

**This RFC’s migration scope:** the invariant is applied to §4.2. `admins` is a legacy deferred exception (§4.6), not a counterexample.

Representative root shape (names follow the entity; paging argument names follow 9.5.0 offset paging):

```graphql
bookings(
  filter: BookingFilter
  sorting: [BookingSort!]
  paging: OffsetPaging
): BookingConnection!
```

Representative nested shape (return **type name** is illustrative; 9.5.0 often emits a per-parent connection such as `PropertyBookingConnection`. The product rule is the field set: `nodes` + `pageInfo`, **no** `totalCount`):

```graphql
type Property {
  bookings(
    filter: BookingFilter
    sorting: [BookingSort!]
    paging: OffsetPaging
  ): PropertyBookingConnection!
}
```

**Connection shape required by this RFC:** the standard 9.5.0 OffsetConnection shape (`nodes`, `pageInfo`) on every in-scope collection. **`totalCount` is required on every root Query connection and forbidden on every nested collection connection.**

Root Query connections MUST enable `totalCount` with the applicable 9.5.0 option (`enableTotalCount` on `@QueryOptions` / `ReadResolver` many, or equivalent) — not a custom count field, and not a single nonexistent global switch. Nested `@OffsetConnection` / Relatable many-opts MUST NOT enable `totalCount`. Implementations MUST NOT add a custom nested count field to recover “showing X of Y” on a nest.

If 9.5.0 cannot omit `totalCount` on a nested field without also omitting it on the **root** connection type of the same entity (shared GraphQL `*Connection` type), **return this spec** — do not enable nested `totalCount` to keep a shared type, and do not drop root `totalCount`.

```graphql
# Root Query connection (totalCount required)
type BookingConnection {
  nodes: [Booking!]!
  pageInfo: OffsetPageInfo!
  totalCount: Int!
}

# Nested connection (totalCount forbidden). The GraphQL type name MAY
# differ from the root connection type (9.5.0 often emits a per-parent
# connection name). The product rule is the field set, not the type name.
type OffsetPageInfo {
  hasNextPage: Boolean
  hasPreviousPage: Boolean
}
```

- Clients that previously selected `bookings { id … }` MUST select `bookings { nodes { id … } }` (and paging/pageInfo as needed). Nested selections MUST NOT select `totalCount`.
- Root `totalCount` is for DataTable-style “showing X of Y” / page-count UX without a second query. `hasNextPage` alone is enough for next/previous. Nested lists MUST use `hasNextPage` / further offset pages (or a `limit` that covers the set, as with today’s three-item checklists). Root `totalCount` MUST NOT be computed unless the operation selects it.
- Omitted `paging` uses **limit 20, offset 0**.
- A requested `limit` greater than **100** MUST be **clamped to 100**. The operation MUST succeed and MUST NOT return more than 100 nodes. This RFC does **not** require a custom GraphQL error for oversized `limit`, and M4 MUST NOT introduce one as a substitute for clamp.
- **Library bound vs argument rewrite (normative):** 9.5.0 `maxResultsSize` (or equivalent server-side cap) MUST remain set so the library cannot return more than 100 nodes. Implementations MUST NOT set that cap to unlimited (`-1`). That bound is **not** the same as clamp: 9.5.0 MAY **reject** a client-supplied `limit > max` (validation error) rather than rewrite it. This RFC’s product behavior is **clamp**, not reject. Therefore this RFC **authorizes a platform paging-normalization layer** whose **sole** purpose is to rewrite `paging.limit > 100` to `100` **before** 9.5.0 validates or executes the page. If 9.5.0 itself clamps the argument, M4 MAY omit a separate layer. If 9.5.0 would reject, M4 MUST use the platform layer — it MUST NOT treat reject as satisfying this RFC. How the layer is installed (Nest pipe, interceptor, or equivalent) is M4; **whether** to clamp is not. The clamp MUST be uniform across modules.
- Default and maximum MUST come from **one platform source** (for example `platform/graphql`). Individual modules MUST NOT pick their own 10 / 50 / 200. Referencing the shared policy from a DTO decorator is allowed; hard-coding a different pair is not.
- The platform **explicitly overrides** nestjs-query library defaults with **OFFSET**, default **20**, and max **100**. Library default numbers are not part of this contract.
- Collection queries MUST expose `filter` and `sorting`. Filterable/sortable fields are those **explicitly declared** on each module’s DTO. Relation filtering is enabled **only** where the DTO relation is intentionally declared filterable (`FilterableOffsetConnection` / `FilterableRelation`, not implied by every `@OffsetConnection`).
- **Default ordering MUST be deterministic** for every paginated collection, including a **unique tie-breaker** (normally `id`) so equal timestamps cannot shuffle rows across offset pages. Example shape: `createdAt DESC, id ASC` — M4 chooses columns; this RFC requires totality, not a global column set. Implementations MUST NOT rely on database natural row order.
- For every collection in §4.2, the connection field is the **sole** GraphQL collection representation of that data. The implementation MUST NOT retain or introduce an alternate unpaginated array field for the same collection (e.g. `bookings: BookingConnection!` plus `allBookings: [Booking!]!`).
- Many-to-one / one-to-one GraphQL fields stay objects, not connections (`booking.customer`, `job.booking`, `job.checklist`, `job.team`, `cleaner.team`, `service.activePricing`).

**Read-stack (relies on #29, not restated as a new invention):**

- Composable `ReadResolver` + `Relatable` for **collection/connection** fields. **Not** `CRUDResolver`. **Not** auto `resolvers: [{ DTOClass, EntityClass }]`.
- **Get-by-id (locked):** nestjs-query owns **many/connections**. Existing Clensy one-queries keep today’s nullability (`customer`, `property`, `cleaner`, `team`, `service`, `job` are nullable and return `null` when missing). This RFC does **not** amend those SDL contracts. If 9.5.0 `ReadResolver` would also emit a non-null `one` query, M4 MUST keep the Clensy field as the schema owner (do not emit or do not register the library `one`). `#29` already moved `booking(id): Booking!`; this RFC does not revert that.
- GraphQL **collection** reads go through that module’s QueryService. Application `findOne` / `findAll` / `getXByIds` remain for REST, commands, and any non-GraphQL consumer. One-queries that stay Clensy MAY continue to use those application reads.
- RBAC: `AuthGuard` + `@Roles(...)` on reads, same matrices as each module’s Accepted spec. nestjs-query authorizers are not a substitute.
- Schema proof remains an **allowlist**: existing Clensy mutations stay; generated CRUD/relation mutations MUST NOT appear. No alternate unpaginated array field for a §4.2 collection.

### 4.2 Collection inventory (actual shipped API)

This is the complete **migration inventory** for this RFC. A collection field is migrated here if and only if it appears here (plus any nested collection this RFC **adds**, namely `Property.bookings`). The **platform** invariant is broader (§4.1): new collections after this RFC MUST still be connections; `admins` is the legacy exception, not an additional inventory row.

Type names below are illustrative. **Root** Query fields MUST be connections **with** `totalCount`. **Nested** fields MUST be offset connections of the same node type **without** `totalCount`; 9.5.0 MAY emit a distinct GraphQL type name (e.g. `PropertyBookingConnection` rather than reusing root `BookingConnection`).

| GraphQL field | Kind | Today | This RFC |
| --- | --- | --- | --- |
| `customers` | root | `[Customer!]!` | `CustomerConnection!` (**with** `totalCount`) |
| `customer.properties` | nested | `[Property!]!` | Property offset connection (**no** `totalCount`) |
| `customerProperties(customerId: ID!)` | root | `[Property!]!` | `PropertyConnection!` (**with** `totalCount`), still **scoped to that customer** |
| `property.bookings` | nested | *(absent)* | Booking offset connection (**no** `totalCount`; **new** nested field) |
| `cleaners` | root | `[Cleaner!]!` | `CleanerConnection!` (**with** `totalCount`) |
| `teams` | root | `[Team!]!` | `TeamConnection!` (**with** `totalCount`) |
| `team.cleaners` | nested | `[Cleaner!]!` | Cleaner offset connection (**no** `totalCount`) |
| `services` | root | `[Service!]!` | `ServiceConnection!` (**with** `totalCount`) |
| `addOns` | root | `[AddOn!]!` | `AddOnConnection!` (**with** `totalCount`) |
| `jobs` | root | `[CleaningJob!]!` | `CleaningJobConnection!` (**with** `totalCount`) |
| `checklist.items` | nested | `[ChecklistItem!]!` | ChecklistItem offset connection (**no** `totalCount`) |
| `bookings` | root | `[Booking!]!` (`PagingStrategies.NONE`) | `BookingConnection!` (**with** `totalCount`) |

**Not collections (unchanged kind):** `customer`, `property`, `cleaner`, `team`, `service`, `activePricing`, `addOn` if present, `job`, `booking`, `job.booking`, `job.team`, `job.checklist`, `booking.customer|property|service|team`, `cleaner.team`, `currentAdmin`.

**`customerProperties` product contract:** keep the **name**. Results MUST be one customer’s properties only. The customer scope MUST be **server-enforced**. The resolver MUST NOT accept an empty/missing customer scope that returns all properties (including `customerId: null` or `filter: {}` as an unscoped alias). Do **not** add an unscoped root `properties`. Because this field is a **root Query** collection, its connection MUST expose `totalCount` (one COUNT for that customer is O(1) in parent N — there is a single parent argument). Nested `customer.properties` MUST NOT expose `totalCount`, even if both fields return Property nodes. If 9.5.0 `ReadResolver` many-query cannot take a required `customerId` argument, M4 may implement the same name by forcing a customer filter on Property QueryService. An unscoped Property many-query is a spec defect.

**`checklist.items`:** still a connection even though current checklists are created with three items. Clients that need every item (Jobs checklist progress) MUST page until exhausted or request a limit that covers the set (20 covers today’s size). They MUST NOT assume an unpaginated array.

**Single-id queries** keep their existing nullability (`booking(id): Booking!` per #29; `job(id): CleaningJob` nullable per Jobs; etc.). This RFC does not reopen those decisions — nestjs-query owns connections, not a second pass over get-by-id.

### 4.3 Nested connections and persistence metadata (amends #29 §4.1 / Phase 1 §2.6)

#29 allowed unidirectional `@ManyToOne` on the **referencing** entity and forbade inverse collections. This RFC **permits** inverse collection metadata; it does **not** assert that `@OneToMany` is inherently required by nestjs-query.

**GraphQL contract (normative):** the nested fields in §4.2 (`customer.properties`, `team.cleaners`, `checklist.items`, `property.bookings`) MUST be offset connections with the same **paging policy** as root collections (OFFSET, default 20, max 100, clamp, deterministic default sort, `nodes`, `pageInfo`). They MUST NOT expose `totalCount`.

**Persistence representation (preferred):**

> The selected implementation MAY use TypeORM inverse collection metadata to represent ORM-backed nested connections. For this RFC’s inventory, inverse metadata is the **preferred** persistence representation where the relation is already represented by an FK. M4 MUST prove a **permitted** 9.5.0 mechanism (preferred: inverse + Relatable + owning-module QueryService) that satisfies **both** O(1) nested nodes **and** the `forFeature` gate. Failure of that proof is a spec-return, not permission to keep the nested field with a slower load.

**Amended persistence-metadata rule (GraphQL reads), when inverse metadata is used:**

> A module’s TypeORM **entity** MAY declare a unidirectional inverse collection to another module’s TypeORM **entity** for a GraphQL nested connection. That import is persistence metadata only. It MUST NOT be used to load, save, or validate foreign aggregates from the application layer. Owning modules remain the only registrants of their entities on `TypeOrmModule.forFeature` / `NestjsQueryTypeOrmModule.forFeature`. Domain objects still hold ids, never foreign collections.

Preferred inverses for §4.2 (normative **intent** of the GraphQL nest, not a claim that nestjs-query cannot resolve the field any other way):

| Parent entity | Collection | Child |
| --- | --- | --- |
| `CustomerEntity` | `properties` | `PropertyEntity` |
| `PropertyEntity` | `bookings` | `BookingEntity` |
| `TeamEntity` | `cleaners` | `CleanerEntity` |
| `ChecklistEntity` | `items` | `ChecklistItemEntity` |

Existing #29 many-to-ones on `BookingEntity` stay. `Property.bookings` is the GraphQL inverse of `BookingEntity.property`. Do **not** add `Customer.bookings` / `Team.bookings` / `Service.bookings` in this RFC.

**Loading (outcome, not library internals):** collections MUST NOT be eagerly loaded. Nested connection **nodes** (and `pageInfo` derived from fetching at most max+1 rows) MUST use a **constant-query** strategy such that SQL/query count is **O(1) with respect to the number of parent nodes**. The implementation MUST NOT issue one child **SELECT** per parent node. Nested `totalCount` is **not** in the contract; this RFC does **not** require, and MUST NOT ship, a nested COUNT that is O(N) in parent N.

**O(1) is a hard invariant.** M4 does **not** decide whether O(1) nested nodes is mandatory. If 9.5.0 can resolve the nested field correctly but only with a query count that grows with parent N, that mechanism **fails this RFC**. Nested connections under this architecture are then **not implementable** — return this spec. M4 MUST NOT accept O(N) nested node SELECTs, drop nested connections, replace Relatable with Clensy `@ResolveField` arrays, or add a custom DataLoader/query path outside QueryService as a silent second architecture.

**Permitted mechanisms (architectural boundary):** M4 MAY choose among 9.5.0 relation mechanisms that stay inside the read stack:

> **ReadResolver (many) + Relatable → owning-module QueryService** (optional inverse TypeORM collection metadata; preferred where an FK already exists)

A mechanism is permitted only if it also satisfies the `forFeature` hard gate and the O(1) nested-nodes bar (same evidence bar as #29 §4.8: SQL/query count, not spies on deleted loaders). How 9.5.0 batches (DataLoader, grouped `IN (...)`, or other) is M4 **internals**, provided those two gates hold.

**DI / `forFeature` (hard gate, unchanged spirit):** the module that **owns** the child entity owns that entity’s QueryService. A parent module MUST NOT `forFeature` the child entity merely so Relatable can resolve the nested connection. If 9.5.0 fundamentally requires the parent module to own the child’s QueryService, **return this spec** — do not “make DI work” by violating the gate. Importing a module that already exported the child’s QueryService is not the same as re-registering it.

**M4 validation gate (architectural, not a task list):** M4 MUST prove a nested connection query **across real module boundaries** (at least `property.bookings`, the only cross-module nest in the table) that satisfies **all** of: offset connection without nested `totalCount`; O(1) nested **nodes** in parent N; owning-module-only `forFeature`. TypeORM inverse metadata alone MUST NOT be assumed sufficient. If the preferred inverse mapping cannot satisfy those gates, M4 MAY try another **permitted** 9.5.0 Relatable/QueryService mechanism. If **no** permitted mechanism satisfies O(1) **and** `forFeature`, **return this spec** — do not silently mutate module boundaries, and do not weaken O(1).

Non-eager (`eager: false`) when TypeORM relations are used. No cascade persist/delete on these collections unless an already-Accepted spec says otherwise. Existing FK names and `ON DELETE` behavior stay.

### 4.4 Writes, REST, application reads

Unchanged in behavior from each module’s Accepted spec:

- Mutations stay Clensy (`createBooking`, `createCustomer`, `createJobFromBooking`, …). Inputs stay Clensy types, not nestjs-query Create/Update DTOs.
- Audit and RBAC matrices stay.
- REST (Bookings) stays on `BookingsService`. nestjs-query is GraphQL-only.
- Application `findOne` / `findAll` / `getXByIds` / `listCustomerProperties` / `listTeamCleaners` remain. This RFC does **not** require those methods to page. Dashboard (#8) still reads application contracts, not this GraphQL surface.

Removing an application list method **because** GraphQL now uses QueryService is a spec-return.

### 4.5 Client and web (breaking, in this RFC)

`packages/client` operation documents for every in-scope collection MUST compile against the connection schema. `/app/bookings` and every other in-scope list/detail that currently selects a bare array MUST read `nodes` (and paging as needed).

This is **not** a visual redesign of DataTable, but it **is** a required data-contract change: unpaginated `useBookingsQuery().bookings.map(...)` is invalid after this RFC.

Jobs spec §4.5 / §4.6 called out that client-side “omit bookings that already have a job” and the bookings-drawer Create/View job toggle are correct **only** while both lists are full and unpaginated. **This RFC is that revisit.**

**Replacement contract (normative):**

- Client-side joins of two **complete** lists are forbidden once either list is a connection.
- Existence checks (“does this booking already have a job?”, Create job vs View job) MUST be **server-side and bounded** (targeted query, typically `paging: { limit: 1 }`). They MUST NOT download every job.
- Relation-existence filtering (e.g. “bookings with no related job”) is **preferred, not guaranteed**. M4 determines whether 9.5.0 can express it. If not, the create-job picker degrades to showing bookings and relying on the already-specified uniqueness `ConflictException`. Inventing a new root `jobByBookingId` is allowed **only** if the connection/filter model cannot express existence; it is not the default.
- Server uniqueness of one job per booking remains authoritative (Jobs spec).

Checklist progress that today derives from `checklist.items` in one unpaginated array MUST read `checklist.items.nodes` (paging until complete if a future checklist can exceed one page).

### 4.6 Legacy collections explicitly deferred from this RFC

These are **not** part of the architecture this RFC adopts. They are grandfathered leftovers.

- `admins: [Admin!]!` — **legacy deferred exception** (out of scope). A later Admin spec MUST paginate it when that API is next redesigned. This RFC MUST NOT add other new unpaginated collections.
- Collections that do not exist yet (Quality, Payments, Dashboard GraphQL). Their future specs MUST use the **platform** invariant in §4.1.

`admins` is **not** permission to leave `customers` or `jobs` as arrays.

### 4.7 What Booking is a reference for — and what it is not

**Copy from Booking (#29):** `Relatable`; QueryService; `forFeature` only the owning entity; dual UUID column + `@ManyToOne` where a many-to-one GraphQL field exists; Clensy mutation resolver; schema allowlist tests; O(1) SQL proof for relations; `ReadResolver` **many** (connection) after this RFC. Booking’s `booking(id): Booking!` stays as #29 shipped it.

**Do not copy from Booking as shipped:** `@QueryOptions({ pagingStrategy: PagingStrategies.NONE })`, many-query return type `[Booking!]!`, any assumption that existing `query { bookings { id } }` documents stay valid without selecting `nodes`. **Do not copy** Booking’s `ReadResolver` **one** onto modules whose get-by-id is still nullable.

This RFC **changes Booking** to match §4.1. There is no Booking exception.

## 5. Goals and non-goals

**Goals**

- One GraphQL collection contract across the inventory in §4.2, including nested fields (offset connections; `totalCount` on roots only).
- Bounded list queries (default 20, hard max 100) from one platform policy, enforced server-side.
- Deterministic default ordering on every paginated collection, including a unique tie-breaker.
- Preserve #29’s DDD/write/RBAC/audit/REST split while extending collection reads off Booking; do not reopen get-by-id nullability.
- Make the Jobs “full list join” dependency impossible to ship accidentally.

**Non-goals**

- Per-module paging numbers or unpaginated “small table” exceptions inside §4.2.
- Migrating Admin, Quality, Dashboard, or Payments in this RFC.
- Inventing catalog `pricings` or a global `properties` / `checklists` root query.
- Nested `totalCount`, a custom nested count field, or nested “showing X of Y” that needs exact cardinality.
- Rejecting oversized `limit` as a substitute for clamp; accepting O(N) nested node loads as a substitute for Relatable.
- Turning mutations into nestjs-query CRUD.
- Paging REST or application-layer list methods.
- A shared entity package / persistence kernel.
- Implementation task order, TDD plan, or code (M4–M6).

## 6. Invariants and boundaries

1. **MUST** expose every §4.2 collection field as an offset connection; **MUST NOT** ship `[Entity!]!` for those fields; **MUST NOT** retain or add an alternate unpaginated array field for the same collection.
2. **MUST** apply the platform invariant to every **new** collection field (including nested relation fields in future specs); **MUST NOT** treat `admins` as a template for new arrays.
3. **MUST** use default limit 20 and max 100 from one platform source; `limit > 100` **clamps** to 100 (operation succeeds, no GraphQL error); **MUST NOT** set the library cap to unlimited; **MUST NOT** treat a 9.5.0 reject of oversized `limit` as satisfying clamp. A platform paging-normalization layer is **authorized** solely for that rewrite if the library would reject.
4. **MUST** use a **deterministic default sort** with a unique tie-breaker on every paginated collection; **MUST NOT** rely on database natural row order.
5. **MUST** break Booking’s many-query to `BookingConnection!` and update client + `/app/bookings` in the same delivery as that schema change.
6. **MUST** keep writes on Clensy mutations; **MUST NOT** enable generated CRUD or relation mutations.
7. **MUST NOT** register foreign QueryServices/`forFeature` solely for DI; violation is a spec-return, not a workaround.
8. **MUST NOT** put inverse collections on domain objects or use them from application writes. Inverse TypeORM metadata is preferred, not a nestjs-query prerequisite.
9. **MUST** keep nested collection **nodes** SQL/query count **O(1) in parent N**; **MUST NOT** issue one child SELECT per parent. O(1) nested nodes is **not** optional: if no permitted 9.5.0 Relatable/QueryService mechanism meets it **and** the `forFeature` gate, nested connections are **not implementable under this architecture** — return this spec; **MUST NOT** accept O(N). **MUST NOT** expose `totalCount` on nested collection fields. **MUST** expose `totalCount` on root Query collection connections.
10. **MUST NOT** implement Jobs “already has a job” UX by scanning two full lists; existence checks MUST be server-side and bounded.
11. **MUST NOT** add `property.bookings` as `[Booking!]!`.
12. **MUST NOT** move in-scope get-by-id fields onto non-null `ReadResolver` `one` queries; existing nullable one-queries stay Clensy.
13. **MUST** server-enforce `customerProperties` customer scope; **MUST NOT** accept an empty scope that lists all properties.
14. **MUST NOT** start Quality (#7), Dashboard (#8), or Payments (#10) under this RFC.

## 7. Rationale

- **Why amend #29 instead of reinterpreting it.** #29 Accepted “no paging” and “Booking-only” as explicit non-goals. Silently paging Booking or migrating other modules under that issue would be an architecture change without review. This RFC is the reviewable amendment.
- **Why one RFC rather than one spec per module.** The decision to lock is the **invariant and paging policy**. Re-opening paging in nine M2s would produce nine interpretations. Module **order** is M4 inside this issue; Quality/Dashboard/Payments still get their own product specs later, bound by this invariant.
- **Why offset, not cursor.** The approved contract is `limit`/`offset`. List UIs and DataTable pagination map to offset. Cursor remains available in the library and stays out of scope.
- **Why break Booking.** An unpaginated Booking exception would be the highest-volume collection and would teach every later module the wrong shape. Additive `filter`/`sorting` was #29; `nodes` is not additive — it must be specified and clients updated.
- **Why inverse collections (preferred).** Nested GraphQL connections for FK-backed relations are most honestly represented with ORM collection metadata (same N+1 lesson as #29’s many-to-ones). That representation is **preferred**. It is **not** a claim that nestjs-query requires `@OneToMany`, and it is **not** permission to ship O(N) nested node loads if the preferred mapping fails. Restricting the table avoids a bidirectional graph for unused paths (`customer.bookings`).
- **Why 20 / 100, and why clamp via a platform layer.** Human-approved. The platform overrides library defaults; those default numbers are not this contract. 9.5.0 `maxResultsSize` (or equivalent) is the **bound** so a page cannot exceed 100 nodes and MUST NOT be `-1`. That bound does not define what happens to a **client-supplied** `limit > 100`: 9.5.0 MAY reject rather than rewrite. Clamp (succeed, return at most 100) is the product contract so modules cannot diverge between silent cap and custom errors. A platform paging-normalization layer is authorized **only** to provide that rewrite when the library would reject. M4 MUST NOT change the contract to “reject oversized limit” to match the library.
- **Why O(1) nested nodes is not an M4 choice.** Relatable exists to avoid N+1. If 9.5.0 can emit the nested field but only with one child SELECT per parent, shipping it would reject the same N+1 bar as #29. The permitted boundary is Relatable/QueryService (optional inverse metadata) plus owning-module `forFeature`. Failure of that proof returns this spec; it does not authorize a slower nested implementation or a Clensy `@ResolveField` bypass.
- **Why `totalCount` on roots only.** Pagination itself only needs `hasNextPage`. Root list UIs need DataTable-style “showing X of Y” / page-count without a second query. nestjs-query **9.5.0** `batchCountRelations` maps `getCount()` **per parent**; selecting nested `totalCount` is O(N) in parent N. Implementation measured this on `property.bookings` (one `COUNT … WHERE propertyId = $1` per parent). Accepting O(N) nested counts would reject the N+1 bar that justified Relatable. Dropping nested `nodes` would reject bounded nested lists. A custom nested count field would be a second mechanism beside 9.5.0 and was already forbidden. The locked split: enable `enableTotalCount` on **root** `@QueryOptions` / `ReadResolver` many; do **not** enable it on nested `@OffsetConnection`. Nested UX uses `pageInfo.hasNextPage` / offset. Root `customerProperties` keeps `totalCount` (single parent argument → one COUNT).
- **Why keep `customerProperties` rather than a global `properties`.** That is the shipped product API and the Customers spec’s standalone query. An unscoped Property list is a new collection, not a rename. Scope MUST be server-enforced so a filter-only implementation cannot leak all properties.
- **Why exclude admins and payments.** Admin is a platform identity API, not a domain collection in this inventory. It is a **legacy deferred exception**, not a remaining architectural collection. Payments have no spec. The platform invariant still forbids **new** unpaginated domain collections.
- **Why keep get-by-id on Clensy.** 9.5.0 `ReadResolver` one-query is non-null + `NotFoundException` (#29). Jobs/Customers/etc. are specified to return `null`. This RFC’s subject is collections. Moving `one` would be an unrelated breaking change to those modules’ get contracts.
- **Why deterministic default sort with a tie-breaker.** Offset pages are meaningless if row order is unstable (duplicates/missing rows). Equal `createdAt` values still shuffle without a unique column. nestjs-query documents unstable sort as an offset-paging disadvantage; the platform must not inherit it.
- **Why not page REST.** Phase 1 REST is a preserved comparison artifact (#29). Paging it is a different contract.
- **Why Jobs targeted reads are in this RFC.** Jobs already documented that its UX is Phase-1-unpaginated-only. Shipping paginated `jobs`/`bookings` without replacing that join would be a known product break.

## 8. Acceptance criteria (for this specification)

This document may move from Draft to Accepted after M3 when the reviewer confirms:

- The primary decision is an **amendment** of #29 (paging + inventory + preferred inverses), not a silent reread of #29 and not M8.
- §4.1 distinguishes the **platform** invariant (introduced or migrated collections, including future nested fields) from **this RFC’s inventory**; `admins` is a legacy deferred exception.
- OffsetPaging + 20/100 from one platform source; `limit > 100` **clamps** (succeeds, no GraphQL error); a platform paging-normalization layer is authorized if 9.5.0 would reject; cursor and `PagingStrategies.NONE` stay out. M4 does **not** get to substitute reject for clamp.
- `totalCount` is required on **root Query** connections only, enabled via the applicable 9.5.0 option (`enableTotalCount` or equivalent) — not a custom field, not a single global switch, and **not** on nested `@OffsetConnection`. Nested connections are still offset (`nodes`, `pageInfo`, 20/100).
- Every paginated collection has a **deterministic default sort with a unique tie-breaker**.
- Booking many-query **must** become `BookingConnection!`; client and `/app/bookings` are in the same RFC; no Booking exception; no alternate unpaginated array for the same collection.
- Get-by-id for in-scope modules other than Booking’s already-amended `booking(id)` stays Clensy with existing nullability.
- §4.2 inventory matches the shipped domain; `customerProperties` is server-scoped.
- Nested GraphQL connections are the contract; inverse TypeORM metadata is **preferred**; permitted mechanisms are 9.5.0 Relatable/QueryService inside the `forFeature` gate; O(1) nested **nodes** is a **hard** invariant (not nested COUNT) — failure of the proof **returns this spec**, it does not authorize O(N).
- Jobs existence checks are server-side and bounded; relation-existence filtering is preferred, not guaranteed.
- Writes, REST, application list methods, Quality, Dashboard, and Payments remain out of implementation permission.
- Module **sequencing** is correctly absent (M4). Open questions in §9 are either decided here or explicitly left to M4 without blocking the rest.

## 9. Risks and open decisions

| Item | Status |
| --- | --- |
| 9.5.0 API for **one** platform default/max (module `forRoot` vs shared constant referenced by `@QueryOptions`) | **M4 placement.** Product is **locked:** default 20, max 100, **clamp** oversize `limit` (succeed, no GraphQL error). Library `maxResultsSize` (or equivalent) is the bound, never `-1`. If 9.5.0 rejects oversized `limit`, M4 **MUST** use the authorized platform paging-normalization layer; it MUST NOT change the product to reject. Scattering different numbers is a defect. |
| Nested connection QueryService wiring across module boundaries | **M4 proof of mechanism, not of the invariant** (§4.3). Execute a real nested connection (at least `property.bookings`). Inverse TypeORM metadata is **preferred**. Permitted alternatives: other 9.5.0 Relatable/QueryService relation resolution that stays inside owning-module `forFeature`. O(1) nested **nodes** is **locked**. Foreign `forFeature`, O(N) nested node SELECTs, or a Clensy `@ResolveField` bypass are spec-returns. |
| `customerProperties` as required `customerId` argument vs forced filter on Property QueryService | **M4 mechanism**. Server-enforced customer scope is **locked**. Unscoped `properties` root is **forbidden**. |
| Filter shape for “bookings with no job” / job existence | **M4 against 9.5.0**. Product: server-side bounded existence check; relation-existence filter **preferred, not guaranteed**; uniqueness-error fallback if inexpressible. |
| `FilterableOffsetConnection` vs `OffsetConnection` on nested fields | **M4**. Nested fields MUST be offset connections. Relation **filtering** is opt-in/allowlisted, not implied. |
| How to suppress `ReadResolver` `one` if it would collide with a Clensy nullable get-by-id | **M4 mechanism**. Product is locked: keep Clensy `one` + existing nullability. |
| Per-collection default sort columns | **M4**. Must be deterministic **with a unique tie-breaker**; this RFC does not pick a global `createdAt` vs `id`. |
| `enableTotalCount` on root vs nested decorators | **Decided:** enable on **root** `@QueryOptions` / `ReadResolver` many; **do not** enable on nested `@OffsetConnection`. Not a single global switch. Root count only when selected. If 9.5.0 cannot omit nested `totalCount` without stripping it from the **root** connection type of the same entity, **return this spec**. |
| Checklist of three items still using a connection | Accepted: invariant over special-casing small collections. |
| `admins` remaining as `[Admin!]!` | Accepted **legacy deferred exception**. Not a template for new fields. |
| Offset-depth cost (`offset: 9_000_000`) | **Risk, not a policy.** Offset paging bounds page **size**, not deep-page database cost. No offset cap in this RFC (Phase 1 volumes). |
| Codegen churn (`*Connection`, `OffsetPaging`, unused filter types) | Accepted; existing array selections **will not** keep compiling. |
| Dual many-to-one (#29) plus inverse `@OneToMany` on the same FK pair | **M4 must verify** on TypeORM 1.1.x **if** inverse metadata is used. Preserve existing FK names. If illegal, return to M2/M3 — do not invent a third persistence model. |

## 10. Traceability

| Upstream | This document |
| --- | --- |
| nestjs-query GraphQL Reads (#29) §4.6–4.9 read stack, allowlist, `forFeature` gate, O(1) SQL bar | **Relies on.** |
| #29 §2 / §4.5 / §7 paging `NONE`, `[Booking!]!`, “why not paging yet” | **Amends** (offset connections; Booking included). |
| Phase 1 Design §2.6 | **Amends** (MAY use inverse collection metadata for nested GraphQL connections; preferred, subject to proof). Application/dashboard/domain rules unchanged. |
| #29 inverse collections out of scope | **Amends** permission for the §4.3 table as **preferred** representation, not a nestjs-query prerequisite. |
| #29 Booking-only proving slice / “new spec each” | **Amends** the proving-slice boundary: this RFC **is** the follow-on, as one convention RFC rather than N copies of paging. |
| Customers §4.5 list + nested properties | **Amends** to connections; keeps `customerProperties` name and customer scoping; **adds** `property.bookings`. |
| Cleaners § GraphQL lists + `team.cleaners` | **Amends** to connections. |
| Catalog lists; `activePricing` singleton; no price-history query | **Amends** `services` / `addOns` to connections; **relies on** singleton pricing and no `pricings` collection. |
| Bookings spec writes/REST/RBAC/audit | **Relies on.** |
| Jobs §4.5 N+1, `job.checklist` singular, unpaginated client join warning | **Relies on** N+1 bar and singular checklist; **amends** `jobs` / `items` to connections; **fulfills** the “revisit when paginated” requirement. |
| Admin Foundation | **Relies on.** Admin **collection** query not migrated. |
| Dashboard UX DataTable pagination | **Relies on** (GraphQL now has something to feed it). Dashboard **product** (#8) not started. |
| Quality (#7), Payments (#10) | **Out of scope**; future specs MUST inherit §4.1. |

## 11. Worked example (non-normative of file layout)

Illegal after this RFC:

```graphql
query {
  bookings { id }
  customer(id: $id) { properties { id } }
}

# nested totalCount is also illegal after this revision
query {
  customer(id: $id) {
    properties { totalCount nodes { id } }
  }
}
```

Legal:

```graphql
query {
  bookings(paging: { limit: 20, offset: 0 }) {
    totalCount
    pageInfo { hasNextPage }
    nodes {
      id
      customer { id fullName }
    }
  }
  customer(id: $id) {
    properties(paging: { limit: 20, offset: 0 }) {
      pageInfo { hasNextPage }
      nodes { id addressLine1 }
    }
  }
}
```
