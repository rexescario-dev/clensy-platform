# Clensy Platform

A NestJS + TypeORM + GraphQL comparison harness — built to evaluate TypeORM's developer experience against [`flash-sale-system`](https://github.com/rexescario-dev/flash-sale-system)'s NestJS + Prisma + GraphQL stack, to settle on a personal standard. It also runs REST and GraphQL side by side against the same business logic, to compare those two API styles directly.

pnpm workspace + Turborepo monorepo:

```text
apps/
├── api/      NestJS + TypeORM + GraphQL (code-first, Apollo) + REST
└── web/      Next.js (App Router) web console — /login (public); /app, /app/admin,
              /app/customers, /app/cleaners, /app/cleaners/teams, /app/catalog,
              /app/catalog/add-ons, /app/bookings, /app/jobs (protected, under the shared /app shell)

packages/
├── ui/       shared UI system (primitives and composition together) for apps/web
│             (and any future consumer): Button, Avatar, Checkbox, DropdownMenu,
│             Separator, Sheet, Skeleton, Table, Tooltip, Input, Label, Field,
│             DataTable, Pagination, FormField, StatusBadge, Modal, FormDialog,
│             ConfirmDialog, DetailDrawer, PageHeader, ToastProvider/useToast,
│             LoadingState, EmptyState, ErrorState
├── web/      reusable Clensy domain components (components representing a Clensy
│             business concept), positioned between @clensy/ui and apps/web —
│             auth/LoginForm, bookings/BookingDataTable, staff/StaffDataTable +
│             staff/CreateStaffForm, and roles/ (shared role identity + labels). See
│             packages/web/README.md for the boundary rules.
├── client/   Apollo Client + graphql-codegen-generated hooks against apps/api's schema
├── validation/ Laravel-inspired rule strings, field-error contract, React Hook Form
│               resolver, and GraphQL validation-error normalizer for apps/web
├── graphql/  not yet implemented
├── auth/     not yet implemented
├── domain/   not yet implemented
├── config/   not yet implemented
└── testing/  not yet implemented
```

`packages/graphql`, `auth`, `domain`, `config`, `testing` stay empty stubs deliberately — the [Phase 1 design](docs/superpowers/specs/2026-08-14-clensy-platform-phase1-design.md) defers each extraction until a second consumer actually needs the shared code, rather than speculatively factoring it out now.

## `apps/api/src` structure

