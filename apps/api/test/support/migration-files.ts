import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EffectiveConnectionSettings } from '../../src/platform/database/effective-connection-settings';
import { ProvisionError } from './provision-error';

// Pure helpers for e2e provisioning (E2E isolation spec §4.4). This module
// never imports `pg` or TypeORM, so test specs may import it (plan Task 5,
// source-import rule).

export const apiRoot: string = resolve(__dirname, '../..');

/** Inherited variables the migration child may keep (owner decision, Q4). */
export const MIGRATION_CHILD_ENV_PASSTHROUGH = [
  'HOME',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'CI',
  'PNPM_HOME',
  'COREPACK_HOME',
  // Optional portability variables: corepack finds its cache through
  // COREPACK_HOME, then XDG_CACHE_HOME, then HOME/.cache.
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
] as const;

const MIGRATIONS_DIR = join(apiRoot, 'src/platform/database/migrations');
const MIGRATION_FILE = /^(\d{13})-([A-Za-z0-9]+)\.ts$/;

/** The minimal client interface readAppliedMigrations needs; pg.Client fits. */
export interface QueryClient {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export function findPendingMigrations(
  fileNames: readonly string[],
  appliedNames: readonly string[],
): string[] {
  const applied = new Set(appliedNames);
  return fileNames.filter((name) => !applied.has(name));
}

/**
 * The migration CLI child's environment, built from nothing: the target's
 * five DB_* values, a required PATH, and the pass-through variables that
 * are present. The parent environment is never spread (blocker B-02).
 */
export function migrationCliEnv(
  target: EffectiveConnectionSettings,
  parentEnv: NodeJS.ProcessEnv,
): Record<string, string> {
  const path = parentEnv.PATH;
  if (path === undefined || path === '') {
    throw new ProvisionError(
      'step migrate: the parent environment has no PATH for the migration child',
    );
  }
  const env: Record<string, string> = {
    DB_HOST: target.host,
    DB_NAME: target.database,
    DB_PASSWORD: target.password,
    DB_PORT: String(target.port),
    DB_USERNAME: target.username,
    PATH: path,
  };
  for (const key of MIGRATION_CHILD_ENV_PASSTHROUGH) {
    const value = parentEnv[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

export function migrationFileTimestamps(dir = MIGRATIONS_DIR): string[] {
  return migrationFiles(dir).map((file) => file.timestamp);
}

/** `<ClassName><timestamp>` for each migration file, the name TypeORM records. */
export function migrationNamesFromFiles(dir = MIGRATIONS_DIR): string[] {
  return migrationFiles(dir).map((file) => {
    const source = readFileSync(join(dir, file.file), 'utf8');
    const match = /export class (\w+)/.exec(source);
    if (match === null) {
      throw new ProvisionError(`migration ${file.file} exports no class`);
    }
    return match[1];
  });
}

export async function readAppliedMigrations(
  client: QueryClient,
): Promise<string[]> {
  const exists = await client.query(
    "SELECT to_regclass('public.migrations') AS t",
  );
  if (exists.rows[0]?.t === null || exists.rows[0]?.t === undefined) {
    return [];
  }
  const applied = await client.query('SELECT name FROM migrations ORDER BY id');
  return applied.rows.map((row) => String(row.name));
}

function migrationFiles(
  dir: string,
): Array<{ file: string; timestamp: string }> {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .map((file) => {
      const match = MIGRATION_FILE.exec(file);
      if (match === null) {
        throw new ProvisionError(`unexpected migration file name ${file}`);
      }
      return { file, timestamp: match[1] };
    });
}
