import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AdminUserEntity } from '../../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { AdminScope } from '../../src/platform/auth/domain/admin-scope';
import { Role } from '../../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../../src/platform/database/bootstrap-tenant';

const BCRYPT_SALT_ROUNDS = 4; // low cost — this is a test fixture, not production hashing

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
// A random email per call keeps repeated test runs against the same
// (non-truncated, real) Postgres database collision-free with each other
// and with any pre-existing dev data.
export async function seedOwner(
  repository: Repository<AdminUserEntity>,
): Promise<SeededOwner> {
  const password = `owner-pw-${randomUUID()}`;
  const email = `owner-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const entity = await repository.save(
    repository.create({
      tenantId: BOOTSTRAP_TENANT_ID,
      email,
      isActive: true,
      passwordHash,
      role: Role.TENANT_OWNER,
      scope: AdminScope.TENANT,
    }),
  );

  return { id: entity.id, tenantId: BOOTSTRAP_TENANT_ID, email, password };
}
