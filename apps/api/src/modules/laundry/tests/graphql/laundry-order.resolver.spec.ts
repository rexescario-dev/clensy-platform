import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { LaundryOrdersService } from '../../application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderResolver } from '../../presentation/graphql/laundry-order.resolver';

const O = Role.TENANT_OWNER;
const M = Role.OPS_MANAGER;
const S = Role.SCHEDULER;
const C = Role.CUSTOMER_SUPPORT;
const F = Role.FINANCE;
const A = Role.ANALYST;

// Exactly the spec §4.4 RBAC table, hand-copied.
const RBAC: Record<string, Role[]> = {
  cancelLaundryOrder: [O, M, C],
  completeLaundryOrder: [O, M, S, C],
  laundryOrder: [O, M, S, C, F, A],
  markLaundryOrderAwaitingDelivery: [O, M, S],
  markLaundryOrderAwaitingPayment: [O, M, F, C],
  markLaundryOrderAwaitingPickup: [O, M, S],
  markLaundryOrderDamaged: [O, M],
  markLaundryOrderLost: [O, M],
  markLaundryOrderPaid: [O, M, F, C],
  markLaundryOrderReady: [O, M, S],
  priceLaundryOrder: [O, M, S],
  receiveLaundryOrder: [O, M, S, C],
  refundLaundryOrder: [O, M, F],
  rejectLaundryOrder: [O, M],
  startLaundryProcessing: [O, M, S],
  weighLaundryOrder: [O, M, S],
};

function methodRef(name: string): (...args: unknown[]) => unknown {
  return Object.getOwnPropertyDescriptor(LaundryOrderResolver.prototype, name)!
    .value as (...args: unknown[]) => unknown;
}

