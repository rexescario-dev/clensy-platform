import {
  type DevOwnerResult,
  formatDevOwnerResult,
  isFailure,
} from '../dev-owner/dev-owner-seeder';

// E2E isolation spec §4.7 Output (author call 8, revised by N1), the
// password check (call 12) and invariant 9.

const ID = '11111111-2222-3333-4444-555555555555';
const context = {
  database: 'clensy',
  emailSource: 'apps/api/.env' as const,
  host: 'localhost',
  passwordSource: 'launch environment' as const,
};
const SENTINEL_EMAIL = 'sentinel.owner@example.com';
const SENTINEL_PASSWORD = 'S3ntinel-Pw!';
const SAMPLE_HASH =
  '$2b$10$abcdefghijklmnopqrstuuJ5m1yH8uS1ZcXcKq0x9V4lQ6sC0bQ2e';

const outcomes: Array<[DevOwnerResult, 'count' | 'id' | 'neither']> = [
  [{ id: ID, outcome: 'created' }, 'id'],
  [{ id: ID, outcome: 'unchanged', password: 'matches' }, 'id'],
  [{ id: ID, outcome: 'unchanged', password: 'differs' }, 'id'],
  [{ id: ID, outcome: 'password reset' }, 'id'],
  [{ differing: ['role', 'isActive'], id: ID, outcome: 'mismatch' }, 'id'],
  [{ count: 1, outcome: 'not normalised' }, 'count'],
  [{ count: 2, outcome: 'ambiguous' }, 'count'],
  [{ outcome: 'tenant missing' }, 'neither'],
];

describe('formatDevOwnerResult', () => {
  it.each(outcomes)(
    'formats %p as one line with its context',
    (result, carries) => {
      const line = formatDevOwnerResult(result, context);
      expect(line.split('\n')).toHaveLength(1);
      expect(line).toContain(result.outcome);
      expect(line).toContain('database=clensy');
      expect(line).toContain('host=localhost');
      expect(line).toContain('email-source=apps/api/.env');
      expect(line).toContain('password-source=launch environment');
      if (carries === 'id') {
        expect(line).toContain(`id=${ID}`);
      } else {
        expect(line).not.toContain('id=');
      }
      if (carries === 'count') {
        expect(line).toContain(`count=${(result as { count: number }).count}`);
      } else {
        expect(line).not.toContain('count=');
      }
      for (const secret of [SENTINEL_EMAIL, SENTINEL_PASSWORD, SAMPLE_HASH]) {
        expect(line).not.toContain(secret);
      }
    },
  );

  it('pins the spec-quoted wording', () => {
    expect(
      formatDevOwnerResult(
        { id: ID, outcome: 'unchanged', password: 'matches' },
        context,
      ),
    ).toContain('password: matches ADMIN_SEED_PASSWORD');
    expect(
      formatDevOwnerResult(
        { id: ID, outcome: 'unchanged', password: 'differs' },
        context,
      ),
    ).toContain(
      'password: differs from ADMIN_SEED_PASSWORD (run with --reset-password to apply it)',
    );
    expect(
      formatDevOwnerResult({ count: 1, outcome: 'not normalised' }, context),
    ).toContain('existing account email is not normalised');
    expect(
      formatDevOwnerResult({ count: 2, outcome: 'ambiguous' }, context),
    ).toContain('ambiguous: 2 accounts match');
    expect(
      formatDevOwnerResult(
        { differing: ['isActive'], id: ID, outcome: 'mismatch' },
        context,
      ),
    ).toContain('isActive differs');
    expect(
      formatDevOwnerResult({ outcome: 'tenant missing' }, context),
    ).toContain('Bootstrap tenant missing');
  });

  it('prefixes failures with "dev-owner: refused:"', () => {
    for (const [result] of outcomes) {
      const line = formatDevOwnerResult(result, context);
      expect(line.startsWith('dev-owner: refused:')).toBe(isFailure(result));
    }
  });
});

describe('isFailure', () => {
  it('is true exactly for mismatch, not normalised, ambiguous and tenant missing', () => {
    expect(
      outcomes
        .filter(([result]) => isFailure(result))
        .map(([result]) => result.outcome),
    ).toEqual(['mismatch', 'not normalised', 'ambiguous', 'tenant missing']);
  });
});
