// @vitest-environment jsdom
import { DetailDrawer } from '@clensy/ui';
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression (#163 M7): eight pages (bookings, billing, jobs, cleaners,
// catalog, catalog/add-ons, cleaners/teams, customers) pass `close`
// straight to a drawer's `onClose`, and `DetailDrawer` wires that to its ×
// button's `onClick`, so × calls `close(clickEvent)`. Whatever the laundry
// list needs from this hook, `open` and `close` keep their contract for
// those pages: router navigation, never a URL taken from an argument.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const nav = vi.hoisted(() => ({
  back: vi.fn(),
  listeners: new Set<() => void>(),
  push: vi.fn(),
  query: '',
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/bookings',
  useRouter: () => ({ back: nav.back, push: nav.push, replace: nav.replace }),
  useSearchParams: () => {
    const query = useSyncExternalStore(
      (listener) => {
        nav.listeners.add(listener);
        return () => nav.listeners.delete(listener);
      },
      () => nav.query,
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

let container: HTMLDivElement;
let root: Root;

function show(query: string) {
  act(() => {
    nav.query = query;
    for (const listener of nav.listeners) listener();
  });
}

function button(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label || candidate.getAttribute('aria-label') === label,
  )!;
}

beforeEach(() => {
  nav.back.mockReset();
  nav.push.mockReset();
  nav.replace.mockReset();
  nav.query = '';
  window.history.replaceState(null, '', '/app/bookings');
  vi.spyOn(window.history, 'pushState');
  vi.spyOn(window.history, 'replaceState');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('useDetailDrawer on pages that pass close straight to onClose', () => {
  it('closes a drawer reached by a direct link with router.replace of the URL without detail', () => {
    nav.query = 'status=A&detail=abc';
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Close').click());
    expect(nav.replace).toHaveBeenCalledWith('/app/bookings?status=A');
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/app/bookings');
  });

  it('closes a direct-link drawer whose only param is detail to the bare path', () => {
    nav.query = 'detail=abc';
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Close').click());
    expect(nav.replace).toHaveBeenCalledWith('/app/bookings');
  });

  it('opens with router.push and closes a drawer opened here with router.back', () => {
    nav.query = 'status=A';
    act(() => root.render(<BookingsLikePage />));
    act(() => button('Open o1').click());
    expect(nav.push).toHaveBeenCalledWith('/app/bookings?status=A&detail=o1');
    show('status=A&detail=o1');
    act(() => button('Close').click());
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});
