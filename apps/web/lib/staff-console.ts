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

interface GraphQLErrorExtensions {
  originalError?: { statusCode?: unknown };
  status?: unknown;
}

// Maps a failed staff mutation to a typed message key by operation + the
// HTTP status Nest attached to the GraphQL error. Never inspects message
// text or the Apollo `code`. Nest puts a status that has a dedicated Apollo
// code (400 BAD_REQUEST, 403 FORBIDDEN) only at
// `extensions.originalError.statusCode`, and others (404, 409) also at
// `extensions.status` — the same two-shape read as the API e2e helpers (e.g.
// apps/api/test/catalog.tenant-isolation.e2e-spec.ts). Read structurally so
// any other error shape (or a non-Apollo throw) degrades to the operation's
// generic key.
export function staffMutationErrorKey(operation: StaffMutation, error: unknown): StaffErrorKey {
  const keys = ERROR_KEYS[operation];
  const extensions = (error as { graphQLErrors?: { extensions?: GraphQLErrorExtensions }[] } | null | undefined)
    ?.graphQLErrors?.[0]?.extensions;
  const status = extensions?.status ?? extensions?.originalError?.statusCode;
  return (typeof status === 'number' && keys[status]) || keys.fallback;
}

// Fills the confirm-disable template's single `{email}` placeholder
// (useClensyTranslations has no interpolation). A function replacer, so an
// email containing `$&`, `$'`, `` $` `` or `$$` — all valid in a local part —
// is inserted literally rather than read as a String.replace pattern.
export function disableConfirmDescription(template: string, email: string): string {
  return template.replace('{email}', () => email);
}
