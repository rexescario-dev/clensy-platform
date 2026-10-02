import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Role } from '../../src/platform/auth/domain/role';
import type { GateClient } from './client';
import { describeOutcome, normalizeOutcome, Outcome } from './outcome';
import type {
  CrossTenantVariant,
  MissingForm,
  Prepared,
  Probe,
  ProbeArgs,
} from './probe';
import { ALL_ROLES, ROLE_MATRIX } from './role-matrix';
import type { GateWorld, TenantWorld } from './two-tenant-world';

// #92 runtime phases 3–6 (plan decisions 10–12). Each function returns the
// list of failures (prefixed per decision 4) rather than stopping at the
// first, so one run reports every defect.
export interface GateContext {
  client: GateClient;
  dataSource: DataSource;
  probes: readonly Probe[];
  world: GateWorld;
}

export interface CrossTenantTask {
  preparedOwn: Prepared;
  preparedVictim: Prepared;
  probe: Probe;
  role: Role;
  variant: CrossTenantVariant;
}

let sequence = 0;
function unique(world: GateWorld): string {
  sequence += 1;
  return `${world.run}-call-${sequence}`;
}

function cookieFor(world: GateWorld, tenant: TenantWorld, role: Role): string {
  return role === Role.SUPER_ADMIN
    ? world.superAdminCookie
    : tenant.cookies[role];
}

async function prepare(
  ctx: GateContext,
  probe: Probe,
  tenant: TenantWorld,
): Promise<Prepared> {
  return probe.prepare ? probe.prepare(ctx.world.fixtures, tenant) : {};
}

async function rowTenant(
  ctx: GateContext,
  table: string,
  id: string,
): Promise<string | null> {
  const rows = await ctx.dataSource.query(
    `SELECT "tenantId"::text AS "tenantId" FROM "${table}" WHERE id = $1`,
    [id],
  );
  return rows[0]?.tenantId ?? null;
}

async function ownCount(
  ctx: GateContext,
  table: string,
  tenantId: string,
): Promise<number> {
  const rows = await ctx.dataSource.query(
    `SELECT count(*)::int AS count FROM "${table}" WHERE "tenantId"::text = $1`,
    [tenantId],
  );
  return rows[0].count;
}

async function checkAllowed(
  ctx: GateContext,
  probe: Probe,
  args: ProbeArgs,
  outcome: Outcome,
): Promise<string | null> {
  const declared = probe.domainRejected;
  if (
    declared &&
    outcome.kind === 'ERROR' &&
    outcome.status === declared.status &&
    declared.message.test(outcome.message)
  ) {
    return null;
  }
  if (outcome.kind !== 'OK')
    return `expected OK, got ${describeOutcome(outcome)}`;
  const { ok } = probe;
  if (ok.kind === 'returnsId') {
    return outcome.ids.length === 1 && outcome.ids[0] === ok.id(args)
      ? null
      : `expected id ${ok.id(args)}, got ${describeOutcome(outcome)}`;
  }
  if (ok.kind === 'listIncludes') {
    return outcome.ids.includes(ok.id(args))
      ? null
      : `expected the list to include ${ok.id(args)}, got ${describeOutcome(outcome)}`;
  }
  if (outcome.ids.length !== 1)
    return `expected one created id, got ${describeOutcome(outcome)}`;
  const tenant = await rowTenant(ctx, ok.table, outcome.ids[0]);
  return tenant === args.own.tenantId
    ? null
    : `created ${ok.table} ${outcome.ids[0]} has tenantId ${tenant}, expected ${args.own.tenantId}`;
}

async function matchesMissing(
  ctx: GateContext,
  missing: MissingForm,
  outcome: Outcome,
  foreign: readonly string[],
  attacker: TenantWorld,
): Promise<string | null> {
  switch (missing.kind) {
    case 'null':
      return outcome.kind === 'NULL'
        ? null
        : `expected null, got ${describeOutcome(outcome)}`;
    case 'error':
      return outcome.kind === 'ERROR' && outcome.status === missing.status
        ? null
        : `expected ERROR ${missing.status}, got ${describeOutcome(outcome)}`;
    case 'emptyConnection':
      return outcome.kind === 'OK' &&
        outcome.ids.length === 0 &&
        outcome.totalCount === 0
        ? null
        : `expected an empty connection, got ${describeOutcome(outcome)}`;
    case 'excludes': {
      if (outcome.kind !== 'OK')
        return `expected OK, got ${describeOutcome(outcome)}`;
      const leaked = outcome.ids.filter((id) => foreign.includes(id));
      if (leaked.length > 0)
        return `foreign id(s) returned: ${leaked.join(', ')}`;
      const expected = await ownCount(ctx, missing.table, attacker.tenantId);
      const count = outcome.totalCount ?? outcome.ids.length;
      return count === expected
        ? null
        : `count ${count} != attacker's own ${missing.table} rows ${expected}`;
    }
  }
}

