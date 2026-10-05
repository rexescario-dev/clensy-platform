import { INestApplication } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { isDeepStrictEqual } from 'util';
import {
  RELABELABLE_ROLES,
  RelabelableRole,
} from '../src/modules/admins/domain/tenant-label-overrides';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import { AuthGuard } from '../src/platform/auth/guards/auth.guard';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { collectRootHandlers, rootFields } from './helpers/graphql-surface';
import {
  HTTP_ROUTE_CLASSIFICATION,
  tenantHttpRouteKeys,
} from './helpers/http-route-inventory';
import { collectDeclaredRoutes } from './helpers/http-surface';
import {
  ROOT_OPERATION_CLASSIFICATION,
  rootOperationKey,
  tenantRootOperationKeys,
} from './helpers/root-operation-inventory';
import { GateClient } from './release-gate/client';
import {
  attackerAuditCount,
  CrossTenantTask,
  GateContext,
  prepareCrossTenant,
  runAuthenticationPhase,
  runCrossTenantPhase,
  runRolePhase,
} from './release-gate/engine';
import { PROBES } from './release-gate/probes';
import { ROLE_MATRIX } from './release-gate/role-matrix';
import {
  discoverTenantTables,
  LAZILY_WRITTEN_TABLES,
  snapshotTenant,
  TenantSnapshot,
  TenantTables,
} from './release-gate/tenant-snapshot';
import {
  buildGateWorld,
  destroyGateWorld,
  GateWorld,
  TenantWorld,
} from './release-gate/two-tenant-world';

