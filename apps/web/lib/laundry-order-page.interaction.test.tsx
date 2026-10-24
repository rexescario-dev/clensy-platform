// @vitest-environment jsdom
import type { PriceLaundryOrderInput, PricingUnit } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real order page, the real selection and confirm hooks, the real
// editors and card, in jsdom (#162). Only the Apollo hooks, the preview
// client and the router are mocked.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WASH = '11111111-1111-4111-8111-111111111111';
const SHOES = '22222222-2222-4222-8222-222222222222';
const IRON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SOFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const WEIGHT = 2505;

interface CatalogEntry {
  id: string;
  name: string;
  rate: number;
  unit: PricingUnit;
}
const SERVICES: CatalogEntry[] = [
  { id: SHOES, name: 'Shoes', rate: 2500, unit: 'PER_ITEM' },
  { id: WASH, name: 'Wash', rate: 5000, unit: 'PER_KG' },
];
const ADD_ONS: CatalogEntry[] = [
  { id: IRON, name: 'Ironing', rate: 2500, unit: 'PER_ITEM' },
  { id: SOFT, name: 'Softener', rate: 15000, unit: 'FLAT' },
];

interface Deferred {
  options: unknown;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

const page = vi.hoisted(() => ({
  id: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
  awaiting: vi.fn(),
  awaitings: [] as Deferred[],
  invoice: vi.fn(),
  invoiceError: undefined as Error | undefined,
  // Set by the #166 cases that generate an invoice on purpose.
  invoiceExpected: false,
  invoiceNodes: [] as unknown[],
  invoiceRefetch: vi.fn(),
  invoiceRefetches: [] as Deferred[],
  invoices: [] as Deferred[],
  order: null as unknown,
  orderError: undefined as Error | undefined,
  paid: vi.fn(),
  paids: [] as Deferred[],
  // Set by the #166 cases that run a payment verb on purpose.
  paymentExpected: false,
  preview: vi.fn(),
  previewCalls: [] as PriceLaundryOrderInput[],
  previewFail: null as unknown,
  price: vi.fn(),
  prices: [] as Deferred[],
  refetch: vi.fn(),
  refetches: [] as Deferred[],
  role: 'OPS_MANAGER',
  weigh: vi.fn(),
  // Set by the one case that records a weight on purpose.
  weighExpected: false,
  weighs: [] as Deferred[],
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: page.id }),
  usePathname: () => `/app/laundry/${page.id}`,
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ query: page.preview }),
}));

// The generated `ServicesQuery` / `AddOnsQuery` node shapes
// (`packages/client/src/generated/graphql.ts`). Neither carries a pricing
// unit: the unit is learned from the preview response (#158), which is why
// `CatalogEntry.unit` feeds only `answer` below. The catalog price is a
// deliberate 99900, so a figure on screen from anywhere but the preview fails
// the tests (§8.4.4).
function catalogNode(entry: CatalogEntry, listKey: 'addOns' | 'services') {
  return listKey === 'services'
    ? { id: entry.id, active: true, activePricing: { priceMinorUnits: 99900 }, durationMinutes: 60, name: entry.name }
    : { id: entry.id, active: true, description: null, name: entry.name, priceMinorUnits: 99900 };
}

