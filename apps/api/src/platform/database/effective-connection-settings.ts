import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

// Shared, pure connection rules for the e2e resolver and the dev-owner
// seeder (E2E isolation spec §4.1, §4.2 items 2–3, §4.7). This module must
// stay free of application code, TypeORM and load-time environment reads.

/** §4.1 Test-database rule: ASCII lowercase, ends in `_test`, 6–63 bytes. */
export const TEST_DATABASE_NAME_PATTERN = /^(?=.{6,63}$)[a-z][a-z0-9_]*_test$/;

/** §4.1 Local host allowlist, matched case-insensitively on the whole value. */
export const LOCAL_HOST_ALLOWLIST: readonly string[] = [
  'localhost',
  '127.0.0.1',
  'postgres',
];

const PORT_PATTERN = /^[0-9]+$/;

export type EnvSource = Readonly<Record<string, string | undefined>>;

export type ValueSource = 'apps/api/.env' | 'default' | 'launch environment';

export interface EffectiveConnectionSettings {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
}

export class InvalidConnectionSettingsError extends Error {
  constructor(key: string, reason: string) {
    super(`invalid connection setting ${key}: ${reason}`);
    this.name = 'InvalidConnectionSettingsError';
  }
}

/** §4.1 local host allowlist: trimmed, case-insensitive, whole value. */
export function isLocalHost(host: string): boolean {
  return LOCAL_HOST_ALLOWLIST.includes(host.trim().toLowerCase());
}

/** §4.1 Missing value: unset, empty, or whitespace only. */
export function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

export function isTestDatabaseName(name: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(name);
}

/**
 * Parses an env file without applying it to `process.env`. A missing file
 * gives `{}`; any other read error throws.
 */
export function parseEnvFile(path: string): EnvSource {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
  return parse(content);
}

/** §4.2 item 2: launch environment, then `apps/api/.env`, then the default. */
export function resolveLayered(
  key: string,
  layers: readonly [EnvSource, EnvSource],
  fallback: string | undefined,
): { source: ValueSource; value: string | undefined } {
  const [launch, file] = layers;
  if (!isMissing(launch[key])) {
    return { source: 'launch environment', value: launch[key] };
  }
  if (!isMissing(file[key])) {
    return { source: 'apps/api/.env', value: file[key] };
  }
  return { source: 'default', value: fallback };
}

/**
 * §4.1 Effective settings. Host and username are trimmed; database and
 * password are kept verbatim; the password may be empty. Errors name the
 * key, never a value.
 */
export function validateEffectiveSettings(input: {
  database?: string;
  host?: string;
  password?: string;
  port?: string;
  username?: string;
}): EffectiveConnectionSettings {
  if (isMissing(input.host)) {
    throw new InvalidConnectionSettingsError('DB_HOST', 'missing');
  }
  const portText = (input.port ?? '').trim();
  if (!PORT_PATTERN.test(portText)) {
    throw new InvalidConnectionSettingsError(
      'DB_PORT',
      'must be a decimal integer',
    );
  }
  const port = Number(portText);
  if (port < 1 || port > 65535) {
    throw new InvalidConnectionSettingsError(
      'DB_PORT',
      'must be between 1 and 65535',
    );
  }
  if (isMissing(input.username)) {
    throw new InvalidConnectionSettingsError('DB_USERNAME', 'missing');
  }
  if (input.database === undefined || input.database === '') {
    throw new InvalidConnectionSettingsError('DB_NAME', 'missing');
  }
  return {
    database: input.database,
    host: (input.host as string).trim(),
    password: input.password ?? '',
    port,
    username: (input.username as string).trim(),
  };
}
