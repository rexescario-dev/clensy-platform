import { spawn } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  type CountingListener,
  startCountingListener,
} from './support/counting-listener';
import {
  e2eConnectionOptions,
  e2eTarget,
  ScratchDatabases,
  withE2eEnv,
} from './support/e2e-connection';
import {
  apiRoot,
  MIGRATION_CHILD_ENV_PASSTHROUGH,
  migrationCliEnv,
  migrationNamesFromFiles,
  type QueryClient,
  readAppliedMigrations,
} from './support/migration-files';
import { ProvisionError } from './support/provision-error';

// E2E isolation spec §4.2 (ordering), §4.4 items 1–6, invariant 1 and §7
// (ordering, PG*, fail-closed, globalSetup). This file never imports `pg` or
// provision-test-database.ts: every provisioning case runs in a
// provision-cli.ts child, outside the test environment (blocker B-01).

type ConfigModuleExports =
  typeof import('../src/platform/config/config.module');
type DataSourceExports = typeof import('../src/platform/database/data-source');

const CHILD_TIMEOUT = 120_000;
const CREATE_KEYWORD = ['CREATE', 'DATABASE'].join(' ');

interface ChildRun {
  result: Record<string, unknown> | undefined;
  status: number | null;
  stderr: string;
  stdout: string;
}

/**
 * Spawns a child asynchronously. A synchronous spawn would block this
 * process's event loop, so the in-process counting listener could neither
 * accept nor count the child's connections.
 */
function runChild(
  command: string,
  args: string[],
  env: Record<string, string | undefined>,
  timeoutMs: number,
): Promise<{ status: number | null; stderr: string; stdout: string }> {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: apiRoot, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolveRun({ status, stderr, stdout });
    });
  });
}

async function runProvisionCli(
  env: Record<string, string | undefined>,
  args: string[] = [],
): Promise<ChildRun> {
  const child = await runChild(
    process.execPath,
    [
      '-r',
      join(apiRoot, 'node_modules/ts-node/register'),
      '-r',
      join(apiRoot, 'node_modules/tsconfig-paths/register'),
      join(apiRoot, 'test/support/provision-cli.ts'),
      ...args,
    ],
    {
      ...process.env,
      ...env,
      TS_NODE_PROJECT: join(apiRoot, 'tsconfig.cli.json'),
    },
    CHILD_TIMEOUT - 10_000,
  );
  const line = child.stdout
    .split('\n')
    .find((l) => l.startsWith('PROVISION_RESULT '));
  return {
    result:
      line === undefined
        ? undefined
        : (JSON.parse(line.slice('PROVISION_RESULT '.length)) as Record<
            string,
            unknown
          >),
    status: child.status,
    stderr: child.stderr,
    stdout: child.stdout,
  };
}

async function withDataSource<T>(
  database: string | undefined,
  fn: (ds: DataSource) => Promise<T>,
): Promise<T> {
  const ds = new DataSource(e2eConnectionOptions(database));
  await ds.initialize();
  try {
    return await fn(ds);
  } finally {
    await ds.destroy();
  }
}

function dotenvConfigOverrides(): Record<string, undefined> {
  return Object.fromEntries(
    Object.keys(process.env)
      .filter((key) => key.startsWith('DOTENV_CONFIG_'))
      .map((key) => [key, undefined]),
  );
}

