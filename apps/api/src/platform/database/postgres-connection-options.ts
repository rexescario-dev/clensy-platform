import type { DataSourceOptions } from 'typeorm';

/**
 * The Postgres member of TypeORM's `DataSourceOptions` union. TypeORM's
 * package exports block a deep import of its own type, so it is narrowed
 * here once. Type-only: this module has no runtime content.
 */
export type PostgresConnectionOptions = Extract<
  DataSourceOptions,
  { type: 'postgres' }
>;
