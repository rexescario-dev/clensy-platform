import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { TenantEntity } from '../src/modules/admins/infrastructure/persistence/tenant.entity';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { seedDevOwner } from '../src/platform/database/dev-owner/dev-owner-seeder';
import { withCapturedSql } from './helpers/capture-sql';
import {
  createTestTenant,
  removeTestTenants,
} from './helpers/seed-tenant-admin';
import { e2eConnectionOptions } from './support/e2e-connection';

// E2E isolation spec §4.7 (guard 6, lookup, behaviour table, password
// check, boundaries), invariants 7 and 8, calls 6 and 10. Runs the core
// against the Test database. "No write" means: no INSERT/UPDATE/DELETE in
// the captured SQL, every table's digest unchanged, the row's xmin unchanged.

const WRITE = /^\s*(insert|update|delete)\b/i;

let dataSource: DataSource;
const adminIds: string[] = [];
const tenantIds: string[] = [];

beforeAll(async () => {
  dataSource = new DataSource({
    ...e2eConnectionOptions(),
    entities: [AdminUserEntity, TenantEntity],
  });
  await dataSource.initialize();
});

afterEach(async () => {
  if (adminIds.length > 0) {
    await dataSource.query(
      'DELETE FROM admin_user_entity WHERE id = ANY($1::uuid[])',
      [adminIds.splice(0)],
    );
  }
  await removeTestTenants(dataSource, tenantIds.splice(0));
});

afterAll(async () => {
  await dataSource.destroy();
});

function email(): string {
  return `dev-owner-${randomUUID()}@example.com`;
}

async function insertAdmin(row: {
  email: string;
  isActive?: boolean;
  password: string;
  role?: string;
  scope?: string;
  tenantId?: string | null;
}): Promise<string> {
  const hash = await bcrypt.hash(row.password, 4);
  const [{ id }]: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO admin_user_entity (email, "passwordHash", role, scope, "tenantId", "isActive")
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      row.email,
      hash,
      row.role ?? 'TENANT_OWNER',
      row.scope ?? 'TENANT',
      row.tenantId === undefined ? BOOTSTRAP_TENANT_ID : row.tenantId,
      row.isActive ?? true,
    ],
  );
  adminIds.push(id);
  return id;
}

