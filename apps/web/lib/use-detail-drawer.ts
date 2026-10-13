'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

// Resolves the "close behavior" question spec §4.4 deliberately leaves as a
// plan-level implementation decision (design doc §4.4: "A same-page-origin
// flag set at the moment the drawer is opened via row click, checked before
// deciding between `router.back()` and `router.replace`, is one reasonable
// implementation — not the only one, and not mandated here.").
//
// Why this matters: the drawer's URL is a `?detail=<id>` search param on the
// list page, not a nested route (§4.4). Closing it must always land back on
// the plain list URL. If this page pushed the drawer's history entry (a row
// click), `router.back()` is correct and preserves native back/forward
// semantics. But if the drawer's URL was reached directly (a shared link, a
// bookmark, a new tab), there is no guaranteed list-page entry to go back
// to; `router.back()` could leave the app. So that case replaces the entry
// instead (`router.replace()` in `close`, a native `replaceState` in
// `closeWithHref`).
//
// The "pushed here" fact lives on the history entry itself, as a marker in
// `history.state`, not in component memory (#173). A memory flag is lost or
// stale after Back/Forward: open, ×, Forward, × used to replace an entry
// this page had pushed, leaving two identical list entries. Next.js keeps
// custom `history.state` across Back/Forward (traverse navigations preserve
// it) and copies its own keys into the state object passed to a native
// `pushState`. So each drawer entry is pushed natively, with the marker.
// (A `router.refresh()`, or a server action that revalidates, rewrites the
// current entry's state without custom keys, so it would drop the marker
// and × would fall back to replacing the entry: safe, but the duplicate
// returns. A server action that redirects pushes or replaces with an
// unmarked entry, to the same effect. No drawer page uses either today;
// keep it that way or re-mark the entry after one.
// `use-detail-drawer.guard.test.ts` looks for both in `apps/web`,
// `packages/web/src` and `packages/ui/src`. What a static scan cannot see is
// listed under "Known limits" in
// docs/superpowers/plans/2026-10-11-drawer-history-entry-marker-plan.md.)
const DRAWER_ENTRY_KEY = '__clensyDetailDrawer';

// The current entry's drawer marker, as a fresh state object for a native
// `replaceState` of the same entry, or null when it has none. A list update
// made while a drawer entry is current must keep the marker, or closing
// would take the replace branch. (Pass a fresh object: Next.js copies its
// own keys into it, and an object that already carries them skips Next's
// URL sync.)
export function drawerEntryState(): Record<string, string> | null {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null) return null;
  const marker = (state as Record<string, unknown>)[DRAWER_ENTRY_KEY];
  return typeof marker === 'string' ? { [DRAWER_ENTRY_KEY]: marker } : null;
}

// True when the current history entry is a drawer entry this hook pushed for
// `paramName`.
export function isDrawerEntryPushedHere(paramName: string): boolean {
  return drawerEntryState()?.[DRAWER_ENTRY_KEY] === paramName;
}

export function useDetailDrawer(paramName = 'detail') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeId = searchParams.get(paramName);

  // A Back this hook started that the browser has not reported yet. Until
  // `popstate` arrives the drawer entry is still current, marker and all, so
  // a second close in that window (a double Escape, × then the backdrop)
  // would go Back twice, past the list entry. It is ignored instead.
  //
  // `popstate` reports a same-document Back. If the Back crosses documents,
  // this one may be frozen in the back/forward cache with the guard still
  // set, and a later Forward restores it with `pageshow` (`persisted`), not
  // `popstate`; that clears the guard too, or × would do nothing.
  const backPendingRef = useRef(false);
  useEffect(() => {
    const settled = () => {
      backPendingRef.current = false;
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) settled();
    };
    window.addEventListener('popstate', settled);
    window.addEventListener('pageshow', restored);
    return () => {
      window.removeEventListener('popstate', settled);
      window.removeEventListener('pageshow', restored);
    };
  }, []);

  const back = useCallback(() => {
    if (backPendingRef.current) return;
    backPendingRef.current = true;
    router.back();
  }, [router]);

  const push = useCallback(
    (href: string) => window.history.pushState({ [DRAWER_ENTRY_KEY]: paramName }, '', href),
    [paramName],
  );

  const open = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, id);
    push(`${pathname}?${params.toString()}`);
  }, [pathname, searchParams, paramName, push]);

  const close = useCallback(() => {
    if (isDrawerEntryPushedHere(paramName)) {
      back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [back, router, pathname, searchParams, paramName]);

  // Laundry list only (#163): open and close with an exact URL the caller
  // built from the live `window.location`, written with the native History
  // API, which Next.js syncs into `useSearchParams`. Separate names, not an
  // optional argument on `open`/`close`: other pages pass `close` straight
  // to `onClose`, so `DetailDrawer`'s × button calls it with a click event,
  // and that must keep meaning "close", never "go to this URL".
  const openWithHref = useCallback((href: string) => push(href), [push]);

  // A drawer entry pushed here closes with `router.back()`, as `close` does.
  // One reached directly replaces the entry with `href`, which must not
  // carry `<paramName>`.
  const closeWithHref = useCallback((href: string) => {
    if (isDrawerEntryPushedHere(paramName)) {
      back();
      return;
    }
    window.history.replaceState(null, '', href);
  }, [back, paramName]);

  return { activeId, close, closeWithHref, open, openWithHref };
}
