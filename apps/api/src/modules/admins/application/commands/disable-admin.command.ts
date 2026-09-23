import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';

export interface DisableAdminCommand {
  actor: AuthenticatedPrincipal;
  targetId: string;
}
