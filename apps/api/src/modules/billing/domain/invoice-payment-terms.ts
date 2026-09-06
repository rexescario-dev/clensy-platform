// When payment is expected for an invoice (spec §3). An explicit field,
// supplied by the caller at generation, never inferred from status. It
// determines `dueDate`: `PAY_NOW` -> `issueDate`; `PAY_ON_COMPLETION` /
// `PAY_ON_DELIVERY` -> `null` (the triggering lifecycle date is not known
// at generation). #38 introduces no net-N term and no automatic default.
export enum InvoicePaymentTerms {
  PAY_NOW = 'PAY_NOW',
  PAY_ON_COMPLETION = 'PAY_ON_COMPLETION',
  PAY_ON_DELIVERY = 'PAY_ON_DELIVERY',
}
