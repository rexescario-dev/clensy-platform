import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Invoice } from '../../domain/invoice';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoiceEntity } from '../../infrastructure/persistence/invoice.entity';

// Billing-owned; structurally identical to the payments domain type of the
// same name. Billing imports nothing from `modules/payments`.
export interface DerivedInvoicePayment {
  amountPaidMinorUnits: number;
  paymentStatus: InvoicePaymentStatus;
}

// The only write path into `invoice_entity` for payments (#39 spec §4.1).
// Callers pass the transaction's `EntityManager`.
@Injectable()
export class InvoicePaymentWriter {
  // Raw SQL so only the two payment columns change; `updatedAt` is
  // deliberately untouched (planning decision n). With the `pg` driver an
  // UPDATE returns `[rows, affectedCount]`.
  async applyDerivedPayment(
    manager: EntityManager,
    invoice: Pick<Invoice, 'id' | 'tenantId'>,
    derived: DerivedInvoicePayment,
  ): Promise<void> {
    const result: [unknown, number] = await manager.query(
      'UPDATE "invoice_entity" SET "amountPaidMinorUnits" = $1, "paymentStatus" = $2 WHERE "id" = $3 AND "tenantId" = $4',
      [
        derived.amountPaidMinorUnits,
        derived.paymentStatus,
        invoice.id,
        invoice.tenantId,
      ],
    );
    if (result[1] !== 1) {
      throw new Error(
        `Expected exactly one invoice row updated for ${invoice.id}, got ${String(result[1])}`,
      );
    }
  }

  lockForPayment(
    manager: EntityManager,
    invoiceId: string,
    tenantId: string,
  ): Promise<Invoice | null> {
    return manager.findOne(InvoiceEntity, {
      lock: { mode: 'pessimistic_write' },
      where: { id: invoiceId, tenantId },
    });
  }
}
