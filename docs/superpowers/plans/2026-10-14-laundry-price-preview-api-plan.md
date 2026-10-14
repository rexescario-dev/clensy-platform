# Laundry Price Preview and Line Description API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | **Draft (revision 5)**. Ready for M5 Plan Review. |
| M5 history | First pass (2026-10-14, owner): **Returned for Revision**. P1: the `quote` extraction must keep `price`'s existing error order, and the plan did not show that order or pin it. P2: the `quote` signature disagreed between Architecture and Task 2. P2: no test covered competing failures. Resolved in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). Second pass (2026-10-14, owner): **Returned for Revision**. All three findings confirmed resolved. One P2: Task 2 said both that `price` keeps its preconditions and that `quote` takes them, so a precondition could run twice or the wording could be broken. Resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). Third pass (2026-10-14, owner): **Returned for Revision**. The revision-2 finding confirmed resolved. One P2: the release-gate probe aliased the money amount `estimatedTotalMinorUnits` as `totalCount`. Resolved in [Revision 4 (M5 review 3)](#revision-4-m5-review-3). Fourth pass (2026-10-14, owner): **Returned for Revision**. The money-as-count finding confirmed resolved. One P2: the `items` alias was a gate-only adapter, not the real `lines` payload, and its classifier rule was not tied to the preview. Resolved in [Revision 5 (M5 review 4)](#revision-5-m5-review-4). |
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

