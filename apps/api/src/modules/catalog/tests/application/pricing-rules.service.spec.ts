import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { PricingRulesService } from '../../application/services/pricing-rules.service';
import { PricingRuleEntity } from '../../infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7) —
// structurally similar to `services.service.spec.ts`/`add-ons.service.spec.ts`;
// see those files' header comments for the full rationale. This level proves
// validation/read-path/existence-check logic only — it cannot and does not
// attempt to prove the real deactivate-then-insert transactional behavior or
// the partial-unique-index-backed concurrency guarantee (that's the level-2,
// real-Postgres file's job — see `catalog.service.e2e-spec.ts`).
describe('PricingRulesService', () => {
  let service: PricingRulesService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOneBy: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let pricingRuleRepository: {
    findOneBy: jest.Mock;
    findBy: jest.Mock;
  };
  let serviceRepository: {
    findOneBy: jest.Mock;
  };
  let auditLogger: { log: jest.Mock };

  beforeEach(async () => {
    manager = {
      create: jest.fn(
        (_entityClass: unknown, data: Record<string, unknown>) => ({
          ...data,
        }),
      ),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    pricingRuleRepository = {
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };
    serviceRepository = {
      findOneBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingRulesService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(PricingRuleEntity),
          useValue: pricingRuleRepository,
        },
        {
          provide: getRepositoryToken(ServiceEntity),
          useValue: serviceRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<PricingRulesService>(PricingRulesService);
  });

  describe('createPricingRule', () => {
    it('throws NotFoundException for a nonexistent serviceId without attempting the deactivate/insert steps', async () => {
      manager.findOneBy.mockResolvedValue(undefined);

      await expect(
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: 'missing-service',
          priceMinorUnits: 5000,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    describe('assertValid via createPricingRule', () => {
      it.each([
        ['zero', 0],
        ['negative', -500],
        ['non-integer', 12.5],
      ])(
        'throws BadRequestException before any write when priceMinorUnits is %s',
        async (_label, priceMinorUnits) => {
          manager.findOneBy.mockResolvedValue({ id: 'service-1' });

          await expect(
            service.createPricingRule({
              actorId: 'actor-1',
              serviceId: 'service-1',
              priceMinorUnits,
            }),
          ).rejects.toThrow(BadRequestException);

          expect(manager.update).not.toHaveBeenCalled();
          expect(manager.save).not.toHaveBeenCalled();
          expect(auditLogger.log).not.toHaveBeenCalled();
        },
      );
    });
  });

  describe('getActivePricing', () => {
    it('throws NotFoundException for a nonexistent serviceId', async () => {
      serviceRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getActivePricing('missing-service')).rejects.toThrow(
        NotFoundException,
      );
      expect(pricingRuleRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('returns null when the service exists but has no PricingRule yet', async () => {
      serviceRepository.findOneBy.mockResolvedValue({ id: 'service-1' });
      pricingRuleRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getActivePricing('service-1')).resolves.toBeNull();
      expect(pricingRuleRepository.findOneBy).toHaveBeenCalledWith({
        serviceId: 'service-1',
        active: true,
      });
    });

    it('returns the active rule when one exists', async () => {
      const rule = {
        id: 'rule-1',
        serviceId: 'service-1',
        priceMinorUnits: 5000,
        active: true,
        createdAt: new Date(),
      };
      serviceRepository.findOneBy.mockResolvedValue({ id: 'service-1' });
      pricingRuleRepository.findOneBy.mockResolvedValue(rule);

      await expect(service.getActivePricing('service-1')).resolves.toEqual(
        rule,
      );
    });
  });

  describe('getActivePricingForServiceIds', () => {
    it('returns exactly the rows found, with no synthetic entries for missing ids', async () => {
      const rules = [
        {
          id: 'rule-1',
          serviceId: 'service-1',
          priceMinorUnits: 5000,
          active: true,
          createdAt: new Date(),
        },
      ];
      pricingRuleRepository.findBy.mockResolvedValue(rules);

      await expect(
        service.getActivePricingForServiceIds(['service-1', 'service-2']),
      ).resolves.toEqual(rules);
    });
  });
});
