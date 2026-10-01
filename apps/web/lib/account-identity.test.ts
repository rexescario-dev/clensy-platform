import type { AdminScope } from '@clensy/client';
import { describe, expect, it } from 'vitest';
import { accountIdentity } from './account-identity';

describe('accountIdentity', () => {
  it('presents a Super Admin as a platform account', () => {
    expect(accountIdentity({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toEqual({
      initials: 'SA',
      role: 'SUPER_ADMIN',
      scopeKey: 'userMenu.scope.platform',
    });
  });

  it('presents a tenant user as an organization account', () => {
    expect(accountIdentity({ role: 'ANALYST', scope: 'TENANT' })).toEqual({
      initials: 'AN',
      role: 'ANALYST',
      scopeKey: 'userMenu.scope.tenant',
    });
  });

  it('derives the scope line from scope, not from role', () => {
    expect(accountIdentity({ role: 'TENANT_OWNER', scope: 'PLATFORM' })?.scopeKey).toBe('userMenu.scope.platform');
    expect(accountIdentity({ role: 'SUPER_ADMIN', scope: 'TENANT' })?.scopeKey).toBe('userMenu.scope.tenant');
  });

  it('shows no scope line for a scope it does not know, rather than guessing', () => {
    const identity = accountIdentity({ role: 'ANALYST', scope: 'PARTNER' as unknown as AdminScope });
    expect(identity).toEqual({ initials: 'AN', role: 'ANALYST', scopeKey: undefined });
  });

  it('presents no identity without a principal or for an unknown role', () => {
    expect(accountIdentity(undefined)).toBeUndefined();
    expect(accountIdentity(null)).toBeUndefined();
    expect(accountIdentity({ role: 'OWNER', scope: 'TENANT' })).toBeUndefined();
    expect(accountIdentity({ role: '', scope: 'TENANT' })).toBeUndefined();
  });
});
