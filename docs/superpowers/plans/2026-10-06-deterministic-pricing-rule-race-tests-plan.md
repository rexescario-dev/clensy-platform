# Deterministic Concurrent createPricingRule e2e Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-06, at `fed28bd`, by the owner, on the second pass, with no further revision. All three first-pass items (barrier lifecycle, interception contract, ME cleanup) were verified resolved, with MF/MG and the trap-guarded ME as evidence. Execution: native (inline). M6 MUST implement exactly the validated helper and test wiring in Task 1; it MUST NOT redesign the synchronization mechanism. |
| Date | 2026-10-06 |
| Tracking issue | [#138](https://github.com/rexescario-dev/clensy-platform/issues/138) |
| M2 / M3 | **N/A** — owner decision, 2026-10-06, the same reasoning as #135. #138 adds no product or authorization semantics, no schema or API contract change, no production code and no architectural decision. It replaces a timing assumption in three existing e2e tests with synchronization. |
| Brainstorm approval | 2026-10-06, by the owner. Approved: the in-test barrier at the `PricingRuleEntity` save, one helper kept in the test file, both alternatives rejected (DB trigger with advisory lock; raw SQL race), M4 → M5 → M6–M10, one PR. Conditions, each carried into this plan: (a) the barrier's synchronization semantics are explicit, so it cannot become a timing-based test again (Constraints 1–4); (b) the predecessor case names exactly which backend is expected to wait and the query that identifies it (Constraint 3); (c) the timeout failure names the participant count, the expected condition and the observed Postgres wait state (Constraint 5); (d) the index mutation is fully temporary (Task 2, ME); (e) a passing loop is supporting evidence only (Acceptance). |
| M5 history | First pass (2026-10-06, owner): **request changes, no redesign**. Three items, each resolved in this revision and re-validated:<br>**(1) Barrier lifecycle:** `restore()` now returns `Promise<void>`. It removes the spy, rejects any save still paused, and resolves only after the polling loop has settled (`await watching`). `.finally(() => barrier.restore())` awaits it. Constraint 9.<br>**(2) Interception contract:** pinned to the exact call shape `createPricingRule` uses today, `manager.save(entity)` with one `PricingRuleEntity` instance (`pricing-rules.service.ts`, step 5). Any other `save` shape that carries a `PricingRuleEntity` fails the test at once. A step 5 that bypasses `save` never arrives, so `restore` (or the timeout) fails it. Constraint 8. New mutations MF and MG prove both paths.<br>**(3) ME cleanup:** ME is one subshell with an `EXIT` trap that drops the throwaway database with `DROP DATABASE IF EXISTS … WITH (FORCE)` however the block ends. Validated both normally and aborted under `set -e -o pipefail` at the expected-failing run.<br>**Also applied:** the `both-at-save` comment now states the invariant as "both calls have reached the save boundary while their transactions remain open". |
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
2. **`both-at-save`** (first-ever service race; addOn race): release when exactly two `PricingRuleEntity` saves are paused. At that point both calls have reached the save boundary while their transactions remain open: both close steps have run and neither call has committed, so whatever order the INSERTs then run in, the second one collides on the open/active partial unique index (spec §4.4 step 3, §4.7).
3. **`other-blocked-on-close`** (predecessor race): release when exactly one save is paused (call P, backend pid `p`, captured inside P's transaction with `SELECT pg_backend_pid()`) **and** exactly one backend is returned by

   ```sql
   SELECT pid, wait_event_type, wait_event, query
     FROM pg_stat_activity
    WHERE $1 = ANY(pg_blocking_pids(pid))   -- $1 = p
   ```

   and that backend has `wait_event_type = 'Lock'` and a current `query` starting with `UPDATE "pricing_rule_entity" SET "effectiveTo"`. That backend is the other call's transaction, blocked in its close step on the predecessor row lock P took in its own close step. After P commits, the waiter's predicate re-check matches zero rows, so it closes nothing, and its INSERT collides with P's open row (spec §4.4 step 3). An unrelated lock, another blocker or another statement does not satisfy the condition. Two paused saves never satisfy it either: that would mean no close step blocked.
4. **The condition is declared per test, not inferred.** Each test names its condition. The helper does not accept "either condition".
5. **Diagnostic timeout.** `PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS = 3000`, below Jest's default 5 s test timeout. Polling interval: 20 ms. The timeout error names the condition, the arrival count, the paused backend pids and a `pg_stat_activity` snapshot of the database, excluding the polling connection. The snapshot has `pid`, `state`, `wait_event_type`, `wait_event`, `pg_blocking_pids` and the first 80 characters of `query`.
6. **No production change.** Nothing under `apps/api/src` changes (Task 2's MF and MG mutate it temporarily and revert). The spy is installed only around each race and is restored in `.finally`, so no other test, and no seed or read in a race test, sees it. Saves of other entities, and saves that arrive after release, pass straight through.
7. **Assertions.** Every existing assertion stays. The predecessor and addOn races also assert that the rejection is a `ConflictException`, which the first-ever service race already does. With the barrier, this is what proves the conflict path was taken, not some other rejection. These are **characterization tests**: they pin already-correct production behavior (spec §4.4, §4.7). No production code is expected to change to make them pass.
8. **Interception contract.** The barrier recognizes exactly the call shape `createPricingRule` uses today: `manager.save(entity)` with one `PricingRuleEntity` instance as the only argument (`pricing-rules.service.ts`, step 5, `await manager.save(entity);`). Any other `save` call that carries a `PricingRuleEntity` (the class or its name as a target, an instance as a later argument, or an array) fails the test at once with `unsupported save call shape`, instead of bypassing the barrier. A step 5 that stops calling `save`, for example `insert`, never arrives: the condition is never observed, and `restore` (or the timeout) fails the test. If step 5's shape changes, the barrier is updated to the new shape, never loosened.
9. **Lifecycle.** `restore(): Promise<void>` removes the spy, rejects any save still paused (`restored before condition … was observed`), and resolves only once the polling loop has settled. Each test awaits it through `.finally(() => barrier.restore())` before `assertReleased()`. No spy and no polling task outlives the test.
10. The helper stays in `catalog.service.e2e-spec.ts`. It is not promoted to `test/helpers/` unless another suite needs it (out of scope).

## Review Focus

1. **Barrier released by the wrong backend in the predecessor race.** Expected: release requires `pg_blocking_pids` to contain the paused pid, `Lock`, and the close-step `UPDATE` text. Pinned by ME: with the indexes dropped, the barrier still releases (same conditions) and the assertions fail, so the conditions match the real waiter. MA proves `both-at-save` cannot be met there.
2. **Condition never met (setup broken, statement text changed by a TypeORM upgrade).** Expected: a 3 s diagnostic failure, not a hang or a bare Jest timeout. Pinned by MA and MB, whose failure text is recorded below.
3. **Spy leaking into later tests.** Expected: restored in `.finally` even if the race throws. Pinned by MA/MB: the other tests in the same run still pass after a barrier failure.
4. **Non-overlapping schedule (the CI failure).** Expected: the assertions catch it. Pinned by MC, which forces the sequential schedule and reproduces `Expected length: 1 / Received length: 2`.
5. **The barrier masking a broken index.** Expected: the tests fail if the indexes are gone. Pinned by ME.
6. **Step 5's call shape changes.** Expected: the tests fail loudly, never silently lose synchronization. Pinned by MF (`save(PricingRuleEntity, entity)` fails with `unsupported save call shape`) and MG (`insert` fails with `restored before condition … arrivals=0`).

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
// - `both-at-save`: both calls have reached the save boundary while their
//   transactions remain open. The first-ever-rule races use this: with no
//   open row, neither close step takes a row lock.
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
// Interception contract: the barrier recognizes exactly the call shape
// `createPricingRule` uses today, `manager.save(entity)` with a
// `PricingRuleEntity` instance as the only argument. Any other `save` shape
// that carries a `PricingRuleEntity` (a target plus an object, an array, an
// options argument) fails the test at once instead of bypassing the
// barrier. A step 5 that no longer goes through `save` at all never
// arrives, so the condition is never observed and `restore` (or the
// timeout) fails the test. If step 5 changes shape, update this barrier
// rather than loosen it.
//
// Saves reaching the barrier after release pass straight through. If the
// condition is not observed within `PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS`,
// every paused save is rejected (rolling its transaction back) and
// `assertReleased` throws a diagnostic naming the condition, the arrivals
// and the observed Postgres wait state. `restore` removes the spy, rejects
// any save still paused, and resolves only once the polling loop has
// settled, so nothing from the barrier outlives the test.
type PricingRuleSaveBarrierCondition =
  'both-at-save' | 'other-blocked-on-close';

interface PricingRuleSaveBarrier {
  assertReleased(): void;
  restore(): Promise<void>;
}

// Below Jest's default 5 s test timeout, so a missed condition fails with
// the barrier's diagnostic rather than a bare Jest timeout.
const PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS = 3000;
const PRICING_RULE_SAVE_BARRIER_POLL_MS = 20;

function carriesPricingRule(value: unknown): boolean {
  return (
    value === PricingRuleEntity ||
    value === 'PricingRuleEntity' ||
    value instanceof PricingRuleEntity ||
    (Array.isArray(value) && value.some(carriesPricingRule))
  );
}

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

  function fail(error: Error) {
    failure ??= error;
    paused.splice(0).forEach((p) => p.reject(failure!));
  }

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
      const isBarrierShape =
        args.length === 1 && args[0] instanceof PricingRuleEntity;
      if (!isBarrierShape && args.some(carriesPricingRule)) {
        fail(
          new Error(
            'PricingRule save barrier: unsupported save call shape for ' +
              'PricingRuleEntity; expected manager.save(entity) with one ' +
              'PricingRuleEntity instance. Update the barrier to the new ' +
              'shape.',
          ),
        );
        throw failure!;
      }
      if (isBarrierShape) {
        arrivals += 1;
        if (!released) {
          if (failure !== undefined) {
            throw failure;
          }
          const [{ pid }] = await this.query<{ pid: number }[]>(
            'SELECT pg_backend_pid() AS pid',
          );
          await new Promise<void>((resolve, reject) => {
            if (failure !== undefined) {
              reject(failure);
              return;
            }
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
    while (!stopped && failure === undefined) {
      if (await conditionMet()) {
        released = true;
        paused.splice(0).forEach((p) => p.resolve());
        return;
      }
      if (Date.now() >= deadline) {
        fail(
          new Error(
            `PricingRule save barrier: condition '${condition}' not ` +
              `observed within ${PRICING_RULE_SAVE_BARRIER_TIMEOUT_MS} ms; ` +
              `arrivals=${arrivals}; paused pids=` +
              `[${paused.map((p) => p.pid).join(', ')}]; ` +
              `pg_stat_activity=${await describeWaitState()}`,
          ),
        );
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, PRICING_RULE_SAVE_BARRIER_POLL_MS),
      );
    }
  }
  const watching = watch().catch((error: unknown) => {
    fail(error instanceof Error ? error : new Error(String(error)));
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
    async restore() {
      stopped = true;
      saveSpy.mockRestore();
      if (!released) {
        fail(
          new Error(
            `PricingRule save barrier: restored before condition ` +
              `'${condition}' was observed; arrivals=${arrivals}`,
          ),
        );
      }
      await watching;
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

`.finally` awaits the promise `restore()` returns, so the spy is removed and the polling loop has settled before `assertReleased()` runs.

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
Expected: most runs fail. Pre-validation: 0 of 20 passed on the first pass and 2 of 20 on the revalidation. This is supporting evidence that the barrier, not luck, makes the tests pass. It is not an acceptance criterion. Revert.

- [ ] **ME — index protection removed, in a throwaway database.** The dev database `clensy` is never mutated. Run this block from the repository root with `bash`. The subshell's `EXIT` trap drops the throwaway database however the block ends: after the expected failure of the mutated run, or if any command aborts, including under `set -e`.

```bash
(
  P="docker exec clensy-platform-postgres-1 psql -U clensy -d postgres -v ON_ERROR_STOP=1 -qtAc"
  M="docker exec clensy-platform-postgres-1 psql -U clensy -d clensy_mut138 -v ON_ERROR_STOP=1 -qtAc"
  trap '$P "DROP DATABASE IF EXISTS clensy_mut138 WITH (FORCE)"' EXIT
  $P "DROP DATABASE IF EXISTS clensy_mut138 WITH (FORCE)"
  $P "CREATE DATABASE clensy_mut138"
  cd apps/api
  DB_NAME=clensy_mut138 pnpm migration:run > /dev/null
  echo "-- baseline"
  DB_NAME=clensy_mut138 npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule" 2>&1 | grep -E "^Tests:"
  $M 'DROP INDEX "uq_pricing_rule_open_service"; DROP INDEX "uq_pricing_rule_active_service"; DROP INDEX "uq_pricing_rule_open_addon";'
  echo "-- mutated"
  DB_NAME=clensy_mut138 npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule" 2>&1 | grep -E "^Tests:|Expected length|Received length"
)
# Verification, after the trap has run:
docker exec clensy-platform-postgres-1 psql -U clensy -d postgres -qtAc "SELECT count(*) FROM pg_database WHERE datname = 'clensy_mut138'"
docker exec clensy-platform-postgres-1 psql -U clensy -d clensy -qtAc "SELECT count(*) FROM pg_indexes WHERE indexname IN ('uq_pricing_rule_open_service', 'uq_pricing_rule_active_service', 'uq_pricing_rule_open_addon')"
```

Expected:
- baseline: `Tests: 38 skipped, 3 passed`;
- mutated: `Tests: 3 failed, 38 skipped`, each with `Expected length: 1 / Received length: 2`. The barrier still releases, so the tests pass only because the indexes reject the loser;
- the throwaway-database count prints `0`, and the dev-database index count prints `3`.

- [ ] **MF — step 5 call shape changed.** In `apps/api/src/modules/catalog/application/services/pricing-rules.service.ts`, change `          await manager.save(entity);` to `          await manager.save(PricingRuleEntity, entity);`.
Run: `cd apps/api && npx jest --config ./test/jest-e2e.json catalog.service -t "concurrent createPricingRule"`
Expected: `Tests: 3 failed, 38 skipped`, each failing with `PricingRule save barrier: unsupported save call shape for PricingRuleEntity; expected manager.save(entity) with one PricingRuleEntity instance. Update the barrier to the new shape.` Revert with `git checkout -- apps/api/src/modules/catalog/application/services/pricing-rules.service.ts`.

- [ ] **MG — step 5 bypasses `save`.** In the same file, change `          await manager.save(entity);` to `          await manager.insert(PricingRuleEntity, entity);`. Run the same command.
Expected: `Tests: 3 failed, 38 skipped`. The two `both-at-save` races fail with `PricingRule save barrier: restored before condition 'both-at-save' was observed; arrivals=0`, and the predecessor race with the same message for `'other-blocked-on-close'`. Revert the same way. `git status --short` must then show no change under `apps/api/src`.

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
2. Mutations MA, MB, MC, ME, MF and MG produce exactly the Expected results, and ME's throwaway database is gone afterwards.

Supporting, not sufficient on its own: the 50-run loop, the full and CI-scoped suites, the PR's **API e2e** check and the post-merge `main` run.

## Out of scope

- Production changes to `PricingRulesService` and any test-only hook in `apps/api/src`.
- Making **API e2e** a required status check (#135 deferral). It can follow once `main` is green after this merge, and is not done here.
- Investigating why `main` push runs lost the race more often than PR runs. With deterministic synchronization the question no longer affects the outcome.
- Other suites' concurrency tests, for example `admins.service.disable-concurrency.e2e-spec.ts`. #138 names only this file.

## Pre-validation (full)

Before M5, on 2026-10-06, every edit in Task 1 was applied verbatim to a working tree at `7f93ffb`, then reverted. After the M5 first pass, the revised Task 1 was applied again and every check re-ran with the stated results:
- the Step 7 static checks and the Step 8 runs;
- MA–MG, including the ME block exactly as written, run once normally and once with the subshell under `set -e -o pipefail`, aborting at the expected-failing mutated run (the trap dropped the database both times, and the dev database kept all three indexes);
- the 50-run loop, the full and CI-scoped e2e suites, lint and `tsc`.

Not run, because they cannot run before M6: the Task 1 Step 9 commit and the Task 3 Steps 3–4 push, PR, CI and post-merge checks. MD is informational: 0 of 20 runs passed on the first pass and 2 of 20 on the revalidation (3 of 20 before Step 6's `ConflictException` assertions existed).

## Gate outcomes

*(M5–M10 records are appended here.)*

### M6 — Implementation (2026-10-06, native/inline)

**Outcome: Complete.** Task 1 was applied exactly as written, in commit `012e52b`. Its diff is identical to the pre-validated diff. No redesign, and no deviation from Task 1.

| Check | Result |
| --- | --- |
| Task 1 Step 7 (Prettier, ESLint, `tsc`; `warmupA` = 0; `installPricingRuleSaveBarrier(` = 4) | Matches |
| Task 1 Step 8 (three races; whole file) | `3 passed`; `41 passed` |
| MA | `condition 'both-at-save' not observed …; arrivals=1`. The snapshot's `Lock` waiter is blocked by the paused pid, in the close `UPDATE "pricing_rule_entity" SET "effectiveTo"`; the other 2 tests pass |
| MB | Both first-ever races: `condition 'other-blocked-on-close' not observed …; arrivals=2` |
| MC | `Expected length: 1 / Received length: 2`, the #138 failure |
| MD (informational) | 3 of 20 passed without the barrier |
| ME (verbatim block, trap) | baseline `3 passed`; mutated `3 failed`; throwaway DB count `0`; dev indexes `3` |
| MF | 3 failed: `unsupported save call shape for PricingRuleEntity …` |
| MG | 3 failed: `restored before condition … was observed; arrivals=0` |
| 50-run loop | 50 of 50 |
| `pnpm --filter api test:e2e` | 49 suites, 458 tests passed |
| CI-scoped e2e | 48 suites, 446 tests passed |
| API unit tests / lint / `tsc` / build | 987 passed / clean / clean / passed |

Every mutation was reverted with `git checkout`, and the tree was clean after each. Characterization-test evidence (the M6 rule for tests of already-correct behavior): MC, ME, MF and MG are failing runs against mutations that were never committed. Execution note: the `executing-plans` `task-done` helper was blocked by a harness safety check, so the same test command was run directly and the ledger line was written by hand.

### M7 — Approved for merge, self-review (2026-10-06)

```text
Decision: Approved for merge
Subject: PR #139 (fix/138-deterministic-pricing-rule-race-tests), M6 head 012e52b, merge-base 7f93ffb (main)
Accepted specification: M2/M3 N/A (owner decision); behavior under test: docs/superpowers/specs/2026-09-06-laundry-catalog-foundation-design.md §4.4, §4.7 (Accepted, unchanged)
Accepted implementation plan: this document (M5 Accepted at fed28bd, recorded in 21a7cb1)

M6 gate: the M5 acceptance commit 21a7cb1 is the parent of the implementation commit 012e52b.

Plan tasks reviewed:
- Task 1 (helper, pre-warm removal, barrier wiring, ConflictException assertions): ✓. The diff is identical to the pre-validated diff, and the helper is byte-for-byte the plan's Step 2 code. No change outside apps/api/test/catalog.service.e2e-spec.ts.
- Task 2 (MA–MG): ✓. All match Expected (M6 record); never committed.
- Task 3 Steps 1–3 (loop, suites, lint, PR): ✓. Step 4 (post-merge main run) is pending the merge.

Verification evidence:
- CI on PR #139, run 37420309837: API e2e, Lint, Release gate and Test all pass. The API e2e log shows "PASS test/catalog.service.e2e-spec.ts" and 48 suites / 446 tests passed, the same counts as the local CI-scoped run.
- Local: the M6 table (mutations, 50/50 loop, 458 e2e, 446 CI-scoped e2e, 987 unit, lint, tsc, build).

Review summary: Checked against Constraints 1–10 and Review Focus 1–6.
- Release happens only in watch() after conditionMet().
- Every failure path rejects the paused saves through fail(), and restore() awaits the watcher.
- The waiter query matches Constraint 3 exactly.
- The shape check rejects every PricingRuleEntity-carrying save except the single-instance form, so a recursive internal save would also fail loudly; none occurs (all races pass).
- The pool needs at most 4 connections (two transactions, the poller and the file's advisory-lock connection), within the TypeORM default of 10.
- No scope expansion; no production, CI or schema change.
Blocking findings: None (no merge blockers)

Non-blocking observations (optional):
- blockedOnCloseWaiters selects wait_event, which conditionMet does not use. Kept: it is harmless and mirrors the diagnostic query.
(These MUST NOT affect the merge decision.)

Gate: Merge per human/project norms. M8/M9 may follow when appropriate.
```

**Review basis: self-review.** The M6 implementer did this review, so it is not independent. No fresh-agent reviewer was dispatched, because this session's standing rule is not to spawn subagents unless the owner asks. The owner may require an independent review before merging.

### M8 — N/A (2026-10-06)

There is no worthwhile maintainability change. The slice is one test helper plus wiring, delivered exactly as M5 accepted it. Restructuring it now would only risk the validated synchronization behavior.

### M9 — Complete (2026-10-06)

- **Scope:** `docs/README.md` (the Catalog tenant isolation (#84) section) and this plan's records.
- **Content:** a paragraph on the #138 synchronization of the concurrent pricing-rule races, plus a link to this plan as Accepted. Caused by: this plan's completion (M6/M7).
- **Editorial verification:**
  - both new relative links resolve;
  - the heading hierarchy is unchanged;
  - no section contradicts the spec, which the paragraph cites rather than restates;
  - the plan's Status is Accepted, consistent with M5.
- The root `README.md` needs no change. Its API e2e paragraph (#135) is still accurate, and making the job a required check stays deferred.

### M10 — Accepted, workflow validated (2026-10-06)

**Subject:** the installed workflow (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), run on #138 from M4 to M9 with M2/M3 N/A. The branch diff against `main` for `docs/workflows/` and `workflow.yaml` is empty.

**Checks:**
- §2.5 was honoured: the M5 acceptance `21a7cb1` precedes the implementation `012e52b`.
- M5 returned on its first pass with three items. All were resolved and re-validated before the second-pass Accept.
- M6 step 3 (characterization evidence) was honoured: MC, ME, MF and MG are uncommitted mutations.
- `workflow.providers` (GitHub) was honoured for the issue, the branch and PR #139.
- §2.8 was honoured: one PR carries the plan, implementation and docs.
- Slice Completion Reports were emitted at M6 and at M7–M9.

**Blocking findings:** none.

**Non-blocking observations:**
1. **M7 was a self-review.** The M7 prompt allows this when it is labelled, and it is. But the `executing-plans` skill expects a fresh reviewer, and this session's standing rule withholds subagents unless the owner asks. The two only conflict when the owner has not said which applies. A standing owner instruction (for example, "M7 may dispatch a fresh reviewer") would settle it.
2. **The M2/M3 N/A path recurs.** This is the same observation as #135's M10 observation 1. A second slice has used an owner-recorded N/A for M2/M3. It may be worth adding to the process spec.
3. **Helper tooling vs. harness safety.** The `executing-plans` `task-done` helper was blocked by a harness safety check (a `bash -c` wrapper), and the ledger line was written by hand. This had no effect on the evidence.
