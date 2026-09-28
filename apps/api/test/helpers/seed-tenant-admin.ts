import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AdminUserEntity } from '../../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { TenantEntity } from '../../src/modules/admins/infrastructure/persistence/tenant.entity';
import { AdminScope } from '../../src/platform/auth/domain/admin-scope';
import { AuthenticatedPrincipal } from '../../src/platform/auth/domain/authenticated-principal';
import { Role } from '../../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../../src/platform/database/bootstrap-tenant';

const BCRYPT_SALT_ROUNDS = 4; // low cost — this is a test fixture, not production hashing

export interface SeededAdmin {
  id: string;
  tenantId: string | null;
  email: string;
  password: string;
  principal: AuthenticatedPrincipal;
}

// Two-tenant identity fixtures (plan Tasks 6, 8, 10). The bootstrap tenant is
// created by the `AddTenantAndAdminScope` migration and only ever looked up
// here; every other tenant is an additional, test-only row with a random
// name so repeated runs against the same database never collide.
export async function createTestTenant(
  dataSource: DataSource,
): Promise<string> {
  const repository = dataSource.getRepository(TenantEntity);
  const tenant = await repository.save(
    repository.create({ name: `test-tenant-${randomUUID()}` }),
  );
  return tenant.id;
}

// Deletes test-only tenants, their admins, and their Customer/Property (#82),
// Team/Cleaner (#83), and Service/AddOn/PricingRule (#84) rows — properties
// before customers, cleaners before teams, pricing rules before services/
// add-ons, all before the tenant itself (FK order). Never touches the
// bootstrap tenant. Callers whose tests insert a Booking/LaundryOrder
// referencing one of these tenants' customers/properties, a Booking/
// CleaningJob referencing one of these tenants' teams, or a Booking/
// LaundryOrderLine referencing one of these tenants' services/add-ons, MUST
// delete those rows first: `fk_booking_customer`, `fk_booking_property`,
// `fk_laundry_order_customer`, `fk_booking_team`, `fk_cleaning_job_team`,
// `fk_booking_service`, `fk_laundry_order_line_service`, and
// `fk_laundry_order_line_add_on` are all `ON DELETE RESTRICT`, so this call
// fails loudly (not silently) if a caller forgot.
export async function removeTestTenants(
  dataSource: DataSource,
  tenantIds: readonly string[],
): Promise<void> {
  const ids = tenantIds.filter((id) => id !== BOOTSTRAP_TENANT_ID);
  if (ids.length === 0) {
    return;
  }
  await dataSource.query(
    `DELETE FROM "property_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(
    `DELETE FROM "customer_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(
    `DELETE FROM "cleaner_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(
    `DELETE FROM "team_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  // `fk_pricing_rule_*_tenant` is `ON DELETE RESTRICT` — pricing rules must
  // go before the service/add-on rows they target.
  await dataSource.query(
    `DELETE FROM "pricing_rule_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(
    `DELETE FROM "service_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(
    `DELETE FROM "add_on_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(
    `DELETE FROM "admin_user_entity" WHERE "tenantId" = ANY($1)`,
    [ids],
  );
  await dataSource.query(`DELETE FROM "tenant_entity" WHERE "id" = ANY($1)`, [
    ids,
  ]);
}

async function saveAdmin(
  dataSource: DataSource,
  fields: Pick<AdminUserEntity, 'role' | 'scope' | 'tenantId'>,
  emailPrefix: string,
): Promise<SeededAdmin> {
  const repository = dataSource.getRepository(AdminUserEntity);
  const password = `${emailPrefix}-pw-${randomUUID()}`;
  const email = `${emailPrefix}-${randomUUID()}@example.com`;
  const entity = await repository.save(
    repository.create({
      ...fields,
      email,
      isActive: true,
      passwordHash: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
    }),
  );
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    email,
    password,
    principal: {
      id: entity.id,
      tenantId: entity.tenantId,
      role: entity.role,
      scope: entity.scope,
    },
  };
}

// A `TENANT`-scope admin of `tenantId` (the bootstrap tenant by default).
export function seedTenantAdmin(
  dataSource: DataSource,
  role: Exclude<Role, Role.SUPER_ADMIN> = Role.TENANT_OWNER,
  tenantId: string = BOOTSTRAP_TENANT_ID,
): Promise<SeededAdmin> {
  return saveAdmin(
    dataSource,
    { tenantId, role, scope: AdminScope.TENANT },
    role.toLowerCase().replace(/_/g, '-'),
  );
}

// A `PLATFORM`-scope Super Admin: no tenant.
export function seedSuperAdmin(dataSource: DataSource): Promise<SeededAdmin> {
  return saveAdmin(
    dataSource,
    { tenantId: null, role: Role.SUPER_ADMIN, scope: AdminScope.PLATFORM },
    'super-admin',
  );
}
