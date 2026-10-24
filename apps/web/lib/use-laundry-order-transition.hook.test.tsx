// @vitest-environment jsdom
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred {
  options: unknown;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

const api = vi.hoisted(() => ({
  awaiting: vi.fn(),
  awaitings: [] as Deferred[],
  generate: vi.fn(),
  paid: vi.fn(),
  paids: [] as Deferred[],
  price: vi.fn(),
  refetch: vi.fn(),
  refetches: [] as Deferred[],
}));

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useGenerateInvoiceFromOrderMutation: () => [api.generate, { loading: false }],
  useMarkLaundryOrderAwaitingPaymentMutation: () => [api.awaiting, { loading: false }],
  useMarkLaundryOrderPaidMutation: () => [api.paid, { loading: false }],
  usePriceLaundryOrderMutation: () => [api.price, { loading: false }],
}));

const { useLaundryOrderTransition } = await import('./use-laundry-order-transition');
type Hook = ReturnType<typeof useLaundryOrderTransition>;

const ORDER = '00000000-0000-4000-8000-000000000001';

// The three failure outcomes (rejected; GraphQL errors; missing payload in
// three forms), each as a function of the mutation field name (plan Task 3).
const OUTCOMES = [
  ['rejects', 'reject', () => new Error('network down')],
  ['resolves with errors', 'resolve', () => ({ errors: [{ message: 'Conflict' }] })],
  ['resolves without data', 'resolve', () => ({})],
  ['resolves without the payload field', 'resolve', () => ({ data: {} })],
  ['resolves with a null payload', 'resolve', (field: string) => ({ data: { [field]: null } })],
] as const;

const VERBS = [
  ['markPaid', 'markLaundryOrderPaid', 'Order marked paid.'],
  ['markAwaitingPayment', 'markLaundryOrderAwaitingPayment', 'Order marked awaiting payment.'],
] as const;

let container: HTMLDivElement;
let root: Root;
let latest: Hook;

function Probe() {
  latest = useLaundryOrderTransition({ orderId: ORDER, refetch: api.refetch });
  return null;
}

function deferred(list: Deferred[]) {
  return (options?: unknown) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

async function settle(list: Deferred[], index: number, how: 'reject' | 'resolve', value: unknown) {
  await act(async () => {
    list[index]![how](value);
  });
}

function calls(verb: (typeof VERBS)[number][0]): Deferred[] {
  return verb === 'markPaid' ? api.paids : api.awaitings;
}

beforeEach(() => {
  api.awaitings.length = 0;
  api.paids.length = 0;
  api.refetches.length = 0;
  api.awaiting.mockReset();
  api.awaiting.mockImplementation(deferred(api.awaitings));
  api.paid.mockReset();
  api.paid.mockImplementation(deferred(api.paids));
  api.refetch.mockReset();
  api.refetch.mockImplementation(deferred(api.refetches));
  api.generate.mockReset();
  api.price.mockReset();
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
  // A payment verb never generates an invoice or prices the order (#166).
  expect(api.generate).not.toHaveBeenCalled();
  expect(api.price).not.toHaveBeenCalled();
});

describe('useLaundryOrderTransition', () => {
  it('case 8: marks paid with the order id', async () => {
    act(() => {
      void latest.run('markPaid');
    });
    expect(api.paid).toHaveBeenCalledTimes(1);
    expect(api.paids[0]!.options).toEqual({ variables: { input: { orderId: ORDER } } });
    await settle(api.paids, 0, 'resolve', { data: { markLaundryOrderPaid: { id: ORDER } } });
    expect(document.body.textContent).toContain('Order marked paid.');
    expect(api.refetch).toHaveBeenCalledTimes(1);
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(api.awaiting).not.toHaveBeenCalled();
    expect(latest.failure).toBeNull();
  });

  it('case 9: marks awaiting payment with the order id', async () => {
    act(() => {
      void latest.run('markAwaitingPayment');
    });
    expect(api.awaiting).toHaveBeenCalledTimes(1);
    expect(api.awaitings[0]!.options).toEqual({ variables: { input: { orderId: ORDER } } });
    await settle(api.awaitings, 0, 'resolve', { data: { markLaundryOrderAwaitingPayment: { id: ORDER } } });
    expect(document.body.textContent).toContain('Order marked awaiting payment.');
    expect(api.refetch).toHaveBeenCalledTimes(1);
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(api.paid).not.toHaveBeenCalled();
    expect(latest.failure).toBeNull();
  });

  // Contract items 2 and 3: one guard for every lifecycle verb, held until
  // the refetch settles.
  it('case 10: one guard for both verbs', async () => {
    act(() => {
      void latest.run('markPaid');
      void latest.run('markAwaitingPayment');
    });
    expect(api.paid.mock.calls.length + api.awaiting.mock.calls.length).toBe(1);
    expect(latest.pending).toBe(true);
    await settle(api.paids, 0, 'resolve', { data: { markLaundryOrderPaid: { id: ORDER } } });
    expect(latest.pending).toBe(true);
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.pending).toBe(false);
  });

  describe.each(VERBS)('case 11: %s', (verb, field, success) => {
    it.each(OUTCOMES)('fails when the mutation %s, and still refetches the order', async (_label, how, make) => {
      act(() => {
        void latest.run(verb);
      });
      await settle(calls(verb), 0, how, make(field));
      expect(latest.failure).toBe(verb);
      expect(latest.pending).toBe(true);
      expect(api.refetch).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).not.toContain(success);
      await settle(api.refetches, 0, 'resolve', undefined);
      expect(latest.pending).toBe(false);
      expect(latest.failure).toBe(verb);
    });
  });

  it('case 12: clears the failure when the next run starts', async () => {
    act(() => {
      void latest.run('markPaid');
    });
    await settle(api.paids, 0, 'reject', new Error('network down'));
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.failure).toBe('markPaid');
    act(() => {
      void latest.run('markPaid');
    });
    expect(latest.failure).toBeNull();
    expect(api.paid).toHaveBeenCalledTimes(2);
  });

  it('case 13: survives a failed refetch', async () => {
    act(() => {
      void latest.run('markPaid');
    });
    await settle(api.paids, 0, 'resolve', { data: { markLaundryOrderPaid: { id: ORDER } } });
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.pending).toBe(false);
    expect(latest.failure).toBeNull();
  });
});
