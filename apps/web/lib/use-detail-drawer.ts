'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef } from 'react';

// Resolves the "close behavior" question spec §4.4 deliberately leaves as a
// plan-level implementation decision (design doc §4.4: "A same-page-origin
// flag set at the moment the drawer is opened via row click, checked before
// deciding between `router.back()` and `router.replace`, is one reasonable
// implementation — not the only one, and not mandated here.").
//
// Why this matters: the drawer's URL is a `?detail=<id>` search param on the
// list page, not a nested route (§4.4). Closing it must always land back on
// the plain list URL. If the drawer was opened by a row click (`open()`
// below pushed a new history entry on top of the list), `router.back()` is
// correct and preserves native back/forward semantics. But if the drawer's
// URL was reached directly — a shared link, a bookmark, a browser refresh —
// there is no guaranteed list-page history entry to go back to; blindly
// calling `router.back()` could navigate somewhere outside the app entirely
// (or nowhere, if there's no history at all). `openedHereRef` distinguishes
// the two cases: it's only set to `true` by this hook's own `open()` call,
// never by the initial mount reading a pre-existing `?detail=` param, so a
// direct/shared link always takes the `router.replace()` branch instead.
export function useDetailDrawer(paramName = 'detail') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedHereRef = useRef(false);

  const activeId = searchParams.get(paramName);

  const open = useCallback((id: string) => {
    openedHereRef.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, id);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, paramName]);

  const close = useCallback(() => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      router.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams, paramName]);

  return { activeId, open, close };
}
