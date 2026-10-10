'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

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
      router.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams, paramName]);

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
      router.back();
      return;
    }
    window.history.replaceState(null, '', href);
  }, [router, paramName]);

  return { activeId, close, closeWithHref, open, openWithHref };
}