describe('LaundryOrderResolver', () => {
  const reflector = new Reflector();

  describe.each(Object.entries(RBAC))('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')})`, () => {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) ??
        []) as unknown[];
      expect(guards).toContain(AuthGuard);
      expect(reflector.get<Role[]>(ROLES_KEY, methodRef(method))).toEqual(
        expectedRoles,
      );
    });
  });

  describe('delegation', () => {
    let service: jest.Mocked<
      Pick<
        LaundryOrdersService,
        | 'cancel'
        | 'complete'
        | 'getOrder'
        | 'markAwaitingDelivery'
        | 'markAwaitingPayment'
        | 'markAwaitingPickup'
        | 'markDamaged'
        | 'markLost'
        | 'markPaid'
        | 'markReady'
        | 'price'
        | 'receive'
        | 'refund'
        | 'reject'
        | 'startProcessing'
        | 'weigh'
      >
    >;
    let resolver: LaundryOrderResolver;
    const user = { id: 'actor-9', tenantId: 'tenant-9' } as never;
    const principal: AuthenticatedPrincipal = {
      id: 'u',
      tenantId: 't-a',
      role: Role.OPS_MANAGER,
      scope: AdminScope.TENANT,
    };
    const noTenant: AuthenticatedPrincipal = { ...principal, tenantId: null };
    const order = {
      id: 'o1',
      customerId: 'c1',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      fulfillmentType: LaundryFulfillmentType.PICKUP,
      status: LaundryOrderStatus.RECEIVED,
      totalMinorUnits: null,
      updatedAt: new Date(),
      weightGrams: null,
    };

    beforeEach(() => {
      service = {
        cancel: jest.fn().mockResolvedValue(order),
        complete: jest.fn().mockResolvedValue(order),
        getOrder: jest.fn(),
        markAwaitingDelivery: jest.fn().mockResolvedValue(order),
        markAwaitingPayment: jest.fn().mockResolvedValue(order),
        markAwaitingPickup: jest.fn().mockResolvedValue(order),
        markDamaged: jest.fn().mockResolvedValue(order),
        markLost: jest.fn().mockResolvedValue(order),
        markPaid: jest.fn().mockResolvedValue(order),
        markReady: jest.fn().mockResolvedValue(order),
        price: jest.fn().mockResolvedValue(order),
        receive: jest.fn().mockResolvedValue(order),
        refund: jest.fn().mockResolvedValue(order),
        reject: jest.fn().mockResolvedValue(order),
        startProcessing: jest.fn().mockResolvedValue(order),
        weigh: jest.fn().mockResolvedValue(order),
      };
      resolver = new LaundryOrderResolver(service as never);
    });

    it('laundryOrder looks the order up in the principal’s tenant', async () => {
      service.getOrder.mockResolvedValue(null);
      await expect(
        resolver.laundryOrder('nope', principal),
      ).resolves.toBeNull();
      expect(service.getOrder).toHaveBeenCalledWith('nope', 't-a');
    });

    it('laundryOrder with a tenant-less principal passes a null tenant', async () => {
      service.getOrder.mockResolvedValue(null);
      await expect(resolver.laundryOrder('o1', noTenant)).resolves.toBeNull();
      expect(service.getOrder).toHaveBeenCalledWith('o1', null);
    });

    // All 15 `LaundryOrderResolver` mutations (#87 slice decision 8): each
    // passes `requireTenantId(principal)`, and a tenant-less principal is
    // Forbidden before the service is called.
    const ref = { orderId: 'o1' };
    const MUTATIONS: Array<
      [
        string,
        keyof typeof service,
        (p: AuthenticatedPrincipal) => Promise<unknown>,
      ]
    > = [
      [
        'cancelLaundryOrder',
        'cancel',
        (p) => resolver.cancelLaundryOrder(ref, p),
      ],
      [
        'completeLaundryOrder',
        'complete',
        (p) => resolver.completeLaundryOrder(ref, p),
      ],
      [
        'markLaundryOrderAwaitingDelivery',
        'markAwaitingDelivery',
        (p) => resolver.markLaundryOrderAwaitingDelivery(ref, p),
      ],
      [
        'markLaundryOrderAwaitingPayment',
        'markAwaitingPayment',
        (p) => resolver.markLaundryOrderAwaitingPayment(ref, p),
      ],
      [
        'markLaundryOrderAwaitingPickup',
        'markAwaitingPickup',
        (p) => resolver.markLaundryOrderAwaitingPickup(ref, p),
      ],
      [
        'markLaundryOrderDamaged',
        'markDamaged',
        (p) => resolver.markLaundryOrderDamaged(ref, p),
      ],
      [
        'markLaundryOrderLost',
        'markLost',
        (p) => resolver.markLaundryOrderLost(ref, p),
      ],
      [
        'markLaundryOrderPaid',
        'markPaid',
        (p) => resolver.markLaundryOrderPaid(ref, p),
      ],
      [
        'markLaundryOrderReady',
        'markReady',
        (p) => resolver.markLaundryOrderReady(ref, p),
      ],
      [
        'priceLaundryOrder',
        'price',
        (p) =>
          resolver.priceLaundryOrder(
            { ...ref, baseServiceId: 's-a', addOns: [] },
            p,
          ),
      ],
      [
        'receiveLaundryOrder',
        'receive',
        (p) =>
          resolver.receiveLaundryOrder(
            {
              customerId: 'c1',
              fulfillmentType: LaundryFulfillmentType.PICKUP,
            },
            p,
          ),
      ],
      [
        'refundLaundryOrder',
        'refund',
        (p) => resolver.refundLaundryOrder(ref, p),
      ],
      [
        'rejectLaundryOrder',
        'reject',
        (p) => resolver.rejectLaundryOrder(ref, p),
      ],
      [
        'startLaundryProcessing',
        'startProcessing',
        (p) => resolver.startLaundryProcessing(ref, p),
      ],
      [
        'weighLaundryOrder',
        'weigh',
        (p) => resolver.weighLaundryOrder({ ...ref, weightGrams: 1000 }, p),
      ],
    ];

    it('covers every @Mutation on LaundryOrderResolver', () => {
      const mutationNames = Object.keys(RBAC).filter(
        (name) => name !== 'laundryOrder',
      );
      expect(MUTATIONS.map(([name]) => name).sort()).toEqual(
        mutationNames.sort(),
      );
      expect(MUTATIONS).toHaveLength(15);
    });

    it.each(MUTATIONS)(
      '%s passes requireTenantId(principal)',
      async (_name, method, call) => {
        await call(principal);
        expect(service[method]).toHaveBeenCalledWith(
          expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
        );
      },
    );

    it.each(MUTATIONS)(
      '%s with a tenant-less principal is Forbidden before the service is called',
      async (_name, method, call) => {
        await expect(call(noTenant)).rejects.toThrow(ForbiddenException);
        expect(service[method]).not.toHaveBeenCalled();
      },
    );

    it('receiveLaundryOrder threads the actor id into the command', async () => {
      await resolver.receiveLaundryOrder(
        { customerId: 'c1', fulfillmentType: LaundryFulfillmentType.DELIVERY },
        user,
      );
      expect(service.receive).toHaveBeenCalledWith({
        actorId: 'actor-9',
        customerId: 'c1',
        tenantId: 'tenant-9',
        fulfillmentType: LaundryFulfillmentType.DELIVERY,
      });
    });

    it('startLaundryProcessing forwards { actorId, orderId }', async () => {
      await resolver.startLaundryProcessing({ orderId: 'o1' }, user);
      expect(service.startProcessing).toHaveBeenCalledWith({
        actorId: 'actor-9',
        orderId: 'o1',
        tenantId: 'tenant-9',
      });
    });

    it('priceLaundryOrder passes requireTenantId(principal)', async () => {
      service.price.mockResolvedValue(order);
      await resolver.priceLaundryOrder(
        { orderId: 'o-1', baseServiceId: 's-a', addOns: [] },
        principal,
      );
      expect(service.price).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
      );
    });

    it('priceLaundryOrder with a tenant-less principal is Forbidden before the service is called', async () => {
      await expect(
        resolver.priceLaundryOrder(
          { orderId: 'o-1', baseServiceId: 's-a', addOns: [] },
          noTenant,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.price).not.toHaveBeenCalled();
    });
  });
});
