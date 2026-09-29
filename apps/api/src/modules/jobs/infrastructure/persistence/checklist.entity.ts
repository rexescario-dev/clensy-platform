import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { Checklist } from '../../domain/checklist';
import { ChecklistItemEntity } from './checklist-item.entity';

// `items` is persistence-only inverse metadata for Relatable nested
// GraphQL. Not on the domain object. Non-eager, no cascade, no lazy.
//
// Tenant ownership (#86): `tenantId` + `fk_checklist_tenant` are expressed
// here. `jobId` stays a plain column with no relation. The composite
// `fk_checklist_job_tenant` (`("jobId", "tenantId")` → job
// `(id, "tenantId")`, ON DELETE CASCADE) is hand-written in
// `AddJobChecklistTenant`. `migration:generate` may propose dropping it —
// do not apply that.
@Entity()
export class ChecklistEntity implements Checklist {
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
    foreignKeyConstraintName: 'fk_checklist_tenant',
  })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  jobId!: string;

  @OneToMany(() => ChecklistItemEntity, (item) => item.checklist)
  items!: ChecklistItemEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
