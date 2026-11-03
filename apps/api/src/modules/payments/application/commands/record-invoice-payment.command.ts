import { PaymentMethod } from '../../domain/payment-method';

// spec §4.5. `tenantId` and `actorId` come from the authenticated principal,
// never from client input. `paidAt` is omitted when the user did not change
// it, so the server's now applies.
export interface RecordInvoicePaymentCommand {
  actorId: string;
  tenantId: string;
  invoiceId: string;
  idempotencyKey: string;
  method: PaymentMethod;
  amountMinorUnits: number;
  reference?: string | null;
  paidAt?: Date | null;
}
