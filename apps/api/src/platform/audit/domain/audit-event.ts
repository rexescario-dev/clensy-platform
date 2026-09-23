import { AdminScope } from '../../auth/domain/admin-scope';
import { JsonValue } from './json-value';

// Plain domain interface for an immutable audit record (spec §3). `action`
// is a free-form, namespaced string (e.g. "admin.created"), not a global
// enum, so later modules can add their own actions without touching this
// module (spec §4.6).
//
// `scope`/`tenantId` (multi-tenant spec §4.6): `TENANT` ⇒ `tenantId` set;
// `PLATFORM` ⇒ `tenantId` null; `null` scope ⇒ no principal (failed login).
export interface AuditEvent {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  scope: AdminScope | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, JsonValue> | null;
  occurredAt: Date;
}
