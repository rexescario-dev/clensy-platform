import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeam1786862765323 implements MigrationInterface {
  name = 'AddTeam1786862765323';

  // Only the `team_entity` table is this migration's concern. The
  // generator initially also emitted a DROP/ADD of
  // `fk_property_customer` — spurious drift from `AddProperty`'s
  // hand-added FK constraint (see that migration's comment: it exists
  // in SQL but is deliberately not modeled as a `@ManyToOne` on
  // `PropertyEntity`, so TypeORM's entity-vs-schema diff always flags
  // it). That constraint is untouched by this task; the statements were
  // removed by hand rather than executed.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "team_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_77fe6acc7fed8f35637f86a2163" UNIQUE ("name"), CONSTRAINT "PK_729030db84428f430d098ee9f4d" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "team_entity"`);
  }
}