function catalogQuery(entries: CatalogEntry[], listKey: 'addOns' | 'services') {
  return (options: { skip?: boolean; variables: { filter: { name?: { iLike: string } } } }) => {
    if (options.skip) return { data: undefined, error: undefined, loading: false };
    const text = (options.variables.filter.name?.iLike ?? '').replaceAll('%', '').toLowerCase();
    const nodes = entries.filter((entry) => entry.name.toLowerCase().includes(text)).map((entry) => catalogNode(entry, listKey));
    return {
      data: { [listKey]: { nodes, pageInfo: { hasNextPage: false, hasPreviousPage: false }, totalCount: nodes.length } },
      error: undefined,
      loading: false,
    };
  };
}

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useAddOnsQuery: (options: never) => catalogQuery(ADD_ONS, 'addOns')(options),
  useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: page.role } } }),
  useGenerateInvoiceFromOrderMutation: () => [page.invoice, { loading: false }],
  useInvoiceForOrderQuery: () => ({
    data: { invoices: { nodes: page.invoiceNodes } },
    error: page.invoiceError,
    loading: false,
    refetch: page.invoiceRefetch,
  }),
  useLaundryOrderQuery: () => ({
    data: { laundryOrder: page.order },
    error: page.orderError,
    loading: false,
    refetch: page.refetch,
  }),
  useMarkLaundryOrderAwaitingPaymentMutation: () => [page.awaiting, { loading: false }],
  useMarkLaundryOrderPaidMutation: () => [page.paid, { loading: false }],
  usePriceLaundryOrderMutation: () => [page.price, { loading: false }],
  useServicesQuery: (options: never) => catalogQuery(SERVICES, 'services')(options),
  useWeighLaundryOrderMutation: () => [page.weigh, { loading: false }],
}));

const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');

function weighed(overrides: Record<string, unknown> = {}) {
  return {
    id: page.id,
    createdAt: '2026-10-15T09:00:00.000Z',
    customer: { id: 'c1', fullName: 'Ana Reyes' },
    fulfillmentType: 'PICKUP',
    lines: { nodes: [], pageInfo: { hasNextPage: false } },
    status: 'WEIGHED',
    totalMinorUnits: null,
    weightGrams: WEIGHT,
    ...overrides,
  };
}

function pricedOrder() {
  return weighed({
    lines: {
      nodes: [
        {
          id: 'l1',
          addOnId: null,
          serviceId: WASH,
          createdAt: '2026-10-15T09:05:00.000Z',
          pricingSnapshot: {
            pricingRuleId: null,
            amountMinorUnits: 12345,
            description: 'Wash',
            minimumChargeApplied: false,
            minimumChargeMinorUnits: null,
            quantity: WEIGHT,
            rateMinorUnits: 5000,
            unit: 'PER_KG',
          },
        },
      ],
      pageInfo: { hasNextPage: false },
    },
    status: 'PRICED',
    totalMinorUnits: 12345,
  });
}

// Each line's amount is 12345 and the total 99999, neither of them rate ×
// quantity: the page must show the server's figures (§8.4.4).
function answer(input: PriceLaundryOrderInput) {
  const line = (entry: CatalogEntry, kind: 'addOn' | 'service', quantity: number | null | undefined) => ({
    addOnId: kind === 'addOn' ? entry.id : null,
    serviceId: kind === 'service' ? entry.id : null,
    amountMinorUnits: 12345,
    description: kind === 'addOn' ? `${entry.name} (add-on)` : entry.name,
    minimumChargeApplied: false,
    minimumChargeMinorUnits: null,
    quantity: entry.unit === 'PER_KG' ? WEIGHT : (quantity ?? 1),
    rateMinorUnits: entry.rate,
    unit: entry.unit,
  });
  const lines = [line(SERVICES.find((entry) => entry.id === input.baseServiceId)!, 'service', input.baseQuantity)];
  for (const sent of input.addOns) lines.push(line(ADD_ONS.find((entry) => entry.id === sent.addOnId)!, 'addOn', sent.quantity));
  return { data: { previewLaundryOrderPrice: { estimatedTotalMinorUnits: 99999, lines } } };
}

let container: HTMLDivElement;
let root: Root;

