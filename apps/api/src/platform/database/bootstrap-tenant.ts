// The single bootstrap tenant (multi-tenant spec §4.7) is inserted by the
// `AddTenantAndAdminScope` migration with this fixed id, so the dev seed and
// e2e helpers can attach users to it without ever inserting a second
// bootstrap row. Never change this value — it is persisted data.
export const BOOTSTRAP_TENANT_ID = 'b0075a4e-6c1e-4d0a-9f3a-6f1e2d7c0001';
