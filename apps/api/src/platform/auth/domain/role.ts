// Multi-tenant spec §4.3. `SUPER_ADMIN` is `PLATFORM`-scope only; every other
// role is `TENANT`-scope only (enforced by DB CHECKs on `admin_user_entity`).
// The pre-tenancy `OWNER` role is retired — existing rows are converted by
// explicit designation in `AddTenantAndAdminScope`, never renamed in place.
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_OWNER = 'TENANT_OWNER',
  OPS_MANAGER = 'OPS_MANAGER',
  SCHEDULER = 'SCHEDULER',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  FINANCE = 'FINANCE',
  ANALYST = 'ANALYST',
}
