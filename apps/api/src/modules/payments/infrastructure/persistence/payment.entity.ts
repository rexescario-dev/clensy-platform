import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { InvoiceEntity } from '../../../billing/infrastructure/persistence/invoice.entity';
import { Payment } from '../../domain/payment';
import { PaymentMethod } from '../../domain/payment-method';
import { PaymentRecordStatus } from '../../domain/payment-record-status';
import { PaymentType } from '../../domain/payment-type';

// One recorded money movement against one invoice (#39 spec §4.2, §4.9).
// Append-only: no `UpdateDateColumn`, and nothing updates or deletes a row.
//
// Entity metadata (modelled by `migration:generate`): the columns, the three
// module-local enums, `fk_payment_tenant`, the real UNIQUE constraint
// `uq_payment_tenant_idempotency_key` (`@Unique`, not
// `@Index({ unique: true })` — the `invoice.entity.ts` precedent) and the
// indexes `idx_payment_tenant_invoice_paid` / `idx_payment_refunded_payment`.
//
// Hand-written in `CreatePayments` (TypeORM metadata cannot express them;
// `migration:generate` may propose dropping them — do not apply that):
//   - `ck_payment_amount_positive` (`"amountMinorUnits" > 0`);
//   - `ck_payment_refund_reference`
//     (`("type" = 'REFUND') = ("refundedPaymentId" IS NOT NULL)`);
//   - `uq_payment_id_invoice_tenant` (`UNIQUE (id, "invoiceId", "tenantId")`),
//     the target of `fk_payment_refunded_payment`;
//   - composite FKs, all `ON DELETE RESTRICT`:
//     `fk_payment_invoice_tenant` (`("invoiceId", "tenantId")` →
//     `invoice_entity (id, "tenantId")`), `fk_payment_refunded_payment`
//     (`("refundedPaymentId", "invoiceId", "tenantId")` →
//     `payment_entity (id, "invoiceId", "tenantId")`: a refund references a
//     payment of the same invoice and tenant) and
//     `fk_payment_recorded_by_staff_tenant` (`("recordedByStaffId",
//     "tenantId")` → `admin_user_entity (id, "tenantId")`, planning decision
//     b);
//   - their targets on other tables: `uq_invoice_id_tenant` and
//     `uq_admin_user_id_tenant`.
//
// `invoice` keeps its relation (`Invoice.payments`) but sets
// `createForeignKeyConstraints: false`; `refundedPaymentId` and
// `recordedByStaffId` are deliberately plain columns with NO relation
// decorator — their real constraints are the composite FKs above. Do not
// "fix" that by adding a decorator. That a refund's original is a
// `COMPLETED` `PAYMENT` is application validation under the invoice lock
// (spec §4.5 B4), not a database constraint.
@Entity()
@Unique('uq_payment_tenant_idempotency_key', ['tenantId', 'idempotencyKey'])
@Index('idx_payment_tenant_invoice_paid', ['tenantId', 'invoiceId', 'paidAt'])
@Index('idx_payment_refunded_payment', ['refundedPaymentId'])
export class PaymentEntity implements Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenantId',
    foreignKeyConstraintName: 'fk_payment_tenant',
  })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.payments, {
    nullable: false,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: InvoiceEntity;

  @Column({ type: 'enum', enum: PaymentType, enumName: 'payment_type_enum' })
  type!: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method_enum',
  })
  method!: PaymentMethod;

  @Column({ type: 'integer' })
  amountMinorUnits!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({
    type: 'enum',
    enum: PaymentRecordStatus,
    enumName: 'payment_record_status_enum',
  })
  status!: PaymentRecordStatus;

  @Column({ type: 'timestamptz' })
  paidAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  refundedPaymentId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  recordedByStaffId!: string | null;

  @Column({ type: 'uuid' })
  idempotencyKey!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
