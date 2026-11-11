import { resolve } from 'node:path';
import {
  type EffectiveConnectionSettings,
  type EnvSource,
  isLocalHost,
  isMissing,
  isTestDatabaseName,
  resolveLayered,
  validateEffectiveSettings,
  type ValueSource,
} from '../effective-connection-settings';

// E2E isolation spec §4.7: `pnpm db:seed:dev-owner` invocation, effective
// settings and guards 1–5. Pure: a function of the launch environment, the
// parsed `.env` and the arguments. Refusal messages name the guard and
// never contain an email, a password or a hash.

const RESET_PASSWORD_FLAG = '--reset-password';

export interface DevOwnerConfig {
  email: string;
  emailSource: ValueSource;
  password: string;
  passwordSource: ValueSource;
  settings: EffectiveConnectionSettings;
}

export class DevOwnerRefusal extends Error {
  constructor(reason: string) {
    super(`dev-owner: refused: ${reason}`);
    this.name = 'DevOwnerRefusal';
  }
}

/** `.env` relative to the working directory, as `pnpm db:seed` reads it (note e). */
export function devOwnerEnvFilePath(cwd: string = process.cwd()): string {
  return resolve(cwd, '.env');
}

export function parseDevOwnerArgs(argv: readonly string[]): {
  resetPassword: boolean;
} {
  if (argv.length === 0) {
    return { resetPassword: false };
  }
  if (argv.length === 1 && argv[0] === RESET_PASSWORD_FLAG) {
    return { resetPassword: true };
  }
  throw new DevOwnerRefusal(
    `unknown argument; the only accepted argument is ${RESET_PASSWORD_FLAG}`,
  );
}

/** Guards 1–5 in spec order, then the resolved configuration. */
export function resolveDevOwnerConfig(
  launchEnv: EnvSource,
  envFile: EnvSource,
): DevOwnerConfig {
  const layers = [launchEnv, envFile] as const;

  const nodeEnv = resolveLayered('NODE_ENV', layers, undefined).value;
  if ((nodeEnv ?? '').trim().toLowerCase() === 'production') {
    throw new DevOwnerRefusal('NODE_ENV is production');
  }

  const email = resolveLayered('ADMIN_SEED_EMAIL', layers, undefined);
  const password = resolveLayered('ADMIN_SEED_PASSWORD', layers, undefined);
  if (isMissing(email.value) || isMissing(password.value)) {
    throw new DevOwnerRefusal(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must both be set',
    );
  }

  let settings: EffectiveConnectionSettings;
  try {
    settings = validateEffectiveSettings({
      database: resolveLayered('DB_NAME', layers, 'clensy').value,
      host: resolveLayered('DB_HOST', layers, 'localhost').value,
      password: resolveLayered('DB_PASSWORD', layers, 'clensy_dev').value,
      port: resolveLayered('DB_PORT', layers, '5432').value,
      username: resolveLayered('DB_USERNAME', layers, 'clensy').value,
    });
  } catch (error) {
    throw new DevOwnerRefusal(
      `invalid connection settings (${(error as Error).message})`,
    );
  }

  if (!isLocalHost(settings.host)) {
    throw new DevOwnerRefusal('DB_HOST is not a local host');
  }
  if (isTestDatabaseName(settings.database)) {
    throw new DevOwnerRefusal(
      'DB_NAME is a Test database, which e2e runs truncate',
    );
  }

  return {
    email: (email.value as string).toLowerCase(),
    emailSource: email.source,
    password: password.value as string,
    passwordSource: password.source,
    settings,
  };
}
