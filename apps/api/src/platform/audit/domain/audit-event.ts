import { JsonValue } from './json-value';

// Plain domain interface for an immutable audit record (spec §3). `action`
// is a free-form, namespaced string (e.g. "admin.created"), not a global
// enum, so later modules can add their own actions without touching this
// module (spec §4.6).
export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, JsonValue> | null;
  occurredAt: Date;
}
