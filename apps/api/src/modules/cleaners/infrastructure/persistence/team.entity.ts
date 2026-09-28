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
import { Team } from '../../domain/team';
import { CleanerEntity } from './cleaner.entity';

// `cleaners` is persistence-only inverse metadata for Relatable nested
// GraphQL. Not on the domain object; application writes MUST NOT read or
// assign it. Non-eager, no cascade, no lazy: true.
//
// Tenant ownership (#83): `tenantId` + `fk_team_tenant` are expressed here.
// `AddTeamCleanerTenant` also hand-writes objects this metadata does not
// express, which `migration:generate` may propose dropping — do not apply
// that: `uq_team_id_tenant` (target of the composite
// `fk_cleaner_team_tenant`), `uq_team_tenant_name` (case-sensitive
// `("tenantId", "name")`), `idx_team_tenant_created`.
@Entity()
export class TeamEntity implements Team {
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
    foreignKeyConstraintName: 'fk_team_tenant',
  })
  tenant!: TenantEntity;

  @Column()
  name!: string;

  @OneToMany(() => CleanerEntity, (cleaner) => cleaner.team)
  cleaners!: CleanerEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
