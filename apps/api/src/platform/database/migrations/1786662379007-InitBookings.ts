import { MigrationInterface, QueryRunner } from "typeorm";

export class InitBookings1786662379007 implements MigrationInterface {
    name = 'InitBookings1786662379007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."booking_entity_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "booking_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customerName" character varying NOT NULL, "serviceType" character varying NOT NULL, "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."booking_entity_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ab285d4d9e829aa0fc5f679c7e2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "booking_entity"`);
        await queryRunner.query(`DROP TYPE "public"."booking_entity_status_enum"`);
    }

}
