import { JsonValue } from '../domain/json-value';
import type { PlatformAuditTags, TenantAuditTags } from './audit-tags';

interface AuditEventFields {
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata?: Record<string, JsonValue>;
}

// The event shape callers pass to `log()` — deliberately not `AuditEvent`
// itself: `id`/`occurredAt` are assigned by persistence, and `metadata` is
// optional here (an event may have none) but stored as `null` at rest.
//
// Discriminated on `scope`, mirroring `ck_audit_event_scope_tenant`
// (multi-tenant spec §4.6; #90 decision 3): a tenant event names its
// tenant, a platform event has none, and only an actorless event (failed
// login) may omit both. This is a compile-time shape check only: build
// tags with `tenantAuditTags` / `principalAuditTags` (`./audit-tags`),
// which validate at runtime. The DB CHECK stays the last safeguard, but
// best-effort writes swallow its violations.
export type AuditLogEvent =
  | (AuditEventFields & { actorId: null; scope: null; tenantId: null })
  | (AuditEventFields & PlatformAuditTags & { actorId: string })
  | (AuditEventFields & TenantAuditTags & { actorId: string });

// Application-facing port (spec §5.3): calling modules depend on this
// interface/token, never on `platform/audit`'s concrete persistence
// implementation. `log()` is the entire public surface — no second method,
// and no way for a caller to select best-effort vs. transactional behavior:
// the implementation detects that context itself (see
// `infrastructure/audit-logger.service.ts`).
export interface AuditLogger {
  log(event: AuditLogEvent): Promise<void>;
}

export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');
