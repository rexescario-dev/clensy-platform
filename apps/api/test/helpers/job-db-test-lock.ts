import { DataSource } from 'typeorm';

// Identical pattern to `./booking-db-test-lock.ts` — see that file's
// comment for the full rationale. Scoped to `jobs.service.e2e-spec.ts`,
// the only spec file that truncates `cleaning_job_entity` /
// `checklist_entity` / `checklist_item_entity` plus the booking fixtures
// it creates for itself.
//
// New, distinct arbitrary lock key — must never collide with
// ADMIN_DB_TEST_LOCK_KEY (875_301_442), CUSTOMER_DB_TEST_LOCK_KEY
// (512_988_671), CLEANER_DB_TEST_LOCK_KEY (641_774_209),
// CATALOG_DB_TEST_LOCK_KEY (738_216_905), or BOOKING_DB_TEST_LOCK_KEY
// (924_103_557).
const JOB_DB_TEST_LOCK_KEY = 836_551_204;

export interface JobDbTestLock {
  release(): Promise<void>;
}

export async function acquireJobDbTestLock(
  dataSource: DataSource,
): Promise<JobDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    JOB_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        JOB_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
