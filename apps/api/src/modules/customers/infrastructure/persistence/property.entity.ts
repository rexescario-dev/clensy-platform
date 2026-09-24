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
import { BookingEntity } from '../../../bookings/infrastructure/persistence/booking.entity';
import { CustomerEntity } from './customer.entity';
import { Property } from '../../domain/property';

// Dual UUID `customerId` + `@ManyToOne` (Booking pattern). Application
// writes keep using the scalar. `bookings` / `customer` are persistence-only
// inverse metadata for Relatable. Non-eager, no cascade, no lazy: true.
//
// Tenant ownership (#82): `tenantId` + `fk_property_tenant` are expressed
// here. `customer` keeps the relation for Relatable but sets
// `createForeignKeyConstraints: false`: the id-only `fk_property_customer`
// was replaced by the hand-written composite `fk_property_customer_tenant`
// (`("customerId", "tenantId")` → customer `(id, "tenantId")`) in
// `AddCustomerPropertyTenant`. That migration also hand-writes
// `uq_property_id_tenant` and `idx_property_tenant_customer`.
// `migration:generate` may propose dropping these or re-adding an id-only
// FK — do not apply that.
@Entity()
export class PropertyEntity implements Property {
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
    foreignKeyConstraintName: 'fk_property_tenant',
  })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  @Index()
  customerId!: string;

  @ManyToOne(() => CustomerEntity, (customer) => customer.properties, {
    nullable: false,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column()
  label!: string;

  @Column()
  addressLine1!: string;

  @Column({ type: 'text', nullable: true })
  addressLine2!: string | null;

  @Column()
  city!: string;

  @Column()
  region!: string;

  @Column()
  postalCode!: string;

  @Column({ type: 'text', nullable: true })
  accessNotes!: string | null;

  @OneToMany(() => BookingEntity, (booking) => booking.property)
  bookings!: BookingEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
