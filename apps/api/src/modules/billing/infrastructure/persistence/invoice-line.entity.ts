import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import { InvoiceLine } from '../../domain/invoice-line';
import { InvoiceEntity } from './invoice.entity';

// One priced line on an invoice (spec §4.2, §4.4). Created only by
// `generateInvoiceFromOrder`, never mutated.
//
// `InvoiceEntity` <-> `InvoiceLineEntity` is a bidirectional relation
// declared with arrow-function (lazy) targets so the metadata resolves
// regardless of file load order — the `LaundryOrderEntity` <->
// `LaundryOrderLineEntity` precedent.
//
// This entity holds NO `serviceId` / `addOnId` / `pricingRuleId` /
// `laundryOrderLineId` column and NO `@ManyToOne` to any catalog entity —
// it is a self-contained historical snapshot. `description` is the catalog
// name frozen at generation; the four pricing fields are verbatim copies of
// the source `LaundryOrderLine.pricingSnapshot`. `id`, `invoiceId`, and
// `createdAt` are billing-owned. `unit` persists via a MODULE-LOCAL Postgres
// enum `invoice_line_unit_enum` (same four `PricingUnit` values), never
// catalog's `pricing_rule_entity_unit_enum` (spec §4.2, §5).
@Entity()
export class InvoiceLineEntity implements InvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_invoice_line_invoice_id')
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.lines, {
    nullable: false,
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'invoiceId',
    foreignKeyConstraintName: 'fk_invoice_line_invoice',
  })
  invoice!: InvoiceEntity;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    type: 'enum',
    enum: PricingUnit,
    enumName: 'invoice_line_unit_enum',
  })
  unit!: PricingUnit;

  @Column({ type: 'integer' })
  rateMinorUnits!: number;

  @Column({ type: 'integer' })
  amountMinorUnits!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
