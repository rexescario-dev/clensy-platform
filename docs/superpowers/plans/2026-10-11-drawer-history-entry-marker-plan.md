# Drawer History Entry Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Draft (revision 7); revisions 2–6 implemented; revision 6 approved at M7 |
| M5 decision (revision 6) | **Accepted** — 2026-10-13, at `4f0e026`, by the owner, subject to confirming the file-extension assumption. Confirmed: only `eslint.config.mjs` and `postcss.config.mjs` are non-TS in the scanned roots today, but `apps/web` has `allowJs: true` and Next accepts `.js`/`.jsx` pages. So, as the acceptance allows, the guard also scans JavaScript extensions (one-line filter, folded into Task 6 in the record commit; H13/H14). The aliased `useDetailDrawer` import stays a documented limitation. Run H1–H14, the full `web` suite, lint and `tsc`. M7 MUST be a fresh independent review. |
| M5 decision (revision 5) | **Accepted** — 2026-10-13, at `13863e2`, by the owner, with two test changes applied in the M5 record commit: a TypeScript-syntax-tree detector (so trailing comments and strings never count), and coverage asserting all nine drawer pages. Keep the no-runtime-change decision. Run H1–H7, then the full `web` suite, lint and `tsc`. No browser run. M7 MUST be a fresh independent review. |
| M5 decision (revision 4) | **Accepted** — 2026-10-13, at `b014706`, by the owner. No blocking findings. Keep the synthetic `pageshow` test and G5/G6. Record that a real back/forward-cache restore is **not** browser-verified (Playwright's Chromium disables it): the synthetic event proves the handler's logic, not a real restore. Add an end-to-end check if an environment with the cache enabled becomes available. |
| M5 decision (revision 3) | **Accepted** — 2026-10-13, at `d04212e`, by the owner. No blocking findings. One clarification is an M6 requirement: show that an unrelated traversal cannot clear the guard early and allow a second Back (see Gate outcomes). The browser checks are mandatory against the committed implementation, especially × then the backdrop in one task, and two Escape keydowns. Scope: the hook and its test only. M7 MUST be a fresh independent review. |
| M5 decision (revision 2) | **Accepted** — 2026-10-11, at `d8f0ac2`, by the owner. No blocking findings. M6 MUST run Final verification in full; the production-build browser matrix is required before merge, because the test harness models history and cannot prove the installed Next.js keeps the marker. M7 MUST be a fresh independent review (`CLAUDE.md`: application code). Pre-validation counts are author-reported until M6 re-observes them. |
| M5 decision (revision 1) | Request changes — 2026-10-11, at `b0eec89`. See Gate outcomes. |
| Date | 2026-10-11 |
| Tracking issue | [#173](https://github.com/rexescario-dev/clensy-platform/issues/173). Follows #171 (merged in #172 at `8553a04`), whose plan deferred this behaviour (Review Focus 1). |
| Scope | `apps/web/lib/use-detail-drawer.ts`, `apps/web/lib/use-laundry-order-list-url-state.ts`, and three test files (`use-detail-drawer.test.tsx`, `laundry-list-page.interaction.test.tsx`, and from revision 5 `use-detail-drawer.guard.test.ts`). M8 adds comment-only edits to `app/app/laundry/page.tsx`. No `@clensy/ui`, `@clensy/web`, API or schema change. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.4, the `?detail=` drawer convention. Its close behaviour is "a **requirement, not a prescribed mechanism** — M4 (Implementation Planning) chooses the safest way to satisfy it", and the same-page flag is "one reasonable implementation — not the only one, and not mandated here". This plan replaces the flag. It changes no spec semantics. For the laundry list it relies on the [#163 plan](2026-10-10-laundry-order-list-plan.md) (native History API URL writes, `openWithHref`/`closeWithHref`). |
| Authority | Where this plan and an Accepted spec disagree, the spec wins. |
| Edit anchors | Unified diffs against `main` at `8553a04`. |

**Goal:** fix the duplicate list history entry on all nine drawer pages. Today `useDetailDrawer` decides between Back and replace with an in-memory flag (`openedHereRef`). After open → × → browser Forward → ×, the flag is false while the user is on an entry the page itself pushed. So × replaces that entry with the list URL, leaving two identical list entries: one Back press appears to do nothing, and Forward to the drawer is lost.

**Approach:** put the fact on the history entry.
- **On open,** `open` and `openWithHref` push the drawer entry with the native History API and a marker in `history.state`: `{ __clensyDetailDrawer: <paramName> }`.
- **On close,** `close` and `closeWithHref` go Back when the current entry carries the marker for their param. Otherwise they replace the entry as today (`router.replace` / `replaceState`), so a direct link, bookmark or new tab never leaves the app.
- **The flag** is removed.

## Revision log

**Revision 7** (owner decision, 2026-10-13, on the revision 6 M7 P3s: "fix all three"):
- **P3-1:** the guard also catches `refresh` read from a `useRouter()` value without calling it (`onClick={router.refresh}`, `startTransition(router.refresh)`, `router['refresh']`, `useRouter().refresh`), and `refresh` destructured from a router variable.
- **P3-2:** it skips gitignored output (`public`, `dist`, `build`, `coverage`) and every hidden directory.
- **P3-3:** each file is parsed as its extension says (TS, TSX, JS or JSX).
- **The hook comment** no longer claims the guard catches every case; it points at the plan's limits.
- **P3-4:** the File Map, the revision 2 allowlist wording and the Deferred bullet are corrected.

**Revision 6** (M7 return of revision 5, 2026-10-13):
- **P1:** the guard scans all of `apps/web` (skipping `node_modules`, `.next` and `.turbo`), plus `packages/web/src` and `packages/ui/src`. It now covers the dashboard shell mounted around every drawer page, and any server-action file.
- **P3-1:** it also catches `x['refresh']()` and `refresh` destructured from `useRouter()`.
- **P3-3:** coverage finds hook calls from the syntax tree, across the whole scan.
- **P3-5:** the test header says "a server action that revalidates, refreshes or redirects".
- **The hook comment** names the scanned roots, so it no longer overclaims.
- **P2:** the stale revision 5 Why/Scope text and the header Scope row are corrected.

**Revision 5** (owner request, 2026-10-13: "fix that as well", the deferred marker loss on `router.refresh()` / server actions; the owner chose the guard-test option):
- **A guard test** fails if a `router.refresh()`, a `'use server'` module or function, `useActionState` or `useFormState` appears where a drawer could be open.
- **No runtime change.** Next 16.3.1 rewrites the entry with only `{__NA, tree}` (`HistoryUpdater`, `app-router.js:51-66`) and exposes no event to re-mark from, so a runtime fix would mean wrapping Next's patched `history.replaceState`. The owner declined that as fragile.

**Revision 4** (owner decision, 2026-10-13, on the revision 3 M7 P2-1: "Fix in this PR"):
- The guard is also released on `pageshow` with `persisted`, a back/forward-cache restore.
- The header comment is tightened for M7 P3-2: a server-action redirect pushes a new, unmarked entry.
- The revision 3 "Risk considered" paragraph is corrected for P3-1 under "Revision 4 tasks".

**Revision 3** (owner request, 2026-10-13, after M7 approved revision 2: "lets do that now. append to this PR"):
- **M7 P3-1, the double close,** is now fixed in this PR instead of deferred. A pending-Back guard means a second close before the browser reports the first Back is ignored.
- **M7 P3-2, `router.refresh()`,** is documented in the hook's header comment instead of only in Deferred. There is no behaviour change for it.
- **The #161 follow-up** is recorded as a comment on issue #161: once laundry leaves the drawer, remove `openWithHref`/`closeWithHref` and the marker copy in `setState`, unless another page uses them by then.

See "Revision 3 tasks".

**Revision 2** answers the first M5 review (request changes):

| Review point | Resolution |
| --- | --- |
| 1. The marker identifies an entry, not what is behind it | New section **The invariant: why Back is safe**: the entry behind a marked drawer entry is always the list entry it was pushed from. Two new hook tests: navigate away and return; and the list entry's filters changed after the drawer was opened. A browser check of "navigate away and return" in two ways, on two pages. The one visible consequence is documented as Review Focus 4. |
| 2. `startAt()` does not create a fresh history stack | The hook tests no longer use jsdom's real, shared history. They run on a harness that owns the whole stack (`nav.entries`, with each entry's state in `nav.states`), like the laundry interaction harness. `start(url, before)` builds an explicit stack for every test. The direct-link tests put another page behind the drawer entry (`/app/jobs`) and assert that × never goes Back and that entry is untouched. |
| 3. All nine pages change | **Regression matrix** below: every one of the nine pages, in a production build. Also, a call-site audit: every `open` caller and every `close` caller is listed. |
| 4. Framework-version sensitivity | The Next.js evidence is pinned to the installed version (16.3.1; `package.json` allows `^16.3.1`). Final verification now checks the installed version first, and re-runs the matrix on a production build. If the version differs, the source checks below are repeated before merge. |

## Why it works with Next.js 16.3.1 (checked in source and in a browser)

The installed version is `next@16.3.1` (`node -p "require('next/package.json').version"` in `apps/web`).
- **Native pushes keep the marker.** Next patches `history.pushState`/`replaceState` and copies its own keys (`__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`) into the state object passed in, so custom keys survive. Source: `next/dist/client/components/app-router.js`, `copyNextJsInternalHistoryState` (line 84).
- **Back/Forward keep it.** Back/Forward are "traverse" navigations, which preserve custom history state (`preserveCustomHistoryState: true`, `segment-cache/navigation.js` line 492). Push and replace navigations use `false` (lines 350, 461); that only matters for entries `router.push`/`replace` create, which never carry the marker.
- **A refresh keeps it,** because the browser keeps `history.state` across a reload.

## The invariant: why Back is safe

**Claim.** When the current entry B carries this hook's marker, the entry immediately behind B is the list entry A that was current when B was pushed: the same list page, in the same tab.

**Why.**
1. B only exists because `open`/`openWithHref` called `pushState` while A was the current entry. A push always places the new entry directly after the current one, and drops every entry that was ahead of it.
2. After that, the stack can only change in two ways. A push from some entry drops everything ahead of that entry. A `replaceState` rewrites only the current entry. Neither ever inserts an entry between two existing ones.
3. So while B exists, A stays directly behind it. Leaving B by a link, a typed address or the sidebar adds entries ahead of B, never behind it. Back, Forward and refresh only move between entries or reload them.
4. If anything is pushed from A itself (A was current), B is dropped. Its marker then goes with it, so there is no marked entry left to close from.

**What can differ.** A's URL can change while the user is on A: the laundry list's `setState` writes `replaceState`, and the other pages' list updates write `router.replace`. So after "×, change a filter, Forward, ×", Back lands on A's new filters, not on B's URL minus `detail`. That is still the same list page, as the user last left it, and it is how browser Back always behaves. Before this change, the same sequence produced the duplicate entry. The behaviour is pinned by a test and is Review Focus 4.

**What would break it.** Only a writer that put this marker on an entry this hook did not push. The marker key is private to `use-detail-drawer.ts`. The only other writer is the laundry `setState`, which copies the current entry's marker onto that same entry (`drawerEntryState()`), so it never creates one.

## Global Constraints

- `close` still takes no argument. The eight other pages pass it straight to `onClose`, and #163's regression test still holds.
- A drawer entry not pushed by this hook (direct link, bookmark, new tab) still closes by replacement. It never goes Back out of the app.
- List updates on the laundry page keep the marker: `setState` writes `replaceState(drawerEntryState(), …)`. The marker is passed as a fresh object, because a state object that already carries Next's keys would skip Next's URL sync.
- The other eight pages now open drawers with a native `pushState` instead of `router.push`: the same URL, synced into `useSearchParams` (Next's Native History API).

## Review Focus

1. **`open` moves from `router.push` to native `pushState`** on all nine pages. That is required to attach the marker, since `router.push` takes no history state. See the regression matrix.
2. **Refresh now goes Back** for a drawer the page pushed. Before, the flag was lost on reload and × replaced the entry, which also left a duplicate. The marker survives a reload, so × returns to the list entry behind it.
3. **The marker is per param name** (`detail`), so a marker written for another param never counts. One test covers this.
4. **× lands on the list entry as the user last left it.** If the user goes back to the list, changes a filter, then goes Forward to the drawer and closes it, they see the changed filters. Before this change, they saw the drawer URL minus `detail`, plus a duplicate entry.

## Call-site audit

`grep -rn "openDetail(\|closeDetail" apps/web/app` at `8553a04`:
- **`open`:** each of the eight pages calls `openDetail(row.id)` from `onRowClick`. Jobs also calls `openDetail(newId)` after creating a job. No caller reads a return value or awaits it.
- **`close`:** each of the eight passes `closeDetail` as the drawer's `onClose`. The bookings drawer also calls `onClose()` after a delete. No other caller.
- **Laundry** uses only `openWithHref`/`closeWithHref` and `setState`.

## Regression matrix (pre-validation, production build, Chromium, `next@16.3.1`)

Each row: a fresh tab on `/app/<page>?detail=<id>`, then:
- (a) a direct-link drawer, with no marker: × removes `detail`, stays on the page, and adds no entry;
- (b) a row click opens the drawer: the marker is `detail`, exactly one entry is added, the record loads, and scroll is kept;
- (c) × goes Back to the list;
- (d) Forward shows the same record again;
- (e) × goes Back again, with no entry added;
- (f) Forward still reopens the drawer.

| Page | a | b | c | d | e | f |
| --- | --- | --- | --- | --- | --- | --- |
| bookings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| jobs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cleaners | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| catalog | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| catalog/add-ons | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cleaners/teams | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| customers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| laundry | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Navigate away and return** (laundry and bookings, each in two ways). Open a drawer from a row, leave for `/app/customers` (once by a typed address, a full page load; once by an in-app link, a client navigation), then press Back. Results:
- The drawer entry returns, with the marker intact.
- × lands on `/app/<page>`, with no extra entry.
- Forward reopens the drawer.

All four cases pass. The drawer's overlay covers the sidebar, so leaving by the sidebar while a drawer is open is not possible.

**Also checked (first pre-validation):**
- A refresh on a pushed laundry drawer, then × goes Back to the list.
- Next's own keys sit alongside the marker.
- **The owner tried it hands-on and confirmed it works.**

Local data had no jobs, cleaners or add-ons. One of each was created for the matrix and deleted afterwards, together with the throwaway login.

## Pre-validation (full)

Applied on `fix/173-drawer-history-entry-marker` at `8553a04`, then removed before this Draft was committed.

| Check | Result |
| --- | --- |
| Hook tests (new file) against `main`'s hook | 6 failed / 4 passed (10). The failures are exactly the six "pushed here" cases. The four direct-link cases pass on `main` too. |
| Laundry interaction tests (updated) against `main`'s code | 2 failed / 15 passed (17). The failures are exactly the two new #173 cases. |
| With the fix | 10 + 17 = 27 passed |
| Mutations | M1 `close` ignores the marker: 5 failed. M2 push without the marker: 9 failed. M3 list update drops the marker: 1 failed. M4 `closeWithHref` ignores the marker: 4 failed. M5 marker param not checked: 1 failed. M6 `close` always goes Back: 3 failed. |
| `pnpm --filter web test` / `lint` / `tsc --noEmit -p .` / `build` | 679 passed; exit 0; clean; Next build succeeded |
| `pnpm --filter @clensy/web test` | 402 passed (unchanged package) |
| Browser | the regression matrix above |

## File Map

| File | Change |
| --- | --- |
| `apps/web/lib/use-detail-drawer.test.tsx` | Rewrite: a harness-owned history stack; direct-link, Forward, refresh, navigate-away, changed-filter and param cases |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Modify: per-entry `history.state` in the harness; two #173 tests |
| `apps/web/lib/use-detail-drawer.ts` | Modify: marker push and close decision; `drawerEntryState`, `isDrawerEntryPushedHere` |
| `apps/web/lib/use-laundry-order-list-url-state.ts` | Modify: `setState` keeps the marker |
| `apps/web/lib/use-detail-drawer.guard.test.ts` | Add (revision 5; widened in revisions 6–7): a guard against marker-dropping refreshes and server actions |
| `apps/web/app/app/laundry/page.tsx` | M8, comment-only: the drawer-close comment |

### Task 1: Tests first (red)

- [ ] **Step 1:** Apply the hook test diff:

```diff
diff --git a/apps/web/lib/use-detail-drawer.test.tsx b/apps/web/lib/use-detail-drawer.test.tsx
--- a/apps/web/lib/use-detail-drawer.test.tsx
+++ b/apps/web/lib/use-detail-drawer.test.tsx
@@ -7,21 +7,30 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 // Regression (#163 M7): eight pages (bookings, billing, jobs, cleaners,
 // catalog, catalog/add-ons, cleaners/teams, customers) pass `close`
 // straight to a drawer's `onClose`, and `DetailDrawer` wires that to its ×
-// button's `onClick`, so × calls `close(clickEvent)`. Whatever the laundry
-// list needs from this hook, `open` and `close` keep their contract for
-// those pages: router navigation, never a URL taken from an argument.
+// button's `onClick`, so × calls `close(clickEvent)`. `close` must never
+// read a URL from an argument.
+//
+// #173: whether × goes Back or replaces the entry follows a marker on the
+// current history entry, not component memory. The harness owns the whole
+// history stack (`nav.entries`, with each entry's `history.state` in
+// `nav.states`), so every test starts from an explicit stack and Back /
+// Forward / `router.back()` move through it exactly as a browser does:
+// `window.location` and `history.state` follow the current entry, and a
+// `popstate` fires.
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 
 const nav = vi.hoisted(() => ({
   back: vi.fn(),
+  entries: [] as string[],
+  index: 0,
   listeners: new Set<() => void>(),
   push: vi.fn(),
-  query: '',
   replace: vi.fn(),
+  states: [] as unknown[],
 }));
 
 vi.mock('next/navigation', () => ({
-  usePathname: () => '/app/bookings',
+  usePathname: () => window.location.pathname,
   useRouter: () => ({ back: nav.back, push: nav.push, replace: nav.replace }),
   useSearchParams: () => {
     const query = useSyncExternalStore(
@@ -29,7 +38,7 @@ vi.mock('next/navigation', () => ({
         nav.listeners.add(listener);
         return () => nav.listeners.delete(listener);
       },
-      () => nav.query,
+      () => window.location.search,
     );
     return new URLSearchParams(query);
   },
@@ -71,30 +80,72 @@ function LaundryLikePage() {
   );
 }
 
+const nativeReplaceState = window.history.replaceState.bind(window.history);
+
 let container: HTMLDivElement;
 let root: Root;
 
-function show(query: string) {
+function notify() {
+  for (const listener of nav.listeners) listener();
+}
+
+// Applies the current entry to `window.location` and `history.state`.
+function showEntry() {
+  nativeReplaceState(nav.states[nav.index] ?? null, '', nav.entries[nav.index]);
+}
+
+function traverse(delta: number) {
   act(() => {
-    nav.query = query;
-    for (const listener of nav.listeners) listener();
+    nav.index += delta;
+    showEntry();
+    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
+    notify();
   });
 }
 
+// A fresh stack: `before` are earlier entries (oldest first), all without
+// state; the current entry is `url`, also without state.
+function start(url: string, before: string[] = []) {
+  nav.entries = [...before, url];
+  nav.states = nav.entries.map(() => null);
+  nav.index = nav.entries.length - 1;
+  showEntry();
+}
+
 function button(label: string): HTMLButtonElement {
   return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
     (candidate) => candidate.textContent === label || candidate.getAttribute('aria-label') === label,
   )!;
 }
 
+function drawerShown(): boolean {
+  return container.querySelector('[aria-label="Close"]') !== null;
+}
+
+function remount(page: () => React.JSX.Element) {
+  act(() => root.unmount());
+  root = createRoot(container);
+  act(() => root.render(page()));
+}
+
 beforeEach(() => {
   nav.back.mockReset();
+  nav.back.mockImplementation(() => traverse(-1));
   nav.push.mockReset();
   nav.replace.mockReset();
-  nav.query = '';
-  window.history.replaceState(null, '', '/app/bookings');
-  vi.spyOn(window.history, 'pushState');
-  vi.spyOn(window.history, 'replaceState');
+  vi.spyOn(window.history, 'pushState').mockImplementation((data, _unused, url) => {
+    nav.entries = [...nav.entries.slice(0, nav.index + 1), String(url)];
+    nav.states = [...nav.states.slice(0, nav.index + 1), data];
+    nav.index += 1;
+    showEntry();
+    notify();
+  });
+  vi.spyOn(window.history, 'replaceState').mockImplementation((data, _unused, url) => {
+    nav.entries[nav.index] = String(url);
+    nav.states[nav.index] = data;
+    showEntry();
+    notify();
+  });
   container = document.createElement('div');
   document.body.append(container);
   root = createRoot(container);
@@ -106,67 +157,139 @@ afterEach(() => {
   vi.restoreAllMocks();
 });
 
-describe('useDetailDrawer on pages that pass close straight to onClose', () => {
-  it('closes a drawer reached by a direct link with router.replace of the URL without detail', () => {
-    nav.query = 'status=A&detail=abc';
+describe('useDetailDrawer: direct links never go Back', () => {
+  it('replaces a direct-link drawer with the list URL, even with another app page behind it', () => {
+    start('/app/bookings?status=A&detail=abc', ['/app/jobs']);
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Close').click());
+    expect(nav.back).not.toHaveBeenCalled();
     expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
     expect(nav.replace).toHaveBeenCalledTimes(1);
-    expect(window.history.replaceState).not.toHaveBeenCalled();
+    expect(nav.index).toBe(1); // still on the same entry; /app/jobs is untouched
     expect(window.history.pushState).not.toHaveBeenCalled();
-    expect(window.location.pathname).toBe('/app/bookings');
   });
 
   it('closes a direct-link drawer whose only param is detail to the bare path', () => {
-    nav.query = 'detail=abc';
+    start('/app/bookings?detail=abc');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Close').click());
     expect(nav.replace).toHaveBeenCalledWith('/app/bookings');
+    expect(nav.back).not.toHaveBeenCalled();
+  });
+
+  it('treats a marker for another param name as not pushed here', () => {
+    start('/app/bookings?status=A&detail=abc', ['/app/bookings?status=A']);
+    nav.states[1] = { __clensyDetailDrawer: 'other' };
+    showEntry();
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Close').click());
+    expect(nav.back).not.toHaveBeenCalled();
+    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
   });
 
-  it('opens with router.push and closes a drawer opened here with router.back', () => {
-    nav.query = 'status=A';
+  it('closeWithHref replaces an entry it did not push', () => {
+    start('/app/bookings?status=A&detail=o1', ['/app/jobs']);
+    act(() => root.render(<LaundryLikePage />));
+    act(() => button('Close').click());
+    expect(nav.back).not.toHaveBeenCalled();
+    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A');
+    expect(nav.entries).toEqual(['/app/jobs', '/app/bookings?status=A']);
+  });
+});
+
+describe('useDetailDrawer: entries this page pushed go Back to the list entry behind them', () => {
+  it('opens with a marked native push and closes it with router.back', () => {
+    start('/app/bookings?status=A');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Open o1').click());
-    expect(nav.push).toHaveBeenCalledWith('/app/bookings?status=A&detail=o1');
-    show('status=A&detail=o1');
+    expect(window.history.pushState).toHaveBeenCalledWith({ __clensyDetailDrawer: 'detail' }, '', '/app/bookings?status=A&detail=o1');
+    expect(nav.push).not.toHaveBeenCalled();
+    expect(drawerShown()).toBe(true);
     act(() => button('Close').click());
     expect(nav.back).toHaveBeenCalledTimes(1);
     expect(nav.replace).not.toHaveBeenCalled();
-    expect(window.history.pushState).not.toHaveBeenCalled();
-    expect(window.history.replaceState).not.toHaveBeenCalled();
+    expect(nav.index).toBe(0);
+    expect(window.location.search).toBe('?status=A');
   });
 
-  // #171: once a drawer opened here has been closed, one that reappears without a new open (for
-  // example by Forward) counts as reached directly, so it closes with a replace, not Back.
-  it('close resets opened-here: a drawer that reappears afterwards closes with router.replace', () => {
-    nav.query = 'status=A';
+  // #173: the regression. Before, the in-memory flag was false after × then
+  // Forward, so the second × replaced the entry with a duplicate list URL.
+  it('goes Back again when the drawer reappears through Forward, and the drawer entry survives', () => {
+    start('/app/bookings?status=A');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Open o1').click());
-    show('status=A&detail=o1');
+    act(() => button('Close').click());
+    traverse(1); // Forward: the drawer entry, marker intact
+    expect(drawerShown()).toBe(true);
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(2);
+    expect(nav.replace).not.toHaveBeenCalled();
+    expect(nav.entries).toEqual(['/app/bookings?status=A', '/app/bookings?status=A&detail=o1']);
+    expect(nav.index).toBe(0);
+  });
+
+  it('goes Back after the page remounts on the same marked entry (a refresh)', () => {
+    start('/app/bookings?status=A');
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    remount(() => <BookingsLikePage />); // fresh hook, same marked entry
     act(() => button('Close').click());
     expect(nav.back).toHaveBeenCalledTimes(1);
-    show('status=A'); // Back landed on the list
-    show('status=A&detail=o1'); // Forward: the drawer reappears with no new open
+    expect(nav.index).toBe(0);
+    expect(window.location.search).toBe('?status=A');
+  });
+
+  // The invariant: history only changes at its tip (a push truncates forward
+  // entries) and `replaceState` only rewrites the current entry, so the
+  // entry behind a marked drawer entry stays the list entry it was pushed
+  // from, whatever the user does after it.
+  it('goes Back to the list entry after navigating away to another page and returning', () => {
+    start('/app/bookings?status=A');
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    act(() => root.unmount()); // the user leaves for another page (a router push)
+    act(() => {
+      nav.entries = [...nav.entries.slice(0, nav.index + 1), '/app/jobs'];
+      nav.states = [...nav.states.slice(0, nav.index + 1), null];
+      nav.index += 1;
+      showEntry();
+    });
+    traverse(-1); // browser Back to the marked drawer entry
+    root = createRoot(container);
+    act(() => root.render(<BookingsLikePage />));
+    expect(drawerShown()).toBe(true);
     act(() => button('Close').click());
     expect(nav.back).toHaveBeenCalledTimes(1);
-    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
+    expect(nav.index).toBe(0);
+    expect(window.location.pathname + window.location.search).toBe('/app/bookings?status=A');
   });
 
-  it('closeWithHref resets opened-here: a drawer that reappears afterwards closes with replaceState', () => {
-    nav.query = 'status=A';
+  // Documented behaviour (plan Review Focus): Back lands on the list entry
+  // as it is now. If the user changed that entry's filters in the meantime
+  // (× back to it, change a filter, Forward), × returns to those filters,
+  // not to the drawer URL minus `detail`. It is still the same list page.
+  it('lands on the list entry as the user last left it, if its filters changed after the drawer was opened', () => {
+    start('/app/bookings?status=A');
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    act(() => button('Close').click());
+    act(() => window.history.replaceState(null, '', '/app/bookings?status=B')); // a list update on the list entry
+    traverse(1);
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(2);
+    expect(window.location.pathname + window.location.search).toBe('/app/bookings?status=B');
+  });
+
+  it('closeWithHref goes Back for an entry it pushed, after Forward too, and never replaces it', () => {
+    start('/app/bookings?status=A');
     act(() => root.render(<LaundryLikePage />));
     act(() => button('Open o1').click());
-    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A&detail=o1');
-    show('status=A&detail=o1');
+    expect(window.history.pushState).toHaveBeenCalledWith({ __clensyDetailDrawer: 'detail' }, '', '/app/bookings?status=A&detail=o1');
     act(() => button('Close').click());
-    expect(nav.back).toHaveBeenCalledTimes(1);
-    show('status=A');
-    show('status=A&detail=o1');
+    traverse(1);
     act(() => button('Close').click());
-    expect(nav.back).toHaveBeenCalledTimes(1);
-    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A');
-    expect(nav.replace).not.toHaveBeenCalled();
+    expect(nav.back).toHaveBeenCalledTimes(2);
+    expect(window.history.replaceState).not.toHaveBeenCalled();
+    expect(nav.entries).toEqual(['/app/bookings?status=A', '/app/bookings?status=A&detail=o1']);
   });
 });
```

- [ ] **Step 2:** Apply the laundry harness diff:

```diff
diff --git a/apps/web/lib/laundry-list-page.interaction.test.tsx b/apps/web/lib/laundry-list-page.interaction.test.tsx
--- a/apps/web/lib/laundry-list-page.interaction.test.tsx
+++ b/apps/web/lib/laundry-list-page.interaction.test.tsx
@@ -20,6 +20,8 @@ const ORDER_ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';
 
 const nav = vi.hoisted(() => ({
   entries: [] as string[],
+  // `history.state` per entry, parallel to `entries` (#173: the drawer marker).
+  entryStates: [] as unknown[],
   holdRenders: false,
   index: 0,
   listeners: new Set<() => void>(),
@@ -119,9 +121,10 @@ function notify() {
   for (const listener of nav.listeners) listener();
 }
 
-// The entry the fake history is on, applied to `window.location`.
+// The entry the fake history is on, applied to `window.location` and
+// `history.state`.
 function showEntry() {
-  nativeReplaceState(null, '', nav.entries[nav.index]);
+  nativeReplaceState(nav.entryStates[nav.index] ?? null, '', nav.entries[nav.index]);
 }
 
 function goBack() {
@@ -149,6 +152,7 @@ function url(): URLSearchParams {
 // `history` holds the entries before the current one, oldest first.
 function start(query = '', hash = '', history: string[] = []) {
   nav.entries = [...history.map((entry) => `/app/laundry?${entry}`), `/app/laundry${query ? `?${query}` : ''}${hash}`];
+  nav.entryStates = nav.entries.map(() => null);
   nav.index = nav.entries.length - 1;
   showEntry();
   nav.rendered = window.location.search;
@@ -199,14 +203,16 @@ beforeEach(() => {
   nav.orderQueryIds = [];
   nav.queryVariables = [];
   nav.routerCalls = [];
-  vi.spyOn(window.history, 'pushState').mockImplementation((_data, _unused, href) => {
+  vi.spyOn(window.history, 'pushState').mockImplementation((data, _unused, href) => {
     nav.entries = [...nav.entries.slice(0, nav.index + 1), String(href)];
+    nav.entryStates = [...nav.entryStates.slice(0, nav.index + 1), data];
     nav.index += 1;
     showEntry();
     if (!nav.holdRenders) notify();
   });
-  vi.spyOn(window.history, 'replaceState').mockImplementation((_data, _unused, href) => {
+  vi.spyOn(window.history, 'replaceState').mockImplementation((data, _unused, href) => {
     nav.entries[nav.index] = String(href);
+    nav.entryStates[nav.index] = data;
     showEntry();
     if (!nav.holdRenders) notify();
   });
@@ -340,6 +346,32 @@ describe('/app/laundry list interactions', () => {
     expect(nav.routerCalls).toEqual([]);
   });
 
+  // #173: the drawer entry carries a history-state marker, so × after Forward goes Back again
+  // instead of replacing the entry with a duplicate list URL.
+  it('goes Back again when the drawer reappears through Forward, leaving no duplicate entry', () => {
+    start('status=PAID');
+    act(() => clickRow());
+    expect(nav.entryStates[1]).toEqual({ __clensyDetailDrawer: 'detail' });
+    act(() => button('Close').click()); // Back
+    goForward();
+    expect(url().get('detail')).toBe(ORDER_ID);
+    act(() => button('Close').click()); // Back again, not a replace
+    expect(nav.index).toBe(0);
+    expect(nav.entries).toHaveLength(2);
+    expect(new URLSearchParams(nav.entries[1].split('?')[1]).get('detail')).toBe(ORDER_ID); // the drawer entry survives
+    expect(nav.routerCalls).toEqual([]);
+  });
+
+  it('keeps the drawer marker through a list update made while the drawer is open', () => {
+    start('status=PAID');
+    act(() => clickRow());
+    act(() => selectStatus('READY')); // replaceState on the drawer entry
+    expect(nav.entryStates[1]).toEqual({ __clensyDetailDrawer: 'detail' });
+    act(() => button('Close').click());
+    expect(nav.index).toBe(0); // went Back, not replaced
+    expect(nav.entries).toHaveLength(2);
+  });
+
   it('lets Back and Forward restore the URL, controls, query and drawer of the entry the user goes to', () => {
     start('status=PAID');
     act(() => selectStatus('READY'));
```

- [ ] **Step 3:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.test.tsx`. Expected: `Tests 6 failed | 4 passed (10)`. Run `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`. Expected: `Tests 2 failed | 15 passed (17)`, and the failures are the two #173 tests.

### Task 2: The marker (green)

- [ ] **Step 1:** Apply:

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -1,6 +1,6 @@
 'use client';
 import { usePathname, useRouter, useSearchParams } from 'next/navigation';
-import { useCallback, useRef } from 'react';
+import { useCallback } from 'react';
 
 // Resolves the "close behavior" question spec §4.4 deliberately leaves as a
 // plan-level implementation decision (design doc §4.4: "A same-page-origin
@@ -10,36 +10,62 @@ import { useCallback, useRef } from 'react';
 //
 // Why this matters: the drawer's URL is a `?detail=<id>` search param on the
 // list page, not a nested route (§4.4). Closing it must always land back on
-// the plain list URL. If the drawer was opened by a row click (`open()`
-// below pushed a new history entry on top of the list), `router.back()` is
-// correct and preserves native back/forward semantics. But if the drawer's
-// URL was reached directly — a shared link, a bookmark, a browser refresh —
-// there is no guaranteed list-page history entry to go back to; blindly
-// calling `router.back()` could navigate somewhere outside the app entirely
-// (or nowhere, if there's no history at all). `openedHereRef` distinguishes
-// the two cases: it's only set to `true` by this hook's own `open()` or
-// `openWithHref()` call, never by the initial mount reading a pre-existing
-// `?detail=` param, so a direct/shared link always takes the replace branch
+// the plain list URL. If this page pushed the drawer's history entry (a row
+// click), `router.back()` is correct and preserves native back/forward
+// semantics. But if the drawer's URL was reached directly (a shared link, a
+// bookmark, a new tab), there is no guaranteed list-page entry to go back
+// to; `router.back()` could leave the app. So that case replaces the entry
 // instead (`router.replace()` in `close`, a native `replaceState` in
 // `closeWithHref`).
+//
+// The "pushed here" fact lives on the history entry itself, as a marker in
+// `history.state`, not in component memory (#173). A memory flag is lost or
+// stale after Back/Forward: open, ×, Forward, × used to replace an entry
+// this page had pushed, leaving two identical list entries. Next.js keeps
+// custom `history.state` across Back/Forward (traverse navigations preserve
+// it) and copies its own keys into the state object passed to a native
+// `pushState`. So each drawer entry is pushed natively, with the marker.
+const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';
+
+// The current entry's drawer marker, as a fresh state object for a native
+// `replaceState` of the same entry, or null when it has none. A list update
+// made while a drawer entry is current must keep the marker, or closing
+// would take the replace branch. (Pass a fresh object: Next.js copies its
+// own keys into it, and an object that already carries them skips Next's
+// URL sync.)
+export function drawerEntryState(): Record<string, string> | null {
+  const state: unknown = window.history.state;
+  if (typeof state !== 'object' || state === null) return null;
+  const marker = (state as Record<string, unknown>)[DRAWER_ENTRY_KEY];
+  return typeof marker === 'string' ? { [DRAWER_ENTRY_KEY]: marker } : null;
+}
+
+// True when the current history entry is a drawer entry this hook pushed for
+// `paramName`.
+export function isDrawerEntryPushedHere(paramName: string): boolean {
+  return drawerEntryState()?.[DRAWER_ENTRY_KEY] === paramName;
+}
+
 export function useDetailDrawer(paramName = 'detail') {
   const router = useRouter();
   const pathname = usePathname();
   const searchParams = useSearchParams();
-  const openedHereRef = useRef(false);
 
   const activeId = searchParams.get(paramName);
 
+  const push = useCallback(
+    (href: string) => window.history.pushState({ [DRAWER_ENTRY_KEY]: paramName }, '', href),
+    [paramName],
+  );
+
   const open = useCallback((id: string) => {
-    openedHereRef.current = true;
     const params = new URLSearchParams(searchParams.toString());
     params.set(paramName, id);
-    router.push(`${pathname}?${params.toString()}`);
-  }, [router, pathname, searchParams, paramName]);
+    push(`${pathname}?${params.toString()}`);
+  }, [pathname, searchParams, paramName, push]);
 
   const close = useCallback(() => {
-    if (openedHereRef.current) {
-      openedHereRef.current = false;
+    if (isDrawerEntryPushedHere(paramName)) {
       router.back();
       return;
     }
@@ -55,22 +81,18 @@ export function useDetailDrawer(paramName = 'detail') {
   // optional argument on `open`/`close`: other pages pass `close` straight
   // to `onClose`, so `DetailDrawer`'s × button calls it with a click event,
   // and that must keep meaning "close", never "go to this URL".
-  const openWithHref = useCallback((href: string) => {
-    openedHereRef.current = true;
-    window.history.pushState(null, '', href);
-  }, []);
+  const openWithHref = useCallback((href: string) => push(href), [push]);
 
-  // A drawer opened here closes with `router.back()`, as `close` does. One
-  // reached by a direct link or refresh replaces the entry with `href`, which
-  // must not carry `<paramName>`.
+  // A drawer entry pushed here closes with `router.back()`, as `close` does.
+  // One reached directly replaces the entry with `href`, which must not
+  // carry `<paramName>`.
   const closeWithHref = useCallback((href: string) => {
-    if (openedHereRef.current) {
-      openedHereRef.current = false;
+    if (isDrawerEntryPushedHere(paramName)) {
       router.back();
       return;
     }
     window.history.replaceState(null, '', href);
-  }, [router]);
+  }, [router, paramName]);
 
   return { activeId, close, closeWithHref, open, openWithHref };
 }
```

```diff
diff --git a/apps/web/lib/use-laundry-order-list-url-state.ts b/apps/web/lib/use-laundry-order-list-url-state.ts
--- a/apps/web/lib/use-laundry-order-list-url-state.ts
+++ b/apps/web/lib/use-laundry-order-list-url-state.ts
@@ -10,6 +10,7 @@ import {
 } from '@clensy/web';
 import { useSearchParams } from 'next/navigation';
 import { useCallback } from 'react';
+import { drawerEntryState } from './use-detail-drawer';
 
 // `/app/laundry` list state, kept in the URL so a refresh, or back from an
 // order, restores it (lifecycle spec §8.4.4). Params the list does not own,
@@ -168,7 +169,9 @@ export function useLaundryOrderListUrlState() {
     (update: LaundryOrderListUpdate) => {
       const href = hrefFor(update);
       const live = `${window.location.pathname}${window.location.search}${window.location.hash}`;
-      if (href !== live) window.history.replaceState(null, '', href);
+      // Keeps a drawer entry's marker (#173), so a list update made while the
+      // drawer is open does not turn its × into a replace.
+      if (href !== live) window.history.replaceState(drawerEntryState(), '', href);
     },
     [hrefFor],
   );
```

- [ ] **Step 2:** Run both test files. Expected: `Tests 27 passed (27)`. `pnpm --filter web exec tsc --noEmit -p .` and eslint are clean.
- [ ] **Step 3:** One commit for Tasks 1–2, so no commit has failing tests: `fix(web): decide drawer close from a history-entry marker, not component memory (#173)`.

## Revision 3 tasks (edit anchor: PR head `a81fb02`)

**Why.** `router.back()` is `window.history.back()` (`app-router-instance.js` line 286): the Back lands asynchronously. Until `popstate` arrives, the drawer entry is still current, marker and all. So a second `close`/`closeWithHref` in that window calls `history.back()` again and goes past the list entry. `DetailDrawer` closes on ×, on the backdrop and on Escape (`useDialogBehavior`), so two closes in one moment are reachable.

**Reproduced in a browser** (production build of `a81fb02`, Chromium): history `/app/customers` → `/app/<page>` → open a row → × and a backdrop click in the same task. The result was `/app/customers` on both laundry and bookings: the user left the list. Two separate Escape presses at Playwright speed did *not* reproduce it, because the first Back had landed before the second press.

**Fix.** A per-hook `backPendingRef` is set when the hook calls `router.back()` and cleared on the next `popstate`. While it is set, a marked close does nothing. Direct-link closes (replace) are unaffected. The ref lives in the hook instance, so it does not survive a remount: a remount comes from a refresh or a navigation, and either one ends the pending Back.

**Risk considered.** If a `popstate` never came, the guard would stay set and × would do nothing. `history.back()` from a marked entry always has an entry behind it (the invariant), so a same-document traversal always fires `popstate`. Leaving the document unmounts the hook.

### Task 3: Double-close guard (red first)

- [ ] **Step 1:** Apply the test diff:

```diff
diff --git a/apps/web/lib/use-detail-drawer.test.tsx b/apps/web/lib/use-detail-drawer.test.tsx
--- a/apps/web/lib/use-detail-drawer.test.tsx
+++ b/apps/web/lib/use-detail-drawer.test.tsx
@@ -293,3 +293,50 @@ describe('useDetailDrawer: entries this page pushed go Back to the list entry be
     expect(nav.entries).toEqual(['/app/bookings?status=A', '/app/bookings?status=A&detail=o1']);
   });
 });
+
+// #173 M7 P3-1: `router.back()` lands asynchronously, and until `popstate`
+// the drawer entry, marker and all, is still current. A second close in that
+// window must not go Back again, past the list entry.
+describe('useDetailDrawer: a second close before the Back lands is ignored', () => {
+  // `router.back()` that lands only when the test says so.
+  function deferBack() {
+    nav.back.mockImplementation(() => undefined);
+  }
+
+  function pressEscape() {
+    act(() => {
+      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
+    });
+  }
+
+  it('goes Back once for a double Escape, then closes normally after Forward', () => {
+    start('/app/bookings?status=A', ['/app/jobs']);
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    deferBack();
+    pressEscape();
+    pressEscape();
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    traverse(-1); // the one Back lands: the list entry
+    expect(nav.index).toBe(1);
+    expect(window.location.pathname + window.location.search).toBe('/app/bookings?status=A');
+    traverse(1); // Forward: the drawer entry again
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(2); // released by the popstate
+    expect(nav.replace).not.toHaveBeenCalled();
+  });
+
+  it('closeWithHref goes Back once for × then × again, and never replaces the entry', () => {
+    start('/app/bookings?status=A', ['/app/jobs']);
+    act(() => root.render(<LaundryLikePage />));
+    act(() => button('Open o1').click());
+    deferBack();
+    act(() => button('Close').click());
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    expect(window.history.replaceState).not.toHaveBeenCalled();
+    traverse(-1);
+    expect(nav.entries).toEqual(['/app/jobs', '/app/bookings?status=A', '/app/bookings?status=A&detail=o1']);
+    expect(nav.index).toBe(1);
+  });
+});
```

- [ ] **Step 2:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.test.tsx`. Expected: `Tests 2 failed | 10 passed (12)`, and the failures are exactly the two new tests.
- [ ] **Step 3:** Apply the hook diff (the guard, plus the `router.refresh()` note):

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -1,6 +1,6 @@
 'use client';
 import { usePathname, useRouter, useSearchParams } from 'next/navigation';
-import { useCallback } from 'react';
+import { useCallback, useEffect, useRef } from 'react';
 
 // Resolves the "close behavior" question spec §4.4 deliberately leaves as a
 // plan-level implementation decision (design doc §4.4: "A same-page-origin
@@ -25,6 +25,10 @@ import { useCallback } from 'react';
 // custom `history.state` across Back/Forward (traverse navigations preserve
 // it) and copies its own keys into the state object passed to a native
 // `pushState`. So each drawer entry is pushed natively, with the marker.
+// (A `router.refresh()` or server-action navigation does not preserve custom
+// history state, so it would drop the marker and × would fall back to
+// replacing the entry: safe, but the duplicate returns. No drawer page uses
+// either today; keep it that way or re-mark the entry after one.)
 const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';
 
 // The current entry's drawer marker, as a fresh state object for a native
@@ -53,6 +57,25 @@ export function useDetailDrawer(paramName = 'detail') {
 
   const activeId = searchParams.get(paramName);
 
+  // A Back this hook started that the browser has not reported yet. Until
+  // `popstate` arrives the drawer entry is still current, marker and all, so
+  // a second close in that window (a double Escape, × then the backdrop)
+  // would go Back twice, past the list entry. It is ignored instead.
+  const backPendingRef = useRef(false);
+  useEffect(() => {
+    const settled = () => {
+      backPendingRef.current = false;
+    };
+    window.addEventListener('popstate', settled);
+    return () => window.removeEventListener('popstate', settled);
+  }, []);
+
+  const back = useCallback(() => {
+    if (backPendingRef.current) return;
+    backPendingRef.current = true;
+    router.back();
+  }, [router]);
+
   const push = useCallback(
     (href: string) => window.history.pushState({ [DRAWER_ENTRY_KEY]: paramName }, '', href),
     [paramName],
@@ -66,14 +89,14 @@ export function useDetailDrawer(paramName = 'detail') {
 
   const close = useCallback(() => {
     if (isDrawerEntryPushedHere(paramName)) {
-      router.back();
+      back();
       return;
     }
     const params = new URLSearchParams(searchParams.toString());
     params.delete(paramName);
     const query = params.toString();
     router.replace(query ? `${pathname}?${query}` : pathname);
-  }, [router, pathname, searchParams, paramName]);
+  }, [back, router, pathname, searchParams, paramName]);
 
   // Laundry list only (#163): open and close with an exact URL the caller
   // built from the live `window.location`, written with the native History
@@ -88,11 +111,11 @@ export function useDetailDrawer(paramName = 'detail') {
   // carry `<paramName>`.
   const closeWithHref = useCallback((href: string) => {
     if (isDrawerEntryPushedHere(paramName)) {
-      router.back();
+      back();
       return;
     }
     window.history.replaceState(null, '', href);
-  }, [router, paramName]);
+  }, [back, paramName]);
 
   return { activeId, close, closeWithHref, open, openWithHref };
 }
```

- [ ] **Step 4:** Run both test files. Expected: `Tests 29 passed (29)`. eslint and `tsc --noEmit -p .` are clean.
- [ ] **Step 5:** One commit: `fix(web): ignore a second drawer close until the first Back lands (#173)`.

### Revision 3 final verification

- [ ] **Allowlist:** `git diff --name-only a81fb02...HEAD -- . ':!docs'` is exactly `apps/web/lib/use-detail-drawer.ts` and `apps/web/lib/use-detail-drawer.test.tsx`.
- [ ] **Mutations:** apply each alone, run both test files, and revert.

  | Mutation | Change | Expected (pre-validation) |
  | --- | --- | --- |
  | G1 | remove `if (backPendingRef.current) return;` | 2 failed / 27 passed |
  | G2 | remove `backPendingRef.current = false;` in the `popstate` listener | 5 failed / 24 passed |
  | G3 | remove `backPendingRef.current = true;` | 2 failed / 27 passed |
  | G4 | in `closeWithHref`, `back();` → `router.back();` | 1 failed / 28 passed |

- [ ] **Full suites:** `pnpm --filter web test` (681 at pre-validation), `lint`, `tsc --noEmit -p .` and `build`.
- [ ] **Browser** (production build, fresh tabs): history `/app/customers` (or `/app/bookings` for customers) → `/app/<page>` → open a row. Then each of these must land on the list, with Forward reopening the drawer and × closing it again:
  - × then the backdrop, in one task;
  - two Escape keydowns, in one task;
  - two Escape presses.

  Run this on bookings, billing, catalog, customers, cleaners/teams and laundry. Also re-run the regression matrix columns a–f on the same pages, and refresh-then-× on laundry and bookings.

### Revision 3 pre-validation

Applied on the branch at `a81fb02`, then removed before this Draft was committed.

| Check | Result |
| --- | --- |
| RED (new tests, `a81fb02` hook) | 2 failed / 10 passed (12), the two new tests |
| GREEN | 29 passed (29) |
| Mutations G1–G4 | as in the table above |
| `web` / lint / `tsc` / Next build | 681 passed; exit 0; clean; build succeeded |
| Browser, without the guard (`a81fb02`) | × then backdrop: left the list for `/app/customers` (laundry, bookings) |
| Browser, with the guard | 18 of 18 (6 pages × 3 double-close ways): on the list, Forward reopens, × closes again. Matrix a–f on the 6 pages: all pass. Refresh then ×: laundry and bookings pass. |

Jobs, cleaners and add-ons had no local rows, so they were not in the revision 3 browser run. They share the hook unchanged in wiring with the six pages that were run.

## Revision 4 tasks (edit anchor: PR head `9db8ae0`, code as of `3253a5f`)

**Why.** M7 (revision 3) P2-1: if the hook's Back crosses documents, the drawer document may be frozen in the back/forward cache with `backPendingRef` still `true`. A later Forward restores it with `pageshow` (`persisted: true`), not `popstate`, so ×, Escape and the backdrop would do nothing.

**Correction to revision 3 "Risk considered"** (M7 P3-1): "leaving the document unmounts the hook" does not hold under the back/forward cache. A frozen document keeps its React tree and refs. This revision covers that case.

**What the author observed** (Chromium via Playwright, production build of `3253a5f`). Playwright launches Chromium with the back/forward cache disabled, so a restore cannot be produced here.
- **Refresh then × did not cross documents.** A page-object token set after the reload survived the Back to the list, and `popstate` fired. That fits the HTML spec: a reload replaces the document for every entry that shared it.
- **Leaving by a full page load and coming Back, then ×, did not cross documents either.** The restored document serves both the drawer entry and the list entry.
- **In both flows,** ×, Forward and × again worked.

So the reviewer's refresh scenario is not reachable in Chromium. A cross-document Back from a marked entry remains possible in principle: a duplicated or restored tab, or other engines. The fix is defensive and cheap.

**Fix.** The same effect also listens for `pageshow` and clears the guard when `event.persisted` is true. A non-persisted `pageshow` is a fresh load, whose ref is already `false`; the test pins that it is not treated as a release.

### Task 4: Release the guard on a back/forward-cache restore (red first)

- [ ] **Step 1:** Apply the test diff:

```diff
diff --git a/apps/web/lib/use-detail-drawer.test.tsx b/apps/web/lib/use-detail-drawer.test.tsx
--- a/apps/web/lib/use-detail-drawer.test.tsx
+++ b/apps/web/lib/use-detail-drawer.test.tsx
@@ -326,6 +326,29 @@ describe('useDetailDrawer: a second close before the Back lands is ignored', ()
     expect(nav.replace).not.toHaveBeenCalled();
   });
 
+  // #173 revision 4 (M7 P2-1): a Back that crosses documents may leave this
+  // document in the back/forward cache with the guard set. Restoring it fires
+  // `pageshow` with `persisted`, not `popstate`; × must work again after it.
+  it('releases the guard when the page is restored from the back/forward cache', () => {
+    start('/app/bookings?status=A', ['/app/jobs']);
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    deferBack();
+    act(() => button('Close').click()); // the Back crosses documents: no popstate here
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    act(() => {
+      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false })); // a fresh load: not a release
+    });
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(1);
+    act(() => {
+      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); // Forward restores it
+    });
+    act(() => button('Close').click());
+    expect(nav.back).toHaveBeenCalledTimes(2);
+    expect(nav.replace).not.toHaveBeenCalled();
+  });
+
   it('closeWithHref goes Back once for × then × again, and never replaces the entry', () => {
     start('/app/bookings?status=A', ['/app/jobs']);
     act(() => root.render(<LaundryLikePage />));
```

- [ ] **Step 2:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.test.tsx`. Expected: `Tests 1 failed | 12 passed (13)`; the failure is the new test.
- [ ] **Step 3:** Apply the hook diff (the `pageshow` release and the tightened header comment):

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -25,10 +25,11 @@ import { useCallback, useEffect, useRef } from 'react';
 // custom `history.state` across Back/Forward (traverse navigations preserve
 // it) and copies its own keys into the state object passed to a native
 // `pushState`. So each drawer entry is pushed natively, with the marker.
-// (A `router.refresh()` or server-action navigation does not preserve custom
-// history state, so it would drop the marker and × would fall back to
-// replacing the entry: safe, but the duplicate returns. No drawer page uses
-// either today; keep it that way or re-mark the entry after one.)
+// (A `router.refresh()` rewrites the current entry's state without custom
+// keys, so it would drop the marker and × would fall back to replacing the
+// entry: safe, but the duplicate returns. A server-action redirect pushes a
+// new, unmarked entry instead. No drawer page uses either today; keep it
+// that way or re-mark the entry after one.)
 const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';
 
 // The current entry's drawer marker, as a fresh state object for a native
@@ -61,13 +62,25 @@ export function useDetailDrawer(paramName = 'detail') {
   // `popstate` arrives the drawer entry is still current, marker and all, so
   // a second close in that window (a double Escape, × then the backdrop)
   // would go Back twice, past the list entry. It is ignored instead.
+  //
+  // `popstate` reports a same-document Back. If the Back crosses documents,
+  // this one may be frozen in the back/forward cache with the guard still
+  // set, and a later Forward restores it with `pageshow` (`persisted`), not
+  // `popstate`; that clears the guard too, or × would do nothing.
   const backPendingRef = useRef(false);
   useEffect(() => {
     const settled = () => {
       backPendingRef.current = false;
     };
+    const restored = (event: PageTransitionEvent) => {
+      if (event.persisted) settled();
+    };
     window.addEventListener('popstate', settled);
-    return () => window.removeEventListener('popstate', settled);
+    window.addEventListener('pageshow', restored);
+    return () => {
+      window.removeEventListener('popstate', settled);
+      window.removeEventListener('pageshow', restored);
+    };
   }, []);
 
   const back = useCallback(() => {
```

- [ ] **Step 4:** Run both test files. Expected: `Tests 30 passed (30)`. eslint and `tsc --noEmit -p .` are clean.
- [ ] **Step 5:** One commit: `fix(web): release the drawer close guard on a back/forward-cache restore (#173)`.

### Revision 4 final verification

- [ ] **Allowlist:** `git diff --name-only 9db8ae0...HEAD -- . ':!docs'` is exactly the two hook files.
- [ ] **Mutations** (each alone, both test files, then revert; G1–G4 from revision 3 still apply):

  | Mutation | Change | Expected (pre-validation) |
  | --- | --- | --- |
  | G5 | remove `window.addEventListener('pageshow', restored);` | 1 failed / 29 passed |
  | G6 | `if (event.persisted) settled();` → `settled();` | 1 failed / 29 passed |

- [ ] **Full suites:** `pnpm --filter web test` (682 at pre-validation), `lint`, `tsc --noEmit -p .` and `build`.
- [ ] **Browser** (production build of the commit, fresh tabs):
  - the revision 3 double-close set: 6 pages × 3 ways;
  - on laundry and bookings, (a) refresh and (b) a full-page load away and Back, each followed by ×, Forward and × again. × must work every time.

### Revision 4 pre-validation

Applied on the branch at `9db8ae0`, then removed before this Draft was committed.

| Check | Result |
| --- | --- |
| RED (new test, `3253a5f` hook) | 1 failed / 12 passed (13), the new test |
| GREEN | 30 passed (30) |
| G5 / G6 | 1 failed / 29 passed each |
| `web` / lint / `tsc` / Next build | 682 passed; exit 0; clean; build succeeded |
| Browser (with revision 4) | Double close: 18 of 18. Refresh, and full-load away and Back, each then ×, Forward, ×: 4 of 4 on laundry and bookings |

## Revision 5 tasks (edit anchor: PR head `4c028b5`)

**Why.** The marker is dropped from the current entry by:
- `router.refresh()` (`refresh-reducer.js:75`);
- a server action that revalidates or refreshes (`server-action-reducer.js:240, 266-330`).

Both reach `HistoryUpdater` with `preserveCustomHistoryState: false`. A server-action redirect pushes or replaces with an unmarked entry. In each case × silently falls back to replace, and the #173 duplicate returns. Nothing triggers this today: a scan of the scope below finds only the hook's own comment. The guard keeps it that way until someone handles the marker on purpose.

**Scope scanned and rules** (as implemented at `865a5d0`; corrected in revision 6, P2):
- **Detector:** the TypeScript syntax tree of every non-test `.ts`/`.tsx` file in `apps/web/app/app`, `apps/web/lib` and `packages/web/src`. Revision 6 widens this; see "Revision 6 tasks". Comments and strings never count.
- **Flagged:**
  - a call to a `refresh` property with no arguments;
  - a `'use server'` directive in a file or function body;
  - any identifier `useActionState` / `useFormState`.

### Task 5: Guard test (as accepted at M5, with the reviewer's two changes)

**M5 changes, applied in the M5 record commit:**
1. **The detector reads the TypeScript syntax tree** (`ts.createSourceFile`) instead of stripping comments with regexes. Comments, including trailing ones, and strings can never count.
   - **`router.refresh()`:** a call to a `refresh` property with no arguments.
   - **`'use server'`:** a directive, meaning a leading string-literal statement in a file or function body.
   - **`useActionState` / `useFormState`:** any identifier with that name, imports included.

   Inline cases pin each rule, including the reviewer's trailing comment `const value = true; // router.refresh()`.
2. **Coverage lists all nine drawer pages** (`DRAWER_PAGES`). It also requires that every `apps/web/app` file calling `useDetailDrawer(` is in that list, so a new drawer page cannot be missed.

- [ ] **Step 1:** Add the test, a new file:

```diff
diff --git a/apps/web/lib/use-detail-drawer.guard.test.ts b/apps/web/lib/use-detail-drawer.guard.test.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/lib/use-detail-drawer.guard.test.ts
@@ -0,0 +1,125 @@
+import { readdirSync, readFileSync } from 'node:fs';
+import { join, relative } from 'node:path';
+import { fileURLToPath } from 'node:url';
+import ts from 'typescript';
+import { describe, expect, it } from 'vitest';
+
+// #173 revision 5: the drawer's close decision reads a marker in
+// `history.state` (`use-detail-drawer.ts`). Next.js drops custom history state
+// when it rewrites the current entry for a `router.refresh()` or a server
+// action, and gives the page no event to restore it from. So × would quietly
+// fall back to replacing the entry, and the duplicate list entry of #173
+// would return. Nothing uses either today; this test keeps it that way until
+// someone handles the marker on purpose.
+const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
+const REPO_ROOT = join(WEB_ROOT, '..', '..');
+
+// The authenticated app (every drawer page and its drawer), the hooks, and
+// the shared domain components those pages render.
+const SCANNED = [join(WEB_ROOT, 'app', 'app'), join(WEB_ROOT, 'lib'), join(REPO_ROOT, 'packages', 'web', 'src')];
+
+// Every page that opens a drawer through `useDetailDrawer`, with its drawer
+// defined in the same file.
+const DRAWER_PAGES = [
+  'apps/web/app/app/billing/page.tsx',
+  'apps/web/app/app/bookings/page.tsx',
+  'apps/web/app/app/catalog/add-ons/page.tsx',
+  'apps/web/app/app/catalog/page.tsx',
+  'apps/web/app/app/cleaners/page.tsx',
+  'apps/web/app/app/cleaners/teams/page.tsx',
+  'apps/web/app/app/customers/page.tsx',
+  'apps/web/app/app/jobs/page.tsx',
+  'apps/web/app/app/laundry/page.tsx',
+];
+
+const FORBIDDEN_IDENTIFIERS = new Map([
+  ['useActionState', '`useActionState`'],
+  ['useFormState', '`useFormState`'],
+]);
+
+function sourceFiles(dir: string): string[] {
+  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
+    const path = join(dir, entry.name);
+    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
+    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
+  });
+}
+
+// A string-literal statement at the start of a file or function body.
+function isUseServerDirective(statements: ts.NodeArray<ts.Statement>): boolean {
+  for (const statement of statements) {
+    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
+    if (statement.expression.text === 'use server') return true;
+  }
+  return false;
+}
+
+// Reads the syntax tree, so comments and strings that merely name these APIs
+// never count; only code that uses them does.
+function drawerHistoryHazards(fileName: string, source: string): string[] {
+  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
+  const found = new Set<string>();
+  const visit = (node: ts.Node) => {
+    if (
+      ts.isCallExpression(node) &&
+      ts.isPropertyAccessExpression(node.expression) &&
+      node.expression.name.text === 'refresh' &&
+      node.arguments.length === 0
+    ) {
+      found.add('`router.refresh()`');
+    }
+    if ((ts.isSourceFile(node) || ts.isBlock(node)) && isUseServerDirective(node.statements)) {
+      found.add("a `'use server'` module or function");
+    }
+    if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
+      found.add(FORBIDDEN_IDENTIFIERS.get(node.text)!);
+    }
+    ts.forEachChild(node, visit);
+  };
+  visit(file);
+  return [...found];
+}
+
+describe('drawer history marker guard (#173)', () => {
+  const files = SCANNED.flatMap(sourceFiles);
+  const scanned = files.map((file) => relative(REPO_ROOT, file));
+
+  it('scans every drawer page, the hooks and the shared components', () => {
+    expect(scanned).toEqual(expect.arrayContaining([...DRAWER_PAGES, 'apps/web/lib/use-detail-drawer.ts']));
+    expect(scanned.some((file) => file.startsWith('packages/web/src/'))).toBe(true);
+    // A page that starts using the hook must be added to DRAWER_PAGES.
+    const usingHook = files
+      .filter((file) => /\buseDetailDrawer\(/.test(readFileSync(file, 'utf8')))
+      .map((file) => relative(REPO_ROOT, file))
+      .filter((file) => file.startsWith('apps/web/app/'));
+    expect(usingHook.sort()).toEqual([...DRAWER_PAGES].sort());
+  });
+
+  it('finds no router.refresh() or server action where a drawer could be open', () => {
+    const hazards = files.flatMap((file) =>
+      drawerHistoryHazards(file, readFileSync(file, 'utf8')).map((what) => `${relative(REPO_ROOT, file)} uses ${what}`),
+    );
+    // If this fails: these drop the drawer marker from the current history
+    // entry, so × would replace it instead of going Back. Re-mark the entry
+    // after the refresh or action (see the header of use-detail-drawer.ts),
+    // with a test, before allowing it here.
+    expect(hazards).toEqual([]);
+  });
+
+  // What the detector counts, pinned on inline sources.
+  it.each([
+    ['a call', 'router.refresh();', ['`router.refresh()`']],
+    ['a spaced call', 'router.refresh ( );', ['`router.refresh()`']],
+    ['a module directive', "'use server';\nexport async function save() {}", ["a `'use server'` module or function"]],
+    ['a function directive', "async function save() {\n  'use server';\n}", ["a `'use server'` module or function"]],
+    ['an import', "import { useActionState } from 'react';", ['`useActionState`']],
+    ['a line comment', '// router.refresh()', []],
+    ['a trailing comment', "const value = true; // router.refresh() and 'use server'", []],
+    ['a block comment', '/* useFormState; router.refresh(); */', []],
+    ['a string', "const text = 'router.refresh() useActionState';", []],
+    ['a non-directive string', "save();\n'use server';", []],
+    ['refresh with arguments', 'cache.refresh(key);', []],
+  ])('%s', (_label, source, expected) => {
+    expect(drawerHistoryHazards('inline.tsx', source)).toEqual(expected);
+  });
+});
```

- [ ] **Step 2:** Point the hook's header note at the guard (comment only):

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -30,7 +30,8 @@ import { useCallback, useEffect, useRef } from 'react';
 // and × would fall back to replacing the entry: safe, but the duplicate
 // returns. A server action that redirects pushes or replaces with an
 // unmarked entry, to the same effect. No drawer page uses either today;
-// keep it that way or re-mark the entry after one.)
+// keep it that way or re-mark the entry after one.
+// `use-detail-drawer.guard.test.ts` fails if either appears.)
 const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';
 
 // The current entry's drawer marker, as a fresh state object for a native
```

- [ ] **Step 3:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.guard.test.ts`. Expected: `Tests 13 passed (13)`: coverage, the scan, and 11 inline detector cases. eslint and `tsc` are clean.
- [ ] **Step 4: Failure evidence**, not committed. Plant each hazard alone in a real file, run the guard, and revert. Expected:

  | Plant | Expected |
  | --- | --- |
  | H1: `router.refresh();` in `bookings/page.tsx` | 1 failed / 12 passed |
  | H2: a `'use server'` module in `apps/web/lib` | 1 failed / 12 passed |
  | H3: `useActionState` in `packages/web/src/auth/login-form.tsx` | 1 failed / 12 passed |
  | H4: `// router.refresh() …`, a line comment, in bookings | 13 passed |
  | H5: `router.refresh ( );` (spaced) in bookings | 1 failed / 12 passed |
  | H6: `const note = true; // router.refresh() and 'use server'`, a trailing comment, in bookings | 13 passed |
  | H7: a new `apps/web/app/app/zz-planted/page.tsx` calling `useDetailDrawer()` | 1 failed / 12 passed (coverage) |

  Characterization note: the guard pins today's state (none present). H1–H7 are its failure evidence.
- [ ] **Step 5:** One commit: `test(web): guard drawer pages against marker-dropping refreshes and server actions (#173)`.

### Revision 5 final verification

- [ ] **Allowlist:** `git diff --name-only 4c028b5...HEAD -- . ':!docs'` is exactly `apps/web/lib/use-detail-drawer.guard.test.ts` and `apps/web/lib/use-detail-drawer.ts` (the latter comment-only; scripted check).
- [ ] **H1–H7** as above.
- [ ] **Full suites:** `pnpm --filter web test` (695 at pre-validation), `lint`, `tsc --noEmit -p .`. A Next build is not needed: no runtime file changes, only a comment.
- [ ] **Browser:** not needed, since behaviour is unchanged.

### Revision 5 pre-validation

These are the results for the M5-amended version. The first Draft's regex guard gave 2 passed and H1–H5 as planned, and that version is superseded.

| Check | Result |
| --- | --- |
| Guard test | 13 passed (13) |
| H1, H2, H3, H5, H7 | 1 failed / 12 passed each |
| H4, H6 | 13 passed |
| `web` / lint / `tsc` | 695 passed; exit 0; clean |

## Revision 6 tasks (edit anchor: PR head `75cde5e`, code as of `865a5d0`)

**Why.** M7 (revision 5) P1: `SCANNED` left out `apps/web/components/layout/*`, the dashboard shell that `app/app/layout.tsx` mounts around every drawer page. It also left out server-action files outside the three roots. A `router.refresh()` in the user menu, such as a language or tenant switcher, would drop the marker while a drawer is open, with CI green. The hook comment and the test's name claimed more than that.

**Change.**
- **Scope:** the scan is all of `apps/web` (skipping `node_modules`, `.next` and `.turbo`), plus `packages/web/src` and `packages/ui/src`. On today's tree that adds no false positives.
- **Rules:** `x['refresh']()`, and a `refresh` destructured (renamed or not) from `useRouter()`. An aliased `useActionState` was already caught and is now pinned.
- **Coverage:** every scanned file whose syntax tree calls `useDetailDrawer(...)` must be in `DRAWER_PAGES`. The scan must include `app/app/layout.tsx`, `components/layout/user-menu.tsx`, `middleware.ts` and `packages/ui/src`, and must exclude `node_modules`, `.next` and `.turbo`.
- **Wording:** the test header says "that revalidates, refreshes or redirects", and the hook comment names the scanned roots.

**Known limits** (M7 P3, kept as notes):
- **Aliased hook import:** `import { useDetailDrawer as x }` evades the coverage check.
- **False positives:** any zero-argument `.refresh()` on an unrelated object, and identifiers named `useActionState`/`useFormState`, fail loudly. That is acceptable for a guard.
- **Server functions from outside the scan:** a server function defined in another package and imported into a drawer page is not seen.

### Task 6: Widen the guard

- [ ] **Step 1:** Apply the guard test diff (as amended at M5 to include `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts` and `.cts`):

```diff
diff --git a/apps/web/lib/use-detail-drawer.guard.test.ts b/apps/web/lib/use-detail-drawer.guard.test.ts
--- a/apps/web/lib/use-detail-drawer.guard.test.ts
+++ b/apps/web/lib/use-detail-drawer.guard.test.ts
@@ -7,16 +7,19 @@ import { describe, expect, it } from 'vitest';
 // #173 revision 5: the drawer's close decision reads a marker in
 // `history.state` (`use-detail-drawer.ts`). Next.js drops custom history state
 // when it rewrites the current entry for a `router.refresh()` or a server
-// action, and gives the page no event to restore it from. So × would quietly
+// action that revalidates, refreshes or redirects, and gives the page no
+// event to restore it from. So × would quietly
 // fall back to replacing the entry, and the duplicate list entry of #173
 // would return. Nothing uses either today; this test keeps it that way until
 // someone handles the marker on purpose.
 const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
 const REPO_ROOT = join(WEB_ROOT, '..', '..');
 
-// The authenticated app (every drawer page and its drawer), the hooks, and
-// the shared domain components those pages render.
-const SCANNED = [join(WEB_ROOT, 'app', 'app'), join(WEB_ROOT, 'lib'), join(REPO_ROOT, 'packages', 'web', 'src')];
+// All of the web app (the drawer pages, the dashboard shell mounted around
+// them, the hooks, and any server-action file), and the shared component
+// packages those pages render.
+const SCANNED = [WEB_ROOT, join(REPO_ROOT, 'packages', 'web', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')];
+const SKIPPED_DIRECTORIES = new Set(['.next', '.turbo', 'node_modules']);
 
 // Every page that opens a drawer through `useDetailDrawer`, with its drawer
 // defined in the same file.
@@ -40,8 +43,9 @@ const FORBIDDEN_IDENTIFIERS = new Map([
 function sourceFiles(dir: string): string[] {
   return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
     const path = join(dir, entry.name);
-    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
-    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
+    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
+    // `apps/web` allows JavaScript (`allowJs`), and Next accepts `.js`/`.jsx` pages.
+    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
   });
 }
 
@@ -54,18 +58,42 @@ function isUseServerDirective(statements: ts.NodeArray<ts.Statement>): boolean {
   return false;
 }
 
+function parse(fileName: string, source: string): ts.SourceFile {
+  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
+}
+
+// `x.refresh()` or `x['refresh']()`, with no arguments.
+function isRefreshCall(node: ts.Node): boolean {
+  if (!ts.isCallExpression(node) || node.arguments.length > 0) return false;
+  const callee = node.expression;
+  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'refresh';
+  return (
+    ts.isElementAccessExpression(callee) &&
+    ts.isStringLiteralLike(callee.argumentExpression) &&
+    callee.argumentExpression.text === 'refresh'
+  );
+}
+
+// `const { refresh } = useRouter()`, renamed or not.
+function isRefreshDestructuredFromRouter(node: ts.Node): boolean {
+  return (
+    ts.isVariableDeclaration(node) &&
+    ts.isObjectBindingPattern(node.name) &&
+    node.initializer !== undefined &&
+    ts.isCallExpression(node.initializer) &&
+    ts.isIdentifier(node.initializer.expression) &&
+    node.initializer.expression.text === 'useRouter' &&
+    node.name.elements.some((element) => (element.propertyName ?? element.name).getText() === 'refresh')
+  );
+}
+
 // Reads the syntax tree, so comments and strings that merely name these APIs
 // never count; only code that uses them does.
 function drawerHistoryHazards(fileName: string, source: string): string[] {
-  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
+  const file = parse(fileName, source);
   const found = new Set<string>();
   const visit = (node: ts.Node) => {
-    if (
-      ts.isCallExpression(node) &&
-      ts.isPropertyAccessExpression(node.expression) &&
-      node.expression.name.text === 'refresh' &&
-      node.arguments.length === 0
-    ) {
+    if (isRefreshCall(node) || isRefreshDestructuredFromRouter(node)) {
       found.add('`router.refresh()`');
     }
     if ((ts.isSourceFile(node) || ts.isBlock(node)) && isUseServerDirective(node.statements)) {
@@ -84,18 +112,37 @@ describe('drawer history marker guard (#173)', () => {
   const files = SCANNED.flatMap(sourceFiles);
   const scanned = files.map((file) => relative(REPO_ROOT, file));
 
-  it('scans every drawer page, the hooks and the shared components', () => {
-    expect(scanned).toEqual(expect.arrayContaining([...DRAWER_PAGES, 'apps/web/lib/use-detail-drawer.ts']));
+  it('scans every drawer page, the dashboard shell, the hooks and the shared components', () => {
+    expect(scanned).toEqual(
+      expect.arrayContaining([
+        ...DRAWER_PAGES,
+        'apps/web/app/app/layout.tsx',
+        'apps/web/components/layout/user-menu.tsx',
+        'apps/web/lib/use-detail-drawer.ts',
+        'apps/web/middleware.ts',
+      ]),
+    );
     expect(scanned.some((file) => file.startsWith('packages/web/src/'))).toBe(true);
-    // A page that starts using the hook must be added to DRAWER_PAGES.
-    const usingHook = files
-      .filter((file) => /\buseDetailDrawer\(/.test(readFileSync(file, 'utf8')))
-      .map((file) => relative(REPO_ROOT, file))
-      .filter((file) => file.startsWith('apps/web/app/'));
+    expect(scanned.some((file) => file.startsWith('packages/ui/src/'))).toBe(true);
+    expect(scanned).toContain('apps/web/eslint.config.mjs');
+    expect(scanned.some((file) => /(^|\/)(node_modules|\.next|\.turbo)\//.test(file))).toBe(false);
+    // A file that starts calling the hook must be added to DRAWER_PAGES.
+    const callsHook = (file: string) => {
+      let calls = false;
+      const visit = (node: ts.Node) => {
+        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useDetailDrawer') {
+          calls = true;
+        }
+        ts.forEachChild(node, visit);
+      };
+      visit(parse(file, readFileSync(file, 'utf8')));
+      return calls;
+    };
+    const usingHook = files.filter(callsHook).map((file) => relative(REPO_ROOT, file));
     expect(usingHook.sort()).toEqual([...DRAWER_PAGES].sort());
   });
 
-  it('finds no router.refresh() or server action where a drawer could be open', () => {
+  it('finds no router.refresh() or server action in the web app or the shared components', () => {
     const hazards = files.flatMap((file) =>
       drawerHistoryHazards(file, readFileSync(file, 'utf8')).map((what) => `${relative(REPO_ROOT, file)} uses ${what}`),
     );
@@ -110,6 +157,10 @@ describe('drawer history marker guard (#173)', () => {
   it.each([
     ['a call', 'router.refresh();', ['`router.refresh()`']],
     ['a spaced call', 'router.refresh ( );', ['`router.refresh()`']],
+    ['a bracket call', "router['refresh']();", ['`router.refresh()`']],
+    ['a destructured refresh', 'const { refresh } = useRouter();', ['`router.refresh()`']],
+    ['a renamed destructured refresh', 'const { refresh: reload } = useRouter();', ['`router.refresh()`']],
+    ['an aliased import', "import { useActionState as useAction } from 'react';", ['`useActionState`']],
     ['a module directive', "'use server';\nexport async function save() {}", ["a `'use server'` module or function"]],
     ['a function directive', "async function save() {\n  'use server';\n}", ["a `'use server'` module or function"]],
     ['an import', "import { useActionState } from 'react';", ['`useActionState`']],
```

- [ ] **Step 2:** Apply the hook comment diff (comment only):

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -31,7 +31,8 @@ import { useCallback, useEffect, useRef } from 'react';
 // returns. A server action that redirects pushes or replaces with an
 // unmarked entry, to the same effect. No drawer page uses either today;
 // keep it that way or re-mark the entry after one.
-// `use-detail-drawer.guard.test.ts` fails if either appears.)
+// `use-detail-drawer.guard.test.ts` fails if either appears anywhere in
+// `apps/web`, `packages/web/src` or `packages/ui/src`.)
 const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';
 
 // The current entry's drawer marker, as a fresh state object for a native
```

- [ ] **Step 3:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.guard.test.ts`. Expected: `Tests 17 passed (17)`. eslint and `tsc` are clean.
- [ ] **Step 4: Failure evidence**, not committed. Plant each alone and revert. H1–H7 are as in revision 5, now out of 17.

  | Plant | Expected |
  | --- | --- |
  | H1–H3, H5, H7 | 1 failed / 16 passed each |
  | H4, H6 (comments) | 17 passed |
  | H8: `r.refresh()` in `apps/web/components/layout/user-menu.tsx` (the M7 case) | 1 failed / 16 passed |
  | H9: a `'use server'` file at `apps/web/app/zz-actions.ts` | 1 failed / 16 passed |
  | H10: `const { refresh } = useRouter();` in bookings | 1 failed / 16 passed |
  | H11: `r['refresh']()` in a `packages/ui/src/base` component | 1 failed / 16 passed |
  | H12: a `useDetailDrawer()` call in a new `apps/web/components/…` file | 1 failed / 16 passed (coverage) |
  | H13: `router.refresh()` in a new `apps/web/components/…/x.jsx` (M5) | 1 failed / 16 passed |
  | H14: a `'use server'` file at `apps/web/app/zz-actions.js` (M5) | 1 failed / 16 passed |

- [ ] **Step 5:** One commit: `test(web): widen the drawer history guard to the whole web app and shared packages (#173)`.

### Revision 6 final verification

- [ ] **Allowlist:** `git diff --name-only 75cde5e...HEAD -- . ':!docs'` is exactly the guard test and `use-detail-drawer.ts`. The latter is comment-only (scripted check).
- [ ] **H1–H14** as above.
- [ ] **Full suites:** `pnpm --filter web test` (699 at pre-validation), `lint`, `tsc --noEmit -p .`. No Next build or browser run is needed, because no runtime code changes.

### Revision 6 pre-validation

Applied on the branch at `75cde5e`, then removed before this Draft was committed.

| Check | Result |
| --- | --- |
| Guard test | 17 passed (17) |
| H1, H2, H3, H5, H7, H8, H9, H10, H11, H12 | 1 failed / 16 passed each |
| H13, H14 (M5 amendment) | 1 failed / 16 passed each |
| H4, H6 | 17 passed |
| `web` / lint / `tsc` | 699 passed; exit 0; clean |
| Vitest's "ESM syntax … `vitest.config.ts`" message | pre-existing; appears without this change too |

## Revision 7 tasks (edit anchor: PR head `a3a8e6c`, code as of `d66e55e`)

**Why.** The revision 6 M7 approved it, with three guard P3s the owner chose to fix:
1. **References to `refresh`:** `refresh` used without being called (`onClick={router.refresh}`), or destructured from a router variable, was not caught.
2. **Gitignored output:** local build or coverage output under `apps/web` was scanned, so it could turn the guard red locally while CI stayed green.
3. **Parse mode:** `.ts` files were parsed as TSX, so `<Router>router;` would open a JSX element and swallow the code after it.

**Change.**
- **Router references:** for each file, the guard collects the names bound to `useRouter()`. It flags a `.refresh` or `['refresh']` access on such a name, or on `useRouter()` itself, whether or not it is called, and `const { refresh } = <router>`. The broad zero-argument `.refresh()` call rule stays, which catches a router passed in as a parameter.
- **Skipped directories:** `build`, `coverage`, `dist`, `node_modules`, `public`, and any directory whose name starts with `.`. Coverage asserts that no scanned path is inside one.
- **Parse mode:** `.tsx` → TSX, `.ts`/`.mts`/`.cts` → TS, `.jsx` → JSX, everything else → JS.
- **Hook comment:** "looks for both in …; its plan lists what a static scan cannot see".

**Known limits** (documented, not enforced):
- **Unrelated names:** a `refresh` *reference* on a name not bound to `useRouter()` in the same file. A prop named `router` is the example; a zero-argument *call* on it is caught.
- **Aliased hook import:** `import { useDetailDrawer as x }` evades the coverage check. The file is still scanned for hazards.
- **Outside the scan:** server functions defined outside the scanned roots, and the unscanned workspace packages `@clensy/client` and `@clensy/validation`. Neither package uses any of these APIs today.
- **False positives,** which fail loudly: a zero-argument `.refresh()` on an unrelated object, and identifiers named `useActionState`/`useFormState`.

### Task 7: Close the guard's remaining gaps

- [ ] **Step 1:** Apply the guard test diff:

```diff
diff --git a/apps/web/lib/use-detail-drawer.guard.test.ts b/apps/web/lib/use-detail-drawer.guard.test.ts
--- a/apps/web/lib/use-detail-drawer.guard.test.ts
+++ b/apps/web/lib/use-detail-drawer.guard.test.ts
@@ -8,9 +8,8 @@ import { describe, expect, it } from 'vitest';
 // `history.state` (`use-detail-drawer.ts`). Next.js drops custom history state
 // when it rewrites the current entry for a `router.refresh()` or a server
 // action that revalidates, refreshes or redirects, and gives the page no
-// event to restore it from. So × would quietly
-// fall back to replacing the entry, and the duplicate list entry of #173
-// would return. Nothing uses either today; this test keeps it that way until
+// event to restore it from. So × would quietly fall back to replacing the
+// entry, and the duplicate list entry of #173 would return. Nothing uses either today; this test keeps it that way until
 // someone handles the marker on purpose.
 const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
 const REPO_ROOT = join(WEB_ROOT, '..', '..');
@@ -19,7 +18,9 @@ const REPO_ROOT = join(WEB_ROOT, '..', '..');
 // them, the hooks, and any server-action file), and the shared component
 // packages those pages render.
 const SCANNED = [WEB_ROOT, join(REPO_ROOT, 'packages', 'web', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')];
-const SKIPPED_DIRECTORIES = new Set(['.next', '.turbo', 'node_modules']);
+// Dependencies, and output a build, test run or tool writes locally (all
+// gitignored); hidden directories such as `.next` and `.turbo` are skipped too.
+const SKIPPED_DIRECTORIES = new Set(['build', 'coverage', 'dist', 'node_modules', 'public']);
 
 // Every page that opens a drawer through `useDetailDrawer`, with its drawer
 // defined in the same file.
@@ -43,7 +44,9 @@ const FORBIDDEN_IDENTIFIERS = new Map([
 function sourceFiles(dir: string): string[] {
   return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
     const path = join(dir, entry.name);
-    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
+    if (entry.isDirectory()) {
+      return entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
+    }
     // `apps/web` allows JavaScript (`allowJs`), and Next accepts `.js`/`.jsx` pages.
     return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
   });
@@ -58,8 +61,51 @@ function isUseServerDirective(statements: ts.NodeArray<ts.Statement>): boolean {
   return false;
 }
 
+// Parsed as what the extension says: a `.ts` file read as TSX would misread
+// an angle-bracket type assertion as JSX.
+function scriptKind(fileName: string): ts.ScriptKind {
+  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
+  if (/\.[cm]?ts$/.test(fileName)) return ts.ScriptKind.TS;
+  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
+  return ts.ScriptKind.JS;
+}
+
 function parse(fileName: string, source: string): ts.SourceFile {
-  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
+  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
+}
+
+function isUseRouterCall(node: ts.Node): boolean {
+  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useRouter';
+}
+
+// Names bound to `useRouter()` in this file: `const router = useRouter()`.
+function routerNames(file: ts.SourceFile): Set<string> {
+  const names = new Set<string>();
+  const visit = (node: ts.Node) => {
+    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isUseRouterCall(node.initializer)) {
+      names.add(node.name.text);
+    }
+    ts.forEachChild(node, visit);
+  };
+  visit(file);
+  return names;
+}
+
+// `useRouter()` itself, or a name bound to it.
+function isRouter(node: ts.Expression, routers: ReadonlySet<string>): boolean {
+  return isUseRouterCall(node) || (ts.isIdentifier(node) && routers.has(node.text));
+}
+
+// `router.refresh` or `router['refresh']`, called or not
+// (`onClick={router.refresh}`, `startTransition(router.refresh)`).
+function isRouterRefreshAccess(node: ts.Node, routers: ReadonlySet<string>): boolean {
+  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'refresh' && isRouter(node.expression, routers);
+  return (
+    ts.isElementAccessExpression(node) &&
+    ts.isStringLiteralLike(node.argumentExpression) &&
+    node.argumentExpression.text === 'refresh' &&
+    isRouter(node.expression, routers)
+  );
 }
 
 // `x.refresh()` or `x['refresh']()`, with no arguments.
@@ -74,15 +120,13 @@ function isRefreshCall(node: ts.Node): boolean {
   );
 }
 
-// `const { refresh } = useRouter()`, renamed or not.
-function isRefreshDestructuredFromRouter(node: ts.Node): boolean {
+// `const { refresh } = useRouter()` or `= router`, renamed or not.
+function isRefreshDestructuredFromRouter(node: ts.Node, routers: ReadonlySet<string>): boolean {
   return (
     ts.isVariableDeclaration(node) &&
     ts.isObjectBindingPattern(node.name) &&
     node.initializer !== undefined &&
-    ts.isCallExpression(node.initializer) &&
-    ts.isIdentifier(node.initializer.expression) &&
-    node.initializer.expression.text === 'useRouter' &&
+    isRouter(node.initializer, routers) &&
     node.name.elements.some((element) => (element.propertyName ?? element.name).getText() === 'refresh')
   );
 }
@@ -91,9 +135,10 @@ function isRefreshDestructuredFromRouter(node: ts.Node): boolean {
 // never count; only code that uses them does.
 function drawerHistoryHazards(fileName: string, source: string): string[] {
   const file = parse(fileName, source);
+  const routers = routerNames(file);
   const found = new Set<string>();
   const visit = (node: ts.Node) => {
-    if (isRefreshCall(node) || isRefreshDestructuredFromRouter(node)) {
+    if (isRefreshCall(node) || isRouterRefreshAccess(node, routers) || isRefreshDestructuredFromRouter(node, routers)) {
       found.add('`router.refresh()`');
     }
     if ((ts.isSourceFile(node) || ts.isBlock(node)) && isUseServerDirective(node.statements)) {
@@ -125,7 +170,7 @@ describe('drawer history marker guard (#173)', () => {
     expect(scanned.some((file) => file.startsWith('packages/web/src/'))).toBe(true);
     expect(scanned.some((file) => file.startsWith('packages/ui/src/'))).toBe(true);
     expect(scanned).toContain('apps/web/eslint.config.mjs');
-    expect(scanned.some((file) => /(^|\/)(node_modules|\.next|\.turbo)\//.test(file))).toBe(false);
+    expect(scanned.some((file) => /(^|\/)(\.[^/]+|build|coverage|dist|node_modules|public)\//.test(file))).toBe(false);
     // A file that starts calling the hook must be added to DRAWER_PAGES.
     const callsHook = (file: string) => {
       let calls = false;
@@ -160,6 +205,12 @@ describe('drawer history marker guard (#173)', () => {
     ['a bracket call', "router['refresh']();", ['`router.refresh()`']],
     ['a destructured refresh', 'const { refresh } = useRouter();', ['`router.refresh()`']],
     ['a renamed destructured refresh', 'const { refresh: reload } = useRouter();', ['`router.refresh()`']],
+    ['a refresh reference', 'const router = useRouter();\nconst onClick = router.refresh;', ['`router.refresh()`']],
+    ['a refresh passed on', 'const router = useRouter();\nstartTransition(router.refresh);', ['`router.refresh()`']],
+    ['a bracket reference', "const router = useRouter();\nretry(router['refresh']);", ['`router.refresh()`']],
+    ['refresh destructured from a router', 'const router = useRouter();\nconst { refresh } = router;', ['`router.refresh()`']],
+    ['a reference on useRouter()', 'const reload = useRouter().refresh;', ['`router.refresh()`']],
+    ['a refresh reference on another object', 'const reload = cache.refresh;', []],
     ['an aliased import', "import { useActionState as useAction } from 'react';", ['`useActionState`']],
     ['a module directive', "'use server';\nexport async function save() {}", ["a `'use server'` module or function"]],
     ['a function directive', "async function save() {\n  'use server';\n}", ["a `'use server'` module or function"]],
@@ -173,4 +224,12 @@ describe('drawer history marker guard (#173)', () => {
   ])('%s', (_label, source, expected) => {
     expect(drawerHistoryHazards('inline.tsx', source)).toEqual(expected);
   });
+
+  // A `.ts` file is parsed as TS: as TSX, `<Router>router;` would open a JSX
+  // element and swallow the call after it.
+  it('parses a .ts file as TypeScript, not TSX', () => {
+    const source = 'const r = <Router>router;\nr.refresh();';
+    expect(drawerHistoryHazards('inline.ts', source)).toEqual(['`router.refresh()`']);
+    expect(drawerHistoryHazards('inline.tsx', source)).toEqual([]);
+  });
 });
```

- [ ] **Step 2:** Apply the hook comment diff (comment only):

```diff
diff --git a/apps/web/lib/use-detail-drawer.ts b/apps/web/lib/use-detail-drawer.ts
--- a/apps/web/lib/use-detail-drawer.ts
+++ b/apps/web/lib/use-detail-drawer.ts
@@ -31,8 +31,9 @@ import { useCallback, useEffect, useRef } from 'react';
 // returns. A server action that redirects pushes or replaces with an
 // unmarked entry, to the same effect. No drawer page uses either today;
 // keep it that way or re-mark the entry after one.
-// `use-detail-drawer.guard.test.ts` fails if either appears anywhere in
-// `apps/web`, `packages/web/src` or `packages/ui/src`.)
+// `use-detail-drawer.guard.test.ts` looks for both in `apps/web`,
+// `packages/web/src` and `packages/ui/src`; its plan lists what a static
+// scan cannot see.)
 const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';
 
 // The current entry's drawer marker, as a fresh state object for a native
```

- [ ] **Step 3:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.guard.test.ts`. Expected: `Tests 24 passed (24)`. eslint and `tsc` are clean.
- [ ] **Step 4: Failure evidence**, not committed. Plant or mutate each alone, then revert.
  - **H1–H14:** as in revision 6, now out of 24. The code plants give 1 failed / 23 passed; H4 and H6 give 24 passed.
  - **New plants and mutations:**

  | Plant or mutation | Expected |
  | --- | --- |
  | H15: `router.refresh()` in `apps/web/public/zz-planted.js` (gitignored) | 24 passed (skipped) |
  | H16: `'use server'` in `apps/web/coverage/zz.js` | 24 passed (skipped) |
  | H17: `const zzPlanted = router.refresh;` in `components/layout/user-menu.tsx` | 1 failed / 23 passed |
  | H18: `const { refresh } = zzRouter;` from a `useRouter()` variable, in bookings | 1 failed / 23 passed |
  | H19: `const r = <Router>router; r.refresh();` in a new `apps/web/lib/zz-planted.ts` | 1 failed / 23 passed |
  | R1: parse every file as TSX | 1 failed / 23 passed |
  | R2: drop the router-reference rule | 4 failed / 20 passed |
  | R3: skip only `node_modules`, `.next` and `.turbo` | 24 passed alone, because no output directory exists. With the H15 plant: 2 failed / 22 passed. |

- [ ] **Step 5:** One commit: `test(web): catch router.refresh references, skip ignored output, parse by extension (#173)`.

### Revision 7 final verification

- [ ] **Allowlist:** `git diff --name-only a3a8e6c...HEAD -- . ':!docs'` is exactly the guard test and `use-detail-drawer.ts`. The latter is comment-only (scripted check).
- [ ] **H1–H19 and R1–R3** as above.
- [ ] **Full suites:** `pnpm --filter web test` (706 at pre-validation), `lint`, `tsc --noEmit -p .`. No build or browser run is needed. Run the full suite from a worktree outside `.git/`, or from the main tree.

### Revision 7 pre-validation

Applied on the branch at `a3a8e6c`, then removed before this Draft was committed.

| Check | Result |
| --- | --- |
| Guard test | 24 passed (24) |
| H15, H16 | 24 passed (skipped) |
| H17, H18, H19, R1 | 1 failed / 23 passed each |
| R2 | 4 failed / 20 passed |
| R3 alone / with H15 | 24 passed / 2 failed / 22 passed |
| `web` / lint / `tsc` | 706 passed; exit 0; clean |

## Final verification

- [ ] **Next version:** in `apps/web`, `node -p "require('next/package.json').version"` prints `16.3.1`. If not, re-check the two source points in "Why it works" against the installed version before going on, and record the result.
- [ ] **Allowlist:** `git diff --name-only 8553a04...HEAD -- . ':!docs' | sort` equals exactly the four revision 2 File Map paths (the revision 2 scope; later revisions have their own allowlists).
- [ ] **Mutations:** apply each alone, run both test files, and revert. Expected: M1–M6 as in Pre-validation.
  - M1: in `close`, `if (isDrawerEntryPushedHere(paramName)) {` → `if (false) {`.
  - M2: `window.history.pushState({ [DRAWER_ENTRY_KEY]: paramName }, '', href)` → `window.history.pushState(null, '', href)`.
  - M3: `window.history.replaceState(drawerEntryState(), '', href);` → `window.history.replaceState(null, '', href);`.
  - M4: in `closeWithHref`, the same change as M1.
  - M5: `return drawerEntryState()?.[DRAWER_ENTRY_KEY] === paramName;` → `return drawerEntryState() !== null;`.
  - M6: in `close`, `if (isDrawerEntryPushedHere(paramName)) {` → `if (true) {`.
- [ ] **Full suites:** `pnpm --filter web test` (679 at pre-validation), `lint`, `tsc --noEmit -p .` and `build`.
- [ ] **Browser** (production build, fresh tabs; create and delete any missing local records):
  - the regression matrix, all nine pages, columns a–f;
  - navigate away and return, on laundry and bookings, by typed address and by in-app link;
  - a refresh on a pushed drawer, then ×, goes Back to the list.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| `?detail=` close lands on the list; direct links never leave the app | Dashboard UX Foundation §4.4 | 1, 2 |
| `close` takes no argument (eight pages) | #163 plan revision 6 | 1 (existing regression tests kept) |
| Laundry native writes, `openWithHref`/`closeWithHref` | #163 plan | 1, 2 |
| The duplicate entry (#171 Review Focus 1) | #173 | 1, 2 |

## Deferred

- ~~**Double close within one traversal** (M7 P3-1)~~: done in revision 3.
- **Marker loss on `router.refresh()` or a server action** (M7 P3-2). It fails safe, to replace. The hook's header notes it (revisions 3–4), and revisions 5–7 add a guard test that looks for either in `apps/web`, `packages/web/src` and `packages/ui/src`, within its known limits (see Revision 7). Handling the marker at runtime stays deferred until a drawer page needs one.
- **#161 cutover:** remove the laundry-only `openWithHref`/`closeWithHref` and the marker copy in `setState` when laundry leaves the drawer (recorded on #161).

## Gate outcomes

- **M5, review 1 (2026-10-11):** request changes. It raised four points: the Back invariant, hook-test isolation, coverage of all nine pages, and Next version sensitivity. Revision 2 answers each one; see the Revision log.
- **M5, review 2 (2026-10-11): Accepted** at `d8f0ac2`, by the owner. No blocking findings. The reviewer found that revision 2 addresses all four points. The one non-blocking note: the hook tests model the history stack and Next's URL sync separately, so they cannot prove the installed Next.js keeps the marker. The production-build browser matrix is therefore required before merge, not optional. The pre-validation results were not re-run by the reviewer; M6 re-observes them.

### M6 — Implementation complete (2026-10-11)

Implemented on `fix/173-drawer-history-entry-marker` from the Accepted plan (`d8f0ac2`, recorded `cc938e9`). The code was first reset to `8553a04`. Then each task's diffs were extracted from this plan and `git apply`-ed exactly as embedded.

| Task | Commit | Evidence |
| --- | --- | --- |
| 1 Tests first | `93c747b` (one commit with Task 2, as planned) | RED: the hook tests gave 6 failed / 4 passed (10), and the laundry interaction tests 2 failed / 15 passed (17). The failures were exactly the two #173 tests. |
| 2 The marker | `93c747b` | GREEN: 27 passed (27). `tsc` and eslint clean. The applied code is byte-identical to the pre-validated code. |

Final verification:

- **Next version:** `16.3.1`.
- **Allowlist:** OK, exactly the four File Map paths.
- **Mutations** (27 tests each), all reverted; the tree was clean afterwards:

  | Mutation | Result |
  | --- | --- |
  | M1 | 5 failed / 22 passed |
  | M2 | 9 failed / 18 passed |
  | M3 | 1 failed / 26 passed |
  | M4 | 4 failed / 23 passed |
  | M5 | 1 failed / 26 passed |
  | M6 | 3 failed / 24 passed |

- **Full suites:** `web` 679 passed; lint exit 0; `tsc --noEmit -p .` clean; Next build succeeded. `@clensy/web` 402 passed.
- **Browser** (required by M5): this commit's web (production build, port 3999) against this branch's API (port 3002) and the local Postgres, in Chromium, with fresh tabs.
  - **Regression matrix:** all nine pages, columns a–f: 54 of 54 pass.
  - **Navigate away and return:** laundry and bookings, by typed address and by in-app link, 4 of 4 pass. Back restores the marked drawer entry, × lands on the list with no extra entry, and Forward reopens the drawer.
  - **Refresh on a pushed drawer:** laundry and bookings. The marker survives the reload, × returns to the list URL, and `history.length` is unchanged.
  - **Console:** only a `favicon.ico` 404, which is unrelated.
  - **Cleanup:** a throwaway `TENANT_OWNER`, and one job, cleaner and add-on created for the matrix, were all deleted afterwards. The booking used for the job is unchanged (`CONFIRMED`).

Deviation: none.

Next gate: **M7 — Code Review**, by a fresh independent reviewer (`CLAUDE.md`: application code).

### M7 — Approved for merge (2026-10-12, fresh independent review)

A fresh agent context on Opus 5.5 reviewed PR #174 (`8553a04...07d69a6`, code commit `93c747b`). It did not implement the change (`CLAUDE.md`: application code). It was read-only, worked in a temporary worktree that it removed, and left the main tree clean.

**Decision: Approved for merge. Blocking findings: none.**

The reviewer independently confirmed:

- **Gate order:** M4 → revision 2 → M5 record → code → M6 record. No `Co-Authored-By` or "Generated with" line in any commit or the PR body.
- **Exact application:** the plan's four diffs, applied to `8553a04`, reproduce `93c747b` exactly. They are byte-identical at `d8f0ac2` (the accepted revision) and at HEAD, and the allowlist is exact.
- **Test-first:** RED was 6 failed / 4 passed for the hook tests and 2 failed / 15 passed for the laundry tests; GREEN was 27 passed. A behavioural RED, the reviewer's own: with its `entryStates` assertion removed, the laundry Forward test still fails on `8553a04` (`nav.index` 1 ≠ 0). So it reproduces the duplicate entry itself.
- **Mutations:** M1–M6 at the recorded counts. One extra mutant, `closeWithHref` always going Back, gave 3 failed.
- **Suites:** `web` 679; lint and `tsc` exit 0, and both caught a planted type error.
- **Next 16.3.1 source:**
  - The marker survives a native push, Back/Forward and a reload: `copyNextJsInternalHistoryState`, `ACTION_RESTORE` → `completeTraverseNavigation` (`preserveCustomHistoryState: true`), and `create-initial-router-state.js`.
  - `drawerEntryState()`'s fresh object avoids the `__NA` short-circuit.
  - Every `router.push`/`replace` drops the marker, so no path marks an entry this hook did not push.
  - `window` is only read inside callbacks.
- **Equivalence for the eight pages:**
  - `useSearchParams` syncs.
  - Scroll is kept, because a restore reuses the scroll ref.
  - Jobs `openDetail(newId)` and bookings' `onClose()` after a delete behave as before.
  - The modal drawer blocks list controls while a drawer entry is current.
- **Spec §4.4 and the Global Constraints** are met.

Reported only by M6, not re-run: the Next build, `@clensy/web` 402, the browser matrix (54/54, navigate-away 4/4, refresh), and the owner's hands-on check.

**Non-blocking (P3):**
1. **A double close can go Back twice** (`use-detail-drawer.ts:68`, `:90`). The marker stays on the entry until the asynchronous `popstate`. If `close` runs twice inside that window (for example × and then the backdrop within milliseconds), `history.back()` runs twice and can pass the list entry. That is hard to trigger. Deferred: ignore a second close until the next `popstate`.
2. **`router.refresh()` and server-action retries would drop the marker** (`preserveCustomHistoryState: false`). × would then fail safe to replace, bringing back the old duplicate. No app code uses either today. Deferred.
3. **The hook-level Forward test fails on `8553a04` for a setup reason:** the mocked `router.push` adds no entry. The laundry interaction test shows the regression itself (the behavioural RED above). No action needed; the plan already says the harness cannot model Next's state copying.
4. **The author's scratch files in `.git/claude-tmp/`** are untracked and outside the work tree. They are removed at closeout.

Next gate: **M8**, then M9 and M10. Merge is the owner's decision.

### M8 — Complete, comment-only (2026-10-12)

```text
Decision: Complete
Subject: PR #174, branch fix/173-drawer-history-entry-marker
Scope: apps/web/lib/use-laundry-order-list-url-state.ts (the native-writes comment block);
       apps/web/app/app/laundry/page.tsx (the LaundryDetailDrawer onClose comment)
M7 / authorization: Approved for merge; M8–M10 per the owner's "continue"
Goal: comments that explain the implementation. Both still said a drawer "reached by a direct link or refresh"
closes by replacement. After #173 a refresh keeps the marker and goes Back; only an unmarked entry (a direct link)
is replaced. Found by the author after M7; M7 did not raise it.
Behaviour: unchanged. The diff touches comment lines only (scripted check: no added or removed non-comment line).
Characterization: none needed; no executable line changed.
Verification after: `web` 679 passed; lint exit 0; `tsc --noEmit -p .` clean.
Commit: 997e120
Out of scope, deferred: M7 P3-1 and P3-2 are behaviour changes (see Deferred). P3-3 and P3-4 need no code.
Review: page.tsx is outside the plan's four-path code allowlist, and both files are application code, so a fresh
independent reviewer checks this delta (CLAUDE.md); see "M8 review" below.
```


### M9 — Complete (2026-10-12)

```text
Decision: Complete
Subject: #173, PR #174
Documentation scope:
- apps/web/README.md (the laundry "Native history writes" bullets and the "Drawer hook" paragraph)
- docs/superpowers/plans/2026-10-10-laundry-list-followups-plan.md (Deferred: mark the close-after-Forward item resolved)
- PR #174 body (the M8 comment fix and these docs)
- this plan (Deferred, Gate outcomes)

Content updates (each traces to M6, M7 or M8 of #173):
- apps/web/README.md: opening pushes a marked entry; closing goes Back when the entry is marked, also after Forward or
  a refresh, and replaces it otherwise; list updates keep the marker (← Task 2). The "Drawer hook" paragraph no longer
  says `open`/`close` are unchanged for the other pages: the hook now serves every page with the marker. It keeps the
  `close`-takes-no-argument rule (← Task 2; Global Constraints).
- #171 plan Deferred: the "close after Forward" item points to #173 / PR #174 as resolved (← M6, M7).
- This plan: Deferred items for M7 P3-1 and P3-2 (← M7).

Editorial changes: none.
Unchanged, with reason: packages/web/README.md (no package change); docs/README.md (no API, schema or tenant
change); the Dashboard UX Foundation spec (§4.4 leaves the mechanism to M4, so no spec text changes); the #163 plan
(historical record of its own revision; its "unchanged for other pages" wording described that slice); no changelog
or roadmap exists.
Verification: 19 relative links and anchors in the touched files resolve (scripted scan). Status consistency: plan
Accepted (revision 2), M6 complete, M7 Approved, M8 complete (comment-only, independent review below), PR #174 open.
Gate: Documentation complete. Code unchanged in M9.
```

### M8 review — Approved (2026-10-12, fresh independent review)

A fresh agent context on Opus 5.5 reviewed `997e120` (`CLAUDE.md`: application code). It did not write it, and it ran read-only.

**Decision: Approved. Blocking findings: none.**

- **Scope:** the commit touches exactly the two declared files, and every changed line is a `//` comment.
- **Accuracy:** the new wording matches `use-detail-drawer.ts` (marked → `router.back()`, unmarked → `replaceState`), `setState`'s `drawerEntryState()`, and Next 16.3.1's history-state handling. The old "direct link or refresh" wording was wrong after `93c747b`.
- **Stale-text sweep of `apps/web`:** no other comment describes the old flag as current. One P3 was raised, the README "Drawer hook" paragraph ("unchanged for every other page"), and it is already fixed by the M9 commit `4be9c68`. The reviewer checked that rewrite against the code.
- **`tsc --noEmit -p .`:** exit 0.

### M10 — Accepted, workflow validated (2026-10-12)

The asset inventory is unchanged: nine prompts for M2–M10, plus `prompt-library.md` for M1.

- **§2.5:** the M5 record `cc938e9` precedes the code commit `93c747b`.
- **One PR:** #174 carries the plan, code, M8 comments and docs (§2.8).
- **Providers:** GitHub via `gh` for #173, the branch and PR #174.
- **M7:** a fresh, independent, read-only review on the most capable model. The M8 code delta had its own fresh review, because it touched application code outside the plan's allowlist.
- **Slice Completion Reports** were emitted at M6 and M7–M10.

Earlier lessons applied:
- **#163:** reviewers used their own scratch directories, and the plan named every consumer of the shared hook.
- **#171:** records state anomalies as unexplained rather than guessing. The one console error, a `favicon.ico` 404, was read and attributed from the log.

**Blocking findings:** none.

**Non-blocking observation:** the plan's File Map did not include comments elsewhere that describe the changed behaviour (`laundry/page.tsx`). M7 did not catch them; the author found them at M9. For a change to shared behaviour, a planning step should grep for prose that describes it.

Gate: **Workflow validated.**

### M5 — Accepted (2026-10-13, revision 3)

Accepted at `d04212e` by the owner. No blocking findings.

**Clarification raised:** the guard clears on *any* `popstate`, not specifically on the one from the hook's own Back. Could an unrelated traversal clear it early and allow a second Back?

**Author's answer (recorded before M6):** a close goes Back only while the *current* entry carries the marker (`isDrawerEntryPushedHere`). By the HTML spec, `popstate` fires only on a traversal to a different session-history entry. So any `popstate`, related or not, means the current entry has changed:
- If the user is then on an unmarked entry, a close replaces, or no drawer is shown.
- If the user is on a marked entry again, they traversed back to a drawer deliberately, and a close there is a genuine close of that drawer.

A second Back from the *same* drawer entry needs a `popstate` that leaves the current entry unchanged, which does not occur. No code change is needed. M6 adds a browser check that interleaves an unrelated traversal: ×, browser Forward and × again, in one task, with a forward entry present. It must never end before the list entry.

The pre-validation was not re-run by the reviewer; M6 re-observes it against the committed implementation.

### M6 — Revision 3 implemented (2026-10-13)

Implemented from the Accepted revision 3 (`d04212e`, recorded `348ed2f`). Task 3's two diffs were extracted from this plan and `git apply`-ed exactly as embedded, the test first.

| Task | Commit | Evidence |
| --- | --- | --- |
| 3 Double-close guard | `3253a5f` | RED 2 failed / 10 passed (12), exactly the two new tests. GREEN 29 passed (29). eslint and `tsc` clean. The applied code is byte-identical to the pre-validated code. |

Revision 3 final verification:

- **Allowlist:** OK, exactly `use-detail-drawer.ts` and `use-detail-drawer.test.tsx`.
- **Mutations:** G1 2 failed / 27 passed; G2 5 failed / 24 passed; G3 2 failed / 27 passed; G4 1 failed / 28 passed. All were reverted, and the tree was clean afterwards.
- **Full suites:** `web` 681 passed; lint exit 0; `tsc --noEmit -p .` clean; Next build succeeded.
- **Browser** (required by M5): a production build of `3253a5f` with a clean tree, against the branch API and local Postgres, in Chromium, with fresh tabs and a throwaway `TENANT_OWNER` that was deleted afterwards.
  - **Double close:** 18 of 18 pass, on 6 pages (bookings, billing, catalog, customers, cleaners/teams, laundry) × 3 ways (× then the backdrop in one task; two Escape keydowns in one task; two Escape presses). Each case lands on the list, Forward reopens the drawer, and × closes it again.
  - **Unrelated traversal interleaved** (the M5 clarification). On laundry and bookings, from the drawer entry with a forward entry (`/app/billing`) present, one task ran ×, `history.forward()` and × again. Both ended on the list URL, never before the list entry.
  - **Regression matrix** a–f on the same 6 pages, and refresh then × on laundry and bookings: all pass.
  - **Not run:** jobs, cleaners and add-ons have no local rows. They use the hook wired the same way.

Deviation: none.

Next gate: **M7**, a fresh independent review (`CLAUDE.md`: application code).

### M7 — Approved for merge (2026-10-13, fresh independent review of revision 3)

A fresh agent context on Opus 5.5 reviewed the revision 3 delta, `a81fb02...7a19265` (code commit `3253a5f`). It did not implement the change. It was read-only, worked in a temporary worktree that it removed, and left the tree clean.

**Decision: Approved for merge. Blocking findings: none.**

The reviewer independently confirmed:

- **Gate order:** `d04212e` → `348ed2f` → `3253a5f` → `7a19265`. No attribution lines in any commit or the PR body.
- **Exact application:** the embedded diffs, applied to `a81fb02`, are byte-identical to `3253a5f`, and the allowlist is exact.
- **Tests and suites:**
  - RED was 2 failed / 10 passed; GREEN was 29 passed.
  - G1–G4 at the recorded counts.
  - `web` 681 passed; lint and `tsc` exit 0.
- **Next 16.3.1:** `router.back()` is exactly `window.history.back()`. Next's `onPopState`, and the rest of `next/dist/client`, never stops propagation. So every same-document `popstate` reaches the hook.
- **The M5 clarification:** the author's argument holds.
- **Other behaviour:**
  - StrictMode and remount are safe.
  - Each page has exactly one hook instance, and its close is wired to that instance.
  - Bookings' programmatic close after a delete is correctly ignored while a Back is pending.
  - Direct links are unchanged.
- **Tests are faithful and not vacuous.**

Reported only by M6, not re-run: the Next build and all the browser results.

**P2-1 (non-blocking, but introduced by this revision): the guard can stay set after a cross-document Back followed by a bfcache restore** (`use-detail-drawer.ts:64-77`).
- **Scenario:** open a row, refresh, press ×. The Back crosses to the list in the older document. Then press Forward: if the drawer document is restored from bfcache, the browser fires `pageshow` (`persisted`), not `popstate`. The ref stays `true`, so ×, Escape and the backdrop do nothing.
- **Recovery:** browser Back and the sidebar still work.
- **Likelihood:** narrow. It needs a cross-document Back, a bfcache-eligible page (the `/app` pages are dynamic and likely `no-store`), and then Forward.
- **Before revision 3,** the same flow worked.
- **Suggested fix:** also clear the guard on `pageshow` with `persisted` (or on `pagehide`).
- **Status:** reasoned from Next and HTML semantics; not reproduced.
- **Plan correction:** the "Risk considered" paragraph's "leaving the document unmounts the hook" is not true under bfcache (P3-1).

**P3-2:** the header comment is accurate for `router.refresh()`. "Server-action navigation" is loose: a server-action redirect pushes a new, unmarked entry rather than stripping the current one. The stated outcome (× replaces, which is safe) holds.

**Owner decision pending** on P2-1: fix it in this PR (revision 4) or track it.

### M5 — Accepted (2026-10-13, revision 4)

Accepted at `b014706` by the owner. No blocking findings.

The reviewer's clarification is recorded as a verification limitation, not a gap to close now:
- The new test dispatches a synthetic `pageshow` (`persisted: true`). It verifies the handler's condition, not that a real back/forward-cache restore keeps the hook instance and fires the event in that sequence.
- Playwright's Chromium launches with the cache disabled, so no real restore is exercised here.
- M6 and later records MUST NOT claim real-restore coverage.
- An end-to-end check is to be added if a browser environment with the cache enabled becomes available.

The pre-validation was not re-run by the reviewer; M6 re-observes it.

### M6 — Revision 4 implemented (2026-10-13)

Implemented from the Accepted revision 4 (`b014706`, recorded `dfcf3a2`). Task 4's two diffs were extracted from this plan and `git apply`-ed exactly as embedded, the test first.

| Task | Commit | Evidence |
| --- | --- | --- |
| 4 Release on a back/forward-cache restore | `6785ac2` | RED 1 failed / 12 passed (13), exactly the new test. GREEN 30 passed (30). eslint and `tsc` clean. The applied code is byte-identical to the pre-validated code. |

Revision 4 final verification:

- **Allowlist:** OK, exactly the two hook files.
- **Mutations** (30 tests each), all reverted; the tree was clean afterwards:

  | Mutation | Result | Note |
  | --- | --- | --- |
  | G5 | 1 failed / 29 passed | as planned |
  | G6 | 1 failed / 29 passed | as planned |
  | G1 | 3 failed / 27 passed | one more than in revision 3: the new test also depends on the guard |
  | G2 | 6 failed / 24 passed | one more than in revision 3, for the same reason |
  | G3 | 3 failed / 27 passed | one more than in revision 3, for the same reason |
  | G4 | 1 failed / 29 passed | |

- **Full suites:** `web` 682 passed; lint exit 0; `tsc --noEmit -p .` clean; Next build succeeded.
- **Browser:** a production build of `6785ac2` with a clean tree, in Chromium, with fresh tabs and a throwaway `TENANT_OWNER` that was deleted afterwards. These results describe the PR's final code.
  - **Double close:** 18 of 18, on 6 pages × 3 ways.
  - **Refresh, and a full page load away and Back,** each then ×, Forward and × again: 4 of 4, on laundry and bookings.
  - **Regression matrix** a–f on the 6 pages: all pass.
- **Limitation, per M5:** a real back/forward-cache restore is **not** browser-verified. Playwright's Chromium disables the cache. The synthetic `pageshow` test and G5/G6 prove the handler's logic only.

Deviation: none.

Next gate: **M7**, a fresh independent review (`CLAUDE.md`: application code).

### M7 — Approved for merge (2026-10-13, fresh independent review of revision 4)

A fresh agent context on Opus 5.5 reviewed the revision 4 delta, `9db8ae0...24e9622` (code commit `6785ac2`). It did not implement the change. It was read-only, worked in a temporary worktree that it removed, and left the tree clean.

**Decision: Approved for merge. Blocking findings: none.**

The reviewer independently confirmed:
- **Gate order:** `b014706` → `dfcf3a2` → `6785ac2` → `24e9622`. No attribution lines.
- **Exact application:** the embedded Task 4 diffs, applied to `3253a5f`, are byte-identical to `6785ac2`, and the allowlist is exact.
- **Tests:** RED was 1 failed / 12 passed; GREEN was 30 passed. G1–G6 matched the recorded counts (3, 6, 3, 1, 1, 1 failed).
- **Suites:** `web` 682 passed; lint and `tsc` exit 0.

Its correctness findings, reasoned and not reproduced:
- **`pageshow` semantics:** releasing only on `persisted` is right.
- **Listeners:** they are added and removed symmetrically, and StrictMode is safe.
- **No sequence gives a double Back:** a persisted restore cannot arrive while this hook's same-document Back is still in flight.
- **The author's Chromium observation fits the HTML spec:** `pushState` entries share their document state, and a reload or re-fetch fills it with one new document. The "defensive" label is fair.
- **The header comment** was checked against Next 16.3.1 (`refresh-reducer.js:75`, `redirect.js:52`, `server-action-reducer.js:240`).

It confirmed that the M5 limitation is recorded honestly: no record claims real-restore coverage.

**Non-blocking (P3):**
1. **The header comment is narrower than before** (`use-detail-drawer.ts:28-32`). A server action that revalidates without redirecting replaces the current entry's state without custom keys, as `router.refresh()` does. `redirect(url, RedirectType.replace)` replaces the entry. Each outcome is the same safe fallback. Suggested wording: "a server action that revalidates or redirects". → M8.
2. **The PR body is stale:** it describes revision 2, says the double close is deferred, and gives the old counts. → M9.

Reported only by M6, not re-run: the Next build, the browser results, and the Chromium document-reuse observations (checked for consistency with the spec only).

### M8 — Complete, comment-only (2026-10-13, revisions 3–4)

```text
Decision: Complete
Subject: PR #174, branch fix/173-drawer-history-entry-marker
Scope: apps/web/lib/use-detail-drawer.ts (the header note on router.refresh() and server actions)
M7 / authorization: revision 4 Approved for merge; the owner chose to fix in this PR and continue to merge
Goal: M7 (revision 4) P3-1. The note now says a server action that revalidates drops the marker as router.refresh()
does, and that a server action that redirects pushes or replaces with an unmarked entry.
Behaviour: unchanged. Comment lines only (scripted check). `web` 682 passed; lint exit 0; `tsc` clean.
Commit: c87c334
Review: a fresh independent reviewer approved c87c334 (CLAUDE.md: application code). Its wording was checked against
Next 16.3.1 (server-action-reducer.js:240, 290-327; redirect.js:52; navigation.js:350/461; app-router.js
HistoryUpdater). Optional P3, no change: "revalidates or refreshes" would be exact, because an action calling
refresh() or returning new Flight data without revalidating also drops the marker. The comment's guidance still holds.
```

### M9 — Complete (2026-10-13, revisions 3–4)

```text
Decision: Complete
Subject: #173, PR #174
Documentation scope: apps/web/README.md (Drawer hook, one sentence); PR #174 body; this plan (Gate outcomes)
Content updates:
- apps/web/README.md: a second close before the Back lands is ignored, so it never goes Back past the list (← Task 3).
- PR #174 body: rewritten for revisions 2–4, the current counts, the per-revision gates, the back/forward-cache
  limitation and the Deferred items (← M7 revision 4 P3-2).
Unchanged, with reason: packages/web/README.md and docs/README.md (no package, API or schema change); the spec (§4.4
leaves the mechanism to M4).
Verification: relative links and anchors in the touched files resolve (scripted scan). Status consistency: plan
Accepted (revision 4); M6 complete and M7 Approved for revisions 2, 3 and 4; M8 complete; PR #174 open.
Gate: Documentation complete. Code unchanged in M9.
```

### M10 — Accepted, workflow validated (2026-10-13, revisions 3–4)

The asset inventory is unchanged. Two post-approval revisions each followed the gates in order:
- **Revision 3:** the owner's request → M4 → owner M5 → M6 red first → fresh M7.
- **Revision 4:** M7 P2-1 → owner decision → M4 → owner M5 → M6 red first → fresh M7.

That honours §2.4 and §2.5 for changed application code. Every application-code delta, including both comment-only M8 commits, had a fresh independent review (`CLAUDE.md`).

- **One PR:** #174 carries the plan, code and docs.
- **Providers:** GitHub via `gh`, for the PR and the #161 note.

**Blocking findings:** none.

**Observations:**
1. **A reviewer's failure scenario is a hypothesis until observed.** The revision 3 P2-1 refresh scenario turned out not to cross documents in Chromium. Probing the scenario before writing the fix kept the plan accurate about what was, and was not, reproduced.
2. **Record verification limits explicitly.** Here that is a back/forward-cache restore that Playwright cannot produce. An unverified path must not be implied as covered.

Gate: **Workflow validated.**

### M5 — Accepted (2026-10-13, revision 5)

Accepted at `13863e2` by the owner, with two test changes. Both are applied in this record commit (Task 5 above), as the #171 revision 2 precedent allows:

1. **Inline comments were not stripped.** `withoutComments()` missed trailing comments: `const value = true; // router.refresh()` would have tripped the guard. The detector now walks the TypeScript syntax tree instead of stripping comments with regexes. Inline cases, H4 and H6 pin this.
2. **Coverage now asserts all nine drawer pages** (`DRAWER_PAGES`), and that every `apps/web/app` file calling `useDetailDrawer(` is listed. H7 pins this.

The no-runtime-change decision stands. The amended version was pre-validated before this record (see "Revision 5 pre-validation"), and M6 re-observes it.

### M6 — Revision 5 implemented (2026-10-13)

Implemented from the Accepted revision 5, as amended at M5 (`854bb92`). Task 5's two diffs were extracted from this plan and `git apply`-ed exactly as embedded.

| Task | Commit | Evidence |
| --- | --- | --- |
| 5 Guard test | `865a5d0` | Guard 13 passed (13). eslint and `tsc` clean. The hook change is comment-only (scripted check). The applied code is byte-identical to the pre-validated code. |

Revision 5 final verification:
- **Allowlist:** OK, exactly `use-detail-drawer.guard.test.ts` and `use-detail-drawer.ts`.
- **H1–H7** (each planted alone in a real file and reverted; the tree was clean afterwards): H1, H2, H3, H5 and H7 gave 1 failed / 12 passed; H4 and H6 (comments) gave 13 passed.
- **Full suites:** `web` 695 passed; lint exit 0; `tsc --noEmit -p .` clean.
- **Not needed** (per M5): a Next build and browser checks, because no runtime code changed.

Deviation: none.

Next gate: **M7**, a fresh independent review (`CLAUDE.md`: application code, test and comment).

### M7 — Returned for revision (2026-10-13, fresh independent review of revision 5)

A fresh agent context on Opus 5.5 reviewed `4c028b5...2b4e6a6` (code commit `865a5d0`). It did not implement the change. It was read-only, worked in a temporary worktree that it removed, and left the tree clean.

**Decision: Return** (M4 amendment → M5 → M6). Do not merge.

**Re-observed:**
- the gate order, and no attribution lines;
- the plan diffs reproduce `865a5d0` exactly, and the allowlist is exact;
- the hook change is comment-only;
- guard 13 passed; H1–H7 as tabulated;
- `web` 695 passed; lint and `tsc` exit 0;
- the scan test takes about 122 ms.

**P1 (blocking): the scan misses code that is mounted while a drawer is open.**
- `SCANNED` leaves out the dashboard shell, `apps/web/components/layout/*` (header, user menu, session guard, i18n provider), which `app/app/layout.tsx` mounts around every drawer page. It also leaves out `'use server'` files outside the scanned roots.
- Re-observed: `r.refresh()` planted in `user-menu.tsx` left the guard green.
- Realistic case: a language or tenant switcher that refreshes while a drawer is open.
- The hook comment ("fails if either appears") and the test's name overclaim.
- Preferred fix: scan all of `apps/web` (skipping `node_modules` and `.next`) plus `packages/web/src`. The reviewer verified that this is clean on today's tree and catches the plant.

**P2: stale plan text.** The revision 5 Why/Scope block still describes the superseded regex detector, and the header Scope row says "two test files".

**P3 (notes):**
1. **False negatives:** `router['refresh']()` and `const { refresh } = useRouter(); refresh()` are not caught. Aliased imports and `React.useActionState` are caught.
2. **False positives:** any zero-argument `.refresh()` on an unrelated object, and identifiers named `useActionState`/`useFormState`. They fail loudly, which is acceptable.
3. **Coverage regex:** `useDetailDrawer(` misses an aliased import.
4. **`packages/ui`:** no router use today; cheap to add.
5. **Next accuracy:** the refresh claim is accurate. The test header's "or a server action" could say "that revalidates, refreshes or redirects" (`server-action-reducer.js:266-273`).
6. **Workflow:** folding the reviewer's changes into the M5 record commit was acceptable as an owner decision, but substantive rewrites are better sent back as a Return plus a Draft revision (`plan-review.md`).

### M5 — Accepted (2026-10-13, revision 6)

Accepted at `4f0e026` by the owner, subject to confirming the file-extension assumption.
- **Confirmed by scan:** in `apps/web`, `packages/web/src` and `packages/ui/src`, the only non-TypeScript files are `apps/web/eslint.config.mjs` and `apps/web/postcss.config.mjs`. Both are config, not app code.
- **But it is not enforced:** `apps/web/tsconfig.json` has `allowJs: true`, and Next's default page extensions include `.js`/`.jsx`.
- **Resolution:** the acceptance allows including JavaScript when it is supported, so the filter now takes `.[cm]?[jt]sx?`, and the coverage test asserts that `eslint.config.mjs` is scanned. This is a one-line change, folded into Task 6 in this record commit.
- **Pre-validation:** guard 17 passed; H13 (`.jsx`) and H14 (`.js` with `'use server'`) each gave 1 failed / 16 passed.

The second point, an aliased `useDetailDrawer` import evading the coverage check, is accepted as a documented limitation. The hazard scan still covers such a file.

### M6 — Revision 6 implemented (2026-10-13)

Implemented from the Accepted revision 6, as amended at M5 (`e7d8474`). Task 6's two diffs were extracted from this plan and `git apply`-ed exactly as embedded.

| Task | Commit | Evidence |
| --- | --- | --- |
| 6 Widen the guard | `d66e55e` | Guard 17 passed (17). eslint and `tsc` clean. The hook change is comment-only (scripted check). The applied code is byte-identical to the pre-validated code. |

Revision 6 final verification:
- **Allowlist:** OK, exactly the guard test and `use-detail-drawer.ts`.
- **H1–H14** (each planted alone and reverted; the tree was clean afterwards):

  | Plant | Result |
  | --- | --- |
  | H1, H2, H3, H5, H7–H14 | 1 failed / 16 passed each |
  | H4, H6 (comments) | 17 passed |

- **Full suites:** `web` 699 passed; lint exit 0; `tsc --noEmit -p .` clean.
- **Not needed:** a Next build or browser run, because no runtime code changed.

Deviation: none.

Next gate: **M7**, a fresh independent review (`CLAUDE.md`).

### M7 — Approved for merge (2026-10-13, fresh independent review of revision 6)

A fresh agent context on Opus 5.5 reviewed `75cde5e...5032fb6` (code commit `d66e55e`). It did not implement the change. It was read-only, and it removed its worktrees and left the tree clean.

**Decision: Approved for merge. Blocking findings: none.**

The reviewer independently confirmed:
- **Gate order:** `4f0e026` → `e7d8474` → `d66e55e` → `5032fb6`. No attribution lines anywhere from `8553a04` to HEAD, or in the PR body.
- **Exact application:** the plan diffs reproduce `d66e55e` byte for byte, and the allowlist is exact.
- **The hook change is comment-only.**
- **Guard:** 17 passed, about 250 ms, 104 files.
- **H1–H14** as tabulated; H12 fails the coverage test specifically.
- **Suites:** `web` 699 passed, from a worktree outside `.git/`; lint and `tsc` exit 0.
- **Revision 5's findings are resolved:** P1 (H8 now fails), P2, P3-1 and P3-5.
- **The M5-time JavaScript fold** is acceptable: small and mechanical, inside the stated allowance, pre-validated and openly recorded. One caveat: "one-line filter" understates it, because the fold is a regex, a comment and one coverage assertion.

**Non-blocking (P3):**
1. **Not caught:**
   - `refresh` passed as a reference (`onClick={router.refresh}`, `startTransition(router.refresh)`);
   - `const { refresh } = router`.

   The hook comment at `use-detail-drawer.ts:33-35` therefore slightly overclaims.
2. **Gitignored generated directories are scanned.** `public/`, `dist/`, `build/` and `coverage` under `apps/web` are read, so local output can turn the guard red while CI stays green.
3. **`.ts` files are parsed as TSX.** An angle-bracket assertion in a `.ts` file would misparse silently. There are zero diagnostics today.
4. **Stale plan text:** the File Map lacks the guard test; Final verification says "four File Map paths"; the Deferred bullet describes the revision 5 guard.
5. **`@clensy/client` and `@clensy/validation` are not scanned.** Neither uses any of these APIs today; this falls under the documented limit.
6. **Next accuracy:** the comments are accurate. Minor: a ragged comment wrap at guard lines 11-12.

**Environment note:** run full suites from a worktree outside `.git/`. Vite's default `fs.deny` blocks `**/.git/**`.
