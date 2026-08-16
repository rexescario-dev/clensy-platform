import { MigrationInterface, QueryRunner } from 'typeorm';

// The generator initially also emitted a DROP/ADD of
// `fk_property_customer` and `fk_cleaner_team` — spurious drift from those
// modules' hand-added FK constraints (see `AddProperty`/`AddCleaner`'s
// comments: both exist in SQL but are deliberately not modeled as relation
// decorators on their entities, so TypeORM's entity-vs-schema diff always
// flags them). Neither constraint is touched by this task; the statements
// were removed by hand rather than executed — same precedent as
// `AddTeam`/`AddCleaner`.
//
// `uq_service_name_lower` below is hand-added (not generated) — TypeORM
// never derives a case-insensitive expression index from entity metadata.
// `ServiceEntity.name` deliberately has no `unique` option (spec §3):
// Postgres's own `UNIQUE` constraint is case-sensitive, so case-insensitive
// uniqueness is enforced entirely via this expression index plus an
// application-layer pre-check (`ServicesService#assertNameAvailable`). This
// migration is the sole, authoritative source of this constraint — it must
// not be regenerated from entity metadata later.
export class AddService1786893419092 implements MigrationInterface {
  name = 'AddService1786893419092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "service_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "durationMinutes" integer NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b44751b4ed6b6c812b1fd46c2b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_service_name_lower" ON "service_entity" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_service_name_lower"`);
    await queryRunner.query(`DROP TABLE "service_entity"`);
  }
}
