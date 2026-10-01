import { INestApplication } from '@nestjs/common';
import { Role } from '../src/platform/auth/domain/role';
import { AuthGuard } from '../src/platform/auth/guards/auth.guard';
import {
  bootGraphqlSurface,
  collectRootHandlers,
  RootHandler,
  rootFields,
} from './helpers/graphql-surface';

// Regression guard for the #90 sweep (decision 7; RFC §4.2/§4.5). Every
// root (operation, field) must be explicitly classified here; a new field
// fails until someone decides its class. This is a metadata check of
// root-operation authentication and roles. It does not prove runtime
// tenant isolation (the module two-tenant suites do) and does not cover
// relation-field RBAC (#106).
type RootClass = 'AUTHENTICATED' | 'PUBLIC' | 'TENANT';

// PUBLIC: RFC §4.2 (only login/logout). AUTHENTICATED: any role
// (Admin Foundation §4.9). TENANT: tenant business and tenant staff
// administration — 21 queries and 38 mutations. Keys sorted (lint).
const CLASSIFICATION: Record<string, RootClass> = {
  'Mutation.assignCleanerToTeam': 'TENANT',
  'Mutation.assignTeamToJob': 'TENANT',
  'Mutation.cancelLaundryOrder': 'TENANT',
  'Mutation.completeChecklistItem': 'TENANT',
  'Mutation.completeJob': 'TENANT',
  'Mutation.completeLaundryOrder': 'TENANT',
  'Mutation.createAddOn': 'TENANT',
  'Mutation.createAdmin': 'TENANT',
  'Mutation.createBooking': 'TENANT',
  'Mutation.createCleaner': 'TENANT',
  'Mutation.createCustomer': 'TENANT',
  'Mutation.createJobFromBooking': 'TENANT',
  'Mutation.createPricingRule': 'TENANT',
  'Mutation.createProperty': 'TENANT',
  'Mutation.createService': 'TENANT',
  'Mutation.createTeam': 'TENANT',
  'Mutation.disableAdmin': 'TENANT',
  'Mutation.generateInvoiceFromOrder': 'TENANT',
  'Mutation.login': 'PUBLIC',
  'Mutation.logout': 'PUBLIC',
  'Mutation.markLaundryOrderAwaitingDelivery': 'TENANT',
  'Mutation.markLaundryOrderAwaitingPayment': 'TENANT',
  'Mutation.markLaundryOrderAwaitingPickup': 'TENANT',
  'Mutation.markLaundryOrderDamaged': 'TENANT',
  'Mutation.markLaundryOrderLost': 'TENANT',
  'Mutation.markLaundryOrderPaid': 'TENANT',
  'Mutation.markLaundryOrderReady': 'TENANT',
  'Mutation.priceLaundryOrder': 'TENANT',
  'Mutation.receiveLaundryOrder': 'TENANT',
  'Mutation.refundLaundryOrder': 'TENANT',
  'Mutation.rejectLaundryOrder': 'TENANT',
  'Mutation.removeBooking': 'TENANT',
  'Mutation.startLaundryProcessing': 'TENANT',
  'Mutation.updateAddOn': 'TENANT',
  'Mutation.updateBooking': 'TENANT',
  'Mutation.updateCleaner': 'TENANT',
  'Mutation.updateCustomer': 'TENANT',
  'Mutation.updateProperty': 'TENANT',
  'Mutation.updateService': 'TENANT',
  'Mutation.weighLaundryOrder': 'TENANT',
  'Query.activePricing': 'TENANT',
  'Query.addOns': 'TENANT',
  'Query.admins': 'TENANT',
  'Query.booking': 'TENANT',
  'Query.bookings': 'TENANT',
  'Query.cleaner': 'TENANT',
  'Query.cleaners': 'TENANT',
  'Query.currentAdmin': 'AUTHENTICATED',
  'Query.customer': 'TENANT',
  'Query.customerProperties': 'TENANT',
  'Query.customers': 'TENANT',
  'Query.invoice': 'TENANT',
  'Query.invoices': 'TENANT',
  'Query.job': 'TENANT',
  'Query.jobs': 'TENANT',
  'Query.laundryOrder': 'TENANT',
  'Query.laundryOrders': 'TENANT',
  'Query.property': 'TENANT',
  'Query.service': 'TENANT',
  'Query.services': 'TENANT',
  'Query.team': 'TENANT',
  'Query.teams': 'TENANT',
};

const TENANT_ROLES = new Set<Role>([
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
]);

const key = (operation: string, field: string) => `${operation}.${field}`;

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
