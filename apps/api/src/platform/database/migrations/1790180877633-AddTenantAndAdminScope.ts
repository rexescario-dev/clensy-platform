import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';
import {
  OwnerDesignationEntry,
  validateOwnerDesignations,
} from '../owner-designation';
import { OWNER_DESIGNATIONS } from '../owner-designations';

const TENANT_ROLES = [
  'TENANT_OWNER',
  'OPS_MANAGER',
  'SCHEDULER',
  'CUSTOMER_SUPPORT',
  'FINANCE',
  'ANALYST',
];

function roleEnumSql(values: readonly string[]): string {
  return `ENUM(${values.map((value) => `'${value}'`).join(', ')})`;
}

// Tenant identity foundation (multi-tenant spec §4.1, §4.3, §4.6, §4.7;
// plan Task 4). Step order is the plan's and is load-bearing:
//
//   1. `tenant_entity` + exactly one bootstrap tenant (`BOOTSTRAP_TENANT_ID`).
//   2. Widen the role enum additively (adds SUPER_ADMIN/TENANT_OWNER, keeps
//      OWNER). Done by recreating the type, because Postgres forbids using
//      a value added by `ALTER TYPE ... ADD VALUE` in the same transaction.
//   3. Nullable `scope`/`tenantId` on `admin_user_entity` and
//      `audit_event_entity` (one shared `admin_scope_enum`).
//   4. Validate the explicit OWNER designations (`owner-designations.ts`,
//      injected via the constructor so tests can supply their own). ABORTS
//      here — with OWNER still in the enum — on any missing, extra,
//      duplicate, or invalid designation.
//   5. Convert designated OWNER rows; every other admin becomes TENANT on
//      the bootstrap tenant, keeping its role.
//   6. Assert zero OWNER rows remain.
//   7. Only then recreate the role enum without OWNER.
//   8. NOT NULL, CHECKs, index, FK.
//
// TypeORM runs this inside one transaction, so an abort at any step leaves
// the database exactly as it was.
//
// Hand-written objects TypeORM metadata cannot express (and which
// `migration:generate` may propose dropping — do not apply that):
// `ck_admin_user_platform_scope`, `ck_admin_user_tenant_scope`,
// `ck_audit_event_scope_tenant`. The generator's output for this change
// also carried the same spurious cross-table drift that `CreateLaundryOrders`
// documents (fk_cleaning_job_*, fk_checklist_job, fk_pricing_rule_*,
// uq_pricing_rule_*, ck_*_target, UQ_*_id, effectiveFrom DEFAULT); all of
// it was removed by hand. Table, column, index, and FK DDL otherwise match
// the generator verbatim.
export class AddTenantAndAdminScope1790180877633 implements MigrationInterface {
  name = 'AddTenantAndAdminScope1790180877633';

