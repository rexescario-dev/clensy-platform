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
  // #165: the ten Actions mutations, by GraphQL field, each with its own
  // deferred list.
  lifecycle: Object.fromEntries(
    [
      'cancelLaundryOrder',
      'completeLaundryOrder',
      'markLaundryOrderAwaitingDelivery',
      'markLaundryOrderAwaitingPickup',
      'markLaundryOrderDamaged',
      'markLaundryOrderLost',
      'markLaundryOrderReady',
      'refundLaundryOrder',
      'rejectLaundryOrder',
      'startLaundryProcessing',
    ].map((field) => [field, { fn: vi.fn(), list: [] as Deferred[] }]),
  ) as Record<string, { fn: ReturnType<typeof vi.fn>; list: Deferred[] }>,
  paid: vi.fn(),
  paids: [] as Deferred[],
  price: vi.fn(),
  refetch: vi.fn(),
  refetches: [] as Deferred[],
}));

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useCancelLaundryOrderMutation: () => [api.lifecycle.cancelLaundryOrder!.fn, { loading: false }],
  useCompleteLaundryOrderMutation: () => [api.lifecycle.completeLaundryOrder!.fn, { loading: false }],
  useGenerateInvoiceFromOrderMutation: () => [api.generate, { loading: false }],
  useMarkLaundryOrderAwaitingDeliveryMutation: () => [api.lifecycle.markLaundryOrderAwaitingDelivery!.fn, { loading: false }],
  useMarkLaundryOrderAwaitingPaymentMutation: () => [api.awaiting, { loading: false }],
  useMarkLaundryOrderAwaitingPickupMutation: () => [api.lifecycle.markLaundryOrderAwaitingPickup!.fn, { loading: false }],
  useMarkLaundryOrderDamagedMutation: () => [api.lifecycle.markLaundryOrderDamaged!.fn, { loading: false }],
  useMarkLaundryOrderLostMutation: () => [api.lifecycle.markLaundryOrderLost!.fn, { loading: false }],
  useMarkLaundryOrderPaidMutation: () => [api.paid, { loading: false }],
  useMarkLaundryOrderReadyMutation: () => [api.lifecycle.markLaundryOrderReady!.fn, { loading: false }],
  usePriceLaundryOrderMutation: () => [api.price, { loading: false }],
  useRefundLaundryOrderMutation: () => [api.lifecycle.refundLaundryOrder!.fn, { loading: false }],
  useRejectLaundryOrderMutation: () => [api.lifecycle.rejectLaundryOrder!.fn, { loading: false }],
  useStartLaundryProcessingMutation: () => [api.lifecycle.startLaundryProcessing!.fn, { loading: false }],
}));

const { useLaundryOrderTransition } = await import('./use-laundry-order-transition');
const { useLaundryMutationLock } = await import('./use-laundry-mutation-lock');
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

// #165: the ten Actions verbs, with their mutation field and toast.
const ACTION_VERBS = [
  ['startProcessing', 'startLaundryProcessing', 'Processing started.'],
  ['markReady', 'markLaundryOrderReady', 'Order marked ready.'],
  ['markAwaitingPickup', 'markLaundryOrderAwaitingPickup', 'Order marked awaiting pickup.'],
  ['markAwaitingDelivery', 'markLaundryOrderAwaitingDelivery', 'Order marked awaiting delivery.'],
  ['complete', 'completeLaundryOrder', 'Order completed.'],
  ['cancel', 'cancelLaundryOrder', 'Order cancelled.'],
  ['reject', 'rejectLaundryOrder', 'Order rejected.'],
  ['markLost', 'markLaundryOrderLost', 'Order marked lost.'],
  ['markDamaged', 'markLaundryOrderDamaged', 'Order marked damaged.'],
  ['refund', 'refundLaundryOrder', 'Order refunded.'],
] as const;

