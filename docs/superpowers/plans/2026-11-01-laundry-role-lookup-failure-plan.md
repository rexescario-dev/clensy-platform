# Laundry Order Page: Role-Lookup Failure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task by task. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 5)** at M5, 2026-11-01 ([M5 decision](#m5-decision)). M6 **Complete** ([Execution record (M6)](#execution-record-m6)). M7 **Accepted** on 2026-11-01, on a fresh independent review (**Approve**) ([M7 decision](#m7-decision)). M8 **N/A**, M9 **Complete**, M10 **does not apply** ([M8](#m8--not-applicable), [M9](#m9--documentation-2026-11-01), [M10](#m10--not-applicable)). **Ready for closeout**, pending the owner's authorization to commit, push and open the PR. Drafted at M4 on 2026-11-01. Revision 1 was returned by an independent M5 review (**Request changes**, 2026-11-01); revision 2 addressed it ([Revision 2 changes](#revision-2-changes)). Revision 2 was returned by a fresh independent M5 review (**Request changes**, 2026-11-01); revision 3 addressed it ([Revision 3 changes](#revision-3-changes)). Revision 3 was returned by a fresh independent M5 review (**Request changes**, 2026-11-01); revision 4 addressed it ([Revision 4 changes](#revision-4-changes)). Revision 4 was returned by a fresh independent M5 review (**Request changes**, 2026-11-01); revision 5 addresses it ([Revision 5 changes](#revision-5-changes)). Revision 5 was approved by a fresh independent M5 review with no blockers and no required corrections, and the owner accepted it. At M4 and M5, nothing had been run against this repository: every `Expected:` line was a prediction, not a result, and the evidence behind the plan was of two kinds, kept apart: source-level inspection of the code and tests (read-only), and shell-mechanics runs of the break-run blocks in throwaway git repositories with a stub test command ([Break runs](#break-runs)). Neither was an application test result. The actual results, from M6, are in the [Execution record (M6)](#execution-record-m6), and the M7 reviewer re-ran the gates ([M7 decision](#m7-decision)). |
| Tracking issue | [#211](https://github.com/rexescario-dev/clensy-platform/issues/211) "Laundry order page: show a message when the role lookup fails (Actions section)". It follows up [#165](https://github.com/rexescario-dev/clensy-platform/issues/165), which deferred it by owner decision U2 (PR #210). |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md) §8.4.4. That section covers role-based actions and says nothing about a failed role lookup, so **no spec amendment** is needed. |
| M5 decision | **Accepted** on 2026-11-01, revision 5, by the owner, on a fresh independent review (**Approve**). See [M5 decision](#m5-decision). |
| M6 | **Complete** on 2026-11-01, uncommitted; see [Execution record (M6)](#execution-record-m6). Authorized by the owner on 2026-11-01 ("m6"). That covers creating the local branch and executing this plan. Staging, committing, pushing, opening the PR and posting the #211 comment are separate decisions, none of them granted, so the work stays uncommitted. |
| M7 | **Accepted** on 2026-11-01, on a fresh independent review (**Approve**, no blockers, no required code corrections). See [M7 decision](#m7-decision). |
| M8 | **N/A** (2026-11-01). See [M8](#m8--not-applicable). |
| M9 | **Complete** (2026-11-01). See [M9](#m9--documentation-2026-11-01). |
| M10 | **Does not apply**: no workflow asset changed. See [M10](#m10--not-applicable). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised; this plan never overrides it. Issue #211 refines §8.4.4 for one state the spec does not address (a failed role lookup), and its acceptance criterion 1 is applied as changed by the owner ([owner decision](#211-acceptance-criterion-1-owner-decision)). File names, helper names (`laundryRoleLookup`, `LaundryRoleLookup`), message-key names (`laundry.error.account`), test-constant names and task order are planning decisions, not product behavior requirements. The product behavior is: the wording, the placement, the condition and the unchanged section bodies (decisions a–g). |
| Commits | M6 stages and commits **only** with the owner's explicit authorization to commit for this slice, recorded in the M6 execution record. Two commits are planned, one for Task 1 and one for Task 2. Both are made only in Task 2 Step 9, **after** every break run has been restored and verified and the final check has passed, so a failed break run, restore or test prevents any commit. Task 3 makes no commit. Committing this plan and its M5 record also needs that authorization. Without it, the work stays uncommitted and the record says so. The [break runs](#break-runs) never depend on a commit. |
| Extends (Accepted plans) | [#156 order page](2026-10-14-laundry-order-page-plan.md): "nothing while the role loads" in Actions. [#158 services](2026-10-15-laundry-services-selection-plan.md) and [#162 price review](2026-10-15-laundry-price-review-plan.md): `roleResolved` and the `'hidden'` view. Their code is **not changed**. The meaning of `'hidden'` widens from "the role is loading" to "**no role is available: loading or failed**", and the new page-level alert tells the two apart. |
| Owner decisions | **2026-11-01 (first):** when the lookup fails, Actions, Services and Price must not stay silently empty. Reuse the wording "Unable to load your account." and the red-alert style. Keep four states distinct: loading, failed, resolved without permission, resolved with permission. Never show the account error for a permission restriction. Do not change shared auth or page access, roles or business rules, Weighing, Invoice, or unrelated components. **2026-11-01 (after M5):** use **one page-level alert**, not three. It says "Unable to load your account." once, when `currentAdmin` has failed and no role is available. It is placed after the order summary boxes and before the section links. It is not repeated inside Actions, Services or Price. Section behavior is unchanged when the role resolves. The `ErrorState` component is not used. |
| Issue criterion changed by the owner | See [#211 acceptance criterion 1: owner decision](#211-acceptance-criterion-1-owner-decision). |
| Branch | `feat/211-role-lookup-failure`, from `main`. It is a local branch, created only when M6 starts, and starting M6 needs the owner's explicit implementation authorization. That authorization covers creating the local branch, a local ref with nothing staged or committed. It does **not** cover staging or committing (see **Commits**), pushing, or opening the PR. Each of those needs the owner's explicit approval. No branch is created at M4 or M5. When approved, there is one PR for this plan, its M5 record and the implementation. |
| Scope | Five files: three source files and two test files (see [File map](#file-map)). **Not changed:** `apps/web/lib/laundry-service-selection.ts`, `apps/web/lib/laundry-price-review.ts` and their tests; `laundry-order-page.interaction.test.tsx`; `PageVisibilityGate`, `SessionGuard`, `packages/client`, `packages/ui`, `apps/api`; the Weighing and Invoice sections. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. |
| M7 | This slice changes application code. `CLAUDE.md` therefore requires a **fresh, independent reviewer**: a fresh agent, on the most capable model, that did not implement the change. It is given the Accepted spec, this plan once Accepted, and the branch diff. The M7 record cites that review. |

## M5 decision

**Accepted** on 2026-11-01, revision 5.

**Review history.** Four independent reviews returned the plan, each with **Request changes**: the reviews of revisions 1, 2, 3 and 4. The fifth, a fresh independent review of revision 5 on the most capable model by an agent that wrote no revision, gave **Approve**, with no blockers and no required corrections. It confirmed:
- every finding from the four earlier reviews is resolved;
- it derived the failing tests for K1–K6 itself, from the source and the tests, and they match the prediction tables exactly;
- it kept the author's stub-based shell evidence separate, and used it only to find its way.

**Owner acceptance.** The owner accepted revision 5 without reopening review for the non-blocking notes.

**What this acceptance does and does not record.**
- It records that the plan's design, scope, test matrix and break procedure are ready for M6.
- It does not record any test result: at M5, nothing had been run against this repository. Results are in the [Execution record (M6)](#execution-record-m6).
- It does not authorize M6, staging, committing, pushing, opening a PR or posting the #211 comment.

**Non-blocking review notes carried into M6.** These do not change the accepted scope, decisions, test matrix or break predictions. M6 applies them as stated and records how it did so:

1. **Refused restore.** If block R refuses to restore, the M6 stop report says explicitly that the tree is **not** restored. It lists each scoped file that differs from `$SCRATCH/baseline/`, using a read-only `cmp` per file.
2. **`.match` from the log.** M6 derives `Kn.match` from `Kn.break.log`: it extracts the failing test names, checks them and their count against the [predicted names](#break-predictions-by-test-name), and writes line 1 as exactly `MATCH` or `MISMATCH`. Block F reads line 1.
3. **Bare test names.** Matching uses the bare test name, with vitest's file and `describe` prefix removed. This includes K3's `resolves a role alongside an error`.
4. **Case 8 rows.** Case 8's `it.each` rows are `[status, roleLoading]` tuples, so `%s` gives the stated names.
5. **Literal paths in git commands.** Git pathspecs for the `[id]` file use `:(literal)`, in `at_baseline` and in any authorized `git add`, so `[id]` is not read as a pattern.
6. **Operational caution:** the in-repository guard does not resolve `..` or symbolic links. M6 uses a plain absolute scratchpad path.
7. **Operational caution:** an interrupted block P can leave `Kn.orig` without `Kn.file`. Block F then fails, and M6 stops and reports.

## Execution record (M6)

Authorized by the owner on 2026-11-01 ("m6"). Branch `feat/211-role-lookup-failure` (local only), from `main` at `e2a9704`. No commit is authorized, so the work is uncommitted.

**Scratch path (rule 2), recorded before block B:** `/tmp/claude-1000/-home-rex-Project-clensy-platform/42b1b920-c66f-450f-9944-f6b5d89e3655/scratchpad/211-breaks-20261101T075942Z`

**Task 1 (TDD).**
- Red: `pnpm --filter web exec vitest run lib/laundry-order-page.test.ts` failed 4 tests, the four `laundryRoleLookup` cases, with `TypeError: laundryRoleLookup is not a function`; 76 passed.
- Green: 80 of 80 passed.
- Not committed (Step 5).

**Task 2 (TDD).**
- Step 3, on the unchanged page: cases 1–5 failed with `expected +0 to be 1` (no alert rendered). Cases 6–10 and every existing test passed: 5 failed and 108 passed of 113. This matches the plan.
- Step 5: the focused files passed 193 of 193, and `pnpm --filter web test` passed 57 files and 2543 tests, with no jsdom timeout.

**Break runs (Steps 6–8).**
- Block B printed `BASELINE-OK`.
- Each break ran as block P (`READY`), then its edit, then block R (`RESTORED-VERIFIED`, `AFTER-RESTORE PASS`), then the match.
- Every break's failing test names equal the predicted set exactly (`MATCH`), and so does its count:

| Break | Failed / passed (of 193) | Match |
| --- | --- | --- |
| K1 | 6 / 187 | MATCH |
| K2 | 13 / 180 | MATCH |
| K3 | 2 / 191 | MATCH |
| K4 | 2 / 191 | MATCH |
| K5 | 4 / 189 | MATCH |
| K6 | 4 / 189 | MATCH |

- Block F printed `FINAL-OK`, with `pnpm --filter web test` passing 57 files and 2543 tests.
- Every characterization case therefore failed under its planned break, and only because of that break.
- Logs, `.ok`, `.match` and the baseline are kept in the scratch path above. Nothing was deleted.

**M5 notes applied.**
- Note 2: `Kn.match` was derived by a script from `Kn.break.log`. It compares the bare failing names, with vitest's file and `describe` prefix removed (note 3), against the plan's prediction table, and checks the `Tests N failed` count.
- Note 4: case 8's rows are `[status, roleLoading]` tuples.
- Note 5: the generated blocks pass `:(literal)` git pathspecs to `git diff`.
- The block scripts were generated from this plan's text, with only the `SCRATCH` literal, `N` and the pathspec changed. They are kept in `211-m6-scripts/` beside the scratch path.

**Step 9.** No commit: commits are not authorized. The five files are uncommitted on the local branch.

**Task 3.**
- Step 1, gates, each exit 0:
  - `pnpm --filter web lint`;
  - `pnpm --filter web exec tsc --noEmit`;
  - `pnpm --filter @clensy/web test` (418 passed);
  - `pnpm --filter @clensy/web lint`;
  - `pnpm --filter @clensy/web build`.

  `pnpm --filter web test` ran in block F.
- Step 2, scope: `git diff --name-only main` lists exactly the five planned files, and the only untracked file is this plan. No file is under the forbidden paths.
- Step 3, browser check: **passed** on the fourth attempt, the owner-approved webpack run (`next dev --webpack -p 3001`). The details are under "Final controlled attempt" below.
  - **Deviations:**
    - The orders were opened by URL after an in-app navigation to the list, because the list's drawer has no link to the order page yet (#161).
    - The dev server used webpack, because Turbopack failed in this environment.
  - **Not tested:** screen-reader announcement. Only the `role="alert"` attribute was observed.

  History of the attempts:
  - At first the check was blocked. The app on port 3001 is the `clensy-platform-web-1` Docker container, a built image (`pnpm start`) that does not mount this working tree, and the API allows only that origin (`WEB_ORIGIN`). The check needed the owner's approval to stop that container and run this branch's dev server, and to add an OPS_MANAGER account. Weighed and Paid orders already existed.

  The owner then approved the setup (2026-11-01). Attempts and outcome:
  - Created one test account, `m6-211-ops@example.test` (OPS_MANAGER), through the API's `createAdmin` mutation as the seeded owner. Existing Weighed and Paid orders are used; no order was created.
  - Stopped `clensy-platform-web-1` and ran `pnpm --filter web dev` (port 3001) from this branch. Turbopack failed to resolve modules, including `react`, `node:process` and Next.js's own `dist` files, so `/login` returned 500.
  - Moved the stale `apps/web/.next` cache aside, without deleting it, and retried. The same errors followed.
  - Stopped there and restored the environment: the dev server is stopped, the original `.next` cache is back in place (the cache from the attempt is kept in the session scratchpad), and `clensy-platform-web-1` is restarted (`/login` 200).
  - The owner then approved one retry with the shell sandbox disabled. The original `.next` was backed up first. The result was the same: 513 "Module not found" errors, and `/login` returned 500. So the sandbox is not the cause; the failure is Turbopack's dev build against this install. After three attempts, work stopped:
    - the dev server is stopped;
    - the original `.next` is restored, and `diff -rq` against the backup shows it identical;
    - `clensy-platform-web-1` is restarted (`/login` 200).
  - Final controlled attempt with webpack, approved by the owner (2026-11-01), and **passed**:
    - **Setup.** Stopped `clensy-platform-web-1`. Moved the original `apps/web/.next` to the session scratchpad, without overwriting anything. Ran `next dev --webpack -p 3001` from this branch: Next.js 16.3.1 (webpack), ready in 285 ms, `/login` 200, 0 "Module not found" errors.
    - **Session.** Signed in as `m6-211-ops@example.test` (OPS_MANAGER) through the login form, and landed on `/app`.
    - **Interception.** A Playwright route on `http://localhost:3000/graphql` with the plan's handler: it aborts only a readable POST whose `operationName` is `CurrentAdmin` (`route.abort('failed')`) and continues everything else. On the Weighed order load it aborted 2 `CurrentAdmin` requests and passed 2 others. There was no redirect to `/login`.
    - **Weighed order `c9b4a1cc-…`, failed lookup.**
      - Header, progress and summary render.
      - Exactly 1 element has the text "Unable to load your account.": a `P` with `role="alert"` and class `text-sm text-red-600`. Its previous sibling is the summary `DL`, its next sibling is `NAV aria-label="Order sections"`, and it is inside no section.
      - It is the only `role="alert"` and the only `.text-red-600` text on the page.
      - The Actions, Services and Price bodies are empty, and Actions has 0 buttons.
      - Screenshot: `.playwright-mcp/m6-211-weighed-failed.png`.
    - **Paid order `6b5c8992-…`, failed lookup.**
      - Exactly 1 alert, with the same `role`, siblings and placement.
      - Price shows its final price ("Final price … Order total ₱37.50"), and Services shows "Services are locked because this order has been priced.".
      - The Actions body is empty, with 0 buttons.
    - **Recovery.**
      - Removed the route, then navigated in the app with "Back to laundry orders" to `/app/laundry`, a pathname change that runs `SessionGuard`'s check. The list's drawer has no link to the order page (#161 owns that cutover), so the two orders were then loaded by URL.
      - Weighed: no alert text, no `role="alert"`, and Actions shows exactly ["Cancel order", "Reject order"].
      - Paid: no alert text, no `role="alert"`, and Actions shows exactly ["Start processing", "Refund order"].
      - Screenshot: `.playwright-mcp/m6-211-weighed-recovered.png`.
    - **Console.** A `favicon.ico` 404, and the 4 deliberately aborted `CurrentAdmin` requests (`net::ERR_FAILED`). Nothing else.
    - **Observable checks only.** `role="alert"` is present. Screen-reader announcement was not tested.
    - **Restore.**
      - Closed the browser and stopped the dev server.
      - Moved the webpack `.next` to the scratchpad as a diagnostic, and moved the original `.next` back. `diff -rq` against the backup shows it identical.
      - Restarted `clensy-platform-web-1`, which returns `/login` 200.
      - `git status` is unchanged: the five files and the untracked plan.
      - All diagnostic caches are kept in the session scratchpad.
    - **Incident.** The Playwright tool echoes a script's source into its output, so the test account's password appeared once in this session's tool output, though in no report or repository file. The owner should rotate or remove `m6-211-ops@example.test`, which was left in place as instructed.

**Deviations.**
- Browser recovery opened the two orders by URL after the in-app navigation to the list, because the list's drawer has no link to the order page yet (#161).
- The dev server ran with `--webpack`, because Turbopack failed in this environment.
- There are no other deviations from the plan's tasks, decisions or predictions.

## M7 decision

**Accepted** on 2026-11-01. A fresh, independent reviewer on the most capable model, which neither implemented this change nor wrote this plan, reviewed the uncommitted working-tree diff against `main` (`e2a9704`) together with this plan. It had the Accepted spec and the Accepted plan, as `CLAUDE.md` requires. This is not a self-review.

- **Verdict: APPROVE.** No blockers, and no required code corrections.
- **Required record corrections**, all made in this plan:
  1. The Status row and [Verification](#verification) no longer say that nothing has been run.
  2. The browser-check entry now opens with its outcome.
  3. This M7 record.
- **Conformance.**
  - Decisions a–g and the Task 1 and Task 2 snippets are implemented as written.
  - `git diff --name-only main` lists exactly the five planned files.
  - `roleResolved={role !== undefined}` and Actions' `role === undefined ? null : …` are unchanged.
  - The order loading and error returns still render before the alert.
- **Typing.** `laundryRoleLookup`'s `error: unknown` accepts Apollo 3.14's `ApolloError | undefined`, and the generated `Role` type is assignable to `string | undefined`.
- **Tests.**
  - The tests are isolated: `beforeEach` resets `roleError` and `roleLoading`, and the failed and loading helpers clear the `TENANT_OWNER` default.
  - The `it.each` titles produce the names in [Test names](#test-names), and case 8 uses `[status, roleLoading]` tuples.
- **Break-run evidence, checked independently.**
  - For K1–K6, the failing names in each `Kn.break.log` are identical to `predicted-Kn.txt`, with counts 6, 13, 2, 2, 4 and 4.
  - Every failure is an assertion error caused by its break.
  - Each `Kn.ok` digest, `Kn.file` target and `Kn.after.log` (193/193) is valid.
  - The current tree equals the baseline: the hashes, `git diff HEAD` against `baseline.patch`, and `baseline.head` (`e2a9704`) all match.
  - The TDD red runs of Tasks 1 and 2 are consistent with the code and the K6 results, but no logs were kept, so they could not be re-checked from artifacts.
- **Validation re-run by the reviewer**, all passing:
  - focused tests: 193/193;
  - `pnpm --filter web test`: 57 files, 2543 tests;
  - `pnpm --filter web lint`;
  - `pnpm --filter web exec tsc --noEmit`;
  - `pnpm --filter @clensy/web test`: 418 tests;
  - `pnpm --filter @clensy/web lint`;
  - `pnpm --filter @clensy/web build`.

  `git status` was unchanged after the review.
- **Browser evidence, with two qualifications:**
  1. The screenshots (`m6-211-weighed-failed.png`, `m6-211-weighed-recovered.png`) support the **Weighed** results:
     - with the lookup failed, one red alert between the summary and the section links, and empty Services, Price and Actions;
     - after recovery, no alert, and "Cancel order" and "Reject order".
  2. The **Paid** results rest on the recorded page checks only, with no screenshot:
     - with the lookup failed, one alert, the final price and the locked Services sentence;
     - after recovery, "Start processing" and "Refund order".

  The recorded deviations stand: orders opened by URL (#161), and the webpack dev server. **Screen-reader announcement was not tested.**
- **Security and authorization.** The change is UX only, and the API stays authoritative. A failed lookup shows fewer controls, never more. The `text-sm text-red-600` alert matches the existing page-level alerts, at about 4.8:1 contrast on white.
- **Non-blocking notes:**
  - no unit test re-renders from failed to resolved; only the browser run covered recovery;
  - no unit case for `error: null`, which Apollo 3 cannot produce;
  - the sidebar and user menu are empty during a failed lookup, which is existing behavior outside this slice;
  - the task checkboxes are left unchanged, as in the #165 plan.
- **Security concerns for the owner, outside the code:**
  - The OPS_MANAGER test account `m6-211-ops@example.test` is still active. Its password appeared once in a session tool output and is stored in plain text in two session scratchpad files. Disable or remove the account, or rotate its password, and delete those files.
  - Older, gitignored `.playwright-mcp/*.yml` snapshots from October contain the seeded demo account's password, which predates this slice.
- **Deferred decisions, unchanged:**
  - the #211 clarification comment, which needs owner approval;
  - a retry control;
  - Weighing's read-only view on `RECEIVED` during a failed lookup;
  - the same English string in two catalogs.
- **Next gate: M8, Refactoring.** The slice is **Ready for M8**. Committing, pushing or opening the PR, and posting the #211 comment each still need the owner's separate, explicit authorization. This acceptance grants none of them.

## M8 — Not applicable

Recorded on 2026-11-01. The owner directed M8 through M10 ("m8-m10"), and M7 had approved the change.

No refactoring: neither the M7 reviewer nor M6 found a maintainability issue that needed it. The change is three small additions:
- one pure function with its type;
- one catalog key;
- one conditional `<p>` and the `error` read in the page.

They follow existing patterns. The M7 non-blocking notes are test-coverage observations, not structural problems. No code changed for M8.

## M9 — Documentation (2026-11-01)

**Scope:** `apps/web/README.md` and this plan. Each change follows from the M7-approved implementation, which is uncommitted on `feat/211-role-lookup-failure`. Project policy documents approved but unmerged work through the plan record.

**`apps/web/README.md`, content:**
- A new **Role lookup (#211)** entry in the order-page section covers:
  - the three states of `laundryRoleLookup` and their precedence;
  - the one page-level alert: its markup, its `laundry.error.account` copy, its placement between the summary `dl` and the section nav, and that it shows for any status, never inside a section, and never with the order's own loading or error state;
  - that the section bodies are unchanged;
  - that there is no alert while the role loads or once it resolves;
  - recovery after a later successful `currentAdmin` read;
  - that the gate and `SessionGuard` are unchanged.
- The Services **Hidden** bullet, the Price view order, the Actions sentence and the Current section sentence said "while the role loads". They now say "while no role is available (still loading, or the lookup failed)", which matches the shipped behavior.

**`docs/features/laundry.md`:** checked and not changed. It describes the API, the transitions and the list of screens, not role handling on the page.

**This plan:** the Status row, the M8, M9 and M10 rows, and these records.

**Editorial checks:**
- The new relative plan link resolves from `apps/web/`.
- The README's heading lines are identical to `main`'s.
- No stale "role loads" or "loading role" wording is left, apart from one deliberate comparison in the new entry.
- Terms follow the spec and the copy catalog: Actions, Services, Price, Weighing, Invoice and payment, "Unable to load your account.".
- This plan's internal anchors resolve.

## M10 — Not applicable

No workflow asset under `docs/workflows/`, and no installer-managed file (`workflow.yaml`, `.claude/skills/`), changed.

## Slice Completion Report (M8–M10)

| Field | Result |
| --- | --- |
| Slice | #211: laundry order page, one page-level alert when the role lookup fails |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/211 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** (revision 5) |
| M6 | **Complete** (uncommitted) |
| M7 | **Approved** (fresh independent review) |
| M8 | **N/A** |
| M9 | **Complete** |
| Branch | `feat/211-role-lookup-failure` (local only) |
| PR | None: commit, push and PR are not yet authorized |
| Status | **Ready for closeout** (needs the owner's authorization to commit, push and open the PR) |

### Shipped

- When the current admin's role lookup fails and no role is available, the laundry order page shows "Unable to load your account." once, as a page-level alert between the summary and the section links, for any order status.
- Loading, no-permission and with-permission behavior is unchanged, and so are Weighing and Invoice and payment.
- `apps/web/README.md` documents the behavior.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: `web` 57 files, 2543 tests; `@clensy/web` 418 tests; K1–K6 MATCH (M6; re-run at M7) |
| Typecheck | **Passed** |
| Lint | **Passed** |
| Build | **Passed** |
| Package validation | **Passed**: browser check (webpack dev server, Playwright) |

### Next Gate

**Closeout:** commit, push, open the PR, then merge.

Each step needs the owner's explicit authorization. Posting the #211 clarification comment is a separate decision.

## Revision 5 changes

Each row answers one finding from the fresh independent M5 review of revision 4 (2026-11-01).

| Finding | Change in revision 5 |
| --- | --- |
| **Blocker 1** Case 6 kept the default total, so K6 could not fail it | Case 6 sets `RECEIVED` (`weightGrams: null`, `totalMinorUnits: null`), `WEIGHED` (`totalMinorUnits: null`) and `PAID` (the default total), and says why: both helpers check the total first. K6 now predicts two of the three case 6 tests, and K5 all three, by exact name. |
| **R1** Block R could restore the wrong file | A fixed `target_for` mapping in every block. Block P records the target in `Kn.file`. Before writing anything, block R checks four things: the recorded target equals the mapped one, the backup equals the verified baseline copy, every other scoped file is at the baseline, and no `Kn.ok` exists. Any failure refuses the restore before a file is written. |
| **R2** A fixed scratch path could block a later or second run | `SCRATCH` is now the placeholder `__M6_SCRATCH__`. M6 replaces it with an absolute path under its own scratchpad, with a run suffix, recorded before block B (rule 2). A retry needs owner approval and a new suffix. Nothing is deleted or reused. |
| **R3** Block R could stop between its two lines | The after-restore failure prints `Kn AFTER-RESTORE FAIL` and exits with no `Kn.ok`. Rule 7 covers it. |
| **R4** Block F's completion check proved nothing | Block R writes `Kn.ok`, holding the break and the hash of the baseline hash file, only after the after-restore run passes. Block F requires all six to be valid, plus a `MATCH` in each `Kn.match`, plus each `Kn.file` and `Kn.orig` valid. |
| **N1** Prediction granularity | New [Test names](#test-names) table. [Break predictions by test name](#break-predictions-by-test-name) lists the exact failing names for K1–K6. |
| **N4** Case 9 | The `WEIGHED` renders set `totalMinorUnits: null` in the case itself. |
| **N5** `baseline/` | Rule 4 says it holds verified copies of all five scoped files, re-checked before use. |
| **N6** Status wording | "Nothing has been run against this repository." Source-level inspection and shell-mechanics runs are named separately. |
| Adversarial review | Interrupted runs (block P refuses while a break has `Kn.file` but no `Kn.ok`), a commit made mid-run (`baseline.head`) and a target left unchanged are handled. The full refusal list is under [Break runs](#break-runs). |

## Revision 4 changes

Each row answers one finding from the fresh independent M5 review of revision 3 (2026-11-01).

| Finding | Change in revision 4 |
| --- | --- |
| **Blocker 1** Case 7 kept the default role, so K4 could not make it fail | Case 7 uses the Failed setup (`role = undefined`, `roleError`) and says why it must clear the `beforeEach` role (`:205`). It states its exact assertions for both order states, and that `roleLookup` is computed before the early returns. K4's prediction says why no existing test fails. |
| **Blocker 2** `$SCRATCH` had no value, and shell variables do not persist | [Break runs](#break-runs) is rewritten as four self-contained blocks, B, P, R and F. Each starts with a preamble: `set -euo pipefail`, a concrete absolute `SCRATCH` under this session's scratchpad, `: "${…:?}"` guards, a refusal when `SCRATCH` is inside the repository, and a quoted `[id]` path. Block P checks the baseline copies, the hashes, the diff and the status, and that `Kn.orig` is new, before any edit. The mechanics were exercised in a throwaway repository only. |
| **R1** Restore and verify before any stop | Block R always restores and verifies before the stop decision. Rule 6 says what to do if it exits early (stop, touch nothing) and what to do if a prediction mismatches (stop, with the tree already restored). |
| **R2** Authorization wording | The Commits and Branch rows, the Tasks line, Task 1 Step 5 and new Task 2 Step 9 are reworded. There are two commits, Task 1 and Task 2, only if authorized and only after block F passes. Task 3 makes no commit. Pushing and the PR need separate approval. M6 implementation authorization covers creating the local branch; no branch is created now. |
| **R3** Scope row | "Five files: three source files and two test files." |
| **N1** Case 9 | "The same check as `:620`, but on a `PAID` order" (`:620` uses the default `AWAITING_PAYMENT`, `:53`). |
| **N2** Findings 1 and 2 | The gate renders the page at `:49`. `schema.gql` is described as generated and gitignored (`.gitignore:21`). |
| **N3** Commit timing | Commits moved to after the break runs (Task 2 Step 9). |
| **N4** Browser check | The absence of the alert during the gate's and the order's loading states is stated as not being evidence. The route handler passes through non-POST requests, unreadable or non-object bodies and every other operation. |
| **N5** `loading` flag | Decision a and the matrix intro say the page ignores `loading`, and what `roleLoading` in cases 5 and 8 does and does not show. |

## Revision 3 changes

Each row answers one finding from the fresh independent M5 review of revision 2 (2026-11-01).

| Finding | Change in revision 3 |
| --- | --- |
| **Blocker 1** No statement that the Accepted spec wins | New **Authority** row in the header, worded as in the #165 plan (`2026-10-24-laundry-lifecycle-actions-plan.md:20`): the spec wins on conflict, and names are planning decisions, not product behavior. |
| **Blocker 2** The break-run restore (`git checkout -- <file>`) would discard uncommitted Task 2 work | New **Commits** header row: commits only with the owner's recorded authorization. Task 2 now records a baseline (Step 6) before any break. [Break runs](#break-runs) restore each file from a copy taken immediately before its break and verify the whole baseline by hash, patch and `git status` comparison after every restore, then re-run the tests. Any mismatch stops M6. `git checkout` is no longer used. |
| **R1** Stale line references | The `page` object is `:61-84` (was `:60-83`). The four-role `WEIGHED` test is `:391` (was `:389`), in Finding 7 and case 9. |
| **R2** Case 6 claimed "the alert is the only difference on the page" but compared sections only | The claim is removed. Case 6 compares the five sections only. The K1 and K2 predictions (case 6 still passes) are unchanged and now consistent. |
| **R3** Case 8 applied `WEIGHED` expectations to `RECEIVED` | Case 8 states its assertions per status: `WEIGHED`, `RECEIVED` and `PAID`. |
| **R4** Browser recovery claimed buttons for any order | Recovery names the order and the exact OPS_MANAGER buttons: `WEIGHED` gives "Cancel order" and "Reject order"; `PAID` gives "Start processing" and "Refund order". It also says that other statuses differ. |
| Note: K6 wording contradicted its prediction | Reworded. The prediction is unchanged: cases 1, 2 and 6. |
| Note: "is announced" cannot be observed | Replaced by observable checks: `role="alert"` is present, and the alert appears after the page loads. Screen-reader behavior is not claimed. |
| Note: scope check and the M5 record | The scope check allows the M5 record when it is a separate file, and it covers uncommitted work too. |

Application scope (five files), decisions a–g, the ten-case matrix (apart from the case 6 sentence and the case 8 per-status assertions), and the K1–K6 edits and predictions are otherwise unchanged.

## Revision 2 changes

Each row answers one finding from the independent M5 review of revision 1 (2026-11-01).

| Finding | Change in revision 2 |
| --- | --- |
| **B1** The plan implemented the superseded three-alert design | The owner-decision row now records the page-level decision. [Decisions](#decisions) d–f describe one alert. Every three-alert reference is removed: the old decisions d and e, Task 4 cases 2–4 ("exactly 3 times", alert in Price and Actions), the browser check's "three alerts", and unresolved concern 1, which is now recorded as decided. |
| **B2** Issue AC1 was quietly reinterpreted | New section [#211 acceptance criterion 1: owner decision](#211-acceptance-criterion-1-owner-decision). It quotes the original wording, records the owner's change, and gives a proposed issue comment. M6 posts the comment only with the owner's approval. |
| **B3** Characterization tests were not labelled | The [test matrix](#page-test-matrix) labels each case **new** or **characterization**. Each characterization case names a [deliberate break](#break-runs) that must make it fail, run outside the commit, with the actual result recorded at M6. |
| **B4** A verification command did not exist, and no task had exact commands | `format:check` is removed. [Verification](#verification) lists the six commands that exist. Each task step has a focused command with an `Expected:` result. The #205 jsdom note is added. |
| **R1** Unneeded churn in the helpers | Decision c and Tasks 2–3 of revision 1 are removed. `laundryServicesView`, `laundryPriceView` and their tests are not changed. `roleResolved={role !== undefined}` and the Actions `role === undefined ? null : …` are kept as they are. |
| **R2** Placement, condition and markup were not pinned | [Decisions](#decisions) d–f pin them: after the summary `</dl>` and before `<nav aria-label="Order sections">`; shown whenever `failed`, for any status; the exact markup; never shown with the order's loading or error state. |
| **R3** Render cases for one alert | Ten page cases in the [test matrix](#page-test-matrix). |
| **R4** AC table and browser check | The [AC table](#acceptance-criteria--tests) is remapped. The [browser check](#task-3-verification-and-browser-check) intercepts by GraphQL operation name, with an expected result and a failure condition. |
| **R5** Finding 1 was wrong | [Finding 1](#findings) is corrected: `/app` and `/app/admin` fetch fresh, and the laundry list page is added. |
| Non-blocking: Task 1 copy without a failing test | Stated: render cases 1–5 fail first, and are the copy's test. |

## Findings

Inspected on `main` at `e2a9704`.

1. **Readers of the query.**
   - The `currentAdmin: CurrentAdmin!` field is non-null (`apps/api/src/schema.gql:1105`). That file is generated and gitignored (`.gitignore:21`), not tracked; the line is from the local build.
   - `packages/client` sets no `errorPolicy` (`packages/client/src/generated/graphql.ts`, `defaultOptions = {}`), so it uses Apollo's default `none`: a failed request gives `data: undefined` and sets `error`.
   - Not every reader shares the cache:
     - `apps/web/app/app/page.tsx:21` (`/app`) and `apps/web/app/app/admin/page.tsx:39` read with `fetchPolicy: 'network-only'`.
     - `SessionGuard` (`apps/web/components/layout/session-guard.tsx:55`) runs `client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' })` on mount and on every pathname change.
     - The cache-first readers are `PageVisibilityGate`, `AppSidebar`, `UserMenu`, `AppI18nProvider`, the laundry list page (`apps/web/app/app/laundry/page.tsx:181`, `:608`) and the order page (`apps/web/app/app/laundry/[id]/page.tsx:86`).
   - **Conclusion for the order page:**
     - Its cache-first read shares one cached result with the other cache-first readers.
     - A network-only read that succeeds writes to the cache and is broadcast to those watchers; a failed one writes nothing.
     - So the order page sees a failure until some read succeeds.
2. **Page access.** `PageVisibilityGate` treats `!error && loading` as loading (`page-visibility-gate.tsx:42`). With no principal, including after a failed request, it renders the page (`:49`). That is how the order page mounts with a failed lookup. Not changed.
3. **Recovery.** `SessionGuard` sends the user to `/login` only on session evidence: an `UNAUTHENTICATED` signal, or a check that settles with no principal. It ignores any other failure. If its next check succeeds (for example after navigation), it fills the cache and the order page resolves. Not changed.
4. **Order page.**
   - `page.tsx:86-87` reads only `data`: `role = adminData?.currentAdmin.role`. It discards `error`.
   - With no role, three sections render empty bodies:
     - Actions (`:236`, `role === undefined ? null : …`).
     - Services (`laundryServicesView` returns `'hidden'`, `lib/laundry-service-selection.ts:29`): `WEIGHED` with no total only. `RECEIVED` shows `beforeWeigh` for any role.
     - Price (`laundryPriceView` returns `'hidden'`, `lib/laundry-price-review.ts:29`): `RECEIVED` or `WEIGHED` with no total.
   - In both helpers, `'hidden'` arises only when the role is unresolved.
   - Weighing and Invoice show their read-only states, because `laundryOrderActions(…, undefined)` returns `[]` (`packages/web/src/laundry/laundry-order-actions.ts:127`).
   - The section nav marks no section current.
5. **Copy.**
   - "Unable to load your account." exists only as `nav.landing.error` (`apps/web/messages/en/nav.json:33`), in the app's next-intl catalog.
   - The order page translates with `useClensyTranslations('laundry')`, from the `@clensy/web` catalog (`packages/web/src/i18n/messages/en/laundry.ts`).
   - That catalog keeps its own load errors: `error.list` and `error.order` (`laundry.ts:58-61`). `staff.loadError` follows the same pattern.
   - Both catalogs are English only.
6. **Alert style.**
   - At page level, both pages that show this message use `<p role="alert" className="text-sm text-red-600">`: `/app` (`apps/web/app/app/page.tsx:32`) and admin (`apps/web/app/app/admin/page.tsx:50`).
   - Inside sections, the order page uses `text-red-600` alone, because `OrderSection`'s body wrapper supplies `text-sm` (`page.tsx:285`).
   - `ErrorState` replaces the whole page (`page.tsx:135`) and has no `role="alert"`.
7. **Tests.**
   - **Loading** is covered by `laundry-order-page.render.test.tsx`: `:372` (empty Services and Price bodies), `:644`, and #165 case 9 (`:979`).
   - **No permission** is covered: ANALYST (`:620`), and CUSTOMER_SUPPORT, FINANCE, ANALYST and SUPER_ADMIN on `WEIGHED` (`:391`).
   - **Failed is not covered.** The harness mock (`:106-108`) returns only `data`, so it cannot express a failure.
   - The interaction harness always supplies a role (`laundry-order-page.interaction.test.tsx:133`).

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| a | **Role-lookup state.** A new pure function `laundryRoleLookup({ role, error }): 'resolved' \| 'failed' \| 'loading'` in `apps/web/lib/laundry-order-page.ts`. It returns `'resolved'` when `role !== undefined`, even if `error` is set. It returns `'failed'` when there is no role and `error` is set. Otherwise it returns `'loading'`. It takes no `loading` input, so an error with no role is `'failed'` even while `loading` is true. The page never reads the query's `loading` flag. | A role that is present always wins, matching the gate's "principal wins" (`page-visibility-gate.tsx:33`), so a role retained or written later is never shown as an error. Error wins over loading, matching the gate (`:42`), so the alert does not flicker during a refetch. Pure, so it is tested on its own. |
| b | **Copy.** Add `laundry.error.account: 'Unable to load your account.'` beside `error.list` and `error.order`. Do not read `nav.landing.error`. | The page uses the `@clensy/web` catalog. Reading `nav` would mix two i18n systems in one component and tie the order page to the landing page's key. Each namespace keeps its own load errors (Finding 5). The wording is identical, as the owner decided. |
| c | **Section bodies are unchanged.** On a failed lookup, Actions, Services and Price render exactly what they render while loading: Actions `null`; Services `'hidden'` on `WEIGHED` with no total; Price `'hidden'` on `RECEIVED` or `WEIGHED` with no total. `roleResolved={role !== undefined}` (`page.tsx:216`) and `role === undefined ? null : …` (`:236`) stay as they are. | The owner decided one alert, not repeated in the sections. `roleResolved` already gives the empty bodies. Changing the helpers would be churn with no behavior change (M5 R1). |
| d | **Placement.** In `LaundryOrderWorkspace`, insert the alert after the summary `<dl>` (`page.tsx:169-178`) and before `<nav aria-label={t('order.sectionsLabel')}>` (`:180`), as a sibling in the page's `flex flex-col gap-8` column. `null` renders nothing, so there is no extra gap when the role resolves. | The header, progress and summary do not depend on the role. The section links (no `aria-current`) and every section after them degrade without a role. One alert above them all explains each empty body without changing any section. |
| e | **Condition.** Render the alert when `laundryRoleLookup({ role, error: adminError }) === 'failed'`, **for every order status**. It never renders with the order's `LoadingState` or `ErrorState`, because the early returns at `page.tsx:121-138` come first. | Actions is affected on every status: a resolved role always shows buttons or "No further actions for this order." (`laundry-order-actions.tsx:48`), and a failed lookup shows neither. So the alert is accurate even on a priced or terminal order, where Services and Price show their normal content. A condition based on status would be new, fragile semantics. |
| f | **Markup.** `<p role="alert" className="text-sm text-red-600">{t('error.account')}</p>`, inline in the workspace. No new component and no `ErrorState`. | Matches `/app` and admin (Finding 6). The alert sits outside `OrderSection`'s `text-sm` wrapper, so it needs `text-sm` itself. It renders once, so it needs no component. |
| g | **Unchanged.** Weighing, Invoice and payment, `aria-current` in the section nav, the page lock, `laundryOrderActions`, the gate, `SessionGuard`, `packages/client`, `AppI18nProvider`. | Owner boundaries. |

## #211 acceptance criterion 1: owner decision

**Original wording (issue #211, unchanged):**

> When the `currentAdmin` query fails, the Actions section shows an explicit, non-empty message instead of rendering nothing. Wording and placement follow existing copy and patterns, and the copy lives in the message catalog.

**Owner decision, 2026-11-01:**
- The explicit message is shown **once, at page level**, after the order summary boxes and before the section links, **not inside the Actions section**.
- The Actions body stays empty on a failed lookup, as it is while the role loads.
- The page-level alert explains why Actions, and any other section that needs the role, has no content.
- The wording ("Unable to load your account.") and its place in the message catalog (`laundry.error.account`) satisfy the rest of the criterion.

This plan does **not** claim that the original criterion asked for a page-level alert. It records that the owner changed where the message appears. No new Actions-specific message is added; that would be new copy.

**Proposed clarification comment for #211.** Draft only. Do not post without the owner's approval. If approved, M6 posts it with `gh issue comment 211`:

> **Clarification (owner decision, 2026-11-01).** Acceptance criterion 1 asked for an explicit message *in the Actions section* when the `currentAdmin` query fails. The owner changed the presentation: when the lookup fails and no role is available, the page shows **one** alert, "Unable to load your account.", after the order summary and before the section links. The alert is not repeated inside Actions, Services or Price. The Actions, Services and Price bodies stay as they are while the role loads, and the single alert explains why they are empty. Behavior with a resolved role is unchanged, including "No further actions for this order." for a role with no actions. The other acceptance criteria are unchanged. Plan: `docs/superpowers/plans/2026-11-01-laundry-role-lookup-failure-plan.md`.

## File map

| File | Change |
| --- | --- |
| `packages/web/src/i18n/messages/en/laundry.ts` | Add `error.account: 'Unable to load your account.'` (decision b). |
| `apps/web/lib/laundry-order-page.ts` | Add `export type LaundryRoleLookup = 'failed' \| 'loading' \| 'resolved'` and `laundryRoleLookup` (decision a). |
| `apps/web/lib/laundry-order-page.test.ts` | Add a `describe('laundryRoleLookup')` block (Task 1). |
| `apps/web/app/app/laundry/[id]/page.tsx` | Read `error` from `useCurrentAdminQuery()`, compute the lookup, and insert the alert (decisions d–f). No other line changes. |
| `apps/web/lib/laundry-order-page.render.test.tsx` | Mock fields `page.roleError` and `page.roleLoading`, reset in `beforeEach`. Ten page cases (Task 2). |

No other file changes. Task 3 checks this scope.

## Tasks

TDD. Task 1 and Task 2 each have one commit, **only if commits are authorized** (see **Commits**). Both commits are made together in Task 2 Step 9, after the break runs pass. Task 3 makes no commit.

### Task 1: Role-lookup state

- [ ] **Step 1: Failing tests.** In `apps/web/lib/laundry-order-page.test.ts`, add `describe('laundryRoleLookup')` with these cases:
  - `{ role: 'TENANT_OWNER', error: undefined }` gives `'resolved'`.
  - `{ role: 'ANALYST', error: new Error('x') }` gives `'resolved'`.
  - `{ role: undefined, error: new Error('x') }` gives `'failed'`.
  - `{ role: undefined, error: undefined }` gives `'loading'`.
- [ ] **Step 2: Run** `pnpm --filter web exec vitest run lib/laundry-order-page.test.ts`. Expected: FAIL, because `laundryRoleLookup` is not exported.
- [ ] **Step 3: Implement** in `apps/web/lib/laundry-order-page.ts`:

  ```ts
  // #211: whether the current admin's role is available. A role that is
  // present wins, even beside an error (retained or later data); an error
  // with no role is a failed lookup, even while a refetch is loading
  // (the page-visibility gate's precedence); otherwise it is still loading.
  export type LaundryRoleLookup = 'failed' | 'loading' | 'resolved';

  export function laundryRoleLookup({ error, role }: { error: unknown; role: string | undefined }): LaundryRoleLookup {
    if (role !== undefined) return 'resolved';
    return error === undefined || error === null ? 'loading' : 'failed';
  }
  ```

- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: No commit yet.** Leave Task 1 uncommitted. Its commit, if authorized, is made in Task 2 Step 9, after the break runs.

### Task 2: Copy and the page-level alert

- [ ] **Step 1: Harness.** In `laundry-order-page.render.test.tsx`:
  - Add `roleError: undefined as Error | undefined` and `roleLoading: false` to `page` (`:61-84`).
  - Reset both in `beforeEach` (`:188-206`).
  - Change the mock (`:106-108`) to return `{ data: page.role === undefined ? undefined : { currentAdmin: { role: page.role } }, error: page.roleError, loading: page.roleLoading }`.
  - Add the constants:

    ```ts
    const ACCOUNT_ALERT = '<p role="alert" class="text-sm text-red-600">Unable to load your account.</p>';
    const ACCOUNT_TEXT = 'Unable to load your account.';
    const SUMMARY_END_TO_NAV = `</dl>${ACCOUNT_ALERT}<nav aria-label="Order sections">`;
    ```

  The existing tests keep their meaning: with `roleError` undefined, `role: undefined` is still loading.
- [ ] **Step 2: Add the ten cases** from the [test matrix](#page-test-matrix) in a new `describe('order page role-lookup failure (#211)')`.
- [ ] **Step 3: Run** `pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx`. Expected, on the unchanged page:
  - cases 1–5 (**new**) FAIL, because the alert is not rendered;
  - cases 6–10 (**characterization**) PASS;
  - every existing case PASSES.

  Record which cases failed and which passed.
- [ ] **Step 4: Implement.**
  - **Copy:** in `packages/web/src/i18n/messages/en/laundry.ts`, add `account: 'Unable to load your account.'` to `error` (alphabetical, before `list`). Render cases 1–5 are the copy's failing test.
  - **Page:** in `page.tsx`, replace `const { data: adminData } = useCurrentAdminQuery();` with `const { data: adminData, error: adminError } = useCurrentAdminQuery();`.
  - Add `const roleLookup = laundryRoleLookup({ error: adminError, role });` after `role`, with this comment:

    ```ts
    // #211, owner decision 2026-11-01: a failed lookup with no role shows one
    // page-level alert; Actions, Services and Price stay as they are while the
    // role loads.
    ```

  - Insert between the summary `</dl>` and `<nav …>`:

    ```tsx
    {roleLookup === 'failed' ? (
      <p role="alert" className="text-sm text-red-600">
        {t('error.account')}
      </p>
    ) : null}
    ```

  - Import `laundryRoleLookup` from `../../../../lib/laundry-order-page`, as the existing imports from that module are written.
- [ ] **Step 5: Run** the same command, then `pnpm --filter web test`. Expected: PASS. [#205](https://github.com/rexescario-dev/clensy-platform/issues/205) records intermittent jsdom timeouts in the interaction suite. If one occurs, record the failing test and the re-run result, and do not raise the timeout in this slice.
- [ ] **Step 6: Scratch path and baseline.** Choose `SCRATCH` and record it in the M6 record ([Break runs](#break-runs), rule 2). Then run [block B](#block-b-baseline-once-per-run). Expected: `BASELINE-OK`. Nothing is committed yet, so the baseline holds the uncommitted Task 1 and Task 2 work.
- [ ] **Step 7: [Break runs](#break-runs)** K1–K6, in order, one at a time, each as block P, then the edit, then block R. No break edit is ever staged or committed. After each block R, compare the failing test names in `$SCRATCH/Kn.break.log` with the [predicted names](#break-predictions-by-test-name), and record the match in `$SCRATCH/Kn.match` (`MATCH` or `MISMATCH` plus the difference). A mismatch stops M6.
- [ ] **Step 8: Final check.** Run [block F](#block-f-final-check). Expected: `FINAL-OK`. Block F also requires `MATCH` in all six `Kn.match` files.
- [ ] **Step 9: Commits, only if authorized.** Only after Step 8 printed `FINAL-OK`, and every break's failing cases matched its prediction. Commit Task 1's two files: `git add -- apps/web/lib/laundry-order-page.ts apps/web/lib/laundry-order-page.test.ts`, then `feat(211): role-lookup state for the laundry order page`. Then commit Task 2's three files: `git add -- packages/web/src/i18n/messages/en/laundry.ts 'apps/web/app/app/laundry/[id]/page.tsx' apps/web/lib/laundry-order-page.render.test.tsx`, then `feat(211): one page-level alert when the role lookup fails`. Without authorization, nothing is staged, and the record says so. Never push or open a PR without the owner's separate approval.

### Task 3: Verification and browser check

- [ ] **Step 1: Gates.** Run each command in [Verification](#verification) and record the actual output.
- [ ] **Step 2: Scope check.** `git diff --name-only main` (committed and uncommitted changes against `main`) together with `git ls-files --others --exclude-standard` (untracked files) lists only the five files in the [File map](#file-map), this plan, and the M5 record if it is kept as a separate file. In particular it lists nothing under `apps/web/lib/laundry-service-selection*`, `apps/web/lib/laundry-price-review*`, `apps/web/components/layout/`, `packages/client/`, `packages/ui/` or `apps/api/`.
- [ ] **Step 3: Browser check.** Use the `run` / ui-ux verification skill, on a seeded tenant, signed in as OPS_MANAGER, with a `WEIGHED` order (no total) and a `PAID` order.
  1. **Intercept by operation name.** All GraphQL operations share one endpoint (`packages/client/src/apollo-client.ts:11`, `NEXT_PUBLIC_API_URL` or `http://localhost:3000/graphql`), so blocking by URL would also fail the order query. Route the GraphQL URL with a handler that aborts **only** a readable POST for `CurrentAdmin`, and passes everything else through (CORS preflight `OPTIONS`, other methods, an unreadable or non-JSON body, an array body, and every other operation):

     ```ts
     await page.route(GRAPHQL_URL, async (route) => {
       const request = route.request();
       let body: unknown = null;
       if (request.method() === 'POST') {
         try {
           body = request.postDataJSON();
         } catch {
           body = null;
         }
       }
       const isCurrentAdmin =
         body !== null && typeof body === 'object' && !Array.isArray(body) && (body as { operationName?: unknown }).operationName === 'CurrentAdmin';
       if (isCurrentAdmin) await route.abort('failed'); // a network error
       else await route.continue();
     });
     ```
 Do **not** return an `UNAUTHENTICATED` GraphQL error: that raises the session signal and `SessionGuard` redirects to `/login`.
  2. **Install the route before loading.** Install it before navigation, then load `/app/laundry/<weighed-id>` directly, so no earlier success sits in the Apollo cache.
  3. **Expected:**
     - The URL stays on the order page, with no redirect to `/login`.
     - The order header, progress and summary render.
     - Exactly one element with the text "Unable to load your account." exists. It has `role="alert"`, and sits after the summary and before the section links. This check confirms the `role="alert"` attribute only; screen-reader announcement is not verified or claimed. The page-visibility gate's loading state shows first (`/app/laundry/<id>` is a gated path, `page-visibility-gate.tsx:42-47`), then the order's loading state. Neither renders the order sections, so the alert's absence while they show is **not** evidence. The evidence is the order page after it renders: one alert, in the place stated.
     - The Actions, Services and Price bodies are empty, with no buttons in Actions and no other red alert on the page.
     - Repeat on the `PAID` order: one alert, and Price shows its normal content.
  4. **Recovery.** Remove the route, then navigate through the app (back to the list, then open an order). Recovery comes from `SessionGuard`'s network-only check on the pathname change (`session-guard.tsx:55`), or from the new workspace's own read. Expected, signed in as OPS_MANAGER:
     - on the `WEIGHED` order: no alert, and Actions shows exactly "Cancel order" and "Reject order";
     - on the `PAID` order: no alert, and Actions shows exactly "Start processing" and "Refund order".

     Other statuses offer other buttons, or "No further actions for this order." (for example `CANCELLED`). They are not used for this check.
  5. **Failure conditions (any one fails the check):**
     - zero alerts, or more than one;
     - the alert inside a section, or after the section links;
     - a redirect to `/login`;
     - "Unable to load laundry order." shown, which means the order query was blocked too and the interception is wrong;
     - any button in Actions while the lookup has failed;
     - an alert after recovery, or Actions on the two named orders not showing exactly the buttons listed in step 4.
  6. **Evidence.** Record screenshots or a GIF path. If the stack cannot be started, record that, and do not claim the check.

## Page test matrix

All ten cases go in `laundry-order-page.render.test.tsx`. "Failed" means `role = undefined` and `roleError = new Error('network')`. "Loading" means `role = undefined` and `roleError = undefined`. The page never reads the query's `loading` flag (decision a). Setting `roleLoading` in cases 5 and 8 therefore confirms that the flag is ignored; it does not mean the flag shows or hides the alert. Each case is labelled **new** (it fails on the unchanged page) or **characterization** (it passes on the unchanged page and is proved by a [break run](#break-runs)).

| # | Kind | Setup | Assertions |
| --- | --- | --- | --- |
| 1 | new | Failed; `WEIGHED`, `totalMinorUnits: null` | `count(html, ACCOUNT_TEXT) === 1`. `html` contains `SUMMARY_END_TO_NAV`, which shows the exact markup and that it sits after the summary and before the section links. None of `section(html, 'actions' \| 'services' \| 'price')` contains `ACCOUNT_TEXT`. The Services and Price bodies match `/<\/h2><div[^>]*><\/div><\/section>$/`, as at `:381`. Actions has no `<button` and no "No further actions for this order.". There is no `aria-current="true"`, and `page.previewQuery` was not called. |
| 2 | new | Failed; `RECEIVED`, `weightGrams: null`, no total | `count(html, ACCOUNT_TEXT) === 1` and `SUMMARY_END_TO_NAV` present. Services contains "Weigh the order before choosing services.". The Price body is empty (same regex). Weighing contains "Not weighed yet." and no `<input`. No section contains `ACCOUNT_TEXT`. |
| 3 | new | Failed; `PRICED` with a total and lines | One alert, at `SUMMARY_END_TO_NAV`. Services shows the locked sentence. Price shows the Final card ("Final price"). Invoice has no `<button`. No section contains `ACCOUNT_TEXT`. |
| 4 | new | Failed; `CANCELLED`, `totalMinorUnits: null` | One alert, at `SUMMARY_END_TO_NAV`. Price contains "This order was not priced.". Actions has no `<button`. |
| 5 | new | `role = undefined`, `roleError` set, **`roleLoading = true`**; `WEIGHED` | One alert, at `SUMMARY_END_TO_NAV`. This pins the precedence: an error with no role is failed, and `roleLoading = true` does not change that. |
| 6 | characterization | For each of `RECEIVED` (`weightGrams: null`, `totalMinorUnits: null`), `WEIGHED` (`totalMinorUnits: null`) and `PAID` (the fixture's default total, 45000): render loading, then failed. The fields are set explicitly because both helpers check the total before the role (`laundry-service-selection.ts:26`, `laundry-price-review.ts:27`), so the default total would hide any change in Services and Price. | `section(html, 'weighing')` and `section(html, 'invoice')` are **byte-identical** between the two renders. Actions, Services and Price are also byte-identical between the two renders. Only these five sections are compared; the case makes no claim about the rest of the page. |
| 7 | characterization | **Failed** (`role = undefined`, `roleError = new Error('network')`; `beforeEach` sets `page.role = 'TENANT_OWNER'` at `:205`, so the case must clear it) plus (a) `orderError = new Error('boom')`, or (b) `orderLoading = true` | (a) Contains "Unable to load laundry order." (the `ErrorState` at `page.tsx:132-138`), has no `<section`, and `ACCOUNT_TEXT` is absent. (b) Contains `role="status"` (the `LoadingState` at `page.tsx:121-128`, as at `:744`), has no `<section`, and `ACCOUNT_TEXT` is absent. `roleLookup` is `'failed'` in both, and it is computed before the early returns (Task 2 Step 4, after `role` at `page.tsx:87`). Both pass on the unchanged page and after the implementation, because the early returns render first. |
| 8 | characterization | Loading, for each of `WEIGHED` (`totalMinorUnits: null`), `RECEIVED` (`weightGrams: null`, no total) and `PAID` (the fixture's default total), with `roleLoading` `true` and with `roleLoading` `false` | **Every status:** `ACCOUNT_TEXT` absent; Actions has no `<button` and no "No further actions for this order.". **`WEIGHED`:** the Services and Price bodies match the empty-body regex (as at `:372`/`:381`). **`RECEIVED`:** Services contains "Weigh the order before choosing services." (any role, `laundry-service-selection.ts:34`); the Price body is empty. **`PAID`:** Services contains "Services are locked because this order has been priced."; Price contains "Final price" (as at `:462`). The existing tests at `:372`, `:644` and `:979` are left unchanged. |
| 9 | characterization | Resolved without permission: ANALYST on `PAID` (the same check as `:620`, but on a `PAID` order: `:620` uses the fixture default `AWAITING_PAYMENT`, render test `:53`); CUSTOMER_SUPPORT, FINANCE, ANALYST and SUPER_ADMIN on `WEIGHED` with `totalMinorUnits: null` set in this case (the same check as `:391`) | `ACCOUNT_TEXT` absent. ANALYST: Actions contains "No further actions for this order.". On `WEIGHED`: Services contains "No services selected yet.", and Price contains "Price is available after the order is weighed and services are chosen.". |
| 10 | characterization | Resolved with permission: TENANT_OWNER on `PAID`, (a) `roleError` undefined, (b) `roleError` set (a role retained alongside an error) | In both, `ACCOUNT_TEXT` is absent, and Actions contains the buttons `Start processing` and `Refund order` (`laundry.ts:21`, `:19`); #165 cases 4 and 5 show the same labels for SCHEDULER and FINANCE on `PAID`. |

### Test names

Each test has a unique name that carries its case number and setup, so a break run's log can be matched to its prediction by name. They are placed in `describe('order page role-lookup failure (#211)')`, so vitest prints each as `order page role-lookup failure (#211) > <name>`.

| Case | Exact test name(s) |
| --- | --- |
| 1 | `case 1: failed WEIGHED shows one alert before the section links` |
| 2 | `case 2: failed RECEIVED shows one alert and keeps Weighing and Services` |
| 3 | `case 3: failed PRICED with a total shows one alert and the final price` |
| 4 | `case 4: failed CANCELLED without a total shows one alert` |
| 5 | `case 5: failed WEIGHED roleLoading=true shows one alert` |
| 6 | `it.each` over `RECEIVED`, `WEIGHED` and `PAID`, titled `case 6: %s sections match loading`: `case 6: RECEIVED sections match loading`, `case 6: WEIGHED sections match loading`, `case 6: PAID sections match loading` |
| 7 | `case 7a: order error wins over a failed role lookup`; `case 7b: order loading wins over a failed role lookup` |
| 8 | `it.each` over the status and `roleLoading`, titled `case 8: %s roleLoading=%s shows no alert`: the six names `case 8: WEIGHED roleLoading=true shows no alert`, `case 8: WEIGHED roleLoading=false …`, `case 8: RECEIVED roleLoading=true …`, `case 8: RECEIVED roleLoading=false …`, `case 8: PAID roleLoading=true …`, `case 8: PAID roleLoading=false …` (each ending `shows no alert`) |
| 9 | `case 9: ANALYST on PAID shows no alert`; `it.each` titled `case 9: %s on WEIGHED shows no alert` over `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST`, `SUPER_ADMIN` |
| 10 | `case 10a: TENANT_OWNER on PAID shows its buttons and no alert`; `case 10b: TENANT_OWNER with a retained role and an error shows no alert` |
| Task 1 | In `describe('laundryRoleLookup')`: `resolves a role without an error`, `resolves a role alongside an error`, `fails on an error without a role`, `loads with neither a role nor an error` |

## Break runs

Each characterization case must be shown to fail under a deliberate break. The breaks run in Task 2 Step 7, after the implementation passes (Step 5) and the baseline is recorded (Step 6). Nothing is committed before or during the break runs (see **Commits**), so the baseline is always the uncommitted Task 1 and Task 2 work. The procedure never uses `git checkout`, `git stash`, `git reset` or `rm`.

**Rules.**

1. **Self-contained blocks.** Each block below is a complete, separately executable script. Shell variables never carry from one agent command to the next. So every block starts with the same preamble, which:
   - sets `set -euo pipefail`;
   - defines `REPO`, `SCRATCH`, `FILES`, the break-to-file mapping `target_for` and the checks `baseline_intact` and `at_baseline`;
   - refuses an unset, placeholder, relative or in-repository `SCRATCH`.
2. **Scratch path.** M6 chooses `SCRATCH` before block B:
   - an absolute path under the scratchpad that **its own** session may write, with a unique run suffix, for example `<own scratchpad>/211-breaks-<UTC timestamp>`;
   - recorded in the M6 record before block B;
   - substituted for `__M6_SCRATCH__` in every block, with the identical literal each time.

   Block B refuses if the path already exists, so no earlier run's baseline or recovery copies are overwritten. Nothing in this procedure deletes a scratch folder. After any stop, a retry needs the owner's explicit approval and a new suffix. The old folder is kept as it is, and is neither reused nor cleaned up.
3. **Fixed targets.** The file each break edits is fixed by `target_for` and never chosen by hand:
   - K3 edits `apps/web/lib/laundry-order-page.ts`;
   - K1, K2, K4, K5 and K6 edit `'apps/web/app/app/laundry/[id]/page.tsx'`, always quoted.
4. **Verified baseline copies.** `$SCRATCH/baseline/` holds a copy of each of the five scoped files at the baseline. Block B checks them against the recorded hashes, and every later block re-checks them (`baseline_intact`) before using them. They are the recovery source for the owner.
5. **One break at a time, in order.** Each break is: block P (it must print `READY Kn <file>`), then the edit from the table, made only to that file, then block R.
   - Block P refuses to start while any earlier break has a `Kn.file` without a `Kn.ok`, which means it is incomplete or was interrupted.
   - If the edit cannot be applied, block R still runs.
6. **Checks before block R writes anything.** Block R checks all of these, and refuses to restore if any fails:
   - the recorded target `$SCRATCH/Kn.file` equals `target_for Kn`;
   - the backup `Kn.orig` is byte-identical to the verified baseline copy of that target;
   - every other scoped file is still at the baseline;
   - `Kn.ok` does not exist yet.

   A wrong break number, a wrong or tampered target, or a wrong backup is therefore caught before any file is written. Block R only ever writes the one recorded target, with content equal to its verified baseline copy.
7. **Stop rules.** Results go to `$SCRATCH` logs, not to this plan, during the break runs, and are copied into the M6 record after block F.
   - If block P or block R exits before printing its last expected line, stop immediately. Run nothing else, edit nothing, and leave every file in `$SCRATCH` untouched. Report to the owner what the block printed.
   - If block R prints `Kn RESTORED-VERIFIED` but then `Kn AFTER-RESTORE FAIL`, stop and report. The tree is restored and verified, but no `Kn.ok` is written, so no later break or block F can pass.
   - If block R prints `Kn AFTER-RESTORE PASS` but the failing test names in `Kn.break.log` differ from the [prediction](#break-predictions-by-test-name), write `MISMATCH` to `Kn.match`, stop, and report.
   - Continue to the next break only after `Kn AFTER-RESTORE PASS` **and** `MATCH`.
8. **No progress past an unverified restore.** Another break, block F, Task 3 and any commit are never started after an unverified restoration, a missing `Kn.ok`, or a `MISMATCH`.

Preamble (the first lines of every block, verbatim, apart from the one `SCRATCH` substitution):

```bash
set -euo pipefail
REPO=/home/rex/Project/clensy-platform
SCRATCH=__M6_SCRATCH__
: "${REPO:?}" "${SCRATCH:?}"
case "$SCRATCH" in
  *__M6_SCRATCH__*) echo "SCRATCH is still the placeholder" >&2; exit 1 ;;
  /*) ;;
  *) echo "SCRATCH must be an absolute path" >&2; exit 1 ;;
esac
case "$SCRATCH/" in "$REPO"/*) echo "SCRATCH is inside the repository" >&2; exit 1 ;; esac
cd "$REPO"
FILES=(
  'packages/web/src/i18n/messages/en/laundry.ts'
  'apps/web/lib/laundry-order-page.ts'
  'apps/web/lib/laundry-order-page.test.ts'
  'apps/web/app/app/laundry/[id]/page.tsx'
  'apps/web/lib/laundry-order-page.render.test.tsx'
)
BREAKS=(K1 K2 K3 K4 K5 K6)
target_for() {
  case "$1" in
    K1|K2|K4|K5|K6) printf '%s\n' 'apps/web/app/app/laundry/[id]/page.tsx' ;;
    K3) printf '%s\n' 'apps/web/lib/laundry-order-page.ts' ;;
    *) echo "unknown break: $1" >&2; return 1 ;;
  esac
}
baseline_intact() {
  local x f
  for x in baseline.head baseline.patch baseline.status baseline.sha256; do test -f "$SCRATCH/$x"; done
  for f in "${FILES[@]}"; do test -f "$SCRATCH/baseline/$f"; done
  (cd "$SCRATCH/baseline" && sha256sum --quiet -c "$SCRATCH/baseline.sha256")
}
at_baseline() {
  sha256sum --quiet -c "$SCRATCH/baseline.sha256"
  git diff HEAD -- "${FILES[@]}" | cmp - "$SCRATCH/baseline.patch"
  git status --porcelain | cmp - "$SCRATCH/baseline.status"
  test "$(git rev-parse HEAD)" = "$(cat "$SCRATCH/baseline.head")"
}
```

#### Block B: baseline (once per run)

```bash
# preamble
test ! -e "$SCRATCH" || { echo "$SCRATCH exists; a new run needs a new suffix and the owner's approval" >&2; exit 1; }
mkdir -p -- "$SCRATCH/baseline"
git rev-parse HEAD > "$SCRATCH/baseline.head"
git diff HEAD -- "${FILES[@]}" > "$SCRATCH/baseline.patch"
git status --porcelain > "$SCRATCH/baseline.status"
sha256sum -- "${FILES[@]}" > "$SCRATCH/baseline.sha256"
cp --parents -- "${FILES[@]}" "$SCRATCH/baseline/"
baseline_intact
at_baseline
test -s "$SCRATCH/baseline.patch"   # Tasks 1 and 2 are uncommitted, so the patch is not empty
test -s "$SCRATCH/baseline.status"
echo BASELINE-OK
```

#### Block P: prepare break Kn

Set only `N`. The target comes from `target_for`.

```bash
# preamble
N=K1
F=$(target_for "$N")
baseline_intact
at_baseline
for n in "${BREAKS[@]}"; do
  if test -e "$SCRATCH/$n.file" && test ! -e "$SCRATCH/$n.ok"; then
    echo "break $n is incomplete or was interrupted; stop" >&2; exit 1
  fi
done
test ! -e "$SCRATCH/$N.file"
test ! -e "$SCRATCH/$N.orig"
test ! -e "$SCRATCH/$N.ok"
cp -- "$F" "$SCRATCH/$N.orig"
cmp -- "$SCRATCH/$N.orig" "$SCRATCH/baseline/$F"
printf '%s\n' "$F" > "$SCRATCH/$N.file"
echo "READY $N $F"
```

The edit is made only after `READY Kn <file>` is printed, and only to that file.

#### Block R: run break Kn, restore, verify

Set only `N`, the same value as in block P.

```bash
# preamble
N=K1
F=$(target_for "$N")
baseline_intact
test -f "$SCRATCH/$N.file" || { echo "no recorded target for $N; block P did not complete" >&2; exit 1; }
test -f "$SCRATCH/$N.orig" || { echo "no backup for $N; refusing to restore" >&2; exit 1; }
test ! -e "$SCRATCH/$N.ok" || { echo "$N is already complete" >&2; exit 1; }
test "$(cat "$SCRATCH/$N.file")" = "$F" || { echo "recorded target is not $F; refusing to restore" >&2; exit 1; }
cmp -- "$SCRATCH/$N.orig" "$SCRATCH/baseline/$F" || { echo "backup differs from the baseline copy; refusing to restore" >&2; exit 1; }
for f in "${FILES[@]}"; do
  [ "$f" = "$F" ] || cmp -s -- "$f" "$SCRATCH/baseline/$f" || { echo "$f is not at the baseline; refusing to restore" >&2; exit 1; }
done
if cmp -s -- "$F" "$SCRATCH/baseline/$F"; then echo "$N: the target is unchanged, so the edit was not applied"; fi
# 1. Run the break. Failing tests are expected here, so the result is recorded, not fatal.
if pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx lib/laundry-order-page.test.ts > "$SCRATCH/$N.break.log" 2>&1; then
  echo "$N break run: all tests passed"
else
  echo "$N break run: failures recorded in $SCRATCH/$N.break.log"
fi
# 2. Restore the one recorded target, then verify it and the whole baseline.
cp -- "$SCRATCH/$N.orig" "$F"
cmp -- "$F" "$SCRATCH/baseline/$F"
at_baseline
echo "$N RESTORED-VERIFIED"
# 3. The restored tree must pass again; only then is the per-break marker written.
if pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx lib/laundry-order-page.test.ts > "$SCRATCH/$N.after.log" 2>&1; then
  printf '%s %s\n' "$N" "$(sha256sum < "$SCRATCH/baseline.sha256" | cut -d' ' -f1)" > "$SCRATCH/$N.ok"
  echo "$N AFTER-RESTORE PASS"
else
  echo "$N AFTER-RESTORE FAIL: see $SCRATCH/$N.after.log; stop" >&2
  exit 1
fi
```

#### Block F: final check

```bash
# preamble
baseline_intact
at_baseline
SUM=$(sha256sum < "$SCRATCH/baseline.sha256" | cut -d' ' -f1)
for n in "${BREAKS[@]}"; do
  t=$(target_for "$n")
  test "$(cat "$SCRATCH/$n.file")" = "$t"
  cmp -- "$SCRATCH/$n.orig" "$SCRATCH/baseline/$t"
  test "$(cat "$SCRATCH/$n.ok")" = "$n $SUM"
  test "$(head -n 1 "$SCRATCH/$n.match")" = "MATCH"
done
pnpm --filter web test
echo FINAL-OK
```

If `pnpm --filter web test` fails with a jsdom timeout (#205), record it and re-run block F. Do not raise the timeout. Any other failure stops M6.

**Shell-mechanics evidence (not application test results).** On 2026-11-01, during M4, blocks B, P, R and F were extracted from this plan and run in a fresh throwaway git repository in the M4 session's scratchpad. The repository had the same five paths, including `[id]`, plus an unrelated file and an untracked plan, and the test command was replaced by stubs. The normal run of K1–K6, then block F, printed `FINAL-OK`. These invalid paths were each refused or stopped, and none of them wrote to a second file:
- the placeholder, a relative or an in-repository `SCRATCH`;
- an existing `SCRATCH`;
- block R with the wrong break number;
- a tampered `Kn.file`;
- a backup that differs from the baseline;
- a stray edit to another scoped file before block R;
- a missing test command, where the restore still ran and the after-restore failure left no `.ok`;
- a failed after-restore test;
- a failed restoration, where the target was read-only;
- a commit made mid-run;
- an interrupted break followed by block P for the next break;
- a missing, forged or stale `.ok`;
- a missing or `MISMATCH` `.match` in block F.

None of this was run against this repository, and it says nothing about which real tests fail.

| Break | Edit (never staged or committed) | Predicted to fail | Proves |
| --- | --- | --- | --- |
| K1 | `page.tsx`: the alert condition becomes `roleLookup !== 'resolved'` | The six `case 8: … shows no alert` tests. Case 6 still passes, because the alert is outside the compared sections. | Loading shows no alert |
| K2 | `page.tsx`: the alert condition becomes `true` | The six case 8 tests, the five case 9 tests, `case 10a: …` and `case 10b: …` | No-permission and with-permission roles show no alert |
| K3 | `laundry-order-page.ts`: check `error` before `role` (`if (error) return 'failed';` first) | `case 10b: TENANT_OWNER with a retained role and an error shows no alert`; `laundryRoleLookup > resolves a role alongside an error` | A retained role wins over an error |
| K4 | `page.tsx`: render the same alert also inside the early-return `ErrorState` and `LoadingState` branches (`:121-138`) when `roleLookup === 'failed'` | `case 7a: …` and `case 7b: …`, whose Failed setup makes `roleLookup` `'failed'`. No existing test fails: the existing order error and loading tests resolve the role (TENANT_OWNER). | The order's own state wins over the role error |
| K5 | `page.tsx`: on `roleLookup === 'failed'`, render `null` in place of `<WeighingBody …/>` and `<InvoicePaymentBody …/>` | The three case 6 tests (`RECEIVED`, `WEIGHED`, `PAID`: Weighing renders its read-only or locked view in the loading render and nothing in the failed one, `laundry-order-page.ts:144-151`); `case 2: …` (Weighing's "Not weighed yet."). Case 3 still passes: its Invoice has no `<button` either way. | Weighing and Invoice are unchanged by a failed lookup |
| K6 | `page.tsx`: `roleResolved={roleLookup !== 'loading'}` (a failed lookup treated as resolved for Services and Price) | `case 1: …` (Services becomes `'none'` and Price `'beforePricing'`); `case 2: …` (Price becomes `'beforePricing'`); `case 6: RECEIVED sections match loading` and `case 6: WEIGHED sections match loading` (the same differences). `case 6: PAID sections match loading` still passes, because the total decides first (`laundry-service-selection.ts:26`, `laundry-price-review.ts:27`). Cases 3, 4 and 5 still pass. | Services and Price bodies stay as they are while loading |

K6 is the one break that is not aimed at a characterization case. It is included because it is the most likely wrong implementation of decision c. It makes new cases 1 and 2 fail, and two of the three case 6 tests.

### Break predictions by test name

No existing test in either file fails under any break: neither file asserts on `role="alert"`, `text-red-600` or the alert text, and the existing order error and loading tests resolve the role. So the complete set of failing names in `Kn.break.log` must be exactly:

| Break | Exact failing test names (and no others) |
| --- | --- |
| K1 | `case 8: WEIGHED roleLoading=true shows no alert`, `case 8: WEIGHED roleLoading=false shows no alert`, `case 8: RECEIVED roleLoading=true shows no alert`, `case 8: RECEIVED roleLoading=false shows no alert`, `case 8: PAID roleLoading=true shows no alert`, `case 8: PAID roleLoading=false shows no alert` |
| K2 | the six K1 names; `case 9: ANALYST on PAID shows no alert`; `case 9: CUSTOMER_SUPPORT on WEIGHED shows no alert`, `case 9: FINANCE on WEIGHED shows no alert`, `case 9: ANALYST on WEIGHED shows no alert`, `case 9: SUPER_ADMIN on WEIGHED shows no alert`; `case 10a: TENANT_OWNER on PAID shows its buttons and no alert`; `case 10b: TENANT_OWNER with a retained role and an error shows no alert` |
| K3 | `case 10b: TENANT_OWNER with a retained role and an error shows no alert`; `laundryRoleLookup > resolves a role alongside an error` |
| K4 | `case 7a: order error wins over a failed role lookup`; `case 7b: order loading wins over a failed role lookup` |
| K5 | `case 6: RECEIVED sections match loading`, `case 6: WEIGHED sections match loading`, `case 6: PAID sections match loading`; `case 2: failed RECEIVED shows one alert and keeps Weighing and Services` |
| K6 | `case 1: failed WEIGHED shows one alert before the section links`; `case 2: failed RECEIVED shows one alert and keeps Weighing and Services`; `case 6: RECEIVED sections match loading`, `case 6: WEIGHED sections match loading` |

Vitest prefixes each name with its `describe` titles (`order page role-lookup failure (#211) > `, or `laundryRoleLookup > `); the match is on the name after the prefix.

## Verification

Run at M6 Task 3 Step 1. At M4 and M5 none of these had been run, and the `Expected` column below is the prediction from that time. **At M6 all six passed.** The actual output is in the [Execution record (M6)](#execution-record-m6), under Task 3 Step 1 and block F, and the M7 reviewer re-ran all six with the same result ([M7 decision](#m7-decision)).

| Command | Applies because | Expected |
| --- | --- | --- |
| `pnpm --filter web test` | `apps/web` page, helper and tests change | PASS (subject to the #205 note) |
| `pnpm --filter web lint` | `apps/web` source changes | PASS, no errors |
| `pnpm --filter web exec tsc --noEmit` | `apps/web` has no typecheck script, and the new import and hook fields must type | PASS |
| `pnpm --filter @clensy/web test` | `packages/web` catalog changes; its tests read the default messages | PASS |
| `pnpm --filter @clensy/web lint` | `packages/web` source changes | PASS |
| `pnpm --filter @clensy/web build` | `tsc --noEmit` on `packages/web`, so the catalog's message type stays valid | PASS |

No `packages/client`, `packages/ui` or `apps/api` command applies: none of those packages changes.

## Acceptance criteria → tests

| #211 criterion | How this plan meets it | Covered by |
| --- | --- | --- |
| AC1: a failed `currentAdmin` lookup shows an explicit message, in the catalog, following existing copy and patterns | **As changed by the owner on 2026-11-01**: one page-level alert, not inside Actions ([owner decision](#211-acceptance-criterion-1-owner-decision)). Copy in `laundry.error.account`; wording and markup from `/app`. | Cases 1–5; break K6; browser check |
| AC2: while the role loads, nothing changes (no buttons, no message) | Decision c; the section bodies are unchanged | Case 8 (K1, K2); existing `:372`, `:644`, `:979` |
| AC3: a resolved role is unchanged (buttons; "No further actions for this order.") | No section code changes | Cases 9, 10 (K2, K3); existing #165 cases 1–5 |
| AC4: any change to Services or Price for this state is a stated decision | Decision c: their bodies are **unchanged** (empty, as while loading), and the page-level alert explains them | Cases 1, 2, 6; break K6 |
| AC5: focused tests for loading, failed and resolved | — | Task 1 unit tests; cases 1–10 |
| Owner: four states distinct | Decision a; the alert only for `'failed'` | Cases 1–5 (failed), 8 (loading), 9 (no permission), 10 (with permission) |
| Owner: Weighing and Invoice unchanged | Decision g | Case 6 (K5) |
| Owner: page access and session unchanged | No change to the gate, the guard or the client | Task 3 Step 2 scope check |

## Unresolved concerns and deferred decisions

1. **Decided:** one page-level alert, placed before the section links (owner, 2026-11-01). The revision 1 concern about three repeated announcements is closed.
2. **Proposed #211 comment.** Posting the [clarification](#211-acceptance-criterion-1-owner-decision) needs the owner's approval. It is not posted by this plan.
3. **Accepted:** a brief alert flash before the `/login` redirect when the failure is `UNAUTHENTICATED`. The `/app` start page does the same.
4. **Deferred:** a retry control. The page recovers when a later `currentAdmin` read succeeds, for example after navigation. The `/app` message has no retry either. Out of scope.
5. **Deferred:** Weighing's read-only "Not weighed yet." on `RECEIVED` during a failed lookup. The page-level alert above it now explains the missing editor. Changing Weighing is out of scope by owner boundary. A follow-up issue is optional.
6. **Accepted:** the same English string exists in `nav.json` and `laundry.ts`, because the two i18n systems are separate (decision b).

## Execution risks

- **jsdom timeouts (#205)** in `pnpm --filter web test`: record the failing test and re-run it. Do not raise timeouts here.
- **Markup drift.** `SUMMARY_END_TO_NAV` depends on the summary `<dl>` closing directly before the alert, and on the nav's `aria-label="Order sections"` (`laundry.ts:190`). If formatting or copy changes, the test fails loudly, not silently.
