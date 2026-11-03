// @vitest-environment jsdom
import { InvoicePaymentsDocument } from '@clensy/client';
import { InMemoryCache } from '@apollo/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoicePaymentHistory, type InvoicePaymentHistory } from './use-invoice-payment-history';

// The payment history hook on real Apollo (planning decision h): extra pages
// live in hook state, the offset follows the raw page, and a reload discards
// any page still in flight.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const INVOICE = 'i1';

function payment(id: string) {
  return {
    id,
    invoiceId: INVOICE,
    recordedByStaffId: null,
    refundedPaymentId: null,
    __typename: 'Payment',
    amountMinorUnits: 100,
    createdAt: '2026-11-01T00:00:00.000Z',
    method: 'CASH',
    paidAt: '2026-11-01T00:00:00.000Z',
    reference: null,
    refundableMinorUnits: 100,
    status: 'COMPLETED',
    type: 'PAYMENT',
  };
}

function page(ids: string[], hasNextPage: boolean) {
  return {
    data: {
      invoice: {
        id: INVOICE,
        __typename: 'Invoice',
        amountDueMinorUnits: 0,
        amountPaidMinorUnits: 300,
        payments: {
          __typename: 'InvoicePaymentsConnection',
          nodes: ids.map(payment),
          pageInfo: { __typename: 'OffsetPageInfo', hasNextPage },
        },
        paymentStatus: 'PAID',
        totalMinorUnits: 300,
      },
    },
  };
}

interface Served {
  offset: number;
  result: ReturnType<typeof vi.fn>;
}

function mock(offset: number, ids: string[], hasNextPage: boolean, served: Served[], delay = 0): MockedResponse {
  const result = vi.fn(() => page(ids, hasNextPage));
  served.push({ offset, result });
  return { delay, request: { query: InvoicePaymentsDocument, variables: { id: INVOICE, offset } }, result };
}

function failing(offset: number): MockedResponse {
  return { error: new Error('network down'), request: { query: InvoicePaymentsDocument, variables: { id: INVOICE, offset } } };
}

let container: HTMLDivElement;
let root: Root;
let latest: InvoicePaymentHistory;

function Probe() {
  latest = useInvoicePaymentHistory(INVOICE);
  return null;
}

function render(mocks: MockedResponse[]) {
  act(() =>
    root.render(
      <MockedProvider cache={new InMemoryCache()} mocks={mocks}>
        <Probe />
      </MockedProvider>,
    ),
  );
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function ids(): string[] {
  return latest.payments.map((row) => row.id);
}

function calls(served: Served[], offset: number): number {
  return served.filter((entry) => entry.offset === offset).reduce((sum, entry) => sum + entry.result.mock.calls.length, 0);
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useInvoicePaymentHistory on real Apollo', () => {
  it('appends the next page, de-duplicated, and takes hasNextPage from it', async () => {
    const served: Served[] = [];
    render([mock(0, ['p1', 'p2'], true, served), mock(2, ['p2', 'p3'], false, served)]);
    await wait(50);
    expect(ids()).toEqual(['p1', 'p2']);
    expect(latest.hasNextPage).toBe(true);
    expect(latest.invoice?.totalMinorUnits).toBe(300);
    await act(async () => {
      const done = latest.loadMore();
      await vi.advanceTimersByTimeAsync(50);
      await done;
    });
    expect(ids()).toEqual(['p1', 'p2', 'p3']);
    expect(latest.hasNextPage).toBe(false);
    expect(latest.loadingMore).toBe(false);
    expect(latest.loadMoreFailed).toBe(false);
  });

  it('a failed page keeps the loaded rows and sets loadMoreFailed', async () => {
    const served: Served[] = [];
    render([mock(0, ['p1', 'p2'], true, served), failing(2)]);
    await wait(50);
    await act(async () => {
      const done = latest.loadMore();
      await vi.advanceTimersByTimeAsync(50);
      await done;
    });
    expect(ids()).toEqual(['p1', 'p2']);
    expect(latest.loadMoreFailed).toBe(true);
    expect(latest.loadingMore).toBe(false);
    expect(latest.hasNextPage).toBe(true);
  });

  it('reload clears the extra page and requests page 0 again', async () => {
    const served: Served[] = [];
    render([mock(0, ['p1', 'p2'], true, served), mock(2, ['p2', 'p3'], false, served), mock(0, ['p1', 'p2'], true, served)]);
    await wait(50);
    await act(async () => {
      const done = latest.loadMore();
      await vi.advanceTimersByTimeAsync(50);
      await done;
    });
    expect(ids()).toEqual(['p1', 'p2', 'p3']);
    await act(async () => {
      const done = latest.reload();
      await vi.advanceTimersByTimeAsync(50);
      await done;
    });
    expect(calls(served, 0)).toBe(2);
    expect(ids()).toEqual(['p1', 'p2']);
    expect(latest.hasNextPage).toBe(true);
  });

  it('a page of duplicates still advances the offset', async () => {
    const served: Served[] = [];
    render([mock(0, ['p1', 'p2'], true, served), mock(2, ['p1', 'p2'], true, served), mock(4, ['p3'], false, served)]);
    await wait(50);
    for (let index = 0; index < 2; index += 1) {
      await act(async () => {
        const done = latest.loadMore();
        await vi.advanceTimersByTimeAsync(50);
        await done;
      });
    }
    expect(ids()).toEqual(['p1', 'p2', 'p3']);
    expect(calls(served, 2)).toBe(1);
    expect(calls(served, 4)).toBe(1);
    expect(latest.hasNextPage).toBe(false);
  });

  it('a page that arrives after a reload is discarded', async () => {
    const served: Served[] = [];
    render([
      mock(0, ['p1', 'p2'], true, served),
      mock(2, ['p3'], false, served, 500),
      mock(0, ['p1', 'p2'], true, served),
    ]);
    await wait(50);
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = latest.loadMore();
    });
    expect(latest.loadingMore).toBe(true);
    await act(async () => {
      const done = latest.reload();
      await vi.advanceTimersByTimeAsync(50);
      await done;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await pending;
    });
    expect(calls(served, 2)).toBe(1);
    expect(ids()).toEqual(['p1', 'p2']);
    expect(latest.loadingMore).toBe(false);
    expect(latest.loadMoreFailed).toBe(false);
    expect(latest.hasNextPage).toBe(true);
  });
});
