// Multi-tenant spec §4.1: every `AdminUser` is explicitly either a platform
// principal (Super Admin, no tenant) or a tenant principal (exactly one
// tenant). Clients and servers MUST branch on this value — never infer
// "platform" from `tenantId === null` alone.
export enum AdminScope {
  PLATFORM = 'PLATFORM',
  TENANT = 'TENANT',
}
