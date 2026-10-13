// @vitest-environment jsdom
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real `/app/laundry` page, URL-state hook and search-draft
// hook. The list writes its URL with the native History API, which Next.js
// syncs into `useSearchParams` (verified on Next 16.3.1 at planning time:
// `location` changes at once, the re-render follows, Back/Forward fire
// `popstate`). This harness models exactly that: `pushState` and
// `replaceState` keep a fake entry stack and notify `useSearchParams`
// subscribers, and React renders at the end of the surrounding `act`, so
// two updates inside one `act` happen before any re-render. Setting
// `nav.holdRenders` keeps the `useSearchParams` notification back, so
// `window.location` moves on while the rendered params stay stale, as in
// Next.js, which renders a native write in a later transition.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER_ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

const nav = vi.hoisted(() => ({
  entries: [] as string[],
  // `history.state` per entry, parallel to `entries` (#173: the drawer marker).
  entryStates: [] as unknown[],
  holdRenders: false,
  index: 0,
  listeners: new Set<() => void>(),
  orderQueryIds: [] as string[],
  queryVariables: [] as { filter?: unknown; paging: unknown; sorting: unknown }[],
  // The query `useSearchParams` serves: router state, which follows
  // `window.location` only when `notify()` runs.
  rendered: '',
  // Settles the pending `receiveLaundryOrder` call with the new order's id.
  resolveReceive: (() => {}) as (id: string) => void,
  routerCalls: [] as string[],
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/laundry',
  useRouter: () => ({
    back: () => goBack(),
    push: (url: string) => nav.routerCalls.push(`push ${url}`),
    replace: (url: string) => nav.routerCalls.push(`replace ${url}`),
  }),
  useSearchParams: () => {
    const query = useSyncExternalStore(
      (listener) => {
        nav.listeners.add(listener);
        return () => nav.listeners.delete(listener);
      },
      () => nav.rendered,
    );
    return new URLSearchParams(query);
  },
}));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const query = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  const row = {
    id: ORDER_ID,
    createdAt: '2026-10-01T09:00:00.000Z',
    customer: { id: 'c1', fullName: 'Ana Reyes' },
    fulfillmentType: 'DELIVERY',
    status: 'READY',
    totalMinorUnits: 45000,
    weightGrams: 2500,
  };
  return {
    useCancelLaundryOrderMutation: idle,
    useCompleteLaundryOrderMutation: idle,
    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: 'TENANT_OWNER' } } }),
    useCustomersQuery: () => ({ data: { customers: { nodes: [{ id: 'c1', fullName: 'Ana Reyes' }] } } }),
    useGenerateInvoiceFromOrderMutation: idle,
    useInvoiceForOrderQuery: query,
    useLaundryOrderQuery: (options: { variables: { id: string } }) => {
      nav.orderQueryIds.push(options.variables.id);
      return query();
    },
    useLaundryOrdersQuery: (options: { variables: (typeof nav.queryVariables)[number] }) => {
      nav.queryVariables.push(options.variables);
      return {
        data: { laundryOrders: { nodes: [row], totalCount: 1 } },
        error: undefined,
        loading: false,
        refetch: () => Promise.resolve(),
      };
    },
    useMarkLaundryOrderAwaitingDeliveryMutation: idle,
    useMarkLaundryOrderAwaitingPaymentMutation: idle,
    useMarkLaundryOrderAwaitingPickupMutation: idle,
    useMarkLaundryOrderDamagedMutation: idle,
    useMarkLaundryOrderLostMutation: idle,
    useMarkLaundryOrderPaidMutation: idle,
    useMarkLaundryOrderReadyMutation: idle,
    usePriceLaundryOrderMutation: idle,
    useReceiveLaundryOrderMutation: () => [
      () =>
        new Promise((resolve) => {
          nav.resolveReceive = (id: string) => resolve({ data: { receiveLaundryOrder: { id } } });
        }),
      { loading: false },
    ],
    useRefundLaundryOrderMutation: idle,
    useRejectLaundryOrderMutation: idle,
    useServicesQuery: query,
    useStartLaundryProcessingMutation: idle,
    useWeighLaundryOrderMutation: idle,
  };
});

const { default: LaundryPage } = await import('../app/app/laundry/page');

const nativeReplaceState = window.history.replaceState.bind(window.history);

let container: HTMLDivElement;
let root: Root;

function notify() {
  nav.rendered = window.location.search;
  for (const listener of nav.listeners) listener();
}

