import { Invoice } from '../../domain/invoice';
import { InvoiceType } from './invoice.type';

// Scalar-only mapping. `customer` / `laundryOrder` / the `lines` connection
// are resolved by nestjs-query's generated relation resolvers from the
// entity relations (the `LaundryOrderType` -> `@FilterableRelation`
// precedent). `amountDueMinorUnits` is a computed `@ResolveField` on
// `InvoiceResolver`, not mapped here.
export function toInvoiceType(invoice: Invoice): InvoiceType {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    laundryOrderId: invoice.laundryOrderId,
    customerId: invoice.customerId,
    subtotalMinorUnits: invoice.subtotalMinorUnits,
    discountMinorUnits: invoice.discountMinorUnits,
    totalMinorUnits: invoice.totalMinorUnits,
    amountPaidMinorUnits: invoice.amountPaidMinorUnits,
    paymentStatus: invoice.paymentStatus,
    paymentTerms: invoice.paymentTerms,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}