describe('e2e isolation', () => {
  let listener: CountingListener;
  const scratch = new ScratchDatabases();
  const created: string[] = [];

  beforeAll(async () => {
    listener = await startCountingListener();
  });

  afterAll(async () => {
    await listener.close();
    await withDataSource(undefined, async (admin) => {
      for (const name of created) {
        await scratch.drop(admin, name);
      }
    });
  });

  describe('ordering', () => {
    const envPath = join(apiRoot, '.env');
    let wroteEnv = false;

    beforeAll(() => {
      if (existsSync(envPath)) {
        expect(readFileSync(envPath, 'utf8')).toMatch(/^DB_NAME=clensy$/m);
      } else {
        writeFileSync(
          envPath,
          'DB_NAME=clensy\nE2E_ORDERING_SENTINEL=present\n',
        );
        wroteEnv = true;
      }
    });

    afterAll(() => {
      if (wroteEnv) {
        rmSync(envPath);
      }
    });

    it('ConfigService, data-source.ts and a helper DataSource all see the published target', async () => {
      const target = e2eTarget().database;
      await withE2eEnv(dotenvConfigOverrides(), async () => {
        // Loaded only now, after the precondition file exists: forRoot()
        // reads .env when the module is first evaluated. require(), because
        // ts-jest keeps import() as a native dynamic import here.
        /* eslint-disable @typescript-eslint/no-require-imports -- deferred loads, see above */
        const { AppConfigModule } =
          require('../src/platform/config/config.module') as ConfigModuleExports;
        const moduleRef = await Test.createTestingModule({
          imports: [AppConfigModule],
        }).compile();
        const config = moduleRef.get(ConfigService);
        expect(config.get('DB_NAME')).toBe(target);
        if (wroteEnv) {
          expect(config.get('E2E_ORDERING_SENTINEL')).toBe('present');
        }
        await moduleRef.close();

        const dataSource = (
          require('../src/platform/database/data-source') as DataSourceExports
        ).default;
        /* eslint-enable @typescript-eslint/no-require-imports */
        expect(dataSource.options.database).toBe(target);

        const current = await withDataSource(undefined, async (ds) => {
          const rows: Array<{ name: string }> = await ds.query(
            'SELECT current_database() AS name',
          );
          return rows[0].name;
        });
        expect(current).toBe(target);
      });
    });
  });

  it('PG* variables do not redirect a helper DataSource', async () => {
    await withE2eEnv(
      {
        PGDATABASE: 'clensy',
        PGHOST: 'db.invalid',
        PGPORT: '1',
        PGUSER: 'nobody',
      },
      async () => {
        const current = await withDataSource(undefined, async (ds) => {
          const rows: Array<{ name: string }> = await ds.query(
            'SELECT current_database() AS name',
          );
          return rows[0].name;
        });
        expect(current).toBe(e2eTarget().database);
      },
    );
  });

  it('a Jest run with DB_NAME=clensy fails closed before any connection', async () => {
    const child = await runChild(
      'pnpm',
      [
        'exec',
        'jest',
        '--config',
        'test/jest-e2e.json',
        'test/e2e-target.e2e-spec.ts',
      ],
      {
        ...process.env,
        DB_HOST: '127.0.0.1',
        DB_NAME: 'clensy',
        DB_PORT: String(listener.port),
      },
      55_000,
    );
    expect(child.status).not.toBe(0);
    expect(`${child.stdout}${child.stderr}`).toContain(
      'is not a Test database',
    );
    expect(listener.count()).toBe(0);
  }, 60_000);

  describe('globalSetup provisioning, in a child process', () => {
    it(
      'creates and migrates on the first run, then is a provable no-op',
      async () => {
        const name = scratch.generate();
        created.push(name);
        const fileNames = migrationNamesFromFiles();

        const first = await runProvisionCli({ DB_NAME: name });
        expect(first.stderr).toBe('');
        expect(first.status).toBe(0);
        expect(first.result).toMatchObject({
          applied: fileNames.length,
          created: true,
          unknown: 0,
        });

        const snapshot = (): Promise<{
          columns: string;
          ids: number[];
          names: string[];
          oid: string;
        }> =>
          withDataSource(name, async (ds) => {
            const rows: Array<{ id: number; name: string }> = await ds.query(
              'SELECT id, name FROM migrations ORDER BY id',
            );
            const [{ oid }]: Array<{ oid: string }> = await ds.query(
              'SELECT oid::text AS oid FROM pg_database WHERE datname = current_database()',
            );
            const [{ digest }]: Array<{ digest: string }> = await ds.query(
              "SELECT md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' ORDER BY table_name, column_name)) AS digest FROM information_schema.columns WHERE table_schema = 'public'",
            );
            return {
              columns: digest,
              ids: rows.map((r) => r.id),
              names: rows.map((r) => r.name),
              oid,
            };
          });

        const afterFirst = await snapshot();
        expect(new Set(afterFirst.names)).toEqual(new Set(fileNames));
        expect(afterFirst.names).toHaveLength(fileNames.length);

        const second = await runProvisionCli({ DB_NAME: name });
        expect(second.status).toBe(0);
        expect(second.result).toMatchObject({
          applied: 0,
          created: false,
          unknown: 0,
        });
        const statements = second.result?.maintenanceStatements as string[];
        expect(statements).toHaveLength(1);
        expect(statements[0]).toMatch(/pg_database/);
        expect(statements.join('\n').toUpperCase()).not.toContain(
          CREATE_KEYWORD,
        );

        expect(await snapshot()).toEqual(afterFirst);
      },
      2 * CHILD_TIMEOUT,
    );

    it(
      'fails with the pending count after creating, when migrations are skipped',
      async () => {
        const name = scratch.generate();
        created.push(name);
        const target = e2eTarget();
        const run = await runProvisionCli({ DB_NAME: name }, [
          '--skip-migrations',
        ]);
        expect(run.status).not.toBe(0);
        expect(run.stderr).toMatch(/pending/);
        expect(run.stderr).toContain(name);
        expect(run.stderr).toContain(target.host);
        expect(run.stderr).toContain(
          `${migrationNamesFromFiles().length} pending`,
        );
        expect(run.result).toBeUndefined();
        if (target.password !== '') {
          expect(run.stderr).not.toContain(target.password);
        }
        const rows = await withDataSource(undefined, (ds) =>
          ds.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]),
        );
        expect(rows).toHaveLength(1);
      },
      CHILD_TIMEOUT,
    );

    it(
      'fails at the connect step for an unreachable server',
      async () => {
        const target = e2eTarget();
        const run = await runProvisionCli({
          DB_HOST: '127.0.0.1',
          DB_NAME: scratch.generate(),
          DB_PORT: String(listener.port),
        });
        expect(run.status).toBe(1);
        expect(run.stderr).toMatch(/connect/);
        expect(run.stderr).toContain('127.0.0.1');
        if (target.password !== '') {
          expect(run.stderr).not.toContain(target.password);
        }
      },
      CHILD_TIMEOUT,
    );
  });

  describe('migration child environment (allowlist)', () => {
    const target = {
      database: 'clensy_test',
      host: 'localhost',
      password: 'pw',
      port: 5432,
      username: 'clensy',
    };

    it('keeps exactly the allowlisted keys and the target DB_* values', () => {
      const env = migrationCliEnv(target, {
        DATABASE_URL: 'postgres://x/clensy',
        DB_NAME: 'clensy',
        DOTENV_CONFIG_OVERRIDE: 'true',
        DOTENV_CONFIG_PATH: '/x/.env',
        HOME: '/h',
        NODE_OPTIONS: '--require /x',
        NODE_PATH: '/x',
        npm_config_x: '1',
        PATH: '/bin',
        PGDATABASE: 'clensy',
        TS_NODE_PROJECT: '/x',
        XDG_CACHE_HOME: '/c',
        XDG_CONFIG_HOME: '/g',
        XDG_DATA_HOME: '/d',
        XDG_RUNTIME_DIR: '/r',
      });
      expect(env).toEqual({
        DB_HOST: 'localhost',
        DB_NAME: 'clensy_test',
        DB_PASSWORD: 'pw',
        DB_PORT: '5432',
        DB_USERNAME: 'clensy',
        HOME: '/h',
        PATH: '/bin',
        XDG_CACHE_HOME: '/c',
        XDG_CONFIG_HOME: '/g',
      });
    });

    it('never invents optional variables the parent lacks', () => {
      const env = migrationCliEnv(target, { PATH: '/bin' });
      expect(Object.keys(env).sort()).toEqual([
        'DB_HOST',
        'DB_NAME',
        'DB_PASSWORD',
        'DB_PORT',
        'DB_USERNAME',
        'PATH',
      ]);
    });

    it('names exactly the nine pass-through variables', () => {
      expect([...MIGRATION_CHILD_ENV_PASSTHROUGH]).toEqual([
        'HOME',
        'TMPDIR',
        'LANG',
        'LC_ALL',
        'CI',
        'PNPM_HOME',
        'COREPACK_HOME',
        'XDG_CACHE_HOME',
        'XDG_CONFIG_HOME',
      ]);
    });

    it('throws ProvisionError when the parent has no PATH', () => {
      expect(() => migrationCliEnv(target, {})).toThrow(ProvisionError);
    });
  });

  describe('static confinement', () => {
    const support = (file: string): string =>
      readFileSync(join(apiRoot, 'test/support', file), 'utf8');

    it('spawns the CLI child with migrationCliEnv and no parent spread', () => {
      const source = support('provision-test-database.ts');
      expect(source).toContain('env: migrationCliEnv(');
      expect(source).not.toContain('...process.env');
      const envUses = source.match(/process\.env/g) ?? [];
      expect(envUses).toHaveLength(1);
      expect(source).toContain('migrationCliEnv(target, process.env)');
    });

    it('globalSetup calls provisionTestDatabase with one argument', () => {
      const source = readFileSync(
        join(apiRoot, 'test/global-setup.ts'),
        'utf8',
      );
      expect(source).toMatch(/provisionTestDatabase\(\s*target\s*\)/);
    });

    it('only provision-cli.ts and this test mention the skip flag', () => {
      const flag = ['--skip', 'migrations'].join('-');
      const testRoot = join(apiRoot, 'test');
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory()
            ? walk(join(dir, entry.name))
            : [join(dir, entry.name)],
        );
      const mentions = walk(testRoot)
        .filter((file) => /\.(ts|js|mjs|cjs|mts|cts)$/.test(file))
        .filter((file) => readFileSync(file, 'utf8').includes(flag))
        .map((file) => relative(testRoot, file))
        .sort();
      expect(mentions).toEqual([
        'e2e-isolation.e2e-spec.ts',
        'support/provision-cli.ts',
      ]);
    });
  });

  describe('readAppliedMigrations (stub QueryClient, no pg)', () => {
    it('returns [] when the migrations table is absent, with no second query', async () => {
      const calls: string[] = [];
      const client: QueryClient = {
        query: (sql: string) => {
          calls.push(sql);
          return Promise.resolve({ rows: [{ t: null }] });
        },
      };
      expect(await readAppliedMigrations(client)).toEqual([]);
      expect(calls).toHaveLength(1);
    });

    it('returns the names in id order when the table exists', async () => {
      const client: QueryClient = {
        query: (sql: string) =>
          Promise.resolve(
            sql.includes('to_regclass')
              ? { rows: [{ t: 'migrations' }] }
              : { rows: [{ name: 'A1' }, { name: 'B2' }] },
          ),
      };
      expect(await readAppliedMigrations(client)).toEqual(['A1', 'B2']);
    });
  });
});
