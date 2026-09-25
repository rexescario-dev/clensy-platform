import { readdirSync } from 'fs';
import { join } from 'path';
import { MigrationInterface } from 'typeorm';

const MIGRATIONS_DIR = join(
  __dirname,
  '../../src/platform/database/migrations',
);

// Every migration that precedes the given timestamp, as classes, so a
// throwaway database can be brought to the exact pre-migration schema before
// the migration under test runs.
export function migrationsBefore(
  timestamp: string,
): (new () => MigrationInterface)[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .filter((file) => file < timestamp)
    .map((file) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic load of every migration file by name
      const exported = require(join(MIGRATIONS_DIR, file)) as Record<
        string,
        new () => MigrationInterface
      >;
      return Object.values(exported)[0];
    });
}

export function connectionOptions(database: string) {
  return {
    database,
    host: process.env.DB_HOST ?? 'localhost',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    port: Number(process.env.DB_PORT ?? 5432),
    type: 'postgres' as const,
    username: process.env.DB_USERNAME ?? 'clensy',
  };
}
