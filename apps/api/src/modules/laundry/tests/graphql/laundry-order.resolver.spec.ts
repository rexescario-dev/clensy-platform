import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { LaundryOrdersService } from '../../application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderResolver } from '../../presentation/graphql/laundry-order.resolver';

const O = Role.OWNER;
const M = Role.OPS_MANAGER;
const S = Role.SCHEDULER;
const C = Role.CUSTOMER_SUPPORT;
const F = Role.FINANCE;
const A = Role.ANALYST;

// Exactly the spec §4.4 RBAC table, hand-copied.
const RBAC: Record<string, Role[]> = {
  laundryOrder: [O, M, S, C, F, A],
  receiveLaundryOrder: [O, M, S, C],
  weighLaundryOrder: [O, M, S],
  priceLaundryOrder: [O, M, S],
  markLaundryOrderAwaitingPayment: [O, M, F, C],
  markLaundryOrderPaid: [O, M, F, C],
  startLaundryProcessing: [O, M, S],
  markLaundryOrderReady: [O, M, S],
  markLaundryOrderAwaitingPickup: [O, M, S],
  markLaundryOrderAwaitingDelivery: [O, M, S],
  completeLaundryOrder: [O, M, S, C],
  cancelLaundryOrder: [O, M, C],
  rejectLaundryOrder: [O, M],
  markLaundryOrderLost: [O, M],
  markLaundryOrderDamaged: [O, M],
  refundLaundryOrder: [O, M, F],
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
        | 'getOrder'
        | 'receive'
        | 'weigh'
        | 'price'
        | 'startProcessing'
        | 'refund'
      >
    >;
    let resolver: LaundryOrderResolver;
    const user = { id: 'actor-9' } as never;
    const order = {
      id: 'o1',
      customerId: 'c1',
      fulfillmentType: LaundryFulfillmentType.PICKUP,
      status: LaundryOrderStatus.RECEIVED,
      weightGrams: null,
      totalMinorUnits: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      service = {
        getOrder: jest.fn(),
        receive: jest.fn().mockResolvedValue(order),
        weigh: jest.fn().mockResolvedValue(order),
        price: jest.fn().mockResolvedValue(order),
        startProcessing: jest.fn().mockResolvedValue(order),
        refund: jest.fn().mockResolvedValue(order),
      };
      resolver = new LaundryOrderResolver(service as never);
    });

    it('laundryOrder returns null for a missing id', async () => {
      service.getOrder.mockResolvedValue(null);
      await expect(resolver.laundryOrder('nope')).resolves.toBeNull();
    });

    it('receiveLaundryOrder threads the actor id into the command', async () => {
      await resolver.receiveLaundryOrder(
        { customerId: 'c1', fulfillmentType: LaundryFulfillmentType.DELIVERY },
        user,
      );
      expect(service.receive).toHaveBeenCalledWith({
        customerId: 'c1',
        fulfillmentType: LaundryFulfillmentType.DELIVERY,
        actorId: 'actor-9',
      });
    });

    it('startLaundryProcessing forwards { actorId, orderId }', async () => {
      await resolver.startLaundryProcessing({ orderId: 'o1' }, user);
      expect(service.startProcessing).toHaveBeenCalledWith({
        actorId: 'actor-9',
        orderId: 'o1',
      });
    });
  });
});
