import { TEST_DATABASE_NAME_PATTERN } from '../src/platform/database/effective-connection-settings';
import {
  E2eTargetError,
  publishE2eTarget,
  resolveE2eTarget,
} from './support/e2e-target';

// E2E isolation spec §4.2 items 1–5 and the §6 e2e table. Pure: nothing here
// connects to a database.
describe('resolveE2eTarget', () => {
  const sentinelPassword = 'S3ntinel-Pw!';

  function message(fn: () => unknown): string {
    try {
      fn();
    } catch (error) {
      return (error as Error).message;
    }
    return '';
  }

  describe('spec §6 e2e rows', () => {
    it('no launch DB_NAME, file DB_NAME=clensy → clensy_test', () => {
      expect(resolveE2eTarget({}, { DB_NAME: 'clensy' }).database).toBe(
        'clensy_test',
      );
    });
    it.each(['   ', ''])('launch DB_NAME=%p → clensy_test', (name) => {
      expect(resolveE2eTarget({ DB_NAME: name }, {}).database).toBe(
        'clensy_test',
      );
    });
    it('launch DB_NAME=clensy → throws', () => {
      expect(() => resolveE2eTarget({ DB_NAME: 'clensy' }, {})).toThrow(
        E2eTargetError,
      );
    });
    it('launch DB_NAME=feature_x_test → feature_x_test', () => {
      expect(resolveE2eTarget({ DB_NAME: 'feature_x_test' }, {}).database).toBe(
        'feature_x_test',
      );
    });
    it('a 70-character …_test name → throws', () => {
      expect(() =>
        resolveE2eTarget({ DB_NAME: 'a'.repeat(65) + '_test' }, {}),
      ).toThrow(E2eTargetError);
    });
    it.each(['db.example.com', 'localhost.example.com', '127.0.0.2', '::1'])(
      'launch DB_HOST=%p → throws',
      (host) => {
        expect(() => resolveE2eTarget({ DB_HOST: host }, {})).toThrow(
          E2eTargetError,
        );
      },
    );
    it('DB_PORT=abc → throws', () => {
      expect(() => resolveE2eTarget({ DB_PORT: 'abc' }, {})).toThrow(
        E2eTargetError,
      );
    });
    it('launch DB_HOST empty with PGHOST set, file DB_HOST=localhost → localhost', () => {
      expect(
        resolveE2eTarget(
          { DB_HOST: '', PGHOST: 'db.invalid' },
          { DB_HOST: 'localhost' },
        ).host,
      ).toBe('localhost');
    });
    it('PGDATABASE=clensy with no DB_NAME → clensy_test', () => {
      expect(resolveE2eTarget({ PGDATABASE: 'clensy' }, {}).database).toBe(
        'clensy_test',
      );
    });
    it('CI env DB_NAME=clensy_test with an empty file → clensy_test', () => {
      expect(resolveE2eTarget({ DB_NAME: 'clensy_test' }, {}).database).toBe(
        'clensy_test',
      );
    });
  });

  describe('rejected names (Review Focus 4)', () => {
    it.each(['clensy_test ', 'clensy_test\n', 'clensy _test', 'clensy"_test'])(
      'rejects %p, naming the value and the rule',
      (name) => {
        const text = message(() => resolveE2eTarget({ DB_NAME: name }, {}));
        expect(() => resolveE2eTarget({ DB_NAME: name }, {})).toThrow(
          E2eTargetError,
        );
        expect(text).toContain(JSON.stringify(name));
        expect(text).toContain(TEST_DATABASE_NAME_PATTERN.source);
      },
    );
  });

  it('ignores the file DB_NAME when the launch DB_NAME is missing', () => {
    expect(resolveE2eTarget({}, { DB_NAME: 'feature_test' }).database).toBe(
      'clensy_test',
    );
  });

  describe('precedence for each connection key', () => {
    const cases: Array<[string, string, string, string]> = [
      ['DB_HOST', '127.0.0.1', 'postgres', 'localhost'],
      ['DB_PORT', '6543', '7654', '5432'],
      ['DB_USERNAME', 'launch_user', 'file_user', 'clensy'],
      ['DB_PASSWORD', 'launch_pw', 'file_pw', 'clensy_dev'],
    ];
    const field: Record<string, keyof ReturnType<typeof resolveE2eTarget>> = {
      DB_HOST: 'host',
      DB_PASSWORD: 'password',
      DB_PORT: 'port',
      DB_USERNAME: 'username',
    };
    it.each(cases)('%s: launch beats file', (key, launch, file) => {
      const value = resolveE2eTarget({ [key]: launch }, { [key]: file })[
        field[key]
      ];
      expect(String(value)).toBe(launch);
    });
    it.each(cases)('%s: file beats default', (key, _launch, file) => {
      const value = resolveE2eTarget({}, { [key]: file })[field[key]];
      expect(String(value)).toBe(file);
    });
    it.each(cases)(
      '%s: a missing launch value falls through to the file',
      (key, _launch, file) => {
        const value = resolveE2eTarget({ [key]: '  ' }, { [key]: file })[
          field[key]
        ];
        expect(String(value)).toBe(file);
      },
    );
    it.each(cases)(
      '%s: default when both are missing',
      (key, _launch, _file, fallback) => {
        const value = resolveE2eTarget({}, {})[field[key]];
        expect(String(value)).toBe(fallback);
      },
    );
  });

  describe('settings and host failures', () => {
    it.each([
      { DB_PORT: 'abc' },
      { DB_PORT: '0' },
      { DB_HOST: 'db.example.com' },
    ])(
      'throws E2eTargetError for %p, never containing the password',
      (launch: Record<string, string | undefined>) => {
        let caught: unknown;
        try {
          resolveE2eTarget({ ...launch, DB_PASSWORD: sentinelPassword }, {});
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(E2eTargetError);
        expect((caught as Error).message).not.toContain(sentinelPassword);
      },
    );
    it('carries the settings error as its cause', () => {
      let caught: unknown;
      try {
        resolveE2eTarget({ DB_PORT: '0' }, {});
      } catch (error) {
        caught = error;
      }
      expect((caught as Error).cause).toBeInstanceOf(Error);
    });
  });
});

describe('publishE2eTarget', () => {
  it('writes exactly the five DB_* keys, trimming only host and username', () => {
    const env: NodeJS.ProcessEnv = {};
    publishE2eTarget(
      {
        database: 'clensy_test',
        host: 'localhost',
        password: ' pw ',
        port: 5432,
        username: 'clensy',
      },
      env,
    );
    expect(env).toEqual({
      DB_HOST: 'localhost',
      DB_NAME: 'clensy_test',
      DB_PASSWORD: ' pw ',
      DB_PORT: '5432',
      DB_USERNAME: 'clensy',
    });
  });

  it('publishes the resolver output, so host and username arrive trimmed', () => {
    const env: NodeJS.ProcessEnv = {};
    publishE2eTarget(
      resolveE2eTarget(
        { DB_HOST: ' localhost ', DB_PASSWORD: ' pw ', DB_USERNAME: ' u ' },
        {},
      ),
      env,
    );
    expect(env.DB_HOST).toBe('localhost');
    expect(env.DB_USERNAME).toBe('u');
    expect(env.DB_PASSWORD).toBe(' pw ');
  });
});
