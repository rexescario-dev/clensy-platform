# AppSidebar `useEffectEvent` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 2)** at M5, 2026-10-23. M6 complete ([Execution record](#execution-record)). M7 **Approved for merge** (fresh independent review). M8 N/A. M9 complete. M10 does not apply. Branch not pushed; no PR yet. Closeout awaits the owner's authorization. |
| M5 decision | **Accepted** — 2026-10-23, revision 2, by the owner: "The reported corrections are sufficient for M5 acceptance. Proceed to M6, subject to that final diff check." The owner's qualifications: the acceptance rests on the reported changes; the owner did not inspect the revision 2 diff, and it does not establish that any test, characterization break, lint, `tsc` or build has passed. The diff check the owner asked for was done before this record: the uncommitted change against `e2477dc` touched only this file (39 insertions, 14 deletions), in the four hunks reported. The owner's M6 requirements: run C1–C8 on unmodified code and stop on a `next/link` failure before changing the fixture or mocking; run B1–B5 one at a time and record the actual failures and each restore; refactor without editing the tests; record the full suite, lint, `tsc` and build, keeping environment failures apart from passes; then the fresh independent M7 reviewer. Predicted counts and the planning probe are not execution evidence. |
| M5 history | First pass (2026-10-23, reviewed `e2477dc`; review carried out by the plan's author, not independent): **Returned for Revision** by the owner. Three blockers: C1 named the desktop `nav` "Primary navigation" instead of "Primary"; re-rendering with a reused element object would make React skip the update, so pathname changes and C3's re-render could go unseen; the pre-validation row overstated what the probe covered. Two non-blocking notes: unmount inside `act`; commit the M6 record. All five are addressed in revision 2. |
| Date | 2026-10-23 |
| Tracking issue | [#198](https://github.com/rexescario-dev/clensy-platform/issues/198) "Replace AppSidebar's latest-callback ref with useEffectEvent". Source: `useEffect` audit at `d5d845e`, finding 4. |
| Branch | `feat/198-sidebar-use-effect-event`, from `main` at `181052a`. One PR for this plan, its M5 record and the implementation. |
| Implements (Accepted) | [Web Application Shell & Design System](../specs/2026-09-10-web-shell-and-design-system-design.md), Status **Accepted** (2026-09-10). Governing text: §4.7 "Mobile Sheet: … Route changes MUST close the Sheet. Closed sheet remains inert …", and §6 manual golden path item 4. Relied on, not changed: §4.4 (shell composition), §6 build gates (`pnpm --filter web lint`, `pnpm --filter web build`). |
| No spec amendment | Owner decision, 2026-10-23 (brainstorm): #198 is an internal refactor under the existing §4.7 contract. No amendment and no M2/M3. If planning or execution finds §4.7 ambiguous, or finds it cannot be met without changing the Accepted contract, stop and raise that specific issue with the owner before going on. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names and task order are planning decisions, not product semantics. |
| Dependency | [#196](https://github.com/rexescario-dev/clensy-platform/issues/196) (React Hooks lint rules) is **CLOSED** and on `main`: `apps/web/eslint.config.mjs` sets `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` to `error` (`eslint-plugin-react-hooks` ^7.1.1). |
| Scope | `apps/web/components/layout/app-sidebar.tsx` (the ref, its sync Effect and the `pathname` Effect only) and one new test file, `apps/web/lib/app-sidebar.test.tsx`. **No** change to `AppSidebarProps`, `DashboardLayout`, `@clensy/ui`, `apps/web/lib/web-shell-regressions.test.ts`, the sidebar markup, copy, `package.json`, `pnpm-lock.yaml`, API, schema or GraphQL. |
| Package names | `pnpm --filter web` is `apps/web`. |
| Baseline | On `main` at `181052a`, at planning time: `pnpm --filter web exec vitest run`, 48 files, 2185/2185 passed. `pnpm --filter web lint` clean. `pnpm --filter web exec tsc --noEmit` clean. This is a baseline, not pre-validation. Task 1 re-records it. |
| Pre-validation | **Partial.** A throwaway probe test was run at `181052a`, then deleted, and the tree restored (`git status` clean). It rendered `AppSidebar` under jsdom inside a harness wired like `DashboardLayout`, with mocked `usePathname` and `useCurrentAdminQuery`. The probe's mock used an invalid admin role, `OWNER`, so `visibleNavGroups` returned no groups and **no navigation links rendered**. `next/link` under jsdom, with this plan's valid `TENANT_OWNER` fixture, has therefore **not been exercised**. No existing jsdom test in `apps/web/lib` renders `next/link` either. Hypothesis, not test evidence: reading Next 16.3.1's `next/dist/client/link.js`, a `Link` with no router context renders an `<a>` and returns early from prefetch, so it should render under jsdom. Task 1 Step 2 is the first real check. The probe always re-rendered with freshly created JSX, so it did not hit the reused-element case (see the Fixture). (1) On unmodified code, the Sheet's `role="dialog"` count was 0 after mount, 1 after the toggle, and 0 after a pathname change. (2) With the Task 2 mechanism applied temporarily, the same counts held and `pnpm --filter web exec eslint components/layout/app-sidebar.tsx` exited 0. (3) With the close Effect keyed on `[pathname, onMobileNavClose]`, the count was **0 right after the toggle**: the nav closed as soon as it opened (break B2 below). **Not run:** the tests as written in this plan, `tsc`, the full `web` suite after a change, `pnpm --filter web build`. Every `Expected:` line in the tasks is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec (§4.7), this plan and the branch diff. |
| M10 | **Does not apply**: the slice changes no workflow assets. |

**Goal:** Remove `AppSidebar`'s hand-kept latest-callback ref and its sync Effect, and keep the mobile nav closing on every pathname change. Behavior tests pin the change.

**Architecture:** Today `onMobileNavCloseRef` is synced from `onMobileNavClose` by one Effect, and a second Effect keyed on `[pathname]` calls `onMobileNavCloseRef.current()`. The plan wraps the call in React 19.2's `useEffectEvent` and calls it from the Effect keyed on `[pathname]`. The ref, its sync Effect and the `useRef` import go. The Effect still runs on mount (a no-op, because the nav starts closed) and on every pathname change. It does not run when only the callback's identity changes. `DashboardLayout` passes a new inline arrow on every render. If the Effect re-ran on identity changes, opening the nav would re-render it and close it at once (pre-validation probe 3).

**Tech Stack:** React 19.2.8 (`useEffectEvent`), Next 16 (`usePathname`, mocked), next-intl, Radix Sheet via `@clensy/ui`, Vitest 5 with jsdom (per-file `// @vitest-environment jsdom`, as in `apps/web/lib/use-detail-drawer.test.tsx`), `eslint-plugin-react-hooks` ^7.1.1.

**Spec:** `docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md` §4.7, §6.

## Global Constraints

- Every pathname change closes an open mobile Sheet (§4.7). This covers back/forward and redirects as well as link clicks: all of them reach `AppSidebar` as a new `usePathname()` value, so the tests drive the pathname and not a particular cause.
- Returning to an earlier pathname does not reopen the Sheet. The open state is not derived from the pathname (issue #198 Scope).
- On mount the close runs once and does nothing, because the nav starts closed (issue #198 Scope).
- `AppSidebarProps` keeps `mobileNavOpen: boolean` and `onMobileNavClose: () => void`. No caller edit.
- The Sheet's `onOpenChange` wiring and the closed Sheet's unmounting (pinned by `web-shell-regressions.test.ts`) are unchanged.
- Every existing `web` test passes unedited.
- `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` report nothing for the changed files, with no `eslint-disable` comment and no change to the lint configuration.

## Acceptance for this slice

These are the criteria M6 must meet and M7 checks. They are stated as behavior, lint and code shape. The use of `useEffectEvent` is not itself one of them. It is the mechanism Task 2 plans, and it stays only if it meets them.

1. The Task 1 behavior tests pass before **and** after Task 2, unedited by Task 2.
2. `app-sidebar.tsx` no longer keeps the latest `onMobileNavClose` in a ref synced by an Effect (issue #198 Scope, bullet 1).
3. `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web exec vitest run` and `pnpm --filter web build` pass.

## Planning decisions for M5 to confirm

- **(a) Test through a harness, not `DashboardLayout`.** `DashboardLayout` also renders `UserMenu` (logout mutation) and `ShellChrome` (`matchMedia`, theme storage), which this slice does not touch. The harness in Task 1 copies `DashboardLayout`'s wiring exactly: `useState(false)` for `mobileNavOpen`, an inline arrow `onMobileNavClose` that sets it to `false`, and a button that toggles it. That wiring is what makes the identity-change failure visible (probe 3). If M5 prefers rendering `DashboardLayout` with `UserMenu` and `ShellChrome` mocked, Task 1 changes only its render helper.
- **(b) Observable "open".** The Sheet is open when a `role="dialog"` element containing the title "Primary navigation" (`nav.sidebar.mobileTitle`) is in the document. It is closed when there is none: the closed Sheet unmounts. Every test that checks a close first asserts the Sheet is open, so no test passes because the Sheet never opened.
- **(c) Calls to `onMobileNavClose` are observable.** It is a public prop, so how often it is called and which one is called are part of the component's contract with its parent. C7 counts calls and checks that the newest callback is the one called. C7 is the only test that can see a stale callback, because the harness's `setOpen` is stable.
- **(d) Not under Strict Mode, except C8.** Strict Mode re-runs mount Effects in development, so call counts would double on mount. C1–C7 render without `StrictMode`. C8 repeats the open → navigate → closed sequence under `StrictMode`, with no call counts.
- **(e) Docs.** No docs change in M6. M9 decides. Observation for M9, not in scope here: the comment in `apps/web/lib/web-shell-regressions.test.ts` ("No DOM test environment exists in this repo") is out of date.

## Review Focus

- **Opening the nav must not close it.** Opening re-renders the parent, which passes a new `onMobileNavClose`. The close must not run for that. Owned by C2's open guard and C3.
- **Returning to an earlier route must not reopen the nav.** Owned by C4.
- **A newer `onMobileNavClose` must be the one called.** Owned by C7.
- **Navigating while closed leaves no blocked state.** The nav must still open afterwards. Owned by C5.
- **Strict Mode's double mount must not break open or close.** Owned by C8.

---

### Task 1: Behavior tests for the mobile nav's route-change close (type: `code`)

Pins §4.7 ("Route changes MUST close the Sheet") and the issue's acceptance criteria before Task 2 edits the component. Every test here is a **characterization test [C]**, expected to **pass** on unmodified code. A test that fails before Task 2 means the fixture is wrong, or the shipped behavior differs from what this plan assumes: stop and record it.

**Files:**
- Create: `apps/web/lib/app-sidebar.test.tsx` (`vitest.config.ts` includes only `lib/**`, as for `page-visibility-gate.test.tsx`)

**Interfaces:**
- Consumes: `AppSidebar` and `AppSidebarProps` from `../components/layout/app-sidebar`, imported with `await import(...)` after the `vi.mock` calls (as `use-detail-drawer.test.tsx` does); `getMessages` from `../i18n/messages`; `NextIntlClientProvider`; `act`, `StrictMode`, `useState` from `react`; `createRoot` from `react-dom/client`.
- Produces: nothing for Task 2 beyond the file. Task 2 runs it unedited.

**Fixture (decisions, not code):**
- `// @vitest-environment jsdom` and `IS_REACT_ACT_ENVIRONMENT = true`.
- `inputs = vi.hoisted(() => ({ pathname: '/app/customers' }))`. `vi.mock('next/navigation', () => ({ usePathname: () => inputs.pathname }))`.
- `vi.mock('@clensy/client', ...)`: `useCurrentAdminQuery` returns `{ data: { currentAdmin: { id: 'admin-1', role: 'TENANT_OWNER', scope: 'TENANT' } }, loading: false }`.
- `Harness({ label = 'first', calls }: { label?: string; calls?: string[] })` wires `AppSidebar` the way `DashboardLayout` does (decision a): `const [open, setOpen] = useState(false)`, a `<button type="button" aria-label="Toggle navigation menu">` whose `onClick` is `setOpen((o) => !o)`, and `onMobileNavClose={() => { calls?.push(label); setOpen(false); }}`. Inside `NextIntlClientProvider locale="en" messages={getMessages()}`.
- **Fresh JSX on every render.** React skips the update when `root.render` is given the same element object again. `Harness` would then not re-render, `usePathname()` would not be read again, and the test would see nothing. So no helper takes an element. Each helper takes `Harness` props and builds a new element on every call: `harness(props) = <Harness {...props} />`, wrapped in `<StrictMode>` when the test mounted in strict mode.
- Helpers, all sharing one module-level `container`, `root` and `strict` flag per test, so `Harness` state survives re-renders:
  - `mount(props = {}, { strict = false } = {})` creates the container and root, stores `strict`, and renders `harness(props)` inside `act`.
  - `rerender(props = {})` renders a fresh `harness(props)` into the **same** root inside `act`.
  - `navigateTo(path, props = {})` sets `inputs.pathname = path`, then calls `rerender(props)`.
  - `toggleNav()` clicks the toggle button inside `act`.
  - `sheetIsOpen()` returns whether a `[role="dialog"]` whose text includes `"Primary navigation"` (`nav.sidebar.mobileTitle`, the Sheet's title) exists (decision b).
  - `desktopNav()` returns the `nav[aria-label="Primary"]` elements (`nav.sidebar.primary`) that are not inside a `[role="dialog"]`.
- `afterEach`: `try { act(() => root.unmount()) } finally { container.remove(); inputs.pathname = '/app/customers'; }`, so the container and pathname are reset even if unmount throws.

- [ ] **Step 0: Re-record the baseline**

Run: `git status --short` (clean), `pnpm --filter web exec vitest run`, `pnpm --filter web lint`.
Expected: 48 files, 2185/2185 passed; lint clean. Record the actual numbers in the Execution record.

- [ ] **Step 1: Write the characterization tests**

`describe('AppSidebar mobile nav closes on route change (§4.7)')`:

| Id | Test name | Sequence and assertions |
| --- | --- | --- |
| C1 | `starts closed after mount` | `mount()` at `/app/customers` → `sheetIsOpen()` false; `desktopNav()` has length 1 (the desktop `nav`, accessible name "Primary"); no `[role="dialog"]` is in the document. |
| C2 | `closes the open nav when the pathname changes` | `mount()` → `toggleNav()` → `sheetIsOpen()` **true** (guard) → `navigateTo('/app/bookings')` → false. |
| C3 | `stays open when the parent re-renders on the same pathname` | `mount()` → `toggleNav()` → true → `rerender()` (a fresh `<Harness />`, pathname unchanged) → still true. |
| C4 | `does not reopen when returning to an earlier pathname` | `mount()` at `/app/customers` → `toggleNav()` → true → `navigateTo('/app/bookings')` → false → `navigateTo('/app/customers')` → false. Then `toggleNav()` → true → `navigateTo('/app/bookings')` → false → `navigateTo('/app/customers')` → false. |
| C5 | `stays closed when navigating while closed, and still opens afterwards` | `mount()` → `navigateTo('/app/bookings')` → false → `navigateTo('/app/jobs')` → false → `toggleNav()` → **true**. |
| C6 | `closes on each of several route changes in a row` | `mount()`, then for each of `/app/bookings`, `/app/jobs`, `/app/laundry`: `toggleNav()` → true → `navigateTo(path)` → false. |
| C7 | `calls the newest onMobileNavClose once on mount and once per pathname change` | `calls: string[] = []`; `mount({ label: 'first', calls })` → `calls` equals `['first']`. `rerender({ label: 'second', calls })` on the same pathname → `calls` still `['first']`. `navigateTo('/app/bookings', { label: 'second', calls })` → `calls` equals `['first', 'second']`. |
| C8 | `opens and closes on route change under Strict Mode` | `mount({}, { strict: true })` → false → `toggleNav()` → true → `navigateTo('/app/bookings')` (the stored `strict` flag keeps the `StrictMode` wrapper) → false. No call counts (decision d). |

- [ ] **Step 2: Run the new file on unmodified code**

Run: `pnpm --filter web exec vitest run lib/app-sidebar.test.tsx`
Expected: 8/8 pass. If any fails, stop (see the task intro). This is the first run with real `next/link` links rendered under jsdom (see Pre-validation). If a failure comes from `next/link` itself, record it and stop; do not mock `next/link` or change the fixture's role without the owner.

- [ ] **Step 3: Characterization breaks (outside the commit, not committed)**

For each break, change `app-sidebar.tsx` in the working tree to produce the behavior named. M6 chooses the edit. Run Step 2's command, record the actual failing tests and each one's first failure message, then `git checkout apps/web/components/layout/app-sidebar.tsx` and confirm `git status --short` shows only the new test file. The predicted failures below are predictions, not pass criteria. If a predicted test does not fail, stop and find out why before going on.

| Break | Behavior broken | Predicted to fail |
| --- | --- | --- |
| B1 | A pathname change no longer closes the nav. | C2, C4, C6, C7 (no second call), C8 |
| B2 | The close also runs whenever `onMobileNavClose` changes identity, so the nav closes right after it opens (seen in pre-validation probe 3). | C2, C3, C4, C5, C6, C7, C8 (each at its first open assertion; C7 at the same-pathname re-render) |
| B3 | A pathname change calls the `onMobileNavClose` from the first render, not the newest. | C7 only (the harness's `setOpen` is stable, so the nav still closes) |
| B4 | The close no longer runs on mount. | C7 (first assertion) |
| B5 | The Sheet is shown open again when the pathname returns to the one it was last opened on, even though `mobileNavOpen` is false. | C4 |

- [ ] **Step 4: Run the full web suite and lint**

Run: `pnpm --filter web exec vitest run` and `pnpm --filter web lint`.
Expected: 49 files, 2193/2193 passed; lint clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/app-sidebar.test.tsx
git commit -m "test(198): pin the mobile nav's close on route change"
```

---

### Task 2: Replace the latest-callback ref with `useEffectEvent` (type: `code`)

A refactor under §4.7. There is no red phase: behavior does not change, and Task 1's tests are the safety net. They must pass unedited.

**Files:**
- Modify: `apps/web/components/layout/app-sidebar.tsx:8` (imports), `:36` (ref), `:44-50` (both Effects)

**Interfaces:**
- Consumes: Task 1's `apps/web/lib/app-sidebar.test.tsx`, unedited.
- Produces: no change to `AppSidebarProps` or any export.

- [ ] **Step 1: Make the change**

In `AppSidebar`: delete `onMobileNavCloseRef` and the Effect that syncs it. Add `const closeMobileNav = useEffectEvent(() => { onMobileNavClose(); });`. The Effect keyed on `[pathname]` calls `closeMobileNav()`. Import `useEffectEvent` from `react` and drop `useRef`. Nothing else in the file changes.

- [ ] **Step 2: Lint the file**

Run: `pnpm --filter web exec eslint components/layout/app-sidebar.tsx`
Expected: exit 0, no output. If `react-hooks/rules-of-hooks` or `react-hooks/exhaustive-deps` reports the change, **stop** and reassess with the owner. Do not add an `eslint-disable` comment or change the rule configuration.

- [ ] **Step 3: Run the behavior tests**

Run: `pnpm --filter web exec vitest run lib/app-sidebar.test.tsx`
Expected: 8/8 pass, file unedited since Task 1 (`git diff HEAD --stat -- apps/web/lib/app-sidebar.test.tsx` empty).

- [ ] **Step 4: Full verification**

Run, and record each result:
- `pnpm --filter web exec vitest run`. Expected: 49 files, 2193/2193 passed.
- `pnpm --filter web lint`. Expected: clean.
- `pnpm --filter web exec tsc --noEmit`. Expected: exit 0.
- `pnpm --filter web build`. Expected: succeeds (§6 build gate).
- `grep -n "useRef\|onMobileNavCloseRef" apps/web/components/layout/app-sidebar.tsx`. Expected: no match (acceptance item 2).
- `git diff main --stat`. Expected: only the plan, `apps/web/lib/app-sidebar.test.tsx` and `apps/web/components/layout/app-sidebar.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/app-sidebar.tsx
git commit -m "refactor(198): close the mobile nav through useEffectEvent"
```

- [ ] **Step 6: Record M6 and commit the record**

Add `## Execution record` to this plan, before `## Gate outcomes`. Record **actual** results only:
- Task 1 Step 0 baseline (files, tests, lint).
- Task 1 Step 2 result.
- For each of B1–B5: the edit's behavior, the tests that actually failed and each one's first failure message, any difference from the prediction and its explanation, and `git status --short` after the restore.
- Task 1 Step 4 result.
- Task 2 Steps 2–4: lint, the behavior tests, the full suite, `tsc`, build, the `grep` and the `git diff main --stat` output.

A check that was not run is recorded as **not run**, with the reason. It is never recorded as passed, and a prediction is never copied in as a result.

```bash
git add docs/superpowers/plans/2026-10-23-sidebar-use-effect-event-plan.md
git commit -m "docs(198): record M6 execution"
```

Then emit the M6 Slice Completion Report.

## Traceability

| Requirement | Source | Task / test |
| --- | --- | --- |
| Route changes close the Sheet | Spec §4.7; §6 item 4; #198 acceptance 1 | Task 1 C2, C6, C8; preserved by Task 2 |
| Returning to an earlier pathname does not reopen | #198 Scope bullet 4; #198 acceptance 2 | Task 1 C4 |
| Mount behavior unchanged | #198 Scope bullet 3 | Task 1 C1, C7 |
| Ref and sync Effect removed | #198 Scope bullet 1 | Task 2 Steps 1, 4 |
| Lint and web suites pass | #198 acceptance 4; spec §6 build gates | Task 1 Step 4; Task 2 Steps 2, 4 |

## Deferred / out of scope

- Any change to `DashboardLayout`, the sidebar's markup, collapse behavior or navigation items.
- Updating the stale comment in `web-shell-regressions.test.ts` (M9 to decide; decision e).
- Other `useEffect` audit findings.

## Execution record

M6, 2026-10-23. Native execution in the planning session, at `49c8636` (plan revision 2 + M5 record). Spec: `docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md` (Accepted). Plan: this file (Accepted, revision 2). All results below are actual.

**Deviation (owner decision at M6): the test fixture's messages.** Task 1 Step 4's `pnpm --filter web lint` failed: `lib/app-sidebar.test.tsx:7:1 error '../i18n/messages' import is restricted from being used by a pattern. getMessages() is internal to the i18n loading boundary … no-restricted-imports`. `apps/web/eslint.config.mjs` allows `getMessages()` only in `i18n/**` and six named, spec-justified test files, and this plan forbids changing the lint configuration. Execution stopped. The owner chose a catalog-free fixture, with the smallest inline `messages` object. The fixture now passes `messages = { nav: { sidebar: { primary: 'Primary', mobileTitle: 'Primary navigation' } } }`, the only two labels the assertions use. It also passes an `onError` that ignores `IntlErrorCode.MISSING_MESSAGE` and rethrows any other error. `AppSidebar` renders 17 keys: four `sidebar.*` keys, four group labels and nine item labels. The other 15 fall back to their keys. No assertion changed, and nothing was mocked. Before the owner chose, one trial was run and reverted: `messages={{}}` with key fallbacks, asserting keys. It gave 8/8, eslint clean, and B1 failed 5 tests. Step 2 and B1–B5 were then **re-run on the final fixture**. The results below are from that final run. The first-fixture run gave the same pass/fail sets, with line numbers 9 lower.

**Task 1: characterization tests**
- Step 0 baseline: `git status` clean. `vitest run`: 48 files, 2185/2185 passed. Lint clean.
- Step 2, on unmodified code: 8/8 passed. Real `next/link` links rendered under jsdom with the `TENANT_OWNER` fixture, and there were no React or next-intl warnings in the output. This settles the open `next/link` question from Pre-validation.
- Step 3: each break was run on its own, and `git checkout` restored the file after each one. `git status --short` after every restore: `?? apps/web/lib/app-sidebar.test.tsx` only. The edit used for each break:
  - B1: the close Effect keyed on `[]`.
  - B2: the Effect calls `onMobileNavClose` directly, keyed on `[pathname, onMobileNavClose]`.
  - B3: the ref-sync Effect removed.
  - B4: a mounted-ref guard that skips the first run.
  - B5: Sheet `open={mobileNavOpen || pathname === openedOn}`, where `openedOn` records the pathname each time `mobileNavOpen` turns true.

  | Break | Result | Failing tests: first failure (line) |
  | --- | --- | --- |
  | B1 | 5 failed, 3 passed. **Matches prediction.** | C2 `expected true to be false` (134); C4 same (151); C6 same (180); C7 `expected [ 'first' ] to deeply equal [ 'first', 'second' ]` (193); C8 `expected true to be false` (203) |
  | B2 | 7 failed, 1 passed (C1). **Matches prediction.** | C2 `expected false to be true` at its open guard (131); C3 same (140); C4 same (149); C5 same at its final open (171); C6 same (178); C7 `expected [ 'first', 'second' ] to deeply equal [ 'first' ]` at the same-pathname re-render (190); C8 `expected false to be true` (200) |
  | B3 | 1 failed. **Matches prediction.** | C7 `expected [ 'first', 'first' ] to deeply equal [ 'first', 'second' ]` (193) |
  | B4 | 1 failed. **Matches prediction.** | C7 `expected [] to deeply equal [ 'first' ]` (187) |
  | B5 | 1 failed. **Matches prediction.** | C4 `expected true to be false` after returning to `/app/customers` (153) |

  For each break, every test the Step 3 table assigns to it failed at the assertion for the behavior broken. None of those tests passed, and none failed for an unrelated reason. Tests not assigned to a break were not expected to fail, and passed: C1, C3 and C5 under B1; C1 under B2; and the other seven tests under each of B3, B4 and B5.
- Step 4: `vitest run`: 49 files, 2193/2193 passed. Lint clean, after the fixture change; the first attempt failed, as described above.
- Step 5: committed as `539173e`.

**Task 2: refactor**
- Step 1: `onMobileNavCloseRef`, its sync Effect and the `useRef` import were removed. `const closeMobileNav = useEffectEvent(() => { onMobileNavClose(); })` is called from the Effect keyed on `[pathname]`.
- Step 2: `eslint components/layout/app-sidebar.tsx` exited 0 with no output. No disable comment.
- Step 3: 8/8 passed. `git diff HEAD --stat -- apps/web/lib/app-sidebar.test.tsx` was empty.
- Step 4: all six checks passed.
  - `vitest run`: 49 files, 2193/2193 passed.
  - `pnpm --filter web lint`: clean.
  - `tsc --noEmit`: exit 0.
  - `pnpm --filter web build`: exit 0. All 16 routes were built, and the build left no tracked changes.
  - The `grep` for `useRef` / `onMobileNavCloseRef`: no match.
  - `git diff main --stat`: only `app-sidebar.tsx` (11 lines changed), `lib/app-sidebar.test.tsx` (new) and this plan.
- Step 5: committed as `da0d7b8`.

## Gate outcomes

### M6 — owner review: Accepted (2026-10-23)

The owner reviewed the M6 diff (`49c8636..3099245`) and accepted M6, with one documentation correction. The record's sentence on the break results implied that every test failed under every break. The owner withdrew a concern about C7 after reading the test: C7 does prove that the newest callback is the one called. The sentence was reworded in `ddc6577` to name the tests assigned to each break and the unassigned tests that passed. That commit changed docs only, one sentence.

### M7 — Code Review: Approved for merge (fresh independent review, 2026-10-23)

**Reviewer:** a fresh, independent agent on the most capable model (Opus 5.5), dispatched under `CLAUDE.md`'s standing M7 rule for application-code slices. It did not implement the change. It reviewed `181052a..3099245` against the Accepted spec and the Accepted revision 2 plan, then, in an addendum, `ddc6577`. It used one disposable worktree, which it removed, and left the main checkout clean. This record is written by the implementer and cites that review.

```text
Decision: Approved for merge
Subject: feat/198-sidebar-use-effect-event (local; no PR or CI yet), change set 181052a..ddc6577 (3099245, plus the docs-only ddc6577 in an addendum)
Accepted specification: docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md (§4.7, §6). No amendment (owner decision).
Accepted implementation plan: this file (revision 2; M5 record 49c8636)

Plan tasks reviewed: Task 1 (C1–C8, with the owner-approved fixture change) ✓; Task 2 (refactor) ✓; Task 2 Step 6 (Execution record) ✓

Verified by the reviewer:
- The diff matches Task 2 Step 1 exactly. AppSidebarProps, the markup, the Sheet's onOpenChange and dashboard-layout.tsx are unchanged. Only three files changed: the plan, app-sidebar.tsx and the new test file.
- On HEAD: vitest 49 files, 2193/2193 passed; lint exit 0; tsc --noEmit exit 0; app-sidebar.test.tsx 8/8.
- In a disposable worktree at 539173e: B1, B2 and B3 reproduced as recorded. A reviewer's own B5 variant made C4 fail as assigned. C2, C6 and C8 also failed, because the variant's edit differs from the implementer's. Extra break on HEAD, AppSidebar wrapped in memo(): only C7 failed, with ['first','first'].
- useEffectEvent: in react-dom 19.2.8, the before-mutation pass swaps ref.impl = nextImpl for function components (tag 0) only, not memo (15) or forwardRef (11). It runs before passive Effects. AppSidebar is a plain function component. The event function is called only from the [pathname] Effect, which still runs on mount.
- The fixture change weakens no assertion. Both labels the assertions use are inline, so a missing label would fail the open guards and C1, not pass them vacuously. Only MISSING_MESSAGE errors are swallowed.
- Addendum, ddc6577: docs only, one paragraph. Code and tests are identical to 3099245. The reworded sentence matches the reviewer's own B1–B3 runs; B4 and the implementer's B5 are taken from the record. No new findings, and the decision is unchanged.
Taken from the Execution record (not rerun): build exit 0, B4, the implementer's own B5 edit, the Step 0 baseline.

Blocking findings: None (no merge blockers)

Non-blocking observations:
- Wrapping AppSidebar in memo or forwardRef later would leave a stale onMobileNavClose in this React build. C7 would catch it; a code comment is optional.
- The record does not say at which commit B2 and B3 were run. The reviewer re-ran B1–B3 at 539173e, before the refactor, and they behave as recorded.
- The comment in web-shell-regressions.test.ts ("No DOM test environment exists") is out of date (plan decision e). For M9.
```

### M8 — Refactoring: N/A (2026-10-23)

```text
Decision: N/A
Subject: feat/198-sidebar-use-effect-event; apps/web/components/layout/app-sidebar.tsx, apps/web/lib/app-sidebar.test.tsx
Accepted specification: docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md
Accepted implementation plan: this file (revision 2)
M7 / authorization: Approved for merge (fresh independent review)

Maintainability goals: none worth the risk. The change is 11 lines and already the minimal form the plan named. The M7 suggestion of a code comment about memo/forwardRef is optional, and C7 already fails if AppSidebar is wrapped (shown by the reviewer's memo break).

Verification: Before: as recorded at M6 and M7. After: not run (no change).

Externally observable behavior changes: None

Gate: N/A — proceed to M9.
```

### M9 — Documentation: Complete (2026-10-23)

```text
Decision: Complete
Subject: #198, feat/198-sidebar-use-effect-event
Accepted specification: docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md (no amendment; owner decision)
Accepted implementation plan: this file (revision 2)
M7: Approved for merge (fresh independent review)
M8: N/A

Documentation scope:
- This plan's Status row and Gate outcomes
- docs/superpowers/README.md (plan count)
- apps/web/lib/web-shell-regressions.test.ts:36-37 (one code comment; no assertion)

Updated artifacts:
- This plan, Status row ← M7, M8, M9 and M10 outcomes
- docs/superpowers/README.md: "69 so far" → "70 so far" (`ls docs/superpowers/plans | wc -l` = 70 on this branch) ← this slice's plan
- apps/web/lib/web-shell-regressions.test.ts: the comment "No DOM test environment exists in this repo, so the shell's wiring … is pinned at source level" now says the wiring is pinned at source level and that AppSidebar's mobile nav behavior is rendered under jsdom in lib/app-sidebar.test.tsx (#198) ← plan decision (e); M7 observation 3

Editorial changes:
- The test comment above (a statement that was no longer true)

Content updates:
- Status row; plan count

Not changed: apps/web/README.md. It describes the shell and its guard tests, and nothing it says about the sidebar changed. No spec change.

Verification:
- Links checked: the Status row's #execution-record anchor resolves; the README link to plans/ is unchanged
- Heading hierarchy checked: Gate outcomes holds ### M6, M7, M8, M9, M10 entries
- Status consistency checked: Status row matches the Gate outcomes
- Cross-references checked: plan, spec and issue links unchanged
- Terminology checked: "mobile nav Sheet", "Effect Event" as used in the plan
- Duplicates / outdated refs checked: the stale test comment fixed; no other doc names the removed ref
- The edited test file still passes: vitest lib/web-shell-regressions.test.ts 196/196; eslint exit 0

Gate: Documentation complete. Code/behavior/contracts unchanged by this stage.
```

### M10 — Workflow Validation: does not apply (2026-10-23)

The slice changes no workflow assets: `git diff main -- docs/workflows workflow.yaml .claude` is empty. Per the process spec §2.12, M10 applies only when a slice changes workflow assets.