function deferred(list: Deferred[]) {
  return (options?: unknown) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

beforeEach(() => {
  vi.useFakeTimers();
  page.order = weighed();
  page.orderError = undefined;
  page.role = 'OPS_MANAGER';
  page.previewCalls.length = 0;
  page.previewFail = null;
  page.preview.mockReset();
  page.preview.mockImplementation((options: { variables: { input: PriceLaundryOrderInput } }) => {
    page.previewCalls.push(options.variables.input);
    return page.previewFail === null ? Promise.resolve(answer(options.variables.input)) : Promise.reject(page.previewFail);
  });
  page.prices.length = 0;
  page.price.mockReset();
  page.price.mockImplementation(deferred(page.prices));
  page.refetches.length = 0;
  page.refetch.mockReset();
  page.refetch.mockImplementation(deferred(page.refetches));
  page.invoices.length = 0;
  page.invoice.mockReset();
  page.invoice.mockImplementation(deferred(page.invoices));
  page.paids.length = 0;
  page.paid.mockReset();
  page.paid.mockImplementation(deferred(page.paids));
  page.awaitings.length = 0;
  page.awaiting.mockReset();
  page.awaiting.mockImplementation(deferred(page.awaitings));
  page.invoiceRefetches.length = 0;
  page.invoiceRefetch.mockReset();
  page.invoiceRefetch.mockImplementation(deferred(page.invoiceRefetches));
  page.invoiceNodes = [];
  page.invoiceError = undefined;
  page.invoiceExpected = false;
  page.paymentExpected = false;
  page.weigh.mockReset();
  page.weigh.mockImplementation(deferred(page.weighs));
  page.weighs.length = 0;
  page.weighExpected = false;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  // Issue Acceptance: Confirm never generates an invoice or marks an order
  // paid. Only the #166 cases that do so on purpose opt out, each for its
  // own card, so each also proves the other card's mutation was not sent.
  if (!page.invoiceExpected) expect(page.invoice).not.toHaveBeenCalled();
  if (!page.paymentExpected) {
    expect(page.paid).not.toHaveBeenCalled();
    expect(page.awaiting).not.toHaveBeenCalled();
  }
  if (!page.weighExpected) expect(page.weigh).not.toHaveBeenCalled();
});

function mount() {
  act(() =>
    root.render(
      <ToastProvider>
        <LaundryOrderPage />
      </ToastProvider>,
    ),
  );
}

async function settle(rounds = 1) {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  }
}

async function finish(list: Deferred[], index: number, how: 'reject' | 'resolve', value: unknown) {
  await act(async () => {
    list[index]![how](value);
  });
}

// Settles refetch `index` the way Apollo leaves the order query afterwards
// (M5 round 1). It does NOT exercise Apollo's refetch: `useLaundryOrderQuery`
// is mocked to read `page`. It sets the query state the real hook would
// expose (new data on success, `error` on failure), settles the promise the
// page awaits, and re-renders, so the page's response to that state is what
// these tests prove.
async function settleRefetch(index: number, outcome: { error: Error } | { order: unknown }) {
  if ('order' in outcome) {
    page.order = outcome.order;
    await finish(page.refetches, index, 'resolve', { data: { laundryOrder: outcome.order } });
  } else {
    page.orderError = outcome.error;
    await finish(page.refetches, index, 'reject', outcome.error);
  }
  mount();
}

// The invoice twin of `settleRefetch`. It does NOT exercise Apollo's
// refetch either: it sets the invoice query state the real hook would
// expose, settles the promise the hook awaits, and re-renders.
async function settleInvoiceRefetch(index: number, outcome: { error: Error } | { nodes: unknown[] }) {
  if ('nodes' in outcome) {
    page.invoiceNodes = outcome.nodes;
    await finish(page.invoiceRefetches, index, 'resolve', { data: { invoices: { nodes: outcome.nodes } } });
  } else {
    page.invoiceError = outcome.error;
    await finish(page.invoiceRefetches, index, 'reject', outcome.error);
  }
  mount();
}

function section(name: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`#laundry-order-${name}`);
  expect(found, name).not.toBeNull();
  return found!;
}

function priceText(): string {
  return section('price').textContent ?? '';
}

function confirmButton(): HTMLButtonElement {
  const found = [...section('price').querySelectorAll('button')].find((button) => /^Confirm(ing…| price)$/.test(button.textContent ?? ''));
  expect(found, 'Confirm').toBeDefined();
  return found!;
}

function controls(name: string): (HTMLButtonElement | HTMLInputElement)[] {
  return [...section(name).querySelectorAll<HTMLButtonElement | HTMLInputElement>('input, button')];
}

