import { InvoicePaymentStatus } from '../../billing/domain/invoice-payment-status';
import { MAX_MINOR_UNITS } from './money-limits';
import { PaymentRecordStatus } from './payment-record-status';
import { PaymentType } from './payment-type';

export interface PaymentRowForDerivation {
  type: PaymentType;
  status: PaymentRecordStatus;
  amountMinorUnits: number;
}

export interface DerivedInvoicePayment {
  amountPaidMinorUnits: number;
  paymentStatus: InvoicePaymentStatus;
}

// Derives the invoice's (amountPaid, paymentStatus) pair from its full row
// set (spec §4.3). Pure, integer arithmetic only; never incremental, so the
// pair cannot drift from its rows.
export function deriveInvoicePayment(input: {
  totalMinorUnits: number;
  currentStatus: InvoicePaymentStatus;
  rows: readonly PaymentRowForDerivation[];
}): DerivedInvoicePayment {
  const { totalMinorUnits, currentStatus, rows } = input;

  // Step 1: only COMPLETED rows count.
  let paid = 0;
  let refunded = 0;
  for (const row of rows) {
    if (row.status !== PaymentRecordStatus.COMPLETED) {
      continue;
    }
    if (row.type === PaymentType.PAYMENT) {
      paid += row.amountMinorUnits;
    } else {
      refunded += row.amountMinorUnits;
    }
  }
  if (!Number.isSafeInteger(paid) || !Number.isSafeInteger(refunded)) {
    throw new RangeError('Payment sums are not safe integers');
  }
  const net = paid - refunded;
  if (net < 0) {
    throw new RangeError('Net paid is negative');
  }
  if (net > MAX_MINOR_UNITS) {
    throw new RangeError('Net paid exceeds MAX_MINOR_UNITS');
  }

  // Step 2: payment writes against a VOID invoice are refused upstream.
  if (currentStatus === InvoicePaymentStatus.VOID) {
    throw new Error('Cannot derive payment state for a VOID invoice');
  }

  // Steps 3-4: first match wins.
  return {
    amountPaidMinorUnits: net,
    paymentStatus: resolveStatus(net, refunded, totalMinorUnits),
  };
}

function resolveStatus(
  net: number,
  refunded: number,
  totalMinorUnits: number,
): InvoicePaymentStatus {
  if (net === 0) {
    return refunded === 0
      ? InvoicePaymentStatus.UNPAID
      : InvoicePaymentStatus.REFUNDED;
  }
  if (net < totalMinorUnits) {
    return InvoicePaymentStatus.PARTIALLY_PAID;
  }
  if (net === totalMinorUnits) {
    return InvoicePaymentStatus.PAID;
  }
  return InvoicePaymentStatus.OVERPAID;
}
