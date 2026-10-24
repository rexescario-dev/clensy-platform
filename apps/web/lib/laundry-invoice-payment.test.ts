import { laundryOrderActions, type AdminRole, type LaundryOrderStatus } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import { INVOICE_PAYMENT_STATUS_TONE } from './invoice-payment-status';
import {
  laundryInvoiceView,
  laundryPaymentFailureAlert,
  laundryPaymentView,
  type LaundryInvoiceView,
  type LaundryPaymentVerb,
  type LaundryPaymentView,
} from './laundry-invoice-payment';

function verbs(status: LaundryOrderStatus, role: AdminRole | undefined) {
  return laundryOrderActions(status, 'PICKUP', role);
}

describe('INVOICE_PAYMENT_STATUS_TONE', () => {
  // Billing's tones, shared by the billing page and the order page (#166).
  it('keeps billing tones', () => {
    expect(INVOICE_PAYMENT_STATUS_TONE).toEqual({
      PAID: 'success',
      PARTIALLY_PAID: 'warning',
      UNPAID: 'neutral',
      VOID: 'danger',
    });
  });
});

describe('laundryInvoiceView', () => {
  it.each<[string, boolean, boolean, readonly unknown[] | undefined, LaundryOrderStatus, AdminRole | undefined, LaundryInvoiceView]>([
    ['error wins over retained data', true, false, [], 'PRICED', 'FINANCE', 'error'],
    ['loading', false, true, undefined, 'PRICED', 'FINANCE', 'loading'],
    ['incomplete result', false, false, undefined, 'PRICED', 'FINANCE', 'unresolved'],
    ['existing invoice', false, false, [{ id: 'i1' }], 'PRICED', 'FINANCE', 'invoice'],
    ['FINANCE on PRICED', false, false, [], 'PRICED', 'FINANCE', 'generate'],
    ['TENANT_OWNER on COMPLETED', false, false, [], 'COMPLETED', 'TENANT_OWNER', 'generate'],
    ['OPS_MANAGER on PRICED', false, false, [], 'PRICED', 'OPS_MANAGER', 'none'],
    ['SCHEDULER on PRICED', false, false, [], 'PRICED', 'SCHEDULER', 'none'],
    ['FINANCE on RECEIVED', false, false, [], 'RECEIVED', 'FINANCE', 'none'],
    ['FINANCE on WEIGHED', false, false, [], 'WEIGHED', 'FINANCE', 'none'],
    ['FINANCE on CANCELLED', false, false, [], 'CANCELLED', 'FINANCE', 'none'],
    ['role loading', false, false, [], 'PRICED', undefined, 'none'],
  ])('%s', (_label, error, loading, invoices, status, role, expected) => {
    expect(laundryInvoiceView({ error, invoices, loading, verbs: verbs(status, role) })).toBe(expected);
  });
});

describe('laundryPaymentView', () => {
  it.each<[LaundryOrderStatus, AdminRole | undefined, LaundryPaymentView]>([
    ['PRICED', 'OPS_MANAGER', 'choose'],
    ['PRICED', 'FINANCE', 'choose'],
    ['PRICED', 'CUSTOMER_SUPPORT', 'choose'],
    ['AWAITING_PAYMENT', 'TENANT_OWNER', 'markPaid'],
    ['PRICED', 'SCHEDULER', 'none'],
    ['PRICED', 'ANALYST', 'none'],
    ['AWAITING_PAYMENT', 'SCHEDULER', 'none'],
    ['PAID', 'FINANCE', 'paid'],
    ['PAID', 'ANALYST', 'paid'],
    ['PAID', undefined, 'paid'],
    ['RECEIVED', 'OPS_MANAGER', 'none'],
    ['PROCESSING', 'OPS_MANAGER', 'none'],
  ])('%s as %s → %s', (status, role, expected) => {
    expect(laundryPaymentView(status, verbs(status, role))).toBe(expected);
  });
});

describe('laundryPaymentFailureAlert', () => {
  // Decision (k): hidden only when the refetched status is the attempted
  // transition's accepted outcome.
  it.each<[LaundryPaymentVerb | null, LaundryOrderStatus, LaundryPaymentVerb | null]>([
    [null, 'PRICED', null],
    // Accepted outcome reached: hidden.
    ['markPaid', 'PAID', null],
    ['markAwaitingPayment', 'AWAITING_PAYMENT', null],
    ['markAwaitingPayment', 'PAID', null],
    // Still offered: shown.
    ['markPaid', 'PRICED', 'markPaid'],
    ['markPaid', 'AWAITING_PAYMENT', 'markPaid'],
    ['markAwaitingPayment', 'PRICED', 'markAwaitingPayment'],
    // Another user cancelled: shown, though no button remains.
    ['markPaid', 'CANCELLED', 'markPaid'],
    ['markAwaitingPayment', 'CANCELLED', 'markAwaitingPayment'],
    // Later than the accepted outcome: shown.
    ['markPaid', 'PROCESSING', 'markPaid'],
    ['markAwaitingPayment', 'PROCESSING', 'markAwaitingPayment'],
  ])('%s failed, order now %s → %s', (failure, status, expected) => {
    expect(laundryPaymentFailureAlert(failure, status)).toBe(expected);
  });
});
