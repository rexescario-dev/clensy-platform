import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
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
      fulfillmentType: LaundryFulfillmentType.PICKUP,
      status: LaundryOrderStatus.RECEIVED,
      weightGrams: null,
      totalMinorUnits: null,
      createdAt: new Date('2026-09-06T00:00:00Z'),
      updatedAt: new Date('2026-09-06T00:00:00Z'),
      ...over,
    }) as LaundryOrderEntity;

  beforeEach(async () => {
    let created = 0;
    manager = {
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({
        id: `generated-${++created}`,
        ...data,
      })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findOneByOrFail: jest.fn(),
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
      fulfillmentType: LaundryFulfillmentType.DELIVERY,
    };

    it('validates the customer before opening a transaction', async () => {
      customersService.getCustomer.mockResolvedValue(null);
      await expect(service.receive(command)).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
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
          fulfillmentType: LaundryFulfillmentType.DELIVERY,
          status: LaundryOrderStatus.RECEIVED,
          weightGrams: null,
          totalMinorUnits: null,
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'laundry_order.received',
          entityType: 'laundry_order',
        }),
      );
      expect(result.status).toBe(LaundryOrderStatus.RECEIVED);
    });
  });

  describe('weigh', () => {
    const cmd = (over = {}) => ({
      actorId: 'a',
      orderId: 'order-1',
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

      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1' },
        expect.objectContaining({
          status: LaundryOrderStatus.WEIGHED,
          weightGrams: 4200,
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'laundry_order.weighed' }),
      );
    });

    it('from WEIGHED: updates weightGrams only, no status change, still audits', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.WEIGHED }),
      );
      await service.weigh(cmd({ weightGrams: 5000 }));

      const patch = (manager.update.mock.calls[0] as unknown[])[2] as Record<
        string,
        unknown
      >;
      expect(patch).toHaveProperty('weightGrams', 5000);
      expect(patch).not.toHaveProperty('status');
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
      orderId: 'order-1',
      baseServiceId: 'svc-1',
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
        priceMinorUnits: 1500,
        unit: PricingUnit.PER_KG,
        minimumChargeMinorUnits: null,
      });

      await service.price(cmd());

      // 2000 g * 1500 / 1000 = 3000
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'svc-1',
          addOnId: null,
          pricingSnapshot: expect.objectContaining({
            rateMinorUnits: 1500,
            unit: PricingUnit.PER_KG,
            quantity: 2000,
            amountMinorUnits: 3000,
            minimumChargeMinorUnits: null,
            minimumChargeApplied: false,
            pricingRuleId: 'rule-1',
          }),
        }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1' },
        expect.objectContaining({
          status: LaundryOrderStatus.PRICED,
          totalMinorUnits: 3000,
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'laundry_order.priced' }),
      );
    });

    it('uses the caller quantity only for a PER_ITEM add-on and sums the total', async () => {
      pricingRulesService.resolveEffectivePricing.mockImplementation(
        (target) => {
          if ('serviceId' in target) {
            return Promise.resolve({
              id: 'rule-base',
              priceMinorUnits: 4000,
              unit: PricingUnit.FLAT,
              minimumChargeMinorUnits: null,
            });
          }
          return Promise.resolve({
            id: 'rule-addon',
            priceMinorUnits: 250,
            unit: PricingUnit.PER_ITEM,
            minimumChargeMinorUnits: null,
          });
        },
      );

      await service.price(cmd({ addOns: [{ addOnId: 'ao-1', quantity: 3 }] }));

      const savedRows = (manager.save.mock.calls as unknown[][]).map(
        (c) => c[0],
      ) as Array<{ addOnId?: string; pricingSnapshot: unknown }>;
      const addOnRow = savedRows.find((r) => r.addOnId === 'ao-1');
      expect(addOnRow?.pricingSnapshot).toEqual(
        expect.objectContaining({ quantity: 3, amountMinorUnits: 750 }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1' },
        expect.objectContaining({ totalMinorUnits: 4750 }),
      );
    });

    it('rejects when a target has no effective price and persists nothing', async () => {
      pricingRulesService.resolveEffectivePricing.mockResolvedValue(null);

      await expect(service.price(cmd())).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
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
    const t = { actorId: 'a', orderId: 'order-1' };

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
        { id: 'order-1' },
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
          status: LaundryOrderStatus.READY,
          fulfillmentType: LaundryFulfillmentType.DELIVERY,
        }),
      );
      await expect(service.markAwaitingPickup(t)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('markAwaitingDelivery on a DELIVERY order at READY succeeds', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({
          status: LaundryOrderStatus.READY,
          fulfillmentType: LaundryFulfillmentType.DELIVERY,
        }),
      );
      await service.markAwaitingDelivery(t);
      expect(manager.update).toHaveBeenCalledWith(
        LaundryOrderEntity,
        { id: 'order-1' },
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

    it('every transition verb throws NotFoundException for a missing order', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.complete(t)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reads', () => {
    it('getOrder returns null for a missing id', async () => {
      orderRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getOrder('nope')).resolves.toBeNull();
    });

    it('getOrderForInvoicing returns null for a missing id', async () => {
      orderRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getOrderForInvoicing('nope')).resolves.toBeNull();
      expect(lineRepository.find).not.toHaveBeenCalled();
    });

    it('getOrderForInvoicing projects the order plus its lines', async () => {
      orderRepository.findOneBy.mockResolvedValue({
        id: 'order-1',
        customerId: 'cust-1',
        status: LaundryOrderStatus.PRICED,
        totalMinorUnits: 3500,
      });
      lineRepository.find.mockResolvedValue([
        {
          serviceId: 'svc-1',
          addOnId: null,
          pricingSnapshot: {
            quantity: 2350,
            unit: PricingUnit.PER_KG,
            rateMinorUnits: 1500,
            amountMinorUnits: 3525,
            minimumChargeMinorUnits: null,
            minimumChargeApplied: false,
            pricingRuleId: 'rule-1',
          },
        },
        {
          serviceId: null,
          addOnId: 'addon-1',
          pricingSnapshot: {
            quantity: 1,
            unit: PricingUnit.FLAT,
            rateMinorUnits: 200,
            amountMinorUnits: 200,
            minimumChargeMinorUnits: null,
            minimumChargeApplied: false,
            pricingRuleId: 'rule-2',
          },
        },
      ]);

      await expect(service.getOrderForInvoicing('order-1')).resolves.toEqual({
        id: 'order-1',
        customerId: 'cust-1',
        status: LaundryOrderStatus.PRICED,
        totalMinorUnits: 3500,
        lines: [
          {
            serviceId: 'svc-1',
            addOnId: null,
            pricingSnapshot: {
              quantity: 2350,
              unit: PricingUnit.PER_KG,
              rateMinorUnits: 1500,
              amountMinorUnits: 3525,
            },
          },
          {
            serviceId: null,
            addOnId: 'addon-1',
            pricingSnapshot: {
              quantity: 1,
              unit: PricingUnit.FLAT,
              rateMinorUnits: 200,
              amountMinorUnits: 200,
            },
          },
        ],
      });
    });
  });
});
