import { spawn } from 'node:child_process';
import { Client } from 'pg';
import type { EffectiveConnectionSettings } from '../../src/platform/database/effective-connection-settings';
import {
  apiRoot,
  findPendingMigrations,
  migrationCliEnv,
  migrationNamesFromFiles,
  type QueryClient,
  readAppliedMigrations,
} from './migration-files';
import { ProvisionError } from './provision-error';

// E2E isolation spec §4.4: provisioning for the Jest globalSetup. This is
// the only file under apps/api/test that imports `pg` (invariant 1,
// source-import rule). It runs in globalSetup or in the provision-cli.ts
// child, never inside a test environment.

export type MigrationRunner = (
  target: EffectiveConnectionSettings,
) => Promise<void>;

export interface ProvisionResult {
  applied: number;
  created: boolean;
  maintenanceStatements: string[];
  unknown: number;
}

const MIGRATION_TIMEOUT_MS = 120_000;
const CREATE_DATABASE = ['CREATE', 'DATABASE'].join(' ');
const DUPLICATE_DATABASE = '42P04';

export const runMigrationCli: MigrationRunner = (target) =>
  new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn('pnpm', ['run', 'migration:run'], {
      cwd: apiRoot,
      env: migrationCliEnv(target, process.env),
    });
    let stderr = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2048);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(fail(target, 'migrate', 'timed out after 120 s', stderr));
    }, MIGRATION_TIMEOUT_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      rejectRun(fail(target, 'migrate', error.message, stderr));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(fail(target, 'migrate', `exit code ${code}`, stderr));
      }
    });
  });

export async function provisionTestDatabase(
  target: EffectiveConnectionSettings,
  run: MigrationRunner = runMigrationCli,
): Promise<ProvisionResult> {
  const maintenanceStatements: string[] = [];
  let created = false;

  const maintenance = new Client({
    database: 'postgres',
    host: target.host,
    password: target.password,
    port: target.port,
    user: target.username,
  });
  await step(target, 'connect maintenance', () => maintenance.connect());
  try {
    const exists = 'SELECT 1 FROM pg_database WHERE datname = $1';
    maintenanceStatements.push(exists);
    const found: { rowCount: number | null } = await step(
      target,
      'check database',
      () =>
        maintenance.query(exists, [target.database]) as Promise<{
          rowCount: number | null;
        }>,
    );
    if (found.rowCount === 0) {
      const createSql = `${CREATE_DATABASE} ${quoteIdentifier(target.database)}`;
      maintenanceStatements.push(createSql);
      try {
        await maintenance.query(createSql);
        created = true;
      } catch (error) {
        if ((error as { code?: string }).code !== DUPLICATE_DATABASE) {
          throw fail(target, 'create target', (error as Error).message);
        }
      }
    }
  } finally {
    await maintenance.end();
  }

  const client = new Client({
    database: target.database,
    host: target.host,
    password: target.password,
    port: target.port,
    user: target.username,
  });
  await step(target, 'connect test database', () => client.connect());
  try {
    const before = await step(target, 'read migrations', () =>
      readAppliedMigrations(client as QueryClient),
    );
    await run(target);
    const after = await step(target, 'read migrations', () =>
      readAppliedMigrations(client as QueryClient),
    );
    const fileNames = migrationNamesFromFiles();
    const pending = findPendingMigrations(fileNames, after);
    if (pending.length > 0) {
      throw fail(
        target,
        'confirm none pending',
        `${pending.length} pending migration(s), first: ${pending.slice(0, 3).join(', ')}`,
      );
    }
    const known = new Set(fileNames);
    return {
      applied: after.length - before.length,
      created,
      maintenanceStatements,
      unknown: after.filter((name) => !known.has(name)).length,
    };
  } finally {
    await client.end();
  }
}

function fail(
  target: EffectiveConnectionSettings,
  stepName: string,
  detail: string,
  stderrTail = '',
): ProvisionError {
  const redact = (text: string): string =>
    target.password === ''
      ? text
      : text.split(target.password).join('<redacted>');
  const tail = stderrTail === '' ? '' : `\n${redact(stderrTail)}`;
  return new ProvisionError(
    redact(
      `e2e provisioning failed at step "${stepName}" for database ${JSON.stringify(target.database)} on host ${target.host}: ${detail}`,
    ) + tail,
  );
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function step<T>(
  target: EffectiveConnectionSettings,
  stepName: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ProvisionError) {
      throw error;
    }
    throw fail(target, stepName, (error as Error).message);
  }
}