// All twelve verbs the hook runs.
const ALL_VERBS = [...VERBS, ...ACTION_VERBS];
type Verb = (typeof ALL_VERBS)[number][0];

let container: HTMLDivElement;
let root: Root;
let latest: Hook;
let latestLock: ReturnType<typeof useLaundryMutationLock>;

function Probe() {
  latest = useLaundryOrderTransition({ orderId: ORDER, refetch: api.refetch });
  return null;
}

// #165: the hook with the page lock, as the order page wires it.
function LockProbe() {
  latestLock = useLaundryMutationLock();
  latest = useLaundryOrderTransition({ lock: latestLock, orderId: ORDER, refetch: api.refetch });
  return null;
}

function mountWithLock() {
  act(() =>
    root.render(
      <ToastProvider>
        <LockProbe />
      </ToastProvider>,
    ),
  );
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

function calls(verb: Verb): Deferred[] {
  if (verb === 'markPaid') return api.paids;
  if (verb === 'markAwaitingPayment') return api.awaitings;
  return api.lifecycle[ACTION_VERBS.find(([name]) => name === verb)![1]]!.list;
}

// Every mutation spy, for "this verb's mutation and no other".
function allMutationSpies(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    markLaundryOrderAwaitingPayment: api.awaiting,
    markLaundryOrderPaid: api.paid,
    ...Object.fromEntries(Object.entries(api.lifecycle).map(([field, { fn }]) => [field, fn])),
  };
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
  for (const entry of Object.values(api.lifecycle)) {
    entry.list.length = 0;
    entry.fn.mockReset();
    entry.fn.mockImplementation(deferred(entry.list));
  }
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

describe('useLaundryOrderTransition, lifecycle verbs and the page lock (#165)', () => {
  describe.each(ALL_VERBS)('%s', (verb, field, success) => {
    it('sends only its own mutation, toasts, and stays pending until the refetch settles', async () => {
      act(() => {
        void latest.run(verb);
      });
      for (const [name, spy] of Object.entries(allMutationSpies())) {
        expect(spy).toHaveBeenCalledTimes(name === field ? 1 : 0);
      }
      expect(calls(verb)[0]!.options).toEqual({ variables: { input: { orderId: ORDER } } });
      await settle(calls(verb), 0, 'resolve', { data: { [field]: { id: ORDER } } });
      expect(document.body.textContent).toContain(success);
      expect(latest.pending).toBe(true);
      await settle(api.refetches, 0, 'resolve', undefined);
      expect(latest.pending).toBe(false);
      expect(latest.failure).toBeNull();
      expect(latest.message).toBeNull();
    });

    it.each(OUTCOMES)('fails when the mutation %s, without a toast, and refetches once', async (_label, how, make) => {
      act(() => {
        void latest.run(verb);
      });
      await settle(calls(verb), 0, how, make(field));
      expect(latest.failure).toBe(verb);
      expect(api.refetch).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).not.toContain(success);
      await settle(api.refetches, 0, 'resolve', undefined);
      expect(latest.pending).toBe(false);
    });
  });

  describe('message', () => {
    it('keeps the server message from a rejection', async () => {
      act(() => {
        void latest.run('reject');
      });
      await settle(calls('reject'), 0, 'reject', {
        graphQLErrors: [
          {
            extensions: { originalError: { message: 'Laundry order cannot transition from PAID to REJECTED' } },
            message: 'Bad Request Exception',
          },
        ],
      });
      expect(latest.message).toBe('Laundry order cannot transition from PAID to REJECTED');
    });

    it('keeps the server message from a resolved result with errors', async () => {
      act(() => {
        void latest.run('cancel');
      });
      await settle(calls('cancel'), 0, 'resolve', { errors: [{ message: 'Conflict' }] });
      expect(latest.message).toBe('Conflict');
    });

    it('has no message for a network failure', async () => {
      act(() => {
        void latest.run('cancel');
      });
      await settle(calls('cancel'), 0, 'reject', new Error('network down'));
      expect(latest.failure).toBe('cancel');
      expect(latest.message).toBeNull();
    });

    it('has no message for a missing payload', async () => {
      act(() => {
        void latest.run('markReady');
      });
      await settle(calls('markReady'), 0, 'resolve', { data: {} });
      expect(latest.failure).toBe('markReady');
      expect(latest.message).toBeNull();
    });

    it('clears with the failure when the next run starts', async () => {
      act(() => {
        void latest.run('cancel');
      });
      await settle(calls('cancel'), 0, 'resolve', { errors: [{ message: 'Conflict' }] });
      await settle(api.refetches, 0, 'resolve', undefined);
      act(() => {
        void latest.run('cancel');
      });
      expect(latest.failure).toBeNull();
      expect(latest.message).toBeNull();
    });
  });

  it('drops a second, different verb while the first is pending', () => {
    act(() => {
      void latest.run('startProcessing');
      void latest.run('cancel');
    });
    expect(api.lifecycle.startLaundryProcessing!.fn).toHaveBeenCalledTimes(1);
    expect(api.lifecycle.cancelLaundryOrder!.fn).not.toHaveBeenCalled();
  });

  describe('with the page lock', () => {
    beforeEach(() => {
      mountWithLock();
    });

    it('L1: acquires as transition before the first await', () => {
      act(() => {
        void latest.run('startProcessing');
        expect(latestLock.isHeld()).toBe(true);
      });
    });

    it.each([
      ['success', 'resolve', { data: { startLaundryProcessing: { id: ORDER } } }, 'resolve'],
      ['a rejection', 'reject', new Error('network down'), 'resolve'],
      ['GraphQL errors', 'resolve', { errors: [{ message: 'Conflict' }] }, 'resolve'],
      ['a missing payload', 'resolve', { data: {} }, 'resolve'],
      ['a rejected refetch', 'resolve', { data: { startLaundryProcessing: { id: ORDER } } }, 'reject'],
    ] as const)('L2: holds the lock until the refetch settles, then releases it, after %s', async (_label, how, value, refetch) => {
      act(() => {
        void latest.run('startProcessing');
      });
      await settle(calls('startProcessing'), 0, how, value);
      expect(latestLock.isHeld()).toBe(true);
      await settle(api.refetches, 0, refetch, refetch === 'reject' ? new Error('reload failed') : undefined);
      expect(latestLock.isHeld()).toBe(false);
      expect(latestLock.held).toBe(false);
    });

    it.each(['weigh', 'transition'] as const)(
      'L3/L5: refuses while a %s lease holds the lock, changes nothing, and does not release it',
      async (owner) => {
        // An earlier failure the refused run must not clear.
        act(() => {
          void latest.run('cancel');
        });
        await settle(calls('cancel'), 0, 'resolve', { errors: [{ message: 'Conflict' }] });
        await settle(api.refetches, 0, 'resolve', undefined);
        expect(latest.failure).toBe('cancel');
        api.refetch.mockClear();

        let lease: ReturnType<typeof latestLock.tryAcquire> = null;
        act(() => {
          lease = latestLock.tryAcquire(owner);
        });
        expect(lease).not.toBeNull();
        await act(async () => {
          await latest.run('startProcessing');
        });
        expect(api.lifecycle.startLaundryProcessing!.fn).not.toHaveBeenCalled();
        expect(api.refetch).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('Processing started.');
        expect(latest.pending).toBe(false);
        expect(latest.failure).toBe('cancel');
        expect(latest.message).toBe('Conflict');
        expect(latestLock.isHeld()).toBe(true);

        // L4: once the holder releases, the verb runs.
        act(() => {
          latestLock.release(lease!);
        });
        act(() => {
          void latest.run('startProcessing');
        });
        expect(api.lifecycle.startLaundryProcessing!.fn).toHaveBeenCalledTimes(1);
      },
    );
  });
});
