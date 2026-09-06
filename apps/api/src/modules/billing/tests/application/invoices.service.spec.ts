import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import { AddOnsService } from '../../../catalog/application/services/add-ons.service';
import { ServicesService } from '../../../catalog/application/services/services.service';
import { LaundryOrdersService } from '../../../laundry/application/services/laundry-orders.service';
import { LaundryOrderStatus } from '../../../laundry/domain/laundry-order-status';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';
import { InvoiceEntity } from '../../infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from '../../infrastructure/persistence/invoice-line.entity';
import { InvoicesService } from '../../application/services/invoices.service';

// Mocked Repository/DataSource unit tests (plan §7 Slice D). The mock
// `manager` stands in for the transaction EntityManager; `query` returns the
// next sequence value.
describe('InvoicesService', () => {
  let service: InvoicesService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    query: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let invoiceRepository: { findOneBy: jest.Mock };
  let laundryOrdersService: { getOrderForInvoicing: jest.Mock };
  let servicesService: { getServicesByIds: jest.Mock };
  let addOnsService: { getAddOnsByIds: jest.Mock };
  let auditLogger: { log: jest.Mock };

  const anOrder = (over = {}) => ({
    id: 'order-1',
    customerId: 'cust-1',
    status: LaundryOrderStatus.PRICED,
    totalMinorUnits: 3725,
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
    ...over,
  });

  const cmd = (over = {}) => ({
    actorId: 'actor-1',
    laundryOrderId: 'order-1',
    paymentTerms: InvoicePaymentTerms.PAY_NOW,
    ...over,
  });

  let seq = 0;

  beforeEach(async () => {
    seq = 41;
    let created = 0;
    manager = {
      create: jest.fn((_e: unknown, data: Record<string, unknown>) => ({
        id: `generated-${++created}`,
        ...data,
      })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOneBy: jest.fn().mockResolvedValue(null),
      findOneByOrFail: jest.fn((_e: unknown, where: { id: string }) =>
        Promise.resolve({ id: where.id, invoiceNumber: 'INV-2026-000042' }),
      ),
      query: jest.fn(() => Promise.resolve([{ n: String(++seq) }])),
    };
    dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };
    invoiceRepository = { findOneBy: jest.fn().mockResolvedValue(null) };
    laundryOrdersService = {
      getOrderForInvoicing: jest.fn().mockResolvedValue(anOrder()),
    };
    servicesService = {
      getServicesByIds: jest
        .fn()
        .mockResolvedValue([{ id: 'svc-1', name: 'Wash & Fold' }]),
    };
    addOnsService = {
      getAddOnsByIds: jest
        .fn()
        .mockResolvedValue([{ id: 'addon-1', name: 'Starch Finish' }]),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(InvoiceEntity),
          useValue: invoiceRepository,
        },
        { provide: getRepositoryToken(InvoiceLineEntity), useValue: {} },
        { provide: LaundryOrdersService, useValue: laundryOrdersService },
        { provide: ServicesService, useValue: servicesService },
        { provide: AddOnsService, useValue: addOnsService },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get(InvoicesService);
  });

  const savedEntities = (): Array<Record<string, unknown>> =>
    (manager.save.mock.calls as unknown[][]).map(
      (c) => c[0] as Record<string, unknown>,
    );

  const savedInvoice = () => savedEntities().find((e) => 'invoiceNumber' in e);

  const savedLines = () => savedEntities().filter((e) => 'description' in e);

  describe('golden path', () => {
    it('builds the invoice from the priced order', async () => {
      await service.generateFromOrder(cmd());

      const inv = savedInvoice()!;
      expect(inv).toEqual(
        expect.objectContaining({
          invoiceNumber: 'INV-2026-000042',
          laundryOrderId: 'order-1',
          customerId: 'cust-1',
          subtotalMinorUnits: 3725,
          discountMinorUnits: 0,
          totalMinorUnits: 3725,
          amountPaidMinorUnits: 0,
          paymentStatus: InvoicePaymentStatus.UNPAID,
          paymentTerms: InvoicePaymentTerms.PAY_NOW,
        }),
      );
    });

    it('copies each line snapshot verbatim and freezes the catalog name', async () => {
      await service.generateFromOrder(cmd());

      const lines = savedLines();
      expect(lines).toEqual([
        expect.objectContaining({
          description: 'Wash & Fold',
          quantity: 2350,
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 1500,
          amountMinorUnits: 3525,
        }),
        expect.objectContaining({
          description: 'Starch Finish (add-on)',
          quantity: 1,
          unit: PricingUnit.FLAT,
          rateMinorUnits: 200,
          amountMinorUnits: 200,
        }),
      ]);
    });

    it('draws exactly one sequence value', async () => {
      await service.generateFromOrder(cmd());
      expect(manager.query).toHaveBeenCalledTimes(1);
      expect((manager.query.mock.calls[0] as unknown[])[0] as string).toMatch(
        /nextval/i,
      );
    });

    it('audits invoice.generated', async () => {
      await service.generateFromOrder(cmd());
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'invoice.generated',
          entityType: 'invoice',
        }),
      );
    });

    it('sets dueDate to issueDate for PAY_NOW', async () => {
      await service.generateFromOrder(
        cmd({ paymentTerms: InvoicePaymentTerms.PAY_NOW }),
      );
      const inv = savedInvoice()!;
      expect(inv.dueDate).toEqual(inv.issueDate);
    });

    it.each([
      InvoicePaymentTerms.PAY_ON_COMPLETION,
      InvoicePaymentTerms.PAY_ON_DELIVERY,
    ])('leaves dueDate null for %s', async (terms) => {
      await service.generateFromOrder(cmd({ paymentTerms: terms }));
      expect(savedInvoice()!.dueDate).toBeNull();
    });
  });

  describe('eligibility', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      laundryOrdersService.getOrderForInvoicing.mockResolvedValue(null);
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the order is not priced', async () => {
      laundryOrdersService.getOrderForInvoicing.mockResolvedValue(
        anOrder({ totalMinorUnits: null }),
      );
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      LaundryOrderStatus.CANCELLED,
      LaundryOrderStatus.REJECTED,
      LaundryOrderStatus.LOST,
      LaundryOrderStatus.DAMAGED,
      LaundryOrderStatus.REFUNDED,
    ])('rejects an excluded status: %s', async (status) => {
      laundryOrdersService.getOrderForInvoicing.mockResolvedValue(
        anOrder({ status }),
      );
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      LaundryOrderStatus.PRICED,
      LaundryOrderStatus.AWAITING_PAYMENT,
      LaundryOrderStatus.PAID,
      LaundryOrderStatus.PROCESSING,
      LaundryOrderStatus.READY,
      LaundryOrderStatus.AWAITING_PICKUP,
      LaundryOrderStatus.AWAITING_DELIVERY,
      LaundryOrderStatus.COMPLETED,
    ])('accepts an allowed status: %s', async (status) => {
      laundryOrdersService.getOrderForInvoicing.mockResolvedValue(
        anOrder({ status }),
      );
      await expect(service.generateFromOrder(cmd())).resolves.toBeDefined();
    });

    it('rejects an order with no lines', async () => {
      laundryOrdersService.getOrderForInvoicing.mockResolvedValue(
        anOrder({ lines: [] }),
      );
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when an invoice already exists (pre-check)', async () => {
      invoiceRepository.findOneBy.mockResolvedValue({ id: 'existing' });
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('catalog resolution', () => {
    it('throws BadRequestException and saves nothing when a service id does not resolve', async () => {
      servicesService.getServicesByIds.mockResolvedValue([]);
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        BadRequestException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when an add-on id does not resolve', async () => {
      addOnsService.getAddOnsByIds.mockResolvedValue([]);
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unique-constraint failure semantics', () => {
    const violation = (constraint: string) =>
      Object.assign(new Error('duplicate key value'), {
        code: '23505',
        constraint,
      });

    it('translates a uq_invoice_laundry_order violation to ConflictException', async () => {
      manager.save.mockImplementation((entity: Record<string, unknown>) =>
        'invoiceNumber' in entity
          ? Promise.reject(violation('uq_invoice_laundry_order'))
          : Promise.resolve(entity),
      );
      await expect(service.generateFromOrder(cmd())).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows a uq_invoice_number violation unchanged', async () => {
      const err = violation('uq_invoice_number');
      manager.save.mockImplementation((entity: Record<string, unknown>) =>
        'invoiceNumber' in entity
          ? Promise.reject(err)
          : Promise.resolve(entity),
      );
      await expect(service.generateFromOrder(cmd())).rejects.toBe(err);
    });
  });

  describe('reads', () => {
    it('getInvoice returns null for a missing id', async () => {
      invoiceRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getInvoice('nope')).resolves.toBeNull();
    });
  });
});
