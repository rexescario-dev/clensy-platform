import type { LaundryOrderStatus, LaundryOrderVerb } from '@clensy/web';

// The order-level payment verbs the Order payment card runs (#166). They
// set the laundry order's status only; neither records money against the
// invoice (lifecycle spec §8.4.4).
export type LaundryPaymentVerb = 'markAwaitingPayment' | 'markPaid';

export type LaundryInvoiceView = 'error' | 'generate' | 'invoice' | 'loading' | 'none' | 'unresolved';

export type LaundryPaymentView = 'choose' | 'markPaid' | 'none' | 'paid';

export interface LaundryInvoiceViewInput {
  error: boolean;
  // `resolvedInvoiceNodes(invoiceQuery)`: `undefined` unless the result is
  // finished, error-free and carries the node list.
  invoices: readonly unknown[] | undefined;
  loading: boolean;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

// What the Invoice card shows (#166). Only a resolved node list says
// whether an invoice exists; loading, failed and incomplete results never
// say "No invoice yet." (#156 M5 review 3).
export function laundryInvoiceView({ error, invoices, loading, verbs }: LaundryInvoiceViewInput): LaundryInvoiceView {
  if (error) return 'error';
  if (loading) return 'loading';
  if (invoices === undefined) return 'unresolved';
  if (invoices.length > 0) return 'invoice';
  return verbs.includes('generateInvoice') ? 'generate' : 'none';
}

// Hides a payment failure only when the refetched status is the attempted
// transition's accepted outcome (#166 decision k). Any other status keeps
// it, so a cancellation by another user never conceals a failed Mark paid.
export function laundryPaymentFailureAlert(
  failure: LaundryPaymentVerb | null,
  status: LaundryOrderStatus,
): LaundryPaymentVerb | null {
  if (failure === 'markPaid' && status === 'PAID') return null;
  if (failure === 'markAwaitingPayment' && (status === 'AWAITING_PAYMENT' || status === 'PAID')) return null;
  return failure;
}

// What the Order payment card offers (#166). From PRICED both verbs are
// legal; from AWAITING_PAYMENT only Mark paid. A PAID order shows a
// sentence whatever the role, because it states a fact.
export function laundryPaymentView(status: LaundryOrderStatus, verbs: readonly LaundryOrderVerb[]): LaundryPaymentView {
  const paid = verbs.includes('markPaid');
  if (paid && verbs.includes('markAwaitingPayment')) return 'choose';
  if (paid) return 'markPaid';
  return status === 'PAID' ? 'paid' : 'none';
}
