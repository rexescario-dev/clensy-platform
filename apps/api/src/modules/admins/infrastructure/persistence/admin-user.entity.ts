import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminUser } from '../../domain/admin-user';

// `email` carries a plain unique constraint, not a functional/expression
// index on `lower(email)` — `AdminsService.create`/`LoginService` always
// normalize to lowercase before this column is written or queried, so a
// plain unique constraint on the stored value is sufficient (brief's
// ambiguity resolution). Without it, two rows could share an email and
// `LoginService`'s lookup-by-email step (spec §4.3) would have no
// deterministic match.
@Entity()
export class AdminUserEntity implements AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role })
  role!: Role;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
