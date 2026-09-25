import { randomUUID } from 'crypto';

// Per-tenant email uniqueness is now enforced at the database level
// (`uq_customer_tenant_email`, #82) — any fixture that creates a customer
// purely to reference it (not to test email identity/uniqueness itself)
// needs a guaranteed-unique address, not a deterministic one. Use this
// ONLY where uniqueness is incidental to the test; a test whose purpose IS
// email identity (duplicate email, update-to-existing email,
// case-insensitive uniqueness, exact-value assertions) MUST keep a
// deterministic address instead, isolated by truncation or a fresh test
// tenant (plan Task 7).
export function uniqueEmail(prefix = 'customer'): string {
  return `${prefix}-${randomUUID()}@example.com`;
}
