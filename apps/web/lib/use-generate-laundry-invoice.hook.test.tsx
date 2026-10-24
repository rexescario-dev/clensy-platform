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
  generate: vi.fn(),
  generates: [] as Deferred[],
  paid: vi.fn(),
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

const { useGenerateLaundryInvoice } = await import('./use-generate-laundry-invoice');
type Hook = ReturnType<typeof useGenerateLaundryInvoice>;

const ORDER = '00000000-0000-4000-8000-000000000001';
const GENERATED = { data: { generateInvoiceFromOrder: { id: 'i1' } } };

// The three failure outcomes (rejected; GraphQL errors; missing payload in
// three forms), each as a function of the mutation field name (plan Task 3).
const OUTCOMES = [
  ['rejects', 'reject', () => new Error('network down')],
  ['resolves with errors', 'resolve', () => ({ errors: [{ message: 'Conflict' }] })],
  ['resolves without data', 'resolve', () => ({})],
  ['resolves without the payload field', 'resolve', () => ({ data: {} })],
  ['resolves with a null payload', 'resolve', (field: string) => ({ data: { [field]: null } })],
] as const;

let container: HTMLDivElement;
let root: Root;
let latest: Hook;

function Probe() {
  latest = useGenerateLaundryInvoice({ orderId: ORDER, refetch: api.refetch });
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

beforeEach(() => {
  api.generates.length = 0;
  api.refetches.length = 0;
  api.generate.mockReset();
  api.generate.mockImplementation(deferred(api.generates));
  api.refetch.mockReset();
  api.refetch.mockImplementation(deferred(api.refetches));
  api.awaiting.mockReset();
  api.paid.mockReset();
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
  // Generating an invoice never marks the order paid or prices it (#166).
  expect(api.awaiting).not.toHaveBeenCalled();
  expect(api.paid).not.toHaveBeenCalled();
  expect(api.price).not.toHaveBeenCalled();
});

describe('useGenerateLaundryInvoice', () => {
  it('case 1: sends exactly the order id and terms', () => {
    act(() => {
      void latest.generate('PAY_NOW');
    });
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(api.generates[0]!.options).toEqual({
      variables: { input: { laundryOrderId: ORDER, paymentTerms: 'PAY_NOW' } },
    });
  });

  it('case 2: toasts and refetches on success, keeping generating true until the refetch settles', async () => {
    act(() => {
      void latest.generate('PAY_ON_COMPLETION');
    });
    expect(latest.generating).toBe(true);
    await settle(api.generates, 0, 'resolve', GENERATED);
    expect(document.body.textContent).toContain('Invoice generated.');
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(latest.generating).toBe(true);
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.generating).toBe(false);
    expect(latest.failed).toBe(false);
  });

  it('case 3: drops a second generate while one is in flight', () => {
    act(() => {
      void latest.generate('PAY_NOW');
      void latest.generate('PAY_ON_DELIVERY');
    });
    expect(api.generate).toHaveBeenCalledTimes(1);
  });

  it.each(OUTCOMES)('case 4: fails when the mutation %s, and still refetches the invoice', async (_label, how, make) => {
    act(() => {
      void latest.generate('PAY_NOW');
    });
    await settle(api.generates, 0, how, make('generateInvoiceFromOrder'));
    expect(latest.failed).toBe(true);
    expect(latest.generating).toBe(true);
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Invoice generated.');
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.generating).toBe(false);
    expect(latest.failed).toBe(true);
  });

  it('case 5: clears the failure when the next generate starts', async () => {
    act(() => {
      void latest.generate('PAY_NOW');
    });
    await settle(api.generates, 0, 'reject', new Error('network down'));
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.failed).toBe(true);
    act(() => {
      void latest.generate('PAY_NOW');
    });
    expect(latest.failed).toBe(false);
    expect(api.generate).toHaveBeenCalledTimes(2);
  });

  it('case 6: survives a failed refetch after success', async () => {
    act(() => {
      void latest.generate('PAY_NOW');
    });
    await settle(api.generates, 0, 'resolve', GENERATED);
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.generating).toBe(false);
    expect(latest.failed).toBe(false);
  });

  it('case 7: survives a failed refetch after a failure', async () => {
    act(() => {
      void latest.generate('PAY_NOW');
    });
    await settle(api.generates, 0, 'reject', new Error('network down'));
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.generating).toBe(false);
    expect(latest.failed).toBe(true);
  });
});
