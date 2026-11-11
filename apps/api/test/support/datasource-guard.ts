import { DataSource, type DataSourceOptions } from 'typeorm';
import {
  isMissing,
  isTestDatabaseName,
} from '../../src/platform/database/effective-connection-settings';

// E2E isolation spec §4.5 item 1 and invariant 3: a two-stage guard on
// every DataSource initialised in an e2e test environment.
// Stage 1 (primary) validates the configured target before any connection
// opens; stage 2 confirms current_database() after connecting.

export const GUARD_MARKER = Symbol.for('clensy.e2eDataSourceGuard');

export class UnsafeDataSourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UnsafeDataSourceError';
  }
}

export function assertConnectedDatabase(
  expected: string,
  actual: unknown,
): void {
  if (actual !== expected) {
    throw new UnsafeDataSourceError(
      `connected to ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

/**
 * Stage 1. A key counts as set when it is an own key, whatever its value:
 * TypeORM's Object.assign would still overwrite the validated name.
 */
export function assertSafeDataSourceOptions(
  options: DataSourceOptions,
): string {
  const record = options as unknown as Record<string, unknown>;
  const extra = (record.extra ?? {}) as Record<string, unknown>;
  if (record.type !== 'postgres') {
    throw new UnsafeDataSourceError(
      `refused: type ${JSON.stringify(record.type)} is not postgres`,
    );
  }
  for (const key of ['url', 'replication']) {
    if (Object.hasOwn(record, key)) {
      throw new UnsafeDataSourceError(`refused: ${key} is set`);
    }
  }
  for (const key of ['database', 'connectionString', 'Client']) {
    if (Object.hasOwn(extra, key)) {
      throw new UnsafeDataSourceError(`refused: extra.${key} is set`);
    }
  }
  if (Object.hasOwn(record, 'driver')) {
    throw new UnsafeDataSourceError('refused: a custom driver is set');
  }
  const database = record.database;
  if (
    typeof database !== 'string' ||
    isMissing(database) ||
    !isTestDatabaseName(database)
  ) {
    throw new UnsafeDataSourceError(
      `refused: database ${JSON.stringify(database)} is not a Test database`,
    );
  }
  return database;
}

export function installDataSourceGuard(
  DataSourceClass: { prototype: DataSource } = DataSource,
): void {
  const proto = DataSourceClass.prototype;
  const marks = proto as unknown as Record<symbol, unknown>;
  if (marks[GUARD_MARKER] === true) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method -- re-invoked below with the instance as `this`
  const original = proto.initialize;
  proto.initialize = async function guardedInitialize(
    this: DataSource,
  ): Promise<DataSource> {
    const expected = assertSafeDataSourceOptions(this.options);
    await original.call(this);
    try {
      const rows: Array<{ name?: unknown }> = await this.query(
        'SELECT current_database() AS name',
      );
      assertConnectedDatabase(expected, rows[0]?.name);
    } catch (error) {
      try {
        await this.destroy();
      } catch (destroyError) {
        if (error instanceof Error && error.cause === undefined) {
          error.cause = destroyError;
        }
      }
      throw error;
    }
    return this;
  };
  marks[GUARD_MARKER] = true;
}
