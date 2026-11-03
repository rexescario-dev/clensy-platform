// What a payment row records (spec §3). `PAYMENT` is money received from the
// customer; `REFUND` is money returned to the customer.
export enum PaymentType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}
