import { JsonValue } from '../domain/json-value';

// The event shape callers pass to `log()` — deliberately not `AuditEvent`
// itself: `id`/`occurredAt` are assigned by persistence, and `metadata` is
// optional here (an event may have none) but stored as `null` at rest.
export interface AuditLogEvent {
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata?: Record<string, JsonValue>;
}

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