// #92 Two-Tenant Isolation Release Gate (RFC §4.2, §4.3, §4.5; plan
// decisions 4–12). The final multi-tenancy release criterion: merging #92
// with this suite passing lifts the "do not provision a second production
// tenant" rule. Run alone with `pnpm --filter api test:e2e:release-gate`.
//
// Failure prefixes: [inventory] a surface escaped the gate; [policy] the
// pinned role matrix drifted from live @Roles(); [authentication] /
// [enforcement] / [isolation] / [integrity] a runtime defect. Out of scope:
// relation-field authorization (relation-field-authorization.e2e-spec.ts,
// #106), UI, query counts.
describe('Two-tenant isolation release gate (#92)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let client: GateClient;
  let world: GateWorld;
  let tables: TenantTables;
  const passed = new Set<string>();

  function requirePassed(...phases: string[]): void {
    const missing = phases.filter((phase) => !passed.has(phase));
    if (missing.length > 0) {
      throw new Error(
        `not run: earlier gate phase(s) failed: ${missing.join(', ')}`,
      );
    }
  }

  function sameKeys(
    label: string,
    actual: string[],
    expected: string[],
  ): string[] {
    const a = new Set(actual);
    const e = new Set(expected);
    return [
      ...[...a]
        .filter((key) => !e.has(key))
        .map((key) => `[inventory] ${label}: unexpected ${key}`),
      ...[...e]
        .filter((key) => !a.has(key))
        .map((key) => `[inventory] ${label}: missing ${key}`),
      ...(actual.length !== a.size
        ? [`[inventory] ${label}: duplicate keys`]
        : []),
    ];
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    client = new GateClient(app);
    world = await buildGateWorld(dataSource, client);
    tables = await discoverTenantTables(dataSource);
  }, 120_000);

  afterAll(async () => {
    try {
      if (dataSource) await destroyGateWorld(dataSource, world);
    } finally {
      await app?.close();
    }
  });

  it('Phase 1a — inventory: live surfaces = classification; tenant classification = role matrix', () => {
    const liveRoot = rootFields(app).map(({ field, operation }) =>
      rootOperationKey(operation, field),
    );
    const liveRoutes = collectDeclaredRoutes(app).map((route) => route.key);
    const matrixKeys = Object.keys(ROLE_MATRIX);
    const failures = [
      ...sameKeys(
        'live GraphQL root fields vs classification',
        liveRoot,
        Object.keys(ROOT_OPERATION_CLASSIFICATION),
      ),
      ...sameKeys(
        'live controller routes vs classification',
        liveRoutes,
        Object.keys(HTTP_ROUTE_CLASSIFICATION),
      ),
      ...sameKeys(
        'tenant surface vs role matrix',
        [...tenantRootOperationKeys(), ...tenantHttpRouteKeys()],
        matrixKeys,
      ),
    ];
    expect(failures).toEqual([]);
    expect(matrixKeys).toHaveLength(64);
    passed.add('1a');
  });

  it('Phase 2 — policy: pinned role matrix = live @Roles(); AuthGuard on all; SUPER_ADMIN nowhere', () => {
    requirePassed('1a');
    const handlers = collectRootHandlers(app);
    const routes = collectDeclaredRoutes(app);
    const failures: string[] = [];
    const sorted = (roles: readonly Role[] | undefined) =>
      [...(roles ?? [])].sort();
    for (const [key, entry] of Object.entries(ROLE_MATRIX)) {
      if (entry.allowed.includes(Role.SUPER_ADMIN)) {
        failures.push(`[policy] ${key}: matrix allows SUPER_ADMIN`);
      }
      const graphqlMatches = handlers.filter(
        (h) => rootOperationKey(h.operation, h.field) === key,
      );
      const routeMatches = routes.filter((route) => route.key === key);
      const matches = [
        ...graphqlMatches.map((h) => ({
          guards: h.guards,
          owner: h.owner,
          roles: h.roles,
        })),
        ...routeMatches.map((r) => ({
          guards: r.guards,
          owner: r.owner,
          roles: r.roles,
        })),
      ];
      if (matches.length !== 1) {
        failures.push(
          `[policy] ${key}: expected exactly one live handler/route, found ${matches.length}`,
        );
        continue;
      }
      const [live] = matches;
      if (!live.guards.includes(AuthGuard)) {
        failures.push(`[policy] ${key} (${live.owner}): AuthGuard missing`);
      }
      if (
        JSON.stringify(sorted(live.roles)) !==
        JSON.stringify(sorted(entry.allowed))
      ) {
        failures.push(
          `[policy] ${key} (${live.owner}): live @Roles ${JSON.stringify(sorted(live.roles))} != pinned ${JSON.stringify(sorted(entry.allowed))} (${entry.source})`,
        );
      }
    }
    expect(failures).toEqual([]);
    passed.add('2');
  });

  it('Fixture — both worlds populate every tenant-owned and child table; no undeclared child table', async () => {
    const failures = tables.undeclaredChildren.map(
      (table) =>
        `[inventory] ${table} references a tenant-owned table but has no tenantId and is not declared in CHILD_TABLES`,
    );
    for (const tenant of [world.a, world.b]) {
      const snapshot = await snapshotTenant(
        dataSource,
        tables,
        tenant.tenantId,
      );
      for (const [table, rows] of Object.entries(snapshot)) {
        if (rows.length === 0 && !(table in LAZILY_WRITTEN_TABLES)) {
          failures.push(
            `[inventory] tenant ${tenant.name}: fixture world has no ${table} row`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
    expect(tables.owned.length).toBeGreaterThanOrEqual(16);
    passed.add('fixture');
  });

  it('Phase 1b — inventory: exactly one probe per tenant operation and route', () => {
    const keys = PROBES.map((probe) => probe.key);
    const failures = [
      ...sameKeys('probes vs tenant surface', keys, [
        ...tenantRootOperationKeys(),
        ...tenantHttpRouteKeys(),
      ]),
      ...PROBES.filter(
        (p) =>
          (p.crossTenant.length === 0) !== (p.noCrossTenantInput !== undefined),
      ).map(
        (p) =>
          `[inventory] ${p.key}: needs cross-tenant variants or a noCrossTenantInput reason (exactly one)`,
      ),
    ];
    expect(failures).toEqual([]);
    passed.add('1b');
  });

  const context = (): GateContext => ({
    client,
    dataSource,
    probes: PROBES,
    world,
  });

  it('Phase 3 — authentication: every tenant operation and route rejects a missing session', async () => {
    requirePassed('1a', '2', 'fixture');
    expect(await runAuthenticationPhase(context())).toEqual([]);
    passed.add('3');
  }, 600_000);

  for (const [label, attackerOf, victimOf, step] of [
    ['A attacks B', (w: GateWorld) => w.a, (w: GateWorld) => w.b, 'AB'],
    [
      'Phase 7 — symmetry: B attacks A',
      (w: GateWorld) => w.b,
      (w: GateWorld) => w.a,
      'BA',
    ],
  ] as const) {
    describe(label, () => {
      let tasks: CrossTenantTask[] = [];
      let before:
        | { attacker: TenantSnapshot; audit: number; victim: TenantSnapshot }
        | undefined;
      const attacker = (): TenantWorld => attackerOf(world);
      const victim = (): TenantWorld => victimOf(world);

      it('Phase 4 — enforcement: 7 roles × every probe on the attacker’s own data', async () => {
        requirePassed('3');
        expect(await runRolePhase(context(), attacker())).toEqual([]);
        passed.add(`4${step}`);
      }, 600_000);

      it('Phase 5 — isolation: every allowed role × every cross-tenant variant answers as missing', async () => {
        requirePassed(`4${step}`);
        tasks = await prepareCrossTenant(context(), attacker(), victim());
        before = {
          attacker: await snapshotTenant(
            dataSource,
            tables,
            attacker().tenantId,
          ),
          audit: await attackerAuditCount(context(), attacker()),
          victim: await snapshotTenant(dataSource, tables, victim().tenantId),
        };
        expect(
          await runCrossTenantPhase(context(), attacker(), victim(), tasks),
        ).toEqual([]);
        passed.add(`5${step}`);
      }, 900_000);

      it('Phase 6 — integrity: Phase 5 changed no row in either tenant and wrote no audit row', async () => {
        requirePassed(`4${step}`);
        if (!before) throw new Error('not run: Phase 5 took no snapshot');
        const failures: string[] = [];
        for (const [who, tenant, snapshot] of [
          ['attacker', attacker(), before.attacker],
          ['victim', victim(), before.victim],
        ] as const) {
          const after = await snapshotTenant(
            dataSource,
            tables,
            tenant.tenantId,
          );
          for (const table of Object.keys(after)) {
            if (
              JSON.stringify(after[table]) !== JSON.stringify(snapshot[table])
            ) {
              failures.push(
                `[integrity] ${who} tenant ${tenant.name}: ${table} changed during cross-tenant calls`,
              );
            }
          }
        }
        const audit = await attackerAuditCount(context(), attacker());
        if (audit !== before.audit) {
          failures.push(
            `[integrity] ${audit - before.audit} audit row(s) written by tenant ${attacker().name} principals during cross-tenant calls`,
          );
        }
        expect(failures).toEqual([]);
        passed.add(`6${step}`);
      }, 120_000);
    });
  }

  // #118 (tenant label overrides spec §4.7 items 1–2, §6.1): each tenant's
  // stored role labels reach only that tenant's principals, through every
  // tenant role; Super Admin receives null. Restores both columns to NULL.
  it('Phase 8 — label overrides: each tenant receives only its own; Super Admin receives null', async () => {
    // Independent of earlier phases (the world is built in beforeAll), so it
    // can run alone with `-t 'Phase 8'`.
    const stored: Readonly<
      Record<'A' | 'B', Readonly<Partial<Record<RelabelableRole, string>>>>
    > = {
      // Every stored label is tenant-specific, and each tenant leaves some
      // roles unset, so a leak in either direction changes a value.
      A: { FINANCE: 'Billing A', SCHEDULER: 'Scheduling A' },
      B: {
        ANALYST: 'Insights B',
        FINANCE: 'Billing B',
        TENANT_OWNER: 'Owners B',
      },
    };
    const query =
      '{ currentAdmin { tenantLabelOverrides { locale roles { ANALYST CUSTOMER_SUPPORT FINANCE OPS_MANAGER SCHEDULER TENANT_OWNER } } } }';
    const overridesFor = async (cookie: string): Promise<unknown> => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', cookie)
        .send({ query });
      return (
        response.body as {
          data?: { currentAdmin?: { tenantLabelOverrides: unknown } };
        }
      ).data?.currentAdmin?.tenantLabelOverrides;
    };
    const failures: string[] = [];
    try {
      for (const tenant of [world.a, world.b]) {
        await dataSource.query(
          `UPDATE "tenant_entity" SET "labelOverrides" = $2::jsonb WHERE "id" = $1`,
          [
            tenant.tenantId,
            JSON.stringify({ en: { roles: stored[tenant.name] } }),
          ],
        );
      }
      for (const tenant of [world.a, world.b]) {
        const expected = {
          locale: 'en',
          roles: Object.fromEntries(
            RELABELABLE_ROLES.map((role) => [
              role,
              stored[tenant.name][role] ?? null,
            ]),
          ),
        };
        for (const role of RELABELABLE_ROLES) {
          const actual = await overridesFor(tenant.cookies[role]);
          if (!isDeepStrictEqual(actual, expected)) {
            failures.push(
              `[isolation] tenant ${tenant.name} ${role}: expected its own labels, got ${JSON.stringify(actual)}`,
            );
          }
        }
      }
      const platform = await overridesFor(world.superAdminCookie);
      if (platform !== null) {
        failures.push(
          `[isolation] SUPER_ADMIN: expected null, got ${JSON.stringify(platform)}`,
        );
      }
    } finally {
      await dataSource.query(
        `UPDATE "tenant_entity" SET "labelOverrides" = NULL WHERE "id" = ANY($1)`,
        [[world.a.tenantId, world.b.tenantId]],
      );
    }
    expect(failures).toEqual([]);
  });
});
