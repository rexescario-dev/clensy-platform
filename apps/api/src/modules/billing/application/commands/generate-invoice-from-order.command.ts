import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';

// The single billing command (#38 spec §4.4). `paymentTerms` is required —
// supplied by the caller at generation, never inferred from status.
export interface GenerateInvoiceFromOrderCommand {
  actorId: string;
  laundryOrderId: string;
  paymentTerms: InvoicePaymentTerms;
}
