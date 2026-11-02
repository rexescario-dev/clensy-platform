// The invoice document's payment state (spec §3; Amendment #39). The full
// vocabulary is defined here. #38 only ever wrote `UNPAID` at generation;
// #39 now owns every transition among `UNPAID` / `PARTIALLY_PAID` / `PAID` /
// `OVERPAID` / `REFUNDED`, and those transitions happen only through
// `deriveInvoicePayment`. `VOID` is an invoice-lifecycle state, not a payment
// outcome — no payment operation moves an invoice into or out of it, and it
// must not be read as "the payment was voided".
export enum InvoicePaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERPAID = 'OVERPAID',
  REFUNDED = 'REFUNDED',
  VOID = 'VOID',
}
