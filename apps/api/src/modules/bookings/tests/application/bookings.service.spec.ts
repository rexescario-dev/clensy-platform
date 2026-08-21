import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { BookingsService } from '../../application/services/bookings.service';
import { BookingStatus } from '../../domain/booking-status';
import { BookingEntity } from '../../infrastructure/persistence/booking.entity';
import { CustomersService } from '../../../customers/application/services/customers.service';
import { PropertiesService } from '../../../customers/application/services/properties.service';
import { ServicesService } from '../../../catalog/application/services/services.service';
import { PricingRulesService } from '../../../catalog/application/services/pricing-rules.service';
import { TeamsService } from '../../../cleaners/application/services/teams.service';

// Mocked `Repository`/`DataSource`/cross-module-service unit tests (test
// level 1, plan §7). `BookingsService.create`/`.update`/`.remove` open
// their own transaction via `DataSource.transaction`; the mock `manager`
// stands in for the transaction's `EntityManager`. Cross-module validation
// reads (`getCustomer`/`getProperty`/`getService`/`getActivePricing`/
// `getTeam`) are plain mocked service calls, never routed through the
// mocked transaction manager — matching plan §3's pre-transaction-reads
// decision. This level proves validation-chain branching and
// audit-suppression logic only; real rollback/persistence is level 2.
describe('BookingsService', () => {
  let service: BookingsService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let customersService: { getCustomer: jest.Mock };
  let propertiesService: { getProperty: jest.Mock };
  let servicesService: { getService: jest.Mock };
  let pricingRulesService: { getActivePricing: jest.Mock };
  let teamsService: { getTeam: jest.Mock };
  let auditLogger: { log: jest.Mock };

  const customer = { id: 'customer-1' };
  const property = { id: 'property-1', customerId: 'customer-1' };
  const activeService = { id: 'service-1', active: true };
  const activePricing = {
    id: 'pricing-1',
    serviceId: 'service-1',
    priceMinorUnits: 5000,
  };
  const team = { id: 'team-1' };

  beforeEach(async () => {
    manager = {
      create: jest.fn(
        (_entityClass: unknown, data: Record<string, unknown>) => ({
          id: 'generated-booking-id',
          ...data,
        }),
      ),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn((_entityClass: unknown, entity: unknown) =>
        Promise.resolve(entity),
      ),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((fn: (manager: unknown) => unknown) => fn(manager)),
    };
    customersService = { getCustomer: jest.fn().mockResolvedValue(customer) };
    propertiesService = { getProperty: jest.fn().mockResolvedValue(property) };
    servicesService = {
      getService: jest.fn().mockResolvedValue(activeService),
    };
    pricingRulesService = {
      getActivePricing: jest.fn().mockResolvedValue(activePricing),
    };
    teamsService = { getTeam: jest.fn().mockResolvedValue(team) };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(BookingEntity), useValue: {} },
        { provide: CustomersService, useValue: customersService },
        { provide: PropertiesService, useValue: propertiesService },
        { provide: ServicesService, useValue: servicesService },
        { provide: PricingRulesService, useValue: pricingRulesService },
        { provide: TeamsService, useValue: teamsService },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  describe('create', () => {
    const command = {
      actorId: 'actor-1',
      customerId: 'customer-1',
      propertyId: 'property-1',
      serviceId: 'service-1',
      teamId: 'team-1',
      scheduledAt: new Date('2026-09-01T09:00:00Z'),
    };

    it('throws NotFoundException when customerId does not exist, before any other check', async () => {
      customersService.getCustomer.mockResolvedValue(null);

      await expect(service.create(command)).rejects.toThrow(NotFoundException);
      expect(propertiesService.getProperty).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when propertyId does not exist', async () => {
      propertiesService.getProperty.mockResolvedValue(null);

      await expect(service.create(command)).rejects.toThrow(NotFoundException);
      expect(servicesService.getService).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the property belongs to a different customer', async () => {
      propertiesService.getProperty.mockResolvedValue({
        id: 'property-1',
        customerId: 'someone-else',
      });

      await expect(service.create(command)).rejects.toThrow(
        BadRequestException,
      );
      expect(servicesService.getService).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when serviceId does not exist', async () => {
      servicesService.getService.mockResolvedValue(null);

      await expect(service.create(command)).rejects.toThrow(NotFoundException);
      expect(pricingRulesService.getActivePricing).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the service is not active', async () => {
      servicesService.getService.mockResolvedValue({
        id: 'service-1',
        active: false,
      });

      await expect(service.create(command)).rejects.toThrow(
        BadRequestException,
      );
      expect(pricingRulesService.getActivePricing).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the service has no active price', async () => {
      pricingRulesService.getActivePricing.mockResolvedValue(null);

      await expect(service.create(command)).rejects.toThrow(
        BadRequestException,
      );
      expect(teamsService.getTeam).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a provided teamId does not exist', async () => {
      teamsService.getTeam.mockResolvedValue(null);

      await expect(service.create(command)).rejects.toThrow(NotFoundException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('does not call getTeam when teamId is omitted', async () => {
      const { teamId, ...withoutTeam } = command;
      void teamId;
      await service.create(withoutTeam);

      expect(teamsService.getTeam).not.toHaveBeenCalled();
    });

    it('creates a PENDING booking with the resolved pricing snapshot when all validations pass', async () => {
      const result = await service.create(command);

      expect(result).toMatchObject({
        status: BookingStatus.PENDING,
        pricingSnapshot: { priceMinorUnits: 5000 },
      });
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        action: 'booking.create',
        entityType: 'booking',
        entityId: result.id,
      });
    });

    it('does not emit an audit event when actorId is null (REST posture)', async () => {
      await service.create({ ...command, actorId: null });

      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      manager.findOneBy.mockResolvedValue(undefined);

      await expect(
        service.update('missing-id', {
          actorId: 'actor-1',
          scheduledAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-validates teamId via TeamsService.getTeam when a non-null teamId is provided', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'booking-1' });
      manager.findOneByOrFail.mockResolvedValue({ id: 'booking-1' });

      await service.update('booking-1', {
        actorId: 'actor-1',
        teamId: 'team-1',
      });

      expect(teamsService.getTeam).toHaveBeenCalledWith('team-1');
    });

    it('does not call getTeam when teamId is explicitly null', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'booking-1' });
      manager.findOneByOrFail.mockResolvedValue({ id: 'booking-1' });

      await service.update('booking-1', { actorId: 'actor-1', teamId: null });

      expect(teamsService.getTeam).not.toHaveBeenCalled();
    });

    it('does not call getTeam when teamId is omitted', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'booking-1' });
      manager.findOneByOrFail.mockResolvedValue({ id: 'booking-1' });

      await service.update('booking-1', {
        actorId: 'actor-1',
        scheduledAt: new Date(),
      });

      expect(teamsService.getTeam).not.toHaveBeenCalled();
    });

    it('does not emit an audit event when actorId is null (REST posture)', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'booking-1' });
      manager.findOneByOrFail.mockResolvedValue({ id: 'booking-1' });

      await service.update('booking-1', {
        actorId: null,
        scheduledAt: new Date(),
      });

      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      manager.findOneBy.mockResolvedValue(undefined);

      await expect(service.remove('missing-id', 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(manager.remove).not.toHaveBeenCalled();
    });

    it('hard-deletes and emits a booking.remove audit event when actorId is provided', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'booking-1' });

      await service.remove('booking-1', 'actor-1');

      expect(manager.remove).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        action: 'booking.remove',
        entityType: 'booking',
        entityId: 'booking-1',
      });
    });

    it('does not emit an audit event when actorId is null (REST posture)', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'booking-1' });

      await service.remove('booking-1', null);

      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });
});
