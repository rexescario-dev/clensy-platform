// The invoice document's payment state (spec §3). The full vocabulary is
// defined now; #38 only ever writes `UNPAID` at generation. #39 owns the
// transitions among `UNPAID` / `PARTIALLY_PAID` / `PAID` as it records
// payment events. `VOID` is an invoice-lifecycle state, not a payment
// outcome — it is kept here because the ticket's requested model puts it
// here; no operation in #38 produces it, and it must not be read as "the
// payment was voided".
export enum InvoicePaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  VOID = 'VOID',
}
