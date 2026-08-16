import { DataSource } from 'typeorm';

// Identical pattern to `./admin-db-test-lock.ts` — see that file's comment
// for the full rationale (Jest runs separate spec files as separate
// parallel worker processes, so real-Postgres truncate/seed specs touching
// the same tables need a session-level advisory lock to avoid cross-file
// interference). Scoped to `cleaners-teams.service.e2e-spec.ts`, the only
// spec file that truncates `team_entity` (and, from Task 2 onward,
// `cleaner_entity`).
//
// New, distinct arbitrary lock key — must never collide with
// `ADMIN_DB_TEST_LOCK_KEY` (875_301_442) in `./admin-db-test-lock.ts` or
// `CUSTOMER_DB_TEST_LOCK_KEY` (512_988_671) in `./customer-db-test-lock.ts`.
const CLEANER_DB_TEST_LOCK_KEY = 641_774_209; // arbitrary fixed int, unique to this lock's purpose

export interface CleanerDbTestLock {
  release(): Promise<void>;
}

export async function acquireCleanerDbTestLock(
  dataSource: DataSource,
): Promise<CleanerDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    CLEANER_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        CLEANER_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
