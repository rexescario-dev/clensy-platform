// @vitest-environment jsdom
import { DetailDrawer } from '@clensy/ui';
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression (#163 M7): eight pages (bookings, billing, jobs, cleaners,
// catalog, catalog/add-ons, cleaners/teams, customers) pass `close`
// straight to a drawer's `onClose`, and `DetailDrawer` wires that to its ×
// button's `onClick`, so × calls `close(clickEvent)`. `close` must never
// read a URL from an argument.
//
// #173: whether × goes Back or replaces the entry follows a marker on the
// current history entry, not component memory. The harness owns the whole
// history stack (`nav.entries`, with each entry's `history.state` in
// `nav.states`), so every test starts from an explicit stack and Back /
// Forward / `router.back()` move through it exactly as a browser does:
// `window.location` and `history.state` follow the current entry, and a
// `popstate` fires.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const nav = vi.hoisted(() => ({
  back: vi.fn(),
  entries: [] as string[],
  index: 0,
  listeners: new Set<() => void>(),
  push: vi.fn(),
  replace: vi.fn(),
  states: [] as unknown[],
}));

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ back: nav.back, push: nav.push, replace: nav.replace }),
  useSearchParams: () => {
    const query = useSyncExternalStore(
      (listener) => {
        nav.listeners.add(listener);
        return () => nav.listeners.delete(listener);
      },
      () => window.location.search,
    );
    return new URLSearchParams(query);
  },
}));

const { useDetailDrawer } = await import('./use-detail-drawer');

// Wired exactly like the eight pages: `onClose={close}`.
function BookingsLikePage() {
  const { activeId, close, open } = useDetailDrawer();
  return (
    <>
      <button type="button" onClick={() => open('o1')}>
        Open o1
      </button>
      {activeId ? (
        <DetailDrawer open onClose={close} title="Booking">
          <p>{activeId}</p>
        </DetailDrawer>
      ) : null}
    </>
  );
}

// Wired like the laundry list: the named entry points, with exact URLs.
function LaundryLikePage() {
  const { activeId, closeWithHref, openWithHref } = useDetailDrawer();
  return (
    <>
      <button type="button" onClick={() => openWithHref('/app/bookings?status=A&detail=o1')}>
        Open o1
      </button>
      {activeId ? (
        <DetailDrawer open onClose={() => closeWithHref('/app/bookings?status=A')} title="Order">
          <p>{activeId}</p>
        </DetailDrawer>
      ) : null}
    </>
  );
}

const nativeReplaceState = window.history.replaceState.bind(window.history);

let container: HTMLDivElement;
let root: Root;

function notify() {
  for (const listener of nav.listeners) listener();
}

// Applies the current entry to `window.location` and `history.state`.
function showEntry() {
  nativeReplaceState(nav.states[nav.index] ?? null, '', nav.entries[nav.index]);
}

function traverse(delta: number) {
  act(() => {
    nav.index += delta;
    showEntry();
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    notify();
  });
}

// A fresh stack: `before` are earlier entries (oldest first), all without
// state; the current entry is `url`, also without state.
function start(url: string, before: string[] = []) {
  nav.entries = [...before, url];
  nav.states = nav.entries.map(() => null);
  nav.index = nav.entries.length - 1;
  showEntry();
}

function button(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label || candidate.getAttribute('aria-label') === label,
  )!;
}

function drawerShown(): boolean {
  return container.querySelector('[aria-label="Close"]') !== null;
}

function remount(page: () => React.JSX.Element) {
  act(() => root.unmount());
  root = createRoot(container);
  act(() => root.render(page()));
}

