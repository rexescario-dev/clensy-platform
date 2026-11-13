import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CountingListener,
  startCountingListener,
} from './support/counting-listener';
import { apiRoot } from './support/migration-files';

// E2E isolation spec §4.7 (invocation, guards, "Never automatic"), invariant
// 9 and Review Focus 5. Every case runs the entrypoint directly from a fresh
// temporary directory with a test-written .env, so the developer's real
// apps/api/.env can never influence it. Every child aims at the counting
// listener with an explicit non-test DB_NAME sentinel, never a deletion,
// so no child can fall back to a real database. Children run with async
// spawn so the in-process listener can count connections.

const SENTINEL_EMAIL = 'sentinel.owner@example.com';
const SENTINEL_PASSWORD = 'S3ntinel-Pw!';

interface Run {
  output: string;
  status: number | null;
  stderr: string;
  stdout: string;
}

let listener: CountingListener;

beforeAll(async () => {
  listener = await startCountingListener();
});

afterAll(async () => {
  await listener.close();
});

async function runSeeder(options: {
  args?: string[];
  dotenv?: string;
  env?: Record<string, string | undefined>;
}): Promise<Run> {
  const cwd = mkdtempSync(join(tmpdir(), 'dev-owner-cli-'));
  try {
    expect(cwd).not.toBe(apiRoot);
    writeFileSync(join(cwd, '.env'), options.dotenv ?? '');
    const env: Record<string, string | undefined> = {
      ...process.env,
      ADMIN_SEED_EMAIL: SENTINEL_EMAIL,
      ADMIN_SEED_PASSWORD: SENTINEL_PASSWORD,
      DB_HOST: '127.0.0.1',
      DB_NAME: 'dev_owner_cli_sentinel',
      DB_PORT: String(listener.port),
      TS_NODE_PROJECT: join(apiRoot, 'tsconfig.json'),
      ...options.env,
    };
    delete env.NODE_ENV;
    if (options.env && 'NODE_ENV' in options.env) {
      env.NODE_ENV = options.env.NODE_ENV;
    }
    return await new Promise<Run>((resolveRun) => {
      const child = spawn(
        process.execPath,
        [
          '-r',
          join(apiRoot, 'node_modules/ts-node/register'),
          '-r',
          join(apiRoot, 'node_modules/tsconfig-paths/register'),
          join(apiRoot, 'src/platform/database/seed-dev-owner.ts'),
          ...(options.args ?? []),
        ],
        { cwd, env },
      );
      let output = '';
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 55_000);
      child.on('close', (status) => {
        clearTimeout(timer);
        resolveRun({ output, status, stderr, stdout });
      });
    });
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
}

function expectRedacted(output: string): void {
  expect(output).not.toContain(SENTINEL_EMAIL);
  expect(output).not.toContain(SENTINEL_PASSWORD);
}

/** M7 observation 7: a refusal or error is reported on stderr only. */
function expectOnStderr(run: Run, message: RegExp): void {
  expect(run.stderr).toMatch(message);
  expect(run.stdout).toBe('');
}

describe('db:seed:dev-owner entrypoint (child process)', () => {
  it.each<[string, Parameters<typeof runSeeder>[0], RegExp]>([
    [
      'production',
      { env: { NODE_ENV: 'production' } },
      /refused: NODE_ENV is production/,
    ],
    [
      'test database',
      { env: { DB_NAME: 'clensy_test' } },
      /refused: DB_NAME is a Test database/,
    ],
    ['bad argument', { args: ['--bogus'] }, /refused: unknown argument/],
    [
      'missing email',
      { env: { ADMIN_SEED_EMAIL: undefined } },
      /refused: ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD/,
    ],
  ])(
    '%s: exits 1 with its own refusal, opening no connection',
    async (_label, options, refusal) => {
      const before = listener.count();
      const run = await runSeeder(options);
      expect(run.status).toBe(1);
      expect(run.output).toMatch(refusal);
      expectOnStderr(run, refusal);
      expect(listener.count()).toBe(before);
      expect(listener.count()).toBe(0);
      expectRedacted(run.output);
    },
    60_000,
  );

  it('remote host: exits 1 with the host refusal', async () => {
    const run = await runSeeder({ env: { DB_HOST: 'db.example.com' } });
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/refused: DB_HOST is not a local host/);
    expectOnStderr(run, /refused: DB_HOST is not a local host/);
    expectRedacted(run.output);
  }, 60_000);

  it('Review Focus 5: the working-directory .env is read', async () => {
    const run = await runSeeder({ dotenv: 'NODE_ENV=production\n' });
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/refused: NODE_ENV is production/);
    expectOnStderr(run, /refused: NODE_ENV is production/);
    expect(listener.count()).toBe(0);
    expectRedacted(run.output);
  }, 60_000);

  it('a connection error is reported on stderr, not stdout', async () => {
    // A listener of its own, so the shared listener's count stays 0. It
    // accepts and then closes, so the connection attempt fails after every
    // guard has passed: the entrypoint's error branch.
    const own = await startCountingListener();
    try {
      const run = await runSeeder({ env: { DB_PORT: String(own.port) } });
      expect(run.status).toBe(1);
      expectOnStderr(run, /^dev-owner: error: /m);
      expectRedacted(run.output);
      expect(own.count()).toBeGreaterThan(0);
    } finally {
      await own.close();
    }
  }, 60_000);
});
