import type { Role } from '@clensy/client';

const ROLE_PRESENTATION: Record<Role, { label: string; initials: string }> = {
  ANALYST: { initials: 'AN', label: 'Analyst' },
  CUSTOMER_SUPPORT: { initials: 'CS', label: 'Customer Support' },
  FINANCE: { initials: 'FI', label: 'Finance' },
  OPS_MANAGER: { initials: 'OM', label: 'Ops Manager' },
  SCHEDULER: { initials: 'SC', label: 'Scheduler' },
  SUPER_ADMIN: { initials: 'SA', label: 'Super Admin' },
  TENANT_OWNER: { initials: 'TO', label: 'Tenant Owner' },
};

function isPresentedRole(role: string): role is Role {
  return Object.prototype.hasOwnProperty.call(ROLE_PRESENTATION, role);
}

export function presentRole(
  role: string | null | undefined,
): { label: string; initials: string } | undefined {
  if (!role || !isPresentedRole(role)) return undefined;
  return ROLE_PRESENTATION[role];
}
