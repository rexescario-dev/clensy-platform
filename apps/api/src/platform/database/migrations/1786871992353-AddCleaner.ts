import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCleaner1786871992353 implements MigrationInterface {
  name = 'AddCleaner1786871992353';

  // The generator initially also emitted a DROP/ADD of
  // `fk_property_customer` — spurious drift from `AddProperty`'s
  // hand-added FK constraint (see that migration's comment: it exists in
  // SQL but is deliberately not modeled as a `@ManyToOne` on
  // `PropertyEntity`, so TypeORM's entity-vs-schema diff always flags it).
  // That constraint is untouched by this task; the statements were removed
  // by hand rather than executed — same precedent as `AddTeam`.
  //
  // `fk_cleaner_team` below is likewise hand-added (not generated) — TypeORM
  // never infers a FK from `CleanerEntity.teamId`'s plain `@Column`, there is
  // no `@ManyToOne` relation decorator, intentionally, see `cleaner.entity.ts`.
  // `ON DELETE RESTRICT` per spec §3, mirroring `fk_property_customer`'s
  // precedent exactly: this slice ships no delete operation for `Team`, so a
  // future slice that adds one must decide its cascade behavior explicitly
  // rather than inheriting a permissive default set here. This migration is
  // the sole, authoritative source of this constraint — it must not be
  // regenerated from entity metadata later.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cleaner_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying NOT NULL, "phone" character varying NOT NULL, "email" character varying NOT NULL, "notes" text, "teamId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ff219644065361c10ec6890f339" UNIQUE ("email"), CONSTRAINT "PK_02ad30a35f21cbf8ee4e62aca68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4aaad4a7a803e73cb71167a97e" ON "cleaner_entity"  ("teamId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_team" FOREIGN KEY ("teamId") REFERENCES "team_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_team"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4aaad4a7a803e73cb71167a97e"`,
    );
    await queryRunner.query(`DROP TABLE "cleaner_entity"`);
  }
}
