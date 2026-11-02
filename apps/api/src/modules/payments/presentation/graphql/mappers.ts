import { Payment } from '../../domain/payment';
import { PaymentObjectType } from './payment.type';

// Scalar-only mapping; drops `tenantId` and `idempotencyKey` (spec §4.7).
// `invoice` / `refundableMinorUnits` are resolve-fields on `PaymentResolver`.
export function toPaymentObjectType(payment: Payment): PaymentObjectType {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    recordedByStaffId: payment.recordedByStaffId,
    refundedPaymentId: payment.refundedPaymentId,
    amountMinorUnits: payment.amountMinorUnits,
    createdAt: payment.createdAt,
    method: payment.method,
    paidAt: payment.paidAt,
    reference: payment.reference,
    status: payment.status,
    type: payment.type,
  };
}
