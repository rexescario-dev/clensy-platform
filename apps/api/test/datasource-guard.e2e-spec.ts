import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { AppConfigModule } from '../src/platform/config/config.module';
import { DatabaseModule } from '../src/platform/database/database.module';
import {
  type CountingListener,
  startCountingListener,
} from './support/counting-listener';
import {
  e2eConnectionOptions,
  ScratchDatabases,
  withE2eEnv,
} from './support/e2e-connection';
import {
  assertConnectedDatabase,
  GUARD_MARKER,
  installDataSourceGuard,
  UnsafeDataSourceError,
} from './support/datasource-guard';

// E2E isolation spec §4.5 item 1, invariant 3, §7 (stage 1, stage 2).
// Task 4: standalone. No real database is needed: every stage 1 case aims
// at a listener that counts accepted sockets, and the count must stay 0.

const apiDir = resolve(__dirname, '..');

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current !== undefined && current !== null && chain.length < 10) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

describe('two-stage DataSource guard (standalone)', () => {
  let listener: CountingListener;

  beforeAll(async () => {
    // From Task 7 the guard comes only from setupFiles; this file does not
    // install it on the real DataSource class.
    listener = await startCountingListener();
  });

  it('setupFiles installed the guard on DataSource (precondition)', () => {
    const proto = DataSource.prototype as unknown as Record<symbol, unknown>;
    expect(proto[GUARD_MARKER]).toBe(true);
  });

  afterAll(async () => {
    await listener.close();
  });

  function pointed(extra: Record<string, unknown>): DataSourceOptions {
    return {
      host: listener.host,
      password: 'pw',
      port: listener.port,
      type: 'postgres',
      username: 'u',
      ...extra,
    };
  }

  async function expectRejectedWithoutConnecting(
    options: DataSourceOptions,
  ): Promise<void> {
    const before = listener.count();
    await expect(new DataSource(options).initialize()).rejects.toBeInstanceOf(
      UnsafeDataSourceError,
    );
    expect(listener.count()).toBe(before);
    expect(listener.count()).toBe(0);
  }

  describe('stage 1 rejects before connecting', () => {
    it.each<[string, Record<string, unknown>]>([
      ['database postgres', { database: 'postgres' }],
      ['database clensy', { database: 'clensy' }],
      ['database undefined', { database: undefined }],
      ['database whitespace', { database: '  ' }],
      ['database not a string', { database: 42 }],
      [
        'extra.database clensy',
        { database: 'clensy_test', extra: { database: 'clensy' } },
      ],
      [
        'extra.database empty',
        { database: 'clensy_test', extra: { database: '' } },
      ],
      [
        'extra.database undefined',
        { database: 'clensy_test', extra: { database: undefined } },
      ],
    ])('%s', async (_label, extra) => {
      await expectRejectedWithoutConnecting(pointed(extra));
    });

    it('a non-postgres type (cockroachdb) with a valid name', async () => {
      // The CockroachDB driver loads the installed `pg`, so the constructor
      // succeeds and the guard is what rejects (plan finding R-25).
      await expectRejectedWithoutConnecting(
        pointed({ database: 'clensy_test', type: 'cockroachdb' }),
      );
    });

    it('url', async () => {
      await expectRejectedWithoutConnecting(
        pointed({
          database: 'clensy_test',
          url: `postgres://u:p@127.0.0.1:${listener.port}/clensy_test`,
        }),
      );
    });

    it('replication', async () => {
      await expectRejectedWithoutConnecting(
        pointed({
          replication: {
            master: {
              database: 'clensy_test',
              host: listener.host,
              password: 'pw',
              port: listener.port,
              username: 'u',
            },
            slaves: [],
          },
        }),
      );
    });

    it('extra.connectionString', async () => {
      await expectRejectedWithoutConnecting(
        pointed({
          database: 'clensy_test',
          extra: {
            connectionString: `postgres://u:p@127.0.0.1:${listener.port}/clensy`,
          },
        }),
      );
    });

    it('extra.Client, a recording stub', async () => {
      let connects = 0;
      class RecordingClientStub {
        connect(): Promise<void> {
          connects += 1;
          return Promise.resolve();
        }
      }
      await expectRejectedWithoutConnecting(
        pointed({
          database: 'clensy_test',
          extra: { Client: RecordingClientStub },
        }),
      );
      expect(connects).toBe(0);
    });

    it('a custom driver, a recording stub', async () => {
      let calls = 0;
      const recordingDriverStub = {
        Pool: class {
          constructor() {
            calls += 1;
          }
          connect(): Promise<void> {
            calls += 1;
            return Promise.resolve();
          }
        },
      };
      await expectRejectedWithoutConnecting(
        pointed({ database: 'clensy_test', driver: recordingDriverStub }),
      );
      expect(calls).toBe(0);
    });
  });

  describe('stage 2', () => {
    it('rejects a connected name that differs', () => {
      expect(() => assertConnectedDatabase('clensy_test', 'clensy')).toThrow(
        UnsafeDataSourceError,
      );
    });

    it('accepts the validated name', () => {
      expect(() =>
        assertConnectedDatabase('clensy_test', 'clensy_test'),
      ).not.toThrow();
    });

    it('surfaces the guard error, with a failing destroy() as its cause', async () => {
      const destroyError = new Error('destroy failed');
      class Stub {
        options = { database: 'clensy_test', type: 'postgres' };
        destroy(): Promise<void> {
          return Promise.reject(destroyError);
        }
        initialize(): Promise<this> {
          return Promise.resolve(this);
        }
        query(): Promise<Array<{ name: string }>> {
          return Promise.resolve([{ name: 'other_test' }]);
        }
      }
      installDataSourceGuard(Stub as unknown as { prototype: DataSource });
      let caught: unknown;
      try {
        await new Stub().initialize();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(UnsafeDataSourceError);
      expect((caught as Error).cause).toBe(destroyError);
    });
  });

  // Characterization test (plan Task 4, nativeDriver pin). It runs in a
  // child so that this spec never imports `pg` itself (source-import rule).
  // Break, outside the commit: redefine `pg.native` before its first read.
  it('pg.native is null, so pg-native cannot replace the driver (characterization)', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', "process.exit(require('pg').native === null ? 0 : 1)"],
      { cwd: apiDir, encoding: 'utf8', timeout: 30_000 },
    );
    expect(result.status).toBe(0);
  });

  describe('idempotence, on a stub class', () => {
    it('marks the prototype once and never wraps twice', () => {
      class Stub {
        initialize(): Promise<this> {
          return Promise.resolve(this);
        }
      }
      const proto = Stub.prototype as unknown as Record<symbol, unknown>;
      const initializeOf = (): unknown =>
        Object.getOwnPropertyDescriptor(Stub.prototype, 'initialize')?.value;
      expect(proto[GUARD_MARKER]).toBeUndefined();
      const original = initializeOf();
      installDataSourceGuard(Stub as unknown as { prototype: DataSource });
      expect(proto[GUARD_MARKER]).toBe(true);
      const wrapped = initializeOf();
      expect(wrapped).not.toBe(original);
      installDataSourceGuard(Stub as unknown as { prototype: DataSource });
      expect(initializeOf()).toBe(wrapped);
    });
  });

  // Early Nest-path probe (optional, recommended in the plan). It needs no
  // database: the guard must reject the application's DataSource before it
  // connects. Nest retries 9 times, 3000 ms apart.
  it('rejects the Nest application DataSource before connecting', async () => {
    await withE2eEnv(
      {
        DB_HOST: '127.0.0.1',
        DB_NAME: 'clensy',
        DB_PORT: String(listener.port),
      },
      async () => {
        let caught: unknown;
        try {
          await Test.createTestingModule({
            imports: [AppConfigModule, DatabaseModule],
          }).compile();
        } catch (error) {
          caught = error;
        }
        expect(
          causeChain(caught).some((e) => e instanceof UnsafeDataSourceError),
        ).toBe(true);
        expect(listener.count()).toBe(0);
      },
    );
  }, 60_000);

  // G6 coverage (plan Task 7). The guard must reach every DataSource path
  // through setupFiles alone.
  describe('coverage of every DataSource path', () => {
    it('helper path: a non-Test name is rejected before connecting', async () => {
      await expectRejectedWithoutConnecting({
        ...e2eConnectionOptions(),
        database: 'clensy',
        host: listener.host,
        port: listener.port,
      });
    });

    it('scratch path: an unsuffixed scratch name is rejected before connecting', async () => {
      await expectRejectedWithoutConnecting({
        ...e2eConnectionOptions(),
        database: `clensy_migration_${'0'.repeat(32)}`,
        host: listener.host,
        port: listener.port,
      });
    });

    it('scratch path: a generated name passes stage 1 and reaches the server', async () => {
      const name = new ScratchDatabases().generate();
      let caught: unknown;
      try {
        await new DataSource(e2eConnectionOptions(name)).initialize();
      } catch (error) {
        caught = error;
      }
      expect(caught).not.toBeInstanceOf(UnsafeDataSourceError);
      // 3D000 invalid_catalog_name: the server was reached and said the
      // database does not exist, so the guard let the connection through.
      expect((caught as { code?: string }).code).toBe('3D000');
    });

    it('pass: a Test-database DataSource initialises, with one current_database() check', async () => {
      const ds = new DataSource(e2eConnectionOptions());
      const spy = jest.spyOn(ds, 'query');
      await ds.initialize();
      try {
        expect(ds.isInitialized).toBe(true);
        const checks = spy.mock.calls.filter(([sql]) =>
          String(sql).includes('current_database()'),
        );
        expect(checks).toHaveLength(1);
      } finally {
        spy.mockRestore();
        await ds.destroy();
      }
    });

    it('stage 2 integration: a different reported name destroys the DataSource', async () => {
      const ds = new DataSource(e2eConnectionOptions());
      jest
        .spyOn(ds, 'query')
        .mockResolvedValueOnce([{ name: 'other_test' }] as never);
      await expect(ds.initialize()).rejects.toBeInstanceOf(
        UnsafeDataSourceError,
      );
      expect(ds.isInitialized).toBe(false);
    });
  });
});
