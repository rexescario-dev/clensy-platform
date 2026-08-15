import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminUser1786761567733 implements MigrationInterface {
    name = 'AddAdminUser1786761567733'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."admin_user_entity_role_enum" AS ENUM('OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST')`);
        await queryRunner.query(`CREATE TABLE "admin_user_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."admin_user_entity_role_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ee9a25b500db639119eec16e1ef" UNIQUE ("email"), CONSTRAINT "PK_2574ce04ee40d44bde343d369b2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "admin_user_entity"`);
        await queryRunner.query(`DROP TYPE "public"."admin_user_entity_role_enum"`);
    }

}
