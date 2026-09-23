import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminUser } from '../../domain/admin-user';
import { TenantEntity } from './tenant.entity';

// `email` carries a plain unique constraint, not a functional/expression
// index on `lower(email)` — `AdminsService.create`/`LoginService` always
// normalize to lowercase before this column is written or queried, so a
// plain unique constraint on the stored value is sufficient (brief's
// ambiguity resolution). Without it, two rows could share an email and
// `LoginService`'s lookup-by-email step (spec §4.3) would have no
// deterministic match.
//
// `scope`/`tenantId`/`role` consistency (multi-tenant spec §4.1) is enforced
// by hand-written CHECKs in `AddTenantAndAdminScope`
// (`ck_admin_user_platform_scope`, `ck_admin_user_tenant_scope`) — TypeORM
// entity metadata cannot express that triple. If `migration:generate`
// proposes dropping them, do NOT apply that part (same convention as the
// other hand-added CHECKs in this repo). `scope` uses the shared
// `admin_scope_enum` type that `AuditEventEntity.scope` also uses, so
// identity and audit have one scope vocabulary.
@Entity()
export class AdminUserEntity implements AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @ManyToOne(() => TenantEntity, {
    nullable: true,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenantId',
    foreignKeyConstraintName: 'fk_admin_user_tenant',
  })
  tenant?: TenantEntity | null;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role })
  role!: Role;

  @Column({ type: 'enum', enum: AdminScope, enumName: 'admin_scope_enum' })
  scope!: AdminScope;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
