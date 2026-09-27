import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { Cleaner } from '../../domain/cleaner';
import { TeamEntity } from './team.entity';

// Dual UUID `teamId` + `@ManyToOne` (Booking / Property pattern). Application
// writes keep using the scalar. `team` is persistence-only metadata for
// Relatable. Non-eager, no cascade, no lazy: true.
//
// Tenant ownership (#83): `tenantId` + `fk_cleaner_tenant` are expressed
// here. `team` keeps the relation for Relatable but sets
// `createForeignKeyConstraints: false`: the id-only `fk_cleaner_team` was
// replaced by the hand-written composite `fk_cleaner_team_tenant`
// (`("teamId", "tenantId")` → team `(id, "tenantId")`) in
// `AddTeamCleanerTenant`. That migration also hand-writes
// `uq_cleaner_id_tenant` (target of that composite FK), `uq_cleaner_tenant_email`
// (case-sensitive `("tenantId", "email")`), `idx_cleaner_tenant_created`.
// `migration:generate` may propose dropping these or re-adding an id-only
// FK — do not apply that.
@Entity()
export class CleanerEntity implements Cleaner {
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
    foreignKeyConstraintName: 'fk_cleaner_tenant',
  })
  tenant!: TenantEntity;

  @Column()
  fullName!: string;

  @Column()
  phone!: string;

  @Column()
  email!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  teamId!: string | null;

  @ManyToOne(() => TeamEntity, (team) => team.cleaners, {
    nullable: true,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'teamId' })
  team!: TeamEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
