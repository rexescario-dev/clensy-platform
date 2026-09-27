import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for Team and Cleaner (#83; RFC §4.4, §4.5, §4.7). Step
// order is load-bearing and the whole migration is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on `team_entity` and `cleaner_entity`.
//   2. Backfill every row to the bootstrap tenant.
//   3. NOT NULL + FKs to `tenant_entity` (ON DELETE RESTRICT).
//   4. `UNIQUE (id, "tenantId")` on both tables (composite FK target).
//   5. Replace the global `UNIQUE(name)` / `UNIQUE(email)` with
//      `("tenantId", name)` / `("tenantId", email)` — case-sensitive, as
//      today (slice decision 2). No duplicate pre-check: the global uniques
//      being replaced already rule out duplicates within one tenant (slice
//      decision 1).
//   6. Replace the id-only `fk_cleaner_team` with the composite
//      `fk_cleaner_team_tenant` in the same step. MATCH SIMPLE: a cleaner
//      with `teamId IS NULL` is not checked.
//   7. Tenant-scoped list indexes (the existing `teamId` index stays).
//
// `fk_booking_team` / `fk_cleaning_job_team` (id-only, referencing
// `team_entity.id`) are untouched — #85 / #86.
export class AddTeamCleanerTenant1790438400000 implements MigrationInterface {
  name = 'AddTeamCleanerTenant1790438400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddTeamCleanerTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    await queryRunner.query(`ALTER TABLE "team_entity" ADD "tenantId" uuid`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" ADD "tenantId" uuid`);

    await queryRunner.query(`UPDATE "team_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    await queryRunner.query(`UPDATE "cleaner_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);

    await queryRunner.query(
      `ALTER TABLE "team_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_entity" ADD CONSTRAINT "fk_team_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "team_entity" ADD CONSTRAINT "uq_team_id_tenant" UNIQUE ("id", "tenantId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "uq_cleaner_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "team_entity" DROP CONSTRAINT "UQ_77fe6acc7fed8f35637f86a2163"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_entity" ADD CONSTRAINT "uq_team_tenant_name" UNIQUE ("tenantId", "name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "UQ_ff219644065361c10ec6890f339"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "uq_cleaner_tenant_email" UNIQUE ("tenantId", "email")`,
    );

    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_team_tenant" FOREIGN KEY ("teamId", "tenantId") REFERENCES "team_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_team_tenant_created" ON "team_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cleaner_tenant_created" ON "cleaner_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
  }

  // Reverses 7 → 1. Restores the original global uniques under their
  // original names; fails (correctly) if cross-tenant duplicates now exist.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_cleaner_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_team_tenant_created"`);
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_team_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_team" FOREIGN KEY ("teamId") REFERENCES "team_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "uq_cleaner_tenant_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "UQ_ff219644065361c10ec6890f339" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_entity" DROP CONSTRAINT "uq_team_tenant_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_entity" ADD CONSTRAINT "UQ_77fe6acc7fed8f35637f86a2163" UNIQUE ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "uq_cleaner_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_entity" DROP CONSTRAINT "uq_team_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_entity" DROP CONSTRAINT "fk_team_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(`ALTER TABLE "team_entity" DROP COLUMN "tenantId"`);
  }
}
