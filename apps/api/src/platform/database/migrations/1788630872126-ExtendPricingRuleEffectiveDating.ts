import { MigrationInterface, QueryRunner } from 'typeorm';

// `migration:generate` also proposed dropping/recreating
// `fk_pricing_rule_service`, `uq_pricing_rule_active_service`, and unrelated
// FKs on `cleaning_job_entity`/`checklist_entity` — spurious drift from
// hand-added constraints TypeORM's entity-vs-schema diff doesn't know about,
// the same category `AddPricingRule`'s own migration comment already
// documents. All removed by hand, not executed — required verification per
// this ticket's implementation plan §3. This migration touches only what
// this ticket's spec (Laundry Architecture & Catalog Foundation, §4.2, §4.7,
// §4.8) actually authorizes.
//
// Statement order is additive-then-backfill-then-constrain, so every
// intermediate state within this migration is valid (plan §3): add nullable
// columns first, backfill data into them, only then add the NOT NULL/CHECK/
// unique-index constraints that assume the backfill already ran.
//
// `effectiveFrom` gets a DB-level `DEFAULT now()` in addition to the
// `NOT NULL` the spec calls for — not itself a spec requirement, but
// necessary for this migration to be safe on its own: the legacy
// `PricingRulesService#createPricingRule` (unmodified until this ticket's
// next slice) never sets `effectiveFrom`, and without a default every one of
// its inserts would violate the new `NOT NULL` constraint the moment this
// migration runs. Defaulting to `now()` is exactly the same "effective
// immediately" behavior the spec's `operationNow` default already mandates
// at the application layer (spec §4.4) — this only backstops it one layer
// down, it does not introduce a different rule.
export class ExtendPricingRuleEffectiveDating1788630872126 implements MigrationInterface {
  name = 'ExtendPricingRuleEffectiveDating1788630872126';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "serviceId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD "addOnId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pricing_rule_addon_id" ON "pricing_rule_entity" ("addOnId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_addon" FOREIGN KEY ("addOnId") REFERENCES "add_on_entity"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pricing_rule_entity_unit_enum" AS ENUM('PER_KG', 'PER_ITEM', 'FLAT', 'PER_SERVICE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD "unit" "public"."pricing_rule_entity_unit_enum" NOT NULL DEFAULT 'PER_SERVICE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD "minimumChargeMinorUnits" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD "effectiveFrom" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "pricing_rule_entity" SET "effectiveFrom" = "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "effectiveFrom" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD "effectiveTo" TIMESTAMP WITH TIME ZONE`,
    );
    // Backfill `effectiveTo` per pre-existing `serviceId` (every pre-existing
    // row is `serviceId`-targeted — `addOnId` did not exist before this
    // migration): each row's `effectiveTo` becomes the `createdAt` of
    // whichever row next superseded it for that service, `NULL` for the
    // newest (currently-active) row per service. `id` is a deterministic
    // secondary sort key — `createdAt` alone is not guaranteed unique, so
    // without it two rows sharing a timestamp would have an undefined
    // supersession order (spec §4.8).
    await queryRunner.query(`
      UPDATE "pricing_rule_entity" AS p
      SET "effectiveTo" = sub."nextCreatedAt"
      FROM (
        SELECT "id", LEAD("createdAt") OVER (PARTITION BY "serviceId" ORDER BY "createdAt", "id") AS "nextCreatedAt"
        FROM "pricing_rule_entity"
      ) AS sub
      WHERE p."id" = sub."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "ck_pricing_rule_target" CHECK (num_nonnulls("serviceId", "addOnId") = 1)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_pricing_rule_open_service" ON "pricing_rule_entity" ("serviceId") WHERE "effectiveTo" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_pricing_rule_open_addon" ON "pricing_rule_entity" ("addOnId") WHERE "effectiveTo" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_pricing_rule_open_addon"`);
    await queryRunner.query(`DROP INDEX "uq_pricing_rule_open_service"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "ck_pricing_rule_target"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP COLUMN "effectiveTo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "effectiveFrom" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP COLUMN "effectiveFrom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP COLUMN "minimumChargeMinorUnits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP COLUMN "unit"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."pricing_rule_entity_unit_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_addon"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_pricing_rule_addon_id"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP COLUMN "addOnId"`,
    );
    // Only valid if no `addOnId`-targeted row exists yet — true for any
    // environment rolling this migration back before add-on pricing ships
    // real data (plan §3's documented down() caveat).
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "serviceId" SET NOT NULL`,
    );
  }
}
