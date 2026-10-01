import type { DataSource } from 'typeorm';
import { withCapturedSql } from './capture-sql';

// #109: TypeORM 1.1's AdvancedConsoleLogger prints the prefix through
// `ansis.gray.underline('query:')`, so on a color terminal the first
// console.log argument carries ANSI escapes. The capture must still see
// it, and a capture that sees nothing must fail rather than let O(1)
// assertions pass vacuously. No database: a stub DataSource is enough.
function stubDataSource(): DataSource {
  return {
    options: { logging: false },
    setOptions() {
      return this;
    },
  } as unknown as DataSource;
}

const ANSI_PREFIX = '\u001b[90m\u001b[4mquery:\u001b[24m\u001b[39m';

describe('withCapturedSql (#109)', () => {
  it('captures a query whose prefix carries ANSI color escapes', async () => {
    const { queries } = await withCapturedSql(stubDataSource(), () => {
      console.log(ANSI_PREFIX, 'SELECT 1');
      return Promise.resolve();
    });
    expect(queries).toEqual(['SELECT 1']);
  });

  it('captures a plain-text prefix', async () => {
    const { queries } = await withCapturedSql(stubDataSource(), () => {
      console.log('query:', 'SELECT 2');
      return Promise.resolve();
    });
    expect(queries).toEqual(['SELECT 2']);
  });

  it('fails loudly when nothing was captured', async () => {
    await expect(
      withCapturedSql(stubDataSource(), () => Promise.resolve()),
    ).rejects.toThrow(/captured no SQL/);
  });
});
