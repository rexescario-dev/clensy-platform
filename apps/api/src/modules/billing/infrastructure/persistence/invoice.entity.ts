import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerEntity } from '../../../customers/infrastructure/persistence/customer.entity';
import { LaundryOrderEntity } from '../../../laundry/infrastructure/persistence/laundry-order.entity';
import { Invoice } from '../../domain/invoice';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';
import { InvoiceLineEntity } from './invoice-line.entity';

// The billing aggregate (spec §4.2). Generated once from a priced
// `LaundryOrder`; the commercial snapshot is immutable, and
// `amountPaidMinorUnits` / `paymentStatus` are the designated #39 mutation
// surface (#38 writes `0` / `UNPAID` once).
//
// `@Unique('uq_invoice_number' / 'uq_invoice_laundry_order', …)` emit real
// PostgreSQL UNIQUE constraints (visible in `pg_constraint`, driver-reported
// name = the given name) — NOT `@Index(..., { unique: true })`.
// `uq_invoice_laundry_order` is the correctness mechanism for one-invoice-
// per-order (spec §4.3, §4.6); the application pre-check is only a clean
// error for the common case.
//
// The `laundryOrder` / `customer` `@ManyToOne` relations are persistence
// metadata only — `BillingModule` MUST NOT register `LaundryOrderEntity` /
// `CustomerEntity` on any `forFeature` (spec §4.1). There is no relation to
// any `Payment` / `Promotion` / logistics aggregate.
//
// `amountDueMinorUnits` is deliberately NOT a column — it is
// `totalMinorUnits - amountPaidMinorUnits`, resolved on read.
@Entity()
@Unique('uq_invoice_number', ['invoiceNumber'])
@Unique('uq_invoice_laundry_order', ['laundryOrderId'])
export class InvoiceEntity implements Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  invoiceNumber!: string;

  @Column({ type: 'uuid' })
  laundryOrderId!: string;

  @ManyToOne(() => LaundryOrderEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'laundryOrderId',
    foreignKeyConstraintName: 'fk_invoice_laundry_order',
  })
  laundryOrder!: LaundryOrderEntity;

  @Column({ type: 'uuid' })
  @Index('IDX_invoice_customer_id')
  customerId!: string;

  @ManyToOne(() => CustomerEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'customerId',
    foreignKeyConstraintName: 'fk_invoice_customer',
  })
  customer!: CustomerEntity;

  @Column({ type: 'integer' })
  subtotalMinorUnits!: number;

  @Column({ type: 'integer' })
  discountMinorUnits!: number;

  @Column({ type: 'integer' })
  totalMinorUnits!: number;

  @Column({ type: 'integer' })
  amountPaidMinorUnits!: number;

  @Column({
    type: 'enum',
    enum: InvoicePaymentStatus,
    enumName: 'invoice_payment_status_enum',
  })
  @Index('IDX_invoice_payment_status')
  paymentStatus!: InvoicePaymentStatus;

  @Column({
    type: 'enum',
    enum: InvoicePaymentTerms,
    enumName: 'invoice_payment_terms_enum',
  })
  paymentTerms!: InvoicePaymentTerms;

  @Column({ type: 'timestamptz' })
  issueDate!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate!: Date | null;

  @OneToMany(() => InvoiceLineEntity, (line) => line.invoice)
  lines!: InvoiceLineEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
