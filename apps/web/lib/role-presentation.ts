import type { Role } from '@clensy/client';

const ROLE_PRESENTATION: Record<Role, { label: string; initials: string }> = {
  OWNER: { label: 'Owner', initials: 'OW' },
  OPS_MANAGER: { label: 'Ops Manager', initials: 'OM' },
  SCHEDULER: { label: 'Scheduler', initials: 'SC' },
  CUSTOMER_SUPPORT: { label: 'Customer Support', initials: 'CS' },
  FINANCE: { label: 'Finance', initials: 'FI' },
  ANALYST: { label: 'Analyst', initials: 'AN' },
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
