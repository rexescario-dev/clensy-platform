# AppSidebar `useEffectEvent` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 2)** at M5, 2026-10-23. M6 not started. |
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

## Gate outcomes

*(Appended after M5.)*
