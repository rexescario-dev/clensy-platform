import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { tenantAuditTags } from '../../../../platform/audit/application/audit-tags';
import { isPostgresUniqueViolation } from '../../../../platform/database/unique-violation';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { InvoicePaymentWriter } from '../../../billing/application/services/invoice-payment-writer';
import { InvoicePaymentStatus } from '../../../billing/domain/invoice-payment-status';
import { deriveInvoicePayment } from '../../domain/derive-invoice-payment';
import { isCanonicalUuid } from '../../domain/idempotency-key';
import { MAX_MINOR_UNITS } from '../../domain/money-limits';
import { Payment } from '../../domain/payment';
import { PaymentMethod } from '../../domain/payment-method';
import { formatPesos } from '../../domain/format-pesos';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';
import { refundableMinorUnits } from '../../domain/refundable-amount';
import { PaymentEntity } from '../../infrastructure/persistence/payment.entity';
import { RecordInvoicePaymentCommand } from '../commands/record-invoice-payment.command';
import { RefundInvoicePaymentCommand } from '../commands/refund-invoice-payment.command';

const ENTITY_TYPE = 'payment';
const MAX_REFERENCE_LENGTH = 120;
const IDEMPOTENCY_CONSTRAINT = 'uq_payment_tenant_idempotency_key';
const KEY_REUSED_MESSAGE =
  'This request key was already used for a different entry. Close the dialog and start a new entry.';

// The A-checked, normalized input shared by both commands.
interface CheckedInput {
  paidAt: Date;
  paidAtSupplied: boolean;
  reference: string | null;
}

// The fields a same-key replay must repeat to count as the same request
// (spec §4.5 "Duplicate submissions").
interface ReplayShape {
  type: PaymentType;
  invoiceId?: string;
  refundedPaymentId?: string;
  method: PaymentMethod;
  amountMinorUnits: number;
  reference: string | null;
  paidAt: Date;
  paidAtSupplied: boolean;
}

