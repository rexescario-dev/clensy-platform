# Laundry List Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Accepted (revision 2) |
| M5 decision (revision 2) | **Accepted** — 2026-10-10, at `fcb33e5` plus the owner's clarification (both drawer close paths added as explicit browser checks under Re-verify), by the owner. No blocking or major findings. The P2 on Task 5's red count was withdrawn by the reviewer: `60abc` already fails `Number()`, so five of six cases fail first. M6 MUST confirm the red count, the exact error message, and the full Re-verify list, including both close paths, keep the four-path allowlist, and hand off to a fresh M7. Pre-validation counts are author-reported until M6 re-observes them. |
| M5 decision (revision 1) | **Accepted** — 2026-10-10, at `640739f`, by the owner, on the first pass. No blocking or major findings. M6 MUST implement Tasks 1–3 as written, then run Final verification in full: the four-path allowlist (with `use-detail-drawer.ts` unchanged), mutations A–E and the Task 1 negative check, full suites, and the manual browser checks. The Forward-after-close behaviour stays as pinned. M7 MUST be a fresh independent review (`CLAUDE.md`: application code). |
| Date | 2026-10-10 |
| Tracking issue | [#171](https://github.com/rexescario-dev/clensy-platform/issues/171). Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Follows [#163](https://github.com/rexescario-dev/clensy-platform/issues/163) (merged in #170 at `15c45cf`). |
| Scope | Three test files and one module. `apps/web/lib/use-laundry-order-list-url-state.ts` (offset range), its test, `apps/web/lib/use-detail-drawer.test.tsx` (tests only), and `apps/api/test/laundry-order-list-filters.e2e-spec.ts` (one characterization). No API, schema, `@clensy/ui`, `@clensy/web` or page change. `use-detail-drawer.ts` is not modified. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Amendment #164 §8.4.4 (the list: offset paging, page size 20), as already implemented by the [#163 plan](2026-10-10-laundry-order-list-plan.md). This plan closes that plan's two "Deferred" M7 items. It adds no product semantics. |
| Relies on | The #163 plan's URL-state rule: every missing, malformed or unknown URL value falls back to the default. Its Revision 6 `useDetailDrawer` contract: `open`/`close` as on `main`, plus laundry-only `openWithHref`/`closeWithHref`. |
| Authority | Where this plan and an Accepted spec disagree, the spec wins. |
| Edit anchors | Unified diffs against `main` at `15c45cf`. |

**Goal:**
1. **Out-of-range offset.** `OffsetPaging.offset` is a GraphQL `Int` (32-bit signed). A hand-edited URL offset above 2147483647 is rejected by the API, so the list shows its error state. Treat it as malformed (page 1), like any other bad value. `withLaundryPage` must not produce such an offset either.
2. **Untested reset.** Pin the existing `openedHereRef` reset in `useDetailDrawer`'s `close` and `closeWithHref`, which no test covered (#163 M7 P3-1).

## Global Constraints

- `useDetailDrawer` behaviour does not change. Task 3 adds characterization tests only.
- The offset clamp uses the existing fallback (0), so no new UI state is added. `LAUNDRY_ORDER_MAX_OFFSET` is 2147483647, GraphQL's `Int` maximum. A valid offset is still snapped down to a page boundary, so the largest one kept is 2147483640.
- No other list behaviour changes.

## Review Focus

1. **What the reset tests pin.** Once a drawer opened on the page has been closed (`router.back()`), a drawer that reappears without a new open, for example by Forward, is treated as reached directly: `close` uses `router.replace`, and `closeWithHref` uses `replaceState`. That is `main`'s behaviour for `close`, mirrored by `closeWithHref`.
   - Consequence: closing after Forward replaces the drawer entry with the list URL, rather than going Back, so the history then has two identical list entries.
   - This holds only after an in-page close (× calls `router.back()` and resets the flag). If the user leaves the drawer with the browser's Back button instead, `openedHereRef` stays `true`, so Forward then × calls `router.back()` and leaves no duplicate entry (M7 P3-2, added in revision 2).
   - This plan pins the behaviour as it is. Changing it would be a behaviour change for all nine drawer pages, outside #171.
2. **The boundary is the server's.** Task 1 shows that offset 2147483640 returns an empty page and 2147483648 is rejected, so the constant is grounded in the API's behaviour, not assumed.

## Pre-validation (full)

Applied on `feat/171-laundry-list-followups` at `15c45cf`, then removed before this Draft was committed. Every `Expected:` command was run:

| Command | Result |
| --- | --- |
| Task 1 e2e | 7 passed in the file; with `laundry.e2e-spec`, 9 passed. Negative check (`2147483648` → `2147483647`): 1 failed |
| Task 2 red / green | 2 failed / 20 passed (22) → 22 passed |
| Task 3 | 5 passed. Mutation A (no reset in `close`): 1 failed. Mutation B (no reset in `closeWithHref`): 1 failed |
| Mutations C–E (Final verification) | 1 failed each |
| `pnpm --filter web test` / `lint`, `tsc --noEmit -p .`, `pnpm --filter web build` | 666 passed; 0 errors; clean; Next build succeeded |
| `pnpm --filter @clensy/web test` | 402 passed (unchanged package) |
| `eslint` on the e2e file | clean |

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/test/laundry-order-list-filters.e2e-spec.ts` | Modify: one characterization test | 1 |
| `apps/web/lib/use-laundry-order-list-url-state.test.ts` | Modify: two tests | 2 |
| `apps/web/lib/use-laundry-order-list-url-state.ts` | Modify: `LAUNDRY_ORDER_MAX_OFFSET`, parse and `withLaundryPage` | 2 |
| `apps/web/lib/use-detail-drawer.test.tsx` | Modify: a laundry-like consumer and two tests | 3 |

### Task 1: Characterize the API's offset limit

**Characterization test.** It pins existing API behaviour, so it passes on first run.

- [ ] **Step 1:** Apply:

```diff
diff --git a/apps/api/test/laundry-order-list-filters.e2e-spec.ts b/apps/api/test/laundry-order-list-filters.e2e-spec.ts
--- a/apps/api/test/laundry-order-list-filters.e2e-spec.ts
+++ b/apps/api/test/laundry-order-list-filters.e2e-spec.ts
@@ -232,4 +232,15 @@ describe('laundryOrders list filters (e2e)', () => {
     });
     expect(res.body.errors).toBeDefined();
   });
