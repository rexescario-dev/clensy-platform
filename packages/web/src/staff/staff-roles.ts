// Tenant-scope roles a Tenant Owner may assign (multi-tenant spec §4.3).
// Stable identifiers only — display labels live in the `staff` i18n
// namespace. Declared locally (not imported from @clensy/client) to keep
// @clensy/web free of the GraphQL client, as BookingStatus is.
export type StaffRole = 'ANALYST' | 'CUSTOMER_SUPPORT' | 'FINANCE' | 'OPS_MANAGER' | 'SCHEDULER' | 'TENANT_OWNER';

export const STAFF_ROLE_GROUPS: readonly { id: 'owner' | 'staff'; roles: readonly StaffRole[] }[] = [
  { id: 'owner', roles: ['TENANT_OWNER'] },
  { id: 'staff', roles: ['OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'] },
];

export const STAFF_ROLE_OPTIONS: readonly StaffRole[] = STAFF_ROLE_GROUPS.flatMap((group) => group.roles);

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLE_OPTIONS as readonly string[]).includes(role);
}
