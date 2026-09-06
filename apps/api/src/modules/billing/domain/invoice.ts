import { InvoicePaymentStatus } from './invoice-payment-status';
import { InvoicePaymentTerms } from './invoice-payment-terms';

// The `modules/billing` aggregate: a financial document generated once from
// exactly one priced `LaundryOrder` (spec §4.2).
//
// The commercial snapshot — `invoiceNumber`, `laundryOrderId`, `customerId`,
// `subtotalMinorUnits`, `discountMinorUnits`, `totalMinorUnits`,
// `paymentTerms`, `issueDate`, `dueDate` — is immutable after generation.
// `amountPaidMinorUnits` and `paymentStatus` are the designated #39
// mutation surface; #38 writes them once (`0` / `UNPAID`) and never again.
//
// `customerId` is a stable customer association (so invoices can be queried
// by customer without walking through `LaundryOrder`), not a snapshot of
// the customer's name/contact — those stay live reads.
//
// `amountDueMinorUnits` is deliberately NOT a field here: it is
// `totalMinorUnits - amountPaidMinorUnits`, derived on read.
//
// All money is integer minor units. No float anywhere.
export interface Invoice {
  id: string;
  invoiceNumber: string;
  laundryOrderId: string;
  customerId: string;
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  totalMinorUnits: number;
  amountPaidMinorUnits: number;
  paymentStatus: InvoicePaymentStatus;
  paymentTerms: InvoicePaymentTerms;
  issueDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
