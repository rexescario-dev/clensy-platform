import { ForbiddenException } from '@nestjs/common';
import { requireTenantId } from '../authorization/require-tenant-id';
import { AdminScope } from '../domain/admin-scope';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';
import { Role } from '../domain/role';

const principal = (tenantId: string | null): AuthenticatedPrincipal => ({
  id: 'u',
  tenantId,
  role: tenantId === null ? Role.SUPER_ADMIN : Role.TENANT_OWNER,
  scope: tenantId === null ? AdminScope.PLATFORM : AdminScope.TENANT,
});

describe('requireTenantId', () => {
  it('returns the tenant id when the principal has one', () => {
    expect(requireTenantId(principal('t-a'))).toBe('t-a');
  });

  it('throws ForbiddenException when the principal has no tenant', () => {
    expect(() => requireTenantId(principal(null))).toThrow(ForbiddenException);
  });
});
