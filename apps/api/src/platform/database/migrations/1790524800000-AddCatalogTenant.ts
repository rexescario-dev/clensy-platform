import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for Service, AddOn and PricingRule (#84; RFC §4.4, §4.5,
// §4.7). Step order is load-bearing and the whole migration is one
// transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on the three tables.
//   2. Backfill every row to the bootstrap tenant.
//   3. NOT NULL + FKs to `tenant_entity` (ON DELETE RESTRICT).
//   4. `UNIQUE (id, "tenantId")` on service/add-on — required before any
//      composite FK can reference that pair.
//   5. Drop the global `LOWER(name)` unique indexes …
//   6. … and create `("tenantId", LOWER(name))` ones. No duplicate
//      pre-check: the global indexes being replaced already rule out
//      duplicates within one tenant (#84 slice decision 1).
//   7. Replace the id-only pricing-rule FKs with the composite ones. MATCH
//      SIMPLE: the null side of `ck_pricing_rule_target` is not checked.
//   8. Tenant-scoped list indexes for the two nestjs-query roots.
//
// `ck_pricing_rule_target` and the three pricing-rule partial unique
// indexes are untouched: target ids are globally unique UUIDs; the
// composite FK is what binds a rule to its target's tenant.
// `fk_booking_service`, `fk_laundry_order_line_service` and
// `fk_laundry_order_line_add_on` stay id-only — #85 / #87.
export class AddCatalogTenant1790524800000 implements MigrationInterface {
  name = 'AddCatalogTenant1790524800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddCatalogTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    await queryRunner.query(`ALTER TABLE "service_entity" ADD "tenantId" uuid`);
    await queryRunner.query(`ALTER TABLE "add_on_entity" ADD "tenantId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD "tenantId" uuid`,
    );

    await queryRunner.query(`UPDATE "service_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    await queryRunner.query(`UPDATE "add_on_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    await queryRunner.query(
      `UPDATE "pricing_rule_entity" SET "tenantId" = $1`,
      [BOOTSTRAP_TENANT_ID],
    );

    await queryRunner.query(
      `ALTER TABLE "service_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_entity" ADD CONSTRAINT "fk_service_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "add_on_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "add_on_entity" ADD CONSTRAINT "fk_add_on_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "service_entity" ADD CONSTRAINT "uq_service_id_tenant" UNIQUE ("id", "tenantId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "add_on_entity" ADD CONSTRAINT "uq_add_on_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    await queryRunner.query(`DROP INDEX "public"."uq_service_name_lower"`);
    await queryRunner.query(`DROP INDEX "public"."uq_add_on_name_lower"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_service_tenant_name_lower" ON "service_entity" ("tenantId", LOWER("name"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_add_on_tenant_name_lower" ON "add_on_entity" ("tenantId", LOWER("name"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_service_tenant" FOREIGN KEY ("serviceId", "tenantId") REFERENCES "service_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_addon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_add_on_tenant" FOREIGN KEY ("addOnId", "tenantId") REFERENCES "add_on_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_service_tenant_created" ON "service_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_add_on_tenant_created" ON "add_on_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
  }

  // Reverses 8 → 1. Restores the original objects under their original
  // names and definitions (`fk_pricing_rule_service` / `fk_pricing_rule_addon`
  // were `ON DELETE RESTRICT` with default ON UPDATE); fails (correctly) if
  // cross-tenant duplicate names now exist.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_add_on_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_service_tenant_created"`);

    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_add_on_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_addon" FOREIGN KEY ("addOnId") REFERENCES "add_on_entity"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_service_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_service" FOREIGN KEY ("serviceId") REFERENCES "service_entity"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."uq_add_on_tenant_name_lower"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_service_tenant_name_lower"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_add_on_name_lower" ON "add_on_entity" (LOWER("name"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_service_name_lower" ON "service_entity" (LOWER("name"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "add_on_entity" DROP CONSTRAINT "uq_add_on_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_entity" DROP CONSTRAINT "uq_service_id_tenant"`,
    );

    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "add_on_entity" DROP CONSTRAINT "fk_add_on_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "add_on_entity" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_entity" DROP CONSTRAINT "fk_service_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_entity" DROP COLUMN "tenantId"`,
    );
  }
}
