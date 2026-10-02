import { INestApplication } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
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
import { ROLE_MATRIX } from './release-gate/role-matrix';
import {
  discoverTenantTables,
  LAZILY_WRITTEN_TABLES,
  snapshotTenant,
  TenantTables,
} from './release-gate/tenant-snapshot';
import {
  buildGateWorld,
  destroyGateWorld,
  GateWorld,
} from './release-gate/two-tenant-world';

// #92 Two-Tenant Isolation Release Gate (RFC §4.2, §4.3, §4.5; plan
// decisions 4–12). The final multi-tenancy release criterion: merging #92
// with this suite passing lifts the "do not provision a second production
// tenant" rule. Run alone with `pnpm --filter api test:e2e:release-gate`.
//
// Failure prefixes: [inventory] a surface escaped the gate; [policy] the
// pinned role matrix drifted from live @Roles(); [authentication] /
// [enforcement] / [isolation] / [integrity] a runtime defect. Out of scope:
// relation-field RBAC (#106), UI, query counts.
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
});
