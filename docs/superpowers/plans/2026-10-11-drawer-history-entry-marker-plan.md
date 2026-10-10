# Drawer History Entry Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-11 |
| Tracking issue | [#173](https://github.com/rexescario-dev/clensy-platform/issues/173). Follows #171 (merged in #172 at `8553a04`), whose plan deferred this behaviour (Review Focus 1). |
| Scope | `apps/web/lib/use-detail-drawer.ts`, `apps/web/lib/use-laundry-order-list-url-state.ts`, and two test files. No page, `@clensy/ui`, `@clensy/web`, API or schema change. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.4, the `?detail=` drawer convention. Its close behaviour is explicitly "a plan-level implementation decision": the same-page flag is "one reasonable implementation — not the only one, and not mandated here". This plan replaces the flag. It changes no spec semantics. For the laundry list it relies on the [#163 plan](2026-10-10-laundry-order-list-plan.md) (native History API URL writes, `openWithHref`/`closeWithHref`). |
| Authority | Where this plan and an Accepted spec disagree, the spec wins. |
| Edit anchors | Unified diffs against `main` at `8553a04`. |

**Goal:** fix the duplicate list history entry on all nine drawer pages. Today `useDetailDrawer` decides between Back and replace with an in-memory flag (`openedHereRef`). After open → × → browser Forward → ×, the flag is false while the user is on an entry the page itself pushed. So × replaces that entry with the list URL, leaving two identical list entries: one Back press appears to do nothing, and Forward to the drawer is lost.

**Approach:** put the fact on the history entry.
- **On open,** `open` and `openWithHref` push the drawer entry with the native History API and a marker in `history.state`: `{ __clensyDetailDrawer: <paramName> }`.
- **On close,** `close` and `closeWithHref` go Back when the current entry carries the marker for their param. Otherwise they replace the entry as today (`router.replace` / `replaceState`), so a direct link, bookmark or new tab never leaves the app.
- **The flag** is removed.

## Why it works with Next.js 16.3.1 (checked in source and in a browser)

- **Native pushes keep the marker.** Next patches `history.pushState`/`replaceState` and copies its own keys (`__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`) into the state object passed in, so custom keys survive. Source: `next/dist/client/components/app-router.js`, `copyNextJsInternalHistoryState`.
- **Back/Forward keep it.** Back/Forward are "traverse" navigations, which preserve custom history state (`preserveCustomHistoryState: true` in `segment-cache/navigation.js`, `completeTraverseNavigation`). `router.push`/`replace` start entries without it, which is irrelevant here.
- **A refresh keeps it,** because `history.state` survives a reload.
- **Browser check (pre-validation, production build of this change):**
  - **Laundry:** open → × → Forward → × → Forward → ×. Every × went Back, `history.length` stayed 3, and the drawer reopened each time. Next's own keys sat alongside the marker.
  - **Bookings and Customers:** the same, once each.
  - **Direct link in a new tab:** no marker, so × replaced the entry and stayed in the app.
  - **Refresh on a pushed drawer:** × went Back to the list.
  - **The owner tried it hands-on and confirmed it works.**

## Global Constraints

- `close` still takes no argument. The eight other pages pass it straight to `onClose`, and #163's regression test still holds.
- A drawer entry not pushed by this hook (direct link, bookmark, new tab) still closes by replacement. It never goes Back out of the app.
- List updates on the laundry page keep the marker: `setState` writes `replaceState(drawerEntryState(), …)`. The marker is passed as a fresh object, because a state object that already carries Next's keys would skip Next's URL sync.
- The other eight pages now open drawers with a native `pushState` instead of `router.push`: the same URL, synced into `useSearchParams` (Next's Native History API).

## Review Focus

1. **`open` moves from `router.push` to native `pushState`** on all nine pages. That is required to attach the marker, since `router.push` takes no history state. In the browser checks the URL, the drawer and scroll were unaffected.
2. **Refresh now goes Back** for a drawer the page pushed. Before, the flag was lost on reload and × replaced the entry, which also left a duplicate. The marker survives a reload, so × returns to the list entry behind it.
3. **The marker is per param name** (`detail`), so a marker written for another param never counts. One test covers this.

## Pre-validation (full)

Applied on `fix/173-drawer-history-entry-marker` at `8553a04`, then removed before this Draft was committed.

| Check | Result |
| --- | --- |
| Hook tests (new file) against `main`'s hook | 4 failed / 4 passed (8). The failures are exactly the four new-behaviour cases. |
| Laundry interaction tests (updated) against `main`'s code | 2 failed / 15 passed (17). The failures are exactly the two new #173 cases. |
| With the fix | 8 + 17 = 25 passed |
| Mutations | M1 `close` ignores the marker: 4 failed. M2 push without the marker: 7 failed. M3 list update drops the marker: 1 failed. M4 `closeWithHref` ignores the marker: 4 failed. M5 marker param not checked: 1 failed. |
| `pnpm --filter web test` / `lint` / `tsc --noEmit -p .` / `build` | 677 passed; 0 errors; clean; Next build succeeded |
| `pnpm --filter @clensy/web test` | 402 passed (unchanged package) |
| Browser | as in "Why it works" above |

## File Map

| File | Change |
| --- | --- |
| `apps/web/lib/use-detail-drawer.test.tsx` | Rewrite: real jsdom history; Forward, refresh and param cases |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Modify: per-entry `history.state` in the harness; two #173 tests |
| `apps/web/lib/use-detail-drawer.ts` | Modify: marker push and close decision; `drawerEntryState`, `isDrawerEntryPushedHere` |
| `apps/web/lib/use-laundry-order-list-url-state.ts` | Modify: `setState` keeps the marker |

### Task 1: Tests first (red)

- [ ] **Step 1:** Apply the hook test diff:

```diff
diff --git a/apps/web/lib/use-detail-drawer.test.tsx b/apps/web/lib/use-detail-drawer.test.tsx
--- a/apps/web/lib/use-detail-drawer.test.tsx
+++ b/apps/web/lib/use-detail-drawer.test.tsx
@@ -7,21 +7,25 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
+// current history entry, not component memory. These tests use jsdom's real
+// History API (pushState state, Back/Forward with popstate), so the marker
+// travels with the entry exactly as it does in a browser. `router.back` is
+// a spy that also performs a real `history.back()`.
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 
 const nav = vi.hoisted(() => ({
   back: vi.fn(),
   listeners: new Set<() => void>(),
   push: vi.fn(),
-  query: '',
   replace: vi.fn(),
 }));
 
 vi.mock('next/navigation', () => ({
-  usePathname: () => '/app/bookings',
+  usePathname: () => window.location.pathname,
   useRouter: () => ({ back: nav.back, push: nav.push, replace: nav.replace }),
   useSearchParams: () => {
     const query = useSyncExternalStore(
@@ -29,7 +33,7 @@ vi.mock('next/navigation', () => ({
         nav.listeners.add(listener);
         return () => nav.listeners.delete(listener);
       },
-      () => nav.query,
+      () => window.location.search,
     );
     return new URLSearchParams(query);
   },
@@ -71,30 +75,54 @@ function LaundryLikePage() {
   );
 }
 
+const nativePushState = window.history.pushState.bind(window.history);
+const nativeReplaceState = window.history.replaceState.bind(window.history);
+
 let container: HTMLDivElement;
 let root: Root;
 
-function show(query: string) {
+function rerender() {
   act(() => {
-    nav.query = query;
     for (const listener of nav.listeners) listener();
   });
 }
 
+// A real Back/Forward: wait for jsdom's popstate, then let React render.
+async function traverse(delta: number) {
+  const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
+  window.history.go(delta);
+  await popped;
+  rerender();
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
+// A fresh tab: one entry at `url`, with no state.
+function startAt(url: string) {
+  nativeReplaceState(null, '', url);
+}
+
 beforeEach(() => {
   nav.back.mockReset();
+  nav.back.mockImplementation(() => window.history.back());
   nav.push.mockReset();
   nav.replace.mockReset();
-  nav.query = '';
-  window.history.replaceState(null, '', '/app/bookings');
-  vi.spyOn(window.history, 'pushState');
-  vi.spyOn(window.history, 'replaceState');
+  vi.spyOn(window.history, 'pushState').mockImplementation((data, unused, url) => {
+    nativePushState(data, unused, url);
+    rerender();
+  });
+  vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => {
+    nativeReplaceState(data, unused, url);
+    rerender();
+  });
   container = document.createElement('div');
   document.body.append(container);
   root = createRoot(container);
@@ -108,65 +136,116 @@ afterEach(() => {
 
 describe('useDetailDrawer on pages that pass close straight to onClose', () => {
   it('closes a drawer reached by a direct link with router.replace of the URL without detail', () => {
-    nav.query = 'status=A&detail=abc';
+    startAt('/app/bookings?status=A&detail=abc');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Close').click());
     expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
     expect(nav.replace).toHaveBeenCalledTimes(1);
+    expect(nav.back).not.toHaveBeenCalled();
     expect(window.history.replaceState).not.toHaveBeenCalled();
     expect(window.history.pushState).not.toHaveBeenCalled();
     expect(window.location.pathname).toBe('/app/bookings');
   });
 
   it('closes a direct-link drawer whose only param is detail to the bare path', () => {
-    nav.query = 'detail=abc';
+    startAt('/app/bookings?detail=abc');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Close').click());
     expect(nav.replace).toHaveBeenCalledWith('/app/bookings');
   });
 
-  it('opens with router.push and closes a drawer opened here with router.back', () => {
-    nav.query = 'status=A';
+  it('opens with a marked native push and closes it with router.back', async () => {
+    startAt('/app/bookings?status=A');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Open o1').click());
-    expect(nav.push).toHaveBeenCalledWith('/app/bookings?status=A&detail=o1');
-    show('status=A&detail=o1');
+    expect(window.history.pushState).toHaveBeenCalledWith(
+      { __clensyDetailDrawer: 'detail' },
+      '',
+      '/app/bookings?status=A&detail=o1',
+    );
+    expect(nav.push).not.toHaveBeenCalled();
+    expect(drawerShown()).toBe(true);
+    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
     act(() => button('Close').click());
+    await popped;
+    rerender();
     expect(nav.back).toHaveBeenCalledTimes(1);
     expect(nav.replace).not.toHaveBeenCalled();
-    expect(window.history.pushState).not.toHaveBeenCalled();
-    expect(window.history.replaceState).not.toHaveBeenCalled();
+    expect(window.location.search).toBe('?status=A');
   });
 
-  // #171: once a drawer opened here has been closed, one that reappears without a new open (for
-  // example by Forward) counts as reached directly, so it closes with a replace, not Back.
-  it('close resets opened-here: a drawer that reappears afterwards closes with router.replace', () => {
-    nav.query = 'status=A';
+  // #173: the regression. Before, the in-memory flag was false after × then
+  // Forward, so the second × replaced the entry and left two identical list
+  // entries.
+  it('goes Back again when a drawer it pushed reappears through Forward', async () => {
+    startAt('/app/bookings?status=A');
     act(() => root.render(<BookingsLikePage />));
     act(() => button('Open o1').click());
-    show('status=A&detail=o1');
-    act(() => button('Close').click());
-    expect(nav.back).toHaveBeenCalledTimes(1);
-    show('status=A'); // Back landed on the list
-    show('status=A&detail=o1'); // Forward: the drawer reappears with no new open
+    const backAfterClose = async () => {
+      const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
+      act(() => button('Close').click());
+      await popped;
+      rerender();
+    };
+    await backAfterClose();
+    await traverse(1); // Forward: the drawer entry, marker intact
+    expect(drawerShown()).toBe(true);
+    await backAfterClose();
+    expect(nav.back).toHaveBeenCalledTimes(2);
+    expect(nav.replace).not.toHaveBeenCalled();
+    expect(window.location.search).toBe('?status=A');
+    await traverse(1); // the drawer entry still exists: no duplicate was written over it
+    expect(window.location.search).toBe('?status=A&detail=o1');
+  });
+
+  it('goes Back for a drawer it pushed even after the page remounts (refresh, or returning from another page)', async () => {
+    startAt('/app/bookings?status=A');
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Open o1').click());
+    act(() => root.unmount());
+    root = createRoot(container);
+    act(() => root.render(<BookingsLikePage />)); // fresh hook, same marked entry
+    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
     act(() => button('Close').click());
+    await popped;
     expect(nav.back).toHaveBeenCalledTimes(1);
-    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
+    expect(nav.replace).not.toHaveBeenCalled();
   });
 
-  it('closeWithHref resets opened-here: a drawer that reappears afterwards closes with replaceState', () => {
-    nav.query = 'status=A';
+  it('closeWithHref goes Back for an entry it pushed, after Forward too, and never replaces it', async () => {
+    startAt('/app/bookings?status=A');
     act(() => root.render(<LaundryLikePage />));
     act(() => button('Open o1').click());
-    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A&detail=o1');
-    show('status=A&detail=o1');
-    act(() => button('Close').click());
-    expect(nav.back).toHaveBeenCalledTimes(1);
-    show('status=A');
-    show('status=A&detail=o1');
+    expect(window.history.pushState).toHaveBeenCalledWith(
+      { __clensyDetailDrawer: 'detail' },
+      '',
+      '/app/bookings?status=A&detail=o1',
+    );
+    for (let round = 1; round <= 2; round += 1) {
+      const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
+      act(() => button('Close').click());
+      await popped;
+      rerender();
+      expect(nav.back).toHaveBeenCalledTimes(round);
+      if (round === 1) await traverse(1);
+    }
+    expect(window.history.replaceState).not.toHaveBeenCalled();
+    expect(window.location.search).toBe('?status=A');
+  });
+
+  it('closeWithHref replaces an entry it did not push (a direct link)', () => {
+    startAt('/app/bookings?status=A&detail=o1');
+    act(() => root.render(<LaundryLikePage />));
     act(() => button('Close').click());
-    expect(nav.back).toHaveBeenCalledTimes(1);
+    expect(nav.back).not.toHaveBeenCalled();
     expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A');
-    expect(nav.replace).not.toHaveBeenCalled();
+  });
+
+  it('treats a marker for another param name as not pushed here', () => {
+    nativeReplaceState({ __clensyDetailDrawer: 'other' }, '', '/app/bookings?status=A&detail=abc');
+    act(() => root.render(<BookingsLikePage />));
+    act(() => button('Close').click());
+    expect(nav.back).not.toHaveBeenCalled();
+    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
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

- [ ] **Step 3:** Run `pnpm --filter web exec vitest run lib/use-detail-drawer.test.tsx`. Expected: `Tests 4 failed | 4 passed (8)`. Run `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`. Expected: `Tests 2 failed | 15 passed (17)`, and the failures are the two #173 tests.

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

- [ ] **Step 2:** Run both test files. Expected: `Tests 25 passed (25)`. `pnpm --filter web exec tsc --noEmit -p .` and eslint are clean.
- [ ] **Step 3:** One commit for Tasks 1–2, so no commit has failing tests: `fix(web): decide drawer close from a history-entry marker, not component memory (#173)`.

## Final verification

- [ ] **Allowlist:** `git diff --name-only 8553a04...HEAD -- . ':!docs' | sort` equals exactly the four File Map paths.
- [ ] **Mutations:** apply each alone, run both test files, and revert. Expected: M1–M5 as in Pre-validation.
  - M1: in `close`, `if (isDrawerEntryPushedHere(paramName)) {` → `if (false) {`.
  - M2: `window.history.pushState({ [DRAWER_ENTRY_KEY]: paramName }, '', href)` → `window.history.pushState(null, '', href)`.
  - M3: `window.history.replaceState(drawerEntryState(), '', href);` → `window.history.replaceState(null, '', href);`.
  - M4: in `closeWithHref`, the same change as M1.
  - M5: `return drawerEntryState()?.[DRAWER_ENTRY_KEY] === paramName;` → `return drawerEntryState() !== null;`.
- [ ] **Full suites:** `pnpm --filter web test` (677 at pre-validation), `lint`, `tsc --noEmit -p .` and `build`.
- [ ] **Manual browser check** (production build), each in a fresh tab:
  - Laundry, plus at least two other drawer pages: open → × → Forward → × goes Back each time. `history.length` doesn't grow after the open, and Forward reopens the drawer.
  - A direct link in a new tab: × replaces the entry and stays in the app.
  - A refresh on a pushed drawer: × goes Back to the list.
  - The #163 bookings direct-link × still gives the list URL without `detail`.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| `?detail=` close lands on the list; direct links never leave the app | Dashboard UX Foundation §4.4 | 1, 2 |
| `close` takes no argument (eight pages) | #163 plan revision 6 | 1 (existing regression tests kept) |
| Laundry native writes, `openWithHref`/`closeWithHref` | #163 plan | 1, 2 |
| The duplicate entry (#171 Review Focus 1) | #173 | 1, 2 |

## Gate outcomes

*(Appended after M5.)*
