// How the money moved (spec §3). Recorded, never processed. A refund carries
// its own method, independent of the original payment's.
export enum PaymentMethod {
  CASH = 'CASH',
  GCASH = 'GCASH',
  MAYA = 'MAYA',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
  OTHER = 'OTHER',
}