+
+  // #171: `OffsetPaging.offset` is a GraphQL `Int` (32-bit signed). The web
+  // list therefore treats a URL offset above 2147483647 as malformed.
+  it('accepts an offset at the top of the GraphQL Int range and rejects one above it', async () => {
+    const PAGE = `query($o: Int!) { laundryOrders(paging: { limit: 20, offset: $o }) { totalCount nodes { id } } }`;
+    const inRange = await gql(PAGE, { o: 2147483640 });
+    expect(inRange.body.errors).toBeUndefined();
+    expect(inRange.body.data.laundryOrders.nodes).toEqual([]);
+    const above = await gql(PAGE, { o: 2147483648 });
+    expect(above.body.errors).toBeDefined();
+  });
 });
```

- [ ] **Step 2:** Run `pnpm --filter api exec jest --config ./test/jest-e2e.json laundry-order-list-filters laundry.e2e-spec`. Expected: `Tests: 9 passed, 9 total`.
- [ ] **Step 3: Negative check (not committed).** Change `{ o: 2147483648 }` to `{ o: 2147483647 }`. Expected: `Tests: 1 failed, 6 passed` on the file. Revert.
- [ ] **Step 4:** `pnpm --filter api exec eslint test/laundry-order-list-filters.e2e-spec.ts` (no output). Then commit: `test(api): characterize the laundryOrders offset limit (#171)`.

### Task 2: Treat an out-of-range offset as malformed (red first)

- [ ] **Step 1:** Apply the test diff:

```diff
diff --git a/apps/web/lib/use-laundry-order-list-url-state.test.ts b/apps/web/lib/use-laundry-order-list-url-state.test.ts
--- a/apps/web/lib/use-laundry-order-list-url-state.test.ts
+++ b/apps/web/lib/use-laundry-order-list-url-state.test.ts
@@ -52,6 +52,13 @@ describe('parseLaundryOrderListState', () => {
     expect(parseLaundryOrderListState(new URLSearchParams('offset=60')).offset).toBe(60);
   });
 
+  // #171: `OffsetPaging.offset` is a GraphQL Int; the API rejects anything above 2147483647.
+  it('treats an offset outside the GraphQL Int range as malformed', () => {
+    expect(parseLaundryOrderListState(new URLSearchParams('offset=2147483647')).offset).toBe(2147483640);
+    expect(parseLaundryOrderListState(new URLSearchParams('offset=2147483648')).offset).toBe(0);
+    expect(parseLaundryOrderListState(new URLSearchParams('offset=3000000000')).offset).toBe(0);
+  });
+
   it('trims the search and caps it at 200 characters', () => {
     expect(parseLaundryOrderListState(new URLSearchParams('q=%20%20ana%20')).search).toBe('ana');
     expect(parseLaundryOrderListState(new URLSearchParams(`q=${'a'.repeat(250)}`)).search).toHaveLength(200);
@@ -107,6 +114,11 @@ describe('withLaundryFilterChange', () => {
 });
 
 describe('withLaundryPage', () => {
+  it('keeps a page whose offset is the last in the GraphQL Int range, and treats the next as page 1', () => {
+    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 107374183).offset).toBe(2147483640);
+    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 107374184).offset).toBe(0);
+  });
+
   it('maps the 1-based page to an offset of 20 per page', () => {
     expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 1).offset).toBe(0);
     expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 3).offset).toBe(40);
```

- [ ] **Step 2:** Run `pnpm --filter web exec vitest run lib/use-laundry-order-list-url-state.test.ts`. Expected: `Tests 2 failed | 20 passed (22)`.
- [ ] **Step 3:** Apply the module diff:

```diff
diff --git a/apps/web/lib/use-laundry-order-list-url-state.ts b/apps/web/lib/use-laundry-order-list-url-state.ts
--- a/apps/web/lib/use-laundry-order-list-url-state.ts
+++ b/apps/web/lib/use-laundry-order-list-url-state.ts
@@ -37,6 +37,9 @@ export interface LaundryOrderHrefParams {
 }
 
 export const LAUNDRY_ORDER_PAGE_SIZE = 20;
+// `OffsetPaging.offset` is a GraphQL `Int` (32-bit signed); the API rejects
+// anything larger, so a larger offset is treated as malformed (#171).
+export const LAUNDRY_ORDER_MAX_OFFSET = 2_147_483_647;
 export const LAUNDRY_SEARCH_DEBOUNCE_MS = 300;
 export const LAUNDRY_SEARCH_MAX_LENGTH = 200;
 
@@ -84,9 +87,9 @@ export function parseLaundryOrderListState(params: URLSearchParams): LaundryOrde
       ? (fulfillmentRaw as LaundryFulfillmentType)
       : null,
     // Snapped down to a page boundary, so a hand-edited offset never shows
-    // a fractional page.
+    // a fractional page. Outside the GraphQL `Int` range it is malformed.
     offset:
-      Number.isSafeInteger(offsetRaw) && offsetRaw >= 0
+      Number.isSafeInteger(offsetRaw) && offsetRaw >= 0 && offsetRaw <= LAUNDRY_ORDER_MAX_OFFSET
         ? offsetRaw - (offsetRaw % LAUNDRY_ORDER_PAGE_SIZE)
         : DEFAULT_LAUNDRY_ORDER_LIST_STATE.offset,
     search: normalizeLaundrySearch(params.get(PARAM.search) ?? ''),
@@ -192,11 +195,11 @@ export function withLaundryFilterChange(
 }
 
 // Pagination is 1-based in `DataTable`, offset-based in the URL. Anything
-// but a positive safe integer page, or a page whose offset is not a safe
-// integer, means page 1.
+// but a positive safe integer page, or a page whose offset is beyond
+// `LAUNDRY_ORDER_MAX_OFFSET`, means page 1.
 export function withLaundryPage(state: LaundryOrderListState, page: number): LaundryOrderListState {
   const offset = Number.isSafeInteger(page) && page >= 1 ? (page - 1) * LAUNDRY_ORDER_PAGE_SIZE : 0;
-  return { ...state, offset: Number.isSafeInteger(offset) ? offset : 0 };
+  return { ...state, offset: offset <= LAUNDRY_ORDER_MAX_OFFSET ? offset : 0 };
 }
 
 // A sort transition from the table. `null` always restores the default
```

- [ ] **Step 4:** Run again. Expected: `Tests 22 passed (22)`. `pnpm --filter web exec tsc --noEmit -p .` is clean. Commit: `fix(web): treat a laundry list offset beyond GraphQL's Int range as malformed (#171)`.

### Task 3: Pin `useDetailDrawer`'s opened-here reset

**Characterization tests.** They pin existing behaviour, so they pass on first run.

- [ ] **Step 1:** Apply:

```diff
diff --git a/apps/web/lib/use-detail-drawer.test.tsx b/apps/web/lib/use-detail-drawer.test.tsx
--- a/apps/web/lib/use-detail-drawer.test.tsx
+++ b/apps/web/lib/use-detail-drawer.test.tsx
@@ -54,6 +54,23 @@ function BookingsLikePage() {
   );
 }
 
+// Wired like the laundry list: the named entry points, with exact URLs.
+function LaundryLikePage() {
+  const { activeId, closeWithHref, openWithHref } = useDetailDrawer();
+  return (
+    <>
+      <button type="button" onClick={() => openWithHref('/app/bookings?status=A&detail=o1')}>
+        Open o1
+      </button>
+      {activeId ? (
+        <DetailDrawer open onClose={() => closeWithHref('/app/bookings?status=A')} title="Order">
+          <p>{activeId}</p>
+        </DetailDrawer>
+      ) : null}
+    </>
+  );
+}
+
 let container: HTMLDivElement;
 let root: Root;
 
@@ -120,4 +137,36 @@ describe('useDetailDrawer on pages that pass close straight to onClose', () => {
     expect(window.history.pushState).not.toHaveBeenCalled();
     expect(window.history.replaceState).not.toHaveBeenCalled();
   });
+
+  // #171: once a drawer opened here has been closed, one that reappears without a new open (for
+  // example by Forward) counts as reached directly, so it closes with a replace, not Back.
+  it('close resets opened-here: a drawer that reappears afterwards closes with router.replace', () => {
+    nav.query = 'status=A';
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    show('status=A&detail=o1');
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    show('status=A'); // Back landed on the list
+    show('status=A&detail=o1'); // Forward: the drawer reappears with no new open
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
+  });
+
+  it('closeWithHref resets opened-here: a drawer that reappears afterwards closes with replaceState', () => {
+    nav.query = 'status=A';
+    act(() => root.render(<LaundryLikePage />));
+    act(() => button('Open o1').click());
+    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A&detail=o1');
+    show('status=A&detail=o1');
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    show('status=A');
+    show('status=A&detail=o1');
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A');
+    expect(nav.replace).not.toHaveBeenCalled();
+  });
 });
```

- [ ] **Step 2:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.test.tsx`. Expected: `Tests 5 passed (5)`.
- [ ] **Step 3: Failure evidence (not committed).** In `apps/web/lib/use-detail-drawer.ts`, delete `openedHereRef.current = false;`, first in `close` (mutation A), then in `closeWithHref` (mutation B), one at a time. Each must give `Tests 1 failed | 4 passed (5)`. Revert each.
- [ ] **Step 4:** Commit: `test(web): pin useDetailDrawer's opened-here reset (#171)`.

## Revision 2 tasks (M7 notes)

Tasks 1–3 are implemented and M7-approved (`9577172`, `4d1a1fa`, `6e1a87f`). Revision 2 resolves M7's three non-blocking notes, on the owner's instruction ("resolve reviewer raised"):

- **P3-1, harden the over-range e2e assertion:** Task 4.
- **P3-2, complete Review Focus 1:** documentation, already in this revision. Review Focus 1 now covers the browser-Back case.
- **P3-3, reject lenient offset spellings:** Task 5. Parsing accepts only plain decimal digits. Hex, exponents, signs and surrounding spaces become malformed, so the list shows page 1.
  - **Product effect:** a hand-typed `?offset=1e3` now shows page 1, not page 51. Every list-produced URL writes plain digits, so no link the app makes is affected.
  - This applies the #163 URL-state rule (malformed values fall back to the default) more strictly. It adds no new behaviour beyond that rule.

The diffs below are against the M7-approved branch head (`4413351`). M6 applies each one red-first where applicable, one commit per task, then re-runs Final verification.

- [ ] **Task 4: Match the Int coercion error (characterization hardening).**
  1. Apply:

```diff
diff --git a/apps/api/test/laundry-order-list-filters.e2e-spec.ts b/apps/api/test/laundry-order-list-filters.e2e-spec.ts
--- a/apps/api/test/laundry-order-list-filters.e2e-spec.ts
+++ b/apps/api/test/laundry-order-list-filters.e2e-spec.ts
@@ -241,6 +241,9 @@ describe('laundryOrders list filters (e2e)', () => {
     expect(inRange.body.errors).toBeUndefined();
     expect(inRange.body.data.laundryOrders.nodes).toEqual([]);
     const above = await gql(PAGE, { o: 2147483648 });
-    expect(above.body.errors).toBeDefined();
+    // The Int coercion error specifically, not any error.
+    expect(above.body.errors?.[0]?.message).toMatch(
+      /Int cannot represent non 32-bit signed integer value/,
+    );
   });
 });
```

  2. Run `pnpm --filter api exec jest --config ./test/jest-e2e.json laundry-order-list-filters laundry.e2e-spec`. Expected: `Tests: 9 passed`.
  3. Negative check, not committed: change `{ o: 2147483648 }` to `{ o: 'x' }`. That is a different coercion error ("non-integer"). Expected: `1 failed, 6 passed` on the file. Revert.
  4. `eslint` and `prettier --check` on the file are clean.
  5. Commit: `test(api): match the Int coercion error for an over-range offset (#171 M7)`.

- [ ] **Task 5: Only plain decimal digits are an offset (red first).**
  1. Apply the test diff:

```diff
diff --git a/apps/web/lib/use-laundry-order-list-url-state.test.ts b/apps/web/lib/use-laundry-order-list-url-state.test.ts
--- a/apps/web/lib/use-laundry-order-list-url-state.test.ts
+++ b/apps/web/lib/use-laundry-order-list-url-state.test.ts
@@ -52,6 +52,11 @@ describe('parseLaundryOrderListState', () => {
     expect(parseLaundryOrderListState(new URLSearchParams('offset=60')).offset).toBe(60);
   });
 
+  // #171 (M7 P3-3): only plain decimal digits are an offset; `Number()`'s other spellings are not.
+  it.each(['0x7fffffff', '1e3', '2.147483647e9', ' 60 ', '+20', '60abc'])('treats offset=%j as malformed', (raw) => {
+    expect(parseLaundryOrderListState(new URLSearchParams({ offset: raw })).offset).toBe(0);
+  });
+
   // #171: `OffsetPaging.offset` is a GraphQL Int; the API rejects anything above 2147483647.
   it('treats an offset outside the GraphQL Int range as malformed', () => {
     expect(parseLaundryOrderListState(new URLSearchParams('offset=2147483647')).offset).toBe(2147483640);
```

  2. Run `pnpm --filter web exec vitest run lib/use-laundry-order-list-url-state.test.ts`. Expected: `Tests 5 failed | 23 passed (28)`. `60abc` already fails `Number()`, so it passes before the change too.
  3. Apply the module diff:

```diff
diff --git a/apps/web/lib/use-laundry-order-list-url-state.ts b/apps/web/lib/use-laundry-order-list-url-state.ts
--- a/apps/web/lib/use-laundry-order-list-url-state.ts
+++ b/apps/web/lib/use-laundry-order-list-url-state.ts
@@ -80,7 +80,10 @@ export function parseLaundryOrderListState(params: URLSearchParams): LaundryOrde
   const sortOrderRaw = params.get(PARAM.sortOrder);
   const statusRaw = params.get(PARAM.status);
   const fulfillmentRaw = params.get(PARAM.fulfillment);
-  const offsetRaw = Number(params.get(PARAM.offset));
+  // Plain decimal digits only: `Number()` would also accept hex, exponents,
+  // signs and surrounding spaces (#171).
+  const offsetText = params.get(PARAM.offset) ?? '';
+  const offsetRaw = /^\d+$/.test(offsetText) ? Number(offsetText) : Number.NaN;
 
   return {
     fulfillment: FULFILLMENT_TYPES.includes(fulfillmentRaw as LaundryFulfillmentType)
```

  4. Run again. Expected: `Tests 28 passed (28)`. `tsc --noEmit -p .` and eslint are clean.
  5. Commit: `fix(web): accept only plain decimal digits as a laundry list offset (#171 M7)`.

- [ ] **Re-verify.** Run Final verification below. That includes:
  - mutation **F**: `const offsetRaw = /^\d+$/.test(offsetText) ? Number(offsetText) : Number.NaN;` → `const offsetRaw = Number(offsetText);` must give `5 failed`;
  - Task 4's negative check;
  - A–E again;
  - `web` (672 tests at pre-validation), lint, `tsc` and the Next build;
  - the API e2e (9);
  - the manual browser check, plus `/app/laundry?offset=1e3`, which must show page 1;
  - both drawer close paths on `/app/laundry`, each starting from a fresh entry (`page.goto`), recording `history.length` and the URL at every step. The hook's behaviour does not change; these checks only record it (Review Focus 1).
    - **× path:** open a row (+1 entry); × (Back to the list entry); Forward (the drawer reappears); ×. Expected: the URL is the list URL without `detail`; `history.length` is unchanged by the last × (replaced, not pushed); Back from there lands on an identical list URL, the duplicate entry.
    - **Browser-Back path:** open a row (+1 entry); browser Back (the list); Forward (the drawer); ×. Expected: × goes Back, so the URL is the list URL; `history.length` is unchanged; Forward from there reopens the drawer, because the drawer entry still exists and there is no duplicate.

  Then record it, and hand off to a fresh M7.

Revision 2 pre-validation: these diffs were applied to `4413351`, then removed before this Draft was committed. Results:
- Task 4: e2e 9 passed; negative check 1 failed.
- Task 5: RED 5 failed / 23 passed → GREEN 28 passed; mutation F: 5 failed.
- Suites: `web` 672 passed; lint 0 errors; `tsc` clean; Next build succeeded.

## Final verification

- [ ] **Allowlist.** `git diff --name-only 15c45cf...HEAD -- . ':!docs' | sort` equals exactly the four File Map paths. Revision 2 touches no new path.
- [ ] **Mutations.** Apply each alone, run `lib/use-laundry-order-list-url-state.test.ts`, revert. Expected: each gives `1 failed`.
  - C: `Number.isSafeInteger(offsetRaw) && offsetRaw >= 0 && offsetRaw <= LAUNDRY_ORDER_MAX_OFFSET` → `Number.isSafeInteger(offsetRaw) && offsetRaw >= 0`.
  - D: `return { ...state, offset: offset <= LAUNDRY_ORDER_MAX_OFFSET ? offset : 0 };` → `return { ...state, offset: Number.isSafeInteger(offset) ? offset : 0 };`.
  - E: `2_147_483_647` → `2_147_483_648`.

  Also re-observe Task 3's A and B, and Task 1's negative check.
- [ ] **Full suites.** Task 1's e2e; `pnpm --filter web test` (666 at pre-validation), `lint`, `exec tsc --noEmit -p .` and `build`.
- [ ] **Manual browser check.** On `/app/laundry`:
  - `?offset=3000000000` shows page 1 with rows, not the error state.
  - `?offset=2147483647` shows "Page 107374183 of N" with no rows and no error.
  - The #163 bookings direct-link × still closes to the list.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Offset paging, malformed URL values fall back to defaults | §8.4.4; #163 plan (URL state) | 1, 2 |
| `useDetailDrawer` open/close contract unchanged and pinned | #163 plan Revision 6; #163 M7 P3-1 | 3 |

## Deferred

- Changing what "close after Forward" does (Review Focus 1; refined by M7 P3-2: the duplicate list entry arises only after an in-page × close, not after leaving the drawer with the browser Back button). That would be a behaviour change for all drawer pages.

## Gate outcomes

### M5 — Accepted (2026-10-10, first pass)

Accepted at `640739f` by the owner. No blocking or major findings. The owner's minor notes:
1. The Forward-after-close behaviour is unusual but deliberately preserved and deferred.
2. The manual boundary checks must confirm the rendered UI: `?offset=3000000000` shows page 1 with rows, and `?offset=2147483647` shows page 107374183 without an error.
3. The allowlist must be confirmed after implementation.

The reported pre-validation results were not re-run by the owner. M6 re-observes them.

### M6 — Implementation complete (2026-10-10)

Implemented on `feat/171-laundry-list-followups` from the Accepted plan (`640739f`, recorded `74ad167`). Each task applied its diff exactly as embedded in this plan (extracted and `git apply`-ed), one commit each, in order.

| Task | Commit | Evidence |
| --- | --- | --- |
| 1 Offset limit (**characterization**) | `9577172` | 9 passed (with `laundry.e2e-spec`). Failure evidence, not committed: `2147483648` → `2147483647` gave 1 failed / 6 passed. Reverted. eslint clean. |
| 2 Out-of-range offset | `4d1a1fa` | RED 2 failed / 20 passed (22) → GREEN 22 passed. `tsc` clean. |
| 3 Opened-here reset (**characterization**) | `6e1a87f` | 5 passed. Failure evidence, not committed: mutation A (no reset in `close`) and mutation B (no reset in `closeWithHref`) each gave 1 failed / 4 passed. Reverted. |

Final verification:

- Allowlist OK: exactly the four File Map paths. `use-detail-drawer.ts` is unchanged from `15c45cf`.
- Mutations C, D and E each gave 1 failed / 21 passed. All were reverted, and the tree was clean afterwards.
- Full suites:

  | Check | Result |
  | --- | --- |
  | `web` | 666 passed; lint 0 errors; `tsc --noEmit -p .` clean; Next build succeeded |
  | `@clensy/web` | 402 passed |
  | API e2e | 9 passed |

- Manual browser check: this branch's web (production build, port 3999) against this branch's API (port 3002) and the local Postgres. A throwaway `TENANT_OWNER` was used and then deleted.

  | URL | Result |
  | --- | --- |
  | `/app/laundry?offset=3000000000` | "Page 1 of 6", 20 rows, no error text, no alert |
  | `/app/laundry?offset=2147483647` | "Page 107374183 of 6", no rows, "No laundry orders.", no error |
  | `/app/bookings?…&detail=<id>`, then × | `/app/bookings?sortBy=status&sortOrder=asc&limit=20&offset=0`, the drawer closed, +0 history entries, Bookings shown |

Deviation: none.

Next gate: **M7 — Code Review**, by a fresh independent reviewer (`CLAUDE.md`: application code).

### M7 — Approved for merge (2026-10-10, fresh independent review)

A fresh agent context on Opus 5.5 reviewed PR #172 (`15c45cf...7b82083`). It did not implement the change (`CLAUDE.md`: application code). It was read-only, ran its experiments in a temporary worktree it removed, and left the tree clean.

**Decision: Approved for merge. Blocking findings: none.**

The reviewer independently confirmed:

- **Gate order:** M5 record → one commit per task, in plan order. No `Co-Authored-By` or "Generated with" line in any commit or in the PR body.
- **Zero fuzz:** the plan's 4 diffs applied to `15c45cf` with `-F0` reproduce each task commit and the branch tree.
- **Scope:** the allowlist is exact, and `use-detail-drawer.ts` is unchanged.
- **Test-first:** Task 2 RED was 2 failed / 20 passed; GREEN 22 passed.
- **Mutations:** C, D, E (1 failed each) and A, B (1 failed each, the matching test). Control: with both resets removed, `main`'s test file still passes 3/3, confirming the gap.
- **Suites:** `web` 666 passed; `tsc` and lint clean; API e2e 9 passed.
- **API limit:** the negative check fails as expected, and a probe confirms the server limit is exactly the `Int` maximum.
- **Clamp boundaries:** parse and `withLaundryPage` were probed across the boundaries (±, fractional, huge, `MAX_SAFE_INTEGER`, `Infinity`, `NaN`). Every parsed value is a fixed point of serialize → parse.
- **CI** is green on PR #172.

Reported only by M6, not re-run: the Next build, `@clensy/web` 402, and the manual browser checks.

**Non-blocking (P3):**

1. The over-range e2e case asserts only that `errors` is defined. Matching the `Int` coercion message would harden it. The in-range assertion and the negative check already discriminate.
2. Review Focus 1 is accurate but incomplete. Leaving the drawer with the browser Back button, not ×, keeps `openedHereRef` true, so Forward then × calls `router.back()` and leaves no duplicate entry. That behaviour is pre-existing, and the Deferred item now mentions it.
3. Offset parsing accepts lenient numeric spellings via `Number()` (`0x7fffffff`, `1e3`, surrounding spaces). Every result is in range and snapped, so this is harmless and pre-existing.

Next gate: **M8**, then M9 and M10, then closeout. Merge is the owner's decision.

### M8 — N/A (2026-10-10)

```text
Decision: N/A
Subject: PR #172, branch feat/171-laundry-list-followups
M7 / authorization: Approved for merge; M8–M10 per the owner's "fix followups" (the same stage run as #163)
Rationale: the slice is one guard in one module plus tests. There is nothing to restructure without changing behaviour.
The M7 P3s are a test-assertion hardening and pre-existing parsing leniency. Neither is a behaviour-preserving
refactor. P3-1 is noted for a future test pass, and P3-3 needs no action.
No code changed in M8.
```

### M9 — Complete (2026-10-10)

```text
Decision: Complete
Subject: #171, PR #172
Documentation scope:
- apps/web/README.md (one sentence)
- docs/superpowers/plans/2026-10-10-laundry-order-list-plan.md (Deferred list: mark the two items resolved by #171)
- this plan (Deferred wording, Gate outcomes)

Content updates (each traces to M6 or M7 of #171):
- apps/web/README.md: "Parsing validates every value and snaps the offset to a page boundary" now also says that an
  offset beyond GraphQL's `Int` range is treated as malformed (← Task 2).
- #163 plan Deferred: both M7 (revision 6) items now point to #171 as resolved (← M6, M7 of #171).
- This plan's Deferred item now carries the M7 P3-2 refinement.

Editorial changes: none.
Unchanged, with reason: packages/web/README.md (no package change); docs/README.md (no API, schema or tenant change);
no changelog or roadmap exists.
Verification: relative links and anchors in the touched files resolve (scripted scan). Status consistency: plan Accepted,
M6 complete, M7 Approved, M8 N/A, PR #172 open.
Gate: Documentation complete. Code unchanged.
```

### M10 — Accepted, workflow validated (2026-10-10)

The asset inventory is unchanged: nine prompts for M2–M10, plus `prompt-library.md` for M1, with no orphans.

- **§2.5:** the M5 record `74ad167` precedes `9577172`.
- **One PR:** #172 carries the plan, code and docs (§2.8).
- **Providers:** GitHub via `gh` for #171, the branch and PR #172.
- **M7:** a fresh, independent, read-only review on the most capable model.
- **Slice Completion Reports** were emitted at M6 and M7–M10.

The #163 M10 lessons were applied:
- Reviewers used their own scratch directories, and no helper was overwritten.
- The plan named the shared hook's other consumers and tested `close` on a page wired like them.

**Blocking findings:** none.

Gate: **Workflow validated.**

### M5 — Accepted (2026-10-10, revision 2)

Accepted by the owner at `fcb33e5`, with one clarification, applied in the same record commit: explicit browser checks for both drawer close paths (× then Forward then ×; browser Back then Forward then ×), with the expected history behaviour.

Owner notes:
- The P2 on Task 5's red count was raised and then withdrawn: five failures are consistent.
- P3: confirm that the `Int` coercion message is stable. The author captured it from the running API at planning time: `Variable "$o" has invalid value: Int cannot represent non 32-bit signed integer value: 2147483648`. M6 re-observes it.

The pre-validation is author-reported until M6 re-runs it.

### M6 — Revision 2 implemented (2026-10-10)

Implemented from the Accepted revision 2 (`fcb33e5`, recorded `116a838`). Each task applied its diff exactly as embedded in "Revision 2 tasks". The resulting code is byte-identical to the pre-validation.

| Task | Commit | Evidence |
| --- | --- | --- |
| 4 Match the `Int` coercion error | `4c3de3c` | e2e 9 passed. Negative check, not committed: `{ o: 'x' }` gave 1 failed / 6 passed. Reverted. eslint and prettier clean. The message re-observed at planning time is `Variable "$o" has invalid value: Int cannot represent non 32-bit signed integer value: 2147483648`. |
| 5 Plain decimal digits only | `a944012` | RED 5 failed / 23 passed (28). The failing cases were exactly `0x7fffffff`, `1e3`, `2.147483647e9`, `" 60 "` and `+20`; `60abc` passed, as stated. GREEN 28 passed. `tsc` and eslint clean. |

Re-verify:

- **Code allowlist:** OK, the four File Map paths. `use-detail-drawer.ts` is unchanged. `apps/web/README.md` also differs from `main`; that is the M9 documentation edit (`4413351`), outside the code allowlist.
- **Mutations:** A and B gave 1 failed / 4 passed. C, D and E gave 1 failed / 27 passed. F gave 5 failed / 23 passed. All were reverted, and the tree was clean afterwards.
- **Suites:**

  | Check | Result |
  | --- | --- |
  | `web` | 672 passed; lint 0 errors; `tsc` clean; Next build succeeded |
  | `@clensy/web` | 402 passed |
  | API e2e | 9 passed |

- **Manual browser check:** branch web (production build, port 3999) against the branch API (port 3002), with a throwaway owner that was then deleted.

  | Check | Result |
  | --- | --- |
  | `?offset=1e3` | "Page 1 of 7", 20 rows, no error |
  | `?offset=3000000000` | "Page 1 of 7", 20 rows, no error |
  | `?offset=2147483647` | "Page 107374183 of 7", 0 rows, no error |
  | `?offset=40` | "Page 3 of 7", 20 rows (plain digits unaffected) |
  | × path, from `?status=RECEIVED` | `history.length` 8 → open row 9 → × goes Back to the list (9) → Forward shows the drawer (9) → × gives the list URL, length unchanged (replaced) → browser Back lands on an identical list URL. That is the duplicate entry, as documented. |
  | Browser-Back path, from a fresh `?status=RECEIVED` | open row → browser Back (the list) → Forward (the drawer) → × goes Back (the list URL) → Forward reopens the drawer, so the drawer entry survives and there is no duplicate. |
  | Bookings direct-link × | closes to `/app/bookings?sortBy=status&sortOrder=asc&limit=20&offset=0`, +0 entries |

  In the browser-Back run, `history.length` read 9 both before and after opening the row. *Corrected after M7 (P3-2):* the original explanation ("the tab already had about ten navigations") does not hold, because `pushState` always adds an entry after truncating forward entries. The cause is unexplained, so the `history.length` part of this check is **unconfirmed**. The path's behaviour is still evidenced by the URL sequence and by Forward reopening the drawer after ×. The hook is unchanged and unit-pinned (mutations A and B).

Deviation: none.

Next gate: **M7**, a fresh independent review (`CLAUDE.md`: application code).

### M7 — Approved for merge (2026-10-10, fresh independent review of revision 2)

A fresh agent context on Opus 5.5 reviewed revision 2 at head `9f9447f`. It did not implement the change. It was read-only, worked in a temporary worktree it removed, and left the tree clean.

**Decision: Approved for merge. Blocking findings: none.**

The reviewer independently confirmed:

- **Gate order:** the M5 record (`116a838`) precedes `4c3de3c` and `a944012`, one commit per task. No trailers in commits or the PR body.
- **Exact application:** the plan's three revision-2 diffs applied to `4413351` with no fuzz reproduce both commits exactly.
- **Scope:** the code changes are the four File Map paths. The `apps/web/README.md` difference is the docs-only M9 sentence. `use-detail-drawer.ts` is identical to `main`.
- **Task 5 red/green:** RED 5 failed / 23 passed, on exactly the five stated spellings (`60abc` already passed); GREEN 28 passed.
- **Task 5 probes:** empty, zeros, boundary values, hex, binary, octal, exponents, signs, encoded `+`, whitespace, newline, decimals, Arabic-Indic and full-width digits, underscores, `Infinity`, `NaN`, unsafe integers, and 400-digit strings. Every offset the app writes round-trips. The other params are unaffected.
- **Task 4:** the live message is graphql-js's own `GraphQLInt` text. The `{ o: 'x' }` negative check fails as expected.
- **Mutations:** A–F at the recorded counts. Four extra regex mutants were killed. The only survivor, `\d*`, is an equivalent mutant.
- **Suites:** `web` 672; `tsc` and lint clean; API e2e 9.
- **CI** green at `9f9447f`.

Reported only by M6, not re-run: the Next build, `@clensy/web` 402, and the browser checks.

**Non-blocking (P3), resolved in M9 below:**
1. The PR body described revision 1 only.
2. M6's `history.length` explanation for the browser-Back run was wrong; the record above is corrected.
3. `apps/web/README.md` did not say only plain digits are accepted.

The reviewer also judged Review Focus 1 and both close-path checks accurate against `use-detail-drawer.ts`. They rest on an implicit assumption: the list page stays mounted across same-pathname Back and Forward.

### M8 — N/A (2026-10-10, revision 2)

```text
Decision: N/A
Rationale: revision 2 is one guard expression and tests. There is nothing to restructure without changing behaviour.
```

### M9 — Complete (2026-10-10, revision 2)

```text
Decision: Complete
Documentation scope: apps/web/README.md (one clause); PR #172 body; this plan (the M6 record correction above and these records)
Content updates:
- apps/web/README.md: the URL-state sentence now says the offset must be plain decimal digits (← Task 5; M7 P3-3).
- PR #172 body: now describes revisions 1 and 2, including the user-visible `?offset=1e3` → page 1 effect (← M7 P3-1).
- This plan: the M6 revision-2 browser-Back note is corrected to "unconfirmed" (← M7 P3-2).
Verification: relative links and anchors resolve (scripted scan). Status consistency: plan Accepted (revision 2), M6
complete, M7 Approved, M8 N/A.
Gate: Documentation complete. Code unchanged.
```

### M10 — Accepted, workflow validated (2026-10-10, revision 2)

The asset inventory is unchanged. A post-approval revision followed the gates in order: M4 revision → owner M5 (with a clarification applied before M6) → M6 red first → fresh M7 → M8/M9. That honours §2.4 and §2.5 for changed application code.

**Blocking findings:** none.

**Non-blocking observation:** an M6 record gave an explanation the evidence did not support (the `history.length` note). M7 caught it, and it is now corrected. Records should state an anomaly as unexplained rather than guess a cause.

Gate: **Workflow validated.**
