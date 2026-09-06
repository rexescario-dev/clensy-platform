import { DataSource } from 'typeorm';

// Same pattern as `./job-db-test-lock.ts` — scoped to the laundry e2e
// spec(s), the only files that truncate `laundry_order_line_entity` /
// `laundry_order_entity` plus the catalog/customer fixtures they create.
//
// New, distinct arbitrary lock key — must never collide with
// ADMIN_DB_TEST_LOCK_KEY (875_301_442), CUSTOMER_DB_TEST_LOCK_KEY
// (512_988_671), CLEANER_DB_TEST_LOCK_KEY (641_774_209),
// CATALOG_DB_TEST_LOCK_KEY (738_216_905), BOOKING_DB_TEST_LOCK_KEY
// (924_103_557), or JOB_DB_TEST_LOCK_KEY (836_551_204).
const LAUNDRY_DB_TEST_LOCK_KEY = 419_286_037;

export interface LaundryDbTestLock {
  release(): Promise<void>;
}

export async function acquireLaundryDbTestLock(
  dataSource: DataSource,
): Promise<LaundryDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    LAUNDRY_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        LAUNDRY_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