function type(target: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const baseInput = () => container.querySelector<HTMLInputElement>('#laundry-base-service')!;

async function pick(target: HTMLInputElement, id: string, rounds = 3) {
  act(() => target.focus());
  await settle();
  act(() => container.querySelector<HTMLElement>(`#${target.id}-option-${id}`)!.click());
  await settle(rounds);
}

async function addAddOn(id: string) {
  act(() => [...section('services').querySelectorAll('button')].find((button) => button.textContent === 'Add add-on')!.click());
  const inputs = [...section('services').querySelectorAll<HTMLInputElement>('input')].filter((input) => /^laundry-add-on-\d+$/.test(input.id));
  await pick(inputs[inputs.length - 1]!, id);
}

async function readyWithWash() {
  mount();
  await pick(baseInput(), WASH);
  expect(confirmButton().disabled).toBe(false);
}

describe('order page price review (#162)', () => {
  it('case 1: builds the estimate from the preview and enables Confirm only when ready', async () => {
    mount();
    expect(priceText()).toContain('Estimate');
    expect(priceText()).toContain('Select a base service to see an estimate.');
    expect(confirmButton().disabled).toBe(true);
    await pick(baseInput(), WASH);
    for (const text of ['Wash', '2.505 kg', '₱50.00 per kg', '₱123.45', 'Estimated total', '₱999.99']) {
      expect(priceText()).toContain(text);
    }
    // The preview's rate, never the catalog list price (moved from the editor test, case 17).
    expect(container.textContent).not.toContain('₱999.00');
    expect(priceText()).not.toContain('Final price');
    expect(confirmButton().disabled).toBe(false);
  });

  it('case 2: an empty add-on row, then a pending preview, keep Confirm disabled with no breakdown', async () => {
    await readyWithWash();
    act(() => [...section('services').querySelectorAll('button')].find((button) => button.textContent === 'Add add-on')!.click());
    expect(priceText()).toContain('Finish choosing services to see an estimate.');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    const row = [...section('services').querySelectorAll<HTMLInputElement>('input')].find((input) => /^laundry-add-on-\d+$/.test(input.id))!;
    act(() => row.focus());
    await settle();
    act(() => container.querySelector<HTMLElement>(`#${row.id}-option-${SOFT}`)!.click());
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    await settle(2);
    expect(priceText()).toContain('Softener (add-on)');
    expect(confirmButton().disabled).toBe(false);
  });

  it('case 3: a per-kg base sends no baseQuantity', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    expect(page.price).toHaveBeenCalledTimes(1);
    const sent = (page.prices[0]!.options as { variables: { input: PriceLaundryOrderInput } }).variables.input;
    expect(sent).toEqual({ addOns: [], baseServiceId: WASH, orderId: page.id });
    expect('baseQuantity' in sent).toBe(false);
  });

  it('case 4: a per-item base sends its count; only a per-item add-on sends a quantity', async () => {
    mount();
    await pick(baseInput(), SHOES);
    await addAddOn(IRON);
    await addAddOn(SOFT);
    expect(confirmButton().disabled).toBe(false);
    act(() => confirmButton().click());
    const sent = (page.prices[0]!.options as { variables: { input: PriceLaundryOrderInput } }).variables.input;
    expect(sent).toEqual({
      baseServiceId: SHOES,
      orderId: page.id,
      addOns: [{ addOnId: IRON, quantity: 1 }, { addOnId: SOFT }],
      baseQuantity: 1,
    });
    expect(sent).toEqual(page.previewCalls[page.previewCalls.length - 1]);
  });

  it('case 5: success toasts, keeps both editors disabled through the refetch, then shows the Final price', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    expect(confirmButton().textContent).toBe('Confirming…');
    expect(confirmButton().disabled).toBe(true);
    expect(controls('services').every((control) => control.disabled)).toBe(true);
    expect(controls('weighing').every((control) => control.disabled)).toBe(true);
    await finish(page.prices, 0, 'resolve', { data: { priceLaundryOrder: { id: page.id } } });
    expect(document.body.textContent).toContain('Price confirmed.');
    expect(page.refetch).toHaveBeenCalledTimes(1);
    expect(controls('services').every((control) => control.disabled)).toBe(true);
    expect(controls('weighing').every((control) => control.disabled)).toBe(true);
    await settleRefetch(0, { order: pricedOrder() });
    expect(priceText()).toContain('Final price');
    expect(priceText()).not.toContain('Confirm price');
    expect(priceText()).not.toContain('Estimate');
    expect(section('services').textContent).toContain('Services are locked because this order has been priced.');
    expect(section('services').querySelector('input')).toBeNull();
    expect(section('weighing').querySelector('form')).toBeNull();
    expect(page.price).toHaveBeenCalledTimes(1);
  });

  // M5 Section 2 correction 2: both clicks land before React re-renders.
  it('case 6: a double click before the re-render sends one request', async () => {
    await readyWithWash();
    const button = confirmButton();
    act(() => {
      button.click();
      button.click();
    });
    expect(page.price).toHaveBeenCalledTimes(1);
  });

  it('case 7: a failure keeps the selection, disables the editors until the refetch settles, and clears on edit', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'reject', {
      graphQLErrors: [{ extensions: { originalError: { message: 'No effective price for serviceId x' } }, message: 'Bad Request Exception' }],
    });
    expect(section('price').querySelector('[role="alert"]')?.textContent).toBe('No effective price for serviceId x');
    expect(page.refetch).toHaveBeenCalledTimes(1);
    expect(controls('services').every((control) => control.disabled)).toBe(true);
    expect(controls('weighing').every((control) => control.disabled)).toBe(true);
    await settleRefetch(0, { order: weighed() });
    expect(controls('services').some((control) => control.disabled)).toBe(false);
    expect(controls('weighing').some((control) => control.disabled)).toBe(false);
    expect(baseInput().value).toBe('Wash');
    expect(section('price').querySelector('[role="alert"]')?.textContent).toBe('No effective price for serviceId x');
    expect(confirmButton().disabled).toBe(false);
    type(baseInput(), 'Was');
    expect(section('price').querySelector('[role="alert"]')).toBeNull();
  });

  it('case 8: a failure with no server message says "Unable to price order."', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'reject', new Error('network down'));
    expect(section('price').querySelector('[role="alert"]')?.textContent).toBe('Unable to price order.');
    await settleRefetch(0, { order: weighed() });
  });

  // Review focus 2: another actor cancelled the order first.
  it('case 9: after a failure, the refetched status replaces the estimate', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'reject', new Error('network down'));
    await settleRefetch(0, { order: weighed({ status: 'CANCELLED' }) });
    expect(priceText()).toContain('This order was not priced.');
    expect(section('price').querySelector('button')).toBeNull();
  });

  it('case 10: a failed refetch leaves the page error state, not a priceable order', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'resolve', { data: { priceLaundryOrder: { id: page.id } } });
    await settleRefetch(0, { error: new Error('reload failed') });
    expect(container.textContent).toContain('Unable to load laundry order.');
    expect(container.querySelector('#laundry-order-price')).toBeNull();
  });

  // Review focus 1: a re-weigh makes the quote stale.
  it('case 11: a new recorded weight sends the estimate back to Updating with Confirm disabled', async () => {
    await readyWithWash();
    page.order = weighed({ weightGrams: 3000 });
    mount();
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    await settle();
    expect(confirmButton().disabled).toBe(false);
  });

  it('case 12: Try again re-sends the same input after a failed preview', async () => {
    mount();
    page.previewFail = new Error('network down');
    await pick(baseInput(), WASH, 1);
    expect(priceText()).toContain('Couldn’t calculate the estimate.');
    expect(section('services').querySelector('[role="alert"]')?.textContent).toBe('Couldn’t preview the price.');
    expect(confirmButton().disabled).toBe(true);
    const before = page.previewCalls.length;
    page.previewFail = null;
    act(() => [...section('price').querySelectorAll('button')].find((button) => button.textContent === 'Try again')!.click());
    expect(priceText()).toContain('Updating estimate…');
    await settle();
    expect(page.previewCalls.length).toBe(before + 1);
    expect(page.previewCalls[before]).toEqual(page.previewCalls[before - 1]);
    expect(baseInput().value).toBe('Wash');
    expect(confirmButton().disabled).toBe(false);
  });

  // M5 round 1: a selection change after the estimate is shown makes it stale.
  it('case 13: a new base after the estimate is shown hides the old rows and disables Confirm until its preview arrives', async () => {
    await readyWithWash();
    expect(priceText()).toContain('₱123.45');
    type(baseInput(), 'Sho');
    await pick(baseInput(), SHOES, 0);
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('Wash');
    expect(priceText()).not.toContain('₱123.45');
    expect(priceText()).not.toContain('₱999.99');
    expect(confirmButton().disabled).toBe(true);
    await settle(3);
    expect(priceText()).toContain('Shoes');
    expect(confirmButton().disabled).toBe(false);
  });

  // #162 M7 follow-up (owner decision): a weight being saved makes the
  // estimate stale before the order refetch shows the new weight, so Confirm
  // waits for the save and its reload.
  it('case 14: while a new weight is saved and reloaded, the estimate is Updating and Confirm does nothing', async () => {
    page.weighExpected = true;
    await readyWithWash();
    const bag = section('weighing').querySelector<HTMLInputElement>('input')!;
    type(bag, '3');
    act(() => [...section('weighing').querySelectorAll('button')].find((button) => button.textContent === 'Record weight')!.click());
    expect(page.weigh).toHaveBeenCalledTimes(1);
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    act(() => confirmButton().click());
    expect(page.price).not.toHaveBeenCalled();
    await finish(page.weighs, 0, 'resolve', { data: { weighLaundryOrder: { id: page.id, status: 'WEIGHED', weightGrams: 3000 } } });
    expect(page.refetch).toHaveBeenCalledTimes(1);
    expect(priceText()).toContain('Updating estimate…');
    expect(confirmButton().disabled).toBe(true);
    await settleRefetch(0, { order: weighed({ weightGrams: 3000 }) });
    await settle(3);
    expect(confirmButton().disabled).toBe(false);
    expect(page.previewCalls[page.previewCalls.length - 1]).toEqual(page.previewCalls[0]);
    expect(page.price).not.toHaveBeenCalled();
  });
});

