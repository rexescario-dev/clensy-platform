import { resolve } from 'node:path';
import {
  type EffectiveConnectionSettings,
  type EnvSource,
  isLocalHost,
  isMissing,
  isTestDatabaseName,
  parseEnvFile,
  resolveLayered,
  TEST_DATABASE_NAME_PATTERN,
  validateEffectiveSettings,
} from '../../src/platform/database/effective-connection-settings';

// E2E isolation spec §4.2: the one resolver that works out the e2e target.
// `DB_NAME` comes from the launch environment only; the other keys are
// layered over `apps/api/.env` and the defaults.

const DEFAULT_E2E_DATABASE = 'clensy_test';

export class E2eTargetError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'E2eTargetError';
  }
}

export function publishE2eTarget(
  target: EffectiveConnectionSettings,
  env: NodeJS.ProcessEnv = process.env,
): void {
  env.DB_HOST = target.host.trim();
  env.DB_NAME = target.database;
  env.DB_PASSWORD = target.password;
  env.DB_PORT = String(target.port);
  env.DB_USERNAME = target.username.trim();
}

/** `apps/api/.env`, located from the test tree rather than from `cwd`. */
export function readApiEnvFile(): EnvSource {
  return parseEnvFile(resolve(__dirname, '../../.env'));
}

export function resolveE2eTarget(
  launchEnv: EnvSource,
  envFile: EnvSource,
): EffectiveConnectionSettings {
  const launchName = launchEnv.DB_NAME;
  const database = isMissing(launchName)
    ? DEFAULT_E2E_DATABASE
    : (launchName as string);
  if (!isTestDatabaseName(database)) {
    throw new E2eTargetError(
      `e2e DB_NAME ${JSON.stringify(database)} is not a Test database: it must match ${TEST_DATABASE_NAME_PATTERN.source}`,
    );
  }

  const layers = [launchEnv, envFile] as const;
  let settings: EffectiveConnectionSettings;
  try {
    settings = validateEffectiveSettings({
      database,
      host: resolveLayered('DB_HOST', layers, 'localhost').value,
      password: resolveLayered('DB_PASSWORD', layers, 'clensy_dev').value,
      port: resolveLayered('DB_PORT', layers, '5432').value,
      username: resolveLayered('DB_USERNAME', layers, 'clensy').value,
    });
  } catch (error) {
    throw new E2eTargetError(
      `e2e connection settings are invalid: ${(error as Error).message}`,
      { cause: error },
    );
  }

  if (!isLocalHost(settings.host)) {
    throw new E2eTargetError(
      `e2e DB_HOST ${JSON.stringify(settings.host)} is not on the local host allowlist`,
    );
  }
  return settings;
}
