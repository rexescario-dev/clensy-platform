# Paginated nestjs-query GraphQL Collections — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product/platform GraphQL-read contracts, not a process specification) |
| **Date** | 2026-08-28 |
| **Tracking** | [#33](https://github.com/rexescario-dev/clensy-platform/issues/33) |
| **Depends on (normative amendments)** | [nestjs-query GraphQL Reads](2026-08-28-nestjs-query-graphql-reads-design.md) (**Accepted**, #29) — this RFC **amends** §2 (paging out of scope), §4.5 (`PagingStrategies.NONE`, `bookings: [Booking!]!`), §4.1 / non-goals (inverse collections out of scope), and the Booking-only proving-slice boundary. It **relies on** that spec’s read-stack: `ReadResolver` + `Relatable`, QueryService, owning-module-only `forFeature`, command-owned writes, non-eager TypeORM relations, no `CRUDResolver`. Booking is the **read-stack implementation reference**; its `PagingStrategies.NONE` is **explicitly not** the contract to replicate. [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) **§2.6** — this RFC **further amends** the persistence-metadata exception so a module’s TypeORM entity MAY declare a **unidirectional inverse collection** (`@OneToMany`) to another module’s entity when a GraphQL nested collection requires it. Application-layer writes, dashboard reads, and domain objects remain bound by the original §2.6 rule. |
| **Depends on (normative, list contracts)** | [Customers & Properties](2026-08-15-customers-properties-design.md) §4.5 — amends `customers: [Customer!]!`, `customerProperties: [Property!]!`, and nested `Customer.properties: [Property!]!` to connections; adds nested `Property.bookings`. [Cleaners & Teams](2026-08-16-cleaners-teams-design.md) — amends `cleaners` / `teams` / nested `Team.cleaners` to connections. [Catalog](2026-08-16-catalog-design.md) — amends `services` / `addOns` to connections; does **not** invent a `pricings` collection; `activePricing` stays a singleton. [Bookings](2026-08-22-bookings-design.md) §4.5 as already amended by #29 — further amends the many-query return type to `BookingConnection!`. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) — amends `jobs: [CleaningJob!]!` and nested `Checklist.items: [ChecklistItem!]!` to connections; **replaces** the Phase-1-unpaginated client-side `bookings`/`jobs` full-list join (§4.5 / §4.6) with a targeted server read. |
| **Depends on (informative)** | [Admin Foundation](2026-08-14-admin-foundation-design.md) — `AuthGuard`, `@Roles()`, audit consumed as-is. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) — list screens already have optional DataTable pagination; connection `totalCount` / `pageInfo` is how GraphQL feeds that. |
| **Followed by (informative)** | M4 implementation planning for #33. Quality (#7), Operations Dashboard (#8), and Payments (#10) remain independent product slices; when those specs exist they **MUST** inherit this RFC’s collection invariant. Admin GraphQL (`admins`) is a documented remaining exception until a later spec migrates it. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | First draft. Encodes the human-approved platform convention: every GraphQL collection is a nestjs-query `OffsetPaging` connection; default 20 / max 100 from one platform policy; inverse collection metadata in scope; Booking list is not excepted; inventory is the actual shipped domain (no `pricings`, no payments, no admins). Module migration **order** is intentionally absent — that is M4. |

## 1. Primary question & thesis

**Question:** Now that Booking GraphQL reads on nestjs-query 9.5.0 are proven, what is the **platform-wide** GraphQL contract for collection fields — including paging, nested collections, and the remaining modules — without turning writes into generic CRUD?

**Thesis:** Every GraphQL field that returns a collection MUST be a nestjs-query **offset-paginated connection**. That is a deliberate architectural amendment of #29, not a reinterpretation of #29 and not an M8 cleanup of already-specified code.

The canonical **read** architecture remains:

> **ReadResolver + Relatable → QueryService → owning-module `forFeature` only**

Writes remain Clensy commands/mutations. Domain objects still hold ids, never foreign entities. Inverse TypeORM collections are persistence metadata for nested GraphQL connections, not application-layer aggregate loading.

Booking is the implementation reference for that read stack. Booking’s shipped `PagingStrategies.NONE` / `[Booking!]!` many-query is the **defect this RFC removes**, not the pattern to copy.

## 2. Scope

### In scope (normative)

- Platform invariant: every GraphQL field returning a collection is exposed as a nestjs-query connection using **`OffsetPaging`** (not cursor, not `PagingStrategies.NONE`, not `[Entity!]!`).
- Central paging policy: **default 20**, **maximum 100**, defined once at platform level (not independently per module).
- Connection shape: `nodes`, `pageInfo` (`hasNextPage` / `hasPreviousPage`), and **`totalCount`** (computed only when the client selects it).
- Breaking change of Booking’s many-query: `bookings: [Booking!]!` → `BookingConnection!`, including `packages/client` operation documents and `/app/bookings`.
- Migration of the **existing** collection inventory in §4.2 onto the same read stack as Booking (#29), including nested collections.
- Unidirectional-inverse TypeORM collection metadata required by those nested connections (see §4.3). Owning-module-only `forFeature` / QueryService registration remains a hard gate (#29 §4.1 / §4.9#10).
- Replacement of Jobs UX that is correct **only** because `bookings` and `jobs` are unpaginated full lists (Jobs spec §4.5 / §4.6).
- Filter and sorting on collection queries, following the Booking #29 pattern (`filter`, `sorting`, plus `paging`).
- Schema allowlist discipline from #29: no generated create/update/delete, no relation mutations, no aggregations, no subscriptions.

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

## 3. Terminology

- **Collection field** — any GraphQL field whose value is a **list of objects** (root query or nested). Not a single object (`booking.customer`, `job.checklist`, `service.activePricing`, `cleaner.team`) and not a scalar/list-of-scalars.
- **Connection** — nestjs-query offset connection type (`{Entity}Connection`) with `nodes`, `pageInfo`, and `totalCount` as specified in §4.1.
- **Offset paging** — `paging: { limit, offset }` (`PagingStrategies.OFFSET`). Opposite of cursor connections and of `PagingStrategies.NONE` (bare array).
- **Platform paging policy** — the single pair (default limit **20**, max limit **100**) that every in-scope connection uses.
- **Read stack** — #29’s GraphQL-read architecture: composable `ReadResolver` + `Relatable`, TypeORM `QueryService`, owning-module `forFeature` only, Clensy mutations for writes.
- **Unidirectional inverse collection** — a TypeORM `@OneToMany` (or equivalent collection mapping) on the referenced entity, declared so nestjs-query can resolve a nested connection. It is persistence metadata. It MUST NOT appear on the domain object and MUST NOT be used by application services to load, save, or validate foreign aggregates.
- **Targeted read** — a GraphQL query that answers one existence or lookup question with a connection page (typically `paging: { limit: 1 }` plus a filter), as opposed to downloading an entire unpaginated list and joining it on the client.

## 4. Domain and behavioral contracts

### 4.1 Platform GraphQL collection contract

**Invariant (normative):**

> Every GraphQL field returning a collection MUST be exposed as a nestjs-query connection using `OffsetPaging`.

Representative root shape (names follow the entity; paging argument names follow 9.5.0 offset paging):

```graphql
bookings(
  filter: BookingFilter
  sorting: [BookingSort!]
  paging: OffsetPaging
): BookingConnection!
```

Representative nested shape:

```graphql
type Property {
  bookings(
    filter: BookingFilter
    sorting: [BookingSort!]
    paging: OffsetPaging
  ): BookingConnection!
}
```

**Connection type (normative intent; 9.5.0 OffsetConnection field names):**

```graphql
type BookingConnection {
  nodes: [Booking!]!
  pageInfo: OffsetPageInfo!
  totalCount: Int!
}

type OffsetPageInfo {
  hasNextPage: Boolean
  hasPreviousPage: Boolean
}
```

- Clients that previously selected `bookings { id … }` MUST select `bookings { nodes { id … } }` (and paging/pageInfo as needed).
- `totalCount` MUST be available on every in-scope connection so list UIs can page. It MUST NOT be computed unless the operation selects it.
- Omitted `paging` uses **limit 20, offset 0**.
- A requested `limit` greater than **100** MUST NOT return more than 100 nodes (library `maxResultsSize` cap). Implementations MUST NOT set max size to unlimited (`-1`).
- Default and maximum MUST come from **one platform source** (for example `platform/graphql`). Individual modules MUST NOT pick their own 10 / 50 / 200. Referencing the shared policy from a DTO decorator is allowed; hard-coding a different pair is not.
- nestjs-query’s **library default is cursor paging** and a **max of 50**. This RFC overrides both: **offset**, default **20**, max **100**.
- Filter and sorting remain enabled on the same basis as #29 (filterable scalars and relations). They are optional arguments with empty defaults.
- Many-to-one / one-to-one GraphQL fields stay objects, not connections (`booking.customer`, `job.booking`, `job.checklist`, `job.team`, `cleaner.team`, `service.activePricing`).

**Read-stack (relies on #29, not restated as a new invention):**

- Composable `ReadResolver` + `Relatable`. **Not** `CRUDResolver`. **Not** auto `resolvers: [{ DTOClass, EntityClass }]`.
- GraphQL list/get go through that module’s QueryService. Application `findOne` / `findAll` / `getXByIds` remain for REST, commands, and any non-GraphQL consumer.
- RBAC: `AuthGuard` + `@Roles(...)` on reads, same matrices as each module’s Accepted spec. nestjs-query authorizers are not a substitute.
- Schema proof remains an **allowlist**: existing Clensy mutations stay; generated CRUD/relation mutations MUST NOT appear.

### 4.2 Collection inventory (actual shipped API)

This is the complete in-scope set. A collection field is in this RFC if and only if it appears here (plus any nested collection this RFC **adds**, namely `Property.bookings`).

| GraphQL field | Today | This RFC |
| --- | --- | --- |
| `customers` | `[Customer!]!` | `CustomerConnection!` |
| `customer.properties` | `[Property!]!` | `PropertyConnection!` |
| `customerProperties(customerId: ID!)` | `[Property!]!` | `PropertyConnection!`, still **scoped to that customer** |
| `property.bookings` | *(absent)* | `BookingConnection!` (**new** nested field) |
| `cleaners` | `[Cleaner!]!` | `CleanerConnection!` |
| `teams` | `[Team!]!` | `TeamConnection!` |
| `team.cleaners` | `[Cleaner!]!` | `CleanerConnection!` |
| `services` | `[Service!]!` | `ServiceConnection!` |
| `addOns` | `[AddOn!]!` | `AddOnConnection!` |
| `jobs` | `[CleaningJob!]!` | `CleaningJobConnection!` |
| `checklist.items` | `[ChecklistItem!]!` | `ChecklistItemConnection!` |
| `bookings` | `[Booking!]!` (`PagingStrategies.NONE`) | `BookingConnection!` |

**Not collections (unchanged kind):** `customer`, `property`, `cleaner`, `team`, `service`, `activePricing`, `addOn` if present, `job`, `booking`, `job.booking`, `job.team`, `job.checklist`, `booking.customer|property|service|team`, `cleaner.team`, `currentAdmin`.

**`customerProperties` product contract:** keep the **name** and the rule that results are one customer’s properties only. Do **not** add an unscoped root `properties`. If 9.5.0 `ReadResolver` many-query cannot take a required `customerId` argument, M4 may implement the same name by forcing a customer filter on Property QueryService. An unscoped Property many-query is a spec defect.

**`checklist.items`:** still a connection even though current checklists are created with three items. Clients that need every item (Jobs checklist progress) MUST page until exhausted or request a limit that covers the set (20 covers today’s size). They MUST NOT assume an unpaginated array.

**Single-id queries** keep their existing nullability (`booking(id): Booking!` per #29; `job(id): CleaningJob` nullable per Jobs; etc.). This RFC does not reopen those decisions.

### 4.3 Inverse persistence metadata (amends #29 §4.1 / Phase 1 §2.6)

#29 allowed unidirectional `@ManyToOne` on the **referencing** entity and forbade inverse collections. Nested connections require the inverse **collection** mapping on the parent entity.

**Amended persistence-metadata rule (GraphQL reads):**

> A module’s TypeORM **entity** MAY declare a unidirectional inverse collection to another module’s TypeORM **entity** when a GraphQL nested connection needs it. That import is persistence metadata only. It MUST NOT be used to load, save, or validate foreign aggregates from the application layer. Owning modules remain the only registrants of their entities on `TypeOrmModule.forFeature` / `NestjsQueryTypeOrmModule.forFeature`. Domain objects still hold ids, never foreign collections.

Required inverses for §4.2 (normative intent, not decorator spelling):

| Parent entity | Collection | Child |
| --- | --- | --- |
| `CustomerEntity` | `properties` | `PropertyEntity` |
| `PropertyEntity` | `bookings` | `BookingEntity` |
| `TeamEntity` | `cleaners` | `CleanerEntity` |
| `ChecklistEntity` | `items` | `ChecklistItemEntity` |

Existing #29 many-to-ones on `BookingEntity` stay. `Property.bookings` is the inverse of `BookingEntity.property`. Do **not** add `Customer.bookings` / `Team.bookings` / `Service.bookings` in this RFC.

**Loading:** collections MUST NOT be eagerly loaded. nestjs-query MUST batch nested connection fetches. Query count for nested collections MUST be **O(1) in parent count** (same bar as #29 §4.8: SQL/query count, not spies on deleted loaders).

**DI / `forFeature` (hard gate, unchanged spirit):** the module that **owns** the child entity owns that entity’s QueryService. A parent module MUST NOT `forFeature` the child entity merely so Relatable can resolve the nested connection. If 9.5.0 fundamentally requires the parent module to own the child’s QueryService, **return this spec** — do not “make DI work” by violating the gate. Importing a module that already exported the child’s QueryService is not the same as re-registering it.

Non-eager (`eager: false`). No cascade persist/delete on these collections unless an already-Accepted spec says otherwise. Existing FK names and `ON DELETE` behavior stay.

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
- “Does this booking already have a job?” and “Create job vs View job” MUST use a **targeted read** (connection + filter + `limit: 1`, or an equivalent filterable inverse). They MUST NOT download every job.
- “Omit bookings that already have a job” in the create-job picker MUST use a server-side filter (for example bookings with no related job) or, if 9.5.0 cannot express that filter, degrade to showing bookings and relying on the already-specified uniqueness `ConflictException`. Inventing a new root `jobByBookingId` is allowed **only** if the connection/filter model cannot express existence; it is not the default.
- Server uniqueness of one job per booking remains authoritative (Jobs spec).

Checklist progress that today derives from `checklist.items` in one unpaginated array MUST read `checklist.items.nodes` (paging until complete if a future checklist can exceed one page).

### 4.6 Remaining unpaginated collections (explicit exceptions)

After this RFC is implemented, the shipped schema MAY still contain:

- `admins: [Admin!]!` — **deferred** (out of scope). A later Admin spec MUST paginate it when that API is next redesigned. This RFC MUST NOT add other new unpaginated collections.
- Collections that do not exist yet (Quality, Payments, Dashboard GraphQL). Their future specs MUST use §4.1.

`admins` is **not** permission to leave `customers` or `jobs` as arrays.

### 4.7 What Booking is a reference for — and what it is not

**Copy from Booking (#29):** `ReadResolver` + `Relatable`; QueryService; `forFeature` only the owning entity; dual UUID column + `@ManyToOne` where a many-to-one GraphQL field exists; Clensy mutation resolver; schema allowlist tests; O(1) SQL proof for relations.

**Do not copy from Booking as shipped:** `@QueryOptions({ pagingStrategy: PagingStrategies.NONE })`, many-query return type `[Booking!]!`, any assumption that existing `query { bookings { id } }` documents stay valid without selecting `nodes`.

This RFC **changes Booking** to match §4.1. There is no Booking exception.

## 5. Goals and non-goals

**Goals**

- One GraphQL collection contract across the inventory in §4.2, including nested fields.
- Bounded list queries (default 20, hard max 100) from one platform policy.
- Preserve #29’s DDD/write/RBAC/audit/REST split while extending the read stack off Booking.
- Make the Jobs “full list join” dependency impossible to ship accidentally.

**Non-goals**

- Per-module paging numbers or unpaginated “small table” exceptions inside §4.2.
- Migrating Admin, Quality, Dashboard, or Payments in this RFC.
- Inventing catalog `pricings` or a global `properties` / `checklists` root query.
- Turning mutations into nestjs-query CRUD.
- Paging REST or application-layer list methods.
- A shared entity package / persistence kernel.
- Implementation task order, TDD plan, or code (M4–M6).

## 6. Invariants and boundaries

1. **MUST** expose every §4.2 collection field as an offset connection; **MUST NOT** ship `[Entity!]!` for those fields.
2. **MUST** use default limit 20 and max 100 from one platform source; **MUST NOT** set unlimited max.
3. **MUST** break Booking’s many-query to `BookingConnection!` and update client + `/app/bookings` in the same delivery as that schema change.
4. **MUST** keep writes on Clensy mutations; **MUST NOT** enable generated CRUD or relation mutations.
5. **MUST NOT** register foreign QueryServices/`forFeature` solely for DI; violation is a spec-return, not a workaround.
6. **MUST NOT** put inverse collections on domain objects or use them from application writes.
7. **MUST** keep nested collection loading O(1) in parent N (SQL/query count).
8. **MUST NOT** implement Jobs “already has a job” UX by scanning two full lists.
9. **MUST NOT** add `property.bookings` as `[Booking!]!`.
10. **MUST NOT** start Quality (#7), Dashboard (#8), or Payments (#10) under this RFC.

## 7. Rationale

- **Why amend #29 instead of reinterpreting it.** #29 Accepted “no paging” and “Booking-only” as explicit non-goals. Silently paging Booking or migrating other modules under that issue would be an architecture change without review. This RFC is the reviewable amendment.
- **Why one RFC rather than one spec per module.** The decision to lock is the **invariant and paging policy**. Re-opening paging in nine M2s would produce nine interpretations. Module **order** is M4 inside this issue; Quality/Dashboard/Payments still get their own product specs later, bound by this invariant.
- **Why offset, not cursor.** The approved contract is `limit`/`offset`. List UIs and DataTable pagination map to offset. Cursor remains available in the library and stays out of scope.
- **Why break Booking.** An unpaginated Booking exception would be the highest-volume collection and would teach every later module the wrong shape. Additive `filter`/`sorting` was #29; `nodes` is not additive — it must be specified and clients updated.
- **Why inverse collections now.** Nested `customer.properties` / `team.cleaners` / `checklist.items` / `property.bookings` cannot be honest connections on UUID-only parents without collection metadata (same N+1 lesson as #29’s many-to-ones). Restricting inverses to the §4.3 table avoids a bidirectional graph for unused paths (`customer.bookings`).
- **Why 20 / 100.** Human-approved. Library defaults (cursor, max 50) are the wrong product numbers; they MUST be overridden centrally so a DTO cannot quietly ship max 50 or unlimited.
- **Why `totalCount`.** Dashboard UX already models optional table pagination. Without selectable `totalCount`, page controls guess.
- **Why keep `customerProperties` rather than a global `properties`.** That is the shipped product API and the Customers spec’s standalone query. An unscoped Property list is a new collection, not a rename.
- **Why exclude admins and payments.** Admin is a platform identity API, not a domain collection in the migration list. Payments have no spec. The invariant still forbids **new** unpaginated domain collections.
- **Why not page REST.** Phase 1 REST is a preserved comparison artifact (#29). Paging it is a different contract.
- **Why Jobs targeted reads are in this RFC.** Jobs already documented that its UX is Phase-1-unpaginated-only. Shipping paginated `jobs`/`bookings` without replacing that join would be a known product break.

## 8. Acceptance criteria (for this specification)

This document may move from Draft to Accepted after M3 when the reviewer confirms:

- The primary decision is an **amendment** of #29 (paging + inverses + inventory), not a silent reread of #29 and not M8.
- §4.1 invariant + OffsetPaging + 20/100 central policy are the intended platform contract; cursor and `PagingStrategies.NONE` stay out.
- Booking many-query **must** become `BookingConnection!`; client and `/app/bookings` are in the same RFC; no Booking exception.
- §4.2 inventory matches the shipped domain (includes `addOns` and `customerProperties`; excludes `pricings`, payments, `admins`; adds `property.bookings`; does not add root `properties` / `checklists`).
- Inverse collections in §4.3 are persistence metadata only; `forFeature` hard gate is unchanged in spirit.
- Jobs full-list client join is replaced by the §4.5 targeted-read contract.
- Writes, REST, application list methods, Quality, Dashboard, and Payments remain out of implementation permission.
- Module **sequencing** is correctly absent (M4). Open questions in §9 are either decided here or explicitly left to M4 without blocking the rest.

## 9. Risks and open decisions

| Item | Status in this draft |
| --- | --- |
| 9.5.0 API for **one** platform default/max (module `forRoot` vs shared constant referenced by `@QueryOptions`) | **M4**. Product numbers are locked (20 / 100). Scattering different numbers is a defect. |
| `customerProperties` as required `customerId` argument vs forced filter on a Property many-query **under the same field name** | **M4 mechanism**. Unscoped `properties` root is **forbidden**. |
| Parent module importing child’s exported QueryService vs Relatable resolving nested connections from DataSource metadata alone | **M4**, subject to the §4.3 hard gate. Foreign `forFeature` to “make DI work” is a spec-return. |
| Filter shape for “bookings with no job” / job existence | **M4 against 9.5.0**. Product: targeted read or uniqueness-error fallback; never full-list join. `jobByBookingId` only if filter cannot express existence. |
| `FilterableOffsetConnection` vs `OffsetConnection` on nested fields | **M4**. Nested fields MUST be offset connections; filter-on-relation is preferred when 9.5.0 supports it without generated write mutations. |
| `enableTotalCount` cost on large tables | Accepted: only when selected. Phase 1 volumes are small; max page is 100. |
| Checklist of three items still using a connection | Accepted: invariant over special-casing small collections. |
| `admins` remaining as `[Admin!]!` | Accepted deferral. Not a template for new fields. |
| Codegen churn (`*Connection`, `OffsetPaging`, unused filter types) | Accepted; existing array selections **will not** keep compiling. |
| Dual many-to-one (#29) plus inverse `@OneToMany` on the same FK pair | **M4 must verify** on TypeORM 1.1.x. Preserve existing FK names. If illegal, return to M2/M3 — do not invent a third persistence model. |

## 10. Traceability

| Upstream | This document |
| --- | --- |
| nestjs-query GraphQL Reads (#29) §4.6–4.9 read stack, allowlist, `forFeature` gate, O(1) SQL bar | **Relies on.** |
| #29 §2 / §4.5 / §7 paging `NONE`, `[Booking!]!`, “why not paging yet” | **Amends** (offset connections; Booking included). |
| #29 inverse collections out of scope | **Amends** for the §4.3 table only. |
| #29 Booking-only proving slice / “new spec each” | **Amends** the proving-slice boundary: this RFC **is** the follow-on, as one convention RFC rather than N copies of paging. |
| Phase 1 Design §2.6 | **Amends** (inverse collection metadata for GraphQL nested connections). Application/dashboard/domain rules unchanged. |
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
      nodes { id addressLine1 }
    }
  }
}
```
