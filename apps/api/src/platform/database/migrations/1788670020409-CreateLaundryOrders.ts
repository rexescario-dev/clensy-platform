import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates only laundry-owned objects (spec §4.10). It does NOT touch
// `pricing_rule_entity_unit_enum` or any other catalog/jobs object.
//
// `migration:generate` additionally proposed dropping/recreating
// `fk_cleaning_job_team`, `fk_checklist_job`, `fk_pricing_rule_service`,
// `fk_pricing_rule_addon`, `uq_pricing_rule_active_service`,
// `uq_pricing_rule_open_service`, `uq_pricing_rule_open_addon`,
// `ck_pricing_rule_target`, `UQ_cleaning_job_booking_id`,
// `UQ_checklist_job_id`, and `pricing_rule_entity."effectiveFrom"`'s
// DEFAULT — the same spurious cross-table drift from earlier hand-added
// constraints that `AddCleaningJob` and `ExtendPricingRuleEffectiveDating`
// already document. All removed by hand, not executed.
//
// This migration's tables, columns, enum types, single-column indexes, and
// FK constraints match the generator's output verbatim. The only laundry
// objects TypeORM entity metadata cannot express, hand-added here, are the
// two CHECK constraints (`ck_laundry_order_weight_non_negative`,
// `ck_laundry_order_line_target`); `migration:generate` re-proposes those
// two with extra parentheses on every run — the identical, harmless
// normalization noise `ck_pricing_rule_target` already produces.
//
// Deviation from plan §4.10's index list, matching the bookings/jobs
// precedent instead: no `(createdAt, id)` / `(laundryOrderId, createdAt,
// id)` composite sort indexes. Those are not expressible in entity
// metadata, so they cause permanent `migration:generate` drift, and
// neither `booking_entity` nor `cleaning_job_entity` (same
// scheduledAt/createdAt-DESC default sorts) carries one. The single-column
// indexes on `customerId`/`status`/`laundryOrderId` cover the filter
// paths; the default-sort ORDER BY runs unindexed, exactly as it already
// does for bookings and jobs.
export class CreateLaundryOrders1788670020409 implements MigrationInterface {
  name = 'CreateLaundryOrders1788670020409';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."laundry_order_status_enum" AS ENUM('RECEIVED', 'WEIGHED', 'PRICED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'AWAITING_DELIVERY', 'COMPLETED', 'CANCELLED', 'REJECTED', 'LOST', 'DAMAGED', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."laundry_fulfillment_type_enum" AS ENUM('PICKUP', 'DELIVERY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."laundry_order_line_unit_enum" AS ENUM('PER_KG', 'PER_ITEM', 'FLAT', 'PER_SERVICE')`,
    );

    await queryRunner.query(
      `CREATE TABLE "laundry_order_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customerId" uuid NOT NULL, "fulfillmentType" "public"."laundry_fulfillment_type_enum" NOT NULL, "status" "public"."laundry_order_status_enum" NOT NULL DEFAULT 'RECEIVED', "weightGrams" integer, "totalMinorUnits" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_laundry_order_entity" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laundry_order_customer_id" ON "laundry_order_entity" ("customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laundry_order_status" ON "laundry_order_entity" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_entity" ADD CONSTRAINT "ck_laundry_order_weight_non_negative" CHECK ("weightGrams" IS NULL OR "weightGrams" >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "laundry_order_line_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "laundryOrderId" uuid NOT NULL, "serviceId" uuid, "addOnId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "pricingSnapshotRateMinorUnits" integer NOT NULL, "pricingSnapshotUnit" "public"."laundry_order_line_unit_enum" NOT NULL, "pricingSnapshotQuantity" integer NOT NULL, "pricingSnapshotAmountMinorUnits" integer NOT NULL, "pricingSnapshotMinimumChargeMinorUnits" integer, "pricingSnapshotMinimumChargeApplied" boolean NOT NULL, "pricingSnapshotPricingRuleId" uuid, CONSTRAINT "PK_laundry_order_line_entity" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laundry_order_line_order_id" ON "laundry_order_line_entity" ("laundryOrderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laundry_order_line_service_id" ON "laundry_order_line_entity" ("serviceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laundry_order_line_add_on_id" ON "laundry_order_line_entity" ("addOnId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" ADD CONSTRAINT "ck_laundry_order_line_target" CHECK (num_nonnulls("serviceId", "addOnId") = 1)`,
    );

    await queryRunner.query(
      `ALTER TABLE "laundry_order_entity" ADD CONSTRAINT "fk_laundry_order_customer" FOREIGN KEY ("customerId") REFERENCES "customer_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" ADD CONSTRAINT "fk_laundry_order_line_order" FOREIGN KEY ("laundryOrderId") REFERENCES "laundry_order_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" ADD CONSTRAINT "fk_laundry_order_line_service" FOREIGN KEY ("serviceId") REFERENCES "service_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" ADD CONSTRAINT "fk_laundry_order_line_add_on" FOREIGN KEY ("addOnId") REFERENCES "add_on_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" DROP CONSTRAINT "fk_laundry_order_line_add_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" DROP CONSTRAINT "fk_laundry_order_line_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_line_entity" DROP CONSTRAINT "fk_laundry_order_line_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laundry_order_entity" DROP CONSTRAINT "fk_laundry_order_customer"`,
    );

    await queryRunner.query(`DROP TABLE "laundry_order_line_entity"`);
    await queryRunner.query(`DROP TABLE "laundry_order_entity"`);

    await queryRunner.query(
      `DROP TYPE "public"."laundry_order_line_unit_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."laundry_fulfillment_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."laundry_order_status_enum"`);
  }
}
