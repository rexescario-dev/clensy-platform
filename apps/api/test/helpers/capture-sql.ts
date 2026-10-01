import { DataSource } from 'typeorm';

export function countSqlMentioning(queries: string[], table: string): number {
  const needle = table.toLowerCase();
  return queries.filter((query) => query.toLowerCase().includes(needle)).length;
}

/** Strip literals/parameters so N copies of the same child SELECT collapse. */
export function normalizeSql(sql: string): string {
  return sql
    .replace(/\$\d+/g, '$N')
    .replace(/'[^']*'/g, '?')
    .replace(/\b\d+\b/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Fail if a SELECT template runs once per parent (O(N) nested nodes).
 * Matching a table-name substring alone is not the O(1) pass condition.
 */
export function assertNoPerParentChildSelect(
  queries: string[],
  parentN: number,
  childTable: string,
): void {
  const counts = new Map<string, number>();
  for (const query of queries) {
    const template = normalizeSql(query);
    counts.set(template, (counts.get(template) ?? 0) + 1);
  }
  for (const [template, count] of counts) {
    if (
      count === parentN &&
      template.includes('select') &&
      template.includes(childTable.toLowerCase())
    ) {
      throw new Error(
        `nested nodes look O(N): template ran ${count} times (parent N=${parentN}): ${template}`,
      );
    }
  }
}

// ESC [ ... final-byte: the SGR color sequences `ansis` emits.
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\u001b\[[0-9;]*[A-Za-z]/g;

/**
 * TypeORM 1.1 logs SQL via `console.log('query:', sql)` (two arguments),
 * not DataSource.logger. The prefix goes through `ansis.gray.underline`,
 * so on a color terminal it carries ANSI escapes: strip them before
 * matching (#109). Join those args, restore logging and console.log in
 * `finally` so a thrown test cannot leak the intercept. Every caller runs
 * a real database request, so capturing nothing means the capture is
 * broken: fail rather than let O(1) assertions pass vacuously.
 */
export async function withCapturedSql<T>(
  dataSource: DataSource,
  run: () => Promise<T>,
): Promise<{ result: T; queries: string[] }> {
  const queries: string[] = [];
  const previousLogging = dataSource.options.logging;
  const originalConsoleLog = console.log;

  dataSource.setOptions({ logging: ['query'] });
  console.log = (...args: unknown[]) => {
    const text = args
      .filter((arg): arg is string => typeof arg === 'string')
      .join(' ')
      .replace(ANSI_ESCAPE, '');
    if (text.startsWith('query:')) {
      queries.push(text.replace(/^query:\s*/, ''));
      return;
    }
    return originalConsoleLog.apply(console, args);
  };

  try {
    const result = await run();
    if (queries.length === 0) {
      throw new Error(
        'withCapturedSql captured no SQL: the TypeORM query log format changed or logging is off',
      );
    }
    return { queries, result };
  } finally {
    console.log = originalConsoleLog;
    dataSource.setOptions({ logging: previousLogging });
  }
}
