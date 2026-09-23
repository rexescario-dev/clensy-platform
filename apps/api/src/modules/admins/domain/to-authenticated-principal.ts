import { AuthenticatedPrincipal } from '../../../platform/auth/domain/authenticated-principal';
import { AdminUser } from './admin-user';

// The one place an `AdminUser` becomes an `AuthenticatedPrincipal`, shared by
// the per-request identity lookup and login so both always carry the full
// `{ id, role, scope, tenantId }` (multi-tenant spec §4.1).
export function toAuthenticatedPrincipal(
  admin: AdminUser,
): AuthenticatedPrincipal {
  return {
    id: admin.id,
    tenantId: admin.tenantId,
    role: admin.role,
    scope: admin.scope,
  };
}