// #166: the real page, both cards and both hooks, in jsdom. The refetch
// helpers set query state; they do not run Apollo's refetch.
describe('order page invoice and payment (#166)', () => {
  const INVOICE = {
    id: 'i1',
    amountDueMinorUnits: 12345,
    invoiceNumber: 'INV-2026-000001',
    paymentStatus: 'UNPAID',
    paymentTerms: 'PAY_NOW',
    totalMinorUnits: 12345,
  };

  function button(name: string, label: string): HTMLButtonElement | undefined {
    return [...section(name).querySelectorAll('button')].find((candidate) => candidate.textContent === label);
  }

  function invoiceText(): string {
    return section('invoice').textContent ?? '';
  }

  function alerts(): string[] {
    return [...section('invoice').querySelectorAll('[role="alert"]')].map((alert) => alert.textContent ?? '');
  }

  function priced(status = 'PRICED') {
    return { ...pricedOrder(), status };
  }

  function start(role = 'TENANT_OWNER') {
    page.order = priced();
    page.role = role;
    mount();
  }

  describe('generate', () => {
    beforeEach(() => {
      page.invoiceExpected = true;
    });

    it('case 1: sends the chosen terms and laundry order id only, toasts, and refetches the invoice', async () => {
      start();
      act(() => section('invoice').querySelector<HTMLInputElement>('input[value="PAY_NOW"]')!.click());
      act(() => button('invoice', 'Generate invoice')!.click());
      expect(page.invoice).toHaveBeenCalledTimes(1);
      expect(page.invoices[0]!.options).toEqual({
        variables: { input: { laundryOrderId: page.id, paymentTerms: 'PAY_NOW' } },
      });
      await finish(page.invoices, 0, 'resolve', { data: { generateInvoiceFromOrder: { id: 'i1' } } });
      expect(document.body.textContent).toContain('Invoice generated.');
      expect(page.invoiceRefetch).toHaveBeenCalledTimes(1);
      await settleInvoiceRefetch(0, { nodes: [INVOICE] });
      expect(invoiceText()).toContain('INV-2026-000001');
      expect(invoiceText()).toContain('Unpaid');
      expect(invoiceText()).toContain('Pay now');
      // Generating does not change the order's status.
      expect(page.refetch).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Priced');
    });

    it('case 2: a double click on Generate sends one request', () => {
      start();
      act(() => {
        button('invoice', 'Generate invoice')!.click();
        button('invoice', 'Generate invoice')!.click();
      });
      expect(page.invoice).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['rejected', 'reject', new Error('network down')],
      ['resolved with errors', 'resolve', { errors: [{ message: 'Bad request' }] }],
    ] as const)('cases 3–4: a generate %s alerts, refetches, and re-enables Generate', async (_label, how, value) => {
      start();
      act(() => button('invoice', 'Generate invoice')!.click());
      await finish(page.invoices, 0, how, value);
      expect(page.invoiceRefetches).toHaveLength(1);
      await settleInvoiceRefetch(0, { nodes: [] });
      expect(alerts()).toEqual(['Unable to generate invoice.']);
      expect(button('invoice', 'Generate invoice')!.disabled).toBe(false);
      expect(document.body.textContent).not.toContain('Invoice generated.');
    });

    it('case 5: when another user generated first, the refetch shows their invoice and no stale alert', async () => {
      start();
      act(() => button('invoice', 'Generate invoice')!.click());
      await finish(page.invoices, 0, 'reject', new Error('An invoice already exists for this laundry order'));
      await settleInvoiceRefetch(0, { nodes: [INVOICE] });
      expect(invoiceText()).toContain('INV-2026-000001');
      expect(section('invoice').querySelector('a[href="/app/billing?detail=i1"]')).not.toBeNull();
      expect(alerts()).toEqual([]);
      expect(invoiceText()).not.toContain('Unable to generate invoice.');
      expect(button('invoice', 'Generate invoice')).toBeUndefined();
    });

    it('case 6: a failed invoice refetch says so and keeps the order page', async () => {
      start();
      act(() => button('invoice', 'Generate invoice')!.click());
      await finish(page.invoices, 0, 'resolve', { data: { generateInvoiceFromOrder: { id: 'i1' } } });
      await settleInvoiceRefetch(0, { error: new Error('reload failed') });
      expect(invoiceText()).toContain('Unable to load invoice.');
      expect(invoiceText()).not.toContain('No invoice yet.');
      expect(invoiceText()).not.toContain('Unable to generate invoice.');
      expect(container.querySelector('h1')?.textContent).toBe('Ana Reyes');
      expect(container.querySelector('#laundry-order-actions')).not.toBeNull();
    });
  });

  describe('payment verbs', () => {
    beforeEach(() => {
      page.paymentExpected = true;
    });

    it('case 7: Mark paid sends the order id, toasts, and refetches the order', async () => {
      start();
      act(() => button('invoice', 'Mark paid')!.click());
      expect(page.paids[0]!.options).toEqual({ variables: { input: { orderId: page.id } } });
      await finish(page.paids, 0, 'resolve', { data: { markLaundryOrderPaid: { id: page.id } } });
      expect(document.body.textContent).toContain('Order marked paid.');
      await settleRefetch(0, { order: priced('PAID') });
      expect(invoiceText()).toContain('Paid. Processing can start.');
      expect(page.invoiceRefetch).not.toHaveBeenCalled();
    });

    it('case 8: Mark awaiting payment', async () => {
      start();
      act(() => button('invoice', 'Mark awaiting payment')!.click());
      expect(page.awaitings[0]!.options).toEqual({ variables: { input: { orderId: page.id } } });
      await finish(page.awaitings, 0, 'resolve', { data: { markLaundryOrderAwaitingPayment: { id: page.id } } });
      expect(document.body.textContent).toContain('Order marked awaiting payment.');
      await settleRefetch(0, { order: priced('AWAITING_PAYMENT') });
      expect(button('invoice', 'Mark paid')).toBeDefined();
      expect(button('invoice', 'Mark awaiting payment')).toBeUndefined();
    });

    it('case 9: while one payment verb runs, both buttons are disabled and a second click sends nothing', async () => {
      start();
      act(() => {
        button('invoice', 'Mark paid')!.click();
        button('invoice', 'Mark awaiting payment')!.click();
      });
      expect(page.paid.mock.calls.length + page.awaiting.mock.calls.length).toBe(1);
      expect(button('invoice', 'Mark paid')!.disabled).toBe(true);
      expect(button('invoice', 'Mark awaiting payment')!.disabled).toBe(true);
      await finish(page.paids, 0, 'resolve', { data: { markLaundryOrderPaid: { id: page.id } } });
      expect(button('invoice', 'Mark paid')!.disabled).toBe(true);
      await settleRefetch(0, { order: priced() });
      expect(button('invoice', 'Mark paid')!.disabled).toBe(false);
    });

    it.each([
      ['case 10: a rejected Mark paid', 'reject', new Error('network down')],
      ['case 11: a Mark paid without its payload', 'resolve', { data: { markLaundryOrderPaid: null } }],
    ] as const)('%s alerts, refetches, and re-enables the buttons', async (_label, how, value) => {
      start();
      act(() => button('invoice', 'Mark paid')!.click());
      await finish(page.paids, 0, how, value);
      expect(page.refetches).toHaveLength(1);
      await settleRefetch(0, { order: priced() });
      expect(alerts()).toEqual(['Unable to mark the order paid.']);
      expect(button('invoice', 'Mark paid')!.disabled).toBe(false);
      expect(button('invoice', 'Mark awaiting payment')!.disabled).toBe(false);
      expect(document.body.textContent).not.toContain('Order marked paid.');
    });

    it.each([
      ['Mark paid', 'PAID'],
      ['Mark awaiting payment', 'AWAITING_PAYMENT'],
      ['Mark awaiting payment', 'PAID'],
    ] as const)(
      'case 12: %s fails, another user already reached %s: the refetch shows it and no alert',
      async (label, status) => {
        start();
        act(() => button('invoice', label)!.click());
        await finish(label === 'Mark paid' ? page.paids : page.awaitings, 0, 'reject', new Error('Illegal transition'));
        await settleRefetch(0, { order: priced(status) });
        expect(alerts()).toEqual([]);
        expect(invoiceText()).not.toContain('Unable to mark the order');
        if (status === 'PAID') {
          expect(invoiceText()).toContain('Paid. Processing can start.');
          expect(button('invoice', 'Mark paid')).toBeUndefined();
        } else {
          expect(button('invoice', 'Mark paid')).toBeDefined();
          expect(button('invoice', 'Mark awaiting payment')).toBeUndefined();
        }
      },
    );

    it('case 13: a failed order refetch shows the page error state, not live payment buttons', async () => {
      start();
      act(() => button('invoice', 'Mark paid')!.click());
      await finish(page.paids, 0, 'resolve', { data: { markLaundryOrderPaid: { id: page.id } } });
      await settleRefetch(0, { error: new Error('reload failed') });
      expect(container.textContent).toContain('Unable to load laundry order.');
      expect(container.querySelector('#laundry-order-invoice')).toBeNull();
      const labels = [...container.querySelectorAll('button')].map((candidate) => candidate.textContent);
      expect(labels).not.toContain('Mark paid');
      expect(labels).not.toContain('Mark awaiting payment');
    });

    it('case 14: when another user cancelled the order, the failed Mark paid stays visible', async () => {
      start();
      act(() => button('invoice', 'Mark paid')!.click());
      await finish(page.paids, 0, 'reject', new Error('Illegal transition'));
      await settleRefetch(0, { order: priced('CANCELLED') });
      expect(container.querySelector('h1')?.parentElement?.parentElement?.textContent).toContain('Cancelled');
      expect(alerts()).toEqual(['Unable to mark the order paid.']);
      expect(button('invoice', 'Mark paid')).toBeUndefined();
      expect(button('invoice', 'Mark awaiting payment')).toBeUndefined();
      expect(document.body.textContent).not.toContain('Order marked paid.');
    });
  });
});
