import type { AdminScope, Role } from '@clensy/client';
import type { StaffErrorKey } from '@clensy/web';

// UX gate for the staff console. Branches on the explicit scope, never on
// tenantId === null (multi-tenant spec §3/§4.1). Not authorization — the API
// enforces Tenant-Owner-only, same-tenant access regardless (§4.2).
export function canManageStaff(admin: { role: Role; scope: AdminScope } | null | undefined): boolean {
  return admin?.scope === 'TENANT' && admin.role === 'TENANT_OWNER';
}

export type StaffMutation = 'create' | 'disable';

const ERROR_KEYS: Record<StaffMutation, Partial<Record<number, StaffErrorKey>> & { fallback: StaffErrorKey }> = {
  create: { 400: 'invalidInput', 403: 'createForbidden', 409: 'emailInUse', fallback: 'createFailed' },
  disable: { 403: 'disableForbidden', 404: 'accountNotFound', 409: 'lastTenantOwner', fallback: 'disableFailed' },
};

// Maps a failed staff mutation to a typed message key by operation + the
// GraphQL error's `extensions.status` (the HTTP status Nest attaches). Never
// inspects message text. Read structurally so any Apollo error shape (or a
// non-Apollo throw) degrades to the operation's generic key.
export function staffMutationErrorKey(operation: StaffMutation, error: unknown): StaffErrorKey {
  const keys = ERROR_KEYS[operation];
  const status = (error as { graphQLErrors?: { extensions?: { status?: unknown } }[] } | null | undefined)
    ?.graphQLErrors?.[0]?.extensions?.status;
  return (typeof status === 'number' && keys[status]) || keys.fallback;
}
