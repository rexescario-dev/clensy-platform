# Drawer History Entry Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Accepted (revision 2) |
| M5 decision (revision 2) | **Accepted** — 2026-10-11, at `d8f0ac2`, by the owner. No blocking findings. M6 MUST run Final verification in full; the production-build browser matrix is required before merge, because the test harness models history and cannot prove the installed Next.js keeps the marker. M7 MUST be a fresh independent review (`CLAUDE.md`: application code). Pre-validation counts are author-reported until M6 re-observes them. |
| M5 decision (revision 1) | Request changes — 2026-10-11, at `b0eec89`. See Gate outcomes. |
| Date | 2026-10-11 |
| Tracking issue | [#173](https://github.com/rexescario-dev/clensy-platform/issues/173). Follows #171 (merged in #172 at `8553a04`), whose plan deferred this behaviour (Review Focus 1). |
| Scope | `apps/web/lib/use-detail-drawer.ts`, `apps/web/lib/use-laundry-order-list-url-state.ts`, and two test files. No page, `@clensy/ui`, `@clensy/web`, API or schema change. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.4, the `?detail=` drawer convention. Its close behaviour is "a **requirement, not a prescribed mechanism** — M4 (Implementation Planning) chooses the safest way to satisfy it", and the same-page flag is "one reasonable implementation — not the only one, and not mandated here". This plan replaces the flag. It changes no spec semantics. For the laundry list it relies on the [#163 plan](2026-10-10-laundry-order-list-plan.md) (native History API URL writes, `openWithHref`/`closeWithHref`). |
| Authority | Where this plan and an Accepted spec disagree, the spec wins. |
| Edit anchors | Unified diffs against `main` at `8553a04`. |

**Goal:** fix the duplicate list history entry on all nine drawer pages. Today `useDetailDrawer` decides between Back and replace with an in-memory flag (`openedHereRef`). After open → × → browser Forward → ×, the flag is false while the user is on an entry the page itself pushed. So × replaces that entry with the list URL, leaving two identical list entries: one Back press appears to do nothing, and Forward to the drawer is lost.

**Approach:** put the fact on the history entry.
- **On open,** `open` and `openWithHref` push the drawer entry with the native History API and a marker in `history.state`: `{ __clensyDetailDrawer: <paramName> }`.
- **On close,** `close` and `closeWithHref` go Back when the current entry carries the marker for their param. Otherwise they replace the entry as today (`router.replace` / `replaceState`), so a direct link, bookmark or new tab never leaves the app.
- **The flag** is removed.

## Revision log

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

## Final verification

- [ ] **Next version:** in `apps/web`, `node -p "require('next/package.json').version"` prints `16.3.1`. If not, re-check the two source points in "Why it works" against the installed version before going on, and record the result.
- [ ] **Allowlist:** `git diff --name-only 8553a04...HEAD -- . ':!docs' | sort` equals exactly the four File Map paths.
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

## Gate outcomes

- **M5, review 1 (2026-10-11):** request changes. It raised four points: the Back invariant, hook-test isolation, coverage of all nine pages, and Next version sensitivity. Revision 2 answers each one; see the Revision log.
- **M5, review 2 (2026-10-11): Accepted** at `d8f0ac2`, by the owner. No blocking findings. The reviewer found that revision 2 addresses all four points. The one non-blocking note: the hook tests model the history stack and Next's URL sync separately, so they cannot prove the installed Next.js keeps the marker. The production-build browser matrix is therefore required before merge, not optional. The pre-validation results were not re-run by the reviewer; M6 re-observes them.
