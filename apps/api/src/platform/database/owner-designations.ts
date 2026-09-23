import { OwnerDesignationEntry } from './owner-designation';

// Explicit designation for every pre-tenancy `OWNER` account (multi-tenant
// spec §4.3, §4.7), consumed as data by `AddTenantAndAdminScope`. Each
// existing `OWNER` id MUST appear exactly once with `SUPER_ADMIN` (platform
// account, no tenant) or `TENANT_OWNER` (Tenant Owner of the bootstrap
// tenant). The migration aborts — leaving `OWNER` in the role enum — if any
// OWNER row is missing, or any entry is extra, duplicated, or invalid.
//
// Empty is correct for a fresh database (no `OWNER` rows). Before running
// the migration against a database that has `OWNER` rows, list them with
//   SELECT id, email FROM admin_user_entity WHERE role = 'OWNER';
// and add one reviewed entry per row, e.g.
//   { adminUserId: '<uuid>', role: 'TENANT_OWNER' },
export const OWNER_DESIGNATIONS: readonly OwnerDesignationEntry[] = [];
