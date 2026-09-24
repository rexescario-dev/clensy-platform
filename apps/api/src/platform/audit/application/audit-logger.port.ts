import { AdminScope } from '../../auth/domain/admin-scope';
import { JsonValue } from '../domain/json-value';

// The event shape callers pass to `log()` — deliberately not `AuditEvent`
// itself: `id`/`occurredAt` are assigned by persistence, and `metadata` is
// optional here (an event may have none) but stored as `null` at rest.
//
// `scope`/`tenantId` are the acting principal's (multi-tenant spec §4.6).
// Optional so modules whose audit calls are not yet tenant-tagged keep
// compiling — they persist as `null`, i.e. "no principal recorded". The
// tenant-identity slice tags admin and login events; business modules are
// tagged by the later audit sweep.
export interface AuditLogEvent {
  actorId: string | null;
  tenantId?: string | null;
  scope?: AdminScope | null;
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
