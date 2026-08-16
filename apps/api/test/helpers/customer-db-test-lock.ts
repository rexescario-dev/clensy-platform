import { DataSource } from 'typeorm';

// Identical pattern to `./admin-db-test-lock.ts` — see that file's comment
// for the full rationale (Jest runs separate spec files as separate
// parallel worker processes, so real-Postgres truncate/seed specs touching
// the same tables need a session-level advisory lock to avoid cross-file
// interference). Scoped to `customers-properties.service.e2e-spec.ts`, the
// only spec file that truncates `customer_entity`/`property_entity`.
//
// New, distinct arbitrary lock key — must never collide with
// `ADMIN_DB_TEST_LOCK_KEY` (875_301_442) in `./admin-db-test-lock.ts`.
const CUSTOMER_DB_TEST_LOCK_KEY = 512_988_671; // arbitrary fixed int, unique to this lock's purpose

export interface CustomerDbTestLock {
  release(): Promise<void>;
}

export async function acquireCustomerDbTestLock(
  dataSource: DataSource,
): Promise<CustomerDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    CUSTOMER_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        CUSTOMER_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
