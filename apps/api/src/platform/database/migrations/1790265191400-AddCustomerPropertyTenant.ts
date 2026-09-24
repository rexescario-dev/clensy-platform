import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';
import {
  assertNoDuplicateCustomerEmails,
  CustomerEmailDuplicateGroup,
} from '../customer-email-duplicates';

// Tenant ownership for Customer and Property (#82; RFC §4.4, §4.5, §4.7;
// slice decision 1). Step order is load-bearing — assert bootstrap tenant →
// backfill → validate → constraints:
//
//   0. Assert the bootstrap tenant (`BOOTSTRAP_TENANT_ID`) exists; abort
//      with an explicit error before touching any row otherwise.
//   1. Nullable `tenantId` on `customer_entity` and `property_entity`.
//   2. Backfill every row to the bootstrap tenant.
//   3. Validate: no two customers share `lower(email)` within a tenant
//      (`assertNoDuplicateCustomerEmails`), and no property's tenant differs
//      from its customer's. The duplicate check DEPENDS on running after the
//      backfill (it groups by `tenantId`) and before any constraint or index
//      is created, INSIDE THE SAME TRANSACTION as the backfill: a failure
//      rolls the whole migration back, so the backfill is undone and no row
//      is modified. Remediation is manual; the migration never merges,
//      deletes, or picks a canonical customer. Never split this migration
//      across transactions.
//   4. NOT NULL + FKs to `tenant_entity` (ON DELETE RESTRICT).
//   5. `UNIQUE (id, "tenantId")` on both tables (composite FK target).
//   6. Unique expression index `("tenantId", lower(email))` on customers.
//   7. Replace the id-only `fk_property_customer` with the composite
//      `fk_property_customer_tenant` in the same step, so no tenant-
//      mismatched Property → Customer pair is ever allowed.
//   8. Indexes for tenant-scoped reads.
//
// TypeORM runs this inside one transaction, so an abort at any step leaves
// the database exactly as it was.
//
// Hand-written objects TypeORM metadata does not express (and which
// `migration:generate` may propose dropping — do not apply that):
// `uq_customer_id_tenant`, `uq_property_id_tenant`,
// `uq_customer_tenant_email`, `fk_property_customer_tenant`,
// `idx_customer_tenant_created`, `idx_property_tenant_customer`.
// `PropertyEntity.customer` sets `createForeignKeyConstraints: false`
// because this migration, not entity metadata, owns the Property → Customer
// FK. `fk_customer_tenant` / `fk_property_tenant` match entity metadata.
export class AddCustomerPropertyTenant1790265191400 implements MigrationInterface {
  name = 'AddCustomerPropertyTenant1790265191400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Bootstrap tenant must exist.
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddCustomerPropertyTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    // 1. Nullable columns.
    await queryRunner.query(
      `ALTER TABLE "customer_entity" ADD "tenantId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_entity" ADD "tenantId" uuid`,
    );

    // 2. Backfill.
    await queryRunner.query(`UPDATE "customer_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    await queryRunner.query(`UPDATE "property_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);

    // 3. Validate — abort point; after backfill, before any constraint.
    const duplicates = (await queryRunner.query(
      `SELECT "tenantId", lower("email") AS "email", array_agg("id" ORDER BY "id") AS "customerIds" FROM "customer_entity" GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY 1, 2`,
    )) as CustomerEmailDuplicateGroup[];
    assertNoDuplicateCustomerEmails(duplicates);

    const [{ count }] = (await queryRunner.query(
      `SELECT count(*) AS "count" FROM "property_entity" p JOIN "customer_entity" c ON c."id" = p."customerId" WHERE p."tenantId" <> c."tenantId"`,
    )) as { count: string }[];
    if (Number(count) !== 0) {
      throw new Error(
        `AddCustomerPropertyTenant: ${count} property row(s) belong to a different tenant than their customer; refusing to add tenant constraints.`,
      );
    }

    // 4. NOT NULL + tenant FKs.
    await queryRunner.query(
      `ALTER TABLE "customer_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_entity" ADD CONSTRAINT "fk_customer_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_entity" ADD CONSTRAINT "fk_property_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // 5. Composite-FK targets.
    await queryRunner.query(
      `ALTER TABLE "customer_entity" ADD CONSTRAINT "uq_customer_id_tenant" UNIQUE ("id", "tenantId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_entity" ADD CONSTRAINT "uq_property_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    // 6. Tenant-scoped, case-insensitive email uniqueness.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_customer_tenant_email" ON "customer_entity" ("tenantId", lower("email"))`,
    );

    // 7. Same-tenant Property → Customer, replacing the id-only FK.
    await queryRunner.query(
      `ALTER TABLE "property_entity" DROP CONSTRAINT "fk_property_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_entity" ADD CONSTRAINT "fk_property_customer_tenant" FOREIGN KEY ("customerId", "tenantId") REFERENCES "customer_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // 8. Tenant-scoped read indexes (the existing `customerId` index stays).
    await queryRunner.query(
      `CREATE INDEX "idx_customer_tenant_created" ON "customer_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_property_tenant_customer" ON "property_entity" ("tenantId", "customerId")`,
    );
  }

  // Reverses 8 → 1. Tenant ownership is discarded: a later `up` backfills
  // every row to the bootstrap tenant again.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_property_tenant_customer"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_customer_tenant_created"`,
    );

    await queryRunner.query(
      `ALTER TABLE "property_entity" DROP CONSTRAINT "fk_property_customer_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_entity" ADD CONSTRAINT "fk_property_customer" FOREIGN KEY ("customerId") REFERENCES "customer_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP INDEX "public"."uq_customer_tenant_email"`);

    await queryRunner.query(
      `ALTER TABLE "property_entity" DROP CONSTRAINT "uq_property_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_entity" DROP CONSTRAINT "uq_customer_id_tenant"`,
    );

    await queryRunner.query(
      `ALTER TABLE "property_entity" DROP CONSTRAINT "fk_property_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_entity" DROP CONSTRAINT "fk_customer_tenant"`,
    );

    await queryRunner.query(
      `ALTER TABLE "property_entity" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_entity" DROP COLUMN "tenantId"`,
    );
  }
}
