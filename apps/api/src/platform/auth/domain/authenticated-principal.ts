import { AdminScope } from './admin-scope';
import { Role } from './role';

// Always re-derived from the database on every request (multi-tenant spec
// §4.1) — the JWT carries only `sub`. `tenantId` is `null` only when
// `scope === PLATFORM`.
export interface AuthenticatedPrincipal {
  id: string;
  tenantId: string | null;
  role: Role;
  scope: AdminScope;
}
