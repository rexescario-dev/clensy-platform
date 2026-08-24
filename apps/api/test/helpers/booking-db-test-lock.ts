import { DataSource } from 'typeorm';

// Identical pattern to `./catalog-db-test-lock.ts` — see that file's
// comment for the full rationale. Scoped to `bookings.service.e2e-spec.ts`,
// the only spec file that truncates `booking_entity` plus the fixture
// tables it creates for itself.
//
// New, distinct arbitrary lock key — must never collide with
// ADMIN_DB_TEST_LOCK_KEY (875_301_442), CUSTOMER_DB_TEST_LOCK_KEY
// (512_988_671), CLEANER_DB_TEST_LOCK_KEY (641_774_209), or
// CATALOG_DB_TEST_LOCK_KEY (738_216_905).
const BOOKING_DB_TEST_LOCK_KEY = 924_103_557; // arbitrary fixed int, unique to this lock's purpose

export interface BookingDbTestLock {
  release(): Promise<void>;
}

export async function acquireBookingDbTestLock(
  dataSource: DataSource,
): Promise<BookingDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    BOOKING_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        BOOKING_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
