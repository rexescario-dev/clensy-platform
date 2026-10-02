import { INestApplication } from '@nestjs/common';
import { Role } from '../src/platform/auth/domain/role';
import { AuthGuard } from '../src/platform/auth/guards/auth.guard';
import {
  bootGraphqlSurface,
  collectRootHandlers,
  RootHandler,
  rootFields,
} from './helpers/graphql-surface';
import {
  ROOT_OPERATION_CLASSIFICATION as CLASSIFICATION,
  rootOperationKey as key,
} from './helpers/root-operation-inventory';

// Regression guard for the #90 sweep (decision 7; RFC §4.2/§4.5). Every
// root (operation, field) must be explicitly classified here; a new field
// fails until someone decides its class. This is a metadata check of
// root-operation authentication and roles. It does not prove runtime
// tenant isolation (the module two-tenant suites do) and does not cover
// relation-field RBAC (#106). The classification lives in
// helpers/root-operation-inventory.ts, shared with #92's release gate.

const TENANT_ROLES = new Set<Role>([
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
]);

describe('Root operation authorization (#90 sweep guard)', () => {
  let app: INestApplication;
  let schemaKeys: string[];
  let handlers: Map<string, RootHandler[]>;

  beforeAll(async () => {
    app = await bootGraphqlSurface();
    schemaKeys = rootFields(app).map(({ operation, field }) =>
      key(operation, field),
    );
    handlers = new Map();
    for (const handler of collectRootHandlers(app)) {
      const handlerKey = key(handler.operation, handler.field);
      handlers.set(handlerKey, [...(handlers.get(handlerKey) ?? []), handler]);
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('classifies exactly the live schema root fields, per operation (no unclassified, no stale)', () => {
    expect(schemaKeys).toHaveLength(62);
    expect([...schemaKeys].sort()).toEqual(Object.keys(CLASSIFICATION).sort());
  });

  it('maps every root field to exactly one live handler of the same operation, and no handler to a missing field', () => {
    for (const schemaKey of schemaKeys) {
      expect({
        schemaKey,
        handlers: handlers.get(schemaKey)?.length ?? 0,
      }).toEqual({
        schemaKey,
        handlers: 1,
      });
    }
    expect(
      [...handlers.keys()].filter(
        (handlerKey) => !schemaKeys.includes(handlerKey),
      ),
    ).toEqual([]);
    for (const [handlerKey, [handler]] of handlers) {
      expect({
        handlerKey,
        owner: handler.owner,
        isLiveProvider: handler.isLiveProvider,
      }).toEqual({
        handlerKey,
        owner: handler.owner,
        isLiveProvider: true,
      });
    }
  });

  it('resolves both an inherited nestjs-query handler and an own decorated handler (pinned versions)', () => {
    const [generated] = handlers.get('Query.customers') ?? [];
    expect(generated).toMatchObject({
      owner: 'CustomerReadResolver.queryMany',
      ownMethod: false,
    });
    expect(generated.guards).toContain(AuthGuard);
    expect(generated.roles?.length).toBeGreaterThan(0);

    const [decorated] = handlers.get('Query.customer') ?? [];
    expect(decorated).toMatchObject({
      owner: 'CustomerResolver.customer',
      ownMethod: true,
    });
    expect(decorated.guards).toContain(AuthGuard);
    expect(decorated.roles?.length).toBeGreaterThan(0);
  });

  it('enforces each class: public, authenticated-only, tenant roles without SUPER_ADMIN', () => {
    for (const schemaKey of schemaKeys) {
      const [handler] = handlers.get(schemaKey) ?? [];
      expect({ schemaKey, hasHandler: handler !== undefined }).toEqual({
        schemaKey,
        hasHandler: true,
      });
      if (!handler) continue;
      const roles = handler.roles ?? [];
      const actual = {
        hasAuthGuard: handler.guards.includes(AuthGuard),
        hasRoles: roles.length > 0,
        nonTenantRoles: roles.filter((role) => !TENANT_ROLES.has(role)),
        owner: handler.owner,
        schemaKey,
        superAdmin: roles.includes(Role.SUPER_ADMIN),
      };
      const expected = {
        AUTHENTICATED: {
          hasAuthGuard: true,
          hasRoles: false,
          nonTenantRoles: [],
          superAdmin: false,
        },
        PUBLIC: {
          hasAuthGuard: false,
          hasRoles: false,
          nonTenantRoles: [],
          superAdmin: false,
        },
        TENANT: {
          hasAuthGuard: true,
          hasRoles: true,
          nonTenantRoles: [],
          superAdmin: false,
        },
      }[CLASSIFICATION[schemaKey]];
      expect(actual).toEqual({
        ...expected,
        owner: handler.owner,
        schemaKey,
      });
    }
  });
});
