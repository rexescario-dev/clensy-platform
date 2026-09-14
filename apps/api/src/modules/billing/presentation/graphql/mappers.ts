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
    customerId: invoice.customerId,
    laundryOrderId: invoice.laundryOrderId,
    amountPaidMinorUnits: invoice.amountPaidMinorUnits,
    createdAt: invoice.createdAt,
    discountMinorUnits: invoice.discountMinorUnits,
    dueDate: invoice.dueDate,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    paymentStatus: invoice.paymentStatus,
    paymentTerms: invoice.paymentTerms,
    subtotalMinorUnits: invoice.subtotalMinorUnits,
    totalMinorUnits: invoice.totalMinorUnits,
    updatedAt: invoice.updatedAt,
  };
}
