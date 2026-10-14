# Laundry Price Preview and Line Description API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | **Draft**. Ready for M5 Plan Review. |
| Date | 2026-10-14 |
| Tracking issue | [#159](https://github.com/rexescario-dev/clensy-platform/issues/159) "Laundry price-preview and line-label API". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Spec gate [#164](https://github.com/rexescario-dev/clensy-platform/issues/164), Accepted through [#167](https://github.com/rexescario-dev/clensy-platform/pull/167). Unblocks #158 (services and add-ons) and #162 (price preview and confirmation). |
| Branch | `feat/159-laundry-price-preview-api`, from `main` at `fb0791e`. One PR carries this plan, its M5 record and the implementation. |
| Scope | `apps/api` (laundry module, one migration, tests, the regenerated `src/schema.gql`), `packages/client` (operation documents, the regenerated client, one test). No `apps/web`, `packages/web` or `@clensy/ui` change. No change to `modules/catalog` or `modules/billing` source. No new dependency. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.2** (frozen line `description`: the string rule, copied inside the `priceLaundryOrder` transaction, fail-and-roll-back when the catalog row cannot be read, the additive `pricingSnapshotDescription text not null` column, the migration-time backfill and its comment, exposure on the snapshot GraphQL type, and "Preview of a not-yet-priced order always uses the current catalog name"); **§8.4.3** (a repeated `addOnId` is priced as its own line by both price and preview; no new rejection); **§8.4.5** (the `previewLaundryOrderPrice` read). Unchanged and relied on: §4.4 RBAC, §4.5 steps 1–4 and 3a, §4.6, §4.7, §4.8, §4.10. |
| Relies on (Accepted, merged) | [Laundry Invoices](../specs/2026-09-06-laundry-invoices-design.md): the `Service.name` / `AddOn.name + " (add-on)"` rule and the missing-name guard (`InvoicesService.buildLinePayloads`). [Tenant isolation #84/#87](../specs/): `ServicesService.getServicesByIds` / `AddOnsService.getAddOnsByIds` scope by tenant in the same query; the composite `fk_laundry_order_line_service_tenant` / `_add_on_tenant` FKs. #90/#92 sweep guards: `root-operation-inventory.ts`, `release-gate/role-matrix.ts`, `release-gate/probes/laundry.ts`, `tenant-read-authorizers.e2e-spec.ts`. |
| Out of scope (other issues) | §8.4.1 positive weight is [#155](https://github.com/rexescario-dev/clensy-platform/issues/155)'s (its issue comment takes it). This plan does not touch `weigh` or `WeighLaundryOrderInput`. Every web consumer of the preview and the description is #158 / #162. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, task order and the release-gate probe shape are planning decisions, not product semantics. |
| Owner decisions (M4, 2026-10-14) | The spec lists what a preview line carries but does not name the fields. Asked during planning: **(1) Preview line shape** mirrors the priced line: `serviceId: ID`, `addOnId: ID` (exactly one set), `description: String!`, `unit: PricingUnit!`, `quantity`, `rateMinorUnits`, `amountMinorUnits`, `minimumChargeMinorUnits`, `minimumChargeApplied`; the envelope is `{ estimatedTotalMinorUnits: Int!, lines: [LaundryPricePreviewLine!]! }`. The issue's draft `targetKind` / `targetId` / `name` and the new `LaundryLineUnit` enum are **not** used. `unit` reuses the `PricingUnit` GraphQL enum that `LaundryOrderLinePricingSnapshot.unit` already uses; this does not put `unit` on the catalog `PricingRule` type (§8.4.5 last paragraph). **(2) Client operations are in scope:** `description` joins the `LaundryOrderDetail` fragment, a `PreviewLaundryOrderPrice` query document is added, and the client is regenerated. No web page changes. |
| Superseded issue text | The #159 issue comment records that §8.4.2 is Accepted: the issue body's live-name `service { id, name }` / `addOn { id, name }` resolve fields, "no migration" and "do not copy the name into a new column" are **superseded** for priced lines. This plan adds no such resolve fields. Its acceptance criterion "order detail can read the base service name and add-on name without a second catalog page query" is met by `pricingSnapshot.description`. |
| Pre-validation | **None claimed.** Read-only spikes ran at planning time and are recorded under [Planning spikes](#planning-spikes); no task's `Expected:` commands were run. |
| M7 | Application code, schema and a migration change, so `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. |

**Goal:** Priced laundry lines carry a frozen `description`, and operations staff can ask the server for a non-writing price estimate of a `WEIGHED` order through the same pricing path `priceLaundryOrder` uses.

**Architecture:**

- **One quoting path.** A private `LaundryOrdersService.quote(order, input, tenantId)` holds today's `price` loop body: §4.5 step 3 rule resolution (`resolveEffectivePricing`, one `asOf`), step 3a quantity resolution, step 4 `computeLaundryLineAmount`, plus the §8.4.2 description lookup. `price` calls it inside its locked transaction and persists the result. `previewPrice` calls it on a plain tenant-scoped read and returns the result. There is no second formula.
- **Names** come from `ServicesService.getServicesByIds` / `AddOnsService.getAddOnsByIds`, the same tenant-scoped catalog reads billing uses. `LaundryModule` already imports `CatalogModule`, which exports both services. No catalog entity is registered in `LaundryModule`.
- **Persistence:** one additive migration adds `pricingSnapshotDescription text`, backfills it from the catalog at migration time, then sets `not null`.
- **GraphQL:** `LaundryOrderLinePricingSnapshot.description: String!`; a `previewLaundryOrderPrice` `@Query` on the existing `LaundryOrderResolver` (it already hosts the `laundryOrder` query), `@UseGuards(AuthGuard)` + `@Roles(...OPERATIONAL)`.

**Tech Stack:** NestJS 11, `@nestjs/graphql` code-first, TypeORM 0.3 on Postgres, Jest (unit + e2e), `@graphql-codegen` + Vitest in `packages/client`.

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.2, §8.4.3, §8.4.5 (with §4.4, §4.5, §4.6, §4.10).

## Global Constraints

Derived from the Accepted spec only. Every task's requirements implicitly include this section.

- **SHALL** compute preview lines and priced lines through the one `quote` helper. **SHALL NOT** duplicate `resolveQuantity`, the `resolveEffectivePricing` call, or `computeLaundryLineAmount` in a second code path (§8.2 last bullet; §8.4.5).
- **SHALL** keep §4.5 step 3a exactly: `PER_KG` uses `order.weightGrams` and ignores a supplied quantity; `PER_ITEM` uses the supplied quantity or `1`; `FLAT` / `PER_SERVICE` use `1`. A supplied quantity that ends up ignored is **not** an error. Supplied quantities are validated as integers `≥ 1` for both price and preview.
- **SHALL** build the description as `Service.name` for the base line and `` `${AddOn.name} (add-on)` `` for an add-on line (§8.4.2). When the catalog row is not found in the caller's tenant, **SHALL** throw `BadRequestException` (`Service <id> could not be resolved` / `Add-on <id> could not be resolved`, the invoice guard's wording); in `price` this happens inside the transaction, so nothing is written.
- **SHALL** keep `price`'s existing error order: status / weight precondition, quantity shape, then per target `No effective price for <column> <id>`, then the name. The cross-tenant release-gate probes rely on the 400s.
- **Preview SHALL NOT** open a transaction, take a row lock, insert or update any row, change status, set `totalMinorUnits`, write an audit event, generate an invoice or mark anything paid (§8.4.5). It reads the order by `{ id, tenantId }`; a missing or other-tenant order is `NotFoundException` (the `lock` helper's message), like `price`.
- **Preview SHALL** require `status = WEIGHED` and `weightGrams !== null`, with `price`'s existing messages (`Cannot price a laundry order in status <S>` / `Laundry order has no recorded weight`), as `BadRequestException`.
- **Preview SHALL** price each `addOns` entry as its own line, so a repeated `addOnId` yields repeated lines, exactly like `price` (§8.4.3). **SHALL NOT** add any new precondition.
- **Preview SHALL** return `estimatedTotalMinorUnits` = the sum of the returned lines' `amountMinorUnits`, the same sum `price` stores.
- **RBAC:** `previewLaundryOrderPrice` is `@UseGuards(AuthGuard)` + `@Roles(TENANT_OWNER, OPS_MANAGER, SCHEDULER)`, the `OPERATIONAL` constant `priceLaundryOrder` uses. **SHALL NOT** open it to `CUSTOMER_SUPPORT`, `FINANCE` or `ANALYST`. Tenant comes from `requireTenantId(user)`, as `priceLaundryOrder` does.
- **SHALL NOT** expose `unit` or `minimumChargeMinorUnits` on the catalog `PricingRule` GraphQL type (§8.4.5).
- **Migration:** additive only; reads `service_entity` / `add_on_entity` but never alters them; backfill joins on `id` **and** `tenantId`; the class carries the §8.4.2 comment that a backfilled value is the catalog name at migration time, not the name at pricing time; `down()` drops the column only.
- **SHALL NOT** change `getOrderForInvoicing`, `OrderForInvoicing`, or invoice generation. Invoices keep copying their own description at generation (§8.2).
- **SHALL NOT** touch `weigh`, `WeighLaundryOrderInput`, or any web package.

## Contract inventory

| Surface | Change | Spec |
| --- | --- | --- |
| `LaundryOrderLinePricingSnapshot` (domain interface) | `+ description: string` | §8.4.2 |
| `LaundryOrderLinePricingSnapshotEmbeddable` | `+ @Column({ type: 'text', name: 'pricingSnapshotDescription' }) description` | §8.4.2 |
| `laundry_order_line_entity` | `+ "pricingSnapshotDescription" text not null`, backfilled | §8.4.2 |
| GraphQL `LaundryOrderLinePricingSnapshot` | `+ description: String!` | §8.4.2 |
| GraphQL `Query.previewLaundryOrderPrice(input: PriceLaundryOrderInput!): LaundryPricePreview!` | new | §8.4.5 |
| GraphQL `LaundryPricePreview`, `LaundryPricePreviewLine` | new object types (owner decision 1) | §8.4.5 |
| `LaundryOrdersService` constructor | `+ ServicesService, AddOnsService` | planning |
| `LaundryOrdersService.previewPrice(query)` | new | §8.4.5 |
| `packages/client` `laundry.graphql` | `description` in `LaundryOrderDetail`; `PreviewLaundryOrderPrice` query | owner decision 2 |

Deferred, explicitly: positive weight (#155); any web UI (#158, #162); rejecting a repeated `addOnId` (§8.6); the superseded live-name resolve fields (never built).

## File map

| File | Action |
| --- | --- |
| `apps/api/src/platform/database/migrations/1790956800000-AddLaundryLineDescription.ts` | create |
| `apps/api/test/add-laundry-line-description.migration.e2e-spec.ts` | create |
| `apps/api/src/modules/laundry/domain/laundry-order-line-pricing-snapshot.ts` | modify |
| `apps/api/src/modules/laundry/infrastructure/persistence/laundry-order-line-pricing-snapshot.embeddable.ts` | modify |
| `apps/api/src/modules/laundry/application/services/laundry-orders.service.ts` | modify |
| `apps/api/src/modules/laundry/application/services/laundry-price-preview.ts` | create |
| `apps/api/src/modules/laundry/application/commands/price-laundry-order.command.ts` | modify (add the preview query type) |
| `apps/api/src/modules/laundry/presentation/graphql/laundry-order-line-pricing-snapshot.type.ts` | modify |
| `apps/api/src/modules/laundry/presentation/graphql/laundry-price-preview.type.ts` | create |
| `apps/api/src/modules/laundry/presentation/graphql/laundry-order.resolver.ts` | modify |
| `apps/api/src/modules/laundry/tests/application/laundry-orders.service.spec.ts` | modify |
| `apps/api/src/modules/laundry/tests/graphql/laundry-order.resolver.spec.ts` | modify |
| `apps/api/src/modules/laundry/tests/laundry.module.di.spec.ts` | modify only if it fails (fake catalog services already exported) |
| `apps/api/test/laundry.service.e2e-spec.ts`, `test/billing.service.e2e-spec.ts` | modify (constructor, description assertions) |
| `apps/api/test/laundry.e2e-spec.ts` | modify (preview + description over GraphQL) |
| `apps/api/test/remove-test-tenants.e2e-spec.ts`, `test/laundry-billing.tenant-isolation.e2e-spec.ts` | modify (raw line inserts add the new column) |
| `apps/api/test/release-gate/two-tenant-world.ts` | modify (line fixture adds `description`) |
| `apps/api/test/helpers/root-operation-inventory.ts`, `test/root-operation-authorization.e2e-spec.ts` | modify (classify the new query; count 62 → 63) |
| `apps/api/test/release-gate/role-matrix.ts`, `test/release-gate/probes/laundry.ts`, `test/two-tenant-release-gate.e2e-spec.ts` | modify (matrix row, probe; count 64 → 65) |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts` | modify (`LaundryPricePreview.lines` custom object field) |
| `apps/api/src/schema.gql` | regenerated |
| `packages/client/src/operations/laundry.graphql`, `src/generated/graphql.ts`, `src/laundry-operations.test.ts` | modify / regenerate |

## Tasks

Run commands from the repository root unless stated. `pnpm --filter api` is `apps/api`; `pnpm --filter @clensy/client` is `packages/client`. E2E suites need the local Postgres the repo's e2e suites already use.

**Intermediate state note:** after Task 1 alone, the database has a `not null` column that the entity does not yet write, so API e2e suites that price an order fail until Task 2 lands. Task 1's migration e2e is self-contained (throwaway database) and is the only e2e it runs. Commit Tasks 1 and 2 separately, but do not push between them.

### Task 1: Migration — add and backfill `pricingSnapshotDescription` (§8.4.2)

**Files:** create the migration and its e2e spec.

- [ ] **Step 1: Write the failing migration e2e.** `apps/api/test/add-laundry-line-description.migration.e2e-spec.ts`, same harness as `add-tenant-label-overrides.migration.e2e-spec.ts` (throwaway database, `migrationsBefore('1790956800000')`, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`, 120 s `beforeAll`). Seed with raw SQL (column lists from `add-laundry-billing-tenant.migration.e2e-spec.ts`): in `BOOTSTRAP_TENANT_ID`, one customer, a service `'Wash & Fold'`, an add-on `'Ironing'`, one `PRICED` order, one service line and **two** add-on lines on the same add-on (repeated add-on). Also create a second tenant (`INSERT INTO "tenant_entity" ("id","name")`) with its own customer, service `'Other Wash'`, order and service line. Cases, sequential:
  1. **up backfills and enforces not null:** run `up` in a transaction (the `inTransaction` helper pattern). Assert `information_schema.columns` reports `data_type = 'text'`, `is_nullable = 'NO'` for `pricingSnapshotDescription`; the service line reads `'Wash & Fold'`; both add-on lines read `'Ironing (add-on)'`; the second tenant's line reads `'Other Wash'`.
  2. **the backfill is a migration-time copy:** `UPDATE "service_entity" SET "name" = 'Renamed'` for the bootstrap service, then assert the line still reads `'Wash & Fold'`.
  3. **down drops only the column:** run `down`; assert the column is gone and every line row still exists (row count unchanged).
  4. **up on an empty table:** after `down`, `DELETE FROM "laundry_order_line_entity"`, run `up` again; it succeeds and the column is `not null`.

- [ ] **Step 2: Run it and see it fail.**
  Run: `pnpm --filter api test:e2e -- add-laundry-line-description`
  Expected: FAIL — cannot resolve `../src/platform/database/migrations/1790956800000-AddLaundryLineDescription`.

- [ ] **Step 3: Write the migration.**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Frozen laundry line description (#159; lifecycle spec Amendment #164
// §8.4.2). Adds `pricingSnapshotDescription`, backfills every existing line
// from the catalog, then enforces `not null`.
//
// A backfilled value is the catalog name current AT MIGRATION TIME, not the
// name at pricing time: that name was never stored (§8.3). Lines priced
// after this migration copy the name inside `priceLaundryOrder`.
//
// Same string rule as invoice lines: `Service.name`, or
// `AddOn.name || ' (add-on)'`. Joins on `id` AND `tenantId`, matching the
// composite `fk_laundry_order_line_service_tenant` / `_add_on_tenant` FKs,
// which also guarantee every line finds its row. Reads catalog tables only.
export class AddLaundryLineDescription1790956800000 implements MigrationInterface {
  name = 'AddLaundryLineDescription1790956800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" ADD "pricingSnapshotDescription" text`,
    );
    await queryRunner.query(
      `UPDATE "laundry_order_line_entity" AS l SET "pricingSnapshotDescription" = s."name" FROM "service_entity" AS s WHERE l."serviceId" = s."id" AND l."tenantId" = s."tenantId"`,
    );
    await queryRunner.query(
      `UPDATE "laundry_order_line_entity" AS l SET "pricingSnapshotDescription" = a."name" || ' (add-on)' FROM "add_on_entity" AS a WHERE l."addOnId" = a."id" AND l."tenantId" = a."tenantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" ALTER COLUMN "pricingSnapshotDescription" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" DROP COLUMN "pricingSnapshotDescription"`,
    );
  }
}
```

  Confirm `1790956800000` is still greater than every file in `src/platform/database/migrations` at implementation time; if `main` gained a later migration, take the next free day-step timestamp and rename consistently (planning decision).

- [ ] **Step 4: Run it and see it pass.**
  Run: `pnpm --filter api test:e2e -- add-laundry-line-description`
  Expected: PASS, 4 tests.

- [ ] **Step 5: Commit.** `feat(api): add and backfill the frozen laundry line description column (#159)`

### Task 2: `priceLaundryOrder` freezes the description (§8.4.2)

**Files:** domain snapshot, embeddable, GraphQL snapshot type, service, unit spec, the e2e files that build `LaundryOrdersService` or write lines directly.

- [ ] **Step 1: Write failing unit tests** in `laundry-orders.service.spec.ts`:
  - Add `servicesService = { getServicesByIds: jest.fn() }` and `addOnsService = { getAddOnsByIds: jest.fn() }` mocks and providers (`ServicesService`, `AddOnsService` from `modules/catalog/application/services`). Default them in `describe('price')`'s `beforeEach` to return `[{ id: 'svc-1', name: 'Wash & Fold' }]` and `[]`.
  - Extend the existing "freezes a PER_KG base line snapshot…" expectation with `description: 'Wash & Fold'`.
  - New: **"freezes the add-on description with the invoice suffix, once per repeated add-on"** — two `addOns` entries with the same `addOnId: 'ao-1'`, `getAddOnsByIds` returns `[{ id: 'ao-1', name: 'Ironing' }]`; assert two saved add-on lines, each `description: 'Ironing (add-on)'`.
  - New: **"looks names up in the command tenant"** — `getServicesByIds` called with `(['svc-1'], 't-a')`, `getAddOnsByIds` with the add-on ids and `'t-a'`.
  - New: **"rejects when the base service name cannot be read and writes nothing"** — `getServicesByIds` returns `[]`; expect `BadRequestException` `Service svc-1 could not be resolved`; `manager.save`, `manager.update` and `auditLogger.log` not called.
  - New: **"rejects when an add-on name cannot be read"** — same for `Add-on ao-1 could not be resolved`.

- [ ] **Step 2: Run them and see them fail.**
  Run: `pnpm --filter api test -- laundry-orders.service`
  Expected: FAIL — `Nest can't resolve dependencies` is **not** expected (providers are supplied); the description assertions fail (`description` absent) and the missing-name cases resolve instead of rejecting.

- [ ] **Step 3: Implement.**
  - Domain `LaundryOrderLinePricingSnapshot`: add, with a comment citing §8.4.2,
    ```ts
    // The catalog name copied once at pricing (Amendment #164 §8.4.2):
    // `Service.name`, or `AddOn.name + " (add-on)"`. Not a foreign key; a
    // later catalog rename does not change it.
    description: string;
    ```
  - Embeddable: `@Column({ type: 'text', name: 'pricingSnapshotDescription' }) description!: string;` and one header-comment line naming the column.
  - GraphQL `LaundryOrderLinePricingSnapshotType`: `@Field() description!: string;`
  - Service: inject `ServicesService` and `AddOnsService` (constructor order: after `pricingRulesService`, before the audit logger). Extract the per-target loop of `price` into the private helper below and add the name lookup. `price` keeps its lock, precondition, save, update, transition assertion and audit exactly as today; it now builds lines from `quote(...)`.

    ```ts
    // One quoting path for price and preview (spec §4.5 steps 1–4 and 3a;
    // Amendment #164 §8.4.2, §8.4.5). Writes nothing.
    private async quote(
      order: LaundryOrderEntity,
      input: Omit<PriceLaundryOrderCommand, 'actorId' | 'orderId'>,
    ): Promise<QuotedLine[]>
    ```
    Body, in order: `assertPriceable(order)` (the two existing `BadRequestException`s), `validateQuantity` for the base and every add-on, one `asOf = new Date()`, the existing `targets` array, then per target: `resolveEffectivePricing(…, asOf, input.tenantId)` → the existing "No effective price" 400 → `resolveQuantity` → `computeLaundryLineAmount`. After every rule resolved, fetch names once: `getServicesByIds([input.baseServiceId], input.tenantId)` and `getAddOnsByIds(unique add-on ids, input.tenantId)`; build each line's `description` (missing → the invoice-guard 400). Return `{ serviceId, addOnId, snapshot }[]` in input order, where `snapshot` is the full `LaundryOrderLinePricingSnapshot` including `description` and `pricingRuleId`.
    `QuotedLine` is a module-private type in the service file.
  - Update every `new LaundryOrdersService(...)` call to pass `services` and `addOns`: `test/laundry.service.e2e-spec.ts` (`buildLaundryService` already constructs both), `test/billing.service.e2e-spec.ts` (two sites; construct `ServicesService` / `AddOnsService` the way `buildLaundryService` does if not already present).
  - Rows written outside the service gain the column: `test/remove-test-tenants.e2e-spec.ts` and `test/laundry-billing.tenant-isolation.e2e-spec.ts` raw `INSERT INTO "laundry_order_line_entity"` add `"pricingSnapshotDescription"` with `'Wash'`; `test/release-gate/two-tenant-world.ts` line fixture adds `description: 'Gate service'`.
  - `test/laundry.service.e2e-spec.ts`: the golden-path snapshot `toEqual` (around line 240) adds the expected `description` (its fixture's service name). Add one case: **"keeps the frozen description after a catalog rename"** — price an order, rename the service through `ServicesService.updateService`, re-read the line, the description is the pre-rename name.

- [ ] **Step 4: Run and see them pass.**
  Run: `pnpm --filter api test -- laundry` then `pnpm --filter api test:e2e -- laundry.service billing.service`
  Expected: PASS. The DI spec (`laundry.module.di.spec.ts`) passes unchanged because `FakeCatalogModule` already exports `ServicesService` and `AddOnsService`; if it does not, add the two `useValue: {}` providers there.

- [ ] **Step 5: Commit.** `feat(api): freeze the catalog name on priced laundry lines (#159)`

### Task 3: `previewPrice` — the non-writing estimate (§8.4.5)

**Files:** `application/services/laundry-price-preview.ts` (new), `application/commands/price-laundry-order.command.ts`, the service, its unit spec.

- [ ] **Step 1: Write failing unit tests** in a new `describe('previewPrice')`. `orderRepository.findOneBy` returns `anOrder({ status: WEIGHED, weightGrams: 2500 })`. Default catalog mocks as in Task 2. Vectors reuse `laundry-line-pricing.spec.ts` numbers where they fit:
  1. **PER_KG uses weight, ignores a supplied quantity, applies the floor:** rule `{ unit: PER_KG, priceMinorUnits: 100, minimumChargeMinorUnits: 500 }`, `baseQuantity: 7`, weight 2500 → line `{ serviceId: 'svc-1', addOnId: null, description: 'Wash & Fold', unit: PER_KG, quantity: 2500, rateMinorUnits: 100, amountMinorUnits: 500, minimumChargeMinorUnits: 500, minimumChargeApplied: true }`, `estimatedTotalMinorUnits: 500`.
  2. **PER_ITEM uses `baseQuantity`, default 1, never weight:** `baseQuantity: 3`, rate 1200 → quantity 3, amount 3600; with no `baseQuantity` → quantity 1, amount 1200.
  3. **FLAT and PER_SERVICE use quantity 1 and ignore a supplied quantity** (`it.each`).
  4. **Add-on lines follow the same rule, a repeated `addOnId` gives two lines:** base FLAT 1000, add-ons `[{ addOnId: 'ao-1', quantity: 2 }, { addOnId: 'ao-1' }]` with a PER_ITEM add-on rule 250 → lines in input order, add-on quantities 2 and 1, descriptions `'Ironing (add-on)'`, total 1000 + 500 + 250.
  5. **Rejects RECEIVED and PRICED and writes nothing** (`it.each`): `BadRequestException` `Cannot price a laundry order in status …`.
  6. **Rejects a WEIGHED order without weight** (`Laundry order has no recorded weight`).
  7. **Missing effective price** → `No effective price for serviceId svc-1`.
  8. **Missing order** (`findOneBy` → `null`) → `NotFoundException`; and the read is `findOneBy({ id: 'order-1', tenantId: 't-a' })`.
  9. **Rejects a non-integer or < 1 quantity** (`quantity must be an integer >= 1`).
  10. **Never writes:** across a successful preview, `dataSource.transaction`, every `manager` mock, and `auditLogger.log` have zero calls.
  11. **Agrees with price:** with identical mocks and input, the preview's lines equal the `pricingSnapshot` + ids of the lines `price` saves, and `estimatedTotalMinorUnits` equals the `totalMinorUnits` `price` writes. This pins the single-path rule.

- [ ] **Step 2: Run them and see them fail.**
  Run: `pnpm --filter api test -- laundry-orders.service`
  Expected: FAIL — `service.previewPrice is not a function`.

- [ ] **Step 3: Implement.**
  - `price-laundry-order.command.ts`: add
    ```ts
    // The preview takes price's input without an actor: it writes nothing
    // and audits nothing (Amendment #164 §8.4.5).
    export type PreviewLaundryOrderPriceQuery = Omit<PriceLaundryOrderCommand, 'actorId'>;
    ```
  - `laundry-price-preview.ts`: plain interfaces `LaundryPricePreview { estimatedTotalMinorUnits: number; lines: LaundryPricePreviewLine[] }` and `LaundryPricePreviewLine` = `{ serviceId: string | null; addOnId: string | null }` plus every `LaundryOrderLinePricingSnapshot` field except `pricingRuleId` (the GraphQL payload does not carry it; owner decision 1). A header comment: an estimate; the committed price is the snapshot `priceLaundryOrder` freezes.
  - Service:
    ```ts
    // Non-writing estimate (Amendment #164 §8.4.5): price's preconditions
    // and quoting path, on a plain tenant-scoped read. No transaction, no
    // lock, no write, no audit.
    async previewPrice(query: PreviewLaundryOrderPriceQuery): Promise<LaundryPricePreview>
    ```
    Read `orderRepository.findOneBy({ id: query.orderId, tenantId: query.tenantId })`; `null` → the same `NotFoundException` message as `lock`. Then `quote(order, query)`; map each `QuotedLine` to a preview line (drop `pricingRuleId`); sum amounts.
  - Place `previewPrice` and `quote` per the file's existing function-order lint rule (`contextforge/function-order`); run lint to confirm.

- [ ] **Step 4: Run and see them pass.**
  Run: `pnpm --filter api test -- laundry-orders.service`
  Expected: PASS.

- [ ] **Step 5: Commit.** `feat(api): add a non-writing laundry price preview to the service (#159)`

### Task 4: GraphQL `previewLaundryOrderPrice` and the sweep guards (§8.4.5, §4.4)

**Files:** `laundry-price-preview.type.ts` (new), the resolver, resolver spec, the inventory / gate / authorizer test files.

- [ ] **Step 1: Write the failing resolver spec changes** in `laundry-order.resolver.spec.ts`:
  - Add `previewLaundryOrderPrice: [O, M, S]` to `RBAC` (the guard + roles `describe.each` then covers it).
  - Add `'previewPrice'` to the mocked service `Pick`, and a delegation test: the resolver passes `{ ...input, tenantId: principal.tenantId }` (no `actorId`) and returns the service result; a principal with `tenantId: null` gets `ForbiddenException` before the service is called (the existing `noTenant` mutation cases' assertion).

- [ ] **Step 2: Run and see it fail.**
  Run: `pnpm --filter api test -- laundry-order.resolver`
  Expected: FAIL — `Cannot read properties of undefined (reading 'value')` for `previewLaundryOrderPrice`.

- [ ] **Step 3: Implement.**
  - `laundry-price-preview.type.ts`:
    ```ts
    // An estimate, not a price (Amendment #164 §8.4.5). Same field names as
    // LaundryOrderLine + its snapshot (M4 owner decision 1). `unit` reuses
    // the PricingUnit enum the snapshot type uses; this does not expose
    // `unit` on the catalog PricingRule type.
    @ObjectType('LaundryPricePreviewLine')
    export class LaundryPricePreviewLineType { /* serviceId: ID (nullable), addOnId: ID (nullable), description: String!, unit: PricingUnit!, quantity: Int!, rateMinorUnits: Int!, amountMinorUnits: Int!, minimumChargeMinorUnits: Int (nullable), minimumChargeApplied: Boolean! */ }

    @ObjectType('LaundryPricePreview')
    export class LaundryPricePreviewType {
      @Field(() => Int) estimatedTotalMinorUnits!: number;
      @Field(() => [LaundryPricePreviewLineType]) lines!: LaundryPricePreviewLineType[];
    }
    ```
  - Resolver:
    ```ts
    @Query(() => LaundryPricePreviewType)
    @UseGuards(AuthGuard)
    @Roles(...OPERATIONAL)
    previewLaundryOrderPrice(
      @Args('input') input: PriceLaundryOrderInput,
      @CurrentUser() user: AuthenticatedPrincipal,
    ): Promise<LaundryPricePreviewType> {
      return this.service.previewPrice({ ...input, tenantId: requireTenantId(user) });
    }
    ```
    The plain interface is structurally the GraphQL type; no mapper is needed. If lint or `tsc` disagrees, add `toLaundryPricePreviewType` in `mappers.ts`.
  - Sweep guards (each is a deliberate classification, not a loosening):
    - `test/helpers/root-operation-inventory.ts`: `'Query.previewLaundryOrderPrice': 'TENANT'`.
    - `test/root-operation-authorization.e2e-spec.ts`: `toHaveLength(62)` → `63`.
    - `test/release-gate/role-matrix.ts`: `'Query.previewLaundryOrderPrice': { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER], source: 'Laundry Orders & Lifecycle Amendment #164 §8.4.5 "Authorization matches priceLaundryOrder" (M3 Accepted 2026-10-10); ' + RFC }`.
    - `test/two-tenant-release-gate.e2e-spec.ts`: `toHaveLength(64)` → `65`.
    - `test/release-gate/probes/laundry.ts`: a probe for `Query.previewLaundryOrderPrice`. `prepare`: a `WEIGHED` order (`fixtures.laundryOrder(tenant, WEIGHED)`). The gate's outcome classifier reads `id`s, and a preview has none, so the probe document aliases the payload into the connection shape the classifier already understands, with a comment saying so:
      ```graphql
      query Gate($input: PriceLaundryOrderInput!) {
        previewLaundryOrderPrice(input: $input) {
          nodes: lines { id: serviceId }
          totalCount: estimatedTotalMinorUnits
        }
      }
      ```
      `sameTenant`: `{ addOns: [], baseServiceId: own.serviceId, orderId: prepared.orderId }`; `ok: { kind: 'listIncludes', id: ({ own }) => own.serviceId }`. `crossTenant`: the same three variants as `priceLaundryOrder` (foreign order → 404; foreign `baseServiceId` → 400; foreign `addOnId` → 400; the add-on variant keeps `baseServiceId: own.serviceId`).
      If the reviewer rejects aliasing at M5, the alternative is a new `OkExpectation` kind in `release-gate/probe.ts` / `engine.ts`; that is a larger gate change and is **not** planned by default.
    - `test/tenant-read-authorizers.e2e-spec.ts` `CUSTOM_OBJECT_FIELDS`: `'LaundryPricePreview.lines': 'Plain value list returned by previewLaundryOrderPrice, which LaundryOrdersService computes for the principal tenant (#159); no resolver of its own.'`

- [ ] **Step 4: Run and see them pass.**
  Run: `pnpm --filter api test -- laundry-order.resolver` then `pnpm --filter api test:e2e -- root-operation-authorization tenant-read-authorizers relation-field-authorization`
  then `pnpm --filter api test:e2e:release-gate`
  Expected: PASS. The release gate's Phase 4 runs the new probe for all seven roles: allowed for TENANT_OWNER / OPS_MANAGER / SCHEDULER, forbidden for the rest.

- [ ] **Step 5: Commit.** `feat(api): expose previewLaundryOrderPrice to operational roles (#159)`

### Task 5: Black-box GraphQL e2e (issue Tests section)

**Files:** `apps/api/test/laundry.e2e-spec.ts`.

- [ ] **Step 1: Write the failing cases.** Same self-contained style as the existing golden-path test (own owner, unique names). Extract the existing fixture steps (login, customer, service + PER_KG rule) into local helpers only if needed to avoid copying them twice.
  1. **"previews a WEIGHED order without writing anything"**: receive, weigh 400 g, then `previewLaundryOrderPrice` with `baseQuantity: 5` (ignored for PER_KG) → `{ estimatedTotalMinorUnits: 1000, lines: [{ serviceId, addOnId: null, description: <service name>, unit: 'PER_KG', quantity: 400, rateMinorUnits: 2000, amountMinorUnits: 1000, minimumChargeMinorUnits: 1000, minimumChargeApplied: true }] }`. Re-read `laundryOrder`: `status: 'WEIGHED'`, `totalMinorUnits: null`, `lines.nodes: []`. Audit events for the order: exactly `received` and `weighed` (no `priced`).
  2. **"rejects preview outside WEIGHED"**: on a `RECEIVED` order → error, and on the order after `priceLaundryOrder` (`PRICED`) → error; after each, status unchanged.
  3. **"returns the frozen description on priced lines"**: extend the existing golden-path detail query's `pricingSnapshot` selection with `description` and assert it equals the service name.
  4. **"forbids preview for CUSTOMER_SUPPORT and allows SCHEDULER"**: seed both with `seedTenantAdmin(dataSource, role, BOOTSTRAP_TENANT_ID)`; CUSTOMER_SUPPORT gets a `FORBIDDEN` error; SCHEDULER gets data.

- [ ] **Step 2: Run them.**
  Run: `pnpm --filter api test:e2e -- laundry.e2e`
  Expected: PASS for all four. These cases are black-box confirmation of behavior Tasks 2–4 already drove test-first at the unit and guard level; they are not expected to fail first. To watch them fail, run them on a checkout before Task 4 (`Cannot query field "previewLaundryOrderPrice"`).

- [ ] **Step 3: Commit.** `test(api): cover the laundry price preview and frozen description over GraphQL (#159)`

### Task 6: Schema and client operations (owner decision 2)

**Files:** `apps/api/src/schema.gql`, `packages/client/src/operations/laundry.graphql`, `packages/client/src/generated/graphql.ts`, `packages/client/src/laundry-operations.test.ts`.

- [ ] **Step 1: Regenerate the API schema.** Booting the app writes `autoSchemaFile`. Any API e2e run from Tasks 4–5 already rewrote `apps/api/src/schema.gql`; confirm with `git diff --stat apps/api/src/schema.gql` that it now has `description: String!` on `LaundryOrderLinePricingSnapshot`, both new types and the new `Query` field, and nothing unrelated.

- [ ] **Step 2: Write the failing client test** in `laundry-operations.test.ts`:
  - **"selects the frozen description on every priced line"**: `LaundryOrderDocument`'s `pricingSnapshot` selection includes `description` (walk with `visit`, as the existing helper does).
  - **"previews price as a query with every estimate field"**: `PreviewLaundryOrderPriceDocument` has one `OperationDefinition` with `operation === 'query'`, and its `lines` selection is exactly `serviceId addOnId description unit quantity rateMinorUnits amountMinorUnits minimumChargeMinorUnits minimumChargeApplied`, plus `estimatedTotalMinorUnits`.
  Run: `pnpm --filter @clensy/client test`
  Expected: FAIL — `PreviewLaundryOrderPriceDocument` is not exported.

- [ ] **Step 3: Add the documents and regenerate.** In `laundry.graphql`, add `description` to `LaundryOrderDetail`'s `pricingSnapshot`, and:
  ```graphql
  query PreviewLaundryOrderPrice($input: PriceLaundryOrderInput!) {
    previewLaundryOrderPrice(input: $input) {
      estimatedTotalMinorUnits
      lines {
        serviceId
        addOnId
        description
        unit
        quantity
        rateMinorUnits
        amountMinorUnits
        minimumChargeMinorUnits
        minimumChargeApplied
      }
    }
  }
  ```
  Run: `pnpm --filter @clensy/client codegen`

- [ ] **Step 4: Run and see it pass.**
  Run: `pnpm --filter @clensy/client test && pnpm --filter @clensy/client build && pnpm --filter @clensy/client lint`
  Expected: PASS. Then `pnpm --filter web test && pnpm --filter web build`: PASS with no web source change (the web order page consumes the fragment type; an added field does not break it).

- [ ] **Step 5: Commit.** `feat(client): add the laundry price preview query and line description (#159)`

### Task 7: Full verification

- [ ] Run, from the root: `pnpm --filter api lint`, `pnpm --filter api build`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter @clensy/client test`, `pnpm --filter @clensy/client build`, `pnpm --filter @clensy/client lint`, `pnpm --filter web test`, `pnpm --filter web build`, `pnpm --filter web lint`.
  Expected: all PASS. Record each command and result in the M6 Slice Completion Report's Validation table.
- [ ] `git diff main --stat` lists only files in the [File map](#file-map), plus this plan.
- [ ] `pnpm --filter api migration:generate` is **not** run against a shared database. If run locally to confirm the entity matches the migration, it must propose nothing for `pricingSnapshotDescription`; per the `LaundryOrderLineEntity` header, ignore any proposal to drop the hand-written composite FKs.

## Traceability

| Task | Spec |
| --- | --- |
| 1 Migration + backfill | §8.4.2 persistence paragraph; §8.3 (migration-time backfill wording); §4.10 (additive, catalog untouched) |
| 2 Price freezes description | §8.4.2 field table and "copies it inside the same transaction … fails and rolls back"; §8.4.3 (repeated add-on, one line each) |
| 3 Preview service | §8.4.5 bullets 1–3, 5, 6; §8.4.2 last line (preview uses the current catalog name); §8.2 "No second pricing implementation" |
| 4 GraphQL + guards | §8.4.5 signature, bullet 4 (RBAC), last paragraph (no `unit` on `PricingRule`); §4.4 OPERATIONAL set; #90/#92 guard contracts |
| 5 GraphQL e2e | #159 Tests section; §8.4.5 non-write; §8.4.2 GraphQL exposure |
| 6 Client | owner decision 2 (M4) |

## TDD summary

- New failing tests precede each implementation step: migration e2e (Task 1), price description unit tests (Task 2), preview unit tests (Task 3), resolver RBAC/delegation (Task 4), client document tests (Task 6).
- **Characterization tests** (pin behavior that is already correct and must not change): Task 3 case 11 "agrees with price" pins that the extracted `quote` did not change `price`'s amounts; the existing `price` unit and e2e cases kept green through Task 2 characterize the refactor. Task 5 case 2's "status unchanged" assertion on a `PRICED` order characterizes existing immutability.
- Sweep-guard edits in Task 4 are inventory updates the guards demand; they fail first by design (the guards reject an unclassified root field).

## Execution risks (operational only)

- **Intermediate red e2e** between Tasks 1 and 2 (see note above). Do not push between them.
- **Migration timestamp drift** if `main` gains a migration before merge; rebase and renumber (Task 1 Step 3).
- **Staging / production:** applying the migration follows the project's manual schema-change process (§8.4.2). The backfill copies today's catalog names into every existing line; that is the owner-approved semantics.
- **Release gate run time:** `test:e2e:release-gate` is slow; run it once in Task 4 and once in Task 7.

## Planning spikes

Read-only, at `fb0791e`:

- `LaundryOrdersService.price` holds the full per-target loop inline; `resolveQuantity` and `validateQuantity` are private helpers. No other caller computes line amounts.
- `CatalogModule` exports `ServicesService`, `AddOnsService`, `PricingRulesService`; `getServicesByIds` / `getAddOnsByIds` take `(ids, tenantId)` and scope in the same `where`.
- `InvoicesService.buildLinePayloads` is the name rule and its 400 wording.
- `LaundryOrderResolver` already hosts `@Query laundryOrder`, so a second `@Query` there follows precedent.
- Direct line writers outside the service: raw SQL in `remove-test-tenants.e2e-spec.ts` and `laundry-billing.tenant-isolation.e2e-spec.ts`; repository `create` in `release-gate/two-tenant-world.ts`. Older migration suites run against `migrationsBefore(<their timestamp>)` and are unaffected.
- `new LaundryOrdersService(` appears in `laundry.service.e2e-spec.ts` (1) and `billing.service.e2e-spec.ts` (2).
- Root-field counts: `root-operation-authorization` expects 62; the release gate's role matrix expects 64.
- `tenant-read-authorizers` sweeps every `@ObjectType`'s object-typed fields; `LaundryPricePreview.lines` needs a `CUSTOM_OBJECT_FIELDS` entry.
- The release-gate outcome classifier (`release-gate/outcome.ts`) recognizes a single `{ id }`, an array of `{ id }`, or a `{ nodes, totalCount }` connection.
- `apps/web/lib/laundry-order-page.render.test.tsx` declares its own `Line` type, not the generated fragment type; the added fragment field does not affect it.
- `packages/client/codegen.ts` reads `apps/api/src/schema.gql`.