- **One quoting path.** A private `LaundryOrdersService.quote(order, input)` (tenant scoping comes from `input.tenantId`) owns every pricing precondition and the quote itself, each run exactly once, in the [Error precedence](#error-precedence) order: the status and recorded-weight checks, quantity shape, §4.5 step 3 rule resolution (`resolveEffectivePricing`, one `asOf`), step 3a quantity resolution, step 4 `computeLaundryLineAmount`, then the §8.4.2 description lookup. These checks move **out of** `price`; neither caller repeats them. `price` keeps only the transaction, the order lock, line persistence, the total and status update, the transition assertion and the audit. `previewPrice` keeps only its plain tenant-scoped read. There is no second formula.

  | Responsibility | Owner |
  | --- | --- |
  | Transaction, `pessimistic_write` lock, `NotFoundException` (row 1) | `price` (`this.lock`) |
  | Tenant-scoped read, `NotFoundException` (row 1) | `previewPrice` (`orderRepository.findOneBy`) |
  | Status and weight checks (rows 2–3) | `quote` (`assertPriceable`), only |
  | Quantity shape (rows 4–5) | `quote`, only |
  | Rule resolution, quantity resolution, amounts (row 6) | `quote`, only |
  | Names (row 7) | `quote`, only |
  | Save lines, set `totalMinorUnits`, `assertTransition(WEIGHED → PRICED)`, status update, audit | `price`, only |
  | Sum for `estimatedTotalMinorUnits`, map to preview lines | `previewPrice`, only |
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
- **SHALL** keep `price`'s existing error order, and give preview the same order (see [Error precedence](#error-precedence)). The cross-tenant release-gate probes rely on the 400s.
- **Preview SHALL NOT** open a transaction, take a row lock, insert or update any row, change status, set `totalMinorUnits`, write an audit event, generate an invoice or mark anything paid (§8.4.5). It reads the order by `{ id, tenantId }`; a missing or other-tenant order is `NotFoundException` (the `lock` helper's message), like `price`.
- **Preview SHALL** require `status = WEIGHED` and `weightGrams !== null`, with `price`'s existing messages (`Cannot price a laundry order in status <S>` / `Laundry order has no recorded weight`), as `BadRequestException`.
- **Preview SHALL** price each `addOns` entry as its own line, so a repeated `addOnId` yields repeated lines, exactly like `price` (§8.4.3). **SHALL NOT** add any new precondition.
- **Preview SHALL** return `estimatedTotalMinorUnits` = the sum of the returned lines' `amountMinorUnits`, the same sum `price` stores.
- **RBAC:** `previewLaundryOrderPrice` is `@UseGuards(AuthGuard)` + `@Roles(TENANT_OWNER, OPS_MANAGER, SCHEDULER)`, the `OPERATIONAL` constant `priceLaundryOrder` uses. **SHALL NOT** open it to `CUSTOMER_SUPPORT`, `FINANCE` or `ANALYST`. Tenant comes from `requireTenantId(user)`, as `priceLaundryOrder` does.
- **SHALL NOT** expose `unit` or `minimumChargeMinorUnits` on the catalog `PricingRule` GraphQL type (§8.4.5).
- **Migration:** additive only; reads `service_entity` / `add_on_entity` but never alters them; backfill joins on `id` **and** `tenantId`; the class carries the §8.4.2 comment that a backfilled value is the catalog name at migration time, not the name at pricing time; `down()` drops the column only.
- **SHALL NOT** change `getOrderForInvoicing`, `OrderForInvoicing`, or invoice generation. Invoices keep copying their own description at generation (§8.2).
- **SHALL NOT** touch `weigh`, `WeighLaundryOrderInput`, or any web package.

## Error precedence

**Current order in `price`, at `fb0791e`** (`laundry-orders.service.ts`, by quoted code; line numbers are for orientation only):

| # | Check | Code | Error |
| --- | --- | --- | --- |
| 1 | Order exists in the tenant | `const order = await this.lock(` (l. 163) | `NotFoundException` `Laundry order <id> not found` |
| 2 | Status is `WEIGHED` | `if (order.status !== S.WEIGHED) {` (l. 171) | 400 `Cannot price a laundry order in status <S>` |
| 3 | Weight recorded | `if (order.weightGrams === null) {` (l. 176) | 400 `Laundry order has no recorded weight` |
| 4 | Base quantity shape | `this.validateQuantity(command.baseQuantity);` (l. 179) | 400 `quantity must be an integer >= 1` |
| 5 | Each add-on quantity shape, in input order | `this.validateQuantity(addOn.quantity);` (l. 181) | same |
| 6 | Each target's effective price: base first, then add-ons in input order; the first missing one throws and no later target is resolved | `for (const target of targets) {` … `resolveEffectivePricing(` (l. 205–221) | 400 `No effective price for <serviceId\|addOnId> <id>` |

Every check runs before any `manager.save` / `manager.update` / audit call, so each failure writes nothing.

**Order after this plan** (both `price` and `previewPrice`):

- Rows 1–6 unchanged. For preview, row 1 is the plain `findOneBy({ id, tenantId })` read with the same message. Rows 2–6 run inside `quote`, in the same order, with the same messages. `quote` moves this code without reordering it.
- **New row 7:** names. It runs only after **every** target's rule has resolved. The base service name is checked first, then add-on names in input order. Errors are `Service <id> could not be resolved` / `Add-on <id> could not be resolved`. A row-6 failure therefore always wins over a missing name, and no catalog-name read happens when a rule is missing.

[Task 2](#task-2-pricelaundryorder-freezes-the-description-842) pins rows 1–7 for `price` with competing-failure tests, and [Task 3](#task-3-previewprice--the-non-writing-estimate-845) runs the same table against `previewPrice`.

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
| `apps/api/test/release-gate/outcome.ts`, `test/release-gate/outcome.e2e-spec.ts` | modify (a `previewLaundryOrderPrice`-scoped rule reading `lines[].serviceId \| addOnId`, test first) |
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

- [ ] **Step 1: Pin the current error order (characterization, before any service change).** In `laundry-orders.service.spec.ts`:
  - Add `servicesService = { getServicesByIds: jest.fn() }` and `addOnsService = { getAddOnsByIds: jest.fn() }` mocks and providers (`ServicesService`, `AddOnsService` from `modules/catalog/application/services`). Default them in `describe('price')`'s `beforeEach` to return `[{ id: 'svc-1', name: 'Wash & Fold' }]` and `[]`. Unused providers are harmless before the constructor changes.
  - Add a top-level `describe('error precedence')` driven by an entry-point table, so Task 3 can add `previewPrice` without copying cases:
    ```ts
    // Each case sets up two or more failures; the first in the
    // "Error precedence" table must win, and nothing is written.
    const ENTRY_POINTS = {
      price: (input: PriceInput) => service.price({ ...input, actorId: 'a' }),
    };
    ```
    `PriceInput` is the spec-local `Omit<PriceLaundryOrderCommand, 'actorId'>`. The order comes from `manager.findOne` for `price`; set `orderRepository.findOneBy` to the same value too, so Task 3's preview entry reads it. Cases (`describe.each(Object.entries(ENTRY_POINTS))` × `it.each(cases)`):

    | Case | Setup (all other mocks succeed) | Expected error | Also asserts |
    | --- | --- | --- | --- |
    | C1 missing order beats invalid quantity | order not found; `baseQuantity: 0` | `NotFoundException` | `resolveEffectivePricing` not called |
    | C2 status beats invalid quantity | `PRICED`, weight 2000; `baseQuantity: 0` | `Cannot price a laundry order in status PRICED` | `resolveEffectivePricing` not called |
    | C3 weight beats invalid quantity | `WEIGHED`, weight `null`; `baseQuantity: 0` | `Laundry order has no recorded weight` | same |
    | C4 add-on quantity beats a missing price | `WEIGHED`; base rule `null`; `addOns: [{ addOnId: 'ao-1', quantity: 0 }]` | `quantity must be an integer >= 1` | `resolveEffectivePricing` not called |
    | C5 first missing price wins, later targets not resolved | base rule `null`; add-on `ao-1` rule `null` | `No effective price for serviceId svc-1` | `resolveEffectivePricing` called once |
    | C6 first missing add-on price wins | base rule ok; `ao-1` and `ao-2` rules `null` | `No effective price for addOnId ao-1` | `resolveEffectivePricing` called twice |

    Every case also asserts `manager.save`, `manager.update` and `auditLogger.log` were not called.
  - Run: `pnpm --filter api test -- laundry-orders.service`
    Expected: **PASS** against the unchanged service. These are **characterization tests**: they pin rows 1–6 of [Error precedence](#error-precedence) before `quote` is extracted. If any fails here, stop: the table above is wrong, not the code. Fix the table and this plan before going on.
  - Commit: `test(api): pin laundry pricing error precedence before extracting quote (#159)`

- [ ] **Step 2: Write failing unit tests** for the description, in the same spec:
  - Add to the precedence table (the order is `WEIGHED` with weight 2000 unless a case says otherwise):

    | Case | Setup | Expected error | Also asserts |
    | --- | --- | --- | --- |
    | C7 missing price beats missing name | base rule ok; `ao-1` rule `null`; `getServicesByIds` → `[]` | `No effective price for addOnId ao-1` | `getServicesByIds` and `getAddOnsByIds` not called |
    | C8 base name beats add-on name | all rules ok; `getServicesByIds` → `[]`; `getAddOnsByIds` → `[]` | `Service svc-1 could not be resolved` | — |
    | C9 add-on names in input order | all rules ok; `addOns` `ao-1`, `ao-2`; `getAddOnsByIds` → only `ao-1` | `Add-on ao-2 could not be resolved` | — |

    C7 passes before the change, because there is no lookup; it stays a guard that the new lookup comes after the rules. C8 and C9 fail first.
  - Extend the existing "freezes a PER_KG base line snapshot…" expectation with `description: 'Wash & Fold'`.
  - New: **"freezes the add-on description with the invoice suffix, once per repeated add-on"** — two `addOns` entries with the same `addOnId: 'ao-1'`, `getAddOnsByIds` returns `[{ id: 'ao-1', name: 'Ironing' }]`; assert two saved add-on lines, each `description: 'Ironing (add-on)'`.
  - New: **"looks names up in the command tenant"** — `getServicesByIds` called with `(['svc-1'], 't-a')`, `getAddOnsByIds` with the add-on ids and `'t-a'`.
  - The missing-name rejections (and their "writes nothing" checks) are C8 and C9 above.

- [ ] **Step 3: Run them and see them fail.**
  Run: `pnpm --filter api test -- laundry-orders.service`
  Expected: FAIL in C8, C9 (they resolve instead of rejecting) and the three description tests (`description` absent). C1–C7 still PASS. No `Nest can't resolve dependencies` error (the providers are supplied).

- [ ] **Step 4: Implement.**
  - Domain `LaundryOrderLinePricingSnapshot`: add, with a comment citing §8.4.2,
    ```ts
    // The catalog name copied once at pricing (Amendment #164 §8.4.2):
    // `Service.name`, or `AddOn.name + " (add-on)"`. Not a foreign key; a
    // later catalog rename does not change it.
    description: string;
    ```
  - Embeddable: `@Column({ type: 'text', name: 'pricingSnapshotDescription' }) description!: string;` and one header-comment line naming the column.
  - GraphQL `LaundryOrderLinePricingSnapshotType`: `@Field() description!: string;`
  - Service: inject `ServicesService` and `AddOnsService` (constructor order: after `pricingRulesService`, before the audit logger). Move the status check, the weight check, both `validateQuantity` passes and the per-target loop out of `price` into the private helper below, and add the name lookup there. **Delete** those checks from `price`: after this step, `price`'s callback is `this.lock(...)` → `const quoted = await this.quote(order, command)` → build and save the line entities from `quoted` → `assertTransition(order.status, S.PRICED)` → the status/total update → audit → re-read. Its transaction, lock, persistence, transition assertion and audit are unchanged. No precondition runs twice (see the ownership table under Architecture). The existing `price` tests and C1–C7 must stay green, and they show the move changed no behavior.

    ```ts
    // One quoting path for price and preview (spec §4.5 steps 1–4 and 3a;
    // Amendment #164 §8.4.2, §8.4.5). Writes nothing.
    private async quote(
      order: LaundryOrderEntity,
      input: Omit<PriceLaundryOrderCommand, 'actorId' | 'orderId'>,
    ): Promise<QuotedLine[]>
    ```
    Tenant scoping comes from `input.tenantId`; there is no separate `tenantId` parameter. The body moves rows 2–6 of [Error precedence](#error-precedence) out of `price` **without reordering them**, then adds row 7: `assertPriceable(order)` (the status check, then the weight check, with their existing messages), `validateQuantity(input.baseQuantity)`, `validateQuantity` for each add-on in input order, one `asOf = new Date()`, the existing `targets` array, then per target in that order: `resolveEffectivePricing(…, asOf, input.tenantId)` → the existing "No effective price" 400 → `resolveQuantity` → `computeLaundryLineAmount`. Only after the loop finishes, fetch names once: `getServicesByIds([input.baseServiceId], input.tenantId)` and `getAddOnsByIds(unique add-on ids, input.tenantId)`. Then build each line's `description`, base first and add-ons in input order; a missing name throws the invoice-guard 400. Return `{ serviceId, addOnId, snapshot }[]` in input order, where `snapshot` is the full `LaundryOrderLinePricingSnapshot` including `description` and `pricingRuleId`.
    `QuotedLine` is a module-private type in the service file.
  - Update every `new LaundryOrdersService(...)` call to pass `services` and `addOns`: `test/laundry.service.e2e-spec.ts` (`buildLaundryService` already constructs both), `test/billing.service.e2e-spec.ts` (two sites; construct `ServicesService` / `AddOnsService` the way `buildLaundryService` does if not already present).
  - Rows written outside the service gain the column: `test/remove-test-tenants.e2e-spec.ts` and `test/laundry-billing.tenant-isolation.e2e-spec.ts` raw `INSERT INTO "laundry_order_line_entity"` add `"pricingSnapshotDescription"` with `'Wash'`; `test/release-gate/two-tenant-world.ts` line fixture adds `description: 'Gate service'`.
  - `test/laundry.service.e2e-spec.ts`: the golden-path snapshot `toEqual` (around line 240) adds the expected `description` (its fixture's service name). Add one case: **"keeps the frozen description after a catalog rename"** — price an order, rename the service through `ServicesService.updateService`, re-read the line, the description is the pre-rename name.

- [ ] **Step 5: Run and see them pass.**
  Run: `pnpm --filter api test -- laundry` then `pnpm --filter api test:e2e -- laundry.service billing.service`
  Expected: PASS. The DI spec (`laundry.module.di.spec.ts`) passes unchanged because `FakeCatalogModule` already exports `ServicesService` and `AddOnsService`; if it does not, add the two `useValue: {}` providers there.

- [ ] **Step 6: Commit.** `feat(api): freeze the catalog name on priced laundry lines (#159)`

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
  12. **Same error precedence as price:** add `previewPrice: (input: PriceInput) => service.previewPrice(input)` to Task 2's `ENTRY_POINTS`. All of C1–C9 then run against preview with the same expected errors. For the preview entry, each case also asserts `dataSource.transaction` was not called. Cases 5–9 above stay as the single-failure checks. C1–C9 for preview are new behavior, not characterization, and fail first with `service.previewPrice is not a function`.

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
    - **Release-gate classifier: read the real preview payload, for this one field (test first).** The gate's `okFrom` (`test/release-gate/outcome.ts`) is generic. It recognizes `{ id }`, an array of `{ id }`, and a `{ nodes, totalCount }` connection. The preview has none of these. It has no id of its own, and its only number is money, which MUST NOT be read as a count. Rather than alias the response into a generic shape, `classifyGraphql` gets one **field-scoped** rule for the actual `LaundryPricePreview` contract. The generic rules are unchanged, and no other field can reach the new one.
      - Contract the rule checks: the value is an object whose `lines` is an array, with no `nodes`, `totalCount` or `id` key. Each line has **exactly one** of `serviceId` / `addOnId` as a string, and the other is `null` (the API's "exactly one set" rule, owner decision 1). The line's id is that target id. The result is `{ ids, kind: 'OK', totalCount: null }`, so it has no count. Anything else is `UNEXPECTED`.
      1. First, in `test/release-gate/outcome.e2e-spec.ts`, add `it('reads previewLaundryOrderPrice by its lines\' target ids, with no count')`. Use `classifyGraphql({ data: { previewLaundryOrderPrice: value } }, 'previewLaundryOrderPrice')` with:

         | Value | Expected |
         | --- | --- |
         | `{ lines: [{ serviceId: uuid, addOnId: null }] }` | `{ ids: [uuid], kind: 'OK', totalCount: null }` |
         | `{ lines: [{ serviceId: uuid, addOnId: null }, { serviceId: null, addOnId: uuid2 }] }` | `{ ids: [uuid, uuid2], kind: 'OK', totalCount: null }` (input order) |
         | `{ lines: [] }` | `{ ids: [], kind: 'OK', totalCount: null }` |
         | `{ lines: [{ serviceId: null, addOnId: null }] }` | `UNEXPECTED` (no target) |
         | `{ lines: [{ addOnId: null }] }` | `UNEXPECTED` (missing `serviceId`) |
         | `{ lines: [{ serviceId: 5, addOnId: null }] }` | `UNEXPECTED` (not a string) |
         | `{ lines: [{ serviceId: uuid, addOnId: uuid2 }] }` | `UNEXPECTED` (two targets) |
         | `{ lines: [{ serviceId: uuid, addOnId: null }], totalCount: 1000 }` | `UNEXPECTED` (money cannot pose as a count) |
         | `{ lines: [{ serviceId: uuid, addOnId: null }], nodes: [{ id: uuid }], totalCount: 1 }` | `UNEXPECTED` (mixed with a connection) |
         | `{ lines: 'x' }` and `{ estimatedTotalMinorUnits: 1000 }` | `UNEXPECTED` |

         And a second `it('keeps the preview rule scoped to previewLaundryOrderPrice')`:
         - `classifyGraphql({ data: { customer: { lines: [{ serviceId: uuid, addOnId: null }] } } }, 'customer')` is `UNEXPECTED`, because the generic rules see an object without `id`;
         - `classifyGraphql({ data: { previewLaundryOrderPrice: { id: uuid } } }, 'previewLaundryOrderPrice')` is `UNEXPECTED`, because the preview field never falls back to the generic `{ id }` rule;
         - a 403-coded error under `previewLaundryOrderPrice` still classifies as `FORBIDDEN` (errors are classified before the payload rule).

         Run: `pnpm --filter api test:e2e -- release-gate/outcome`
         Expected: FAIL on the three `OK` rows and on the `{ id: uuid }` preview case. Those go through the generic rules today: an object without `id` is `UNEXPECTED`, and `{ id }` is `OK`. The other rows already pass.
      2. Then, in `outcome.ts`:
         ```ts
         // Fields whose payload is the laundry price preview (#159). It has no
         // id of its own and its only number is money, so it is read by its
         // lines' target ids (exactly one of serviceId / addOnId per line) and
         // never as a connection or a count. Scoped by field: no other result
         // reaches this rule, and this field never reaches the generic ones.
         const PRICE_PREVIEW_FIELDS = new Set(['previewLaundryOrderPrice']);

         function okFromPricePreview(value: unknown, body: unknown): Outcome
         ```
         The function implements the contract above. In `classifyGraphql`, replace the last line's `okFrom(data[field], body)` with `PRICE_PREVIEW_FIELDS.has(field) ? okFromPricePreview(data[field], body) : okFrom(data[field], body)`. The `null` → `NULL` branch and all error handling are unchanged. `okFrom`, `classifyRest` and the existing tests are not edited.
         Run: `pnpm --filter api test:e2e -- release-gate/outcome`
         Expected: PASS, including every existing case.
    - `test/release-gate/probes/laundry.ts`: a probe for `Query.previewLaundryOrderPrice` that selects the real response fields, with no aliases:
      ```graphql
      query Gate($input: PriceLaundryOrderInput!) {
        previewLaundryOrderPrice(input: $input) {
          lines { serviceId addOnId }
        }
      }
      ```
      `prepare`: a `WEIGHED` order (`fixtures.laundryOrder(tenant, WEIGHED)`, weight 2000). `sameTenant`: `{ addOns: [{ addOnId: own.addOnId }], baseServiceId: own.serviceId, orderId: prepared.orderId }`. This is the same input `priceLaundryOrder`'s probe sends, so the classifier sees one service line and one add-on line. `ok: { kind: 'listIncludes', id: ({ own }) => own.serviceId }`: the same-tenant call succeeds **and** quotes the caller's own service. `crossTenant`, the same three variants as `priceLaundryOrder`, each with its declared missing form:
      - foreign `orderId` → `{ kind: 'error', status: 404 }`;
      - foreign `baseServiceId` (own order) → `{ kind: 'error', status: 400 }` (`No effective price for serviceId <uuid>`);
      - foreign `addOnId` (own order, `baseServiceId: own.serviceId`) → `{ kind: 'error', status: 400 }` (`No effective price for addOnId <uuid>`).

      The gate's existing phases assert these:
      - Phase 3: the query rejects a missing session.
      - Phase 4: across the seven roles on the caller's own data, TENANT_OWNER / OPS_MANAGER / SCHEDULER satisfy `ok` (the same-tenant preview succeeds and includes `own.serviceId`), and the other four get `FORBIDDEN`.
      - Phase 5: for every allowed role, each cross-tenant variant answers with its declared missing form, compared with a never-existed-id control after UUID normalization.
      - Phase 6: Phase 5 changed no row and wrote no audit row.
      - Phase 7: the same in the other direction.

      No probe-specific assertion code is needed beyond this declaration. Task 4 Step 4 runs the gate.
    - `test/tenant-read-authorizers.e2e-spec.ts` `CUSTOM_OBJECT_FIELDS`: `'LaundryPricePreview.lines': 'Plain value list returned by previewLaundryOrderPrice, which LaundryOrdersService computes for the principal tenant (#159); no resolver of its own.'`

- [ ] **Step 4: Run and see them pass.**
  Run: `pnpm --filter api test -- laundry-order.resolver` then `pnpm --filter api test:e2e -- root-operation-authorization tenant-read-authorizers relation-field-authorization release-gate/outcome release-gate/engine`
  then `pnpm --filter api test:e2e:release-gate`
  Expected: PASS. In the gate run:
  - Phases 1a/1b/2 find the new key in the classification, the role matrix and the probes, with matching `@Roles`.
  - Phase 4 passes the same-tenant `listIncludes` for TENANT_OWNER / OPS_MANAGER / SCHEDULER and gets `FORBIDDEN` for the other four roles.
  - Phase 5 gets the three cross-tenant missing forms (404, 400, 400), each matching its never-existed control.
  - Phase 6 finds no write.

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
- **Characterization tests** (pin behavior that is already correct and must not change): Task 2 Step 1's precedence cases C1–C6 against `price` are written and run **green before** `quote` is extracted, and are committed on their own, so the refactor is checked against them. C7 also passes before the change and then guards that the new name lookup runs after every rule. Task 3 case 11 "agrees with price" pins that the extracted `quote` did not change `price`'s amounts; the existing `price` unit and e2e cases kept green through Task 2 characterize the refactor. Task 5 case 2's "status unchanged" assertion on a `PRICED` order characterizes existing immutability.
- Sweep-guard edits in Task 4 are inventory updates the guards demand; they fail first by design (the guards reject an unclassified root field).

## Revision 2 (M5 review 1)

| Finding | Resolution |
| --- | --- |
| **P1: the `quote` extraction must keep `price`'s error order, and the plan did not show that order.** | New [Error precedence](#error-precedence) section. It records the current order at `fb0791e` with quoted code anchors (rows 1–6: lock, status, weight, base quantity, add-on quantities, rules in input order with the first missing rule throwing). It also fixes where the new name check goes (row 7: after every rule; base name, then add-ons in input order). The Global Constraint now points to that table. Task 2 Step 4 says `quote` moves rows 2–6 without reordering them, and fetches names only after the rule loop finishes. |
| **P2: the `quote` signature disagreed between Architecture and Task 2.** | One signature everywhere: `quote(order, input)`, where `input` is `Omit<PriceLaundryOrderCommand, 'actorId' \| 'orderId'>` and carries `tenantId`. Architecture now says so, Task 2 Step 4 states there is no separate `tenantId` parameter, and Task 3 already called `quote(order, query)`. |
| **P2: no test pinned the order between competing failures.** | Task 2 Step 1 adds an entry-point-driven precedence table. C1–C6 are characterization tests run green against the unchanged service and committed before the refactor: missing order beats invalid quantity; status beats invalid quantity; weight beats invalid quantity; invalid add-on quantity beats a missing price; the first missing price wins and later targets are not resolved. Task 2 Step 2 adds C7 (a missing price beats a missing name; no catalog-name read happens), C8 (base name before add-on name) and C9 (add-on names in input order). Every case asserts nothing is written. Task 3 case 12 runs the same C1–C9 against `previewPrice`, and also asserts no transaction. |

The M7 requirement for a fresh independent reviewer is unchanged.

## Revision 3 (M5 review 2)

| Finding | Resolution |
| --- | --- |
| **P2: Task 2 contradicted itself on who owns the pricing preconditions.** It said `price` "keeps its … precondition … exactly as today" and also that `quote` takes the status and weight checks, so the implementer could duplicate them or break the wording. | Decision: `quote` owns every pricing precondition, each run exactly once, in Error-precedence order (status, weight, quantity shape, rule resolution, names). `price` keeps only the transaction, the lock, persistence, the transition assertion and the audit. `previewPrice` keeps only its read. Architecture now says so and adds a responsibility/owner table. Task 2 Step 4 now says to **delete** the moved checks from `price`, and gives `price`'s callback after the change: lock → `quote` → save lines → `assertTransition` → update → audit → re-read. The existing `price` tests and C1–C7 stay the evidence that the move changed no behavior. |

## Revision 4 (M5 review 3)

| Finding | Resolution |
| --- | --- |
| **P2: the release-gate probe aliased `estimatedTotalMinorUnits` (money) as `totalCount` (a count).** | Decision: an explicit classifier shape, not an alias. Task 4 adds one rule to `release-gate/outcome.ts`: `{ items: [{ id }] }` is `OK` with those ids and `totalCount: null`. It is rejected as `UNEXPECTED` when an id is missing or not a string, or when mixed with `nodes` or `totalCount`, so a number can never pose as a count. It is test first in `outcome.e2e-spec.ts`: five cases, two failing first. The probe now selects only `items: lines { id: serviceId }`. Same-tenant success is `listIncludes own.serviceId`. The three cross-tenant variants keep their declared 404 / 400 / 400 missing forms. The gate's Phase 5 checks those against a never-existed control, Phase 6 checks that nothing was written, and Phase 4 checks the role split and same-tenant success. The earlier "alias by default, gate change only if rejected" fallback text is removed. |

## Revision 5 (M5 review 4)

| Finding | Resolution |
| --- | --- |
| **P2: the probe's `items` alias did not match the declared `LaundryPricePreview` shape, and the classifier rule was not tied to the preview.** | Decision: the reviewer's preferred option. The classifier reads the **actual** payload, `{ lines: [{ serviceId, addOnId }] }`, and only for the `previewLaundryOrderPrice` field (`PRICE_PREVIEW_FIELDS`). Each line's id is its one target id, mirroring the API's "exactly one of `serviceId` / `addOnId`" contract, and the result has no count. The revision-4 `items` rule is removed; `okFrom` and its tests are untouched. The probe selects `lines { serviceId addOnId }` with no aliases, and sends a service plus an add-on, so both target kinds are classified. Tests, written first: three `OK` rows (service only, service then add-on in order, empty); four invalid-target rows (none, missing, non-string, two); two ambiguity rows (`totalCount: 1000`, mixed with `nodes`/`totalCount`); two malformed rows. A scoping test shows the same `lines` body under another field stays `UNEXPECTED`, the preview field never falls back to `{ id }`, and errors under the preview field still classify by status. Same-tenant success (`listIncludes own.serviceId`) and the three cross-tenant missing forms are unchanged. |

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
- The release-gate outcome classifier (`release-gate/outcome.ts`) recognizes a single `{ id }`, an array of `{ id }`, or a `{ nodes, totalCount }` connection. A connection must carry a numeric `totalCount`. Anything else is `UNEXPECTED`. `engine.ts`'s `listIncludes` reads only `ids`.
- `apps/web/lib/laundry-order-page.render.test.tsx` declares its own `Line` type, not the generated fragment type; the added fragment field does not affect it.
- `packages/client/codegen.ts` reads `apps/api/src/schema.gql`.
