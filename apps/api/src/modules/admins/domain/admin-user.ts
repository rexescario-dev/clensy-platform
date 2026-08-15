import { Role } from '../../../platform/auth/domain/role';

// Plain domain interface for a staff account (spec §4.4, §4.5). `email` is
// always the normalized-lowercase value (see
// `infrastructure/persistence/admin-user.entity.ts`'s unique constraint) —
// callers never need to re-normalize before comparing.
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}
