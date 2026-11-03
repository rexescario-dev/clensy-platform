// @vitest-environment jsdom
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The `/app/billing` list and invoice drawer (#39 Task 9, spec §4.10): the
// translated payment status labels, an overpaid due as "Overpaid by ₱x",
// and the invoice payments panel below the drawer's amount block. The real
// page and panel run; only the Apollo hooks and the router are mocked.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred {
  options: unknown;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

interface DetailInvoice {
  id: string;
  amountDueMinorUnits: number;
  amountPaidMinorUnits: number;
  paymentStatus: string;
  totalMinorUnits: number;
}

const billing = vi.hoisted(() => ({
  detail: null as DetailInvoice | null,
  invoiceRefetch: vi.fn(),
  invoicesRefetch: vi.fn(),
  record: vi.fn(),
  records: [] as Deferred[],
  role: 'FINANCE',
  rows: [] as unknown[],
  search: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/billing',
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(billing.search),
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ query: vi.fn() }),
}));

vi.mock('@clensy/client', () => ({
  InvoicePaymentsDocument: {},
  useAdminsQuery: () => ({ data: undefined }),
  useCurrentAdminQuery: () => ({ data: { currentAdmin: { id: 'staff-1', role: billing.role } } }),
  useInvoicePaymentsQuery: () => {
    const invoice = billing.detail;
    return {
      data: invoice
        ? { invoice: { ...invoice, payments: { nodes: [], pageInfo: { hasNextPage: false } } } }
        : undefined,
      error: undefined,
      loading: false,
      refetch: () => Promise.resolve(),
    };
  },
  useInvoiceQuery: () => {
    const invoice = billing.detail;
    return {
      data: invoice
        ? {
            invoice: {
              ...invoice,
              laundryOrderId: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
              customer: { id: 'c1', fullName: 'Ana Reyes' },
              discountMinorUnits: 0,
              dueDate: null,
              invoiceNumber: 'INV-2026-000001',
              issueDate: '2026-11-01T00:00:00.000Z',
              lines: { nodes: [] },
              paymentTerms: 'PAY_NOW',
              subtotalMinorUnits: invoice.totalMinorUnits,
            },
          }
        : undefined,
      error: undefined,
      loading: false,
      refetch: billing.invoiceRefetch,
    };
  },
  useInvoicesQuery: () => ({
    data: { invoices: { nodes: billing.rows, totalCount: billing.rows.length } },
    error: undefined,
    loading: false,
    refetch: billing.invoicesRefetch,
  }),
  useRecordInvoicePaymentMutation: () => [billing.record, { loading: false }],
  useRefundInvoicePaymentMutation: () => [vi.fn(), { loading: false }],
}));

const { default: BillingPage } = await import('../app/app/billing/page');

function row(id: string, paymentStatus: string, total: number, due: number) {
  return {
    id,
    amountDueMinorUnits: due,
    customer: { id: 'c1', fullName: 'Ana Reyes' },
    invoiceNumber: `INV-${id}`,
    issueDate: '2026-11-01T00:00:00.000Z',
    paymentStatus,
    totalMinorUnits: total,
  };
}

// Paid 10200 against a total of 10000: due is −200.
const OVERPAID: DetailInvoice = {
  id: 'i1',
  amountDueMinorUnits: -200,
  amountPaidMinorUnits: 10200,
  paymentStatus: 'OVERPAID',
  totalMinorUnits: 10000,
};

