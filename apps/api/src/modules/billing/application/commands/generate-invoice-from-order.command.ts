import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';

// The single billing command (#38 spec §4.4). `paymentTerms` is required —
// supplied by the caller at generation, never inferred from status.
export interface GenerateInvoiceFromOrderCommand {
  actorId: string;
  laundryOrderId: string;
  paymentTerms: InvoicePaymentTerms;
  // The principal's tenant (`requireTenantId`, #84 spec §4.5/§4.4). Scopes
  // the order lookup and the catalog name resolution; the invoice's own
  // `tenantId` is the scoped order row's (#87 slice decision 6).
  tenantId: string;
}
