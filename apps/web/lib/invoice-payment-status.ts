import type { InvoicePaymentStatus } from '@clensy/client';
import type { StatusTone } from '@clensy/ui';

// Invoice payment-status badge tones, shared by the billing page and the
// laundry order page (#166), so the two never disagree.
export const INVOICE_PAYMENT_STATUS_TONE: Readonly<Record<InvoicePaymentStatus, StatusTone>> = {
  OVERPAID: 'warning',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  REFUNDED: 'neutral',
  UNPAID: 'neutral',
  VOID: 'danger',
};
