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
