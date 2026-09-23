import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';

// Multi-tenant spec §4.3: the post-migration role enum. `OWNER` is retired,
// not renamed in place — its slot on every `@Roles()` list is taken by
// `TENANT_OWNER`, and `SUPER_ADMIN` is the platform-only role.
describe('Role', () => {
  it('contains exactly the post-migration role set', () => {
    expect(Object.values(Role).sort()).toEqual(
      [
        'ANALYST',
        'CUSTOMER_SUPPORT',
        'FINANCE',
        'OPS_MANAGER',
        'SCHEDULER',
        'SUPER_ADMIN',
        'TENANT_OWNER',
      ].sort(),
    );
  });

  it('no longer contains OWNER', () => {
    expect(Object.values(Role)).not.toContain('OWNER');
  });
});

// Multi-tenant spec §4.1: scope is explicit, never inferred from
// `tenantId IS NULL`.
describe('AdminScope', () => {
  it('is PLATFORM | TENANT', () => {
    expect(Object.values(AdminScope).sort()).toEqual(['PLATFORM', 'TENANT']);
  });
});
