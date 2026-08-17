import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPricingRule1786928772298 implements MigrationInterface {
  name = 'AddPricingRule1786928772298';

  // The generator also emitted a DROP/ADD of `fk_property_customer` and
  // `fk_cleaner_team` — spurious drift from `AddProperty`'s and
  // `AddCleaner`'s hand-added FK constraints (see those migrations' own
  // comments: neither is modeled as a relation decorator on its entity, so
  // TypeORM's entity-vs-schema diff always flags them). Both are untouched
  // by this task; the statements were removed by hand rather than executed
  // — same precedent as `AddCleaner`/`AddTeam`.
  //
  // `fk_pricing_rule_service` and `uq_pricing_rule_active_service` below are
  // likewise hand-added (not generated) — TypeORM never infers a FK from
  // `PricingRuleEntity.serviceId`'s plain `@Column`, there is no `@ManyToOne`
  // relation decorator, intentionally (see `pricing-rule.entity.ts`). Nor
  // can TypeORM's entity metadata express a PARTIAL unique index
  // (`WHERE active = true`) — that's SQL-only. `ON DELETE RESTRICT` per spec
  // §3, mirroring `fk_cleaner_team`'s precedent exactly: this slice ships no
  // delete operation for `Service`, so a future slice that adds one must
  // decide its cascade behavior explicitly rather than inheriting a
  // permissive default set here. This migration is the sole, authoritative
  // source of both — they must not be regenerated from entity metadata
  // later.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pricing_rule_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "serviceId" uuid NOT NULL, "priceMinorUnits" integer NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b94dd731f1e1a9128c1175e2418" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c22f021ac1046f25883817f8f9" ON "pricing_rule_entity"  ("serviceId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_service" FOREIGN KEY ("serviceId") REFERENCES "service_entity"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_pricing_rule_active_service" ON "pricing_rule_entity" ("serviceId") WHERE "active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_pricing_rule_active_service"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_rule_entity" DROP CONSTRAINT "fk_pricing_rule_service"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c22f021ac1046f25883817f8f9"`,
    );
    await queryRunner.query(`DROP TABLE "pricing_rule_entity"`);
  }
}
