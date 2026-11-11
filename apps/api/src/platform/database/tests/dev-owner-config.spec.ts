import {
  devOwnerEnvFilePath,
  DevOwnerRefusal,
  parseDevOwnerArgs,
  resolveDevOwnerConfig,
} from '../dev-owner/dev-owner-config';
import type { EffectiveConnectionSettings } from '../effective-connection-settings';

// E2E isolation spec §4.7 (invocation, effective settings, guards 1–5),
// author calls 5 and 13, note e.

const EMAIL = 'Sentinel.Owner@Example.com';
const PASSWORD = 'S3ntinel-Pw!';
const DB_PASSWORD = 'S3ntinel-Db-Pw!';

const valid = {
  ADMIN_SEED_EMAIL: EMAIL,
  ADMIN_SEED_PASSWORD: PASSWORD,
  DB_HOST: 'localhost',
  DB_NAME: 'clensy',
  DB_PASSWORD,
  DB_PORT: '5432',
  DB_USERNAME: 'clensy',
};

function refusal(
  launch: Record<string, string | undefined>,
  file = {},
): string {
  try {
    resolveDevOwnerConfig(launch, file);
  } catch (error) {
    expect(error).toBeInstanceOf(DevOwnerRefusal);
    return (error as Error).message;
  }
  throw new Error('expected a refusal');
}

describe('resolveDevOwnerConfig guards', () => {
  it('accepts a valid local development configuration', () => {
    const config = resolveDevOwnerConfig(valid, {});
    expect(config.settings).toEqual({
      database: 'clensy',
      host: 'localhost',
      password: DB_PASSWORD,
      port: 5432,
      username: 'clensy',
    });
  });

  it.each(['production', ' Production ', 'PRODUCTION'])(
    'guard 1: NODE_ENV=%p is refused',
    (nodeEnv) => {
      expect(refusal({ ...valid, NODE_ENV: nodeEnv })).toMatch(/production/i);
    },
  );

  it('guard 1 reads NODE_ENV from the file too', () => {
    expect(refusal(valid, { NODE_ENV: 'production' })).toMatch(/production/i);
  });

  it.each([
    ['ADMIN_SEED_EMAIL', undefined],
    ['ADMIN_SEED_EMAIL', ''],
    ['ADMIN_SEED_PASSWORD', '   '],
  ])('guard 2: %s=%p is refused', (key, value) => {
    expect(refusal({ ...valid, [key]: value })).toMatch(/ADMIN_SEED/);
  });

  it.each([['0'], ['abc'], ['65536']])(
    'guard 3: DB_PORT=%p is refused',
    (port) => {
      expect(refusal({ ...valid, DB_PORT: port })).toMatch(
        /connection settings/,
      );
    },
  );

  it.each(['::1', 'localhost.example.com', '127.0.0.2', '/var/run/postgresql'])(
    'guard 4: DB_HOST=%p is refused',
    (host) => {
      expect(refusal({ ...valid, DB_HOST: host })).toMatch(/local host/);
    },
  );

  it('guard 5: a Test database is refused', () => {
    expect(refusal({ ...valid, DB_NAME: 'clensy_test' })).toMatch(
      /Test database/,
    );
  });

  describe('guard order', () => {
    it.each<[string, Record<string, string | undefined>, RegExp]>([
      [
        'production before missing email',
        { ADMIN_SEED_EMAIL: undefined, NODE_ENV: 'production' },
        /production/i,
      ],
      [
        'missing email before a bad port',
        { ADMIN_SEED_EMAIL: undefined, DB_PORT: 'abc' },
        /ADMIN_SEED/,
      ],
      [
        'bad port before a remote host',
        { DB_HOST: 'db.example.com', DB_PORT: 'abc' },
        /connection settings/,
      ],
      [
        'remote host before a Test database',
        { DB_HOST: 'db.example.com', DB_NAME: 'clensy_test' },
        /local host/,
      ],
    ])('%s', (_label, overrides, expected) => {
      expect(refusal({ ...valid, ...overrides })).toMatch(expected);
    });
  });
});

