import { PaymentMethod } from './payment-method';
import { PaymentRecordStatus } from './payment-record-status';
import { PaymentType } from './payment-type';

// One recorded money movement against one invoice (spec §4.2). Append-only:
// never updated or deleted after insert, hence no `updatedAt`.
export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  type: PaymentType;
  method: PaymentMethod;
  amountMinorUnits: number;
  reference: string | null;
  status: PaymentRecordStatus;
  paidAt: Date;
  refundedPaymentId: string | null;
  recordedByStaffId: string | null;
  idempotencyKey: string;
  createdAt: Date;
}
