// @vitest-environment jsdom
import type { PriceLaundryOrderInput } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LAUNDRY_SERVICE_SELECTION, type LaundryServiceSelection } from './laundry-service-selection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred {
  options: unknown;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

const api = vi.hoisted(() => ({
  invoice: vi.fn(),
  paid: vi.fn(),
  price: vi.fn(),
  prices: [] as Deferred[],
  refetch: vi.fn(),
  refetches: [] as Deferred[],
}));

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useGenerateInvoiceFromOrderMutation: () => [api.invoice, { loading: false }],
  useMarkLaundryOrderPaidMutation: () => [api.paid, { loading: false }],
  usePriceLaundryOrderMutation: () => [api.price, { loading: false }],
}));

const { useConfirmLaundryPrice } = await import('./use-confirm-laundry-price');
type Hook = ReturnType<typeof useConfirmLaundryPrice>;

const INPUT: PriceLaundryOrderInput = {
  addOns: [],
  baseServiceId: '11111111-1111-4111-8111-111111111111',
  orderId: '00000000-0000-4000-8000-000000000001',
};
const SELECTION: LaundryServiceSelection = { ...EMPTY_LAUNDRY_SERVICE_SELECTION, baseQuery: 'Wash' };
const PRICED = { data: { priceLaundryOrder: { id: INPUT.orderId } } };

let container: HTMLDivElement;
let root: Root;
let latest: Hook;

function Probe() {
  latest = useConfirmLaundryPrice({ refetch: api.refetch });
  return null;
}

function deferred(list: Deferred[]) {
  return (options?: unknown) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

beforeEach(() => {
  api.prices.length = 0;
  api.refetches.length = 0;
  api.price.mockReset();
  api.price.mockImplementation(deferred(api.prices));
  api.refetch.mockReset();
  api.refetch.mockImplementation(deferred(api.refetches));
  api.invoice.mockReset();
  api.paid.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // Issue: an estimate never generates an invoice or marks an order paid.
  expect(api.invoice).not.toHaveBeenCalled();
  expect(api.paid).not.toHaveBeenCalled();
});

async function settle(list: Deferred[], index: number, how: 'reject' | 'resolve', value: unknown) {
  await act(async () => {
    list[index]![how](value);
  });
}

function serverError(message: string) {
  return { graphQLErrors: [{ extensions: { originalError: { message } }, message: 'Bad Request Exception' }] };
}

describe('useConfirmLaundryPrice', () => {
  it('case 1: sends the input unchanged, toasts, and stays confirming until the refetch settles', async () => {
    let done: Promise<void> | undefined;
    act(() => {
      done = latest.confirm(INPUT, SELECTION);
    });
    expect(api.price).toHaveBeenCalledTimes(1);
    expect(api.prices[0]!.options).toEqual({ variables: { input: INPUT } });
    expect(latest.confirming).toBe(true);
    await settle(api.prices, 0, 'resolve', PRICED);
    expect(document.body.textContent).toContain('Price confirmed.');
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(latest.confirming).toBe(true);
    await settle(api.refetches, 0, 'resolve', undefined);
    await act(async () => {
      await done;
    });
    expect(latest.confirming).toBe(false);
    expect(latest.failure).toBeNull();
  });

  // M5 Section 2 correction 2: both calls land before React re-renders, so
  // only the synchronous ref can drop the second.
  it('case 2: a synchronous double invocation sends one request', () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
      void latest.confirm(INPUT, SELECTION);
    });
    expect(api.price).toHaveBeenCalledTimes(1);
  });

  it('case 3: a failure keeps the server message and the selection, refetches, and releases after the refetch', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'reject', serverError('Laundry order cannot transition from PRICED to PRICED'));
    expect(latest.failure).toEqual({ message: 'Laundry order cannot transition from PRICED to PRICED', selection: SELECTION });
    expect(latest.failure?.selection).toBe(SELECTION);
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(latest.confirming).toBe(true);
    expect(document.body.textContent).not.toContain('Price confirmed.');
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.confirming).toBe(false);
    expect(latest.failure?.message).toBe('Laundry order cannot transition from PRICED to PRICED');
  });

  it.each([
    ['a network error', 'reject', new Error('network down')],
    ['a result with errors', 'resolve', { data: null, errors: [{ message: '' }] }],
    ['a result without the payload', 'resolve', { data: {} }],
  ] as const)('case 4: %s shows "Unable to price order."', async (_label, how, value) => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, how, value);
    expect(latest.failure?.message).toBe('Unable to price order.');
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.confirming).toBe(false);
  });

  it('case 5: a failed refetch after success is swallowed and releases the guard', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'resolve', PRICED);
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.confirming).toBe(false);
    expect(latest.failure).toBeNull();
  });

  it('case 6: a failed refetch after a failure keeps the mutation error', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'reject', serverError('Order is cancelled'));
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.confirming).toBe(false);
    expect(latest.failure?.message).toBe('Order is cancelled');
  });

  it('case 7: Confirm again clears the old failure at once and sends again', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'reject', new Error('network down'));
    await settle(api.refetches, 0, 'resolve', undefined);
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    expect(latest.failure).toBeNull();
    expect(api.price).toHaveBeenCalledTimes(2);
  });
});
