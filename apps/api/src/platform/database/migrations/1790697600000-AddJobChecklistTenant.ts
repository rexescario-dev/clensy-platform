import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for CleaningJob and Checklist (#86; RFC §4.4, §4.5,
// §4.7). ChecklistItem is owned via its Checklist and is not touched
// (#86 slice decision 2). Step order is load-bearing and the whole
// migration is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on both tables.
//   2. Backfill every job and checklist to the bootstrap tenant.
//   3. Validate: no job may reference a booking, or a non-null team, in
//      another tenant (slice decision 11). Checklist → job cannot mismatch
//      after step 2. Fails closed; the transaction rolls back with nothing
//      modified.
//   4. NOT NULL + FK to `tenant_entity` (ON DELETE RESTRICT) on both.
//   5. `UNIQUE (id, "tenantId")` on jobs — the target of
//      `fk_checklist_job_tenant` (slice decision 12).
//   6. Replace each id-only parent FK with its composite `(refId,
//      "tenantId")` FK in the same step, keeping its ON DELETE action
//      (slice decision 4). MATCH SIMPLE: a NULL `teamId` is not checked.
//   7. Tenant-leading index matching the `jobs` default sort.
const PARENT_FKS = [
  [
    'cleaning_job_entity',
    'fk_cleaning_job_booking',
    'fk_cleaning_job_booking_tenant',
    'bookingId',
    'booking_entity',
    'RESTRICT',
  ],
  [
    'cleaning_job_entity',
    'fk_cleaning_job_team',
    'fk_cleaning_job_team_tenant',
    'teamId',
    'team_entity',
    'RESTRICT',
  ],
  [
    'checklist_entity',
    'fk_checklist_job',
    'fk_checklist_job_tenant',
    'jobId',
    'cleaning_job_entity',
    'CASCADE',
  ],
] as const;

const TENANT_FKS = [
  ['cleaning_job_entity', 'fk_cleaning_job_tenant'],
  ['checklist_entity', 'fk_checklist_tenant'],
] as const;

export class AddJobChecklistTenant1790697600000 implements MigrationInterface {
  name = 'AddJobChecklistTenant1790697600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddJobChecklistTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    for (const [table] of TENANT_FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "tenantId" uuid`);
      await queryRunner.query(`UPDATE "${table}" SET "tenantId" = $1`, [
        BOOTSTRAP_TENANT_ID,
      ]);
    }

    // Slice decision 11. Tenant mismatch only: the id-only parent FKs are
    // still in place here and already guarantee every non-null reference
    // exists. `bookingId` is required and checked for every job; `teamId`
    // is nullable and checked only when present.
    const mismatches: string[] = [];
    for (const [column, table, label, onlyWhenPresent] of [
      ['bookingId', 'booking_entity', 'booking', false],
      ['teamId', 'team_entity', 'team', true],
    ] as const) {
      const presence = onlyWhenPresent ? ` AND j."${column}" IS NOT NULL` : '';
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "cleaning_job_entity" j JOIN "${table}" p ON p."id" = j."${column}" WHERE p."tenantId" <> j."tenantId"${presence}`,
      )) as { count: number }[];
      if (count > 0) {
        mismatches.push(
          `${count} job(s) reference a ${label} outside the bootstrap tenant`,
        );
      }
    }
    if (mismatches.length > 0) {
      throw new Error(`AddJobChecklistTenant: ${mismatches.join('; ')}`);
    }

    for (const [table, fk] of TENANT_FKS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" ADD CONSTRAINT "uq_cleaning_job_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    for (const [
      table,
      oldName,
      newName,
      column,
      parent,
      onDelete,
    ] of PARENT_FKS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${oldName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${newName}" FOREIGN KEY ("${column}", "tenantId") REFERENCES "${parent}"("id", "tenantId") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX "idx_cleaning_job_tenant_scheduled" ON "cleaning_job_entity" ("tenantId", "scheduledAt" DESC, "id")`,
    );
  }

  // Reverses 7 → 1, restoring the original id-only FKs under their
  // original names and ON DELETE actions (`AddCleaningJob`).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_cleaning_job_tenant_scheduled"`,
    );
    for (const [table, oldName, newName, column, parent, onDelete] of [
      ...PARENT_FKS,
    ].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${newName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${oldName}" FOREIGN KEY ("${column}") REFERENCES "${parent}"("id") ON DELETE ${onDelete}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" DROP CONSTRAINT "uq_cleaning_job_id_tenant"`,
    );
    for (const [table, fk] of [...TENANT_FKS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "tenantId"`);
    }
  }
}
