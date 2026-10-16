// @vitest-environment jsdom
import { ToastProvider } from '@clensy/ui';
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

type Customer = { id: string; email: string; fullName: string; phone: string };
type CustomerQueryOptions = {
  skip?: boolean;
  variables?: { filter?: { fullName?: { iLike?: string } }; paging?: { limit?: number } };
};
type CustomerResult = { error?: Error; nodes: Customer[]; totalCount?: number };

const ANA: Customer = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const ANA_NO_PHONE: Customer = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };

const nav = vi.hoisted(() => ({
  // Settles the pending `receiveLaundryOrder` call with no order in the response.
  resolveReceiveWithoutId: (() => {}) as () => void,
  // Every `useCustomersQuery` options object, in render order.
  customerQueries: [] as CustomerQueryOptions[],
  // Responses by lower-cased `iLike` pattern (the search is case-insensitive).
  // A pattern with no entry is still in flight, as in Apollo.
  customerResults: {} as Record<string, CustomerResult>,
  entries: [] as string[],
  // `history.state` per entry, parallel to `entries` (#173: the drawer marker).
  entryStates: [] as unknown[],
  holdRenders: false,
  index: 0,
  listeners: new Set<() => void>(),
  orderQueryIds: [] as string[],
  queryVariables: [] as { filter?: unknown; paging: unknown; sorting: unknown }[],
  // Every `receiveLaundryOrder` input, in call order.
  receiveCalls: [] as unknown[],
  // The list's `refetch`; a test may make it hang.
  refetch: (() => Promise.resolve()) as () => Promise<unknown>,
  refetchCalls: 0,
  // Settles the pending `receiveLaundryOrder` call with an error.
  rejectReceive: (() => {}) as (error: unknown) => void,
  // The query `useSearchParams` serves: router state, which follows
  // `window.location` only when `notify()` runs.
  rendered: '',
  // Settles the pending `receiveLaundryOrder` call with the new order's id.
  resolveReceive: (() => {}) as (id: string) => void,
  role: 'TENANT_OWNER',
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
    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: nav.role, scope: 'TENANT' } } }),
    useCustomersQuery: (options: CustomerQueryOptions) => {
      nav.customerQueries.push(options);
      if (options.skip) return { data: undefined, error: undefined, loading: false };
      const response = nav.customerResults[options.variables!.filter!.fullName!.iLike!.toLowerCase()];
      if (!response) return { data: undefined, error: undefined, loading: true };
      if (response.error) return { data: undefined, error: response.error, loading: false };
      return {
        data: { customers: { nodes: response.nodes, totalCount: response.totalCount ?? response.nodes.length } },
        error: undefined,
        loading: false,
      };
    },
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
        refetch: () => {
          nav.refetchCalls += 1;
          return nav.refetch();
        },
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
      (options: { variables: { input: unknown } }) => {
        nav.receiveCalls.push(options.variables.input);
        return new Promise((resolve, reject) => {
          nav.resolveReceive = (id: string) => resolve({ data: { receiveLaundryOrder: { id } } });
          nav.resolveReceiveWithoutId = () => resolve({ data: null });
          nav.rejectReceive = reject;
        });
      },
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
  act(() =>
    root.render(
      <ToastProvider>
        <LaundryPage />
      </ToastProvider>,
    ),
  );
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

// The intake dialog (the one with a form); the detail drawer is also a
// `role="dialog"` and opens after a create.
function dialog(): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((d) => d.querySelector('form')) ?? null;
}

function customerField(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#laundry-customer')!;
}

function customerOptions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('#laundry-customer-listbox [role="option"]')];
}

// The fulfillment group keeps only its helper. While an error shows, each
// radio is invalid and described by its description, then the error (#181).
function expectFulfillmentDescribed(withError: boolean) {
  expect(document.querySelector('fieldset')!.getAttribute('aria-describedby')).toBe('laundry-fulfillment-fixed');
  for (const option of ['PICKUP', 'DELIVERY']) {
    const radio = document.querySelector(`#laundry-fulfillment-${option}`)!;
    expect(radio.getAttribute('aria-invalid')).toBe(withError ? 'true' : null);
    expect(radio.getAttribute('aria-describedby')).toBe(
      withError ? `laundry-fulfillment-${option}-description laundry-fulfillment-error` : `laundry-fulfillment-${option}-description`,
    );
  }
}

