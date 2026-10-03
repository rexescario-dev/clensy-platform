import { MigrationInterface, QueryRunner } from 'typeorm';

// Tenant label overrides (#118; spec §4.1). Adds the nullable, untrusted
// `labelOverrides` jsonb column and writes no data: operations staff
// populate it. Every read goes through the validator (spec §4.2).
export class AddTenantLabelOverrides1790870400000 implements MigrationInterface {
  name = 'AddTenantLabelOverrides1790870400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_entity" ADD "labelOverrides" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_entity" DROP COLUMN "labelOverrides"`,
    );
  }
}
