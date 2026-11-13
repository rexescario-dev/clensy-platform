import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  InvalidConnectionSettingsError,
  isLocalHost,
  isMissing,
  isTestDatabaseName,
  parseEnvFile,
  resolveLayered,
  validateEffectiveSettings,
} from '../effective-connection-settings';

// E2E isolation spec §4.1 (terms, Test-database rule, allowlist, missing
// values, effective settings) and §4.2 items 2–3 (layered resolution).
describe('effective connection settings', () => {
  describe('isMissing', () => {
    it.each([undefined, '', '   ', '\t', '\n'])('treats %p as missing', (v) => {
      expect(isMissing(v)).toBe(true);
    });
    it('treats a value as present', () => {
      expect(isMissing('a')).toBe(false);
    });
  });

  describe('isTestDatabaseName', () => {
    const name63 = 'a'.repeat(58) + '_test';
    const name64 = 'a'.repeat(59) + '_test';
    it.each([
      'clensy_test',
      'a_test',
      'feature_x_test',
      name63,
      'clensy_migration_' + '0123456789abcdef'.repeat(2) + '_test',
    ])('accepts %p', (name) => {
      expect(isTestDatabaseName(name)).toBe(true);
    });
    it('accepts a 63-byte name and a 54-byte scratch name', () => {
      expect(Buffer.byteLength(name63)).toBe(63);
      expect(
        Buffer.byteLength(
          'clensy_migration_' + '0123456789abcdef'.repeat(2) + '_test',
        ),
      ).toBe(54);
    });
    it.each([
      'clensy',
      'clensy_test2',
      'Clensy_test',
      'clensy-test',
      '_test',
      ' clensy_test',
      'clensy_test ',
      'clensy_test\n',
      'clensy _test',
      'clensy"_test',
      "clensy'_test",
      'clénsy_test',
      name64,
    ])('rejects %p', (name) => {
      expect(isTestDatabaseName(name)).toBe(false);
    });
  });

  describe('isLocalHost', () => {
    it.each(['localhost', 'LOCALHOST', ' localhost ', '127.0.0.1', 'postgres'])(
      'accepts %p',
      (h) => {
        expect(isLocalHost(h)).toBe(true);
      },
    );
    it.each([
      'localhost.example.com',
      '127.0.0.2',
      '::1',
      '/var/run/postgresql',
      '',
    ])('rejects %p', (h) => {
      expect(isLocalHost(h)).toBe(false);
    });
  });

  describe('resolveLayered', () => {
    const forms: Array<[string, string | undefined]> = [
      ['unset', undefined],
      ['empty', ''],
      ['whitespace', '  '],
    ];
    for (const key of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD']) {
      for (const [launchForm, launchValue] of forms) {
        it(`${key}: launch ${launchForm}, file value → file`, () => {
          expect(
            resolveLayered(key, [{ [key]: launchValue }, { [key]: 'db' }], 'd'),
          ).toEqual({ value: 'db', source: 'apps/api/.env' });
        });
        for (const [fileForm, fileValue] of forms) {
          it(`${key}: launch ${launchForm}, file ${fileForm} → default`, () => {
            expect(
              resolveLayered(
                key,
                [{ [key]: launchValue }, { [key]: fileValue }],
                'd',
              ),
            ).toEqual({ value: 'd', source: 'default' });
          });
        }
      }
      it(`${key}: launch value → launch, whatever the file says`, () => {
        expect(
          resolveLayered(key, [{ [key]: 'x' }, { [key]: 'db' }], 'd'),
        ).toEqual({ value: 'x', source: 'launch environment' });
      });
    }
  });

  describe('validateEffectiveSettings', () => {
    const base = {
      database: 'clensy_test',
      host: 'localhost',
      password: 'pw',
      port: '5432',
      username: 'clensy',
    };
    it.each([
      'abc',
      '0',
      '65536',
      '5432.5',
      '5432.0',
      '-1',
      '+5432',
      '0x1538',
      '1e3',
      '5432abc',
    ])('rejects port %p', (port) => {
      expect(() => validateEffectiveSettings({ ...base, port })).toThrow(
        InvalidConnectionSettingsError,
      );
    });
    it.each(['5432', ' 5432 ', '05432'])('parses port %p as 5432', (port) => {
      expect(validateEffectiveSettings({ ...base, port }).port).toBe(5432);
    });
    it.each(['host', 'username', 'database'] as const)(
      'rejects an empty %s',
      (key) => {
        expect(() => validateEffectiveSettings({ ...base, [key]: '' })).toThrow(
          InvalidConnectionSettingsError,
        );
      },
    );
    it('trims host and username, and keeps password and database verbatim', () => {
      expect(
        validateEffectiveSettings({
          ...base,
          host: ' host ',
          username: ' user ',
          password: ' pw ',
        }),
      ).toEqual({
        database: 'clensy_test',
        host: 'host',
        password: ' pw ',
        port: 5432,
        username: 'user',
      });
    });
    it('allows an empty password', () => {
      expect(
        validateEffectiveSettings({ ...base, password: '' }).password,
      ).toBe('');
    });
    it('never puts the password in an error message', () => {
      const sentinel = 'S3ntinel-Pw!';
      const cases = [
        { ...base, password: sentinel, port: 'abc' },
        { ...base, password: sentinel, port: '0' },
        { ...base, password: sentinel, host: '' },
        { ...base, password: sentinel, username: '' },
        { ...base, password: sentinel, database: '' },
      ];
      for (const input of cases) {
        let message = '';
        try {
          validateEffectiveSettings(input);
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).not.toBe('');
        expect(message).not.toContain(sentinel);
      }
    });
  });

  describe('parseEnvFile', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'ecs-'));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });
    it('returns {} for a missing file', () => {
      expect(parseEnvFile(join(dir, 'absent.env'))).toEqual({});
    });
    it('throws for a directory', () => {
      expect(() => parseEnvFile(dir)).toThrow();
    });
    it('parses a file without touching process.env', () => {
      const before = process.env.ECS_SPEC_A;
      const file = join(dir, '.env');
      writeFileSync(file, 'ECS_SPEC_A=1\n');
      expect(parseEnvFile(file)).toEqual({ ECS_SPEC_A: '1' });
      expect(process.env.ECS_SPEC_A).toBe(before);
    });
  });

  // Characterization test (plan Task 1). Break, outside the commit: add a
  // top-level `process.env.X` read to the module; this test must then fail.
  describe('module purity (characterization)', () => {
    const source = readFileSync(
      resolve(__dirname, '../effective-connection-settings.ts'),
      'utf8',
    );
    it('imports only node built-ins, fs, path and dotenv, and reads no process.env at top level', () => {
      const specifiers = [
        ...source.matchAll(/from\s+['"]([^'"]+)['"]/g),
        ...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
      ].map((m) => m[1]);
      for (const s of specifiers) {
        expect(
          s.startsWith('node:') || ['fs', 'path', 'dotenv'].includes(s),
        ).toBe(true);
      }
      const topLevel = source
        .split('\n')
        .filter((line) => !/^\s/.test(line))
        .join('\n');
      expect(topLevel).not.toMatch(/process\.env/);
    });
  });
});