beforeEach(() => {
  nav.back.mockReset();
  nav.back.mockImplementation(() => traverse(-1));
  nav.push.mockReset();
  nav.replace.mockReset();
  vi.spyOn(window.history, 'pushState').mockImplementation((data, _unused, url) => {
    nav.entries = [...nav.entries.slice(0, nav.index + 1), String(url)];
    nav.states = [...nav.states.slice(0, nav.index + 1), data];
    nav.index += 1;
    showEntry();
    notify();
  });
  vi.spyOn(window.history, 'replaceState').mockImplementation((data, _unused, url) => {
    nav.entries[nav.index] = String(url);
    nav.states[nav.index] = data;
    showEntry();
    notify();
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('useDetailDrawer: direct links never go Back', () => {
  it('replaces a direct-link drawer with the list URL, even with another app page behind it', () => {
    start('/app/bookings?status=A&detail=abc', ['/app/jobs']);
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Close').click());
    expect(nav.back).not.toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.index).toBe(1); // still on the same entry; /app/jobs is untouched
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it('closes a direct-link drawer whose only param is detail to the bare path', () => {
    start('/app/bookings?detail=abc');
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Close').click());
    expect(nav.replace).toHaveBeenCalledWith('/app/bookings');
    expect(nav.back).not.toHaveBeenCalled();
  });

  it('treats a marker for another param name as not pushed here', () => {
    start('/app/bookings?status=A&detail=abc', ['/app/bookings?status=A']);
    nav.states[1] = { __clensyDetailDrawer: 'other' };
    showEntry();
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Close').click());
    expect(nav.back).not.toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
  });

  it('closeWithHref replaces an entry it did not push', () => {
    start('/app/bookings?status=A&detail=o1', ['/app/jobs']);
    act(() => root.render(<LaundryLikePage />));
    act(() => button('Close').click());
    expect(nav.back).not.toHaveBeenCalled();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/app/bookings?status=A');
    expect(nav.entries).toEqual(['/app/jobs', '/app/bookings?status=A']);
  });
});

describe('useDetailDrawer: entries this page pushed go Back to the list entry behind them', () => {
  it('opens with a marked native push and closes it with router.back', () => {
    start('/app/bookings?status=A');
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Open o1').click());
    expect(window.history.pushState).toHaveBeenCalledWith({ __clensyDetailDrawer: 'detail' }, '', '/app/bookings?status=A&detail=o1');
    expect(nav.push).not.toHaveBeenCalled();
    expect(drawerShown()).toBe(true);
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(nav.index).toBe(0);
    expect(window.location.search).toBe('?status=A');
  });

  // #173: the regression. Before, the in-memory flag was false after × then
  // Forward, so the second × replaced the entry with a duplicate list URL.
  it('goes Back again when the drawer reappears through Forward, and the drawer entry survives', () => {
    start('/app/bookings?status=A');
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Open o1').click());
    act(() => button('Close').click());
    traverse(1); // Forward: the drawer entry, marker intact
    expect(drawerShown()).toBe(true);
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(2);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(nav.entries).toEqual(['/app/bookings?status=A', '/app/bookings?status=A&detail=o1']);
    expect(nav.index).toBe(0);
  });

  it('goes Back after the page remounts on the same marked entry (a refresh)', () => {
    start('/app/bookings?status=A');
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Open o1').click());
    remount(() => <BookingsLikePage />); // fresh hook, same marked entry
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.index).toBe(0);
    expect(window.location.search).toBe('?status=A');
  });

  // The invariant: history only changes at its tip (a push truncates forward
  // entries) and `replaceState` only rewrites the current entry, so the
  // entry behind a marked drawer entry stays the list entry it was pushed
  // from, whatever the user does after it.
  it('goes Back to the list entry after navigating away to another page and returning', () => {
    start('/app/bookings?status=A');
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Open o1').click());
    act(() => root.unmount()); // the user leaves for another page (a router push)
    act(() => {
      nav.entries = [...nav.entries.slice(0, nav.index + 1), '/app/jobs'];
      nav.states = [...nav.states.slice(0, nav.index + 1), null];
      nav.index += 1;
      showEntry();
    });
    traverse(-1); // browser Back to the marked drawer entry
    root = createRoot(container);
    act(() => root.render(<BookingsLikePage />));
    expect(drawerShown()).toBe(true);
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.index).toBe(0);
    expect(window.location.pathname + window.location.search).toBe('/app/bookings?status=A');
  });

  // Documented behaviour (plan Review Focus): Back lands on the list entry
  // as it is now. If the user changed that entry's filters in the meantime
  // (× back to it, change a filter, Forward), × returns to those filters,
  // not to the drawer URL minus `detail`. It is still the same list page.
  it('lands on the list entry as the user last left it, if its filters changed after the drawer was opened', () => {
    start('/app/bookings?status=A');
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Open o1').click());
    act(() => button('Close').click());
    act(() => window.history.replaceState(null, '', '/app/bookings?status=B')); // a list update on the list entry
    traverse(1);
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(2);
    expect(window.location.pathname + window.location.search).toBe('/app/bookings?status=B');
  });

  it('closeWithHref goes Back for an entry it pushed, after Forward too, and never replaces it', () => {
    start('/app/bookings?status=A');
    act(() => root.render(<LaundryLikePage />));
    act(() => button('Open o1').click());
    expect(window.history.pushState).toHaveBeenCalledWith({ __clensyDetailDrawer: 'detail' }, '', '/app/bookings?status=A&detail=o1');
    act(() => button('Close').click());
    traverse(1);
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(2);
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(nav.entries).toEqual(['/app/bookings?status=A', '/app/bookings?status=A&detail=o1']);
  });
});
