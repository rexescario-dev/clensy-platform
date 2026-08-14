import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditEvent1786721735737 implements MigrationInterface {
    name = 'AddAuditEvent1786721735737'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_event_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" character varying, "action" character varying NOT NULL, "entityType" character varying, "entityId" character varying, "metadata" jsonb, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f2b87f89a4ba59e976c635a553e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "audit_event_entity"`);
    }

}
