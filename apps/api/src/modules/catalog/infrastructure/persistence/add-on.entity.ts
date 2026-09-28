import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { AddOn } from '../../domain/add-on';

// `name` deliberately has NO `unique` option (Catalog spec §3). Tenant
// ownership (#84): `tenantId` + `fk_add_on_tenant` are expressed here.
// `AddCatalogTenant` also hand-writes objects this metadata does not
// express, which `migration:generate` may propose dropping — do not apply
// that: `uq_add_on_id_tenant` (target of the composite
// `fk_pricing_rule_add_on_tenant`), `uq_add_on_tenant_name_lower`
// (case-insensitive `("tenantId", LOWER("name"))` expression index — the
// authority behind `AddOnsService#assertNameAvailable`),
// `idx_add_on_tenant_created`. Same reasoning as `ServiceEntity`.
@Entity()
export class AddOnEntity implements AddOn {
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
    foreignKeyConstraintName: 'fk_add_on_tenant',
  })
  tenant!: TenantEntity;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'integer' })
  priceMinorUnits!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
