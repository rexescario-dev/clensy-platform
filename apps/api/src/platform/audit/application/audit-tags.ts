import { AdminScope } from '../../auth/domain/admin-scope';

// Audit tags (multi-tenant spec §4.6; #90 decisions 3–4). The shapes mirror
// the tenant and platform branches of `ck_audit_event_scope_tenant`; the
// anonymous branch (failed login) has no helper — its one call site writes
// `scope: null, tenantId: null` explicitly.
//
// Runtime boundary (#90 audit invariant 8): `AuditLogEvent` only checks the
// shape at compile time. These helpers reject blank or inconsistent input
// at runtime; the tenant id itself comes from the DB-loaded principal
// (`requireTenantId` for commands), and the DB CHECK is the last safeguard.
export interface TenantAuditTags {
  scope: AdminScope.TENANT;
  tenantId: string;
}

export interface PlatformAuditTags {
  scope: AdminScope.PLATFORM;
  tenantId: null;
}

export type PrincipalAuditTags = PlatformAuditTags | TenantAuditTags;

// Deliberately carries no scope or tenant value in its message.
export class InvalidAuditTagsError extends Error {
  constructor(reason: string) {
    super(`Invalid audit tags: ${reason}`);
    this.name = 'InvalidAuditTagsError';
  }
}

// A DB-loaded identity (login). Rejects any combination the schema forbids
// rather than inferring a scope from `tenantId` (spec §3: scope is explicit).
// A TENANT principal's tenant is validated by `tenantAuditTags`, which also
// rejects `null` at runtime.
export function principalAuditTags(principal: {
  scope: AdminScope;
  tenantId: string | null;
}): PrincipalAuditTags {
  if (principal.scope === AdminScope.TENANT) {
    return tenantAuditTags(principal.tenantId as string);
  }
  if (principal.scope === AdminScope.PLATFORM && principal.tenantId === null) {
    return { scope: AdminScope.PLATFORM, tenantId: null };
  }
  throw new InvalidAuditTagsError(
    'the principal scope and tenant do not form a valid combination',
  );
}

// Business services: `tenantId` is the `requireTenantId`-validated principal
// tenant carried on the command — never client input (spec §4.5).
export function tenantAuditTags(tenantId: string): TenantAuditTags {
  if (!isNonBlankString(tenantId)) {
    throw new InvalidAuditTagsError(
      'a TENANT event needs a non-blank tenant id',
    );
  }
  return { scope: AdminScope.TENANT, tenantId };
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
