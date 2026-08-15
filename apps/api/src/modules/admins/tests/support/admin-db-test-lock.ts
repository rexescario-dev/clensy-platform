import { DataSource } from 'typeorm';

// `admins.service.spec.ts` and `admins.service.disable-concurrency.spec.ts`
// are the only two spec files in the repo that hit a real Postgres
// connection against `admin_user_entity` and assert on a genuinely global
// invariant (the count of active Owner rows table-wide). Jest runs separate
// spec *files* as separate parallel worker processes by default; if both
// files' bodies happened to run at the same wall-clock moment, one file's
// truncate/seed could corrupt the other's in-flight Owner-count assertion —
// an observed, reproducible cross-file interference, not a flaky test.
//
// Rather than serializing the *entire* Jest run (which would also slow down
// every unrelated, DB-free spec file in the repo — `bookings`, `platform/
// audit` — forever), this takes a Postgres session-level advisory lock
// scoped to only these two files, so their bodies never overlap while
// everything else keeps running with full default parallelism.
//
// A dedicated `QueryRunner` (not a pooled `dataSource.query(...)` call) is
// required: `pg_advisory_lock`/`pg_advisory_unlock` are per-session — a
// pooled call could acquire the lock on one connection and attempt to
// release it on a different one, which would silently no-op and leave the
// lock held until that connection eventually closes.
const ADMIN_DB_TEST_LOCK_KEY = 875_301_442; // arbitrary fixed int, unique to this lock's purpose

export interface AdminDbTestLock {
  release(): Promise<void>;
}

export async function acquireAdminDbTestLock(
  dataSource: DataSource,
): Promise<AdminDbTestLock> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock($1)', [
    ADMIN_DB_TEST_LOCK_KEY,
  ]);

  return {
    release: async () => {
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [
        ADMIN_DB_TEST_LOCK_KEY,
      ]);
      await queryRunner.release();
    },
  };
}
