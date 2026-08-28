import { DataSource } from 'typeorm';

export function countSqlMentioning(queries: string[], table: string): number {
  const needle = table.toLowerCase();
  return queries.filter((query) => query.toLowerCase().includes(needle)).length;
}

/**
 * TypeORM 1.1 logs SQL via `console.log('query:', sql)` (two arguments),
 * not DataSource.logger. Join those args, restore logging and console.log
 * in `finally` so a thrown test cannot leak the intercept.
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
      .join(' ');
    if (text.startsWith('query:')) {
      queries.push(text.replace(/^query:\s*/, ''));
      return;
    }
    return originalConsoleLog.apply(console, args);
  };

  try {
    const result = await run();
    return { result, queries };
  } finally {
    console.log = originalConsoleLog;
    dataSource.setOptions({ logging: previousLogging });
  }
}
