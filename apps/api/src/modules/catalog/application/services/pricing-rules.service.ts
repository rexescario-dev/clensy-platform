import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { PricingRule } from '../../domain/pricing-rule';
import { PricingRuleEntity } from '../../infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';
import { CreatePricingRuleCommand } from '../commands/create-pricing-rule.command';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `ServicesService`/`AddOnsService`'s own local
// constant rather than a shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

// `PricingRule` is append-only price history for a `Service` (spec §4.1,
// §4.7), structurally different from `ServicesService`/`AddOnsService` in two
// ways: it has a real FK relationship to `Service` (existence-checked here,
// not just referenced) and it is never updated in place — a repricing
// deactivates the currently-active row and inserts a new one, it never
// mutates an existing row's `priceMinorUnits`. See `pricing-rule.entity.ts`
// for why there is no `updatedAt`.
@Injectable()
export class PricingRulesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PricingRuleEntity)
    private readonly pricingRuleRepository: Repository<PricingRuleEntity>,
    @InjectRepository(ServiceEntity)
    private readonly serviceRepository: Repository<ServiceEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Deactivate-then-insert (spec §3, §4.7): unconditionally deactivates
  // whatever rule is currently active for this `serviceId` via a bulk
  // predicate `UPDATE` (not an entity `save()` — always issues the write,
  // even if zero rows match, which is the "first price ever set" case), then
  // inserts the new active row. Two concurrent calls for the same
  // `serviceId` can both believe they're the sole active rule and both reach
  // the insert — the hand-added PARTIAL unique index
  // (`uq_pricing_rule_active_service`, `WHERE active = true`) is what
  // actually prevents two simultaneously-active rows; the try/catch below
  // (unlike `ServicesService`/`AddOnsService`, there's only one write site
  // here, so no shared `translateUniqueViolation` helper) is what turns the
  // loser's insert failure into a `ConflictException` instead of a raw
  // Postgres error.
  createPricingRule(command: CreatePricingRuleCommand): Promise<PricingRule> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const service = await manager.findOneBy(ServiceEntity, {
          id: command.serviceId,
        });
        if (!service) {
          throw new NotFoundException(`Service ${command.serviceId} not found`);
        }

        this.assertValid({ priceMinorUnits: command.priceMinorUnits });

        await manager.update(
          PricingRuleEntity,
          { serviceId: command.serviceId, active: true },
          { active: false },
        );

        const entity = manager.create(PricingRuleEntity, {
          serviceId: command.serviceId,
          priceMinorUnits: command.priceMinorUnits,
          active: true,
        });

        try {
          await manager.save(entity);
        } catch (error) {
          if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
            throw new ConflictException(
              'Pricing for this service was just updated — please retry',
            );
          }
          throw error;
        }

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'pricing_rule.create',
          entityType: 'pricing_rule',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  async getActivePricing(serviceId: string): Promise<PricingRule | null> {
    const service = await this.serviceRepository.findOneBy({ id: serviceId });
    if (!service) {
      throw new NotFoundException(`Service ${serviceId} not found`);
    }

    return this.pricingRuleRepository.findOneBy({ serviceId, active: true });
  }

  // Bulk read for Task 4's GraphQL DataLoader — no existence check (spec
  // §3's reconciliation policy: this method is not exposed over GraphQL
  // directly by this task, and the loader handles gap-filling for any
  // `serviceId` with no active rule). Returns exactly the rows found, no
  // synthetic `null` entries for missing ids — mirrors the Cleaners plan's
  // `getTeamsByIds` precedent.
  getActivePricingForServiceIds(serviceIds: string[]): Promise<PricingRule[]> {
    return this.pricingRuleRepository.findBy({
      serviceId: In(serviceIds),
      active: true,
    });
  }

  private assertValid(rule: Pick<PricingRule, 'priceMinorUnits'>): void {
    if (!Number.isInteger(rule.priceMinorUnits) || rule.priceMinorUnits <= 0) {
      throw new BadRequestException(
        'priceMinorUnits must be a positive integer',
      );
    }
  }
}
