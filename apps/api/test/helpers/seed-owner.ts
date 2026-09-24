import { Repository } from 'typeorm';
import { AdminUserEntity } from '../../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { Role } from '../../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../../src/platform/database/bootstrap-tenant';
import { seedTenantAdmin } from './seed-tenant-admin';

export interface SeededOwner {
  id: string;
  tenantId: string;
  email: string;
  password: string;
}

// Test-only fixture helper, deliberately separate from
// `src/platform/database/seed.ts` (Task 3's dev-only `pnpm db:seed`
// convenience, gated on `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` env vars).
// This e2e suite must be self-contained — it inserts its own Owner directly
// via a repository, exactly like `app.e2e-spec.ts`'s "creates its own
// data" precedent, rather than depending on any prior seed step or
// environment configuration.
//
// Seeds a `TENANT_OWNER` of the bootstrap tenant — the privileged tenant
// user every module e2e suite logs in as. The bootstrap tenant row is created
// by the `AddTenantAndAdminScope` migration and only referenced here, never
// inserted (plan Task 8). Business data stays unscoped in this slice, so
// these suites exercise exactly what they did under the retired OWNER role.
//
// Kept as a repository-taking entry point for the module suites; the
// seeding itself is `seedTenantAdmin`'s (random email per call, so repeated
// runs against the same real database never collide).
export async function seedOwner(
  repository: Repository<AdminUserEntity>,
): Promise<SeededOwner> {
  const { id, email, password } = await seedTenantAdmin(
    repository.manager.connection,
    Role.TENANT_OWNER,
    BOOTSTRAP_TENANT_ID,
  );
  return { id, tenantId: BOOTSTRAP_TENANT_ID, email, password };
}
