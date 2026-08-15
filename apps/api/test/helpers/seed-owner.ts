import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AdminUserEntity } from '../../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { Role } from '../../src/platform/auth/domain/role';

const BCRYPT_SALT_ROUNDS = 4; // low cost — this is a test fixture, not production hashing

export interface SeededOwner {
  id: string;
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
      email,
      passwordHash,
      role: Role.OWNER,
      isActive: true,
    }),
  );

  return { id: entity.id, email, password };
}
