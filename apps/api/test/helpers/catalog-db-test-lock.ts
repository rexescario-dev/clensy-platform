import { DataSource } from 'typeorm';

// Identical pattern to `./cleaner-db-test-lock.ts` — see that file's comment
// for the full rationale (Jest runs separate spec files as separate
// parallel worker processes, so real-Postgres truncate/seed specs touching
// the same tables need a session-level advisory lock to avoid cross-file
// interference). Scoped to `catalog.service.e2e-spec.ts`, the only spec file
// that truncates `service_entity` (and, from Tasks 2/3 onward,
// `add_on_entity`/`pricing_rule_entity`).
//
// New, distinct arbitrary lock key — must never collide with
// `ADMIN_DB_TEST_LOCK_KEY` (875_301_442) in `./admin-db-test-lock.ts`,
// `CUSTOMER_DB_TEST_LOCK_KEY` (512_988_671) in `./customer-db-test-lock.ts`,
// or `CLEANER_DB_TEST_LOCK_KEY` (641_774_209) in `./cleaner-db-test-lock.ts`.
const CATALOG_DB_TEST_LOCK_KEY = 738_216_905; // arbitrary fixed int, unique to this lock's purpose

export interface CatalogDbTestLock {
  release(): Promise<void>;
}

export async function acquireCatalogDbTestLock(
  dataSource: DataSource,
): Promise<CatalogDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    CATALOG_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        CATALOG_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
