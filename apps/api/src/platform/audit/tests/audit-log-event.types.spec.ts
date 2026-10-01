import { AdminScope } from '../../auth/domain/admin-scope';
import type { AuditLogEvent } from '../application/audit-logger.port';
import { principalAuditTags, tenantAuditTags } from '../application/audit-tags';

// Type-level contract (#90 decision 3), enforced by
// `pnpm --filter api exec tsc --noEmit`. Each `@ts-expect-error` fails the
// type-check if the line below it ever starts compiling. Compile-time
// shape only — runtime validation lives in `audit-tags.spec.ts`.
const base = { action: 'x', entityId: null, entityType: null };
const TENANT = AdminScope.TENANT;
const PLATFORM = AdminScope.PLATFORM;

function ok(event: AuditLogEvent): AuditLogEvent {
  return event;
}

describe('AuditLogEvent (type-level)', () => {
  it('accepts the tenant variant (helper and principal-derived)', () => {
    const events = [
      ok({ ...base, actorId: 'a1', ...tenantAuditTags('t1') }),
      ok({
        ...base,
        actorId: 'a1',
        ...principalAuditTags({ scope: TENANT, tenantId: 't1' }),
      }),
    ];
    expect(events.map((event) => event.scope)).toEqual([TENANT, TENANT]);
  });

  it('accepts the platform variant (literal and principal-derived)', () => {
    const events = [
      ok({ ...base, actorId: 'a1', scope: PLATFORM, tenantId: null }),
      ok({
        ...base,
        actorId: 'a1',
        ...principalAuditTags({ scope: PLATFORM, tenantId: null }),
      }),
    ];
    expect(events.map((event) => event.scope)).toEqual([PLATFORM, PLATFORM]);
  });

  it('accepts the anonymous variant only without an actor', () => {
    const event = ok({ ...base, actorId: null, scope: null, tenantId: null });
    expect(event.scope).toBeNull();
  });

  it('rejects untagged, inconsistent and actor-bearing anonymous events', () => {
    const widened: { scope: AdminScope; tenantId: string } = {
      scope: TENANT,
      tenantId: 't1',
    };
    const rejected = [
      // @ts-expect-error untagged event
      () => ok({ ...base, actorId: 'a1' }),
      // @ts-expect-error TENANT scope without a tenant
      () => ok({ ...base, actorId: 'a1', scope: TENANT, tenantId: null }),
      // @ts-expect-error PLATFORM scope with a tenant
      () => ok({ ...base, actorId: 'a1', scope: PLATFORM, tenantId: 't1' }),
      // @ts-expect-error an actor cannot use the anonymous variant
      () => ok({ ...base, actorId: 'a1', scope: null, tenantId: null }),
      // @ts-expect-error an actorless event cannot carry a tenant
      () => ok({ ...base, actorId: null, ...tenantAuditTags('t1') }),
      // @ts-expect-error a widened scope is not a valid discriminant
      () => ok({ ...base, actorId: 'a1', ...widened }),
    ];
    expect(rejected).toHaveLength(6);
  });
});
