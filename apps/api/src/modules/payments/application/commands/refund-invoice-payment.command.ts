import { PaymentMethod } from '../../domain/payment-method';

// spec §4.5. The invoice is the original payment's invoice; the caller does
// not name it. `tenantId` and `actorId` come from the authenticated
// principal, never from client input.
export interface RefundInvoicePaymentCommand {
  actorId: string;
  tenantId: string;
  paymentId: string;
  idempotencyKey: string;
  method: PaymentMethod;
  amountMinorUnits: number;
  reference?: string | null;
  paidAt?: Date | null;
}
