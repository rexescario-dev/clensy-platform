// Lifecycle of a payment row (spec §3). v1 writes only `COMPLETED`;
// `PENDING` / `FAILED` are reserved for a future gateway. Only `COMPLETED`
// rows count toward any derived figure.
export enum PaymentRecordStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}
