import {
  type DevOwnerResult,
  devOwnerOutputStream,
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

// How each line carries what it identifies: an id, a `count=` field, or
// (ambiguous) the count stated once in "<N> accounts match".
const outcomes: Array<
  [DevOwnerResult, 'count' | 'id' | 'matches' | 'neither']
> = [
  [{ id: ID, outcome: 'created' }, 'id'],
  [{ id: ID, outcome: 'unchanged', password: 'matches' }, 'id'],
  [{ id: ID, outcome: 'unchanged', password: 'differs' }, 'id'],
  [{ id: ID, outcome: 'password reset' }, 'id'],
  [{ differing: ['role', 'isActive'], id: ID, outcome: 'mismatch' }, 'id'],
  [{ count: 1, outcome: 'not normalised' }, 'count'],
  [{ count: 2, outcome: 'ambiguous' }, 'matches'],
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
      if (carries === 'matches') {
        expect(line).toContain(
          `${(result as { count: number }).count} accounts match`,
        );
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

  // M7 observation 6: the ambiguous line stated the count twice.
  it('states the ambiguous count exactly once', () => {
    expect(
      formatDevOwnerResult({ count: 3, outcome: 'ambiguous' }, context),
    ).toBe(
      'dev-owner: refused: ambiguous: 3 accounts match database=clensy host=localhost email-source=apps/api/.env password-source=launch environment',
    );
  });

  it('prefixes failures with "dev-owner: refused:"', () => {
    for (const [result] of outcomes) {
      const line = formatDevOwnerResult(result, context);
      expect(line.startsWith('dev-owner: refused:')).toBe(isFailure(result));
    }
  });
});

// M7 observation 7: failures go to stderr, every other outcome to stdout.
describe('devOwnerOutputStream', () => {
  it.each(outcomes)('routes %p by isFailure', (result) => {
    expect(devOwnerOutputStream(result)).toBe(
      isFailure(result) ? 'stderr' : 'stdout',
    );
  });

  it('sends exactly the four failures to stderr', () => {
    expect(
      outcomes
        .filter(([result]) => devOwnerOutputStream(result) === 'stderr')
        .map(([result]) => result.outcome),
    ).toEqual(['mismatch', 'not normalised', 'ambiguous', 'tenant missing']);
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
