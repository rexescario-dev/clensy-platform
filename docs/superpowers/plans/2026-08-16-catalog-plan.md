# Catalog: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Date** | 2026-08-16 |
| **Tracking** | [#4](https://github.com/rexescario-dev/clensy-platform/issues/4) (milestone M4 — Catalog) |
| **Package/repo scope** | `apps/api` (new: `modules/catalog`; modified: `app/app.module.ts`, `platform/database/data-source.ts`); `apps/web` (new: `/catalog`, `/catalog/[id]`, `/catalog/add-ons`, `/catalog/add-ons/[id]`; modified: `middleware.ts`); `packages/client` (new operation documents + regenerated codegen output) |
| **Depends on (Accepted)** | [Catalog Specification](../specs/2026-08-16-catalog-design.md) — Status: Accepted, 2026-08-16. Also relies on the already-Accepted [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) and [Cleaners & Teams](../specs/2026-08-16-cleaners-teams-design.md) specs/plans for `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`/`runAuditInTransaction`, the `manager.update()`-over-`save()` pattern, the `23505`→`ConflictException` translation, the request-scoped `DataLoader` batching mechanism (and its already-approved `dataloader` npm dependency — no new dependency is introduced by this plan), and the `apps/web` bootstrap (Next.js, Apollo Client, `packages/ui`) they already shipped — none of that is re-implemented here. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |
| **Revision note** | None — initial draft. |
| **M5 decision** | Pending. |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement exactly what the Accepted specification authorizes: `modules/catalog` (`Service`, `AddOn`, `PricingRule` domain objects; `ServicesService`/`AddOnsService`/`PricingRulesService` application layer; TypeORM infrastructure; GraphQL presentation per spec §4.5), gated by `AuthGuard`/`@Roles()` per spec §4.3, audit-logged per spec §4.4, and the `apps/web` `/catalog`, `/catalog/[id]`, `/catalog/add-ons`, `/catalog/add-ons/[id]` screens per spec §4.6. Not a redesign of any of it — every behavioral decision below traces to the Accepted spec or is called out explicitly as an M4 implementation choice the spec deliberately left open.

## 2. Constraints (SHALL / SHALL NOT)

Not every constraint below is a verbatim restatement of the spec — some are M4 clarification decisions the spec deliberately left open (exact exception types, the batching mechanism, the expression-index migration shape). Each is cited to a spec section where the *behavior* is normative; where the citation says "implements §X," the specific mechanism is this plan's choice, not the spec's. §3 collects the M4-only decisions separately for anything not directly traceable this way.

**SHALL** (traced to spec section):
- `Service` domain object has no `priceMinorUnits` field; price lives exclusively on `PricingRule` (§4.1).
- `PricingRule` domain object has no `updatedAt` field — `createdAt` only. Its `serviceId`, `priceMinorUnits`, and `createdAt` are never mutated after creation; its `active` flag is the only field that ever changes post-creation, and only via a later `CreatePricingRule` call's internal deactivate step, never a direct mutation (§4.1).
- `id`, `createdAt` (and `updatedAt` where present) on all three entities are server-generated and never accepted as client input on any mutation (§4.1).
- `Service.active`/`AddOn.active` mean "not administratively retired," not "available for booking." `ListServices`/`ListAddOns`/`GetService` return both active and inactive rows unconditionally — no `activeOnly` argument, no separate "available" query (§4.1, §2).
- `updateService`/`updateAddOn` use **partial-update semantics**: omitted input fields retain their current value; provided fields are applied; the resulting full entity state is revalidated against §4.7's invariants (§4.2, §4.7).
- `getService(id)` returns `null` when `id` does not exist; `updateService`/`updateAddOn` throw `NotFoundException` when their target `id` does not exist; `createPricingRule`/`getActivePricing` throw `NotFoundException` when `serviceId` does not reference an existing `Service` (§4.2).
- `getActivePricing(serviceId)` returns `null` (not an error) when the service exists but has never had a `PricingRule` created for it (§4.2).
- `Service.name` and `AddOn.name` MUST be unique **case-insensitively**, with input trimmed before validation and comparison (§4.7). `AddOn.priceMinorUnits` and `PricingRule.priceMinorUnits` MUST be positive integers (`> 0`); `Service.durationMinutes` MUST be a positive integer (`> 0`) (§4.7).
- At most one `PricingRule` per `serviceId` may have `active = true` at any time, enforced by a database-level partial unique index — the actual serialization authority under concurrent `createPricingRule` calls, not the application transaction's isolation level (§4.2, §4.7).
- `createPricingRule` deactivates the previously active `PricingRule` for the same `serviceId` (if any) and inserts a new active one, within one transaction; exactly one audit event (`pricing_rule.create`) is logged per call — the deactivation of the prior rule is not independently audited (§4.2, §4.4).
- Every operation requires `AuthGuard`; no operation in this module is public (§4.3).
- `@Roles()` per the matrix in spec §4.3: Owner/Ops Manager may create/update services, create/update add-ons, and create pricing rules; Owner/Ops Manager/Scheduler/Customer Support/Finance/Analyst may view (get/list/activePricing) — all six roles.
- Each successful mutation (`createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`) produces exactly one audit event, persisted in the same database transaction as its state change, using the existing `runAuditInTransaction` mechanism from `platform/audit` (§4.4, inherited from Admin Foundation spec §4.6). No new audit failure behavior, retry logic, or async delivery is introduced. A mutation that does not reach a successful state change produces **no** audit event; state change and audit event commit atomically, or neither happens.
- Audit `action`/`entityType` values are exactly: `service.create`/`service`, `service.update`/`service`, `add_on.create`/`add_on`, `add_on.update`/`add_on`, `pricing_rule.create`/`pricing_rule` (§4.4).
- GraphQL surface is exactly: `service`, `services`, `addOns`, `activePricing`, `createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule` — no others (§4.5). `Service.activePricing` is a GraphQL-only computed field.
- `createPricingRule` takes a single `input: CreatePricingRuleInput!` argument (`serviceId: ID!`, `priceMinorUnits: Int!`), not positional arguments (§4.5).
- `Service.activePricing` (a computed field resolved over a list of `Service`s) MUST NOT resolve via one database query per parent row (§4.5) — see §3 for the concrete batching mechanism.
- GraphQL object types are explicitly-defined presentation types, not domain interfaces or TypeORM entities used directly (matches the Admin Foundation/Customers/Cleaners precedent this spec inherits).
- `priceMinorUnits` is exposed as a raw `Int!` on the `AddOn`/`PricingRule` GraphQL types; no currency formatting or `currency` field exists anywhere in this surface (§4.5, §2).
- `/catalog` and `/catalog/:path*` are added to `apps/web/middleware.ts`'s route-group matcher, using the same cookie-presence-only UX-hint check already in place for `/admin`/`/customers`/`/cleaners` — no new auth mechanism (§4.6).
- One e2e covers create service → attach pricing → list active catalog, per spec §2/Phase 1 Design §5, plus a concurrency test for simultaneous `createPricingRule` calls against the same `serviceId` (§2, §4.7 — added to the Accepted spec's Tests scope in M3 round 1).

**SHALL NOT** (explicit spec/design non-goals — do not invent):
- No delete operation for `Service`, `AddOn`, or `PricingRule` (spec §2).
- No price-history query (e.g. `pricingHistory(serviceId)`) — inactive `PricingRule` rows are retained but not queryable in this slice (spec §2).
- No service-to-`AddOn` attachment or compatibility rules — `AddOn` is global (spec §2, §5).
- No tiered, date-effective, property-size-based, or formula-driven pricing — `PricingRule.priceMinorUnits` is a single flat amount per service (spec §2).
- No change to `modules/bookings` (spec §2, §7).
- No currency field, multi-currency support, or currency formatting/localization anywhere in the API layer (spec §2, §5, §7).
- No search, filtering, sorting, or pagination beyond a full-set list (spec §2).
- No REST surface for this module (spec §2, §5).
- No redesign of any Admin Foundation or Cleaners & Teams spec contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, the `manager.update()`/N+1/unique-violation-translation patterns) (spec §7).
- No renaming of `PricingRule` — considered and explicitly declined at M3 (spec §5, §7).

## 3. Implementation decisions (M4 choices)

The specification leaves these implementation details open; this plan fixes them for M6 execution so no implementer has to choose alone:

- **No TypeORM relation decorator anywhere for `PricingRule.serviceId`.** The column is a plain `@Column({ type: 'uuid' }) @Index()`, and the foreign key constraint (`REFERENCES service_entity(id) ON DELETE RESTRICT`) is added directly in the migration's raw SQL, not via `@ManyToOne` — the identical mechanism the Cleaners & Teams plan used for `Cleaner.teamId`, applied here for the identical reason (spec §4.1's no-ORM-relation precedent). `PricingRulesService` queries by `serviceId` directly, never through a relation.
- **`Service.name`/`AddOn.name` case-insensitive uniqueness is enforced by a hand-added expression unique index, not a TypeORM `@Column({ unique: true })`.** `ServiceEntity.name`/`AddOnEntity.name` carry no `unique` option at all — a plain `@Column()` — because TypeORM's decorator can only express a plain column-level (case-sensitive) unique constraint, and declaring one here would fight with the hand-added `CREATE UNIQUE INDEX ... ON <table> (LOWER("name"))` this plan adds directly to each entity's migration. This mirrors the FK-hand-add precedent above: the index is invisible to TypeORM's own schema diffing, so a later `pnpm migration:generate` run will not attempt to drop or regenerate it, the same non-drift guarantee the Cleaners & Teams plan's FK hand-adds already established.
- **Case-insensitive uniqueness is enforced by two mechanisms together, not the database index alone**, per spec §4.7's explicit statement that the application layer performs its own case-insensitive check before insert/update: a private helper, `assertNameAvailable(manager, name, excludeId?)`, runs `manager.getRepository(ServiceEntity).createQueryBuilder('s').where('LOWER(s.name) = LOWER(:name)', { name }).andWhere('s.id != :excludeId', { excludeId: excludeId ?? NIL_UUID })...getOne()` (or the `AddOn` equivalent) and throws `ConflictException` immediately if a match is found, before ever attempting the write. The subsequent `manager.save()`/`manager.update()` call is still wrapped in a `try/catch` translating a Postgres `23505` to the same `ConflictException` — the pre-check makes the common case a clean, early exit; the catch-and-translate handles the narrow race window between the pre-check and the write, where the database's expression index is the actual authority (spec §4.2, §4.7). `excludeId` is omitted (no exclusion) on create and set to the target row's own `id` on update, so renaming a row to a name that only collides with its own current value is correctly treated as no collision.
- **`ServicesService`/`AddOnsService`/`PricingRulesService` follow the `CleanersService`/`TeamsService` transaction/audit pattern exactly** — the transaction wrapper and the audit call within it, together:
  ```ts
  async createService(command: CreateServiceCommand): Promise<Service> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const name = command.name.trim();
        await this.assertNameAvailable(manager, name);
        const entity = manager.create(ServiceEntity, {
          name,
          description: command.description ?? null,
          durationMinutes: command.durationMinutes,
          active: true,
        });
        this.assertValid(entity);
        try {
          await manager.save(entity);
        } catch (error) {
          if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
            throw new ConflictException('Service name is already in use');
          }
          throw error;
        }
        await this.auditLogger.log({ actorId: command.actorId, action: 'service.create', entityType: 'service', entityId: entity.id });
        return entity;
      }),
    );
  }
  ```
  `updateService`/`updateAddOn` follow `updateCleaner`'s exact pattern from the Cleaners plan: destructure `actorId` out of the command, trim a provided `name`, validate the merged resulting state via `assertValid({ ...entity, ...changes })` *before* persisting, call `assertNameAvailable(manager, changes.name, id)` only when `name` was actually provided, then `manager.update(Entity, { id }, { ...changes, updatedAt: new Date() })` — never `Object.assign(entity, changes)` + `manager.save(entity)` — for the identical reason established there: `save()`'s change-diffing risks a no-op `UPDATE` (and therefore no `updatedAt` bump) on a call that resubmits already-current values, which would silently violate spec §4.2's unconditional-`updatedAt`/audit guarantee. Reads (`getService`, `listServices`, `listAddOns`, and `PricingRulesService.getActivePricing`'s existence check) use plain injected `Repository`s — no transaction needed.
