import { STAFF_ROLE_OPTIONS, type StaffRole } from '../staff/staff-roles';

// Every AdminUser role (multi-tenant spec §4.3): the six tenant roles plus
// the platform-scope SUPER_ADMIN. Stable identifiers only — display labels
// live in the `roles` i18n namespace. Declared locally (not imported from
// @clensy/client) to keep @clensy/web free of the GraphQL client.
export type AdminRole = StaffRole | 'SUPER_ADMIN';

export const ADMIN_ROLES: readonly AdminRole[] = [...STAFF_ROLE_OPTIONS, 'SUPER_ADMIN'];

// Fixed per role rather than derived from the translated label, so the
// avatar initials stay stable across locales and label overrides.
export const ROLE_INITIALS: Readonly<Record<AdminRole, string>> = {
  ANALYST: 'AN',
  CUSTOMER_SUPPORT: 'CS',
  FINANCE: 'FI',
  OPS_MANAGER: 'OM',
  SCHEDULER: 'SC',
  SUPER_ADMIN: 'SA',
  TENANT_OWNER: 'TO',
};

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
