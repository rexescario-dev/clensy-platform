import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCleaningJob1787764597814 implements MigrationInterface {
  name = 'AddCleaningJob1787764597814';

  // The generator also emitted DROP/ADD of `fk_booking_*`,
  // `fk_property_customer`, `fk_cleaner_team`, `fk_pricing_rule_service`,
  // and `uq_pricing_rule_active_service` — spurious drift from earlier
  // hand-added constraints (none are modeled as relation decorators, so
  // TypeORM's entity-vs-schema diff always flags them). Untouched by this
  // task; those statements were removed by hand rather than executed —
  // same precedent as `AddPricingRule` / `MigrateBookingReferences`.
  //
  // Named uniques and FKs below are likewise hand-added (not generated):
  // TypeORM never infers a FK from a plain `@Column`, and the unique
  // constraint name `UQ_cleaning_job_booking_id` is spec-mandated
  // (`unique: true` on the entity would invent a different name).
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."cleaning_job_entity_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cleaning_job_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "teamId" uuid, "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."cleaning_job_entity_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_867ebd1c95e7114154a66c0e0a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd7787f32183f3d4e6fea746fd" ON "cleaning_job_entity" ("teamId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" ADD CONSTRAINT "UQ_cleaning_job_booking_id" UNIQUE ("bookingId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" ADD CONSTRAINT "fk_cleaning_job_booking" FOREIGN KEY ("bookingId") REFERENCES "booking_entity"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" ADD CONSTRAINT "fk_cleaning_job_team" FOREIGN KEY ("teamId") REFERENCES "team_entity"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `CREATE TABLE "checklist_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "jobId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6bd7552ad9da1e228a1efd8a063" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_entity" ADD CONSTRAINT "UQ_checklist_job_id" UNIQUE ("jobId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_entity" ADD CONSTRAINT "fk_checklist_job" FOREIGN KEY ("jobId") REFERENCES "cleaning_job_entity"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "checklist_item_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "checklistId" uuid NOT NULL, "label" character varying NOT NULL, "position" integer NOT NULL, "completed" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4d73a54d6b4d370109078458ce1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99625b9bb41734b5937605345a" ON "checklist_item_entity" ("checklistId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_item_entity" ADD CONSTRAINT "fk_checklist_item_checklist" FOREIGN KEY ("checklistId") REFERENCES "checklist_entity"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "checklist_item_entity" DROP CONSTRAINT "fk_checklist_item_checklist"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_99625b9bb41734b5937605345a"`,
    );
    await queryRunner.query(`DROP TABLE "checklist_item_entity"`);

    await queryRunner.query(
      `ALTER TABLE "checklist_entity" DROP CONSTRAINT "fk_checklist_job"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_entity" DROP CONSTRAINT "UQ_checklist_job_id"`,
    );
    await queryRunner.query(`DROP TABLE "checklist_entity"`);

    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" DROP CONSTRAINT "fk_cleaning_job_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" DROP CONSTRAINT "fk_cleaning_job_booking"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" DROP CONSTRAINT "UQ_cleaning_job_booking_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd7787f32183f3d4e6fea746fd"`,
    );
    await queryRunner.query(`DROP TABLE "cleaning_job_entity"`);
    await queryRunner.query(
      `DROP TYPE "public"."cleaning_job_entity_status_enum"`,
    );
  }
}
