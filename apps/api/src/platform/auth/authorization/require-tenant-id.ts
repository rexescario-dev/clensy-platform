import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';

// Defense in depth (controller ruling 2): every mutation resolver that calls
// this sits behind `@Roles()` lists that exclude `SUPER_ADMIN`, the only role
// that can carry `tenantId: null` (spec §4.1/§4.3). A null tenant here is
// therefore unreachable in practice — this guards against that invariant
// breaking silently rather than a request path we expect to hit.
export function requireTenantId(principal: AuthenticatedPrincipal): string {
  if (principal.tenantId === null) {
    throw new ForbiddenException();
  }
  return principal.tenantId;
}