// The same native-setter helper as `typeSearch`, on the customer field.
function typeCustomer(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(customerField(), text);
    customerField().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressInCustomer(key: string) {
  act(() => {
    customerField().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
}

function openCreate() {
  act(() => button('+ New Laundry Order').click());
}

// Types, waits out the debounce, and clicks the first match.
function chooseCustomer(text = 'Ana') {
  typeCustomer(text);
  act(() => vi.advanceTimersByTime(300));
  act(() => customerOptions()[0].click());
}

// Dispatches `times` submit events synchronously, in one turn, then lets
// react-hook-form's asynchronous validation and the handlers settle.
async function submitCreate(times = 1) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      dialog()!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
}

// react-hook-form's `setFocus` focuses in a zero-delay timeout (7.88).
function runFocusTimer() {
  act(() => vi.advanceTimersByTime(0));
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.customerQueries = [];
  nav.customerResults = {
    '%ana%': { nodes: [ANA, ANA_NO_PHONE] },
    '%zz%': { nodes: [] },
  };
  nav.holdRenders = false;
  nav.orderQueryIds = [];
  nav.queryVariables = [];
  nav.receiveCalls = [];
  nav.refetch = () => Promise.resolve();
  nav.refetchCalls = 0;
  nav.rejectReceive = () => {};
  nav.resolveReceive = () => {};
  nav.resolveReceiveWithoutId = () => {};
  nav.role = 'TENANT_OWNER';
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
    openCreate();
    chooseCustomer();
    await submitCreate();
    expect(nav.receiveCalls).toHaveLength(1);
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

describe('/app/laundry intake modal', () => {
  it('searches customers by name on the server, 20 at most, never the first 100 unfiltered', () => {
    start();
    expect(nav.customerQueries.every((options) => options.skip === true)).toBe(true);
    openCreate();
    typeCustomer('  ana ');
    expect(nav.customerQueries.at(-1)?.skip).toBe(true); // debouncing
    act(() => vi.advanceTimersByTime(300));
    expect(nav.customerQueries.at(-1)).toMatchObject({
      skip: false,
      variables: { filter: { fullName: { iLike: '%ana%' } }, paging: { limit: 20 } },
    });
    for (const options of nav.customerQueries) {
      expect(options.skip === true || options.variables?.paging?.limit === 20).toBe(true);
      expect(options.skip === true || options.variables?.filter !== undefined).toBe(true);
    }
  });

  it('shows Searching…, then results with phone or email', () => {
    start();
    openCreate();
    typeCustomer('ana');
    expect(dialog()!.textContent).toContain('Searching…');
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions().map((option) => option.textContent)).toEqual([
      'Ana Reyes555-0101',
      'Ana Reyesana.r@example.com',
    ]);
  });

  it('says No customers match. for a search with no result', () => {
    start();
    openCreate();
    typeCustomer('zz'); // preset empty response
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions()).toHaveLength(0);
    expect(dialog()!.textContent).toContain('No customers match.');
  });

  it('shows a failed search inline and announces it politely', () => {
    nav.customerResults['%ana%'] = { error: new Error('down'), nodes: [] };
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()!.querySelector('#laundry-customer-listbox')!.parentElement!.textContent).toContain(
      'Unable to search customers.',
    );
    const region = document.querySelector('#laundry-customer-status')!;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toBe('Unable to search customers.');
    // A search failure is polite; the dialog's own alert is for create failures.
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
  });

  it('announces the search lifecycle in one region, and a failed search gives way to Searching… when the next one starts', () => {
    // Each response is keyed by the exact `iLike` pattern, so a state can only
    // come from the response for the text being searched.
    nav.customerResults['%an%'] = { nodes: [ANA], totalCount: 21 }; // 21 matches, 1 on this page
    nav.customerResults['%ana%'] = { error: new Error('down'), nodes: [] };
    start();
    openCreate();
    const region = document.querySelector('#laundry-customer-status')!;
    const popup = () => dialog()!.querySelector('#laundry-customer-listbox')!.parentElement!;
    const searched = (pattern: string) =>
      expect(nav.customerQueries.at(-1)).toMatchObject({
        skip: false,
        variables: { filter: { fullName: { iLike: pattern } }, paging: { limit: 20 } },
      });
    expect(region.textContent).toBe('');

    typeCustomer('zz'); // the preset empty response
    expect(region.textContent).toBe('Searching…'); // debouncing
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    searched('%zz%');
    expect(customerOptions()).toHaveLength(0);
    expect(popup().textContent).toContain('No customers match.');
    expect(region.textContent).toBe('No customers match.');

    typeCustomer('an');
    expect(region.textContent).toBe('Searching…');
    expect(customerOptions()).toHaveLength(0); // nothing left over from "zz"
    act(() => vi.advanceTimersByTime(300));
    searched('%an%');
    // The truncated state comes from this response: its one node is listed, and totalCount 21 > 1.
    expect(customerOptions().map((option) => option.textContent)).toEqual(['Ana Reyes555-0101']);
    expect(popup().textContent).toContain('More customers match. Type more of the name to narrow the search.');
    expect(popup().textContent).not.toContain('No customers match.');
    expect(region.textContent).toBe('More customers match. Type more of the name to narrow the search.');

    typeCustomer('ana');
    expect(region.textContent).toBe('Searching…');
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    searched('%ana%');
    expect(customerOptions()).toHaveLength(0);
    expect(popup().textContent).toContain('Unable to search customers.');
    expect(region.textContent).toBe('Unable to search customers.');

    typeCustomer('anab'); // the next search starts
    expect(region.textContent).toBe('Searching…');
    expect(popup().textContent).not.toContain('Unable to search customers.');
    typeCustomer('anabe'); // typing on while it loads: same node, same text, nothing re-announced
    expect(document.querySelector('#laundry-customer-status')).toBe(region);
    expect(region.textContent).toBe('Searching…');
    act(() => vi.advanceTimersByTime(300));
    searched('%anabe%'); // the next query is issued; it has no response, so it stays in flight
    expect(customerOptions()).toHaveLength(0);
    expect(popup().textContent).toContain('Searching…');
    expect(popup().textContent).not.toContain('Unable to search customers.');
    expect(region.textContent).toBe('Searching…');
    expect(document.querySelector('#laundry-customer-status')).toBe(region);
    expect(dialog()!.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
  });


  it('never lets a result for an earlier text be chosen while the next search runs', async () => {
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions()).toHaveLength(2);
    pressInCustomer('ArrowDown');
    typeCustomer('anaz'); // no response: stays in flight
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions()).toHaveLength(0);
    expect(dialog()!.textContent).toContain('Searching…');
    expect(customerField().getAttribute('aria-activedescendant')).toBeNull();
    pressInCustomer('Enter');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
  });

  it('requires a customer: "Select a customer.", focus on the field, and no mutation', async () => {
    start();
    openCreate();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
    expect(customerField().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(customerField());
  });

  it('clears the selection when the text changes after choosing', async () => {
    start();
    openCreate();
    chooseCustomer();
    expect(customerField().value).toBe('Ana Reyes');
    typeCustomer('Ana R');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
    typeCustomer('');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
  });

  it('creates with the chosen customer and fulfillment, toasts, and opens the drawer on the returned id without waiting for the refresh', async () => {
    nav.refetch = () => new Promise(() => {}); // the list refresh never settles
    start('status=PAID');
    openCreate();
    expect(dialog()!.textContent).toContain('New laundry order');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!.checked).toBe(true);
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'DELIVERY' }]);
    await act(async () => nav.resolveReceive('new-order'));
    expect(dialog()).toBeNull();
    expect(document.body.textContent).toContain('Laundry order created.');
    // Until #161, the new order opens in the drawer so it can be weighed.
    expect(url().get('detail')).toBe('new-order');
    expect(url().get('status')).toBe('PAID');
    expect(nav.orderQueryIds.at(-1)).toBe('new-order');
    expect(nav.refetchCalls).toBe(1);
    expect(nav.receiveCalls).toHaveLength(1);
    expect(nav.routerCalls).toEqual([]);
  });

  it('sends one mutation for two submits fired in the same turn', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate(2);
    expect(nav.receiveCalls).toHaveLength(1);
    expect(button('Creating…').disabled).toBe(true);
    await act(async () => nav.resolveReceive('new-order'));
    expect(nav.receiveCalls).toHaveLength(1);
  });

  it('stays open on failure with an alert, the fields intact, and submit re-enabled for a retry', async () => {
    start();
    openCreate();
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await submitCreate();
    const focused = document.activeElement;
    await act(async () => nav.rejectReceive(new Error('Network down')));
    runFocusTimer();
    expect(document.activeElement).toBe(focused); // a generic failure does not move focus
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('Unable to create laundry order.');
    expect(customerField().value).toBe('Ana Reyes');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.checked).toBe(true);
    expect(button('Create order').disabled).toBe(false);
    expect(url().get('detail')).toBeNull();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
    ]);
  });

  it('shows a server field error on the customer field, re-enables submit, and clears it when a customer is chosen again', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    // The Apollo-shaped error normalize.test.ts pins (captured fixture), with customerId as the field.
    expect(document.activeElement).not.toBe(customerField()); // focus has to move there
    await act(async () =>
      nav.rejectReceive({
        graphQLErrors: [{ extensions: { originalError: { message: ['customerId must be a string'] } } }],
      }),
    );
    runFocusTimer();
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(customerField().getAttribute('aria-invalid')).toBe('true');
    expect(customerField().getAttribute('aria-describedby')).toBe('laundry-customer-error');
    expect(document.activeElement).toBe(customerField());
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    expect(button('Create order').disabled).toBe(false);
    chooseCustomer();
    await act(async () => {}); // react-hook-form re-validates asynchronously
    expect(document.querySelector('#laundry-customer-error')).toBeNull();
  });

  it('shows a server fulfillment error on the fulfillment field, focuses the checked radio, clears it when fulfillment changes, and shows a later one again', async () => {
    const rejectFulfillment = (message: string) =>
      act(async () => nav.rejectReceive({ graphQLErrors: [{ extensions: { originalError: { message: [message] } } }] }));
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    expect(document.activeElement).not.toBe(document.querySelector('#laundry-fulfillment-PICKUP'));
    await rejectFulfillment('fulfillmentType must be one of the following values: PICKUP, DELIVERY');
    runFocusTimer();
    const error = () => document.querySelector('#laundry-fulfillment-error');
    expect(error()!.textContent).toBe('fulfillmentType must be one of the following values: PICKUP, DELIVERY');
    expectFulfillmentDescribed(true);
    expect(document.activeElement).toBe(document.querySelector('#laundry-fulfillment-PICKUP'));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    expect(button('Create order').disabled).toBe(false);
    // The checked radio fires no change; choosing the other one does.
    const pickup = () => document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!;
    const delivery = () => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!;
    act(() => delivery().click());
    await act(async () => {}); // react-hook-form re-validates asynchronously
    // Before the second submit: DELIVERY is the checked radio and the first error is gone.
    expect(delivery().checked).toBe(true);
    expect(pickup().checked).toBe(false);
    expect(error()).toBeNull();
    expectFulfillmentDescribed(false);
    // Focus starts elsewhere, so the assertion below can only pass if focus moves.
    act(() => customerField().focus());
    await submitCreate();
    await rejectFulfillment('fulfillmentType should not be empty');
    runFocusTimer();
    // The new error is applied, and focus followed the ref to the newly checked radio.
    expect(error()!.textContent).toBe('fulfillmentType should not be empty');
    expectFulfillmentDescribed(true);
    expect(delivery().checked).toBe(true);
    expect(document.activeElement).toBe(delivery());
    expect(document.activeElement).not.toBe(pickup());
    expect(nav.receiveCalls).toEqual([
      { customerId: 'c1', fulfillmentType: 'PICKUP' },
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
    ]);
  });

  it('focuses the customer field when both fields fail, whatever order the server lists them in, ignoring unknown fields', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    expect(document.activeElement).not.toBe(customerField()); // focus has to move there
    await act(async () =>
      nav.rejectReceive({
        graphQLErrors: [
          {
            extensions: {
              originalError: {
                // An unknown field first, then fulfillment, then customer: the reverse of form order.
                message: [
                  'notes must be a string',
                  'fulfillmentType must be one of the following values: PICKUP, DELIVERY',
                  'customerId must be a string',
                ],
              },
            },
          },
        ],
      }),
    );
    runFocusTimer();
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(document.querySelector('#laundry-fulfillment-error')!.textContent).toBe(
      'fulfillmentType must be one of the following values: PICKUP, DELIVERY',
    );
    expectFulfillmentDescribed(true);
    expect(document.activeElement).toBe(customerField());
    expect(dialog()!.textContent).not.toContain('notes must be a string'); // dropped by the normalizer
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull(); // field errors, not the generic path
  });

  it('keeps the dialog open and asks to check the list when the create response names no order', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    await act(async () => nav.resolveReceiveWithoutId());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe(
      'The order may have been created. Check the laundry list before trying again.',
    );
    expect(document.body.textContent).not.toContain('Laundry order created.');
    expect(url().get('detail')).toBeNull();
    expect(nav.receiveCalls).toHaveLength(1);
    expect(button('Create order').disabled).toBe(false);
  });

  it('resets customer, fulfillment and errors each time it opens', async () => {
    start();
    openCreate();
    await submitCreate(); // "Select a customer."
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    act(() => button('Cancel').click());
    expect(dialog()).toBeNull();
    openCreate();
    expect(customerField().value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!.checked).toBe(true);
    expect(document.querySelector('#laundry-customer-error')).toBeNull();
  });

  it('closes the list on the first Escape and the dialog on the next', () => {
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(customerField().getAttribute('aria-expanded')).toBe('true');
    pressInCustomer('Escape');
    expect(dialog()).not.toBeNull();
    expect(customerField().getAttribute('aria-expanded')).toBe('false');
    pressInCustomer('Escape');
    expect(dialog()).toBeNull();
  });

  it('lets a SCHEDULER create, offers a link to customers, and no customer form', async () => {
    nav.role = 'SCHEDULER';
    start();
    openCreate();
    const link = dialog()!.querySelector<HTMLAnchorElement>('a[href="/app/customers"]');
    expect(link?.textContent).toBe('Add a customer');
    expect(dialog()!.querySelectorAll('input:not([type="radio"])')).toHaveLength(1); // the customer search only
    expect(dialog()!.textContent).not.toContain('Full name');
    chooseCustomer();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'PICKUP' }]);
  });
});