/** Per-table row count and content digest across the public schema. */
async function digests(): Promise<Record<string, string>> {
  const tables: Array<{ name: string }> = await dataSource.query(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1",
  );
  const out: Record<string, string> = {};
  for (const { name } of tables) {
    const [{ digest }]: Array<{ digest: string }> = await dataSource.query(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS digest FROM "${name}" t`,
    );
    out[name] = digest;
  }
  return out;
}

async function xmin(id: string): Promise<string> {
  const [{ x }]: Array<{ x: string }> = await dataSource.query(
    'SELECT xmin::text AS x FROM admin_user_entity WHERE id = $1',
    [id],
  );
  return x;
}

async function expectNoWrite(
  run: () => Promise<unknown>,
  rowIds: string[] = [],
): Promise<unknown> {
  const before = await digests();
  const xminsBefore = await Promise.all(rowIds.map(xmin));
  const { queries, result } = await withCapturedSql(dataSource, run);
  expect(queries.filter((q) => WRITE.test(q))).toEqual([]);
  expect(await digests()).toEqual(before);
  expect(await Promise.all(rowIds.map(xmin))).toEqual(xminsBefore);
  return result;
}

describe('seedDevOwner core (Test database)', () => {
  it('created: one INSERT into admin_user_entity, nothing else changes', async () => {
    const address = email();
    const before = await digests();
    const { queries, result } = await withCapturedSql(dataSource, () =>
      seedDevOwner(dataSource, {
        email: address,
        password: 'pw',
        resetPassword: false,
      }),
    );
    expect(result.outcome).toBe('created');
    const id = (result as { id: string }).id;
    adminIds.push(id);
    const writes = queries.filter((q) => WRITE.test(q));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^\s*insert into "?admin_user_entity"?/i);
    const after = await digests();
    for (const table of Object.keys(before)) {
      if (table !== 'admin_user_entity') {
        expect({ table, digest: after[table] }).toEqual({
          digest: before[table],
          table,
        });
      }
    }
    expect(Number(after.admin_user_entity.split(':')[0])).toBe(
      Number(before.admin_user_entity.split(':')[0]) + 1,
    );
    const [row]: Array<Record<string, unknown>> = await dataSource.query(
      'SELECT role, scope, "tenantId", "isActive", "passwordHash" FROM admin_user_entity WHERE id = $1',
      [id],
    );
    expect(row).toMatchObject({
      tenantId: BOOTSTRAP_TENANT_ID,
      isActive: true,
      role: 'TENANT_OWNER',
      scope: 'TENANT',
    });
    expect(bcrypt.getRounds(row.passwordHash as string)).toBe(10);
  });

  it('unchanged, matches: no write, hash byte-identical', async () => {
    const address = email();
    const id = await insertAdmin({ email: address, password: 'pw' });
    const [{ passwordHash: hashBefore }]: Array<{ passwordHash: string }> =
      await dataSource.query(
        'SELECT "passwordHash" FROM admin_user_entity WHERE id = $1',
        [id],
      );
    const result = await expectNoWrite(
      () =>
        seedDevOwner(dataSource, {
          email: address,
          password: 'pw',
          resetPassword: false,
        }),
      [id],
    );
    expect(result).toEqual({ id, outcome: 'unchanged', password: 'matches' });
    const [{ passwordHash: hashAfter }]: Array<{ passwordHash: string }> =
      await dataSource.query(
        'SELECT "passwordHash" FROM admin_user_entity WHERE id = $1',
        [id],
      );
    expect(hashAfter === hashBefore).toBe(true);
  });

  it('unchanged, differs: no write', async () => {
    const address = email();
    const id = await insertAdmin({ email: address, password: 'pw' });
    const result = await expectNoWrite(
      () =>
        seedDevOwner(dataSource, {
          email: address,
          password: 'other',
          resetPassword: false,
        }),
      [id],
    );
    expect(result).toEqual({ id, outcome: 'unchanged', password: 'differs' });
  });

  describe('mismatch, with and without --reset-password: no write', () => {
    it.each([false, true])('role FINANCE (reset=%p)', async (resetPassword) => {
      const address = email();
      const id = await insertAdmin({
        email: address,
        password: 'pw',
        role: 'FINANCE',
      });
      expect(
        await expectNoWrite(
          () =>
            seedDevOwner(dataSource, {
              email: address,
              password: 'pw',
              resetPassword,
            }),
          [id],
        ),
      ).toEqual({ differing: ['role'], id, outcome: 'mismatch' });
    });

    it.each([false, true])(
      'another tenant (reset=%p)',
      async (resetPassword) => {
        const tenant = await createTestTenant(dataSource);
        tenantIds.push(tenant);
        const address = email();
        const id = await insertAdmin({
          email: address,
          password: 'pw',
          tenantId: tenant,
        });
        expect(
          await expectNoWrite(
            () =>
              seedDevOwner(dataSource, {
                email: address,
                password: 'pw',
                resetPassword,
              }),
            [id],
          ),
        ).toEqual({ differing: ['tenantId'], id, outcome: 'mismatch' });
      },
    );

    it.each([false, true])('disabled (reset=%p)', async (resetPassword) => {
      const address = email();
      const id = await insertAdmin({
        email: address,
        isActive: false,
        password: 'pw',
      });
      expect(
        await expectNoWrite(
          () =>
            seedDevOwner(dataSource, {
              email: address,
              password: 'pw',
              resetPassword,
            }),
          [id],
        ),
      ).toEqual({ differing: ['isActive'], id, outcome: 'mismatch' });
    });

    it.each([false, true])(
      'platform scope (reset=%p)',
      async (resetPassword) => {
        const address = email();
        const id = await insertAdmin({
          tenantId: null,
          email: address,
          password: 'pw',
          role: 'SUPER_ADMIN',
          scope: 'PLATFORM',
        });
        expect(
          await expectNoWrite(
            () =>
              seedDevOwner(dataSource, {
                email: address,
                password: 'pw',
                resetPassword,
              }),
            [id],
          ),
        ).toEqual({
          differing: ['role', 'scope', 'tenantId'],
          id,
          outcome: 'mismatch',
        });
      },
    );
  });

  it.each([false, true])(
    'not normalised (reset=%p): no write (Review Focus 2)',
    async (resetPassword) => {
      const address = email();
      const id = await insertAdmin({
        email: address.replace('dev-owner', 'Dev-Owner'),
        password: 'pw',
      });
      expect(
        await expectNoWrite(
          () =>
            seedDevOwner(dataSource, {
              email: address,
              password: 'pw',
              resetPassword,
            }),
          [id],
        ),
      ).toEqual({ count: 1, outcome: 'not normalised' });
    },
  );

  it.each([false, true])(
    'ambiguous (reset=%p): no write',
    async (resetPassword) => {
      const address = email();
      const a = await insertAdmin({ email: address, password: 'pw' });
      const b = await insertAdmin({
        email: address.toUpperCase(),
        password: 'pw',
      });
      expect(
        await expectNoWrite(
          () =>
            seedDevOwner(dataSource, {
              email: address,
              password: 'pw',
              resetPassword,
            }),
          [a, b],
        ),
      ).toEqual({ count: 2, outcome: 'ambiguous' });
    },
  );

  it('password reset: one UPDATE of passwordHash only', async () => {
    const address = email();
    const id = await insertAdmin({ email: address, password: 'old' });
    const [before]: Array<Record<string, unknown>> = await dataSource.query(
      'SELECT * FROM admin_user_entity WHERE id = $1',
      [id],
    );
    const othersBefore = await digests();
    const { queries, result } = await withCapturedSql(dataSource, () =>
      seedDevOwner(dataSource, {
        email: address,
        password: 'new',
        resetPassword: true,
      }),
    );
    expect(result).toEqual({ id, outcome: 'password reset' });
    const writes = queries.filter((q) => WRITE.test(q));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(
      /^\s*update "?admin_user_entity"? set "passwordHash"/i,
    );
    const [after]: Array<Record<string, unknown>> = await dataSource.query(
      'SELECT * FROM admin_user_entity WHERE id = $1',
      [id],
    );
    expect({ ...after, passwordHash: 'x' }).toEqual({
      ...before,
      passwordHash: 'x',
    });
    expect(await bcrypt.compare('new', after.passwordHash as string)).toBe(
      true,
    );
    const othersAfter = await digests();
    for (const table of Object.keys(othersBefore)) {
      if (table !== 'admin_user_entity') {
        expect(othersAfter[table]).toBe(othersBefore[table]);
      }
    }
  });

  it('reset with no row creates the owner (call 6)', async () => {
    const result = await seedDevOwner(dataSource, {
      email: email(),
      password: 'pw',
      resetPassword: true,
    });
    expect(result.outcome).toBe('created');
    adminIds.push((result as { id: string }).id);
  });

  it('tenant missing: no write', async () => {
    expect(
      await expectNoWrite(() =>
        seedDevOwner(dataSource, {
          bootstrapTenantId: randomUUID(),
          email: email(),
          password: 'pw',
          resetPassword: false,
        }),
      ),
    ).toEqual({ outcome: 'tenant missing' });
  });

  it('insert race: the losing run fails with a unique violation and writes nothing', async () => {
    const address = email();
    const other = new DataSource({ ...e2eConnectionOptions(), entities: [] });
    await other.initialize();
    const runner = other.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const [{ id }]: Array<{ id: string }> = await runner.query(
      `INSERT INTO admin_user_entity (email, "passwordHash", role, scope, "tenantId", "isActive")
       VALUES ($1, 'x', 'TENANT_OWNER', 'TENANT', $2, true) RETURNING id`,
      [address, BOOTSTRAP_TENANT_ID],
    );
    const loser = seedDevOwner(dataSource, {
      email: address,
      password: 'pw',
      resetPassword: false,
    }).then(
      () => undefined,
      (error: unknown) => error,
    );
    const deadline = Date.now() + 10_000;
    for (;;) {
      const [{ waiting }]: Array<{ waiting: number }> = await runner.query(
        "SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
      );
      if (waiting > 0 || Date.now() > deadline) {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    await runner.commitTransaction();
    adminIds.push(id);
    const error = await loser;
    await runner.release();
    await other.destroy();
    expect(
      (error as { driverError?: { code?: string } })?.driverError?.code,
    ).toBe('23505');
    const rows: unknown[] = await dataSource.query(
      'SELECT id FROM admin_user_entity WHERE lower(email) = $1',
      [address],
    );
    expect(rows).toHaveLength(1);
  });

  it('caller contract: an email that is not lowercase throws before any statement', async () => {
    const spy = jest.spyOn(dataSource, 'transaction');
    await expect(
      seedDevOwner(dataSource, {
        email: 'Upper@Example.com',
        password: 'pw',
        resetPassword: false,
      }),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