// The entry the fake history is on, applied to `window.location` and
// `history.state`.
function showEntry() {
  nativeReplaceState(nav.entryStates[nav.index] ?? null, '', nav.entries[nav.index]);
}

function goBack() {
  act(() => {
    nav.index -= 1;
    showEntry();
    window.dispatchEvent(new PopStateEvent('popstate'));
    notify();
  });
}

function goForward() {
  act(() => {
    nav.index += 1;
    showEntry();
    window.dispatchEvent(new PopStateEvent('popstate'));
    notify();
  });
}

function url(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

// `history` holds the entries before the current one, oldest first.
function start(query = '', hash = '', history: string[] = []) {
  nav.entries = [...history.map((entry) => `/app/laundry?${entry}`), `/app/laundry${query ? `?${query}` : ''}${hash}`];
  nav.entryStates = nav.entries.map(() => null);
  nav.index = nav.entries.length - 1;
  showEntry();
  nav.rendered = window.location.search;
  act(() => root.render(<LaundryPage />));
}

function typeSearch(text: string) {
  const input = container.querySelector<HTMLInputElement>('#laundry-order-search')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function selectStatus(value: string) {
  const select = container.querySelector<HTMLSelectElement>('#laundry-order-status-filter')!;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function clickRow() {
  container.querySelector<HTMLTableRowElement>('tr[role="button"]')!.click();
}

function headerButton(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('th button')].find((b) => b.textContent === label)!;
}

function ariaSort(label: string): string | null {
  return headerButton(label).closest('th')!.getAttribute('aria-sort');
}

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label || candidate.getAttribute('aria-label') === label,
  )!;
}

function searchBox(): string {
  return container.querySelector<HTMLInputElement>('#laundry-order-search')!.value;
}

