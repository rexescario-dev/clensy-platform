import type { AdminScope } from '@clensy/client';
import { ROLE_INITIALS, isAdminRole, type AdminRole } from '@clensy/web';

export interface AccountIdentity {
  initials: string;
  role: AdminRole;
  // Undefined for a scope this build does not know: no scope line rather
  // than a guessed one.
  scopeKey?: 'userMenu.scope.platform' | 'userMenu.scope.tenant';
}

const SCOPE_KEYS: Readonly<Record<AdminScope, NonNullable<AccountIdentity['scopeKey']>>> = {
  PLATFORM: 'userMenu.scope.platform',
  TENANT: 'userMenu.scope.tenant',
};

// The user menu's identity line. The scope line comes from the explicit
// scope, never from role or tenantId (multi-tenant spec §3/§4.1). Display
// only — not authorization. An unknown role presents no identity.
export function accountIdentity(admin: { role: string; scope: AdminScope } | null | undefined): AccountIdentity | undefined {
  if (!admin || !isAdminRole(admin.role)) return undefined;
  return {
    initials: ROLE_INITIALS[admin.role],
    role: admin.role,
    scopeKey: Object.prototype.hasOwnProperty.call(SCOPE_KEYS, admin.scope) ? SCOPE_KEYS[admin.scope] : undefined,
  };
}
