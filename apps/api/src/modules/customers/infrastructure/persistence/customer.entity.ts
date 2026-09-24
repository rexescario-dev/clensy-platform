import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { PropertyEntity } from './property.entity';
import { Customer } from '../../domain/customer';

// `properties` is persistence-only inverse metadata for Relatable nested
// GraphQL. Not on the domain object; application writes MUST NOT read or
// assign it. Non-eager, no cascade, no lazy: true.
//
// Tenant ownership (#82): `tenantId` + `fk_customer_tenant` are expressed
// here. `AddCustomerPropertyTenant` also hand-writes objects this metadata
// does not express, which `migration:generate` may propose dropping — do
// not apply that: `uq_customer_id_tenant` (target of the composite
// `fk_property_customer_tenant`), `uq_customer_tenant_email` (unique on
// `("tenantId", lower(email))`), `idx_customer_tenant_created`.
@Entity()
export class CustomerEntity implements Customer {
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
    foreignKeyConstraintName: 'fk_customer_tenant',
  })
  tenant!: TenantEntity;

  @Column()
  fullName!: string;

  @Column()
  email!: string;

  @Column()
  phone!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => PropertyEntity, (property) => property.customer)
  properties!: PropertyEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
