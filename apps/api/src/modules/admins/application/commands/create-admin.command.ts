import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';

// `actor` is the full request principal: the new admin's tenant comes from
// it, never from client input (multi-tenant spec §4.3).
export interface CreateAdminCommand {
  actor: AuthenticatedPrincipal;
  email: string;
  password: string;
  role: Role;
}