- **`createPricingRule`'s deactivate-then-insert, with the concurrency-safety net spelled out in code, not left to a comment alone:**
  ```ts
  async createPricingRule(command: CreatePricingRuleCommand): Promise<PricingRule> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const service = await manager.findOneBy(ServiceEntity, { id: command.serviceId });
        if (!service) {
          throw new NotFoundException(`Service ${command.serviceId} not found`);
        }
        this.assertValid({ priceMinorUnits: command.priceMinorUnits });

        await manager.update(
          PricingRuleEntity,
          { serviceId: command.serviceId, active: true },
          { active: false },
        );

        const entity = manager.create(PricingRuleEntity, {
          serviceId: command.serviceId,
          priceMinorUnits: command.priceMinorUnits,
          active: true,
        });
        try {
          await manager.save(entity);
        } catch (error) {
          if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
            throw new ConflictException('Pricing for this service was just updated — please retry');
          }
          throw error;
        }

        await this.auditLogger.log({ actorId: command.actorId, action: 'pricing_rule.create', entityType: 'pricing_rule', entityId: entity.id });
        return entity;
      }),
    );
  }
  ```
  The `manager.update(...)` deactivate step is unconditional and diff-independent (it is a bulk predicate update, not an entity `save()`, so TypeORM's change-diffing does not apply to it at all — it always issues the `UPDATE`, affecting 0 rows when nothing was active). The `try/catch` around the insert is what actually implements spec §4.2's concurrency guarantee: under the partial unique index (§4.7 below), only one of two concurrent calls' inserts can succeed; the loser's insert throws `23505`, caught here and translated.
- **Reconciling spec §4.2's "single application-layer entry point" language with §4.5's N+1 invariant, via a bulk sibling method — the identical pattern the Cleaners & Teams plan used for `TeamsService.getTeam`/`getTeamsByIds`.** Spec §4.2 states that both the standalone `activePricing(serviceId)` query and the `Service.activePricing` computed field "resolve through this same method" (`getActivePricing`), meaning: neither path reimplements the "what is this service's active price" business rule independently — not that both paths must literally issue one call per service. The standalone query (always resolving from a single, client-supplied `serviceId`, and needing the `NotFoundException`-on-missing-service check) calls `PricingRulesService.getActivePricing(serviceId)` directly. The computed field (always resolving from an already-fetched, already-valid list of `Service`s, needing no existence check) is backed by a new bulk method, `PricingRulesService.getActivePricingForServiceIds(serviceIds: string[]): Promise<PricingRule[]>` → `Repository<PricingRuleEntity>.findBy({ serviceId: In(serviceIds), active: true })`, wired into a request-scoped `ActivePricingLoader` (§3 below, Task 4). Both methods query the same table with the same `active = true` filter — there is one business rule, expressed as a single-key and a bulk-key variant of the same underlying condition, not two independently-derived implementations. This is the same shape as the Cleaners plan's `getTeam`/`getTeamsByIds` split, applied here for the identical reason.
- **`PricingRuleType` (the GraphQL object type) does not expose an `active` field.** `PricingRule` the *domain object* has `active` (§4.1 — it drives the internal deactivate-then-insert logic), but every `PricingRule` reachable through this module's GraphQL surface (`activePricing(serviceId)`, `Service.activePricing`) is, by construction, always the currently active one — there is no price-history query in this slice (spec §2) through which an inactive `PricingRule` could ever be returned. Exposing an `active: Boolean!` field that is definitionally always `true` for every value the API can currently produce would be dead information, the same category of mistake the M3 review caught in the original `AddOn` design (a field with no present purpose). `PricingRuleType` exposes `id`, `serviceId`, `priceMinorUnits`, `createdAt` only. Revisit this exclusion if/when a price-history query is ever added.
- **`Cleaner`/`Team`'s existing `dataloader` dependency and request-scoped-provider pattern are reused verbatim for `ActivePricingLoader` — no new npm dependency.** `apps/api/package.json` already carries `dataloader ^2.2.3` (approved at the Cleaners & Teams M5). `ActivePricingLoader` (`apps/api/src/modules/catalog/presentation/graphql/active-pricing.loader.ts`) is `@Injectable({ scope: Scope.REQUEST })`, constructed fresh per GraphQL request, holding one `DataLoader<string, PricingRule | null>` whose batch function calls `getActivePricingForServiceIds` and re-maps results into the loader's required same-length/same-order response (missing keys → `null`), the same shape as `CleanerTeamLoaders`' `teamLoader`.
- **Uniqueness/validation error messages**: `ConflictException('Service name is already in use')`, `ConflictException('Add-on name is already in use')`, `ConflictException('Pricing for this service was just updated — please retry')` — matching the exact strings the Accepted spec's prose already uses (§4.2, §4.7), so implementation and specification stay in sync verbatim rather than drifting into a paraphrase.
- **`ServicesService.assertValid`/`AddOnsService.assertValid`/`PricingRulesService.assertValid` live in the application service, not the domain layer and not GraphQL alone** — identical pattern and rationale to `CleanersService.assertValid`. Each throws `BadRequestException` for its own object's invariants (§4.7): `Service` — `name` non-empty after `.trim()`, `durationMinutes` a positive integer; `AddOn` — `name` non-empty after `.trim()`, `priceMinorUnits` a positive integer; `PricingRule` — `priceMinorUnits` a positive integer. Always called against the entity's full resulting state, always *before* `manager.save()`/`manager.update()`.
- **Three migrations, ordered by FK dependency — `AddService` (Task 1), `AddAddOn` (Task 2, independent of Task 1), `AddPricingRule` (Task 3, adds the FK to the already-existing `service_entity` table).** `AddAddOn` has no ordering dependency on `AddService` (no FK between them) and could in principle run before it, but this plan sequences it second anyway to keep task numbering aligned with the slice sequence in §6 — the migrations themselves carry no cross-dependency beyond `AddPricingRule`'s FK to `service_entity`.
- **No new environment variables or secrets** — this slice introduces no new configuration surface.

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/modules/catalog/**` (new) | `apps/api/src/modules/bookings/**`, `apps/api/src/modules/customers/**`, `apps/api/src/modules/cleaners/**` |
| `apps/api/src/app/app.module.ts` (composition root — registers `CatalogModule`) | `apps/api/src/platform/auth/**`, `apps/api/src/platform/audit/**`, `apps/api/src/platform/graphql/**` (consumed read-only, not modified — the batching loader lives entirely inside `modules/catalog`, §3) |
| `apps/api/src/platform/database/data-source.ts` (add new entities) | `apps/api/src/modules/admins/**` |
| `apps/web/app/catalog/**` (new) | `apps/web/app/admin/**`, `apps/web/app/customers/**`, `apps/web/app/cleaners/**`, `apps/web/app/login/**` |
| `apps/web/middleware.ts` (extend `matcher` only) | Everything else in `apps/web/middleware.ts` |
| `packages/client/src/operations/services.graphql`, `add-ons.graphql` (new), regenerated `src/generated/graphql.ts` | `packages/client/src/apollo-client.ts`, existing operation documents |
| — | `apps/api/package.json` — no new dependency (§3); `packages/ui/**` consumed as-is; no new primitives needed — `Button`, `DataTable`, `FormField` cover this slice's UI |

## 5. Contract inventory (only what the Accepted spec authorizes)

- `Service { id, name, description, durationMinutes, active, createdAt, updatedAt }` (`modules/catalog/domain`)
- `AddOn { id, name, description, priceMinorUnits, active, createdAt, updatedAt }` (`modules/catalog/domain`)
- `PricingRule { id, serviceId, priceMinorUnits, active, createdAt }` (`modules/catalog/domain` — no `updatedAt`, §4.1)
- `ServiceType { id, name, description, durationMinutes, active, activePricing, createdAt, updatedAt }` (GraphQL — `activePricing` is a computed field, not a domain field) / `AddOnType { id, name, description, priceMinorUnits, active, createdAt, updatedAt }` / `PricingRuleType { id, serviceId, priceMinorUnits, createdAt }` (GraphQL — **no `active`**; see §3)
- GraphQL: `service(id)`, `services`, `addOns`, `activePricing(serviceId)`, `createService(input)`, `updateService(id, input)`, `createAddOn(input)`, `updateAddOn(id, input)`, `createPricingRule(input)` (spec §4.5) — exactly these 9 operations, no others. `Service.activePricing` is a computed GraphQL field.

Exact internal service/command/file names beyond the above are implementation detail decided per-task below; the spec does not freeze them further and this plan does not either.

## 6. Slice sequence

```text
1. Service      — domain, infrastructure, application, migration        (independent)
2. AddOn        — domain, infrastructure, application, migration        (independent)
3. PricingRule  — domain, infrastructure, application, migration        (depends on 1 — FK to service_entity)
4. GraphQL presentation — ServiceResolver, AddOnResolver,
   PricingRuleResolver, ActivePricingLoader                              (depends on 1 + 2 + 3)
5. apps/api composition root — register CatalogModule                    (depends on 4)
6. packages/client operations + apps/web /catalog screens                 (depends on 5)
7. E2E acceptance                                                          (depends on 1-6)
```

Each numbered task below is an independently reviewable slice. Task 5 is a thin regression-check task, matching the Cleaners & Teams plan's Task 4 precedent — `CatalogModule` needs only a single `imports` addition to `AppModule`, no bespoke cross-module binding.

## 7. TDD / verification strategy

Three test levels, matching the levels every prior slice converged on:

1. **Mocked unit tests** (Jest, `cleaners.service.spec.ts`'s mocked-`Repository`/`Test.createTestingModule` pattern) for logic that doesn't depend on real transactional behavior: `ServicesService`/`AddOnsService`/`PricingRulesService`'s not-found errors, `getX`/`listX` read paths, each `assertValid`'s rejection of invalid fields, and `ActivePricingLoader`'s batch function's grouping/ordering logic in isolation (mocked bulk-fetch method, asserting the loader returns results in the same order/length as the input keys, with `null` for services never priced). A mocked `DataSource`/`EntityManager` cannot prove a real rollback, a real unique-constraint violation, or a real concurrent-transaction race — this level does not attempt any of those.
2. **Real-Postgres service-level tests** (mirroring `apps/api/test/cleaners-teams.service.e2e-spec.ts` exactly: a real `DataSource` against the same local Postgres, services instantiated directly, only `auditLogger` faked) for: the transactional-audit rollback guarantee; the partial-update/explicit-vs-omitted behavior against real persisted rows; the real `23505` → `ConflictException` translation for `Service.name`/`AddOn.name` (case-insensitive) and for `PricingRule`'s partial unique index (a mock cannot produce a real unique-constraint violation); the deactivate-then-insert sequence actually leaving exactly one active `PricingRule` row after a repricing; and — the concurrency test added to the Accepted spec's Tests scope at M3 round 1 — two simultaneous `createPricingRule` calls for the same `serviceId` (`Promise.allSettled([...])`) resulting in exactly one fulfilled, one rejected with `ConflictException`, and exactly one active `PricingRule` row remaining on re-query. This last case is the one assertion in this plan that a mocked unit test structurally cannot produce, since it depends on the database's own index-conflict behavior under two real, concurrently-committing transactions (§3).
3. **Integration/e2e** (Jest + Supertest against a real Postgres via `AppModule`, mirroring `cleaners-teams.e2e-spec.ts`): the full GraphQL-request-to-database golden path in spec §2 (create service → attach pricing → list active catalog), RBAC-allowed/denied cases per the §4.3 matrix, and — distinct from the functional correctness above — a **query-count** proof of the `Service.activePricing` N+1 batching invariant (§3's `ActivePricingLoader` mechanism), because functional correctness alone cannot distinguish a correctly batched implementation from an N+1 one that happens to return the right data. That test `jest.spyOn`s the real `PricingRulesService.getActivePricingForServiceIds` instance resolved from the running `AppModule` (`app.get(PricingRulesService)`) and asserts the bulk method is called **exactly once** per GraphQL request, regardless of how many services the request resolves. See Task 7.

Level 2 truncates (`.clear()`s or `TRUNCATE`s) `pricing_rule_entity`, `add_on_entity`, `service_entity` in `beforeEach` (in that FK-respecting order, once `pricing_rule_entity` exists — Task 3 extends the shared `beforeEach` the same way the Cleaners plan's Task 2 combined `TRUNCATE` did for `cleaner_entity`/`team_entity`); Task 1 adds `apps/api/test/helpers/catalog-db-test-lock.ts` (identical pattern to `cleaner-db-test-lock.ts`, new arbitrary lock key), acquired only by the level-2 file. Level 3 (Task 7) follows the established precedent instead — unique-per-run fixture data and id-scoped assertions — so it does not truncate and does not need the lock. `apps/api/test/jest-e2e.json` already runs with `maxWorkers: 1`, so no additional cross-file race exists to introduce here.

No test-framework changes — reuse the existing `apps/api` Jest config (level-1 unit specs under `apps/api/src/modules/catalog/tests/`, levels 2–3 under `apps/api/test/`). Task 1 also adds `apps/api/src/modules/catalog/tests/catalog.module.di.spec.ts` up front (mirroring `cleaners.module.di.spec.ts`'s technique) — proving `CatalogModule` can construct its own providers in isolation (a fake global `DataSource` + repository-token overrides, no real Postgres, no `AppModule`), extended by Tasks 2–4 as each new provider is added.

## 8. Task breakdown

### Task 1 — `Service`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/catalog/domain/service.ts` — plain `Service` interface (§4.1 of spec)
- `apps/api/src/modules/catalog/infrastructure/persistence/service.entity.ts` — TypeORM entity implementing `Service`. `id` (`@PrimaryGeneratedColumn('uuid')`), `name` (`@Column()` — **no** `unique` option, §3), `description` (`@Column({ type: 'text', nullable: true })`), `durationMinutes` (`@Column({ type: 'integer' })`), `active` (`@Column({ default: true })`), `createdAt`/`updatedAt` (`@CreateDateColumn`/`@UpdateDateColumn`, `type: 'timestamptz'`).
- `apps/api/src/modules/catalog/application/commands/create-service.command.ts` — `{ actorId: string; name: string; description?: string | null; durationMinutes: number }`
- `apps/api/src/modules/catalog/application/commands/update-service.command.ts` — `{ actorId: string; name?: string; description?: string | null; durationMinutes?: number; active?: boolean }`
- `apps/api/src/modules/catalog/application/services/services.service.ts` — `ServicesService`:
  - `createService(command)`: transaction + `runAuditInTransaction` (§3's code shape); trims `name`; `assertNameAvailable(manager, name)`; builds the entity; calls `this.assertValid(entity)`; `manager.save(entity)` inside a `try/catch` translating Postgres `23505` to `ConflictException('Service name is already in use')` (race-window fallback — the pre-check above handles the common case); `await this.auditLogger.log({ actorId: command.actorId, action: 'service.create', entityType: 'service', entityId: entity.id })`; returns the entity.
  - `updateService(id, command)`: `manager.findOneBy(ServiceEntity, { id })`, throws `NotFoundException('Service ${id} not found')` if absent; `const { actorId, ...changes } = command;`; if `changes.name !== undefined`, trim it and call `assertNameAvailable(manager, changes.name, id)`; validates the **resulting** state without mutating the tracked entity yet: `this.assertValid({ ...entity, ...changes })`; persists via `manager.update(ServiceEntity, { id }, { ...changes, updatedAt: new Date() })` inside the same `try/catch`-translation pattern — never `Object.assign(entity, changes)` + `manager.save(entity)`, for the same `updatedAt`-guarantee reason as `updateCleaner` (§3); `const updated = await manager.findOneByOrFail(ServiceEntity, { id })`; logs `service.update` using the destructured `actorId` and `updated.id`; returns `updated`.
  - `private assertNameAvailable(manager: EntityManager, name: string, excludeId?: string): Promise<void>` — `manager.getRepository(ServiceEntity).createQueryBuilder('s').where('LOWER(s.name) = LOWER(:name)', { name }).andWhere(excludeId ? 's.id != :excludeId' : '1=1', { excludeId }).getOne()`; throws `ConflictException('Service name is already in use')` if a row is found.
  - `private assertValid(service: Pick<Service, 'name' | 'durationMinutes'>): void` — throws `BadRequestException` if `name` is empty/whitespace-only after `.trim()`, or `durationMinutes` is not a positive integer (`Number.isInteger(x) && x > 0`).
  - `getService(id)`: injected `Repository<ServiceEntity>.findOneBy({ id })` — `null` if absent.
  - `listServices()`: injected `Repository<ServiceEntity>.find()` — full set, active and inactive (§4.1).
  - Constructor takes `DataSource`, injected `Repository<ServiceEntity>`, and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/catalog/catalog.module.ts` — `@Module({ imports: [TypeOrmModule.forFeature([ServiceEntity]), AuditModule], providers: [ServicesService], exports: [ServicesService] })` (Tasks 2–4 extend this)
- `apps/api/src/modules/catalog/tests/application/services.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)
- `apps/api/src/modules/catalog/tests/catalog.module.di.spec.ts` — real DI-resolution proof, mirroring `cleaners.module.di.spec.ts`'s technique exactly (a fake global `DataSource` + repository-token overrides, no real Postgres, no `AppModule`). Task 1 covers `ServicesService`/`AUDIT_LOGGER`, Tasks 2–4 extend it.
- `apps/api/test/helpers/catalog-db-test-lock.ts` — advisory-lock helper, identical pattern to `cleaner-db-test-lock.ts` with a new arbitrary lock key; used only by the level-2 file below
- `apps/api/test/catalog.service.e2e-spec.ts` — real-Postgres service-level tests (test level 2, §7); this task adds the file and its `Service`/`ServicesService` `describe` block, acquiring/releasing the Task 1 lock helper in `beforeAll`/`afterAll` and truncating `ServiceEntity` in `beforeEach`; Tasks 2 and 3 extend the same file with `AddOn`/`AddOnsService` and `PricingRule`/`PricingRulesService` blocks (and extend the shared `beforeEach` truncation)

**Files (modified):**
- `apps/api/src/platform/database/data-source.ts` — add `ServiceEntity` to `entities`
- Generate migration: `pnpm migration:generate add service` → new file under `platform/database/migrations/`; hand-edit `up()` to append `CREATE UNIQUE INDEX "uq_service_name_lower" ON "service_entity" (LOWER("name"));` and `down()` to prepend `DROP INDEX "uq_service_name_lower";` — authoritative source of the uniqueness constraint, not derivable from entity metadata (§3)

**Tests to write first (TDD) — level 1, `services.service.spec.ts` (mocked `Repository`):**
- `assertValid` (exercised via `createService` with a mocked repository): empty/whitespace-only `name`, or `durationMinutes` of `0`/negative/non-integer, throws `BadRequestException` before any repository call.
- `getService`: returns the service for an existing id; returns `null` for a nonexistent id.
- `listServices`: returns all services including inactive ones (no filtering, no arguments) — empty array when none exist.
- `updateService`: nonexistent `id` throws `NotFoundException`.

**Tests to write first (TDD) — level 2, `catalog.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only):**
- `createService`: persists a `ServiceEntity` with `active: true`; `auditLogger.log` called with `{ actorId, action: 'service.create', entityType: 'service', entityId }`. A second `createService` with the same `name` (any case, e.g. `"standard clean"` vs an existing `"Standard Clean"`) throws `ConflictException`, and only one row exists afterward — proves case-insensitive uniqueness against a real row, not just the pre-check logic. With `auditLogger.log` mocked to reject, `createService` rejects and no row exists afterward (real rollback proof).
- `updateService`: a command with only `durationMinutes` set leaves `name`/`description`/`active` unchanged in the re-read row. Calling `updateService` with every field set to the service's own current values (a no-effective-change update) still strictly advances `updatedAt` (`toBeGreaterThan`, required assertion) and still emits a `service.update` audit event — the concrete real-persistence proof that `manager.update()` makes this guarantee hold, mirroring the Cleaners plan's equivalent `updateCleaner` test. Setting `active: false` via `updateService`, then re-fetching via `listServices`, confirms the (now-inactive) service is still returned — proves §4.1's "Catalog reads are unfiltered" decision at the persistence level.

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 2 — `AddOn`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/catalog/domain/add-on.ts` — plain `AddOn` interface (§4.1 of spec)
- `apps/api/src/modules/catalog/infrastructure/persistence/add-on.entity.ts` — TypeORM entity implementing `AddOn`. `id` (`@PrimaryGeneratedColumn('uuid')`), `name` (`@Column()` — no `unique` option, same reasoning as `ServiceEntity`), `description` (`@Column({ type: 'text', nullable: true })`), `priceMinorUnits` (`@Column({ type: 'integer' })`), `active` (`@Column({ default: true })`), `createdAt`/`updatedAt` (`@CreateDateColumn`/`@UpdateDateColumn`, `type: 'timestamptz'`).
- `apps/api/src/modules/catalog/application/commands/create-add-on.command.ts` — `{ actorId: string; name: string; description?: string | null; priceMinorUnits: number }`
- `apps/api/src/modules/catalog/application/commands/update-add-on.command.ts` — `{ actorId: string; name?: string; description?: string | null; priceMinorUnits?: number; active?: boolean }`
- `apps/api/src/modules/catalog/application/services/add-ons.service.ts` — `AddOnsService`, structurally identical to `ServicesService` (Task 1), substituting `AddOn`'s own fields:
  - `createAddOn(command)`: transaction + `runAuditInTransaction`; trims `name`; `assertNameAvailable`; builds the entity with `active: true`; `assertValid(entity)`; `manager.save(entity)` inside the `23505` → `ConflictException('Add-on name is already in use')` `try/catch`; logs `add_on.create`; returns the entity.
  - `updateAddOn(id, command)`: same partial-update/`manager.update()` shape as `updateService`, substituting `AddOnEntity`/`add_on.update`/the add-on's own `assertNameAvailable`/`assertValid` calls.
  - `private assertNameAvailable(manager, name, excludeId?)` — same query shape as `ServicesService`'s, against `AddOnEntity`.
  - `private assertValid(addOn: Pick<AddOn, 'name' | 'priceMinorUnits'>): void` — throws `BadRequestException` if `name` is empty/whitespace-only after `.trim()`, or `priceMinorUnits` is not a positive integer.
  - `getAddOn(id)`: injected `Repository<AddOnEntity>.findOneBy({ id })` — not exposed over GraphQL as a standalone query (spec §4.5 lists no `addOn(id)` query), used only internally by `updateAddOn`'s `NotFoundException` check via `manager.findOneBy` — no separate service method is strictly needed for that, so this method exists only if Task 4's resolver needs it; if unused by Task 4, omit it (YAGNI — do not add a read method with no caller).
  - `listAddOns()`: injected `Repository<AddOnEntity>.find()` — full set, active and inactive.
  - Constructor takes `DataSource`, injected `Repository<AddOnEntity>`, and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/catalog/tests/application/add-ons.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)

**Files (modified):**
- `apps/api/src/modules/catalog/catalog.module.ts` — add `AddOnEntity` to `TypeOrmModule.forFeature([...])`, add `AddOnsService` to `providers`/`exports`
- `apps/api/src/platform/database/data-source.ts` — add `AddOnEntity` to `entities`
- Generate migration: `pnpm migration:generate add add-on` → new file under `platform/database/migrations/`; hand-edit `up()`/`down()` with the `LOWER("name")` expression unique index, same shape as Task 1's `AddService` migration
- `apps/api/test/catalog.service.e2e-spec.ts` — extend with the `AddOn`/`AddOnsService` `describe` block; extend the shared `beforeEach` truncation to include `AddOnEntity`
- `apps/api/src/modules/catalog/tests/catalog.module.di.spec.ts` — extend to prove `AddOnsService` also resolves

**Tests to write first (TDD) — level 1, `add-ons.service.spec.ts` (mocked `Repository`):**
- `assertValid` (exercised via `createAddOn`/`updateAddOn` with mocked repositories): empty/whitespace-only `name`, or `priceMinorUnits` of `0`/negative/non-integer, throws `BadRequestException` before any repository call.
- `updateAddOn`: nonexistent `id` throws `NotFoundException`.
- `listAddOns`: returns all add-ons including inactive ones — empty array when none exist.

**Tests to write first (TDD) — level 2, `catalog.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only):**
- `createAddOn`: persists an `AddOnEntity` with `active: true`; `auditLogger.log` called with `add_on.create`. A second `createAddOn` with a case-different duplicate `name` throws `ConflictException`, no second row persisted. With `auditLogger.log` mocked to reject, no row exists afterward (rollback proof).
- `updateAddOn`: a command with only `priceMinorUnits` set leaves `name`/`description`/`active` unchanged in the re-read row; setting `active: false` and re-fetching via `listAddOns` confirms the (now-inactive) add-on is still returned, matching `Service.active`'s unfiltered-reads decision (§4.1). A no-effective-change update still strictly advances `updatedAt` and still emits an `add_on.update` audit event, same required-assertion shape as `updateService`'s equivalent test.

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 3 — `PricingRule`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/catalog/domain/pricing-rule.ts` — plain `PricingRule` interface, **no `updatedAt`** (§4.1 of spec)
- `apps/api/src/modules/catalog/infrastructure/persistence/pricing-rule.entity.ts` — TypeORM entity implementing `PricingRule`. `id` (`@PrimaryGeneratedColumn('uuid')`), `serviceId` (`@Column({ type: 'uuid' }) @Index()`, plain column, no relation decorator — §3), `priceMinorUnits` (`@Column({ type: 'integer' })`), `active` (`@Column({ default: true })`), `createdAt` (`@CreateDateColumn({ type: 'timestamptz' })`) — **no `@UpdateDateColumn`, no `updatedAt` property at all.**
- `apps/api/src/modules/catalog/application/commands/create-pricing-rule.command.ts` — `{ actorId: string; serviceId: string; priceMinorUnits: number }`
- `apps/api/src/modules/catalog/application/services/pricing-rules.service.ts` — `PricingRulesService`:
  - `createPricingRule(command)`: the exact code shape in §3 above — existence-checks `serviceId` (`NotFoundException`), validates `priceMinorUnits`, deactivates any currently-active rule for the service via a bulk `manager.update()`, inserts the new active rule inside a `try/catch` translating `23505` to `ConflictException('Pricing for this service was just updated — please retry')`, logs exactly one `pricing_rule.create` audit event, returns the new entity.
  - `getActivePricing(serviceId)`: `this.serviceRepository.findOneBy({ id: serviceId })`, throws `NotFoundException('Service ${serviceId} not found')` if absent; otherwise `this.pricingRuleRepository.findOneBy({ serviceId, active: true })` — returns `null` if the service exists but has never had a `PricingRule` created for it.
  - `getActivePricingForServiceIds(serviceIds: string[])`: `this.pricingRuleRepository.findBy({ serviceId: In(serviceIds), active: true })` — bulk method for Task 4's loader; no existence check (§3's reconciliation); not exposed over GraphQL directly.
  - `private assertValid(rule: Pick<PricingRule, 'priceMinorUnits'>): void` — throws `BadRequestException` if `priceMinorUnits` is not a positive integer.
  - Constructor takes `DataSource`, injected `Repository<PricingRuleEntity>`, injected `Repository<ServiceEntity>` (for the existence checks in both `createPricingRule` and `getActivePricing`), and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/catalog/tests/application/pricing-rules.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)

**Files (modified):**
- `apps/api/src/modules/catalog/catalog.module.ts` — add `PricingRuleEntity` to `TypeOrmModule.forFeature([...])`, add `PricingRulesService` to `providers`/`exports`
- `apps/api/src/platform/database/data-source.ts` — add `PricingRuleEntity` to `entities`
- Generate migration: `pnpm migration:generate add pricing-rule` → new file under `platform/database/migrations/`; hand-edit `up()` to append, in order: `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_service" FOREIGN KEY ("serviceId") REFERENCES "service_entity"("id") ON DELETE RESTRICT;` then `CREATE UNIQUE INDEX "uq_pricing_rule_active_service" ON "pricing_rule_entity" ("serviceId") WHERE "active" = true;`; hand-edit `down()` to reverse both, dropping the index before the constraint — authoritative source of both, not derivable from entity metadata (§3, §4.7)
- `apps/api/test/catalog.service.e2e-spec.ts` — extend with the `PricingRule`/`PricingRulesService` `describe` block; extend the shared `beforeEach` truncation to include `PricingRuleEntity` (truncate order: `pricing_rule_entity` before `service_entity`, matching the FK direction, the same combined-`TRUNCATE` technique the Cleaners plan used for `cleaner_entity`/`team_entity`)
- `apps/api/src/modules/catalog/tests/catalog.module.di.spec.ts` — extend to prove `PricingRulesService` also resolves

**Tests to write first (TDD) — level 1, `pricing-rules.service.spec.ts` (mocked `Repository`):**
- `createPricingRule`: nonexistent `serviceId` throws `NotFoundException` without attempting the deactivate/insert steps (mocked service-repository lookup returns `undefined`, checked first).
- `assertValid` (exercised via `createPricingRule` with a mocked repository): `priceMinorUnits` of `0`/negative/non-integer throws `BadRequestException` before any write.
- `getActivePricing`: nonexistent `serviceId` throws `NotFoundException`; an existing service with no `PricingRule` yet returns `null`; an existing service with an active rule returns it.
- `getActivePricingForServiceIds`: given a mocked repository returning rules for a subset of requested `serviceId`s, the method returns exactly those rows (no synthetic `null` entries for missing ids — the loader in Task 4 handles the gap-filling, mirroring the Cleaners plan's `getTeamsByIds` precedent).

**Tests to write first (TDD) — level 2, `catalog.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only):**
- `createPricingRule`: given a persisted `Service` with no prior pricing, creates an active `PricingRule`; `auditLogger.log` called with `pricing_rule.create`; `getActivePricing` returns it. A second `createPricingRule` for the same service (a repricing) deactivates the first rule and activates the second — re-querying `pricing_rule_entity` directly confirms exactly one row has `active: true` and the first row's `active` is now `false` with its `priceMinorUnits`/`createdAt` unchanged (proves append-only, §4.1). `getActivePricing` now returns the second rule's price. With `auditLogger.log` mocked to reject on the second call, the transaction rolls back entirely — the first rule's `active` flag is confirmed still `true` afterward (rollback proof covering the deactivate step, not just the insert).
- **Concurrency test (added to the Accepted spec's Tests scope at M3 round 1):** given a persisted `Service` with no prior pricing, issue two `createPricingRule` calls concurrently via `Promise.allSettled([svc.createPricingRule(cmdA), svc.createPricingRule(cmdB)])`. Assert exactly one settled result is `fulfilled` and exactly one is `rejected` with a `ConflictException`; then query `pricing_rule_entity` directly and assert exactly one row has `active: true` for that `serviceId`. This is the test that actually exercises the partial unique index under real concurrent transactions — a mocked unit test cannot produce this signal (§7).
- `getActivePricing` for a nonexistent `serviceId` throws `NotFoundException` (real-Postgres confirmation of the level-1 mocked case, matching the Cleaners plan's convention of covering existence-check paths at both levels where a real FK/row lookup is meaningfully different from a mock).

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 4 — GraphQL presentation

**Files (new):**
- `apps/api/src/modules/catalog/presentation/graphql/service.type.ts` — `@ObjectType('Service')`: `id` (`ID`), `name`, `description` (nullable), `durationMinutes`, `active`, `activePricing` (`PricingRuleType`, nullable, resolved exclusively via `@ResolveField`), `createdAt`, `updatedAt`.
- `apps/api/src/modules/catalog/presentation/graphql/add-on.type.ts` — `@ObjectType('AddOn')`: `id`, `name`, `description` (nullable), `priceMinorUnits`, `active`, `createdAt`, `updatedAt`.
- `apps/api/src/modules/catalog/presentation/graphql/pricing-rule.type.ts` — `@ObjectType('PricingRule')`: `id`, `serviceId`, `priceMinorUnits`, `createdAt` — **no `active` field** (§3).
- `apps/api/src/modules/catalog/presentation/graphql/create-service.input.ts` — `@InputType()`: `name`, `description` (nullable, optional), `durationMinutes` (`Int`)
- `apps/api/src/modules/catalog/presentation/graphql/update-service.input.ts` — `@InputType() class UpdateServiceInput extends PartialType(CreateServiceInput) { @Field(() => Boolean, { nullable: true }) active?: boolean; }` — `active` is added on top of `CreateServiceInput`'s fields since it's not settable at creation (always `true`) but is settable via update (§4.1).
- `apps/api/src/modules/catalog/presentation/graphql/create-add-on.input.ts` — `@InputType()`: `name`, `description` (nullable, optional), `priceMinorUnits` (`Int`)
- `apps/api/src/modules/catalog/presentation/graphql/update-add-on.input.ts` — `@InputType() class UpdateAddOnInput extends PartialType(CreateAddOnInput) { @Field(() => Boolean, { nullable: true }) active?: boolean; }`, same reasoning as `UpdateServiceInput`.
- `apps/api/src/modules/catalog/presentation/graphql/create-pricing-rule.input.ts` — `@InputType()`: `serviceId` (`ID`), `priceMinorUnits` (`Int`) — the single `input` object per spec §4.5's M3-round-1 change.
- `apps/api/src/modules/catalog/presentation/graphql/active-pricing.loader.ts` — `@Injectable({ scope: Scope.REQUEST }) class ActivePricingLoader`, constructed with `PricingRulesService` injected:
  ```ts
  @Injectable({ scope: Scope.REQUEST })
  export class ActivePricingLoader {
    readonly loader: DataLoader<string, PricingRule | null>;
    constructor(private readonly pricingRulesService: PricingRulesService) {
      this.loader = new DataLoader<string, PricingRule | null>(async (serviceIds) => {
        const rules = await this.pricingRulesService.getActivePricingForServiceIds([...serviceIds]);
        const byServiceId = new Map(rules.map((rule) => [rule.serviceId, rule]));
        return serviceIds.map((id) => byServiceId.get(id) ?? null);
      });
    }
  }
  ```
- `apps/api/src/modules/catalog/presentation/graphql/service.resolver.ts` — `ServiceResolver`:
  - `@Query(() => ServiceType, { name: 'service', nullable: true })` `service(@Args('id', { type: () => ID }) id)` → `ServicesService.getService`, mapped, `@UseGuards(AuthGuard) @Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.CUSTOMER_SUPPORT, Role.FINANCE, Role.ANALYST)` (view matrix — all six roles, §4.3)
  - `@Query(() => [ServiceType], { name: 'services' })` → `ServicesService.listServices`, same guard/roles
  - `@Mutation(() => ServiceType)` `createService` / `updateService` → `@UseGuards(AuthGuard) @Roles(Role.OWNER, Role.OPS_MANAGER)`, builds the command via `{ ...input, actorId: currentUser.id }`, calls `ServicesService.createService`/`.updateService`
  - `@ResolveField(() => PricingRuleType, { nullable: true })` `activePricing(@Parent() service: Pick<Service, 'id'>)` — reads `ActivePricingLoader` from the resolver's own constructor-injected field (request-scoped provider, §3 — not `@Context()`) → `this.loader.loader.load(service.id)`, mapped to `PricingRuleType`. No separate `@UseGuards`/`@Roles()` on this method — reachable only after the guarded parent query already succeeded, the same precedent `Cleaner.team`/`Team.cleaners` established.
- `apps/api/src/modules/catalog/presentation/graphql/add-on.resolver.ts` — `AddOnResolver`:
  - `@Query(() => [AddOnType], { name: 'addOns' })` → `AddOnsService.listAddOns`, same view-matrix guard/roles as `ServiceResolver`'s queries
  - `@Mutation(() => AddOnType)` `createAddOn` / `updateAddOn` → same write-matrix guard/roles as `createService`, `{ ...input, actorId: currentUser.id }`, calls `AddOnsService.createAddOn`/`.updateAddOn`
- `apps/api/src/modules/catalog/presentation/graphql/pricing-rule.resolver.ts` — `PricingRuleResolver`:
  - `@Query(() => PricingRuleType, { name: 'activePricing', nullable: true })` `activePricing(@Args('serviceId', { type: () => ID }) serviceId)` → `PricingRulesService.getActivePricing`, mapped, same view-matrix guard/roles
  - `@Mutation(() => PricingRuleType)` `createPricingRule(@Args('input') input: CreatePricingRuleInput, @CurrentUser() currentUser)` → same write-matrix guard/roles, calls `PricingRulesService.createPricingRule({ ...input, actorId: currentUser.id })`
- `apps/api/src/modules/catalog/presentation/graphql/mappers.ts` — `toServiceType`, `toAddOnType`, `toPricingRuleType` (from the outset, matching the Cleaners & Teams plan's Task 3 precedent of not starting with duplicated inline mapping). `toServiceType` returns an object literal cast to `ServiceType` with `activePricing: null` as a type-level placeholder only (never read — Apollo always calls `ServiceResolver.activePricing`'s `@ResolveField` for that key), the same pattern `toCleanerType`/`team: null` established.
- `apps/api/src/modules/catalog/tests/graphql/service.resolver.spec.ts`, `add-on.resolver.spec.ts`, `pricing-rule.resolver.spec.ts`
- `apps/api/src/modules/catalog/tests/graphql/active-pricing.loader.spec.ts` — unit test for the loader's batch function in isolation (mocked `PricingRulesService.getActivePricingForServiceIds`, called directly as a standalone function the same way the Cleaners plan's M8 refactor extracted `createTeamBatchFn`/`createTeamCleanersBatchFn` — this plan writes `ActivePricingLoader`'s batch logic as a standalone exported function, `createActivePricingBatchFn(pricingRulesService)`, from the outset, so this test never needs to reach into `DataLoader`'s private `_batchLoadFn`): given keys `[a, b, c]` and a bulk result covering only `a` and `c`, returns `[rule_a, null, rule_c]` in that exact order.

**Files (modified):**
- `apps/api/src/modules/catalog/catalog.module.ts` — add `ServiceResolver`, `AddOnResolver`, `PricingRuleResolver`, `ActivePricingLoader` to `providers`

**Tests to write first (TDD):**
- Resolver-level (reflected-metadata technique, matching `cleaner.resolver.spec.ts`): `createService`/`updateService`/`createAddOn`/`updateAddOn`/`createPricingRule` are decorated with `AuthGuard` and `@Roles(Role.OWNER, Role.OPS_MANAGER)` (write matrix). `service`/`services`/`addOns`/`activePricing` are decorated with `AuthGuard` and `@Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.CUSTOMER_SUPPORT, Role.FINANCE, Role.ANALYST)` (view matrix — all six roles, per spec §4.3, a deliberately broader matrix than the Cleaners spec's).
- `ServiceType`/`AddOnType`/`PricingRuleType`'s field sets match the domain objects plus computed fields; `PricingRuleType` specifically does **not** expose `active` — assert via the generated schema/metadata (e.g. `getMetadataStorage().collectObjectTypeMetadata(PricingRuleType)`'s field list) that no `active` field exists, the same belt-and-suspenders technique the Cleaners plan used for `CleanerType`/`teamId`.
- `createActivePricingBatchFn`'s ordering/gap-filling test above.
- `ServiceResolver.activePricing`: calls `loader.loader.load(service.id)` exactly once per invocation (mocked `ActivePricingLoader`, asserting the mock's `load` was called with the parent's `id`).

**Traceability:** spec §4.3, §4.4, §4.5.

### Task 5 — `apps/api` composition root

**Files (modified):**
- `apps/api/src/app/app.module.ts` — add `CatalogModule` to `imports`, alongside `AuditModule`, `AdminsModule`, `AuthModule.forRootAsync(...)`, `BookingsModule`, `CustomersModule`, `CleanersModule`. `CatalogModule` imports `AuditModule` itself (Task 1, matching every prior module's precedent); no new cross-module binding is introduced at the `AppModule` level.
- Run `pnpm migration:run` locally (dev-environment step, not a committed file change beyond the migrations already generated in Tasks 1–3).

**Tests:** none new — verification is that the full `AppModule` still boots and the existing `bookings`/`admin-foundation`/`customers-properties`/`cleaners-teams` e2e suites still pass unmodified (regression check).

**Traceability:** ties Tasks 1–4 into the running application; no new spec surface.

### Task 6 — `packages/client` operations + `apps/web` `/catalog` screens

**Files (new):**
- `packages/client/src/operations/services.graphql` — `query Services { services { id name durationMinutes active activePricing { priceMinorUnits } } }`, `query Service($id: ID!) { service(id: $id) { id name description durationMinutes active activePricing { id priceMinorUnits } } }`, `mutation CreateService($input: CreateServiceInput!) { createService(input: $input) { id } }`, `mutation UpdateService($id: ID!, $input: UpdateServiceInput!) { updateService(id: $id, input: $input) { id } }`, `mutation CreatePricingRule($input: CreatePricingRuleInput!) { createPricingRule(input: $input) { id priceMinorUnits } }`
- `packages/client/src/operations/add-ons.graphql` — `query AddOns { addOns { id name description priceMinorUnits active } }`, `mutation CreateAddOn($input: CreateAddOnInput!) { createAddOn(input: $input) { id } }`, `mutation UpdateAddOn($id: ID!, $input: UpdateAddOnInput!) { updateAddOn(id: $id, input: $input) { id } }`
- Regenerate `packages/client/src/generated/graphql.ts` via `pnpm --filter @clensy/client codegen` (Task 4's schema must be current — run after Tasks 4/5 are in place)
- `apps/web/app/catalog/format-price.ts` — `export function formatMinorUnits(minorUnits: number): string { return \`₱${(minorUnits / 100).toFixed(2)}\`; }` — the one client-side formatting helper spec §4.5/§2 assign to `apps/web`; not a `packages/ui` primitive (§4 — no new shared UI primitives), just a plain function shared by the two pages below that display a price.
- `apps/web/app/catalog/page.tsx` — `useServicesQuery`, `DataTable` (columns: name, duration, active badge, active price — `row.activePricing ? formatMinorUnits(row.activePricing.priceMinorUnits) : '—'`; row links to `/catalog/[id]`); inline "Add service" form section (`FormField`s for `name`/`description`/`durationMinutes`; `useCreateServiceMutation`, `refetch()` on success) — mirrors `apps/web/app/cleaners/page.tsx`'s inline-create-section pattern.
- `apps/web/app/catalog/[id]/page.tsx` — `useServiceQuery({ variables: { id } })`; service fields shown with an inline edit form covering `name`/`description`/`durationMinutes`/`active` (`useUpdateServiceMutation`); current active price display (`data.service.activePricing ? formatMinorUnits(...) : 'No price set'`); a "set new price" form (`FormField` for a new `priceMinorUnits` value — collected as whole currency units in the UI and converted `× 100` before calling `useCreatePricingRuleMutation`, since the API is minor-units-only per §4.5/§2 and this conversion is purely a UI input-affordance decision, not a schema change) then `refetch()`. Mutation failure is surfaced using this codebase's existing inline-static-message pattern (`'Unable to update service.'` / `'Unable to set new price.'`), matching `apps/web/app/cleaners/[id]/page.tsx`'s established approach — no new error-display primitive.
- `apps/web/app/catalog/add-ons/page.tsx` — `useAddOnsQuery`, `DataTable` (columns: name, price — `formatMinorUnits(row.priceMinorUnits)`, active badge; row links to `/catalog/add-ons/[id]`); inline "Add add-on" form (`FormField`s for `name`/`description`/`priceMinorUnits`, same currency-unit-to-minor-units conversion as above; `useCreateAddOnMutation`, `refetch()`).
- `apps/web/app/catalog/add-ons/[id]/page.tsx` — `useAddOnsQuery` (there is no standalone `addOn(id)` query per spec §4.5 — this page finds its row client-side from the already-fetched `addOns` list result, the only spec-authorized way to reach a single add-on's data by id) with an inline edit form covering `name`/`description`/`priceMinorUnits`/`active` (`useUpdateAddOnMutation`), then `refetch()`.
- `apps/web/app/catalog/tests/`: none — matches the Cleaners & Teams plan's Task 5 precedent: Task 7's e2e verifies the GraphQL API's behavior, not the Next.js pages; the manual acceptance checklist below is what verifies the web layer itself.

**Files (modified):**
- `apps/web/middleware.ts` — `matcher: [..., '/catalog', '/catalog/:path*']`

**Tests:** none required beyond Task 7's e2e — matches the established precedent. Manual acceptance checklist, run once against the dev server before Task 6 is considered done:

```text
[ ] /catalog loads and lists seeded services with duration and active price
[ ] "Add service" creates a service and it appears in the list (via query refetch, not a page reload)
[ ] /catalog/[id] loads an existing service's fields, shows "No price set" for an unpriced service
[ ] Editing a service field and submitting persists after a reload
[ ] Setting a new price on a service's detail page updates the shown active price
[ ] Setting a second new price on the same service replaces the shown active price (old one no longer shown as active)
[ ] Toggling a service's active flag off, then reloading /catalog, still shows it in the list (not hidden)
[ ] /catalog/add-ons loads and lists seeded add-ons with price
[ ] "Add add-on" creates an add-on and it appears in the list (via query refetch, not a page reload)
[ ] /catalog/add-ons/[id] loads an existing add-on's fields; editing and submitting persists after a reload
[ ] Creating a service with a name that already exists (any case) shows an error, no duplicate created
[ ] Creating an add-on with a name that already exists (any case) shows an error, no duplicate created
[ ] Visiting /catalog or /catalog/[id] with no session cookie redirects to /login (middleware matcher)
```

**Traceability:** spec §4.5, §4.6.

### Task 7 — E2E acceptance

This task proves the resolver/guard/service/loader wiring end-to-end over real GraphQL requests — it does not re-prove what Tasks 1–3's level-2 real-Postgres service tests already cover (explicit-`null`-vs-omitted persistence, audit-failure rollback, unique-constraint translation, the concurrency race) at the service layer.

**Files (new):**
- `apps/api/test/catalog.e2e-spec.ts` — reuses `apps/api/test/helpers/seed-owner.ts` to seed and log in as the fixture Owner; unique-per-run data and id-scoped assertions throughout (§7 — no truncation, no lock needed):
  1. Log in as Owner → `createService` succeeds → `createAddOn` succeeds → `createPricingRule` succeeds for the service → `services { activePricing { priceMinorUnits } }` returns the service with the correct active price (the issue's own "create service → attach pricing → list active catalog" DoD wording) → `addOns` includes the created add-on → `service.create`/`add_on.create`/`pricing_rule.create` audit events recorded (direct repository/DB read).
  2. `createPricingRule` again for the same service (a repricing) → `activePricing(serviceId)` now returns the new price, not the old one → a second `pricing_rule.create` audit event exists → direct DB read confirms exactly one `pricing_rule_entity` row has `active: true` for that service (end-to-end proof of the deactivate-then-insert sequence, spec §4.2).
  3. `updateService` with only `durationMinutes` set → re-fetch confirms `name`/`description` unchanged, `durationMinutes` updated → `service.update` recorded. `updateService` with `active: false` → `services` still returns it (unfiltered reads, spec §4.1).
  4. `updateAddOn` with only `priceMinorUnits` set → re-fetch confirms `name`/`description` unchanged → `add_on.update` recorded.
  5. Fixture: 3 services, 2 with an active `PricingRule`, 1 without. `services { activePricing { priceMinorUnits } }` → asserts the correct price/`null` per row (functional correctness).
  6. **Batching/query-count proof, distinct from step 5** (§7): before issuing the request, `jest.spyOn(app.get(PricingRulesService), 'getActivePricingForServiceIds')`. Re-issue the same `services { activePricing { priceMinorUnits } }` request from step 5 → `expect(spy).toHaveBeenCalledTimes(1)` **and** `expect(new Set(spy.mock.calls[0][0])).toEqual(new Set(expectedServiceIds))` (exact-set equality, not `arrayContaining`) — including the unpriced service's id, since a `null`-result key must still appear in the batch call's argument set. This is the test that actually fails if the resolver regresses to one `getActivePricing` call per parent row — step 5 alone would still pass in that regression, since both a batched and an N+1 implementation return identical data.
  7. Use the existing Owner-only `createAdmin` mutation to create a Scheduler, a Customer Support, a Finance, and an Analyst admin **within this suite** for the RBAC checks below — this suite does not depend on fixtures created by, or the execution order of, any other e2e file.
  8. Log in as each of Scheduler, Customer Support, Finance, and Analyst → `services`, `addOns`, and `activePricing` all succeed (view-allowed for all six roles, spec §4.3) → `createService`, `createAddOn`, and `createPricingRule` are all denied for each of these four roles (write-restricted to Owner/Ops Manager only).
  9. `createPricingRule` with a nonexistent `serviceId` (as Owner) → rejected with a not-found error, no row persisted.
  10. `createService` with a `name` matching an already-existing service, in a different case (e.g. existing `"Deep Clean"`, attempted `"deep clean"`) → rejected with a conflict error, no duplicate persisted. Same case-insensitive-conflict check repeated for `createAddOn`.
  11. `activePricing(serviceId)` for a service with no pricing yet → returns `null` (not an error); for a nonexistent `serviceId` → rejected with a not-found error.

**Traceability:** spec §2 (golden path), §4.1 (`active` semantics), §4.2 (not-found/null-vs-error policies, deactivate-then-insert), §4.3 (RBAC matrix), §4.4 (audit), §4.5 (batching — functional in step 5, query-count in step 6), §4.7 (case-insensitive uniqueness).

## 9. Public surfaces requiring implementation

| | Surface |
| --- | --- |
| **Public** (fixed by spec §4.5/§5 above) | `Service`, `AddOn`, `PricingRule` domain shapes; 9 GraphQL operations (`service`, `services`, `addOns`, `activePricing`, `createService`, `updateService`, `createAddOn`, `updateAddOn`, `createPricingRule`); `Service.activePricing` computed field |
| **Internal** (M4 rule 12 — implementation detail, not exposed over GraphQL, not part of this plan's contract) | `ServicesService`, `AddOnsService`, `PricingRulesService`; commands; `ServiceEntity`, `AddOnEntity`, `PricingRuleEntity`; `ActivePricingLoader`; `getActivePricingForServiceIds` bulk-fetch method; `toServiceType`/`toAddOnType`/`toPricingRuleType` mappers |

No additional public surface is introduced anywhere in the task breakdown.

## 10. Self-check (planner)

| Check | Status |
| --- | --- |
| Every major task traces to the Accepted specification | ✅ — each task cites spec section(s) |
| No task introduces new product semantics | ✅ — Task 5's composition-root change, Task 6's client/web scaffolding and currency-unit-to-minor-units UI conversion, and Task 4's loader are execution necessities/mechanism choices, not new capabilities |
| Task ordering executable without inventing missing work | ✅ — §6 hard-prerequisite chain (Service before PricingRule; AddOn independent; presentation after all three; composition root after presentation; web after composition root) |
| Deferred work explicitly identified | ✅ — §2 SHALL NOT list |
| Missing design semantics → returned to M2/M3 | N/A — none found; the one apparent tension (spec §4.2's "single entry point" language vs. §4.5's N+1 invariant) was resolved as an M4 implementation-mechanism decision (§3), the same category of resolution the Cleaners & Teams plan applied to `getTeam`/`getTeamsByIds`, not a missing-semantics gap requiring a return to M2/M3 |
| Public contract matches the Accepted spec exactly | ✅ — §9; 9 GraphQL operations, matching spec §4.5 exactly |
| New dependency flagged for explicit approval before use | N/A — no new dependency; `dataloader` is already an approved, installed dependency from the Cleaners & Teams slice (§3) |

## 11. Non-goals of this plan

- Redesigning the Accepted specification.
- Plan Review decisions (M5) — this plan does not self-Accept.
- Any implementation activity (M6) — no code is written at this stage.
- New `packages/ui` primitives — this slice's UI is fully covered by `Button`, `DataTable`, `FormField`, plus the one local `formatMinorUnits` helper (§4, Task 6).
