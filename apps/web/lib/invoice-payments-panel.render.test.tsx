// @vitest-environment jsdom
import type { InvoicePaymentStatus, PaymentRowFragment, Role } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatManilaDateTime } from './manila-time';

// The invoice payments panel (#39 Task 8) in jsdom. The real history and
// write hooks run; only the Apollo hooks are mocked.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred {
  options: { variables: { input: Record<string, unknown> } };
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

const panel = vi.hoisted(() => ({
  admins: vi.fn(),
  clientQuery: vi.fn(),
  invoice: null as unknown,
  record: vi.fn(),
  records: [] as Deferred[],
  refetch: vi.fn(),
  refund: vi.fn(),
  refunds: [] as Deferred[],
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ query: panel.clientQuery }),
}));

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useAdminsQuery: (options: unknown) => panel.admins(options),
  useInvoicePaymentsQuery: () => ({
    data: { invoice: panel.invoice },
    error: undefined,
    loading: false,
    refetch: panel.refetch,
  }),
  useRecordInvoicePaymentMutation: () => [panel.record, { loading: false }],
  useRefundInvoicePaymentMutation: () => [panel.refund, { loading: false }],
}));

const { InvoicePaymentsPanel } = await import('../components/billing/invoice-payments-panel');

const INVOICE = 'i1';
const VIEWER = 'staff-1';
// 11:04 in Manila.
const NOW = new Date('2026-11-02T03:04:30.000Z');

function payment(overrides: Partial<PaymentRowFragment> & Pick<PaymentRowFragment, 'id'>): PaymentRowFragment {
  return {
    invoiceId: INVOICE,
    recordedByStaffId: VIEWER,
    refundedPaymentId: null,
    amountMinorUnits: 30000,
    createdAt: '2026-11-01T00:00:00.000Z',
    method: 'CASH',
    paidAt: '2026-11-01T01:00:00.000Z',
    reference: null,
    refundableMinorUnits: 30000,
    status: 'COMPLETED',
    type: 'PAYMENT',
    ...overrides,
  };
}

function setInvoice(
  status: InvoicePaymentStatus,
  amounts: { due: number; paid: number; total: number },
  nodes: PaymentRowFragment[],
) {
  panel.invoice = {
    id: INVOICE,
    amountDueMinorUnits: amounts.due,
    amountPaidMinorUnits: amounts.paid,
    payments: { nodes, pageInfo: { hasNextPage: false } },
    paymentStatus: status,
    totalMinorUnits: amounts.total,
  };
}

const P1 = payment({ id: 'p1', refundableMinorUnits: 20000 });
const R1 = payment({
  id: 'r1',
  refundedPaymentId: 'p1',
  amountMinorUnits: 10000,
  paidAt: '2026-11-01T02:00:00.000Z',
  refundableMinorUnits: null,
  type: 'REFUND',
});
const P2 = payment({ id: 'p2', amountMinorUnits: 5000, paidAt: '2026-11-01T03:00:00.000Z', refundableMinorUnits: 5000 });

let container: HTMLDivElement;
let root: Root;
const onChanged = vi.fn();

function render(role: Role | undefined) {
  act(() =>
    root.render(
      <ToastProvider>
        <InvoicePaymentsPanel invoiceId={INVOICE} role={role} viewerId={VIEWER} onChanged={onChanged} />
      </ToastProvider>,
    ),
  );
}

function deferred(list: Deferred[]) {
  return (options: Deferred['options']) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

function buttons(text: string): HTMLButtonElement[] {
  return [...document.body.querySelectorAll('button')].filter((button) => button.textContent?.trim() === text);
}

function click(element: HTMLElement) {
  act(() => {
    element.click();
  });
}

function dialog(): HTMLElement {
  const found = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!found) throw new Error('no dialog open');
  return found;
}

function field<T extends HTMLElement>(selector: string): T {
  const found = dialog().querySelector<T>(selector);
  if (!found) throw new Error(`no field ${selector}`);
  return found;
}

