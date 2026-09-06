import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { AddOnEntity } from '../src/modules/catalog/infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { TeamEntity } from '../src/modules/cleaners/infrastructure/persistence/team.entity';
import { CleanerEntity } from '../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { LaundryOrdersService } from '../src/modules/laundry/application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../src/modules/laundry/domain/laundry-order-status';
import { LaundryOrderStatusTransitionPolicy } from '../src/modules/laundry/domain/laundry-order-status-transition-policy';
import { LaundryOrderEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order-line.entity';
import {
  acquireLaundryDbTestLock,
  LaundryDbTestLock,
} from './helpers/laundry-db-test-lock';

// The customer/property -> booking -> team -> cleaner inverse chain must be
// registered together for TypeORM metadata to resolve (the
// `jobs.service.e2e-spec.ts` precedent) even though this suite only writes
// laundry + catalog + customer rows.
const ENTITIES = [
  LaundryOrderEntity,
  LaundryOrderLineEntity,
  CustomerEntity,
  PropertyEntity,
  BookingEntity,
  ServiceEntity,
  AddOnEntity,
  PricingRuleEntity,
  TeamEntity,
  CleanerEntity,
  AuditEventEntity,
];

const makeDataSource = () =>
  new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'clensy',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    database: process.env.DB_NAME ?? 'clensy',
    entities: ENTITIES,
  });

const TRUNCATE =
  'TRUNCATE TABLE "laundry_order_line_entity", "laundry_order_entity", "booking_entity", "pricing_rule_entity", "add_on_entity", "service_entity", "customer_entity", "property_entity", "team_entity", "audit_event_entity" CASCADE';

interface AuditLoggerMock {
  log: jest.Mock;
}

function buildLaundryService(
  ds: DataSource,
  auditLogger: AuditLoggerMock,
): {
  laundry: LaundryOrdersService;
  customers: CustomersService;
  services: ServicesService;
  addOns: AddOnsService;
  pricing: PricingRulesService;
} {
  const customers = new CustomersService(
    ds,
    ds.getRepository(CustomerEntity),
    auditLogger,
  );
  const services = new ServicesService(
    ds,
    ds.getRepository(ServiceEntity),
    auditLogger,
  );
  const addOns = new AddOnsService(
    ds,
    ds.getRepository(AddOnEntity),
    auditLogger,
  );
  const pricing = new PricingRulesService(
    ds,
    ds.getRepository(PricingRuleEntity),
    ds.getRepository(ServiceEntity),
    auditLogger,
  );
  const laundry = new LaundryOrdersService(
    ds,
    ds.getRepository(LaundryOrderEntity),
    ds.getRepository(LaundryOrderLineEntity),
    new LaundryOrderStatusTransitionPolicy(),
    customers,
    pricing,
    auditLogger,
  );
  return { laundry, customers, services, addOns, pricing };
}

