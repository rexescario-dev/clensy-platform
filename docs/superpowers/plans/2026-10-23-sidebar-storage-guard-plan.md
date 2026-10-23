# Sidebar Collapsed-State Storage Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted** at M5, 2026-10-23, with two clarifications folded in (see M5 decision). M6 in progress. |
| M5 decision | **Accepted** — 2026-10-23, by the owner, on the Draft at `1ea0ee7`. Decisions (a)–(f) accepted as written. Caveats: (c) keep the tests on the hook contract, since the existing UI tests cover sidebar interaction; (d) make sure the `window.localStorage` property failure is actually exercised and not bypassed by the test setup; (e) keep each `try`/`catch` limited to its own storage operation. Two clarifications for M6: (1) keep the first-render behavior: the state starts expanded and the saved value is restored in the mount Effect, with no storage access during render and no change to initialization timing; (2) prove each failure on its own and **verify in each test that the stubbed failure was actually triggered**. Clarification (2) is applied below as an added assertion in R1–R4: the stub's spy was called. Execution method: **native**, followed by one fresh independent M7 review. Expected outcomes remain predictions until M6 runs them. |
| Date | 2026-10-23 |
| Tracking issue | [#197](https://github.com/rexescario-dev/clensy-platform/issues/197) "Handle unavailable localStorage in the sidebar collapsed state". Source: `useEffect` audit at `d5d845e`, finding 2. |
| Branch | `feat/197-sidebar-storage-guard`, from `main` at `98debb9`. One PR for this plan, its M5 record and the implementation. |
| Implements (Accepted) | [Web Application Shell & Design System](../specs/2026-09-10-web-shell-and-design-system-design.md), Status **Accepted** (2026-09-10). Governing text: §4.4 "Collapse is desktop-only and persists under `clensy.sidebar.collapsed` (boolean, existing key …)", and §6 manual golden path item 3. Relied on, not changed: [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.2 (Accepted; "collapse state persists in `localStorage` under key `clensy.sidebar.collapsed` (boolean)"); Web Shell §6 build gates. |
| No spec amendment | Owner decision, 2026-10-23 (brainstorm): #197 is a bug fix under the existing contract. The Accepted specs require persistence in `localStorage`. They do not require the hook to fail when persistence is unavailable. No amendment and no M2/M3. Owner's terms: starts expanded when storage is unavailable or cannot be read; the toggle collapses and expands normally for the session; persistence is best-effort; no retry and no synchronization; `getItem` and `setItem` are guarded **independently**; the fallback stays local to `use-sidebar-collapsed.ts` and follows `shell-chrome.tsx`. If planning or execution finds this needs a change to the Accepted contract, stop and raise it with the owner. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names and task order are planning decisions, not product semantics. |
| Scope | `apps/web/lib/use-sidebar-collapsed.ts` and one new test file, `apps/web/lib/use-sidebar-collapsed.test.tsx`. **No** change to the hook's signature (`useSidebarCollapsed(): [boolean, (value: boolean) => void]`), the storage key, `AppSidebar`, `shell-chrome.tsx`, `@clensy/ui`, `packages/web`, `package.json`, `pnpm-lock.yaml`, lint configuration, API, schema or GraphQL. |
| Package names | `pnpm --filter web` is `apps/web`; `@clensy/ui` is `packages/ui`; `@clensy/web` is `packages/web`. |
| Baseline | On `main` at `98debb9`, at planning time: `web` vitest 49 files, 2193/2193 passed; `@clensy/ui` 11 files, 112/112; `@clensy/web` 16 files, 418/418. `pnpm --filter web lint` clean. `pnpm --filter web exec tsc --noEmit` clean. A baseline, not pre-validation. Task 1 re-records it. |
| Pre-validation | **Partial.** A throwaway probe test was run against unmodified code at `98debb9`, then deleted (`git status` clean). It rendered a component that calls the hook, with `createRoot` inside `act` under jsdom. It found: (1) with `Storage.prototype.getItem` stubbed to throw a `SecurityError` `DOMException`, `act` rethrew `SecurityError: blocked`, and the container was **empty** afterwards: the tree had unmounted. A `createRoot` `onUncaughtError` handler was **not** called; under `act` the error came out of `act` instead. (2) The same thing happened with the `window.localStorage` getter stubbed to throw (`vi.spyOn(window, 'localStorage', 'get')` works under jsdom). (3) With `setItem` stubbed to throw `QuotaExceededError`, calling the hook's setter with `true` inside `act` rethrew the error, and the output still read `expanded`. (4) With `'true'` stored, `renderToString` produced `expanded`, and a client mount then read `collapsed`. **Not run:** the tests as written in this plan, the characterization breaks, lint, `tsc`, the `@clensy/ui` and `@clensy/web` suites after a change, and `pnpm --filter web build`. Every `Expected:` line below is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec (§4.4, §6), this plan and the branch diff. |
| M10 | **Does not apply**: the slice changes no workflow assets. |

**Goal:** A blocked or full `localStorage` can no longer crash the dashboard shell or the collapse toggle. When storage works, collapse still persists exactly as it does today.

**Architecture:** `useSidebarCollapsed` keeps `useState(false)` and still reads storage only in its mount Effect, so the server render and the first client render match. The `getItem` call and the `setItem` call each get their own `try`/`catch`, and the `window.localStorage` access sits inside each `try`. A failed read leaves the state at `false` (expanded). A failed write still applies the new state. Both catches follow `shell-chrome.tsx:62-66` and `:83-87`.

**Tech Stack:** React 19.2.8, Vitest 5 with jsdom (per-file `// @vitest-environment jsdom`, as in `apps/web/lib/use-detail-drawer.test.tsx`), `react-dom/client` `createRoot`, `react-dom/server` `renderToString`.

**Spec:** `docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md` §4.4, §6.

## Global Constraints

- When storage works, collapse persists under `clensy.sidebar.collapsed` as the string `'true'` or `'false'`, and is restored on mount (§4.4). Any stored value other than `'true'` restores as expanded, as today.
- The storage read stays inside the mount Effect. The first render is always expanded (issue #197 Scope, bullet 2).
- When the read fails, the sidebar starts expanded. When the write fails, the toggle still changes the state. No retry, no `storage`-event sync, no other fallback store (owner decision).
- Read and write are guarded independently. A failure in one never stops the other from being tried (owner decision).
- The hook's signature and the storage key are unchanged. No caller edit.
- No `eslint-disable` comment and no lint configuration change. Each `catch` carries a comment naming the fallback, as `shell-chrome.tsx` does (`docs/conventions/javascript/README.md`: "Empty `catch` is forbidden"; catch only "to apply a documented fallback").
- Every existing test in `web`, `@clensy/ui` and `@clensy/web` passes unedited.

## Acceptance for this slice

1. With the read stubbed to throw, mounting does not throw and the hook reports expanded (#197 acceptance 1). R1, R2.
2. With the write stubbed to throw, the setter does not throw and the state follows each toggle (#197 acceptance 2). R3, R4.
3. Tests cover a throwing read, a throwing write, initial render with and without a stored value, and toggling (#197 acceptance 3). C1–C4, R1–R4.
4. `web`, `@clensy/ui` and `@clensy/web` vitest suites, `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web build` pass (#197 acceptance 4; §6 build gates).
5. The tests stub storage. They prove the guard works. They do not show that the original crash was reproduced in a browser (#197 acceptance 5). The M6 record says so.

## Planning decisions for M5 to confirm

- **(a) Test the hook through a minimal probe component, not `AppSidebar`.** The fix and the contract both live in the hook. `AppSidebar` would bring `next/link`, next-intl and the current-admin query, and this slice changes none of them. `Probe` renders `<output>{collapsed ? 'collapsed' : 'expanded'}</output>` and stores the hook's latest return value in a module-level variable, so tests can call the setter directly.
- **(b) "Does not crash" means three things.** The `act` call does not throw, the output element is still in the container, and its text is the expected state. The probe found that an Effect error under `act` is rethrown from `act` and unmounts the tree. So any one of these three fails on unmodified code. An `onUncaughtError` collector is not used: under `act` it was not called.
- **(c) The setter is called directly, inside `act`, not through a click.** A throw from a React click handler goes to `reportError`, not to the test. A direct call inside `act` makes the throw (or its absence) visible to the test. `AppSidebar`'s button already calls the setter. That wiring is unchanged and out of scope.
- **(d) Failure stubs.** Read failure: `vi.spyOn(Storage.prototype, 'getItem')` throwing `new DOMException('blocked', 'SecurityError')`. Accessor failure: `vi.spyOn(window, 'localStorage', 'get')` throwing the same, which is how Chromium reports blocked site data. Write failure: `vi.spyOn(Storage.prototype, 'setItem')` throwing `new DOMException('full', 'QuotaExceededError')`. `afterEach` restores mocks and clears storage.
- **(e) Catch every error, as `shell-chrome.tsx` does**, not only `DOMException`. The fallback is the same whatever the cause, and matching the existing pattern was part of the owner's terms.
- **(f) Docs.** No docs change in M6. M9 decides.

## Review Focus

- **Blocked storage throws on `window.localStorage` itself, not on `getItem`.** In Chromium, with site data blocked, reading the property throws. A guard that only wraps the method call misses this. Owned by R2.
- **A read that works must not depend on the write working, and the other way round.** Owned by R1 (read throws, write still stores) and R4 (write throws, stored value still restores).
- **The first render must stay expanded with a stored `'true'`.** Moving the read into the `useState` initializer would "fix" a flash but break hydration. Owned by C1.
- **A failed write must not swallow the state change.** If the state update were placed after the write inside the same `try`, a failed write would leave the toggle stuck. Owned by R3.
- **Toggling back must work too**, not only the first toggle. Owned by C4, R2, R3.

---

### Task 1: Tests for persistence and unavailable storage (type: `code`)

Pins §4.4 persistence and #197's acceptance criteria before Task 2 edits the hook. **C1–C4 are characterization tests**: they pin behavior that already works and are expected to **pass** on unmodified code. **R1–R4 are the red tests**: they are expected to **fail** on unmodified code.

**Files:**
- Create: `apps/web/lib/use-sidebar-collapsed.test.tsx` (`vitest.config.ts` includes `lib/**`)

**Interfaces:**
- Consumes: `useSidebarCollapsed` from `./use-sidebar-collapsed`; `act` from `react`; `createRoot`, `Root` from `react-dom/client`; `renderToString` from `react-dom/server`.
- Produces: nothing for Task 2 beyond the file. Task 2 runs it unedited.

**Fixture (decisions, not code):**
- `// @vitest-environment jsdom` and `IS_REACT_ACT_ENVIRONMENT = true`, as in `use-detail-drawer.test.tsx`.
- `const KEY = 'clensy.sidebar.collapsed'`. A test file may repeat the key: it is the persisted contract, and the hook does not export it.
- `Probe` per decision (a). Module-level `latest: [boolean, (value: boolean) => void]`, `container`, `root`.
- Helpers: `mount()` creates the container and root and renders `<Probe />` inside `act`. `toggle(value)` calls `latest[1](value)` inside `act`. `shown()` returns the `output` element's text, or `null` when there is no `output` in the container.
- `afterEach`: `try { act(() => root?.unmount()) } finally { container?.remove(); vi.restoreAllMocks(); localStorage.clear(); }`.

- [ ] **Step 0: Re-record the baseline**

Run: `git status --short` (clean; the plan and its M5 record are already committed), `pnpm --filter web exec vitest run`, `pnpm --filter @clensy/ui exec vitest run`, `pnpm --filter @clensy/web exec vitest run`, `pnpm --filter web lint`.
Expected: 49 files 2193/2193; 11 files 112/112; 16 files 418/418; lint clean. Record the actual numbers.

- [ ] **Step 1: Write the tests**

`describe('useSidebarCollapsed persistence (characterization)')`:

| Id | Test name | Sequence and assertions |
| --- | --- | --- |
| C1 | `renders expanded before mount even when collapsed is stored` | `localStorage.setItem(KEY, 'true')` → `renderToString(<Probe />)` contains `>expanded<`. |
| C2 | `starts expanded when nothing is stored` | `mount()` → `shown()` is `'expanded'`. |
| C3 | `restores the stored value after mount` (`it.each`) | `['true', 'collapsed']`, `['false', 'expanded']`: `localStorage.setItem(KEY, stored)` → `mount()` → `shown()` is the expected text. |
| C4 | `persists each toggle` | `mount()` → `toggle(true)` → `shown()` `'collapsed'`, `localStorage.getItem(KEY)` `'true'` → `toggle(false)` → `'expanded'`, `'false'`. |

`describe('useSidebarCollapsed with unavailable storage')`:

| Id | Test name | Sequence and assertions |
| --- | --- | --- |
| R1 | `starts expanded when reading storage throws, and still saves toggles` | `localStorage.setItem(KEY, 'true')`; stub `getItem` to throw (decision d) → `expect(mount).not.toThrow()` → the `getItem` spy was called → `shown()` `'expanded'` (the stored `'true'` is ignored because it cannot be read) → `expect(() => toggle(true)).not.toThrow()` → `'collapsed'` → `toggle(false)` → `'expanded'` → `vi.restoreAllMocks()` → `localStorage.getItem(KEY)` is `'false'` (the write was still tried, and it replaced the stored `'true'`). |
| R2 | `starts expanded and toggles in memory when localStorage itself throws` | Stub the `window.localStorage` getter to throw → `mount` does not throw → the getter spy was called → `'expanded'` → `toggle(true)` does not throw → `'collapsed'` → `toggle(false)` → `'expanded'` → the getter spy's call count went up with each toggle (the write path also reached the throwing property). |
| R3 | `keeps toggling in memory when writing storage throws` | Stub `setItem` to throw → `mount()` → `'expanded'` → `toggle(true)` does not throw → the `setItem` spy was called with `(KEY, 'true')` → `'collapsed'` → `toggle(false)` does not throw → `'expanded'`. |
| R4 | `still restores the stored value when only writing throws` | `localStorage.setItem(KEY, 'true')` **before** stubbing `setItem` to throw → `mount()` → `'collapsed'` → `toggle(false)` does not throw → the `setItem` spy was called with `(KEY, 'false')` → `'expanded'`. |

- [ ] **Step 2: Run the new file on unmodified code**

Run: `pnpm --filter web exec vitest run lib/use-sidebar-collapsed.test.tsx`
Expected: C1–C4 (5 tests) pass. R1, R2, R3 fail: R1 and R2 with `SecurityError: blocked` from `mount`; R3 with `QuotaExceededError: full` from `toggle(true)`. R4 passes its `mount()` assertion and then fails with `QuotaExceededError: full` from `toggle(false)`. If any C test fails, or an R test fails for a different reason, stop: the fixture is wrong, or the shipped behavior differs from this plan's assumption. Record the actual failures.

- [ ] **Step 3: Characterization breaks (outside the commit, not committed)**

For each break, change `use-sidebar-collapsed.ts` in the working tree to produce the behavior named. M6 chooses the edit. Run `pnpm --filter web exec vitest run lib/use-sidebar-collapsed.test.tsx -t "characterization"`, record which tests actually failed and each one's first failure message, then `git checkout apps/web/lib/use-sidebar-collapsed.ts` and confirm `git status --short` shows only the plan and the new test file. The predictions are not pass criteria. If a predicted test does not fail, stop and find out why.

| Break | Behavior broken | Predicted to fail |
| --- | --- | --- |
| B1 | The first render reads storage, so a stored `'true'` renders collapsed before mount. | C1 |
| B2 | The stored value is no longer restored on mount. | C3 (`'true'` case) |
| B3 | A toggle no longer writes storage. | C4 (storage assertion) |
| B4 | A toggle writes storage but no longer changes the state. | C4 (`shown()` assertion) |

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/use-sidebar-collapsed.test.tsx
git commit -m "test(197): pin sidebar collapse persistence and unavailable storage"
```

The commit contains failing tests R1–R4 by design. Task 2 turns them green. Do not push between Task 1 and Task 2.

---

### Task 2: Guard the storage read and write independently (type: `code`)

**Files:**
- Modify: `apps/web/lib/use-sidebar-collapsed.ts:9-17`

**Interfaces:**
- Consumes: Task 1's test file, unedited.
- Produces: no change to `useSidebarCollapsed`'s signature or any export.

- [ ] **Step 1: Make the change**

In the mount Effect, read into a local `stored: string | null = null` inside `try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* comment */ }`, then apply `if (stored !== null) setCollapsed(stored === 'true')` after the `try`. In `update`, keep `setCollapsed(value)` first and outside any `try`, then wrap `window.localStorage.setItem(STORAGE_KEY, String(value))` in its own `try`/`catch`. The comments follow `shell-chrome.tsx`: "Storage can be unavailable in restricted browser contexts." for the read, and "Keep the in-memory state usable when persistence is unavailable." for the write. Nothing else in the file changes.

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter web exec vitest run lib/use-sidebar-collapsed.test.tsx`
Expected: 9/9 pass. `git diff HEAD --stat -- apps/web/lib/use-sidebar-collapsed.test.tsx` is empty.

- [ ] **Step 3: Full verification**

Run, and record each result:
- `pnpm --filter web exec vitest run`. Expected: 50 files, 2202/2202 passed.
- `pnpm --filter @clensy/ui exec vitest run`. Expected: 11 files, 112/112.
- `pnpm --filter @clensy/web exec vitest run`. Expected: 16 files, 418/418.
- `pnpm --filter web lint`. Expected: clean.
- `pnpm --filter web exec tsc --noEmit`. Expected: exit 0.
- `pnpm --filter web build`. Expected: succeeds (§6 build gate).
- `git diff main --stat`. Expected: only this plan, `apps/web/lib/use-sidebar-collapsed.test.tsx` and `apps/web/lib/use-sidebar-collapsed.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/use-sidebar-collapsed.ts
git commit -m "fix(197): keep the sidebar usable when localStorage is unavailable"
```

- [ ] **Step 5: Record M6 and commit the record**

Add `## Execution record` to this plan, before `## Gate outcomes`. Record **actual** results only: the Task 1 Step 0 baseline; Task 1 Step 2 (which tests passed and failed, with each failure's first message); for each of B1–B4 the edit used, the tests that actually failed, any difference from the prediction, and `git status --short` after the restore; Task 2 Steps 2–3. State acceptance item 5: the tests stub storage and do not reproduce the crash in a browser. A check that was not run is recorded as **not run**, with the reason. A prediction is never copied in as a result.

```bash
git add docs/superpowers/plans/2026-10-23-sidebar-storage-guard-plan.md
git commit -m "docs(197): record M6 execution"
```

Then emit the M6 Slice Completion Report.

## Traceability

| Requirement | Source | Task / test |
| --- | --- | --- |
| Collapse persists under `clensy.sidebar.collapsed` | Spec §4.4; §6 item 3; Dashboard UX §4.2 | C3, C4; preserved by Task 2 |
| First render identical on server and client | #197 Scope bullet 2 | C1 |
| Read failure → expanded, no crash | #197 Scope bullets 1, 3; acceptance 1 | R1, R2; Task 2 Step 1 |
| Write failure → toggle still works | #197 Scope bullets 1, 3; acceptance 2 | R3, R4; Task 2 Step 1 |
| Read and write guarded independently | Owner decision, 2026-10-23 | R1, R4 |
| No other sidebar change | #197 Scope bullet 4 | Task 2 Step 3 (`git diff main --stat`) |
| Suites, lint, `tsc`, build pass | #197 acceptance 4; spec §6 build gates | Task 1 Step 0; Task 2 Step 3 |

## Deferred / out of scope

- Retrying storage, listening for `storage` events, or syncing collapse across tabs (owner decision).
- A shared storage helper for `shell-chrome.tsx` and this hook. Two call sites do not justify one in a bug fix. M8 may raise it.
- Any change to `AppSidebar`, the collapse control, the Sheet or the theme storage.
- Other `useEffect` audit findings.

## Gate outcomes

### M5 — Plan Review: Accepted (2026-10-23)

By the owner, with native execution. The decisions, caveats and the two clarifications are recorded in the M5 decision row of the header table.
