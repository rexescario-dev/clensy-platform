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
  record: vi.fn(),
  records: [] as Deferred[],
  refetch: vi.fn(),
  refund: vi.fn(),
  refunds: [] as Deferred[],
}));

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useRecordInvoicePaymentMutation: () => [api.record, { loading: false }],
  useRefundInvoicePaymentMutation: () => [api.refund, { loading: false }],
}));

const { useInvoicePaymentMutations } = await import('./use-invoice-payment-mutations');
const { useLaundryMutationLock } = await import('./use-laundry-mutation-lock');
type Hook = ReturnType<typeof useInvoicePaymentMutations>;
type Lock = ReturnType<typeof useLaundryMutationLock>;

const INVOICE = 'i1';
const KEY = '0f8b6a2e-1c4d-4e5f-8a9b-0c1d2e3f4a5b';
const RECORD = { amountMinorUnits: 700, idempotencyKey: KEY, method: 'CASH' } as const;
const RECORDED = { data: { recordInvoicePayment: { id: 'p1' } } };

let container: HTMLDivElement;
let root: Root;
let latest: Hook;
let lock: Lock;

function Probe({ withLock }: { withLock: boolean }) {
  lock = useLaundryMutationLock();
  latest = useInvoicePaymentMutations({ invoiceId: INVOICE, lock: withLock ? lock : undefined, refetch: api.refetch });
  return null;
}

function deferred(list: Deferred[]) {
  return (options?: unknown) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

function render(withLock: boolean) {
  act(() =>
    root.render(
      <ToastProvider>
        <Probe withLock={withLock} />
      </ToastProvider>,
    ),
  );
}

beforeEach(() => {
  api.records.length = 0;
  api.refunds.length = 0;
  api.record.mockReset();
  api.record.mockImplementation(deferred(api.records));
  api.refund.mockReset();
  api.refund.mockImplementation(deferred(api.refunds));
  api.refetch.mockReset();
  api.refetch.mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  render(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useInvoicePaymentMutations', () => {
  it('sends the invoice id and the caller key unchanged', () => {
    act(() => {
      void latest.record(RECORD);
    });
    expect(api.records[0]!.options).toEqual({ variables: { input: { ...RECORD, invoiceId: INVOICE } } });
  });

  it('drops a second record while one is pending', () => {
    act(() => {
      void latest.record(RECORD);
      void latest.record({ ...RECORD, amountMinorUnits: 100 });
    });
    expect(api.record).toHaveBeenCalledTimes(1);
    expect(latest.pending).toBe(true);
  });

  it('drops a refund while a record is pending', () => {
    act(() => {
      void latest.record(RECORD);
      void latest.refund({ ...RECORD, paymentId: 'p1' });
    });
    expect(api.refund).not.toHaveBeenCalled();
  });

  it('success refetches and returns true', async () => {
    let outcome: boolean | undefined;
    act(() => {
      void latest.record(RECORD).then((value) => {
        outcome = value;
      });
    });
    await act(async () => {
      api.records[0]!.resolve(RECORDED);
    });
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(outcome).toBe(true);
    expect(latest.pending).toBe(false);
    expect(latest.error).toBeNull();
  });

  it('a GraphQL failure sets error to the server message and returns false', async () => {
    let outcome: boolean | undefined;
    act(() => {
      void latest.record(RECORD).then((value) => {
        outcome = value;
      });
    });
    await act(async () => {
      api.records[0]!.reject({
        graphQLErrors: [{ extensions: { originalError: { message: 'The invoice is void.' } }, message: 'Bad Request' }],
      });
    });
    expect(outcome).toBe(false);
    expect(latest.error).toBe('The invoice is void.');
    expect(latest.pending).toBe(false);
    expect(api.refetch).not.toHaveBeenCalled();
  });

  it('a network failure falls back to the copy, and the next write clears it', async () => {
    act(() => {
      void latest.refund({ ...RECORD, paymentId: 'p1' });
    });
    await act(async () => {
      api.refunds[0]!.reject(new Error('network down'));
    });
    expect(latest.error).toBe('Unable to record refund.');
    act(() => {
      void latest.record(RECORD);
    });
    expect(latest.error).toBeNull();
  });

  it('a result without the payload is a failure', async () => {
    let outcome: boolean | undefined;
    act(() => {
      void latest.record(RECORD).then((value) => {
        outcome = value;
      });
    });
    await act(async () => {
      api.records[0]!.resolve({ data: {} });
    });
    expect(outcome).toBe(false);
    expect(latest.error).toBe('Unable to record payment.');
  });
});

describe('useInvoicePaymentMutations with the page lock', () => {
  beforeEach(() => {
    render(true);
  });

  it('is refused while another owner holds the lock', async () => {
    let lease: ReturnType<Lock['tryAcquire']> = null;
    act(() => {
      lease = lock.tryAcquire('transition');
    });
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await latest.record(RECORD);
    });
    expect(outcome).toBe(false);
    expect(api.record).not.toHaveBeenCalled();
    expect(latest.pending).toBe(false);
    expect(lock.isHeld()).toBe(true);
    act(() => lock.release(lease!));
  });

  it('holds the lock as payment until the refetch settles', async () => {
    act(() => {
      void latest.record(RECORD);
    });
    expect(lock.isHeld()).toBe(true);
    await act(async () => {
      api.records[0]!.resolve(RECORDED);
    });
    expect(lock.isHeld()).toBe(false);
  });
});