function type(selector: string, value: string) {
  const input = field<HTMLInputElement>(selector);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function submit() {
  act(() => {
    field<HTMLFormElement>('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

function rows(): HTMLTableRowElement[] {
  return [...document.body.querySelectorAll<HTMLTableRowElement>('tbody tr')];
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  panel.records.length = 0;
  panel.refunds.length = 0;
  panel.record.mockReset();
  panel.record.mockImplementation(deferred(panel.records));
  panel.refund.mockReset();
  panel.refund.mockImplementation(deferred(panel.refunds));
  panel.refetch.mockReset();
  panel.refetch.mockResolvedValue(undefined);
  panel.clientQuery.mockReset();
  panel.admins.mockReset();
  panel.admins.mockReturnValue({ data: undefined, loading: false });
  onChanged.mockReset();
  onChanged.mockResolvedValue(undefined);
  setInvoice('PARTIALLY_PAID', { due: 25000, paid: 25000, total: 50000 }, [P1, R1, P2]);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('InvoicePaymentsPanel amounts and history', () => {
  it('an OVERPAID invoice shows "Overpaid by ₱2.00" and no ₱-', () => {
    setInvoice('OVERPAID', { due: -200, paid: 50200, total: 50000 }, [payment({ id: 'p1', amountMinorUnits: 50200 })]);
    render('FINANCE');
    expect(container.textContent).toContain('Overpaid by ₱2.00');
    expect(container.textContent).toContain('Overpaid');
    expect(container.textContent).not.toContain('₱-');
  });

  it('renders a mixed history in server order, the refund as money out naming its original', () => {
    render('FINANCE');
    const list = rows();
    expect(list).toHaveLength(3);
    expect(list[0]!.textContent).toContain('₱300.00');
    expect(list[0]!.textContent).toContain('Payment');
    expect(list[1]!.textContent).toContain('Refund');
    expect(list[1]!.textContent).toContain('−₱100.00');
    expect(list[1]!.textContent).toContain(`Refund of ${formatManilaDateTime(P1.paidAt as string)} · ₱300.00`);
    expect(list[2]!.textContent).toContain('₱50.00');
    expect(list[0]!.textContent).toContain(formatManilaDateTime(P1.paidAt as string));
    expect(list[0]!.textContent).toContain('Cash');
    expect(list[0]!.textContent).toContain('You');
  });

  it('a REFUNDED invoice shows the badge, amount due equal to the total, and no Refund action', () => {
    setInvoice('REFUNDED', { due: 50000, paid: 0, total: 50000 }, [
      payment({ id: 'p1', amountMinorUnits: 50000, refundableMinorUnits: 0 }),
      payment({ id: 'r1', refundedPaymentId: 'p1', amountMinorUnits: 50000, refundableMinorUnits: null, type: 'REFUND' }),
    ]);
    render('FINANCE');
    expect(container.textContent).toContain('Refunded');
    const due = container.querySelector('[data-testid="payments-amount-due"]');
    expect(due?.textContent).toContain('₱500.00');
    expect(buttons('Refund payment')).toHaveLength(0);
  });

  it('empty history shows "No payments yet."', () => {
    setInvoice('UNPAID', { due: 50000, paid: 0, total: 50000 }, []);
    render('FINANCE');
    expect(container.textContent).toContain('No payments yet.');
  });

  it('a staff email is shown to TENANT_OWNER, "Staff member" otherwise', () => {
    setInvoice('PARTIALLY_PAID', { due: 20000, paid: 30000, total: 50000 }, [payment({ id: 'p1', recordedByStaffId: 'staff-2' })]);
    panel.admins.mockReturnValue({ data: { admins: [{ id: 'staff-2', email: 'two@example.com' }] }, loading: false });
    render('TENANT_OWNER');
    expect(rows()[0]!.textContent).toContain('two@example.com');
    render('FINANCE');
    expect(rows()[0]!.textContent).toContain('Staff member');
  });
});

describe('InvoicePaymentsPanel role gating', () => {
  it.each([
    ['FINANCE', true, true],
    ['CUSTOMER_SUPPORT', true, false],
    ['ANALYST', false, false],
  ] as const)('%s: record %s, refund %s', (role, record, refund) => {
    render(role);
    expect(buttons('Record payment').length > 0).toBe(record);
    expect(buttons('Refund payment').length > 0).toBe(refund);
  });

  it('VOID hides Record and Refund', () => {
    setInvoice('VOID', { due: 25000, paid: 25000, total: 50000 }, [P1]);
    render('TENANT_OWNER');
    expect(buttons('Record payment')).toHaveLength(0);
    expect(buttons('Refund payment')).toHaveLength(0);
  });

  it('runs the admins query only for TENANT_OWNER', () => {
    render('FINANCE');
    expect(panel.admins).toHaveBeenLastCalledWith(expect.objectContaining({ skip: true }));
    render('TENANT_OWNER');
    expect(panel.admins).toHaveBeenLastCalledWith(expect.objectContaining({ skip: false }));
  });
});

describe('InvoicePaymentsPanel record dialog', () => {
  function openRecord() {
    click(buttons('Record payment')[0]!);
  }

  it('pre-fills the amount due and paid-at now in Manila, with max now', () => {
    render('FINANCE');
    openRecord();
    expect(field<HTMLInputElement>('input[name="payment-amount"]').value).toBe('250.00');
    const paidAt = field<HTMLInputElement>('input[name="payment-paid-at"]');
    expect(paidAt.type).toBe('datetime-local');
    expect(paidAt.value).toBe('2026-11-02T11:04');
    expect(paidAt.max).toBe('2026-11-02T11:04');
    expect(field<HTMLSelectElement>('select[name="payment-method"]').required).toBe(true);
  });

  it.each([
    ['abc', 'Enter an amount such as 150.00.'],
    ['0', 'Enter an amount greater than zero.'],
    ['99999999999999999999', 'That amount is too large.'],
    ['21474836.48', 'That amount is too large.'],
  ])('%s shows the inline error and makes no call', (amount, message) => {
    render('FINANCE');
    openRecord();
    type('input[name="payment-amount"]', amount);
    submit();
    expect(dialog().textContent).toContain(message);
    expect(panel.record).not.toHaveBeenCalled();
  });

  it('an untouched paid-at sends no paidAt; the caller key is a UUID', () => {
    render('FINANCE');
    openRecord();
    submit();
    const input = panel.records[0]!.options.variables.input;
    expect(input).not.toHaveProperty('paidAt');
    expect(input).toMatchObject({ amountMinorUnits: 25000, invoiceId: INVOICE, method: 'CASH' });
    expect(input.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('an edited paid-at is sent as Manila time', () => {
    render('FINANCE');
    openRecord();
    type('input[name="payment-paid-at"]', '2026-11-01T09:30');
    submit();
    expect(panel.records[0]!.options.variables.input.paidAt).toBe('2026-11-01T09:30:00+08:00');
  });

  it('an edited paid-at that is not a real instant blocks the submit', () => {
    render('FINANCE');
    openRecord();
    type('input[name="payment-paid-at"]', '2026-02-31T09:30');
    submit();
    expect(panel.record).not.toHaveBeenCalled();
    expect(field<HTMLInputElement>('input[name="payment-paid-at"]').getAttribute('aria-invalid')).toBe('true');
  });

  it('a retry keeps the key; after success a reopened dialog has a new key', async () => {
    render('FINANCE');
    openRecord();
    submit();
    await act(async () => {
      panel.records[0]!.reject({ graphQLErrors: [{ extensions: { originalError: { message: 'Server says no.' } } }] });
    });
    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe('Server says no.');
    submit();
    expect(panel.record).toHaveBeenCalledTimes(2);
    const first = panel.records[0]!.options.variables.input.idempotencyKey;
    expect(panel.records[1]!.options.variables.input.idempotencyKey).toBe(first);
    await act(async () => {
      panel.records[1]!.resolve({ data: { recordInvoicePayment: { id: 'p9' } } });
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain('Payment recorded.');
    expect(panel.refetch).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
    openRecord();
    submit();
    expect(panel.records[2]!.options.variables.input.idempotencyKey).not.toBe(first);
  });

  it('closing discards the key', async () => {
    render('FINANCE');
    openRecord();
    submit();
    const first = panel.records[0]!.options.variables.input.idempotencyKey;
    await act(async () => {
      panel.records[0]!.reject(new Error('network down'));
    });
    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe('Unable to record payment.');
    click(buttons('Cancel')[0]!);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    openRecord();
    expect(dialog().querySelector('[role="alert"]')).toBeNull();
    submit();
    expect(panel.records[1]!.options.variables.input.idempotencyKey).not.toBe(first);
  });
});

describe('InvoicePaymentsPanel refund dialog', () => {
  function openRefund() {
    click(buttons('Refund payment')[0]!);
  }

  it('shows the permanent-action notice and pre-fills the refundable amount', () => {
    render('FINANCE');
    openRefund();
    expect(dialog().textContent).toContain('Refunds are recorded permanently. They cannot be edited or deleted.');
    expect(field<HTMLInputElement>('input[name="payment-amount"]').value).toBe('200.00');
  });

  it('a refund above the refundable amount shows the cap and makes no call', () => {
    render('FINANCE');
    openRefund();
    type('input[name="payment-amount"]', '200.01');
    submit();
    expect(dialog().textContent).toContain('A refund cannot exceed ₱200.00.');
    expect(panel.refund).not.toHaveBeenCalled();
  });

  it('sends the original payment id', () => {
    render('FINANCE');
    openRefund();
    submit();
    expect(panel.refunds[0]!.options.variables.input).toMatchObject({ amountMinorUnits: 20000, method: 'CASH', paymentId: 'p1' });
    expect(panel.refunds[0]!.options.variables.input).not.toHaveProperty('paidAt');
  });
});

describe('InvoicePaymentsPanel load more', () => {
  it('shows Load more while there is a next page; a failure keeps the rows', async () => {
    setInvoice('PARTIALLY_PAID', { due: 25000, paid: 25000, total: 50000 }, [P1]);
    (panel.invoice as { payments: { pageInfo: { hasNextPage: boolean } } }).payments.pageInfo.hasNextPage = true;
    panel.clientQuery.mockRejectedValue(new Error('network down'));
    render('FINANCE');
    await act(async () => {
      buttons('Load more')[0]!.click();
    });
    expect(panel.clientQuery).toHaveBeenCalledWith(expect.objectContaining({ variables: { id: INVOICE, offset: 1 } }));
    expect(container.textContent).toContain('Unable to load more payments.');
    expect(rows()).toHaveLength(1);
  });
});
