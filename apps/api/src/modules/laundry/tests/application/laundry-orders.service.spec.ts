import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import { PricingRulesService } from '../../../catalog/application/services/pricing-rules.service';
import { CustomersService } from '../../../customers/application/services/customers.service';
import { LaundryOrdersService } from '../../application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderStatusTransitionPolicy } from '../../domain/laundry-order-status-transition-policy';
import { LaundryOrderEntity } from '../../infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../../infrastructure/persistence/laundry-order-line.entity';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

type WhereById = { id: string };

const TENANT = 't-a';
const tagged = (action: string, entityId = 'order-1') => ({
  actorId: expect.any(String),
  entityId,
  tenantId: TENANT,
  action,
  entityType: 'laundry_order',
  scope: AdminScope.TENANT,
});

// Mocked Repository/DataSource unit tests (plan §7 Slice C). The mock
// `manager` stands in for the transaction EntityManager; `findOne` ignores
// the `lock` option (the real pessimistic lock is exercised in Slice E's
// two-connection e2e). `LaundryOrderStatusTransitionPolicy` is the real
// pure class — there is nothing to mock.
describe('LaundryOrdersService', () => {
  let service: LaundryOrdersService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findOneByOrFail: jest.Mock;
    update: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let orderRepository: { findOne: jest.Mock; findOneBy: jest.Mock };
  let lineRepository: { find: jest.Mock };
  let customersService: { getCustomer: jest.Mock };
  let pricingRulesService: { resolveEffectivePricing: jest.Mock };
  let auditLogger: { log: jest.Mock };

  const anOrder = (
    over: Partial<LaundryOrderEntity> = {},
  ): LaundryOrderEntity =>
    ({
      id: 'order-1',
      customerId: 'cust-1',
      tenantId: TENANT,
      createdAt: new Date('2026-09-06T00:00:00Z'),
      fulfillmentType: LaundryFulfillmentType.PICKUP,
      status: LaundryOrderStatus.RECEIVED,
      totalMinorUnits: null,
      updatedAt: new Date('2026-09-06T00:00:00Z'),
      weightGrams: null,
      ...over,
    }) as LaundryOrderEntity;

  beforeEach(async () => {
    let created = 0;
    manager = {
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({
        id: `generated-${++created}`,
        ...data,
      })),
      findOne: jest.fn(),
      findOneByOrFail: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };
    orderRepository = { findOne: jest.fn(), findOneBy: jest.fn() };
    lineRepository = { find: jest.fn() };
    customersService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'cust-1' }),
    };
    pricingRulesService = { resolveEffectivePricing: jest.fn() };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaundryOrdersService,
        LaundryOrderStatusTransitionPolicy,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(LaundryOrderEntity),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(LaundryOrderLineEntity),
          useValue: lineRepository,
        },
        { provide: CustomersService, useValue: customersService },
        { provide: PricingRulesService, useValue: pricingRulesService },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get(LaundryOrdersService);
  });

  describe('receive', () => {
    const command = {
      actorId: 'actor-1',
      customerId: 'cust-1',
      tenantId: 't-a',
      fulfillmentType: LaundryFulfillmentType.DELIVERY,
    };

    it('validates the customer before opening a transaction', async () => {
      customersService.getCustomer.mockResolvedValue(null);
      await expect(service.receive(command)).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('passes the command tenantId to getCustomer', async () => {
      manager.findOneByOrFail.mockImplementation(
        (_e: unknown, where: WhereById) =>
          Promise.resolve(anOrder({ id: where.id })),
      );

      await service.receive(command);

      expect(customersService.getCustomer).toHaveBeenCalledWith(
        'cust-1',
        't-a',
      );
    });

    it('creates the order at RECEIVED and audits laundry_order.received', async () => {
      manager.findOneByOrFail.mockImplementation(
        (_e: unknown, where: WhereById) =>
          Promise.resolve(anOrder({ id: where.id })),
      );
      const result = await service.receive(command);

      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          tenantId: TENANT,
          fulfillmentType: LaundryFulfillmentType.DELIVERY,
          status: LaundryOrderStatus.RECEIVED,
          totalMinorUnits: null,
          weightGrams: null,
        }),
      );
      expect(manager.findOneByOrFail).toHaveBeenCalledWith(LaundryOrderEntity, {
        id: 'generated-1',
        tenantId: TENANT,
      });
      expect(auditLogger.log).toHaveBeenCalledWith({
        ...tagged('laundry_order.received', 'generated-1'),
        actorId: 'actor-1',
      });
      expect(result.status).toBe(LaundryOrderStatus.RECEIVED);
    });
  });

  describe('weigh', () => {
    const cmd = (over = {}) => ({
      actorId: 'a',
      orderId: 'order-1',
      tenantId: TENANT,
      weightGrams: 4200,
      ...over,
    });

    beforeEach(() => {
      manager.findOneByOrFail.mockImplementation(
        (_e: unknown, where: WhereById) =>
          Promise.resolve(
            anOrder({ id: where.id, status: LaundryOrderStatus.WEIGHED }),
          ),
      );
    });

    it('from RECEIVED: transitions to WEIGHED, sets weightGrams, audits laundry_order.weighed', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.RECEIVED }),
      );
      await service.weigh(cmd());

      expect(manager.findOne).toHaveBeenCalledWith(LaundryOrderEntity, {
        lock: { mode: 'pessimistic_write' },
        where: { id: 'order-1', tenantId: TENANT },
      });
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1', tenantId: TENANT },
        expect.objectContaining({
          status: LaundryOrderStatus.WEIGHED,
          weightGrams: 4200,
        }),
      );
      expect(manager.findOneByOrFail).toHaveBeenCalledWith(LaundryOrderEntity, {
        id: 'order-1',
        tenantId: TENANT,
      });
      expect(auditLogger.log).toHaveBeenCalledWith(
        tagged('laundry_order.weighed'),
      );
    });

    it('from WEIGHED: updates weightGrams only, no status change, still audits', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.WEIGHED }),
      );
      await service.weigh(cmd({ weightGrams: 5000 }));

      expect((manager.update.mock.calls[0] as unknown[])[1]).toEqual({
        id: 'order-1',
        tenantId: TENANT,
      });
      const patch = (manager.update.mock.calls[0] as unknown[])[2] as Record<
        string,
        unknown
      >;
      expect(patch).toHaveProperty('weightGrams', 5000);
      expect(patch).not.toHaveProperty('status');
      expect(patch).not.toHaveProperty('tenantId');
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'laundry_order.weighed' }),
      );
    });

    it('rejects a negative weight', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.RECEIVED }),
      );
      await expect(service.weigh(cmd({ weightGrams: -1 }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a non-integer weight', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.RECEIVED }),
      );
      await expect(service.weigh(cmd({ weightGrams: 3.5 }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects weighing a PRICED order', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.PRICED }),
      );
      await expect(service.weigh(cmd())).rejects.toThrow(BadRequestException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing order', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.weigh(cmd())).rejects.toThrow(NotFoundException);
    });
  });

  describe('price', () => {
    const cmd = (over = {}) => ({
      actorId: 'a',
      baseServiceId: 'svc-1',
      orderId: 'order-1',
      tenantId: 't-a',
      addOns: [] as { addOnId: string; quantity?: number }[],
      ...over,
    });

    beforeEach(() => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.WEIGHED, weightGrams: 2000 }),
      );
      manager.findOneByOrFail.mockImplementation(
        (_e: unknown, where: WhereById) =>
          Promise.resolve(
            anOrder({ id: where.id, status: LaundryOrderStatus.PRICED }),
          ),
      );
      manager.save.mockImplementation((rows: unknown) => Promise.resolve(rows));
    });

    it('freezes a PER_KG base line snapshot, sets total, transitions to PRICED, audits', async () => {
      pricingRulesService.resolveEffectivePricing.mockResolvedValue({
        id: 'rule-1',
        minimumChargeMinorUnits: null,
        priceMinorUnits: 1500,
        unit: PricingUnit.PER_KG,
      });

      await service.price(cmd());

      // 2000 g * 1500 / 1000 = 3000
      expect(manager.findOne).toHaveBeenCalledWith(LaundryOrderEntity, {
        lock: { mode: 'pessimistic_write' },
        where: { id: 'order-1', tenantId: TENANT },
      });
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          addOnId: null,
          serviceId: 'svc-1',
          tenantId: TENANT,
          pricingSnapshot: expect.objectContaining({
            pricingRuleId: 'rule-1',
            amountMinorUnits: 3000,
            minimumChargeApplied: false,
            minimumChargeMinorUnits: null,
            quantity: 2000,
            rateMinorUnits: 1500,
            unit: PricingUnit.PER_KG,
          }),
        }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1', tenantId: TENANT },
        expect.objectContaining({
          status: LaundryOrderStatus.PRICED,
          totalMinorUnits: 3000,
        }),
      );
      expect(
        (manager.update.mock.calls[0] as unknown[])[2] as object,
      ).not.toHaveProperty('tenantId');
      expect(manager.findOneByOrFail).toHaveBeenCalledWith(LaundryOrderEntity, {
        id: 'order-1',
        tenantId: TENANT,
      });
      expect(auditLogger.log).toHaveBeenCalledWith(
        tagged('laundry_order.priced'),
      );
    });

    it('uses the caller quantity only for a PER_ITEM add-on and sums the total', async () => {
      pricingRulesService.resolveEffectivePricing.mockImplementation(
        (target) => {
          if ('serviceId' in target) {
            return Promise.resolve({
              id: 'rule-base',
              minimumChargeMinorUnits: null,
              priceMinorUnits: 4000,
              unit: PricingUnit.FLAT,
            });
          }
          return Promise.resolve({
            id: 'rule-addon',
            minimumChargeMinorUnits: null,
            priceMinorUnits: 250,
            unit: PricingUnit.PER_ITEM,
          });
        },
      );

      await service.price(cmd({ addOns: [{ addOnId: 'ao-1', quantity: 3 }] }));

      const savedRows = (manager.save.mock.calls as unknown[][]).map(
        (c) => c[0],
      ) as Array<{ addOnId?: string; pricingSnapshot: unknown }>;
      const addOnRow = savedRows.find((r) => r.addOnId === 'ao-1');
      expect(addOnRow?.pricingSnapshot).toEqual(
        expect.objectContaining({ amountMinorUnits: 750, quantity: 3 }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1', tenantId: TENANT },
        expect.objectContaining({ totalMinorUnits: 4750 }),
      );
      // Every line takes the locked order row's tenant (slice decision 6).
      expect(savedRows).toHaveLength(2);
      for (const row of savedRows) {
        expect(row).toHaveProperty('tenantId', TENANT);
      }
    });

    it('rejects when a target has no effective price and persists nothing', async () => {
      pricingRulesService.resolveEffectivePricing.mockResolvedValue(null);

      await expect(service.price(cmd())).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it("price resolves every line's effective pricing within the command tenant", async () => {
      pricingRulesService.resolveEffectivePricing.mockResolvedValue({
        id: 'rule-1',
        minimumChargeMinorUnits: null,
        priceMinorUnits: 1500,
        unit: PricingUnit.PER_KG,
      });

      await service.price(
        cmd({ addOns: [{ addOnId: 'ao-a' }], tenantId: 't-a' }),
      );

      expect(pricingRulesService.resolveEffectivePricing).toHaveBeenCalledWith(
        { serviceId: 'svc-1' },
        expect.any(Date),
        't-a',
      );
      expect(pricingRulesService.resolveEffectivePricing).toHaveBeenCalledWith(
        { addOnId: 'ao-a' },
        expect.any(Date),
        't-a',
      );
    });

    it("price with another tenant's service finds no rule and keeps the existing 400", async () => {
      pricingRulesService.resolveEffectivePricing.mockResolvedValue(null);

      await expect(service.price(cmd({ tenantId: 't-b' }))).rejects.toThrow(
        BadRequestException,
      );
      expect(pricingRulesService.resolveEffectivePricing).toHaveBeenCalledWith(
        { serviceId: 'svc-1' },
        expect.any(Date),
        't-b',
      );
    });

    it('rejects pricing an order that is not WEIGHED (no re-pricing)', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.PRICED, weightGrams: 2000 }),
      );
      await expect(service.price(cmd())).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
      expect(
        pricingRulesService.resolveEffectivePricing,
      ).not.toHaveBeenCalled();
    });
  });

  describe('transition verbs', () => {
    const t = { actorId: 'a', orderId: 'order-1', tenantId: TENANT };

    beforeEach(() => {
      manager.findOneByOrFail.mockImplementation(
        (_e: unknown, where: WhereById) =>
          Promise.resolve(anOrder({ id: where.id })),
      );
    });

    it('startProcessing: PAID -> PROCESSING, audits laundry_order.processing_started', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.PAID }),
      );
      await service.startProcessing(t);
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1', tenantId: TENANT },
        expect.objectContaining({ status: LaundryOrderStatus.PROCESSING }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'laundry_order.processing_started' }),
      );
    });

    it('startProcessing from PRICED is rejected by the transition policy', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.PRICED }),
      );
      await expect(service.startProcessing(t)).rejects.toThrow(
        BadRequestException,
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('cancel from PAID is rejected (PAID -> CANCELLED is not a legal edge)', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.PAID }),
      );
      await expect(service.cancel(t)).rejects.toThrow(BadRequestException);
    });

    it('markAwaitingPickup on a DELIVERY order is rejected', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({
          fulfillmentType: LaundryFulfillmentType.DELIVERY,
          status: LaundryOrderStatus.READY,
        }),
      );
      await expect(service.markAwaitingPickup(t)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('markAwaitingDelivery on a DELIVERY order at READY succeeds', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({
          fulfillmentType: LaundryFulfillmentType.DELIVERY,
          status: LaundryOrderStatus.READY,
        }),
      );
      await service.markAwaitingDelivery(t);
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1', tenantId: TENANT },
        expect.objectContaining({
          status: LaundryOrderStatus.AWAITING_DELIVERY,
        }),
      );
    });

    it('refund from COMPLETED succeeds and audits laundry_order.refunded', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.COMPLETED }),
      );
      await service.refund(t);
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'laundry_order.refunded' }),
      );
    });

    // #87 slice decisions 6, 11: each verb locks, updates and re-reads by
    // `{ id, tenantId }`, never writes `tenantId`, and tags its audit event.
    it.each([
      [
        'cancel',
        LaundryOrderStatus.RECEIVED,
        LaundryOrderStatus.CANCELLED,
        'laundry_order.cancelled',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'complete',
        LaundryOrderStatus.AWAITING_PICKUP,
        LaundryOrderStatus.COMPLETED,
        'laundry_order.completed',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'markAwaitingDelivery',
        LaundryOrderStatus.READY,
        LaundryOrderStatus.AWAITING_DELIVERY,
        'laundry_order.awaiting_delivery',
        LaundryFulfillmentType.DELIVERY,
      ],
      [
        'markAwaitingPayment',
        LaundryOrderStatus.PRICED,
        LaundryOrderStatus.AWAITING_PAYMENT,
        'laundry_order.awaiting_payment',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'markAwaitingPickup',
        LaundryOrderStatus.READY,
        LaundryOrderStatus.AWAITING_PICKUP,
        'laundry_order.awaiting_pickup',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'markDamaged',
        LaundryOrderStatus.PROCESSING,
        LaundryOrderStatus.DAMAGED,
        'laundry_order.damaged',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'markLost',
        LaundryOrderStatus.PROCESSING,
        LaundryOrderStatus.LOST,
        'laundry_order.lost',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'markPaid',
        LaundryOrderStatus.AWAITING_PAYMENT,
        LaundryOrderStatus.PAID,
        'laundry_order.paid',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'markReady',
        LaundryOrderStatus.PROCESSING,
        LaundryOrderStatus.READY,
        'laundry_order.ready',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'refund',
        LaundryOrderStatus.COMPLETED,
        LaundryOrderStatus.REFUNDED,
        'laundry_order.refunded',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'reject',
        LaundryOrderStatus.RECEIVED,
        LaundryOrderStatus.REJECTED,
        'laundry_order.rejected',
        LaundryFulfillmentType.PICKUP,
      ],
      [
        'startProcessing',
        LaundryOrderStatus.PAID,
        LaundryOrderStatus.PROCESSING,
        'laundry_order.processing_started',
        LaundryFulfillmentType.PICKUP,
      ],
    ] as const)(
      '%s is scoped by { id, tenantId } and audit-tagged',
      async (verb, from, to, action, fulfillmentType) => {
        manager.findOne.mockResolvedValue(
          anOrder({ fulfillmentType, status: from }),
        );
        await service[verb](t);

        expect(manager.findOne).toHaveBeenCalledWith(LaundryOrderEntity, {
          lock: { mode: 'pessimistic_write' },
          where: { id: 'order-1', tenantId: TENANT },
        });
        expect(manager.update).toHaveBeenCalledTimes(1);
        const [, where, patch] = manager.update.mock.calls[0] as [
          unknown,
          unknown,
          Record<string, unknown>,
        ];
        expect(where).toEqual({ id: 'order-1', tenantId: TENANT });
        expect(patch).toEqual({ status: to, updatedAt: expect.any(Date) });
        expect(manager.findOneByOrFail).toHaveBeenCalledWith(
          LaundryOrderEntity,
          { id: 'order-1', tenantId: TENANT },
        );
        expect(auditLogger.log).toHaveBeenCalledWith({
          ...tagged(action),
          actorId: 'a',
        });
      },
    );

    it('a lock miss (missing or other-tenant order) is NotFound with no update or audit', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.complete(t)).rejects.toThrow(
        new NotFoundException('Laundry order order-1 not found'),
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('getOrder looks the order up by { id, tenantId }', async () => {
      orderRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getOrder('nope', TENANT)).resolves.toBeNull();
      expect(orderRepository.findOneBy).toHaveBeenCalledWith({
        id: 'nope',
        tenantId: TENANT,
      });
    });

    it('getOrder with a null tenant returns null without a query', async () => {
      await expect(service.getOrder('order-1', null)).resolves.toBeNull();
      expect(orderRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('getOrderForInvoicing returns null for a missing id', async () => {
      orderRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.getOrderForInvoicing('nope', TENANT),
      ).resolves.toBeNull();
      expect(orderRepository.findOneBy).toHaveBeenCalledWith({
        id: 'nope',
        tenantId: TENANT,
      });
      expect(lineRepository.find).not.toHaveBeenCalled();
    });

    it('getOrderForInvoicing projects the order plus its lines', async () => {
      orderRepository.findOneBy.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        tenantId: TENANT,
        status: LaundryOrderStatus.PRICED,
        totalMinorUnits: 3500,
      });
      lineRepository.find.mockResolvedValue([
        {
          addOnId: null,
          pricingSnapshot: {
            pricingRuleId: 'rule-1',
            amountMinorUnits: 3525,
            minimumChargeApplied: false,
            minimumChargeMinorUnits: null,
            quantity: 2350,
            rateMinorUnits: 1500,
            unit: PricingUnit.PER_KG,
          },
          serviceId: 'svc-1',
        },
        {
          addOnId: 'addon-1',
          pricingSnapshot: {
            pricingRuleId: 'rule-2',
            amountMinorUnits: 200,
            minimumChargeApplied: false,
            minimumChargeMinorUnits: null,
            quantity: 1,
            rateMinorUnits: 200,
            unit: PricingUnit.FLAT,
          },
          serviceId: null,
        },
      ]);

      await expect(
        service.getOrderForInvoicing('order-1', TENANT),
      ).resolves.toEqual({
        id: 'order-1',
        customerId: 'cust-1',
        tenantId: TENANT,
        lines: [
          {
            addOnId: null,
            pricingSnapshot: {
              amountMinorUnits: 3525,
              quantity: 2350,
              rateMinorUnits: 1500,
              unit: PricingUnit.PER_KG,
            },
            serviceId: 'svc-1',
          },
          {
            addOnId: 'addon-1',
            pricingSnapshot: {
              amountMinorUnits: 200,
              quantity: 1,
              rateMinorUnits: 200,
              unit: PricingUnit.FLAT,
            },
            serviceId: null,
          },
        ],
        status: LaundryOrderStatus.PRICED,
        totalMinorUnits: 3500,
      });
      expect(lineRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
        where: { laundryOrderId: 'order-1', tenantId: TENANT },
      });
    });
  });
});
