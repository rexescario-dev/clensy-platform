import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for Booking (#85; RFC §4.4, §4.5, §4.7). Step order is
// load-bearing and the whole migration is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId`.
//   2. Backfill every booking to the bootstrap tenant.
//   3. Validate: no booking may reference a customer/property/service/team
//      in another tenant (#85 slice decision 13). Fails closed; the
//      transaction rolls back with nothing modified.
//   4. NOT NULL + FK to `tenant_entity` (ON DELETE RESTRICT).
//   5. `UNIQUE (id, "tenantId")` — the FK target #86's cleaning-job
//      composite FK needs (slice decision 6).
//   6. Replace each id-only parent FK with its composite `(refId,
//      "tenantId")` FK in the same step (slice decision 5). MATCH SIMPLE:
//      a NULL `teamId` is not checked.
//   7. Tenant-leading index matching the `bookings` default sort.
//
// `fk_cleaning_job_booking` stays id-only — #86.
export class AddBookingTenant1790611200000 implements MigrationInterface {
  name = 'AddBookingTenant1790611200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddBookingTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    await queryRunner.query(`ALTER TABLE "booking_entity" ADD "tenantId" uuid`);
    await queryRunner.query(`UPDATE "booking_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);

    // Slice decision 13. Tenant mismatch only: the id-only parent FKs are
    // still in place here and already guarantee every non-null reference
    // exists. customer/property/service are required and checked for every
    // booking; team is nullable and checked only when `teamId IS NOT NULL`
    // (stated explicitly rather than left to the inner join's NULL
    // behaviour).
    const mismatches: string[] = [];
    for (const [column, table, label, onlyWhenPresent] of [
      ['customerId', 'customer_entity', 'customer', false],
      ['propertyId', 'property_entity', 'property', false],
      ['serviceId', 'service_entity', 'service', false],
      ['teamId', 'team_entity', 'team', true],
    ] as const) {
      const presence = onlyWhenPresent ? ` AND b."${column}" IS NOT NULL` : '';
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "booking_entity" b JOIN "${table}" p ON p."id" = b."${column}" WHERE p."tenantId" <> b."tenantId"${presence}`,
      )) as { count: number }[];
      if (count > 0) {
        mismatches.push(
          `${count} booking(s) reference a ${label} outside the bootstrap tenant`,
        );
      }
    }
    if (mismatches.length > 0) {
      throw new Error(`AddBookingTenant: ${mismatches.join('; ')}`);
    }

    await queryRunner.query(
      `ALTER TABLE "booking_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" ADD CONSTRAINT "fk_booking_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" ADD CONSTRAINT "uq_booking_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    for (const [oldName, newName, column, table] of [
      [
        'fk_booking_customer',
        'fk_booking_customer_tenant',
        'customerId',
        'customer_entity',
      ],
      [
        'fk_booking_property',
        'fk_booking_property_tenant',
        'propertyId',
        'property_entity',
      ],
      [
        'fk_booking_service',
        'fk_booking_service_tenant',
        'serviceId',
        'service_entity',
      ],
      ['fk_booking_team', 'fk_booking_team_tenant', 'teamId', 'team_entity'],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "booking_entity" DROP CONSTRAINT "${oldName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "booking_entity" ADD CONSTRAINT "${newName}" FOREIGN KEY ("${column}", "tenantId") REFERENCES "${table}"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX "idx_booking_tenant_scheduled" ON "booking_entity" ("tenantId", "scheduledAt" DESC, "id")`,
    );
  }

  // Reverses 7 → 1, restoring the original id-only FKs under their
  // original names (`ON DELETE RESTRICT`, default ON UPDATE).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_booking_tenant_scheduled"`,
    );
    for (const [oldName, newName, column, table] of [
      ['fk_booking_team', 'fk_booking_team_tenant', 'teamId', 'team_entity'],
      [
        'fk_booking_service',
        'fk_booking_service_tenant',
        'serviceId',
        'service_entity',
      ],
      [
        'fk_booking_property',
        'fk_booking_property_tenant',
        'propertyId',
        'property_entity',
      ],
      [
        'fk_booking_customer',
        'fk_booking_customer_tenant',
        'customerId',
        'customer_entity',
      ],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "booking_entity" DROP CONSTRAINT "${newName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "booking_entity" ADD CONSTRAINT "${oldName}" FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON DELETE RESTRICT`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "booking_entity" DROP CONSTRAINT "uq_booking_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" DROP CONSTRAINT "fk_booking_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" DROP COLUMN "tenantId"`,
    );
  }
}