function statusSelect(): string {
  return container.querySelector<HTMLSelectElement>('#laundry-order-status-filter')!.value;
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.holdRenders = false;
  nav.orderQueryIds = [];
  nav.queryVariables = [];
  nav.routerCalls = [];
  vi.spyOn(window.history, 'pushState').mockImplementation((data, _unused, href) => {
    nav.entries = [...nav.entries.slice(0, nav.index + 1), String(href)];
    nav.entryStates = [...nav.entryStates.slice(0, nav.index + 1), data];
    nav.index += 1;
    showEntry();
    if (!nav.holdRenders) notify();
  });
  vi.spyOn(window.history, 'replaceState').mockImplementation((data, _unused, href) => {
    nav.entries[nav.index] = String(href);
    nav.entryStates[nav.index] = data;
    showEntry();
    if (!nav.holdRenders) notify();
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('/app/laundry list interactions', () => {
  it('composes a filter change and a debounced search made before React re-renders', () => {
    start();
    act(() => typeSearch('ana'));
    act(() => {
      vi.advanceTimersByTime(290);
      selectStatus('READY');
      vi.advanceTimersByTime(10); // the search commit fires before any re-render
    });
    expect(url().get('q')).toBe('ana');
    expect(url().get('status')).toBe('READY');
    expect(url().get('offset')).toBe('0');
    expect(nav.entries).toHaveLength(1); // list updates replace; they add no entry
    expect(nav.routerCalls).toEqual([]);
  });

  it('commits a waiting search to the list entry, then pushes the drawer; nothing applies later', () => {
    start('status=READY&offset=20');
    act(() => typeSearch('ana'));
    act(() => vi.advanceTimersByTime(100));
    act(() => clickRow());
    act(() => vi.advanceTimersByTime(1000)); // the debounce would have fired by now
    expect(nav.entries).toHaveLength(2);
    const listEntry = new URLSearchParams(nav.entries[0].split('?')[1]);
    expect({ detail: listEntry.get('detail'), q: listEntry.get('q') }).toEqual({ detail: null, q: 'ana' });
    expect(url().get('detail')).toBe(ORDER_ID);
    expect(url().get('q')).toBe('ana');
    expect(url().get('status')).toBe('READY');
    expect(url().get('offset')).toBe('0');
    expect(nav.orderQueryIds.at(-1)).toBe(ORDER_ID);
    expect(nav.routerCalls).toEqual([]);
  });

  it('returns to the list as typed when the drawer is closed with Back', () => {
    start();
    act(() => typeSearch('ana'));
    act(() => clickRow());
    goBack();
    expect(url().get('q')).toBe('ana');
    expect(url().has('detail')).toBe(false);
    expect(searchBox()).toBe('ana');
  });

  it('keeps detail for a list update made right after opening, before React re-renders', () => {
    start();
    act(() => {
      clickRow();
      selectStatus('READY');
    });
    expect(url().get('detail')).toBe(ORDER_ID);
    expect(url().get('status')).toBe('READY');
  });

  it('keeps the hash and every unrelated param when opening the drawer and on list updates', () => {
    start('utm_source=mail&tab=a&tab=b', '#orders');
    act(() => selectStatus('READY'));
    expect(window.location.hash).toBe('#orders');
    expect(url().getAll('tab')).toEqual(['a', 'b']);
    act(() => clickRow());
    expect(nav.entries.at(-1)).toMatch(new RegExp(`^/app/laundry\\?utm_source=mail&tab=a&tab=b&.*detail=${ORDER_ID}#orders$`));
  });

  it('opens the new order after create with the live list URL, natively, before React re-renders', async () => {
    start('tab=a&status=PAID', '#orders');
    act(() => button('+ New Laundry Order').click());
    act(() => {
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    // The filter changes the URL, and the create request settles, before
    // React renders the new filter. The drawer URL must come from the live
    // URL, not from the last rendered `searchParams` (still PAID).
    nav.holdRenders = true;
    act(() => selectStatus('READY'));
    expect(nav.queryVariables.at(-1)).toMatchObject({ filter: { status: { eq: 'PAID' } } }); // not re-rendered
    expect(url().get('status')).toBe('READY');
    await act(async () => nav.resolveReceive('new-order'));
    expect(nav.queryVariables.at(-1)).toMatchObject({ filter: { status: { eq: 'PAID' } } }); // still not re-rendered
    nav.holdRenders = false;
    act(() => notify());
    expect(nav.entries).toHaveLength(2);
    expect(url().get('detail')).toBe('new-order');
    expect(url().get('status')).toBe('READY');
    expect(url().get('tab')).toBe('a');
    expect(window.location.hash).toBe('#orders');
    expect(nav.routerCalls).toEqual([]);
  });

  it('closes a drawer reached by a direct link with the live list URL, natively', () => {
    start(`tab=a&status=PAID&detail=${ORDER_ID}`, '#orders');
    act(() => {
      selectStatus('READY'); // a list update React has not rendered yet
      button('Close').click();
    });
    expect(url().has('detail')).toBe(false);
    expect(url().get('status')).toBe('READY');
    expect(url().get('tab')).toBe('a');
    expect(window.location.hash).toBe('#orders');
    expect(nav.entries).toHaveLength(1); // replaced, not pushed
    expect(nav.routerCalls).toEqual([]);
  });

  it('leaves no empty "?" when closing a direct-link drawer removes the last param', () => {
    start(`detail=${ORDER_ID}`, '#x');
    act(() => button('Close').click());
    expect(nav.entries).toEqual(['/app/laundry#x']);
    expect(nav.routerCalls).toEqual([]);
  });

  it('closes a drawer opened from the list with Back', () => {
    start('status=PAID');
    act(() => clickRow());
    act(() => button('Close').click());
    expect(nav.index).toBe(0); // went Back to the list entry
    expect(url().has('detail')).toBe(false);
    expect(url().get('status')).toBe('PAID');
    expect(nav.routerCalls).toEqual([]);
  });

  // #173: the drawer entry carries a history-state marker, so × after Forward goes Back again
  // instead of replacing the entry with a duplicate list URL.
  it('goes Back again when the drawer reappears through Forward, leaving no duplicate entry', () => {
    start('status=PAID');
    act(() => clickRow());
    expect(nav.entryStates[1]).toEqual({ __clensyDetailDrawer: 'detail' });
    act(() => button('Close').click()); // Back
    goForward();
    expect(url().get('detail')).toBe(ORDER_ID);
    act(() => button('Close').click()); // Back again, not a replace
    expect(nav.index).toBe(0);
    expect(nav.entries).toHaveLength(2);
    expect(new URLSearchParams(nav.entries[1].split('?')[1]).get('detail')).toBe(ORDER_ID); // the drawer entry survives
    expect(nav.routerCalls).toEqual([]);
  });

  it('keeps the drawer marker through a list update made while the drawer is open', () => {
    start('status=PAID');
    act(() => clickRow());
    act(() => selectStatus('READY')); // replaceState on the drawer entry
    expect(nav.entryStates[1]).toEqual({ __clensyDetailDrawer: 'detail' });
    act(() => button('Close').click());
    expect(nav.index).toBe(0); // went Back, not replaced
    expect(nav.entries).toHaveLength(2);
  });

  it('lets Back and Forward restore the URL, controls, query and drawer of the entry the user goes to', () => {
    start('status=PAID');
    act(() => selectStatus('READY'));
    act(() => clickRow());
    expect(nav.entries).toHaveLength(2);

    goBack(); // closes the drawer: the list entry, with its filter
    expect(url().get('status')).toBe('READY');
    expect(url().has('detail')).toBe(false);
    expect(statusSelect()).toBe('READY');
    expect(nav.queryVariables.at(-1)).toMatchObject({ filter: { status: { eq: 'READY' } } });

    goForward(); // the drawer entry again
    expect(url().get('detail')).toBe(ORDER_ID);
    expect(nav.orderQueryIds.at(-1)).toBe(ORDER_ID);
    expect(nav.routerCalls).toEqual([]);
  });

  // Records `useLaundryOrdersQuery` calls, one per render, with their
  // variables. It proves no render uses another entry's variables; whether
  // Apollo sends a request is checked in the browser (Final verification).
  it('never renders the list query with variables other than the landed entry’s when going Back', () => {
    start('status=READY', '', ['status=PAID']);
    nav.queryVariables = [];
    goBack();
    expect(nav.queryVariables.map((variables) => variables.filter)).toEqual([{ status: { eq: 'PAID' } }]);
    expect(statusSelect()).toBe('PAID');
  });

  it('cancels a keystroke still waiting when the user goes Back', () => {
    start('q=ana', '', ['q=ben']);
    act(() => typeSearch('anab'));
    goBack();
    act(() => vi.advanceTimersByTime(1000));
    expect(url().get('q')).toBe('ben'); // the waiting search never applies
    expect(nav.entries).toEqual(['/app/laundry?q=ben', '/app/laundry?q=ana']);
    expect(searchBox()).toBe('ben');
  });

  it('does not overwrite a keystroke still waiting with the list’s own update', () => {
    start('q=ana');
    act(() => typeSearch('anab'));
    act(() => selectStatus('READY'));
    expect(searchBox()).toBe('anab');
    act(() => vi.advanceTimersByTime(300));
    expect(url().get('q')).toBe('anab');
    expect(url().get('status')).toBe('READY');
  });

  it('clears the search and filters, including a keystroke still waiting', () => {
    start('q=ana&status=READY');
    act(() => typeSearch('anab'));
    const clear = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Clear search and filters')!;
    act(() => clear.click());
    act(() => vi.advanceTimersByTime(1000));
    expect(url().has('q')).toBe(false);
    expect(url().has('status')).toBe(false);
    expect(searchBox()).toBe('');
  });

  it('keeps the header indicator, URL and server sort in step through each click', () => {
    start();
    const steps: [string, string, string, string, unknown][] = [
      // [click, sortBy, sortOrder, header showing it, server sorting]
      ['Created', 'createdAt', 'asc', 'Created', [{ direction: 'ASC', field: 'createdAt' }, { direction: 'ASC', field: 'id' }]],
      ['Created', 'createdAt', 'desc', 'Created', [{ direction: 'DESC', field: 'createdAt' }, { direction: 'ASC', field: 'id' }]],
      ['Status', 'status', 'asc', 'Status', [{ direction: 'ASC', field: 'status' }, { direction: 'ASC', field: 'id' }]],
      ['Status', 'status', 'desc', 'Status', [{ direction: 'DESC', field: 'status' }, { direction: 'ASC', field: 'id' }]],
      ['Status', 'createdAt', 'desc', 'Created', [{ direction: 'DESC', field: 'createdAt' }, { direction: 'ASC', field: 'id' }]],
    ];
    expect(ariaSort('Created')).toBe('descending');
    for (const [click, sortBy, sortOrder, header, sorting] of steps) {
      act(() => headerButton(click).click());
      expect({ sortBy: url().get('sortBy'), sortOrder: url().get('sortOrder') }).toEqual({ sortBy, sortOrder });
      expect(ariaSort(header)).toBe(sortOrder === 'asc' ? 'ascending' : 'descending');
      expect(nav.queryVariables.at(-1)!.sorting).toEqual(sorting);
    }
    expect(ariaSort('Status')).toBe('none');
  });
});
