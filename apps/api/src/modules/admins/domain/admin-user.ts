import { AdminScope } from '../../../platform/auth/domain/admin-scope';
import { Role } from '../../../platform/auth/domain/role';

// Plain domain interface for a staff account (spec §4.4, §4.5). `email` is
// always the normalized-lowercase value (see
// `infrastructure/persistence/admin-user.entity.ts`'s unique constraint) —
// callers never need to re-normalize before comparing.
//
// `scope`/`tenantId` (multi-tenant spec §4.1): `PLATFORM` ⇒ `tenantId` null
// and `role = SUPER_ADMIN`; `TENANT` ⇒ `tenantId` set and a tenant role.
export interface AdminUser {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash: string;
  role: Role;
  scope: AdminScope;
  isActive: boolean;
  createdAt: Date;
}
