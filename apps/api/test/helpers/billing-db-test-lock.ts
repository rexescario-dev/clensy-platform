import { DataSource } from 'typeorm';

// Same pattern as `./laundry-db-test-lock.ts` — scoped to the billing e2e
// spec(s), the only files that create `invoice_line_entity` /
// `invoice_entity` rows plus the laundry/catalog/customer fixtures they
// need.
//
// New, distinct arbitrary lock key — must never collide with
// ADMIN_DB_TEST_LOCK_KEY (875_301_442), CUSTOMER_DB_TEST_LOCK_KEY
// (512_988_671), CLEANER_DB_TEST_LOCK_KEY (641_774_209),
// CATALOG_DB_TEST_LOCK_KEY (738_216_905), BOOKING_DB_TEST_LOCK_KEY
// (924_103_557), JOB_DB_TEST_LOCK_KEY (836_551_204), or
// LAUNDRY_DB_TEST_LOCK_KEY (419_286_037).
const BILLING_DB_TEST_LOCK_KEY = 307_642_915;

export interface BillingDbTestLock {
  release(): Promise<void>;
}

export async function acquireBillingDbTestLock(
  dataSource: DataSource,
): Promise<BillingDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    BILLING_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        BILLING_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