const PARTIAL: DetailInvoice = {
  id: 'i2',
  amountDueMinorUnits: 4000,
  amountPaidMinorUnits: 6000,
  paymentStatus: 'PARTIALLY_PAID',
  totalMinorUnits: 10000,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  billing.detail = null;
  billing.role = 'FINANCE';
  billing.rows = [row('i1', 'OVERPAID', 10000, -200), row('i2', 'PARTIALLY_PAID', 10000, 4000)];
  billing.search = '';
  billing.records.length = 0;
  billing.record.mockReset();
  billing.record.mockImplementation(
    (options: unknown) =>
      new Promise((resolve, reject) => {
        billing.records.push({ options, reject, resolve });
      }),
  );
  billing.invoiceRefetch.mockReset();
  billing.invoiceRefetch.mockResolvedValue({});
  billing.invoicesRefetch.mockReset();
  billing.invoicesRefetch.mockResolvedValue({});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount() {
  act(() =>
    root.render(
      <ToastProvider>
        <BillingPage />
      </ToastProvider>,
    ),
  );
}

function openDrawer(invoice: DetailInvoice) {
  billing.detail = invoice;
  billing.search = `detail=${invoice.id}`;
  mount();
}

function drawer(): HTMLElement {
  const found = container.querySelector<HTMLElement>('[role="dialog"]');
  expect(found, 'drawer').not.toBeNull();
  return found!;
}

// The drawer's own amount block: the `dl` whose terms include Subtotal.
function amountBlock(): HTMLElement {
  const found = [...drawer().querySelectorAll<HTMLElement>('dl')].find((list) =>
    [...list.querySelectorAll('dt')].some((term) => term.textContent === 'Subtotal'),
  );
  expect(found, 'amount block').toBeDefined();
  return found!;
}

function definition(list: HTMLElement, term: string): string | undefined {
  const found = [...list.querySelectorAll('dt')].find((candidate) => candidate.textContent === term);
  return found?.nextElementSibling?.textContent ?? undefined;
}

function listCell(invoiceNumber: string, header: string): string | undefined {
  const table = container.querySelector('table');
  expect(table, 'list table').not.toBeNull();
  const headers = [...table!.querySelectorAll('thead th')].map((cell) => cell.textContent);
  const index = headers.indexOf(header);
  expect(index, header).toBeGreaterThan(-1);
  const found = [...table!.querySelectorAll('tbody tr')].find((candidate) => candidate.textContent?.includes(invoiceNumber));
  return found?.querySelectorAll('td')[index]?.textContent ?? undefined;
}

describe('/app/billing list', () => {
  it('labels the payment status badge in words, not the raw enum', () => {
    mount();
    expect(listCell('INV-i2', 'Payment')).toBe('Partially paid');
    expect(listCell('INV-i1', 'Payment')).toBe('Overpaid');
    expect(container.textContent).not.toContain('PARTIALLY_PAID');
    expect(container.textContent).not.toContain('OVERPAID');
  });

  it('shows an overpaid row’s amount due as "Overpaid by ₱2.00"', () => {
    mount();
    expect(listCell('INV-i1', 'Amount due')).toBe('Overpaid by ₱2.00');
    expect(listCell('INV-i2', 'Amount due')).toBe('₱40.00');
    expect(container.textContent).not.toContain('₱-');
  });
});

describe('/app/billing invoice drawer', () => {
  it('keeps the amount block, with an overpaid due as "Overpaid by ₱2.00" and no "₱-"', () => {
    openDrawer(OVERPAID);
    const block = amountBlock();
    expect(definition(block, 'Subtotal')).toBe('₱100.00');
    expect(definition(block, 'Discount')).toBe('₱0.00');
    expect(definition(block, 'Total')).toBe('₱100.00');
    expect(definition(block, 'Amount paid')).toBe('₱102.00');
    expect(definition(block, 'Amount due')).toBe('Overpaid by ₱2.00');
    expect(drawer().textContent).not.toContain('₱-');
  });

  it('labels the drawer payment status row in words', () => {
    openDrawer(PARTIAL);
    const status = [...drawer().querySelectorAll('dt')].find((term) => term.textContent === 'Payment status');
    expect(status, 'status row').toBeDefined();
    expect(status!.nextElementSibling?.textContent).toBe('Partially paid');
    expect(drawer().textContent).not.toContain('PARTIALLY_PAID');
  });

  it('renders the payments panel below the amount block', () => {
    openDrawer(PARTIAL);
    const panel = drawer().querySelector<HTMLElement>('section[aria-label="Payments"]');
    expect(panel, 'payments panel').not.toBeNull();
    expect(amountBlock().compareDocumentPosition(panel!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel!.querySelector('[data-testid="payments-amount-due"]')?.textContent).toBe('₱40.00');
  });

  it('refetches both Invoice and Invoices after a successful payment', async () => {
    openDrawer(PARTIAL);
    const record = [...drawer().querySelectorAll('button')].find((button) => button.textContent === 'Record payment');
    expect(record, 'Record payment').toBeDefined();
    act(() => record!.click());
    const dialogs = document.body.querySelectorAll('[role="dialog"]');
    const form = dialogs[dialogs.length - 1]?.querySelector('form');
    expect(form, 'record form').not.toBeNull();
    // The method has no default (spec §4.10); choose one.
    act(() => {
      const method = form!.querySelector<HTMLSelectElement>('select[name="payment-method"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(method, 'CASH');
      method.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(billing.record).toHaveBeenCalledTimes(1);
    expect(billing.invoiceRefetch).not.toHaveBeenCalled();
    expect(billing.invoicesRefetch).not.toHaveBeenCalled();
    await act(async () => {
      billing.records[0]!.resolve({ data: { recordInvoicePayment: { id: 'p1' } } });
    });
    expect(document.body.textContent).toContain('Payment recorded.');
    expect(billing.invoiceRefetch).toHaveBeenCalledTimes(1);
    expect(billing.invoicesRefetch).toHaveBeenCalledTimes(1);
  });
});
