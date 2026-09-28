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
import { Service } from '../../domain/service';

// `name` deliberately has NO `unique` option (Catalog spec §3). Tenant
// ownership (#84): `tenantId` + `fk_service_tenant` are expressed here.
// `AddCatalogTenant` also hand-writes objects this metadata does not
// express, which `migration:generate` may propose dropping — do not apply
// that: `uq_service_id_tenant` (target of the composite
// `fk_pricing_rule_service_tenant`), `uq_service_tenant_name_lower`
// (case-insensitive `("tenantId", LOWER("name"))` expression index — the
// authority behind `ServicesService#assertNameAvailable`),
// `idx_service_tenant_created`.
@Entity()
export class ServiceEntity implements Service {
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
    foreignKeyConstraintName: 'fk_service_tenant',
  })
  tenant!: TenantEntity;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'integer' })
  durationMinutes!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