describe('resolveDevOwnerConfig layering', () => {
  it('a missing launch email falls through to the file, labelled as such', () => {
    const config = resolveDevOwnerConfig(
      { ...valid, ADMIN_SEED_EMAIL: '' },
      { ADMIN_SEED_EMAIL: 'file@example.com' },
    );
    expect(config.email).toBe('file@example.com');
    expect(config.emailSource).toBe('apps/api/.env');
    expect(config.passwordSource).toBe('launch environment');
  });

  it('keeps the password verbatim', () => {
    expect(
      resolveDevOwnerConfig({ ...valid, ADMIN_SEED_PASSWORD: ' pw ' }, {})
        .password,
    ).toBe(' pw ');
  });

  it.each<[string, string, string, string, keyof EffectiveConnectionSettings]>([
    ['DB_HOST', '127.0.0.1', 'postgres', 'localhost', 'host'],
    ['DB_PORT', '6543', '7654', '5432', 'port'],
    ['DB_USERNAME', 'launch_user', 'file_user', 'clensy', 'username'],
    ['DB_PASSWORD', 'launch_pw', 'file_pw', 'clensy_dev', 'password'],
    ['DB_NAME', 'launch_db', 'file_db', 'clensy', 'database'],
  ])(
    '%s: launch beats file beats default',
    (key, launch, file, fallback, field) => {
      const base = { ADMIN_SEED_EMAIL: EMAIL, ADMIN_SEED_PASSWORD: PASSWORD };
      const pick = (
        l: Record<string, string>,
        f: Record<string, string>,
      ): string =>
        String(resolveDevOwnerConfig({ ...base, ...l }, f).settings[field]);
      expect(pick({ [key]: launch }, { [key]: file })).toBe(launch);
      expect(pick({}, { [key]: file })).toBe(file);
      expect(pick({}, {})).toBe(fallback);
    },
  );

  it('ignores PGDATABASE: launch DB_NAME empty, file DB_NAME=clensy → clensy', () => {
    expect(
      resolveDevOwnerConfig(
        { ...valid, DB_NAME: '', PGDATABASE: 'clensy_test' },
        { DB_NAME: 'clensy' },
      ).settings.database,
    ).toBe('clensy');
  });

  it('lowercases the email with no trim (Review Focus 2)', () => {
    expect(
      resolveDevOwnerConfig(
        { ...valid, ADMIN_SEED_EMAIL: 'Owner@Example.com' },
        {},
      ).email,
    ).toBe('owner@example.com');
  });
});

describe('parseDevOwnerArgs', () => {
  it('accepts no arguments and --reset-password', () => {
    expect(parseDevOwnerArgs([])).toEqual({ resetPassword: false });
    expect(parseDevOwnerArgs(['--reset-password'])).toEqual({
      resetPassword: true,
    });
  });

  it.each([[['--reset']], [['--', '--reset-password']], [['x']]])(
    'refuses %p',
    (argv) => {
      expect(() => parseDevOwnerArgs(argv)).toThrow(DevOwnerRefusal);
    },
  );
});

describe('redaction', () => {
  it('no refusal message contains the email, the password or the DB password', () => {
    const cases: Array<Record<string, string | undefined>> = [
      { ...valid, NODE_ENV: 'production' },
      { ...valid, ADMIN_SEED_PASSWORD: '' },
      { ...valid, DB_PORT: 'abc' },
      { ...valid, DB_HOST: 'db.example.com' },
      { ...valid, DB_NAME: 'clensy_test' },
    ];
    for (const launch of cases) {
      const message = refusal(launch);
      for (const secret of [
        EMAIL,
        EMAIL.toLowerCase(),
        PASSWORD,
        DB_PASSWORD,
      ]) {
        expect(message).not.toContain(secret);
      }
    }
  });
});

describe('devOwnerEnvFilePath', () => {
  it('is .env in the working directory (note e)', () => {
    expect(devOwnerEnvFilePath('/x/apps/api')).toBe('/x/apps/api/.env');
  });
});
