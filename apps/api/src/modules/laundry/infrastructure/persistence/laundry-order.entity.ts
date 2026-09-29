import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { CustomerEntity } from '../../../customers/infrastructure/persistence/customer.entity';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';
import { LaundryOrder } from '../../domain/laundry-order';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderLineEntity } from './laundry-order-line.entity';

// Dual `customerId` scalar + `@ManyToOne` (the `BookingEntity` precedent).
// Application/command code writes the `customerId` scalar; the relation is
// persistence metadata only. `LaundryModule` MUST NOT register
// `CustomerEntity` on `forFeature` — `CustomersModule` stays its sole
// registrant (spec §4.1).
//
// `lines` is persistence-only inverse metadata for the nested GraphQL
// offset connection (the `Checklist.items` precedent). Application code
// never uses this collection. Non-eager, no cascade, no lazy.
//
// `status` only ever changes through a transition validated by
// `LaundryOrderStatusTransitionPolicy` (spec §4.3). `weightGrams` is
// backed by a hand-added `CHECK ("weightGrams" IS NULL OR "weightGrams"
// >= 0)` in the migration (spec §4.8) — defense-in-depth for the
// application-level non-negative-integer rule.
//
// Tenant ownership (#87): `tenantId` + `fk_laundry_order_tenant` are
// expressed here. `customer` keeps the relation for Relatable but sets
// `createForeignKeyConstraints: false`. The composite
// `fk_laundry_order_customer_tenant`, `uq_laundry_order_id_tenant` and
// `idx_laundry_order_tenant_created` are hand-written in
// `AddLaundryBillingTenant`. `migration:generate` may propose dropping them
// or re-adding an id-only FK — do not apply that.
@Entity()
export class LaundryOrderEntity implements LaundryOrder {
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
    foreignKeyConstraintName: 'fk_laundry_order_tenant',
  })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  @Index('IDX_laundry_order_customer_id')
  customerId!: string;

  @ManyToOne(() => CustomerEntity, {
    nullable: false,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column({
    type: 'enum',
    enum: LaundryFulfillmentType,
    enumName: 'laundry_fulfillment_type_enum',
  })
  fulfillmentType!: LaundryFulfillmentType;

  @Column({
    default: LaundryOrderStatus.RECEIVED,
    enum: LaundryOrderStatus,
    enumName: 'laundry_order_status_enum',
    type: 'enum',
  })
  @Index('IDX_laundry_order_status')
  status!: LaundryOrderStatus;

  @Column({ type: 'integer', nullable: true })
  weightGrams!: number | null;

  @Column({ type: 'integer', nullable: true })
  totalMinorUnits!: number | null;

  @OneToMany(() => LaundryOrderLineEntity, (line) => line.order)
  lines!: LaundryOrderLineEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