// Records payments and refunds against an invoice (#39 spec §4.5, §4.6).
// One ordered check sequence, first failure wins: A1–A4 before the
// transaction opens (no database access), then B1–B7 under the invoice row
// lock taken through billing's `InvoicePaymentWriter` port. The insert, the
// re-derived invoice pair and the audit event commit or roll back together.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invoicePaymentWriter: InvoicePaymentWriter,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async record(command: RecordInvoicePaymentCommand): Promise<Payment> {
    const input = this.checkInput(command);

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        // B1
        const invoice = await this.invoicePaymentWriter.lockForPayment(
          manager,
          command.invoiceId,
          command.tenantId,
        );
        if (!invoice) {
          throw new NotFoundException(`Invoice ${command.invoiceId} not found`);
        }

        // B2
        const replay = await this.findReplay(manager, command, {
          invoiceId: command.invoiceId,
          amountMinorUnits: command.amountMinorUnits,
          method: command.method,
          paidAt: input.paidAt,
          paidAtSupplied: input.paidAtSupplied,
          reference: input.reference,
          type: PaymentType.PAYMENT,
        });
        if (replay) {
          return replay;
        }

        // B3
        this.assertNotVoid(invoice.paymentStatus);

        // B7
        const completed = await manager.find(PaymentEntity, {
          where: {
            tenantId: command.tenantId,
            invoiceId: invoice.id,
            status: PaymentRecordStatus.COMPLETED,
          },
        });
        const net = netPaid(completed);
        if (net + command.amountMinorUnits > MAX_MINOR_UNITS) {
          throw new BadRequestException(
            `This payment would take the amount paid above the supported maximum. The largest amount that can still be recorded is ${formatPesos(MAX_MINOR_UNITS - net)}.`,
          );
        }

        return this.insertAndDerive(manager, invoice, command, {
          refundedPaymentId: null,
          action: 'payment.recorded',
          amountMinorUnits: command.amountMinorUnits,
          method: command.method,
          paidAt: input.paidAt,
          reference: input.reference,
          type: PaymentType.PAYMENT,
        });
      }),
    );
  }

  async refund(command: RefundInvoicePaymentCommand): Promise<Payment> {
    const input = this.checkInput(command);

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        // B1 (§4.6 step 1a): locate the original only to learn its invoice.
        const located = await manager.findOne(PaymentEntity, {
          where: { id: command.paymentId, tenantId: command.tenantId },
        });
        if (!located) {
          throw this.paymentNotFound(command.paymentId);
        }
        // §4.6 step 1b-c: lock the invoice, then re-read the original and
        // its refunds; only this re-read is validated below.
        const invoice = await this.invoicePaymentWriter.lockForPayment(
          manager,
          located.invoiceId,
          command.tenantId,
        );
        if (!invoice) {
          throw this.paymentNotFound(command.paymentId);
        }
        const original = await manager.findOne(PaymentEntity, {
          where: { id: command.paymentId, tenantId: command.tenantId },
        });
        if (!original) {
          throw this.paymentNotFound(command.paymentId);
        }
        const refunds = await manager.find(PaymentEntity, {
          where: {
            tenantId: command.tenantId,
            refundedPaymentId: original.id,
          },
        });

        // B2
        const replay = await this.findReplay(manager, command, {
          refundedPaymentId: original.id,
          amountMinorUnits: command.amountMinorUnits,
          method: command.method,
          paidAt: input.paidAt,
          paidAtSupplied: input.paidAtSupplied,
          reference: input.reference,
          type: PaymentType.REFUND,
        });
        if (replay) {
          return replay;
        }

        // B3
        this.assertNotVoid(invoice.paymentStatus);

        // B4
        if (
          original.type !== PaymentType.PAYMENT ||
          original.status !== PaymentRecordStatus.COMPLETED
        ) {
          throw new BadRequestException(
            'Only a completed payment can be refunded.',
          );
        }

        // B5
        if (input.paidAt.getTime() < original.paidAt.getTime()) {
          throw new BadRequestException(
            'A refund cannot be dated before the payment it refunds.',
          );
        }

        // B6
        const refundable = refundableMinorUnits(
          original.amountMinorUnits,
          refunds
            .filter((r) => r.status === PaymentRecordStatus.COMPLETED)
            .map((r) => r.amountMinorUnits),
        );
        if (command.amountMinorUnits > refundable) {
          throw new BadRequestException(
            `This refund is more than the payment's refundable amount of ${formatPesos(refundable)}.`,
          );
        }

        return this.insertAndDerive(manager, invoice, command, {
          refundedPaymentId: original.id,
          action: 'payment.refunded',
          amountMinorUnits: command.amountMinorUnits,
          method: command.method,
          paidAt: input.paidAt,
          reference: input.reference,
          type: PaymentType.REFUND,
        });
      }),
    );
  }

  // Refundable amount per requested payment (spec §3), one grouped query.
  // Only the tenant's COMPLETED PAYMENT rows appear in the result; any other
  // requested id is absent. `SUM(integer)` is `bigint`, read as text and
  // converted with a safe-integer check (spec §4.3, the
  // `allocateInvoiceNumber` precedent).
  async refundableByPaymentIds(
    paymentIds: readonly string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    const refundable = new Map<string, number>();
    if (paymentIds.length === 0) {
      return refundable;
    }

    const rows: Array<{
      id: string;
      amountMinorUnits: number;
      refundedMinorUnits: string;
    }> = await this.dataSource.query(
      `SELECT p."id" AS "id",
              p."amountMinorUnits" AS "amountMinorUnits",
              COALESCE(SUM(r."amountMinorUnits") FILTER (WHERE r."status" = 'COMPLETED'), 0)::text AS "refundedMinorUnits"
         FROM "payment_entity" p
         LEFT JOIN "payment_entity" r ON r."refundedPaymentId" = p."id" AND r."tenantId" = p."tenantId"
        WHERE p."id" = ANY($1::uuid[])
          AND p."tenantId" = $2
          AND p."type" = 'PAYMENT'
          AND p."status" = 'COMPLETED'
        GROUP BY p."id"`,
      [[...paymentIds], tenantId],
    );

    for (const row of rows) {
      const refunded = Number(row.refundedMinorUnits);
      if (!Number.isSafeInteger(refunded)) {
        throw new RangeError(
          `Refunded sum for payment ${row.id} is not a safe integer: ${row.refundedMinorUnits}`,
        );
      }
      refundable.set(
        row.id,
        refundableMinorUnits(row.amountMinorUnits, [refunded]),
      );
    }
    return refundable;
  }

  private assertNotVoid(status: InvoicePaymentStatus): void {
    if (status === InvoicePaymentStatus.VOID) {
      throw new BadRequestException(
        'Payments cannot be recorded or refunded on a void invoice.',
      );
    }
  }

  // A1–A4 (spec §4.5), in order, before any database access. `now` is
  // captured once; an omitted `paidAt` resolves to it.
  private checkInput(command: {
    idempotencyKey: string;
    amountMinorUnits: number;
    reference?: string | null;
    paidAt?: Date | null;
  }): CheckedInput {
    const now = new Date();

    // A1
    if (!isCanonicalUuid(command.idempotencyKey)) {
      throw new BadRequestException('The request key must be a UUID.');
    }

    // A2
    if (
      !Number.isInteger(command.amountMinorUnits) ||
      command.amountMinorUnits < 1 ||
      command.amountMinorUnits > MAX_MINOR_UNITS
    ) {
      throw new BadRequestException(
        `The amount must be from ${formatPesos(1)} to ${formatPesos(MAX_MINOR_UNITS)}.`,
      );
    }

    // A3: code points, matching PostgreSQL varchar(120) characters.
    const trimmed = command.reference?.trim() ?? '';
    const reference = trimmed === '' ? null : trimmed;
    if (reference !== null && [...reference].length > MAX_REFERENCE_LENGTH) {
      throw new BadRequestException(
        `The reference must be at most ${MAX_REFERENCE_LENGTH} characters.`,
      );
    }

    // A4
    const supplied = command.paidAt ?? null;
    if (supplied !== null && supplied.getTime() > now.getTime()) {
      throw new BadRequestException(
        'The paid-at time cannot be in the future.',
      );
    }

    return {
      paidAt: supplied ?? now,
      paidAtSupplied: supplied !== null,
      reference,
    };
  }

  // B2: same key in the tenant. A matching request returns the existing row
  // (no write, no audit); any difference is a conflict. `paidAt` is
  // compared only when the request supplied one.
  private async findReplay(
    manager: EntityManager,
    command: { tenantId: string; idempotencyKey: string },
    request: ReplayShape,
  ): Promise<PaymentEntity | null> {
    const existing = await manager.findOne(PaymentEntity, {
      where: {
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
      },
    });
    if (!existing) {
      return null;
    }
    const sameTarget =
      request.type === PaymentType.PAYMENT
        ? existing.invoiceId === request.invoiceId
        : existing.refundedPaymentId === request.refundedPaymentId;
    const matches =
      existing.type === request.type &&
      sameTarget &&
      existing.method === request.method &&
      existing.amountMinorUnits === request.amountMinorUnits &&
      existing.reference === request.reference &&
      (!request.paidAtSupplied ||
        existing.paidAt.getTime() === request.paidAt.getTime());
    if (!matches) {
      throw new ConflictException(KEY_REUSED_MESSAGE);
    }
    return existing;
  }

  // §4.6 steps 3–6: insert (decision p's exact shape), re-derive from every
  // persisted row of the invoice, persist the pair through the port, audit,
  // return the inserted row re-read.
  private async insertAndDerive(
    manager: EntityManager,
    invoice: {
      id: string;
      tenantId: string;
      totalMinorUnits: number;
      paymentStatus: InvoicePaymentStatus;
    },
    command: { actorId: string; tenantId: string; idempotencyKey: string },
    entry: {
      type: PaymentType;
      method: PaymentMethod;
      amountMinorUnits: number;
      reference: string | null;
      paidAt: Date;
      refundedPaymentId: string | null;
      action: 'payment.recorded' | 'payment.refunded';
    },
  ): Promise<Payment> {
    const payment = manager.create(PaymentEntity, {
      invoiceId: invoice.id,
      recordedByStaffId: command.actorId,
      refundedPaymentId: entry.refundedPaymentId,
      tenantId: command.tenantId,
      amountMinorUnits: entry.amountMinorUnits,
      idempotencyKey: command.idempotencyKey,
      method: entry.method,
      paidAt: entry.paidAt,
      reference: entry.reference,
      status: PaymentRecordStatus.COMPLETED,
      type: entry.type,
    });
    try {
      await manager.save(payment);
    } catch (error) {
      // A same-key insert that raced past B2 (possible only across
      // different invoices). Anything else is rethrown unchanged.
      if (isPostgresUniqueViolation(error, IDEMPOTENCY_CONSTRAINT)) {
        throw new ConflictException(KEY_REUSED_MESSAGE);
      }
      throw error;
    }

    const rows = await manager.find(PaymentEntity, {
      where: { tenantId: command.tenantId, invoiceId: invoice.id },
    });
    const derived = deriveInvoicePayment({
      totalMinorUnits: invoice.totalMinorUnits,
      currentStatus: invoice.paymentStatus,
      rows,
    });
    await this.invoicePaymentWriter.applyDerivedPayment(
      manager,
      invoice,
      derived,
    );

    await this.auditLogger.log({
      actorId: command.actorId,
      entityId: payment.id,
      action: entry.action,
      entityType: ENTITY_TYPE,
      ...tenantAuditTags(command.tenantId),
    });

    return manager.findOneByOrFail(PaymentEntity, {
      id: payment.id,
      tenantId: command.tenantId,
    });
  }

  private paymentNotFound(paymentId: string): NotFoundException {
    return new NotFoundException(`Payment ${paymentId} not found`);
  }
}

function netPaid(rows: readonly PaymentEntity[]): number {
  let net = 0;
  for (const row of rows) {
    net +=
      row.type === PaymentType.PAYMENT
        ? row.amountMinorUnits
        : -row.amountMinorUnits;
  }
  return net;
}