  constructor(
    private readonly designations: readonly OwnerDesignationEntry[] = OWNER_DESIGNATIONS,
  ) {}

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tenant table + bootstrap tenant.
    await queryRunner.query(
      `CREATE TABLE "tenant_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2ab0f07bcd231a29a42b101281e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
      [BOOTSTRAP_TENANT_ID, 'Bootstrap tenant'],
    );

    // 2. Additive role enum: new roles alongside OWNER.
    await this.replaceRoleEnum(queryRunner, [
      'SUPER_ADMIN',
      'OWNER',
      ...TENANT_ROLES,
    ]);

    // 3. Nullable scope/tenant columns.
    await queryRunner.query(
      `CREATE TYPE "public"."admin_scope_enum" AS ENUM('PLATFORM', 'TENANT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ADD "tenantId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ADD "scope" "public"."admin_scope_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_event_entity" ADD "scope" "public"."admin_scope_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_event_entity" ADD "tenantId" character varying`,
    );

    // 4. Validate designations against every OWNER row — abort point.
    const owners = (await queryRunner.query(
      `SELECT "id" FROM "admin_user_entity" WHERE "role" = 'OWNER'`,
    )) as { id: string }[];
    const designated = validateOwnerDesignations(
      owners.map((owner) => owner.id),
      this.designations,
    );

    // 5. Convert.
    for (const [adminUserId, role] of designated) {
      if (role === 'SUPER_ADMIN') {
        await queryRunner.query(
          `UPDATE "admin_user_entity" SET "role" = 'SUPER_ADMIN', "scope" = 'PLATFORM', "tenantId" = NULL WHERE "id" = $1`,
          [adminUserId],
        );
      } else {
        await queryRunner.query(
          `UPDATE "admin_user_entity" SET "role" = 'TENANT_OWNER', "scope" = 'TENANT', "tenantId" = $2 WHERE "id" = $1`,
          [adminUserId, BOOTSTRAP_TENANT_ID],
        );
      }
    }
    await queryRunner.query(
      `UPDATE "admin_user_entity" SET "scope" = 'TENANT', "tenantId" = $1 WHERE "scope" IS NULL AND "role" <> 'OWNER'`,
      [BOOTSTRAP_TENANT_ID],
    );

    // 6. Nothing may still be OWNER before the enum loses it.
    const [{ count }] = (await queryRunner.query(
      `SELECT count(*) AS "count" FROM "admin_user_entity" WHERE "role" = 'OWNER'`,
    )) as { count: string }[];
    if (Number(count) !== 0) {
      throw new Error(
        `AddTenantAndAdminScope: ${count} OWNER row(s) remain after conversion; refusing to remove OWNER from the role enum.`,
      );
    }

    // 7. Retire OWNER.
    await this.replaceRoleEnum(queryRunner, ['SUPER_ADMIN', ...TENANT_ROLES]);

    // 8. Constraints.
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ALTER COLUMN "scope" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ADD CONSTRAINT "ck_admin_user_platform_scope" CHECK ("scope" <> 'PLATFORM' OR ("tenantId" IS NULL AND "role" = 'SUPER_ADMIN'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ADD CONSTRAINT "ck_admin_user_tenant_scope" CHECK ("scope" <> 'TENANT' OR ("tenantId" IS NOT NULL AND "role" IN (${TENANT_ROLES.map((role) => `'${role}'`).join(', ')})))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2586632462877a8ca105504fe5" ON "admin_user_entity" ("tenantId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ADD CONSTRAINT "fk_admin_user_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    // `IS NOT DISTINCT FROM`, not `=`: `scope` is nullable here, and with
    // `=` a NULL scope makes the whole expression NULL — which a CHECK
    // treats as passing, letting a scope-less event carry a tenantId.
    await queryRunner.query(
      `ALTER TABLE "audit_event_entity" ADD CONSTRAINT "ck_audit_event_scope_tenant" CHECK (("scope" IS NOT DISTINCT FROM 'TENANT' AND "tenantId" IS NOT NULL) OR ("scope" IS NOT DISTINCT FROM 'PLATFORM' AND "tenantId" IS NULL) OR ("scope" IS NULL AND "tenantId" IS NULL))`,
    );
  }

  // Irreversible by design. Reverting would have to map SUPER_ADMIN and
  // TENANT_OWNER back to the global OWNER role — which would grant
  // cross-tenant staff administration to every Tenant Owner created after
  // this migration, and would discard which accounts were designated
  // platform vs tenant. Restore from a backup instead.
  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'AddTenantAndAdminScope is irreversible: reverting would collapse SUPER_ADMIN/TENANT_OWNER back into the global OWNER role. Restore from a pre-migration backup instead.',
      ),
    );
  }

  private async replaceRoleEnum(
    queryRunner: QueryRunner,
    values: readonly string[],
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."admin_user_entity_role_enum" RENAME TO "admin_user_entity_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admin_user_entity_role_enum" AS ${roleEnumSql(values)}`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ALTER COLUMN "role" TYPE "public"."admin_user_entity_role_enum" USING "role"::"text"::"public"."admin_user_entity_role_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."admin_user_entity_role_enum_old"`,
    );
  }
}
