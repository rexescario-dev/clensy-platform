import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../domain/tenant';

// Kept next to `AdminUserEntity` because `modules/admins` owns identity
// (plan Task 2) — there is intentionally no `modules/tenants` GraphQL API.
// The single bootstrap row is inserted by `AddTenantAndAdminScope`
// (`BOOTSTRAP_TENANT_ID`), never by seeds or tests.
@Entity()
export class TenantEntity implements Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // Tenant label overrides spec §4.1, §4.2: raw, untrusted jsonb. With
  // `select: false`, an ordinary TenantEntity load never reads it; only
  // TenantLabelOverridesService selects it, and only through the validator.
  // Deliberately not part of the `Tenant` domain interface.
  @Column({ type: 'jsonb', nullable: true, select: false })
  labelOverrides!: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
