import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { AdminScope } from '../../auth/domain/admin-scope';
import { Role } from '../../auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';
import type { ValueSource } from '../effective-connection-settings';

// E2E isolation spec §4.7: the dev-owner seeding core (guard 6, lookup,
// behaviour table, password check) and its one-line output. The only
// writes are one INSERT (created) or one passwordHash UPDATE (password
// reset), inside one transaction. Output never contains an email, a
// password, a hash or salt material (invariant 9).

/** The same bcrypt cost as `pnpm db:seed`. */
export const DEV_OWNER_BCRYPT_ROUNDS = 10;

type Attribute = 'isActive' | 'role' | 'scope' | 'tenantId';

export type DevOwnerResult =
  | { count: 1; outcome: 'not normalised' }
  | { count: number; outcome: 'ambiguous' }
  | { differing: readonly Attribute[]; id: string; outcome: 'mismatch' }
  | { id: string; outcome: 'created' }
  | { id: string; outcome: 'password reset' }
  | { id: string; outcome: 'unchanged'; password: 'differs' | 'matches' }
  | { outcome: 'tenant missing' };

interface AdminRow {
  email: string;
  id: string;
  isActive: boolean;
  passwordHash: string;
  role: Role;
  scope: AdminScope;
  tenantId: string | null;
}

const FAILURES: ReadonlySet<DevOwnerResult['outcome']> = new Set([
  'ambiguous',
  'mismatch',
  'not normalised',
  'tenant missing',
]);

export function formatDevOwnerResult(
  result: DevOwnerResult,
  context: {
    database: string;
    emailSource: ValueSource;
    host: string;
    passwordSource: ValueSource;
  },
): string {
  const where = `database=${context.database} host=${context.host} email-source=${context.emailSource} password-source=${context.passwordSource}`;
  switch (result.outcome) {
    case 'ambiguous':
      return `dev-owner: refused: ambiguous: ${result.count} accounts match count=${result.count} ${where}`;
    case 'created':
      return `dev-owner: created id=${result.id} ${where}`;
    case 'mismatch':
      return `dev-owner: refused: mismatch id=${result.id} ${result.differing
        .map((attribute) => `${attribute} differs`)
        .join(', ')} ${where}`;
    case 'not normalised':
      return `dev-owner: refused: not normalised: existing account email is not normalised count=${result.count} ${where}`;
    case 'password reset':
      return `dev-owner: password reset id=${result.id} ${where}`;
    case 'tenant missing':
      return `dev-owner: refused: tenant missing: Bootstrap tenant missing ${where}`;
    case 'unchanged':
      return `dev-owner: unchanged id=${result.id} ${where} ${
        result.password === 'matches'
          ? 'password: matches ADMIN_SEED_PASSWORD'
          : 'password: differs from ADMIN_SEED_PASSWORD (run with --reset-password to apply it)'
      }`;
  }
}

export function isFailure(result: DevOwnerResult): boolean {
  return FAILURES.has(result.outcome);
}

/**
 * Creates or verifies the development owner. `email` must already be
 * lowercased (Task 9 does it); `bootstrapTenantId` exists only so the
 * "tenant missing" case can be tested.
 */
export async function seedDevOwner(
  dataSource: DataSource,
  input: {
    bootstrapTenantId?: string;
    email: string;
    password: string;
    resetPassword: boolean;
  },
): Promise<DevOwnerResult> {
  if (input.email !== input.email.toLowerCase()) {
    throw new Error('seedDevOwner: the email must already be normalised');
  }
  const tenantId = input.bootstrapTenantId ?? BOOTSTRAP_TENANT_ID;

  return dataSource.transaction(async (manager) => {
    const tenant: unknown[] = await manager.query(
      'SELECT 1 FROM "tenant_entity" WHERE "id" = $1',
      [tenantId],
    );
    if (tenant.length === 0) {
      return { outcome: 'tenant missing' } as const;
    }

    const rows: AdminRow[] = await manager.query(
      'SELECT "id", "email", "role", "scope", "tenantId", "isActive", "passwordHash" FROM "admin_user_entity" WHERE lower("email") = $1 FOR UPDATE',
      [input.email],
    );

    if (rows.length === 0) {
      const hash = await bcrypt.hash(input.password, DEV_OWNER_BCRYPT_ROUNDS);
      const inserted: Array<{ id: string }> = await manager.query(
        'INSERT INTO "admin_user_entity" ("email", "passwordHash", "role", "scope", "tenantId", "isActive") VALUES ($1, $2, $3, $4, $5, true) RETURNING "id"',
        [input.email, hash, Role.TENANT_OWNER, AdminScope.TENANT, tenantId],
      );
      return { id: inserted[0].id, outcome: 'created' } as const;
    }
    if (rows.length > 1) {
      return { count: rows.length, outcome: 'ambiguous' } as const;
    }

    const row = rows[0];
    if (row.email !== input.email) {
      return { count: 1, outcome: 'not normalised' } as const;
    }

    const differing: Attribute[] = [];
    if (row.role !== Role.TENANT_OWNER) {
      differing.push('role');
    }
    if (row.scope !== AdminScope.TENANT) {
      differing.push('scope');
    }
    if (row.tenantId !== tenantId) {
      differing.push('tenantId');
    }
    if (!row.isActive) {
      differing.push('isActive');
    }
    if (differing.length > 0) {
      return { differing, id: row.id, outcome: 'mismatch' } as const;
    }

    if (input.resetPassword) {
      const hash = await bcrypt.hash(input.password, DEV_OWNER_BCRYPT_ROUNDS);
      await manager.query(
        'UPDATE "admin_user_entity" SET "passwordHash" = $1 WHERE "id" = $2',
        [hash, row.id],
      );
      return { id: row.id, outcome: 'password reset' } as const;
    }

    const matches = await bcrypt.compare(input.password, row.passwordHash);
    return {
      id: row.id,
      outcome: 'unchanged',
      password: matches ? 'matches' : 'differs',
    } as const;
  });
}
