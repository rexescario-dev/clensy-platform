// Pure validator for the explicit `OWNER` designation input consumed by
// `AddTenantAndAdminScope` (multi-tenant spec §4.3, §4.7; plan Task 4).
//
// Deliberately uses its own string literals instead of the live `Role` enum:
// a migration's behavior must not change when application enums evolve.

export type OwnerDesignationRole = 'SUPER_ADMIN' | 'TENANT_OWNER';

// One entry per existing `OWNER` row. `role` is typed loosely on purpose —
// the artifact is hand-edited data, and validating it is this module's job.
export interface OwnerDesignationEntry {
  adminUserId: string;
  role: string;
}

const DESIGNATION_ROLES: ReadonlySet<string> = new Set<OwnerDesignationRole>([
  'SUPER_ADMIN',
  'TENANT_OWNER',
]);

export class OwnerDesignationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `OWNER designation is invalid; the migration was aborted before any role enum change:\n- ${problems.join('\n- ')}`,
    );
    this.name = 'OwnerDesignationError';
  }
}

// Returns the designation for every OWNER id, or throws listing every
// problem: an undesignated OWNER, a designation for a non-OWNER id, a
// duplicate designation, or a value other than SUPER_ADMIN / TENANT_OWNER.
// Designation is never inferred from the `OWNER` role itself.
export function validateOwnerDesignations(
  ownerIds: readonly string[],
  designations: readonly OwnerDesignationEntry[],
): Map<string, OwnerDesignationRole> {
  const owners = new Set(ownerIds);
  const problems: string[] = [];
  const result = new Map<string, OwnerDesignationRole>();

  for (const { adminUserId, role } of designations) {
    if (!owners.has(adminUserId)) {
      problems.push(`${adminUserId}: designated but is not an existing OWNER`);
      continue;
    }
    if (result.has(adminUserId)) {
      problems.push(`${adminUserId}: designated more than once`);
      continue;
    }
    if (!DESIGNATION_ROLES.has(role)) {
      problems.push(
        `${adminUserId}: invalid designation ${JSON.stringify(role)} (expected SUPER_ADMIN or TENANT_OWNER)`,
      );
      continue;
    }
    result.set(adminUserId, role as OwnerDesignationRole);
  }

  for (const ownerId of owners) {
    if (!designations.some((entry) => entry.adminUserId === ownerId)) {
      problems.push(`${ownerId}: OWNER has no designation`);
    }
  }

  if (problems.length > 0) {
    throw new OwnerDesignationError(problems);
  }
  return result;
}