Each business module is layered domain → application → infrastructure → presentation, so REST and GraphQL are thin adapters over the same business logic rather than separate implementations. `bookings` below is the worked example (it's also the only module with a REST surface, kept for the REST/GraphQL comparison this repo exists to run); `modules/admins`, `modules/customers`, `modules/cleaners`, `modules/catalog`, and `modules/jobs` follow the identical domain/application/infrastructure/presentation layering but are GraphQL-only, per the [Phase 1 design](docs/superpowers/specs/2026-08-14-clensy-platform-phase1-design.md)'s "Presentation: GraphQL only" default for every module after `bookings`. `platform/auth` (JWT session auth, `AuthGuard`, `@Roles()`/`@CurrentUser()`) and `platform/audit` (`AuditEvent`, `AuditLogger`) are shared platform infrastructure, not business modules — every mutation across `admins`/`customers`/`cleaners`/`catalog`/`jobs` is authenticated, role-gated, and audit-logged through them (see the [Admin Foundation](docs/superpowers/specs/2026-08-14-admin-foundation-design.md), [Customers & Properties](docs/superpowers/specs/2026-08-15-customers-properties-design.md), [Cleaners & Teams](docs/superpowers/specs/2026-08-16-cleaners-teams-design.md), [Catalog](docs/superpowers/specs/2026-08-16-catalog-design.md), [Bookings](docs/superpowers/specs/2026-08-22-bookings-design.md), and [Jobs & Checklists](docs/superpowers/specs/2026-08-27-jobs-checklists-design.md) specs):

```text
src/
├── app/
│   └── app.module.ts       composition root — wires platform/ + modules/
├── main.ts                 bootstrap: global ValidationPipe, Swagger UI
│
├── modules/
│   └── bookings/
│       ├── domain/                    plain TypeScript — no NestJS/TypeORM/GraphQL decorators
│       │   ├── booking.ts
│       │   └── booking-status.ts
│       │
│       ├── application/
│       │   ├── commands/              transport-agnostic contracts (CreateBookingCommand, ...)
│       │   └── services/              use-case implementation (bookings.service.ts)
│       │
│       ├── infrastructure/
│       │   └── persistence/           TypeORM entity — kept separate from domain and from
│       │       ├── booking.entity.ts  the GraphQL/REST types (see "Two presentation surfaces" below)
│       │       └── seed/              seed-data.ts (plain data) + seeder.ts (TypeORM upsert)
│       │
│       ├── presentation/
│       │   ├── graphql/               BookingReadResolver + BookingMutationResolver,
│       │   │                          BookingDTO, InputTypes (own class-validator rules)
│       │   └── rest/                  controller, DTOs (own class-validator rules + @ApiProperty)
│       │
│       └── tests/                     mirrors application/ · graphql/ · rest/
│
└── platform/                          shared infrastructure, not business logic
    ├── config/
    ├── database/
    │   ├── database.module.ts         TypeOrmModule wiring (synchronize: false — schema comes
    │   │                               from migrations, see "Database migrations" below)
    │   ├── data-source.ts             plain DataSource for the TypeORM CLI
    │   ├── migrations/                generated migration files
    │   └── seed.ts                    `pnpm db:seed` entrypoint — calls each module's seeder
    └── graphql/
        ├── graphql.module.ts          Apollo driver + NestjsQueryGraphQLModule.forRoot({})
        │                               (playground: false — no landing page at /graphql,
        │                               see "GraphQL IDE" below)
        ├── graphiql.controller.ts     GET /graphiql (HTML) — dev-only (registered only when
        │                               NODE_ENV !== 'production')
        ├── graphiql/
        │   └── graphiql.entry.ts      browser entry point — bundled by scripts/build-graphiql.ts
        ├── directives/                reserved, not yet implemented
        └── scalars/                   reserved, not yet implemented

apps/api/
├── scripts/
│   └── build-graphiql.ts   esbuild: React + GraphiQL + CSS + Monaco's worker bundles, locally
│                            bundled and served entirely from application-owned static assets
│                            — no CDN (see "GraphQL IDE" below; NOT a single-file bundle)
└── public/graphiql/        generated, gitignored — served at /graphiql-static (see below)
```

**Two presentation surfaces, one application layer:** both `presentation/graphql/booking.resolver.ts` (`BookingMutationResolver`) and `presentation/rest/booking.controller.ts` map their own transport input (`CreateBookingInput` / `CreateBookingDto`) into the same `CreateBookingCommand` before calling `BookingsService` — the command is the shared contract, not either DTO. GraphQL **reads** for Booking go through nestjs-query (`BookingReadResolver` = `Relatable(ReadResolver)` over `BookingDTO`); writes stay on `BookingsService`. This is also why the TypeORM entity, the domain type, and the GraphQL `Booking` object type (`BookingDTO`) are three separate classes instead of one decorated class: it keeps persistence, business rules, and each transport's shape free to evolve independently.

## Setup

```bash
cp .env.example .env   # first time only
docker compose up -d --build
```

That's it — `docker compose up` builds and runs `apps/api` (Dockerfile) and `apps/web` (Dockerfile.web) together, both connecting to the `postgres` service over the container network. Set `APP_DEBUG=true` in `.env` and **recreate the API container** (`docker compose up -d api`) to print TypeORM SQL on API stdout (`docker compose logs -f api`); anything other than the exact string `true` leaves query logging off. A `migrate` service runs the pending migrations once before `api` starts (`depends_on: condition: service_completed_successfully`); the table is then empty but schema-correct — see "Seeding fake data" below. `apps/web`'s `NEXT_PUBLIC_API_URL` isn't set in `docker-compose.yml` — it falls back to `http://localhost:3000/graphql` (`packages/client/src/apollo-client.ts`), which is correct here since the browser reaches `api` via the host-mapped port, not the container network.

## Database migrations

No `synchronize: true` — schema changes go through real, reviewable migrations, closer to how `flash-sale-system` uses Prisma migrations.

```bash
pnpm --filter api migration:generate add customer phone number  # after changing an entity
pnpm --filter api migration:run       # apply pending migrations
pnpm --filter api migration:revert    # roll back the last one
```

`migration:generate` takes a plain phrase (or an already-PascalCase name, or anything in between — `scripts/generate-migration.ts` normalizes it) and writes it into `src/platform/database/migrations/` as `<timestamp>-AddCustomerPhoneNumber.ts`.

`generate` diffs the TypeORM entities registered in `data-source.ts` (`BookingEntity`, `TenantEntity`, `AdminUserEntity`, `AuditEventEntity`, `CustomerEntity`, `PropertyEntity`, `TeamEntity`, `CleanerEntity`, `ServiceEntity`, `AddOnEntity`, `PricingRuleEntity`, `CleaningJobEntity`, `ChecklistEntity`, `ChecklistItemEntity`, `LaundryOrderEntity`, `LaundryOrderLineEntity`, `InvoiceEntity`, `InvoiceLineEntity`) against the actual database, so run it against an environment that already has the *previous* migration applied (not a synchronized or ad-hoc schema) — otherwise the diff will be wrong. Five FK columns still carry no TypeORM relation decorator by design: `PropertyEntity.customerId` (see the [Customers & Properties spec](docs/superpowers/specs/2026-08-15-customers-properties-design.md) §4.5), `CleanerEntity.teamId` (see the [Cleaners & Teams spec](docs/superpowers/specs/2026-08-16-cleaners-teams-design.md) §4.1 — its original id-only FK, `fk_cleaner_team`, was replaced by the hand-written composite `fk_cleaner_team_tenant` in `1790438400000-AddTeamCleanerTenant.ts`, described below), `PricingRuleEntity.serviceId`/`addOnId` (see the [Catalog spec](docs/superpowers/specs/2026-08-16-catalog-design.md) §4.1 and the [Laundry Architecture & Catalog Foundation spec](docs/superpowers/specs/2026-09-06-laundry-catalog-foundation-design.md) §4.2 — their original id-only FKs, `fk_pricing_rule_service`/`fk_pricing_rule_addon`, were replaced by the hand-written composite `fk_pricing_rule_service_tenant`/`fk_pricing_rule_add_on_tenant` in `1790524800000-AddCatalogTenant.ts`, described below), and Jobs' `CleaningJobEntity.bookingId`/`teamId` plus intra-module `ChecklistEntity.jobId` / `ChecklistItemEntity.checklistId` (see the [Jobs & Checklists spec](docs/superpowers/specs/2026-08-27-jobs-checklists-design.md) §4.1). Their foreign keys are hand-written directly into `1786807294116-AddProperty.ts`, `1786871992353-AddCleaner.ts` (`teamId`'s original FK — superseded, see below), `1786928772298-AddPricingRule.ts` (`serviceId`'s original FK — superseded, see below) and `1788630872126-ExtendPricingRuleEffectiveDating.ts` (`addOnId`'s original FK — superseded, see below), and `1787764597814-AddCleaningJob.ts` respectively — re-running `generate` after touching any of these entities will propose dropping the constraint; don't apply that. `1788630872126-ExtendPricingRuleEffectiveDating.ts` also hand-adds a mutual-exclusivity `CHECK` (`ck_pricing_rule_target`, `num_nonnulls("serviceId", "addOnId") = 1`) and two more partial unique indexes (`uq_pricing_rule_open_service`/`uq_pricing_rule_open_addon`, `WHERE "effectiveTo" IS NULL`) — none derivable from entity metadata either. `BookingEntity`'s `customerId`/`propertyId`/`serviceId`/`teamId` now have unidirectional `@ManyToOne` metadata (see [nestjs-query GraphQL Reads](docs/superpowers/specs/2026-08-28-nestjs-query-graphql-reads-design.md) §4.1); the constraints themselves already existed in `1787355028101-MigrateBookingReferences.ts`, so `1787894029231-AddBookingRelations.ts` is a recorded no-op. Those four id-only FKs (`fk_booking_customer`/`fk_booking_property`/`fk_booking_service`/`fk_booking_team`) were superseded by hand-written composite `(refId, "tenantId")` FKs in `1790611200000-AddBookingTenant.ts`, described below: all four relations now set `createForeignKeyConstraints: false`. `1786893419092-AddService.ts` and `1786894582095-AddAddOn.ts` originally carried a second, unrelated kind of hand-added SQL each: a case-insensitive expression unique index on `name` (`CREATE UNIQUE INDEX ... ON <table> (LOWER("name"))`), since a plain `@Column({ unique: true })` can only express a case-sensitive constraint (see the Catalog spec §4.7) — those two global indexes were superseded by the tenant-scoped `uq_service_tenant_name_lower`/`uq_add_on_tenant_name_lower` in `1790524800000-AddCatalogTenant.ts`, described below; `AddPricingRule.ts` similarly hand-adds a *partial* unique index (`WHERE "active" = true`) enforcing at most one active `PricingRule` per service, unchanged by that later migration. None of these three indexes are derivable from entity metadata either — `generate` will not touch them, but don't expect it to regenerate them from scratch if they're ever lost. `1788670020409-CreateLaundryOrders.ts` (Laundry Orders, see the [Laundry Orders & Operational Lifecycle spec](docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md) §4.10) hand-adds two `CHECK` constraints not expressible in entity metadata — `ck_laundry_order_weight_non_negative` (`"weightGrams" IS NULL OR "weightGrams" >= 0`) and `ck_laundry_order_line_target` (`num_nonnulls("serviceId", "addOnId") = 1`); `generate` re-proposes both on every run with extra parentheses (the same harmless normalization noise `ck_pricing_rule_target` produces) — don't apply that. `laundry_order_line_entity.pricingSnapshotPricingRuleId` is deliberately a plain `uuid` column with **no** foreign key (a soft traceability pointer — the embedded pricing snapshot, not the `PricingRule` row, is authoritative for what was charged; spec §4.2/§4.8); don't add a relation decorator or FK to it. Laundry's other foreign keys (`laundry_order_entity.customerId`, `laundry_order_line_entity.laundryOrderId`/`serviceId`/`addOnId`) *do* carry `@ManyToOne` relation metadata (the `BookingEntity` precedent); their original id-only FKs were superseded by hand-written composite FKs in `1790784000000-AddLaundryBillingTenant.ts`, described below, and the relations now set `createForeignKeyConstraints: false`. `1788698812742-CreateBillingInvoices.ts` (Billing / Invoices, see the [Laundry Invoices & Billing Document spec](docs/superpowers/specs/2026-09-06-laundry-invoices-design.md) §4.9) hand-adds one object `generate` cannot express — `CREATE SEQUENCE billing_invoice_number_seq` — plus its `DROP SEQUENCE` in `down()`; that global sequence (and `uq_invoice_number`) were replaced by per-tenant numbering in `1790784000000-AddLaundryBillingTenant.ts`, described below. Everything else in that migration (`invoice_entity`/`invoice_line_entity`, the three module-local enums, the two `UNIQUE` constraints `uq_invoice_number`/`uq_invoice_laundry_order`, the FKs) is generator output. `invoice_entity`'s `laundryOrderId`/`customerId` carry `@ManyToOne` metadata, and `invoice_line_entity` has **no** foreign key to any catalog or order-line table by design (a self-contained historical snapshot — spec §4.2/§4.4), so `generate` models both tables correctly. It does, however, re-propose the same spurious cross-table drift the laundry/pricing hand-added constraints already cause (drop/recreate of `fk_cleaning_job_*`, `fk_checklist_job`, `fk_pricing_rule_*`, `uq_pricing_rule_*`, `ck_*`, `UQ_cleaning_job_booking_id`, `UQ_checklist_job_id`, and `pricing_rule_entity."effectiveFrom"`'s DEFAULT) — don't apply that. `1790180877633-AddTenantAndAdminScope.ts` (tenant identity, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.1, §4.3, §4.7) creates `tenant_entity` with exactly one bootstrap tenant (`BOOTSTRAP_TENANT_ID` in `platform/database/bootstrap-tenant.ts`) and retires the `OWNER` role. **Before running it against a database that has `OWNER` accounts**, list them (`SELECT id, email FROM admin_user_entity WHERE role = 'OWNER';`) and add one entry per account to `apps/api/src/platform/database/owner-designations.ts` — `SUPER_ADMIN` or `TENANT_OWNER` of the bootstrap tenant; the migration aborts, leaving `OWNER` in the enum, on any missing, extra, duplicate, or invalid designation. The committed list is empty, which is correct for a fresh database. The migration is irreversible (`migration:revert` refuses) — take a backup first. It hand-adds three `CHECK`s entity metadata cannot express — `ck_admin_user_platform_scope`, `ck_admin_user_tenant_scope` (the scope/role/`tenantId` triple), and `ck_audit_event_scope_tenant` — so don't apply a later `generate` that drops them; `generate` also proposes creating the shared `admin_scope_enum` type twice (once per column using it), which is noise. `1790265191400-AddCustomerPropertyTenant.ts` (Customer & Property tenant isolation, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.4, §4.5, §4.7) adds a required `tenantId` to `customer_entity` and `property_entity` and backfills every existing row onto the bootstrap tenant, all in one transaction. It aborts and changes nothing if the bootstrap tenant row is missing, or if two customers in the same tenant share an email ignoring case. The error lists each conflicting tenant, email and customer id. Fix the duplicates by hand, then re-run it; the migration never merges or deletes customers. It hand-adds `uq_customer_id_tenant`, `uq_property_id_tenant`, the expression index `uq_customer_tenant_email` (`("tenantId", lower(email))`), and the composite FK `fk_property_customer_tenant` (`("customerId", "tenantId") → customer_entity(id, "tenantId")`). That composite FK replaces the old id-only `fk_property_customer`: `PropertyEntity.customer` sets `createForeignKeyConstraints: false`. `generate` proposes dropping these objects; don't apply that. `1790438400000-AddTeamCleanerTenant.ts` (Team & Cleaner tenant isolation, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.4, §4.5, §4.7) adds a required `tenantId` to `team_entity` and `cleaner_entity` and backfills every existing row onto the bootstrap tenant, all in one transaction. It aborts and changes nothing if the bootstrap tenant row is missing. Unlike `AddCustomerPropertyTenant.ts`, it runs no duplicate pre-check: the global `UNIQUE(name)`/`UNIQUE(email)` constraints it replaces already guarantee no two teams or cleaners share a name or email, so no cross-tenant duplicate can exist to collide. It hand-adds `uq_team_id_tenant`, `uq_cleaner_id_tenant` (composite-FK targets), the tenant-scoped uniques `uq_team_tenant_name` and `uq_cleaner_tenant_email` (both case-sensitive, unlike the case-insensitive `uq_customer_tenant_email` above), the composite FK `fk_cleaner_team_tenant` (`("teamId", "tenantId") → team_entity(id, "tenantId")`), and the list indexes `idx_team_tenant_created`/`idx_cleaner_tenant_created`. That composite FK replaces the old id-only `fk_cleaner_team`: `CleanerEntity.team` sets `createForeignKeyConstraints: false`. `generate` proposes dropping these objects; don't apply that. `1790524800000-AddCatalogTenant.ts` (Catalog tenant isolation, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.4, §4.5, §4.7) adds a required `tenantId` to `service_entity`, `add_on_entity` and `pricing_rule_entity` and backfills every existing row onto the bootstrap tenant, all in one transaction. It aborts and changes nothing if the bootstrap tenant row is missing. Like `AddTeamCleanerTenant.ts`, it runs no duplicate pre-check: the global `LOWER(name)` unique indexes it replaces already rule out duplicates within one tenant. It hand-adds `uq_service_id_tenant`, `uq_add_on_id_tenant` (composite-FK targets), the tenant-scoped case-insensitive expression indexes `uq_service_tenant_name_lower`/`uq_add_on_tenant_name_lower` (`("tenantId", LOWER("name"))`), the composite FKs `fk_pricing_rule_service_tenant`/`fk_pricing_rule_add_on_tenant` (`("serviceId"|"addOnId", "tenantId") → service_entity|add_on_entity(id, "tenantId")`) replacing the old id-only `fk_pricing_rule_service`/`fk_pricing_rule_addon`, and the list indexes `idx_service_tenant_created`/`idx_add_on_tenant_created`. `PricingRuleEntity.serviceId`/`addOnId` remain plain columns with no relation decorator. `ck_pricing_rule_target` and the three pricing-rule partial unique indexes (`uq_pricing_rule_active_service`, `uq_pricing_rule_open_service`, `uq_pricing_rule_open_addon`) are unchanged. `generate` proposes dropping these objects; don't apply that. `1790611200000-AddBookingTenant.ts` (Booking tenant isolation, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.4, §4.5, §4.7) adds a required `tenantId` to `booking_entity` and backfills every existing row onto the bootstrap tenant, all in one transaction. It validates before relaxing any constraint: it aborts and changes nothing — the whole transaction rolls back, nothing modified — if the bootstrap tenant row is missing, or if any existing booking references a customer, property or service, or a non-null team, outside the bootstrap tenant. The remedy is to delete those bookings and their cleaning jobs (`fk_cleaning_job_booking` is `ON DELETE RESTRICT`, so the job has to go first), then re-run the migration; this is relevant for dev databases still holding interim #82–#84 cross-tenant test fixtures. It hand-adds `uq_booking_id_tenant` (the target of #86's composite `fk_cleaning_job_booking_tenant`), the composite FKs `fk_booking_customer_tenant`/`fk_booking_property_tenant`/`fk_booking_service_tenant`/`fk_booking_team_tenant` (`(refId, "tenantId") → parent(id, "tenantId")`) replacing the old id-only `fk_booking_customer`/`fk_booking_property`/`fk_booking_service`/`fk_booking_team`, and the list index `idx_booking_tenant_scheduled` (`("tenantId", "scheduledAt" DESC, "id")`, matching the `bookings` default sort). `migration:generate` may propose re-adding those id-only FKs; don't apply that. `1790697600000-AddJobChecklistTenant.ts` (Cleaning Job & Checklist tenant isolation, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.4, §4.5, §4.7) adds a required `tenantId` to `cleaning_job_entity` and `checklist_entity` and backfills every existing row onto the bootstrap tenant, all in one transaction. `checklist_item_entity` is unchanged: items are owned through their checklist and have no tenant of their own. The migration validates before relaxing any constraint: it aborts and changes nothing if the bootstrap tenant row is missing, or if any existing job references a booking, or a non-null team, outside the bootstrap tenant. The remedy is to delete those jobs (their checklists and items cascade) and re-run it; this is relevant for dev databases still holding #85 two-tenant test fixtures. It hand-adds `uq_cleaning_job_id_tenant` (composite-FK target), the composite FKs `fk_cleaning_job_booking_tenant`/`fk_cleaning_job_team_tenant` (`ON DELETE RESTRICT`) and `fk_checklist_job_tenant` (`ON DELETE CASCADE`), each `(refId, "tenantId") → parent(id, "tenantId")`, replacing the old id-only `fk_cleaning_job_booking`/`fk_cleaning_job_team`/`fk_checklist_job` with the same delete actions, and the list index `idx_cleaning_job_tenant_scheduled` (`("tenantId", "scheduledAt" DESC, "id")`, matching the `jobs` default sort). `CleaningJobEntity.booking` sets `createForeignKeyConstraints: false`; `teamId` and `ChecklistEntity.jobId` stay plain columns. `generate` proposes dropping these hand-written objects; don't apply that. `1790784000000-AddLaundryBillingTenant.ts` (Laundry & Billing tenant isolation, see the [Multi-Tenant Architecture spec](docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md) §4.4, §4.5, §4.7) adds a required `tenantId` to `laundry_order_entity`, `laundry_order_line_entity` and `invoice_entity`, all in one transaction: orders and invoices are backfilled onto the bootstrap tenant, lines take their order's tenant. `invoice_line_entity` is unchanged: invoice lines are owned through their invoice. The migration validates before relaxing any constraint and aborts, changing nothing, if the bootstrap tenant row is missing, if any row is left without a tenant, if any order, line or invoice references a customer, order, service or add-on outside its own tenant, or if any existing `invoiceNumber` is not `INV-{YYYY}-{6+ digits}`, has a suffix outside `1 … 2^53 − 1`, or repeats a suffix within a tenant. The remedy is to delete the offending rows (typically #82/#84 two-tenant test fixtures in a dev database) and re-run it. It hand-adds `uq_laundry_order_id_tenant` (composite-FK target), six composite FKs `(refId, "tenantId") → parent(id, "tenantId")` — `fk_laundry_order_customer_tenant`, `fk_laundry_order_line_order_tenant` (`ON DELETE CASCADE`), `fk_laundry_order_line_service_tenant`, `fk_laundry_order_line_add_on_tenant`, `fk_invoice_laundry_order_tenant`, `fk_invoice_customer_tenant` — replacing the old id-only FKs with the same delete actions, and the list indexes `idx_laundry_order_tenant_created`/`idx_invoice_tenant_issue`. Invoice numbers become unique per tenant (`uq_invoice_tenant_number` replaces `uq_invoice_number`) and are allocated per tenant from the hand-written `invoice_number_counter` table (one row per tenant, no entity; `InvoicesService.generateFromOrder` increments it with a transactional upsert), which the migration seeds from the highest existing suffix before dropping `billing_invoice_number_seq`. `migration:revert` restores a *usable* sequence positioned after the highest remaining suffix (not the exact pre-migration sequence state), and refuses up front, with an explicit counted error and no changes, once two tenants hold the same invoice number string. `generate` proposes dropping these hand-written objects; don't apply that. `apps/api/src/platform/database/data-source.ts` is the plain `DataSource` these commands use (the CLI can't consume `database.module.ts`'s Nest-wrapped, `ConfigService`-driven config directly). It needs its own `tsconfig.cli.json` (forces `commonjs`/`node` module resolution) — TypeORM's CLI loads the datasource via Node's native ESM resolver, which the rest of the project's `nodenext` config doesn't satisfy for a plain `ts-node` script.

## Seeding fake data

Seeding is an explicit, separate step — it never runs automatically on boot, so starting the app never has a surprise side effect on the database.

```bash
pnpm db:seed
```

Inserts (or re-applies, if already present) one fixture Customer/Property/Service/Team, then 3 fake bookings that reference them, all with fixed, deterministic ids (`00000000-…-0001`, `…0002`, `…0003` for bookings) via `INSERT ... ON CONFLICT (id) DO UPDATE` / `.upsert()` — safe to run as many times as you like, it never duplicates rows. Run it once after `docker compose up` to have data to look at in either API.

Seed data lives at `apps/api/src/modules/bookings/infrastructure/persistence/seed/booking.seed-data.ts` and `booking-fixtures.seed-data.ts` (plain TypeScript, no TypeORM); `booking.seeder.ts` persists the bookings themselves. `apps/api/src/platform/database/seed.ts` is the runnable entrypoint — it first upserts the Customer/Property/Service/Team fixtures directly via a plain `DataSource` (bookings' foreign keys require them to exist first), then boots a Nest application context (no HTTP server) and calls `BookingSeeder`.

The same run also seeds a dev `TENANT_OWNER` `AdminUser` of the migration-created bootstrap tenant (needed to log into the web console at all; the seed never creates a tenant) when `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` are set in `apps/api/.env` — it's a no-op, not an error, when either is unset, so `pnpm db:seed` stays safe to run without opting into it. Beyond the one booking fixture row each, `modules/customers`, `modules/cleaners`, `modules/catalog`, and `modules/jobs` have no seeders of their own; create further data through the web console or the respective GraphQL mutations (`createCustomer`/`createProperty`, `createCleaner`/`createTeam`, `createService`/`createAddOn`/`createPricingRule`, `createJobFromBooking`) once logged in.

## Endpoints

| | URL | Notes |
| --- | --- | --- |
| Web console | http://localhost:3001 | Next.js — `/login` (public); `/app/*` shell (protected): `/app`, `/app/admin` (staff/roles for the signed-in Tenant Owner's own tenant, Tenant-Owner-only), `/app/customers`, `/app/cleaners`, `/app/cleaners/teams`, `/app/catalog`, `/app/catalog/add-ons`, `/app/bookings`, `/app/jobs` |
| GraphQL API | http://localhost:3000/graphql | queries/mutations for `bookings`, `admins`, `customers`/`properties`, `cleaners`/`teams`, `catalog` (`services`/`addOns`/`activePricing`), `jobs` (`job`/`jobs`/`createJobFromBooking`/`assignTeamToJob`/`completeChecklistItem`/`completeJob`) — API only, no browser landing page |
| GraphQL IDE (GraphiQL) | http://localhost:3000/graphiql | separate route, dev-only (see below) |
| REST API | http://localhost:3000/bookings | full CRUD — `bookings` only, authenticated with the same session cookie, roles and tenant scope as GraphQL; kept for the REST/GraphQL comparison; `admins`/`customers`/`cleaners`/`catalog`/`jobs` are GraphQL-only; every HTTP route is checked by the #91 route guard |
| REST docs (Swagger UI) | http://localhost:3000/docs | interactive explorer, equivalent to GraphiQL — dev-only (not mounted when NODE_ENV=production) |
| OpenAPI spec | http://localhost:3000/docs-json | raw JSON — dev-only, with /docs |

## GraphQL IDE

`/graphql` is API-only — visiting it in a browser returns a CSRF-protection error instead of an interactive IDE (`playground: false` in `graphql.module.ts`). GraphiQL lives at a deliberately separate route, `/graphiql`, so the API endpoint and the dev tool never share a URL.

`@nestjs/apollo` also has a native `graphiql: true` option, but that serves GraphiQL *at* `/graphql` itself — deliberately not used here, to keep the API endpoint and the IDE on separate URLs.

GraphiQL is locally bundled with esbuild and served entirely from application-owned static assets, including Monaco's worker bundles — not CDN-loaded. `graphiql`, `@graphiql/toolkit`, `react`, `react-dom`, `monaco-editor`, and `monaco-graphql` are real devDependencies of `apps/api`, bundled by `scripts/build-graphiql.ts` into `public/graphiql/` — zero runtime CDN dependency. An earlier CDN-embed attempt (`unpkg`/`esm.sh`, dynamically resolving React/GraphiQL at request time) hit real breakage twice — a UMD bundle path that no longer exists in current `graphiql` releases, then a bare-module-specifier resolution error even after switching to an import map — which is why this project bundles it itself instead.

The build runs via `pnpm build:graphiql`, wired as a `turbo.json` task dependency (`build` and `start:dev` both depend on it — plain npm `pre`/`post` script hooks don't fire when Turborepo invokes a script directly, so the dependency has to be expressed in `turbo.json`, not just `package.json`). `main.ts` serves the output via `useStaticAssets` at `/graphiql-static` — deliberately not `/graphiql` itself, since Express's static middleware runs ahead of routing and would otherwise intercept the bare `/graphiql` request as a directory-index lookup before `GraphiqlController` ever saw it.

**Not one file — five.** GraphiQL's editor is Monaco (via `@graphiql/react` + `monaco-graphql`), and Monaco needs its own Web Worker scripts for language-service features (autocomplete, live validation) — those can't run inside the main bundle. The build produces:

```text
public/graphiql/
├── graphiql.js          main bundle: React + GraphiQL + @graphiql/toolkit + Monaco host
├── graphiql.css          (monaco-editor's font/icon assets inlined as data URIs)
├── editor.worker.js      Monaco's generic editor worker (default fallback)
├── json.worker.js        Monaco's JSON language worker
└── graphql.worker.js     monaco-graphql's language worker (schema-aware validation/completion)
```

`graphiql.entry.ts` wires `self.MonacoEnvironment.getWorker` to load these by label (`'json'`, `'graphql'`, default) as plain `new Worker('/graphiql-static/...')` calls. The exact worker source paths and label mapping came from `@graphiql/react`'s own `dist/setup-workers/{vite,webpack}.js` helpers (there's no esbuild-specific one shipped) — verified against the installed package rather than guessed, since `monaco-editor`/`monaco-graphql`'s internal file layout isn't part of any public API contract.

`public/graphiql/` is generated and gitignored — CI/build produces it, it's never committed.

## Scripts (run from the repo root, via Turborepo)

```bash
pnpm build    # build all workspace packages that have a build script
pnpm test     # run all workspace test suites
pnpm lint     # lint all workspace packages that have a lint script
pnpm db:seed  # insert/refresh booking fixtures — see "Seeding fake data" above
```

`docker compose up` (see "Setup" above) is the standard way to run `apps/api` and `apps/web` — it covers what `pnpm dev` used to.

Package-specific commands can be run directly, e.g. `pnpm --filter api test:e2e`, `pnpm --filter api migration:generate ...` (see "Database migrations" above).
