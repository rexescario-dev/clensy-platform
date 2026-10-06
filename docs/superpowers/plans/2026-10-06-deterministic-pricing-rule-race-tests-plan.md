# Deterministic Concurrent createPricingRule e2e Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-06 |
| Tracking issue | [#138](https://github.com/rexescario-dev/clensy-platform/issues/138) |
| M2 / M3 | **N/A** — owner decision, 2026-10-06, the same reasoning as #135. #138 adds no product or authorization semantics, no schema or API contract change, no production code and no architectural decision. It replaces a timing assumption in three existing e2e tests with synchronization. |
| Brainstorm approval | 2026-10-06, by the owner. Approved: the in-test barrier at the `PricingRuleEntity` save, one helper kept in the test file, both alternatives rejected (DB trigger with advisory lock; raw SQL race), M4 → M5 → M6–M10, one PR. Conditions, each carried into this plan: (a) the barrier's synchronization semantics are explicit, so it cannot become a timing-based test again (Constraints 1–4); (b) the predecessor case names exactly which backend is expected to wait and the query that identifies it (Constraint 3); (c) the timeout failure names the participant count, the expected condition and the observed Postgres wait state (Constraint 5); (d) the index mutation is fully temporary (Task 2, ME); (e) a passing loop is supporting evidence only (Acceptance). |
| Scope | One file: `apps/api/test/catalog.service.e2e-spec.ts`. No change to `apps/api/src`, migrations, `schema.gql`, `apps/web`, `packages/*`, CI or other test files. No change to application behavior. |
| Relies on (Accepted) | [Laundry Architecture & Catalog Foundation](../specs/2026-09-06-laundry-catalog-foundation-design.md), Status **Accepted**. §4.4 step 3 (the close step's row-lock and read-committed re-check; a raced-out call closes zero rows and its insert collides at step 5), §4.4 "insert races" paragraph (the loser's `23505` becomes `ConflictException`), and §4.7 (`uq_pricing_rule_open_service`, `uq_pricing_rule_open_addon`, `uq_pricing_rule_active_service`). Used as is. The three tests verify this behavior. This plan changes how they force it, not what they verify. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper, type and constant names, comment wording, condition names and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by **quoted code**, not by line number. The branch base is `7f93ffb` (`main`). The branch is `fix/138-deterministic-pricing-rule-race-tests`. |

**Goal:** Make the three concurrent `createPricingRule` e2e tests always exercise the unique-index conflict path, so `pnpm --filter api test:e2e` and CI's **API e2e** job are green on `main` deterministically.

**Architecture:** Test-only. A helper in the test file, `installPricingRuleSaveBarrier`, uses `jest.spyOn(EntityManager.prototype, 'save')` to pause each `PricingRuleEntity` save (step 5, the INSERT). It releases the paused saves only after the test's declared condition is observed: both calls paused at the save (first-ever races), or one call paused and the other's backend observed waiting on the paused call's row lock in its close step (predecessor race). The two-connection pre-warm and its comment are removed.

**Tech Stack:** NestJS 11, TypeORM `^1.1.0` (`EntityManager`), PostgreSQL 16 (`pg_stat_activity`, `pg_blocking_pids`), Jest e2e (`apps/api/test/jest-e2e.json`, `maxWorkers: 1`, default 5 s test timeout).

**Spec:** M2/M3 N/A (above). Behavior under test: [Laundry Architecture & Catalog Foundation](../specs/2026-09-06-laundry-catalog-foundation-design.md) §4.4, §4.7.

## Root cause (from #138)

The tests fire both calls with `Promise.allSettled` and pre-warm two pool connections. Pre-warming makes overlap more likely but does not guarantee it. If one call commits before the other's close step (step 3) runs, the second call legitimately closes the first's row and inserts its own. Both fulfill, which is correct product behavior (spec §4.4) but not the conflict path the tests exist to prove. CI run 37413264992 hit exactly that. Without the pre-warm and without a barrier, the race passed only 3 of 20 local runs with the existing assertions (pre-validation MD).

## Global Constraints

1. **Release only on an observed condition.** The barrier SHALL NOT release a paused save because time has passed. It releases only when its declared condition is observed. The timeout path rejects the paused saves and fails the test; it never lets them proceed.
2. **`both-at-save`** (first-ever service race; addOn race): release when exactly two `PricingRuleEntity` saves are paused. At that point both close steps have run and neither call has committed, so whatever order the INSERTs then run in, the second one collides on the open/active partial unique index (spec §4.4 step 3, §4.7).
3. **`other-blocked-on-close`** (predecessor race): release when exactly one save is paused (call P, backend pid `p`, captured inside P's transaction with `SELECT pg_backend_pid()`) **and** exactly one backend is returned by

   ```sql
   SELECT pid, wait_event_type, wait_event, query
     FROM pg_stat_activity
    WHERE $1 = ANY(pg_blocking_pids(pid))   -- $1 = p
   ```

   and that backend has `wait_event_type = 'Lock'` and a current `query` starting with `UPDATE "pricing_rule_entity" SET "effectiveTo"`. That backend is the other call's transaction, blocked in its close step on the predecessor row lock P took in its own close step. After P commits, the waiter's predicate re-check matches zero rows, so it closes nothing, and its INSERT collides with P's open row (spec §4.4 step 3). An unrelated lock, another blocker or another statement does not satisfy the condition. Two paused saves never satisfy it either: that would mean no close step blocked.
4. **The condition is declared per test, not inferred.** Each test names its condition. The helper does not accept "either condition".
5. **Diagnostic timeout.** `PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS = 3000`, below Jest's default 5 s test timeout. Polling interval: 20 ms. The timeout error names the condition, the arrival count, the paused backend pids and a `pg_stat_activity` snapshot of the database, excluding the polling connection. The snapshot has `pid`, `state`, `wait_event_type`, `wait_event`, `pg_blocking_pids` and the first 80 characters of `query`.
6. **No production change.** Nothing under `apps/api/src` changes. The spy is installed only around each race and is restored in `.finally`, so no other test, and no seed or read in a race test, sees it. Saves of other entities, and saves that arrive after release, pass straight through.
7. **Assertions.** Every existing assertion stays. The predecessor and addOn races also assert that the rejection is a `ConflictException`, which the first-ever service race already does. With the barrier, this is what proves the conflict path was taken, not some other rejection. These are **characterization tests**: they pin already-correct production behavior (spec §4.4, §4.7). No production code is expected to change to make them pass.
8. The helper stays in `catalog.service.e2e-spec.ts`. It is not promoted to `test/helpers/` unless another suite needs it (out of scope).

## Review Focus

1. **Barrier released by the wrong backend in the predecessor race.** Expected: release requires `pg_blocking_pids` to contain the paused pid, `Lock`, and the close-step `UPDATE` text. Pinned by ME: with the indexes dropped, the barrier still releases (same conditions) and the assertions fail, so the conditions match the real waiter. MA proves `both-at-save` cannot be met there.
2. **Condition never met (setup broken, statement text changed by a TypeORM upgrade).** Expected: a 3 s diagnostic failure, not a hang or a bare Jest timeout. Pinned by MA and MB, whose failure text is recorded below.
3. **Spy leaking into later tests.** Expected: restored in `.finally` even if the race throws. Pinned by MA/MB: the other tests in the same run still pass after a barrier failure.
4. **Non-overlapping schedule (the CI failure).** Expected: the assertions catch it. Pinned by MC, which forces the sequential schedule and reproduces `Expected length: 1 / Received length: 2`.
5. **The barrier masking a broken index.** Expected: the tests fail if the indexes are gone. Pinned by ME.

---

### Task 1: Replace the pre-warm with the save barrier in the three race tests

**Files:**
- Modify: `apps/api/test/catalog.service.e2e-spec.ts` (import; new helper before the `PricingRulesService (real Postgres)` describe block; three race tests)

**Interfaces:**
- Produces (file-local): `installPricingRuleSaveBarrier(dataSource: DataSource, condition: 'both-at-save' | 'other-blocked-on-close'): { assertReleased(): void; restore(): void }`

- [ ] **Step 1: Import `EntityManager`.** Replace

```ts
import { DataSource } from 'typeorm';
```

with

```ts
import { DataSource, EntityManager } from 'typeorm';
```

- [ ] **Step 2: Add the helper.** Insert this block immediately before the line `// \`PricingRule\` has a real FK relationship to \`Service\` (spec §4.1, §4.7) —`, followed by one blank line:

```ts
// The concurrent `createPricingRule` tests below must prove the losing call
// hits the open/active partial unique indexes and maps the violation to
// `ConflictException`. That only happens if the loser's close step (3) runs
// before the winner commits. Firing both calls in one tick does not
// guarantee this: if one call commits before the other starts, the second
// legitimately closes the first's row and both fulfill (#138). This barrier
// replaces that timing assumption with synchronization. It pauses every
// `PricingRuleEntity` save (step 5, the INSERT), and releases the paused
// saves only once the named condition has been observed:
//
// - `both-at-save`: both calls are paused at the save, so both close steps
//   have already run and neither call has committed. The first-ever-rule
//   races use this: with no open row, neither close step takes a row lock.
// - `other-blocked-on-close`: one call is paused at the save, still holding
//   the row lock its close step took on the predecessor, and the other
//   call's backend is waiting on that lock inside its own close step. The
//   "extends an existing predecessor" race uses this: the blocked call
//   cannot reach the save until the paused call commits, so `both-at-save`
//   would never be met. The waiter is identified exactly: the one backend
//   whose `pg_blocking_pids` contains the paused call's backend pid, whose
//   `wait_event_type` is `Lock`, and whose current statement is the close
//   step's `UPDATE "pricing_rule_entity" SET "effectiveTo"`.
//
// Saves reaching the barrier after release pass straight through. If the
// condition is not observed within `PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS`,
// every paused save is rejected (rolling its transaction back) and
// `assertReleased` throws a diagnostic naming the condition, the arrivals
// and the observed Postgres wait state.
type PricingRuleSaveBarrierCondition =
  'both-at-save' | 'other-blocked-on-close';

interface PricingRuleSaveBarrier {
  assertReleased(): void;
  restore(): void;
}

// Below Jest's default 5 s test timeout, so a missed condition fails with
// the barrier's diagnostic rather than a bare Jest timeout.
const PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS = 3000;
const PRICING_RULE_SAVE_BARRIER_POLL_MS = 20;

function installPricingRuleSaveBarrier(
  dataSource: DataSource,
  condition: PricingRuleSaveBarrierCondition,
): PricingRuleSaveBarrier {
  const paused: {
    pid: number;
    reject: (error: Error) => void;
    resolve: () => void;
  }[] = [];
  let arrivals = 0;
  let failure: Error | undefined;
  let released = false;
  let stopped = false;

  // Read off the descriptor, not `EntityManager.prototype.save`, so the
  // original is captured as an explicitly `this`-taking function.
  const originalSave = Object.getOwnPropertyDescriptor(
    EntityManager.prototype,
    'save',
  )!.value as (this: EntityManager, ...args: unknown[]) => Promise<unknown>;
  const saveSpy = jest
    .spyOn(EntityManager.prototype, 'save')
    .mockImplementation(async function (
      this: EntityManager,
      ...args: unknown[]
    ) {
      if (args[0] instanceof PricingRuleEntity) {
        arrivals += 1;
        if (!released && failure === undefined) {
          const [{ pid }] = await this.query<{ pid: number }[]>(
            'SELECT pg_backend_pid() AS pid',
          );
          await new Promise<void>((resolve, reject) => {
            paused.push({ pid, reject, resolve });
          });
        }
      }
      return originalSave.apply(this, args);
    } as never);

  async function blockedOnCloseWaiters(holderPid: number) {
    return dataSource.query<
      { pid: number; query: string; wait_event_type: string | null }[]
    >(
      `SELECT pid, wait_event_type, wait_event, query
         FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [holderPid],
    );
  }

  async function conditionMet(): Promise<boolean> {
    if (condition === 'both-at-save') {
      return paused.length === 2;
    }
    if (paused.length !== 1) {
      return false;
    }
    const waiters = await blockedOnCloseWaiters(paused[0].pid);
    return (
      waiters.length === 1 &&
      waiters[0].wait_event_type === 'Lock' &&
      waiters[0].query.startsWith(
        'UPDATE "pricing_rule_entity" SET "effectiveTo"',
      )
    );
  }

  async function describeWaitState(): Promise<string> {
    const rows = await dataSource.query<unknown[]>(
      `SELECT pid, state, wait_event_type, wait_event,
              pg_blocking_pids(pid) AS blocked_by, left(query, 80) AS query
         FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    );
    return JSON.stringify(rows);
  }

  async function watch() {
    const deadline = Date.now() + PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS;
    while (!stopped) {
      if (await conditionMet()) {
        released = true;
        paused.splice(0).forEach((p) => p.resolve());
        return;
      }
      if (Date.now() >= deadline) {
        failure = new Error(
          `PricingRule save barrier: condition '${condition}' not observed ` +
            `within ${PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS} ms; ` +
            `arrivals=${arrivals}; paused pids=` +
            `[${paused.map((p) => p.pid).join(', ')}]; ` +
            `pg_stat_activity=${await describeWaitState()}`,
        );
        paused.splice(0).forEach((p) => p.reject(failure!));
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, PRICING_RULE_SAVE_BARRIER_POLL_MS),
      );
    }
  }
  void watch().catch((error: unknown) => {
    failure = error instanceof Error ? error : new Error(String(error));
    paused.splice(0).forEach((p) => p.reject(failure!));
  });

  return {
    assertReleased() {
      if (failure !== undefined) {
        throw failure;
      }
      if (!released) {
        throw new Error(
          `PricingRule save barrier: condition '${condition}' was never ` +
            `observed; arrivals=${arrivals}`,
        );
      }
    },
    restore() {
      stopped = true;
      saveSpy.mockRestore();
    },
  };
}
```

- [ ] **Step 3: Replace the pre-warm comment.** In the comment above `it('two concurrent createPricingRule calls for the same service: …`, keep the first paragraph (`// The most important test in this task …` through `// produce this signal; it requires real concurrent Postgres transactions.`). Replace everything from the following `    //` line, `    // The two-connection pre-warm below is load-bearing, not decoration:` through `    // calls' deactivate/insert steps genuinely overlap.` with:

```ts
    //
    // Firing both calls in one tick does not make them overlap (#138): see
    // `installPricingRuleSaveBarrier` for the synchronization that does.
```

- [ ] **Step 4: Remove the three pre-warm blocks.** Delete each of the three occurrences of this block, including its trailing blank line. There are exactly three: the first-ever service race, the predecessor race and the addOn race.

```ts
      const warmupA = dataSource.createQueryRunner();
      const warmupB = dataSource.createQueryRunner();
      await Promise.all([warmupA.connect(), warmupB.connect()]);
      await Promise.all([warmupA.query('SELECT 1'), warmupB.query('SELECT 1')]);
      await Promise.all([warmupA.release(), warmupB.release()]);

```

- [ ] **Step 5: Wrap each race in its barrier.** In each of the three tests, change

```ts
      const [resultA, resultB] = await Promise.allSettled([
```

to the following, where `<condition>` is `'both-at-save'` in the first-ever service race and the addOn race, and `'other-blocked-on-close'` in the predecessor race:

```ts
      const barrier = installPricingRuleSaveBarrier(dataSource, <condition>);
      const [resultA, resultB] = await Promise.allSettled([
```

and change that `Promise.allSettled([...` call's closing line

```ts
      ]);
```

to

```ts
      ]).finally(() => barrier.restore());
      barrier.assertReleased();
```

In the predecessor race, the barrier line goes after the `effFromA`/`effFromB` declarations, immediately before `const [resultA, resultB]`.

- [ ] **Step 6: Assert `ConflictException` in the predecessor and addOn races.** Replace each of the two occurrences of

```ts
      expect(
        [resultA, resultB].filter((r) => r.status === 'rejected'),
      ).toHaveLength(1);
```

with

```ts
      const rejected = [resultA, resultB].filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
```

- [ ] **Step 7: Format, lint and type-check.**

Run: `cd apps/api && npx prettier --write test/catalog.service.e2e-spec.ts && npx eslint test/catalog.service.e2e-spec.ts && npx tsc --noEmit -p tsconfig.json`
Expected: no output from ESLint or `tsc`, and exit 0. Then `grep -c "warmupA" test/catalog.service.e2e-spec.ts` prints `0`, and `grep -c "installPricingRuleSaveBarrier(" test/catalog.service.e2e-spec.ts` prints `4` (the definition plus three calls).

- [ ] **Step 8: Run the three races and the whole file.**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule"`
Expected: `Tests: 38 skipped, 3 passed, 41 total`.

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json catalog.service`
Expected: `Tests: 41 passed, 41 total`.

- [ ] **Step 9: Commit.**

```bash
git add apps/api/test/catalog.service.e2e-spec.ts
git commit -m "test(138): synchronize the concurrent createPricingRule races with a save barrier"
```

### Task 2: Mutation evidence (primary acceptance; no commit)

Each mutation is applied to the committed file, run, and then reverted with `git checkout -- apps/api/test/catalog.service.e2e-spec.ts`. Before the next step, `git status --short` must show a clean tree. Record each result in the M6 record.

- [ ] **MA — wrong condition, predecessor race.** In the predecessor race, change `'other-blocked-on-close'` to `'both-at-save'`.
Run: `cd apps/api && npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule"`
Expected: `Tests: 1 failed, 38 skipped, 2 passed`. The failure reads `PricingRule save barrier: condition 'both-at-save' not observed within 3000 ms; arrivals=1; paused pids=[<p>]; pg_stat_activity=[…]` and the snapshot contains a backend with `"wait_event_type":"Lock"` and `"blocked_by":[<p>]`. This proves the blocked call cannot reach the save, and that a barrier failure does not leak into the other two tests. Revert.

- [ ] **MB — wrong condition, first-ever races.** In the two `'both-at-save'` calls, change the condition to `'other-blocked-on-close'`. Run the same command.
Expected: `Tests: 2 failed, 38 skipped, 1 passed`. Each failure reads `condition 'other-blocked-on-close' not observed …; arrivals=2; paused pids=[<a>, <b>]`, so no lock wait occurs when no predecessor exists. Revert.

- [ ] **MC — the CI schedule (non-overlap).** In the first-ever service race, replace the barrier line through `barrier.assertReleased();` with two sequential calls:

```ts
      const [resultA] = await Promise.allSettled([
        service.createPricingRule({ actorId: 'actor-1', serviceId: svc.id, tenantId: TENANT_ID, priceMinorUnits: 5000 }),
      ]);
      const [resultB] = await Promise.allSettled([
        service.createPricingRule({ actorId: 'actor-2', serviceId: svc.id, tenantId: TENANT_ID, priceMinorUnits: 6000 }),
      ]);
```

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json catalog.service -t "for the same service: exactly one"`
Expected: `Tests: 1 failed, 40 skipped`, failing at `expect(fulfilled).toHaveLength(1)` with `Expected length: 1 / Received length: 2`. This is the #138 failure, reproduced deterministically. Revert.

- [ ] **MD — barrier disabled (informational).** Replace each of the three `installPricingRuleSaveBarrier(…)` calls with `{ assertReleased() {}, restore() {} }`. Run the three-race command 20 times and count passes.
Expected: most runs fail. Pre-validation: 0 of 20 passed. This is supporting evidence that the barrier, not luck, makes the tests pass. It is not an acceptance criterion. Revert.

- [ ] **ME — index protection removed, in a throwaway database.** The dev database `clensy` is never mutated.

```bash
P="docker exec clensy-platform-postgres-1 psql -U clensy -v ON_ERROR_STOP=1 -qtAc"
$P "CREATE DATABASE clensy_mut138" -d postgres
(cd apps/api && DB_NAME=clensy_mut138 pnpm migration:run)
(cd apps/api && DB_NAME=clensy_mut138 npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule")   # baseline
docker exec clensy-platform-postgres-1 psql -U clensy -d clensy_mut138 -v ON_ERROR_STOP=1 -qtAc 'DROP INDEX "uq_pricing_rule_open_service"; DROP INDEX "uq_pricing_rule_active_service"; DROP INDEX "uq_pricing_rule_open_addon";'
(cd apps/api && DB_NAME=clensy_mut138 npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule")   # mutated
$P "DROP DATABASE clensy_mut138" -d postgres
$P "SELECT count(*) FROM pg_database WHERE datname='clensy_mut138'" -d postgres
docker exec clensy-platform-postgres-1 psql -U clensy -d clensy -qtAc "SELECT count(*) FROM pg_indexes WHERE indexname IN ('uq_pricing_rule_open_service','uq_pricing_rule_active_service','uq_pricing_rule_open_addon')"
```

Expected:
- baseline: `Tests: 38 skipped, 3 passed`;
- mutated: `Tests: 3 failed, 38 skipped`, each with `Expected length: 1 / Received length: 2`. The barrier still releases, so the tests pass only because the indexes reject the loser;
- the throwaway-database count prints `0`, and the dev-database index count prints `3`.

### Task 3: Suites, PR and CI

- [ ] **Step 1: Supporting loop.** Run the three-race command 50 times.
Expected: 50 of 50 pass. Supporting evidence only (Acceptance).

- [ ] **Step 2: Full and CI-scoped e2e, and lint.**

Run: `pnpm --filter api test:e2e`
Expected: `Test Suites: 49 passed, 49 total` and `Tests: 458 passed, 458 total`.

Run: `pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate` (the **API e2e** job's command)
Expected: `Test Suites: 48 passed, 48 total` and `Tests: 446 passed, 446 total`.

Run: `pnpm --filter api exec eslint "{src,test}/**/*.ts"`
Expected: exit 0, no output.

- [ ] **Step 3: Push and open the PR.** Run `git status --short` (expected: clean), then push `fix/138-deterministic-pricing-rule-race-tests` and open one PR for #138 with `gh pr create`. The PR carries this plan and Task 1's commit.
Expected: the PR's **API e2e** check passes.

- [ ] **Step 4: After merge (closeout).** Confirm that the **API e2e** run on `main` for the merge commit passes.
Expected: green. If it is red on this file, M6 stops and returns to M4/M5 with the run's barrier diagnostic.

## Acceptance (M5/M6)

Primary, in this order:
1. Constraints 1–5 hold in the code as written in Task 1 Step 2. No release path exists except an observed condition.
2. Mutations MA, MB, MC and ME produce exactly the Expected results.

Supporting, not sufficient on its own: the 50-run loop, the full and CI-scoped suites, the PR's **API e2e** check and the post-merge `main` run.

## Out of scope

- Production changes to `PricingRulesService` and any test-only hook in `apps/api/src`.
- Making **API e2e** a required status check (#135 deferral). It can follow once `main` is green after this merge, and is not done here.
- Investigating why `main` push runs lost the race more often than PR runs. With deterministic synchronization the question no longer affects the outcome.
- Other suites' concurrency tests, for example `admins.service.disable-concurrency.e2e-spec.ts`. #138 names only this file.

## Pre-validation (full)

Before M5, on 2026-10-06, every edit in Task 1 was applied verbatim to a working tree at `7f93ffb`, then reverted. Every command named by an `Expected:` line in Tasks 1–3 ran with the stated result: the Step 7 static checks, the Step 8 runs, MA–ME, the 50-run loop, the full and CI-scoped e2e suites, and lint. Exceptions: the Task 1 Step 9 commit and the Task 3 Steps 3–4 push, PR, CI and post-merge checks, which cannot run before M6. ME ran in a throwaway `clensy_mut138` database, which was dropped afterwards; the dev database kept all three indexes. MD's informational count was 0 of 20 with the final assertions (3 of 20 before the Step 6 `ConflictException` assertions were added).

## Gate outcomes

*(M5–M10 records are appended here.)*
