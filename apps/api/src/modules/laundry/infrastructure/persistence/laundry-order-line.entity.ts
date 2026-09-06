import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AddOnEntity } from '../../../catalog/infrastructure/persistence/add-on.entity';
import { ServiceEntity } from '../../../catalog/infrastructure/persistence/service.entity';
import { LaundryOrderLine } from '../../domain/laundry-order-line';
import { LaundryOrderEntity } from './laundry-order.entity';
import { LaundryOrderLinePricingSnapshotEmbeddable } from './laundry-order-line-pricing-snapshot.embeddable';

// One priced service/add-on line (spec §4.2). Created only by
// `priceLaundryOrder`, with its frozen snapshot, and never mutated.
//
// Exactly one of `serviceId`/`addOnId` is non-null — a hand-added
// `CHECK (num_nonnulls("serviceId", "addOnId") = 1)` in the migration
// (TypeORM cannot express a multi-column check), backed by an
// application-layer pre-check.
//
// `order`/`service`/`addOn` are dual-scalar + `@ManyToOne` persistence
// metadata (the `BookingEntity` precedent); `LaundryModule` must not
// register `ServiceEntity`/`AddOnEntity` on `forFeature`. The `order`
// relation's inverse (`LaundryOrderEntity.lines`) backs the nested GraphQL
// connection.
@Entity()
export class LaundryOrderLineEntity implements LaundryOrderLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_laundry_order_line_order_id')
  laundryOrderId!: string;

  @ManyToOne(() => LaundryOrderEntity, (order) => order.lines, {
    nullable: false,
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'laundryOrderId',
    foreignKeyConstraintName: 'fk_laundry_order_line_order',
  })
  order!: LaundryOrderEntity;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_laundry_order_line_service_id')
  serviceId!: string | null;

  @ManyToOne(() => ServiceEntity, {
    nullable: true,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'serviceId',
    foreignKeyConstraintName: 'fk_laundry_order_line_service',
  })
  service!: ServiceEntity | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_laundry_order_line_add_on_id')
  addOnId!: string | null;

  @ManyToOne(() => AddOnEntity, {
    nullable: true,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'addOnId',
    foreignKeyConstraintName: 'fk_laundry_order_line_add_on',
  })
  addOn!: AddOnEntity | null;

  @Column(() => LaundryOrderLinePricingSnapshotEmbeddable, { prefix: false })
  pricingSnapshot!: LaundryOrderLinePricingSnapshotEmbeddable;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
