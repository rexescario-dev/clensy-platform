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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