describe('LaundryOrdersService (real Postgres)', () => {
  let dsA: DataSource;
  let dsB: DataSource;
  let dbLock: LaundryDbTestLock;
  let auditA: AuditLoggerMock;
  let svc: ReturnType<typeof buildLaundryService>;

  beforeAll(async () => {
    dsA = makeDataSource();
    dsB = makeDataSource();
    await dsA.initialize();
    await dsB.initialize();
    dbLock = await acquireLaundryDbTestLock(dsA);
  });

  afterAll(async () => {
    await dbLock.release();
    await dsA.destroy();
    await dsB.destroy();
  });

  beforeEach(async () => {
    await dsA.query(TRUNCATE);
    auditA = { log: jest.fn().mockResolvedValue(undefined) };
    svc = buildLaundryService(dsA, auditA);
  });

  async function fixture(opts?: {
    servicePrice?: number;
    serviceUnit?: PricingUnit;
    serviceMinCharge?: number;
    addOnPrice?: number;
  }) {
    const customer = await svc.customers.create({
      actorId: 'actor-1',
      fullName: 'Jane Doe',
      email: `jane-${Date.now()}-${Math.random()}@example.com`,
      phone: '555-0100',
    });
    const service = await svc.services.createService({
      actorId: 'actor-1',
      name: `Wash & Fold ${Date.now()}-${Math.random()}`,
      durationMinutes: 1,
    });
    await svc.pricing.createPricingRule({
      actorId: 'actor-1',
      serviceId: service.id,
      priceMinorUnits: opts?.servicePrice ?? 1500,
      unit: opts?.serviceUnit ?? PricingUnit.PER_KG,
      minimumChargeMinorUnits: opts?.serviceMinCharge,
    });
    const addOn = await svc.addOns.createAddOn({
      actorId: 'actor-1',
      name: `Same-Day ${Date.now()}-${Math.random()}`,
      priceMinorUnits: 800,
    });
    await svc.pricing.createPricingRule({
      actorId: 'actor-1',
      addOnId: addOn.id,
      priceMinorUnits: opts?.addOnPrice ?? 800,
      unit: PricingUnit.FLAT,
    });
    return { customer, service, addOn };
  }

  // The audit mock is shared with the catalog/customer fixture services, so
  // filter to this module's events.
  const actions = () =>
    (auditA.log.mock.calls as Array<[{ action: string }]>)
      .map((c) => c[0].action)
      .filter((a) => a.startsWith('laundry_order.'));

  it('runs the full intake -> completed golden path with correct line pricing and audit trail', async () => {
    const { customer, service, addOn } = await fixture({
      servicePrice: 1500,
      serviceUnit: PricingUnit.PER_KG,
      serviceMinCharge: 500,
      addOnPrice: 800,
    });

    let order = await svc.laundry.receive({
      actorId: 'actor-1',
      customerId: customer.id,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    expect(order.status).toBe(LaundryOrderStatus.RECEIVED);

    order = await svc.laundry.weigh({
      actorId: 'actor-1',
      orderId: order.id,
      weightGrams: 2350,
    });
    expect(order.status).toBe(LaundryOrderStatus.WEIGHED);
    expect(order.weightGrams).toBe(2350);

    order = await svc.laundry.price({
      actorId: 'actor-1',
      orderId: order.id,
      baseServiceId: service.id,
      addOns: [{ addOnId: addOn.id }],
    });
    expect(order.status).toBe(LaundryOrderStatus.PRICED);
    // 2350 g * 1500 / 1000 = 3525 (floor 500 not applied) ; + FLAT 800
    expect(order.totalMinorUnits).toBe(4325);

    const lines = await dsA.getRepository(LaundryOrderLineEntity).find({
      where: { laundryOrderId: order.id },
      order: { createdAt: 'ASC' },
    });
    expect(lines).toHaveLength(2);
    const base = lines.find((l) => l.serviceId === service.id)!;
    expect(base.pricingSnapshot).toEqual(
      expect.objectContaining({
        rateMinorUnits: 1500,
        unit: PricingUnit.PER_KG,
        quantity: 2350,
        amountMinorUnits: 3525,
        minimumChargeMinorUnits: 500,
        minimumChargeApplied: false,
      }),
    );
    expect(base.pricingSnapshot.pricingRuleId).toBeTruthy();
    const addOnLine = lines.find((l) => l.addOnId === addOn.id)!;
    expect(addOnLine.pricingSnapshot).toEqual(
      expect.objectContaining({
        unit: PricingUnit.FLAT,
        amountMinorUnits: 800,
        minimumChargeMinorUnits: null,
      }),
    );

    order = await svc.laundry.markPaid({
      actorId: 'actor-1',
      orderId: order.id,
    });
    expect(order.status).toBe(LaundryOrderStatus.PAID);
    order = await svc.laundry.startProcessing({
      actorId: 'actor-1',
      orderId: order.id,
    });
    order = await svc.laundry.markReady({
      actorId: 'actor-1',
      orderId: order.id,
    });
    order = await svc.laundry.markAwaitingPickup({
      actorId: 'actor-1',
      orderId: order.id,
    });
    expect(order.status).toBe(LaundryOrderStatus.AWAITING_PICKUP);
    order = await svc.laundry.complete({
      actorId: 'actor-1',
      orderId: order.id,
    });
    expect(order.status).toBe(LaundryOrderStatus.COMPLETED);

    expect(actions()).toEqual([
      'laundry_order.received',
      'laundry_order.weighed',
      'laundry_order.priced',
      'laundry_order.paid',
      'laundry_order.processing_started',
      'laundry_order.ready',
      'laundry_order.awaiting_pickup',
      'laundry_order.completed',
    ]);
  });

  it('freezes each line snapshot against a later pricing-rule change', async () => {
    const { customer, service, addOn } = await fixture({ servicePrice: 1000 });
    let order = await svc.laundry.receive({
      actorId: 'actor-1',
      customerId: customer.id,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    order = await svc.laundry.weigh({
      actorId: 'actor-1',
      orderId: order.id,
      weightGrams: 1000,
    });
    order = await svc.laundry.price({
      actorId: 'actor-1',
      orderId: order.id,
      baseServiceId: service.id,
      addOns: [{ addOnId: addOn.id }],
    });
    const originalTotal = order.totalMinorUnits;

    // A new effective price for the same service, well after pricing.
    await svc.pricing.createPricingRule({
      actorId: 'actor-1',
      serviceId: service.id,
      priceMinorUnits: 9999,
      unit: PricingUnit.PER_KG,
      effectiveFrom: new Date(Date.now() + 1000),
    });
    expect(
      (await svc.pricing.resolveEffectivePricing(
        { serviceId: service.id },
        new Date(Date.now() + 5000),
      ))!.priceMinorUnits,
    ).toBe(9999);

    const reFetched = await svc.laundry.getOrder(order.id);
    expect(reFetched!.totalMinorUnits).toBe(originalTotal);
    const lines = await dsA
      .getRepository(LaundryOrderLineEntity)
      .find({ where: { laundryOrderId: order.id } });
    const base = lines.find((l) => l.serviceId === service.id)!;
    expect(base.pricingSnapshot.rateMinorUnits).toBe(1000);
  });

  it('rejects a second price call on an already-PRICED order and leaves the snapshot byte-for-byte unchanged', async () => {
    const { customer, service, addOn } = await fixture();
    let order = await svc.laundry.receive({
      actorId: 'actor-1',
      customerId: customer.id,
      fulfillmentType: LaundryFulfillmentType.DELIVERY,
    });
    order = await svc.laundry.weigh({
      actorId: 'actor-1',
      orderId: order.id,
      weightGrams: 3000,
    });
    order = await svc.laundry.price({
      actorId: 'actor-1',
      orderId: order.id,
      baseServiceId: service.id,
      addOns: [{ addOnId: addOn.id }],
    });

    const before = await dsA
      .getRepository(LaundryOrderLineEntity)
      .find({ where: { laundryOrderId: order.id }, order: { id: 'ASC' } });
    const beforeTotal = (await svc.laundry.getOrder(order.id))!.totalMinorUnits;

    await expect(
      svc.laundry.price({
        actorId: 'actor-1',
        orderId: order.id,
        baseServiceId: service.id,
        addOns: [{ addOnId: addOn.id }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const after = await dsA
      .getRepository(LaundryOrderLineEntity)
      .find({ where: { laundryOrderId: order.id }, order: { id: 'ASC' } });
    expect(after).toHaveLength(before.length);
    expect(after).toEqual(before);
    expect((await svc.laundry.getOrder(order.id))!.totalMinorUnits).toBe(
      beforeTotal,
    );
  });

  it('rejects an illegal transition (startProcessing on a PRICED order) without changing status', async () => {
    const { customer, service, addOn } = await fixture();
    let order = await svc.laundry.receive({
      actorId: 'actor-1',
      customerId: customer.id,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    order = await svc.laundry.weigh({
      actorId: 'actor-1',
      orderId: order.id,
      weightGrams: 2000,
    });
    order = await svc.laundry.price({
      actorId: 'actor-1',
      orderId: order.id,
      baseServiceId: service.id,
      addOns: [{ addOnId: addOn.id }],
    });

    await expect(
      svc.laundry.startProcessing({ actorId: 'actor-1', orderId: order.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await svc.laundry.getOrder(order.id))!.status).toBe(
      LaundryOrderStatus.PRICED,
    );
  });

  describe('concurrent status-transition race (two real connections)', () => {
    // Get an order to a state from which the two racing verbs both lead to
    // DIFFERENT terminal states — so whichever transaction the row lock lets
    // through first, the other's target is unreachable from the committed
    // state and its own `assertTransition` rejects it. `markPaid` (-> PAID)
    // vs `cancel` (-> CANCELLED) from AWAITING_PAYMENT directly exercises
    // the "no order is ever both paid and cancelled" invariant (spec §4.3).
    async function awaitingPaymentOrder(): Promise<string> {
      const { customer, service, addOn } = await fixture();
      let order = await svc.laundry.receive({
        actorId: 'actor-1',
        customerId: customer.id,
        fulfillmentType: LaundryFulfillmentType.PICKUP,
      });
      order = await svc.laundry.weigh({
        actorId: 'actor-1',
        orderId: order.id,
        weightGrams: 2000,
      });
      order = await svc.laundry.price({
        actorId: 'actor-1',
        orderId: order.id,
        baseServiceId: service.id,
        addOns: [{ addOnId: addOn.id }],
      });
      order = await svc.laundry.markAwaitingPayment({
        actorId: 'actor-1',
        orderId: order.id,
      });
      return order.id;
    }

    async function paidOrder(): Promise<string> {
      const orderId = await awaitingPaymentOrder();
      await svc.laundry.markPaid({ actorId: 'actor-1', orderId });
      return orderId;
    }

    it('competing valid targets: exactly one of markPaid / cancel commits, the loser is rejected by the state machine and writes no audit', async () => {
      const orderId = await awaitingPaymentOrder();
      const auditB: AuditLoggerMock = {
        log: jest.fn().mockResolvedValue(undefined),
      };
      const svcB = buildLaundryService(dsB, auditB);
      auditA.log.mockClear();

      const [rPaid, rCancel] = await Promise.allSettled([
        svc.laundry.markPaid({ actorId: 'a', orderId }),
        svcB.laundry.cancel({ actorId: 'b', orderId }),
      ]);

      const fulfilled = [rPaid, rCancel].filter(
        (r) => r.status === 'fulfilled',
      );
      const rejected = [rPaid, rCancel].filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);

      const finalStatus = (await svc.laundry.getOrder(orderId))!.status;
      const paidWon = rPaid.status === 'fulfilled';
      expect(finalStatus).toBe(
        paidWon ? LaundryOrderStatus.PAID : LaundryOrderStatus.CANCELLED,
      );

      const winnerAction = paidWon
        ? 'laundry_order.paid'
        : 'laundry_order.cancelled';
      const winnerLog = paidWon ? auditA.log : auditB.log;
      const loserLog = paidWon ? auditB.log : auditA.log;
      expect(winnerLog).toHaveBeenCalledTimes(1);
      expect(winnerLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: winnerAction }),
      );
      expect(loserLog).not.toHaveBeenCalled();
    });

    it('same target: both attempt startProcessing, one commits, the loser is rejected against the committed PROCESSING status', async () => {
      const orderId = await paidOrder();
      const auditB: AuditLoggerMock = {
        log: jest.fn().mockResolvedValue(undefined),
      };
      const svcB = buildLaundryService(dsB, auditB);
      auditA.log.mockClear();

      const results = await Promise.allSettled([
        svc.laundry.startProcessing({ actorId: 'a', orderId }),
        svcB.laundry.startProcessing({ actorId: 'b', orderId }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find(
        (r) => r.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(loser.reason).toBeInstanceOf(BadRequestException);

      expect((await svc.laundry.getOrder(orderId))!.status).toBe(
        LaundryOrderStatus.PROCESSING,
      );
      const totalAuditCalls =
        auditA.log.mock.calls.length + auditB.log.mock.calls.length;
      expect(totalAuditCalls).toBe(1);
    });
  });
});