export async function runAuthenticationPhase(
  ctx: GateContext,
): Promise<string[]> {
  const failures: string[] = [];
  for (const probe of ctx.probes) {
    const prepared = await prepare(ctx, probe, ctx.world.a);
    const outcome = await ctx.client.execute(
      null,
      probe.sameTenant({
        own: ctx.world.a,
        prepared,
        unique: unique(ctx.world),
      }),
    );
    if (outcome.kind !== 'UNAUTHENTICATED') {
      failures.push(
        `[authentication] ${probe.key}: expected UNAUTHENTICATED, got ${describeOutcome(outcome)}`,
      );
    }
  }
  return failures;
}

export async function runRolePhase(
  ctx: GateContext,
  actor: TenantWorld,
): Promise<string[]> {
  const failures: string[] = [];
  for (const probe of ctx.probes) {
    const allowed = ROLE_MATRIX[probe.key]?.allowed ?? [];
    for (const role of ALL_ROLES) {
      const args: ProbeArgs = {
        own: actor,
        prepared: await prepare(ctx, probe, actor),
        unique: unique(ctx.world),
      };
      const outcome = await ctx.client.execute(
        cookieFor(ctx.world, actor, role),
        probe.sameTenant(args),
      );
      const problem = allowed.includes(role)
        ? await checkAllowed(ctx, probe, args, outcome)
        : outcome.kind === 'FORBIDDEN'
          ? null
          : `expected FORBIDDEN, got ${describeOutcome(outcome)}`;
      if (problem)
        failures.push(
          `[enforcement] ${probe.key} as ${role} of tenant ${actor.name}: ${problem}`,
        );
    }
  }
  return failures;
}

// Prepares every target first (both tenants), so the caller can snapshot
// after all fixture writes and before any cross-tenant call.
export async function prepareCrossTenant(
  ctx: GateContext,
  attacker: TenantWorld,
  victim: TenantWorld,
): Promise<CrossTenantTask[]> {
  const tasks: CrossTenantTask[] = [];
  for (const probe of ctx.probes) {
    const allowed = (ROLE_MATRIX[probe.key]?.allowed ?? []).filter(
      (role) => role !== Role.SUPER_ADMIN,
    );
    for (const variant of probe.crossTenant) {
      for (const role of allowed) {
        tasks.push({
          preparedOwn: await prepare(ctx, probe, attacker),
          preparedVictim: await prepare(ctx, probe, victim),
          probe,
          role,
          variant,
        });
      }
    }
  }
  return tasks;
}

export async function runCrossTenantPhase(
  ctx: GateContext,
  attacker: TenantWorld,
  victim: TenantWorld,
  tasks: readonly CrossTenantTask[],
): Promise<string[]> {
  const failures: string[] = [];
  for (const { preparedOwn, preparedVictim, probe, role, variant } of tasks) {
    const cookie = cookieFor(ctx.world, attacker, role);
    const base: ProbeArgs = {
      own: attacker,
      prepared: preparedOwn,
      unique: unique(ctx.world),
    };
    const foreign = variant.foreignIds(victim, preparedVictim);
    const where = `[isolation] ${probe.key} "${variant.name}" as ${role} of tenant ${attacker.name}`;
    const actual = await ctx.client.execute(
      cookie,
      variant.call({ ...base, foreign }),
    );
    const problem = await matchesMissing(
      ctx,
      variant.missing,
      actual,
      foreign,
      attacker,
    );
    if (problem) failures.push(`${where}: ${problem}`);
    if (variant.missing.kind !== 'excludes') {
      const control = await ctx.client.execute(
        cookie,
        variant.call({ ...base, foreign: foreign.map(() => randomUUID()) }),
      );
      if (normalizeOutcome(actual) !== normalizeOutcome(control)) {
        failures.push(
          `${where}: distinguishable from a never-existed id — actual ${describeOutcome(actual)}, control ${describeOutcome(control)}`,
        );
      }
    }
  }
  return failures;
}

export async function attackerAuditCount(
  ctx: GateContext,
  attacker: TenantWorld,
): Promise<number> {
  const rows = await ctx.dataSource.query(
    `SELECT count(*)::int AS count FROM "audit_event_entity" WHERE "actorId" = ANY($1)`,
    [attacker.adminIds],
  );
  return rows[0].count;
}
