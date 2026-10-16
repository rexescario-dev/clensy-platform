# Database migrations

How to change the database schema, and the reference list of every migration that contains hand-written SQL that `migration:generate` cannot reproduce. Read the [hand-written objects](#hand-written-objects-by-migration) section before applying any generated migration.

## The rule

The schema comes only from migrations: TypeORM runs with `synchronize: false`. Every schema change is a reviewed migration file in `apps/api/src/platform/database/migrations/`. The Docker stack's `migrate` service applies pending migrations before the API starts, and both CI database jobs run `migration:run` on a fresh database.

## Commands

Run from the repository root. They use `apps/api/.env` (`DB_HOST=localhost` and the host-mapped `DB_PORT` for the Docker Postgres).

```bash
pnpm --filter api migration:generate add customer phone number  # after changing an entity
pnpm --filter api migration:run       # apply pending migrations
pnpm --filter api migration:revert    # roll back the last one
```

- `migration:generate` takes a plain phrase, a PascalCase name, or anything in between (`scripts/generate-migration.ts` normalizes it), and writes `<timestamp>-AddCustomerPhoneNumber.ts`.
- `generate` diffs the entities registered in `data-source.ts` against the **actual database**. Run it against a database that has every previous migration applied, never a synchronized or ad-hoc schema, or the diff will be wrong.
- `apps/api/src/platform/database/data-source.ts` is a plain `DataSource` for the CLI, because the CLI cannot consume `database.module.ts`'s Nest-wrapped, `ConfigService`-driven config. It has its own `tsconfig.cli.json` (forcing `commonjs`/`node` resolution): the TypeORM CLI loads the data source through Node's native ESM resolver, which the project's `nodenext` config does not satisfy for a plain `ts-node` script.

Registered entities: `BookingEntity`, `TenantEntity`, `AdminUserEntity`, `AuditEventEntity`, `CustomerEntity`, `PropertyEntity`, `TeamEntity`, `CleanerEntity`, `ServiceEntity`, `AddOnEntity`, `PricingRuleEntity`, `CleaningJobEntity`, `ChecklistEntity`, `ChecklistItemEntity`, `LaundryOrderEntity`, `LaundryOrderLineEntity`, `InvoiceEntity`, `InvoiceLineEntity`.

## Reviewing a generated migration

Many constraints are hand-written because entity metadata cannot express them (composite tenant FKs, `CHECK`s, expression and partial indexes, a counter table). `generate` does not know about them, so **every generated migration must be reviewed line by line**:

- **Do not apply** proposals to drop or recreate any object listed below.
- **Known noise** that `generate` re-proposes, all to be deleted from the generated file:
  - `CHECK` constraints re-proposed with extra parentheses (`ck_pricing_rule_target`, `ck_laundry_order_weight_non_negative`, `ck_laundry_order_line_target`);
  - drop/recreate of `fk_cleaning_job_*`, `fk_checklist_job`, `fk_pricing_rule_*`, `uq_pricing_rule_*`, `ck_*`, `UQ_cleaning_job_booking_id`, `UQ_checklist_job_id`, and `pricing_rule_entity."effectiveFrom"`'s `DEFAULT`;
  - creating the shared `admin_scope_enum` type twice (once per column that uses it);
  - re-adding the id-only booking FKs that `AddBookingTenant` replaced.
- `generate` will not touch the hand-written indexes, but it will not regenerate them either if they are ever lost.

Several FK columns deliberately have **no** TypeORM relation decorator, or a relation with `createForeignKeyConstraints: false`, because their real constraint is a hand-written composite FK. Do not "fix" that by adding a decorator.

## Migrating an existing database

On a fresh database every migration runs cleanly. On a database with existing data, the tenant migrations validate first and abort, changing nothing, when the data would violate the new rules. **Take a backup first**; `AddTenantAndAdminScope` is irreversible.

| Migration | Before running it on existing data |
| --- | --- |
| `AddTenantAndAdminScope` | List `OWNER` accounts and designate each one (below). |
| `AddCustomerPropertyTenant` | No two customers may share an email ignoring case. |
| `AddBookingTenant`, `AddJobChecklistTenant`, `AddLaundryBillingTenant` | No row may reference another tenant's data (typical in dev databases holding old two-tenant test fixtures). |

## Hand-written objects by migration

In timestamp order. No hand-written objects are recorded for migrations not listed here. Recorded no-ops: `AddBookingRelations` and the four `…Inverse` migrations (`1787934015018` to `1787936000000`), which add relation metadata only. `1790870400000-AddTenantLabelOverrides` adds the `tenant_entity."labelOverrides"` `jsonb` column.

Specs referenced: [Customers & Properties](../superpowers/specs/2026-08-15-customers-properties-design.md), [Cleaners & Teams](../superpowers/specs/2026-08-16-cleaners-teams-design.md), [Catalog](../superpowers/specs/2026-08-16-catalog-design.md), [Jobs & Checklists](../superpowers/specs/2026-08-27-jobs-checklists-design.md), [nestjs-query GraphQL reads](../superpowers/specs/2026-08-28-nestjs-query-graphql-reads-design.md), [Laundry catalog foundation](../superpowers/specs/2026-09-06-laundry-catalog-foundation-design.md), [Laundry orders lifecycle](../superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md), [Laundry invoices](../superpowers/specs/2026-09-06-laundry-invoices-design.md), [Multi-tenant architecture](../superpowers/specs/2026-09-23-multi-tenant-architecture-design.md).

### Pre-tenancy foreign keys and indexes (superseded where noted)

These columns carry no relation decorator by design, so their FKs were hand-written:

| Migration | Hand-written object | Status |
| --- | --- | --- |
| `1786807294116-AddProperty` | FK for `PropertyEntity.customerId` (Customers & Properties spec §4.5) | Replaced by `fk_property_customer_tenant` |
| `1786871992353-AddCleaner` | `fk_cleaner_team` for `CleanerEntity.teamId` (Cleaners & Teams spec §4.1) | Replaced by `fk_cleaner_team_tenant` |
| `1786893419092-AddService`, `1786894582095-AddAddOn` | Case-insensitive unique index on `LOWER("name")` (a plain `unique: true` is case-sensitive; Catalog spec §4.7) | Replaced by `uq_service_tenant_name_lower` / `uq_add_on_tenant_name_lower` |
| `1786928772298-AddPricingRule` | `fk_pricing_rule_service` for `PricingRuleEntity.serviceId` (Catalog spec §4.1) | Replaced by `fk_pricing_rule_service_tenant` |
| `1786928772298-AddPricingRule` | Partial unique index `uq_pricing_rule_active_service` (`WHERE "active" = true`): at most one active rule per service | **Current** |
| `1787355028101-MigrateBookingReferences` | `fk_booking_customer` / `_property` / `_service` / `_team` | Replaced by composite tenant FKs. `1787894029231-AddBookingRelations` later added unidirectional `@ManyToOne` metadata (nestjs-query reads spec §4.1) and is a recorded no-op. |
| `1787764597814-AddCleaningJob` | FKs for `CleaningJobEntity.bookingId`/`teamId`, `ChecklistEntity.jobId`, `ChecklistItemEntity.checklistId` (Jobs & Checklists spec §4.1) | Job and checklist FKs replaced by composite tenant FKs; `checklistId` current |
| `1788630872126-ExtendPricingRuleEffectiveDating` | `fk_pricing_rule_addon` for `PricingRuleEntity.addOnId` (Catalog spec §4.1, Laundry catalog foundation spec §4.2) | Replaced by `fk_pricing_rule_add_on_tenant` |
| `1788630872126-ExtendPricingRuleEffectiveDating` | `ck_pricing_rule_target` (`num_nonnulls("serviceId", "addOnId") = 1`) and partial unique indexes `uq_pricing_rule_open_service` / `uq_pricing_rule_open_addon` (`WHERE "effectiveTo" IS NULL`) | **Current** |

### `1788670020409-CreateLaundryOrders`

Laundry orders lifecycle spec §4.10.

- Two `CHECK`s: `ck_laundry_order_weight_non_negative` (`"weightGrams" IS NULL OR "weightGrams" >= 0`) and `ck_laundry_order_line_target` (`num_nonnulls("serviceId", "addOnId") = 1`).
- `laundry_order_line_entity.pricingSnapshotPricingRuleId` is deliberately a plain `uuid` with **no** FK: a soft traceability pointer. The embedded pricing snapshot, not the `PricingRule` row, is authoritative for what was charged (spec §4.2, §4.8). Do not add a relation or FK.
- `laundry_order_entity.customerId` and `laundry_order_line_entity.laundryOrderId`/`serviceId`/`addOnId` carry `@ManyToOne` metadata. Their id-only FKs were replaced in `AddLaundryBillingTenant`, and the relations now set `createForeignKeyConstraints: false`.

### `1788698812742-CreateBillingInvoices`

Laundry invoices spec §4.9.

- Hand-written: `CREATE SEQUENCE billing_invoice_number_seq` (and `DROP SEQUENCE` in `down()`). Replaced by per-tenant numbering in `AddLaundryBillingTenant`.
- Everything else is generator output: `invoice_entity`/`invoice_line_entity`, three module-local enums, `uq_invoice_number`, `uq_invoice_laundry_order`, the FKs.
- `invoice_entity.laundryOrderId`/`customerId` carry `@ManyToOne` metadata. `invoice_line_entity` has **no** FK to any catalog or order-line table by design: it is a self-contained historical snapshot (spec §4.2, §4.4).

### `1790180877633-AddTenantAndAdminScope`

Multi-tenant spec §4.1, §4.3, §4.7. **Irreversible**: `migration:revert` refuses.

- Creates `tenant_entity` with exactly one bootstrap tenant (`BOOTSTRAP_TENANT_ID` in `platform/database/bootstrap-tenant.ts`) and retires the `OWNER` role.
- **Before running it on a database with `OWNER` accounts:** list them (`SELECT id, email FROM admin_user_entity WHERE role = 'OWNER';`) and add one entry per account to `apps/api/src/platform/database/owner-designations.ts`, as `SUPER_ADMIN` or `TENANT_OWNER` of the bootstrap tenant. The migration aborts, leaving `OWNER` in the enum, on any missing, extra, duplicate or invalid designation. The committed list is empty, which is correct for a fresh database.
- Hand-written `CHECK`s: `ck_admin_user_platform_scope`, `ck_admin_user_tenant_scope` (the scope/role/`tenantId` triple), `ck_audit_event_scope_tenant`.

### `1790265191400-AddCustomerPropertyTenant`

Multi-tenant spec §4.4, §4.5, §4.7. One transaction.

- Adds a required `tenantId` to `customer_entity` and `property_entity`; backfills every row onto the bootstrap tenant.
- **Aborts, changing nothing,** if the bootstrap tenant is missing or two customers in the same tenant share an email ignoring case. The error lists each conflicting tenant, email and customer id. Fix the duplicates by hand and re-run; the migration never merges or deletes customers.
- Hand-written: `uq_customer_id_tenant`, `uq_property_id_tenant`, the expression index `uq_customer_tenant_email` (`("tenantId", lower(email))`), and the composite FK `fk_property_customer_tenant` (`("customerId", "tenantId") → customer_entity(id, "tenantId")`), which replaces `fk_property_customer`. `PropertyEntity.customer` sets `createForeignKeyConstraints: false`.

### `1790438400000-AddTeamCleanerTenant`

Multi-tenant spec §4.4, §4.5, §4.7. One transaction.

- Adds a required `tenantId` to `team_entity` and `cleaner_entity`; backfills onto the bootstrap tenant. Aborts if the bootstrap tenant is missing.
- No duplicate pre-check: the global `UNIQUE(name)`/`UNIQUE(email)` it replaces already guarantee no duplicates.
- Hand-written: `uq_team_id_tenant`, `uq_cleaner_id_tenant` (composite-FK targets); per-tenant uniques `uq_team_tenant_name` and `uq_cleaner_tenant_email` (both **case-sensitive**, unlike `uq_customer_tenant_email`); the composite FK `fk_cleaner_team_tenant` (`("teamId", "tenantId") → team_entity(id, "tenantId")`), replacing `fk_cleaner_team`; list indexes `idx_team_tenant_created`, `idx_cleaner_tenant_created`. `CleanerEntity.team` sets `createForeignKeyConstraints: false`.

### `1790524800000-AddCatalogTenant`

Multi-tenant spec §4.4, §4.5, §4.7. One transaction.

- Adds a required `tenantId` to `service_entity`, `add_on_entity` and `pricing_rule_entity`; backfills onto the bootstrap tenant. Aborts if the bootstrap tenant is missing. No duplicate pre-check (the global `LOWER(name)` indexes it replaces rule duplicates out).
- Hand-written: `uq_service_id_tenant`, `uq_add_on_id_tenant` (composite-FK targets); case-insensitive `uq_service_tenant_name_lower` / `uq_add_on_tenant_name_lower` (`("tenantId", LOWER("name"))`); composite FKs `fk_pricing_rule_service_tenant` / `fk_pricing_rule_add_on_tenant` (`("serviceId"|"addOnId", "tenantId") → service_entity|add_on_entity(id, "tenantId")`), replacing `fk_pricing_rule_service` / `fk_pricing_rule_addon`; list indexes `idx_service_tenant_created`, `idx_add_on_tenant_created`.
- `PricingRuleEntity.serviceId`/`addOnId` remain plain columns. `ck_pricing_rule_target` and the three pricing-rule partial unique indexes are unchanged.

### `1790611200000-AddBookingTenant`

Multi-tenant spec §4.4, §4.5, §4.7. One transaction; validates before relaxing any constraint.

- Adds a required `tenantId` to `booking_entity`; backfills onto the bootstrap tenant.
- **Aborts, changing nothing,** if the bootstrap tenant is missing or any booking references a customer, property, service or non-null team outside the bootstrap tenant. Remedy: delete those bookings and their cleaning jobs (jobs first: `fk_cleaning_job_booking` is `ON DELETE RESTRICT`), then re-run. Relevant for dev databases holding #82–#84 cross-tenant fixtures.
- Hand-written: `uq_booking_id_tenant` (target of `fk_cleaning_job_booking_tenant`); composite FKs `fk_booking_customer_tenant` / `_property_tenant` / `_service_tenant` / `_team_tenant` (`(refId, "tenantId") → parent(id, "tenantId")`), replacing the id-only FKs; list index `idx_booking_tenant_scheduled` (`("tenantId", "scheduledAt" DESC, "id")`, matching the `bookings` default sort). All four relations set `createForeignKeyConstraints: false`.

### `1790697600000-AddJobChecklistTenant`

Multi-tenant spec §4.4, §4.5, §4.7. One transaction; validates first.

- Adds a required `tenantId` to `cleaning_job_entity` and `checklist_entity`; backfills onto the bootstrap tenant. `checklist_item_entity` is unchanged: items are owned through their checklist.
- **Aborts, changing nothing,** if the bootstrap tenant is missing or any job references a booking or non-null team outside the bootstrap tenant. Remedy: delete those jobs (checklists and items cascade) and re-run. Relevant for dev databases holding #85 fixtures.
- Hand-written: `uq_cleaning_job_id_tenant`; composite FKs `fk_cleaning_job_booking_tenant` / `fk_cleaning_job_team_tenant` (`ON DELETE RESTRICT`) and `fk_checklist_job_tenant` (`ON DELETE CASCADE`), replacing `fk_cleaning_job_booking` / `_team` / `fk_checklist_job` with the same delete actions; list index `idx_cleaning_job_tenant_scheduled` (`("tenantId", "scheduledAt" DESC, "id")`). `CleaningJobEntity.booking` sets `createForeignKeyConstraints: false`; `teamId` and `ChecklistEntity.jobId` stay plain columns.

### `1790784000000-AddLaundryBillingTenant`

Multi-tenant spec §4.4, §4.5, §4.7. One transaction; validates first.

- Adds a required `tenantId` to `laundry_order_entity`, `laundry_order_line_entity` and `invoice_entity`. Orders and invoices are backfilled onto the bootstrap tenant; lines take their order's tenant. `invoice_line_entity` is unchanged: invoice lines are owned through their invoice.
- **Aborts, changing nothing,** if the bootstrap tenant is missing, any row is left without a tenant, any order, line or invoice references a customer, order, service or add-on outside its own tenant, or any existing `invoiceNumber` is not `INV-{YYYY}-{6+ digits}`, has a suffix outside `1 … 2^53 − 1`, or repeats a suffix within a tenant. Remedy: delete the offending rows (typically #82/#84 fixtures in a dev database) and re-run.
- Hand-written: `uq_laundry_order_id_tenant`; six composite FKs `(refId, "tenantId") → parent(id, "tenantId")`: `fk_laundry_order_customer_tenant`, `fk_laundry_order_line_order_tenant` (`ON DELETE CASCADE`), `fk_laundry_order_line_service_tenant`, `fk_laundry_order_line_add_on_tenant`, `fk_invoice_laundry_order_tenant`, `fk_invoice_customer_tenant`, replacing the id-only FKs with the same delete actions; list indexes `idx_laundry_order_tenant_created`, `idx_invoice_tenant_issue`.
- **Invoice numbers are unique per tenant** (`uq_invoice_tenant_number` replaces `uq_invoice_number`) and allocated from the hand-written `invoice_number_counter` table (one row per tenant, no entity). `InvoicesService.generateFromOrder` increments it with a transactional upsert. The migration seeds it from the highest existing suffix before dropping `billing_invoice_number_seq`.
- `migration:revert` restores a *usable* sequence positioned after the highest remaining suffix (not the exact earlier state), and refuses up front, with a counted error and no changes, once two tenants hold the same invoice number string.

### `1790956800000-AddLaundryLineDescription`

Laundry orders lifecycle spec, Amendment #164 §8.4.2.

- Adds `laundry_order_line_entity."pricingSnapshotDescription"` (`text`), then fills every existing line with the catalog name **as it is when the migration runs** (`Service.name`, or `AddOn.name || ' (add-on)'`, joined on id and `tenantId`), then sets `NOT NULL`. That is the name at migration time, not at pricing time, which was never stored.
- The `NOT NULL` step cannot fail: the composite catalog FKs guarantee every line finds its row.
- `down()` drops only the column. The column is entity metadata on `LaundryOrderLinePricingSnapshotEmbeddable`, so `generate` models it; only the backfill is hand-written.
