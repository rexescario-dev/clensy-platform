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
import { PricingUnit } from '../../domain/pricing-unit';
import { AddOnEntity } from '../../infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../../infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';
import { CreatePricingRuleCommand } from '../commands/create-pricing-rule.command';

// A `PricingRule`'s target: exactly one of a `Service` or an `AddOn` (Laundry
// Architecture & Catalog Foundation spec §4.2, §4.7). `column` is always one
// of these two literal strings, decided by `resolveTarget` below — never
// caller-supplied text — so interpolating it into a `WHERE` clause is safe.
type PricingRuleTarget =
  { column: 'serviceId'; id: string } | { column: 'addOnId'; id: string };

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `ServicesService`/`AddOnsService`'s own local
// constant rather than a shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

// `PricingRule` is append-only price history for a `Service` or an `AddOn`
// (Laundry Architecture & Catalog Foundation spec §4.2, §4.4, §4.7),
// structurally different from `ServicesService`/`AddOnsService` in two ways:
// it has a real FK relationship to its target (existence-checked here, not
// just referenced) and it is never updated in place — a repricing closes the
// currently-open row and inserts a new one, it never mutates an existing
// row's `priceMinorUnits`. See `pricing-rule.entity.ts` for why there is no
// `updatedAt`.
//
// Two independent mechanisms coexist on this table, deliberately uncoupled
// (spec §4.2, §4.4, §5): `active`/`getActivePricing` is the legacy,
// `Service`-only "current price" marker `BookingsService` depends on —
// untouched by anything below beyond the one `serviceId`-only branch in
// `createPricingRule` that already existed. `effectiveFrom`/`effectiveTo`/
// `resolveEffectivePricing` is the new, target-agnostic effective-dated
// mechanism; it never reads or writes `active`.
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

  // One insert, explicit active-state branching (spec §4.4, plan §3) — not
  // two loosely related write sites. Every step below runs inside one
  // transaction (`this.dataSource.transaction`), so a rejection at any point
  // rolls back everything this call has done so far, including the
  // close-and-read step (3).
  createPricingRule(command: CreatePricingRuleCommand): Promise<PricingRule> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        // 1. Mutual-exclusivity + existence check. `resolveTarget` throws
        // BadRequestException for "both provided" or "neither provided" —
        // the one place this decision is made (spec §4.7).
        const target = this.resolveTarget(command);
        if (target.column === 'serviceId') {
          const service = await manager.findOneBy(ServiceEntity, {
            id: target.id,
          });
          if (!service) {
            throw new NotFoundException(`Service ${target.id} not found`);
          }
        } else {
          const addOn = await manager.findOneBy(AddOnEntity, { id: target.id });
          if (!addOn) {
            throw new NotFoundException(`AddOn ${target.id} not found`);
          }
        }

        // 2. Validation.
        this.assertValid(command);

        // `operationNow` is captured once and used consistently as both
        // `effectiveFrom`'s default and the immediate-vs-future threshold
        // below (spec §4.4) — no other point in this method reads the clock.
        const operationNow = new Date();
        const effectiveFrom = command.effectiveFrom ?? operationNow;

        // 3. Close-and-read, as one atomic statement (spec §4.4 step 3,
        // plan §3). A predicate-based bulk UPDATE, not a read-then-save of a
        // fetched entity — under Postgres's read-committed behavior, a
        // second concurrent UPDATE against the same physical row blocks
        // until the first commits, then re-evaluates its own
        // `effectiveTo IS NULL` predicate against the now-committed data, so
        // it can never act on stale state. `target.column` is one of exactly
        // two compile-time literals decided by `resolveTarget` above, never
        // caller-supplied text — safe to interpolate; `target.id` is always
        // a bound parameter.
        const closeResult = await manager
          .createQueryBuilder()
          .update(PricingRuleEntity)
          .set({ effectiveTo: effectiveFrom })
          .where(`"${target.column}" = :targetId AND "effectiveTo" IS NULL`, {
            targetId: target.id,
          })
          .returning(['effectiveFrom'])
          .execute();

        // `UpdateResult.raw` is typed `any` by TypeORM — cast once to a
        // known shape rather than accessing `.effectiveFrom` on an `any`.
        const closedRows = closeResult.raw as { effectiveFrom: Date }[];
        const priorEffectiveFrom: Date | undefined =
          closedRows[0]?.effectiveFrom;
        if (
          priorEffectiveFrom !== undefined &&
          effectiveFrom <= priorEffectiveFrom
        ) {
          throw new BadRequestException(
            "effectiveFrom must be strictly after the target's current open interval",
          );
        }

        // 4. Legacy active-flag step — `serviceId` targets only. A future-
        // dated rule never deactivates the currently-active legacy row and
        // is itself inserted `active: false`; an `addOnId` target is always
        // `active: false` (deterministic — never left to the column
        // default). Neither branch touches `getActivePricing`'s contract.
        let active = false;
        if (target.column === 'serviceId' && effectiveFrom <= operationNow) {
          await manager.update(
            PricingRuleEntity,
            { serviceId: target.id, active: true },
            { active: false },
          );
          active = true;
        }

        // 5. Insert — exactly one new row, every column set together.
        const entity = manager.create(PricingRuleEntity, {
          serviceId: target.column === 'serviceId' ? target.id : null,
          addOnId: target.column === 'addOnId' ? target.id : null,
          priceMinorUnits: command.priceMinorUnits,
          unit: command.unit ?? PricingUnit.PER_SERVICE,
          effectiveFrom,
          effectiveTo: null,
          minimumChargeMinorUnits: command.minimumChargeMinorUnits ?? null,
          active,
        });

        try {
          await manager.save(entity);
        } catch (error) {
          if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
            throw new ConflictException(
              'Pricing for this target was just updated — please retry',
            );
          }
          throw error;
        }

        // 6. Audit — one event, unchanged shape, now also for addon targets.
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

  // New effective-dated resolution (spec §4.3) — target-agnostic, never
  // reads `active`, never checks `Service.active`/`AddOn.active`. At most
  // one row can ever satisfy this predicate for a given target and `asOf`,
  // by construction (the open-interval partial unique indexes + the
  // forward-only chain-extension check in `createPricingRule`) — no
  // defensive `ORDER BY`/arbitration is added here; see the plan's explicit
  // rationale for declining one.
  async resolveEffectivePricing(
    target: { serviceId: string } | { addOnId: string },
    asOf: Date,
  ): Promise<PricingRule | null> {
    const qb = this.pricingRuleRepository.createQueryBuilder('rule');
    if ('serviceId' in target) {
      qb.where('rule."serviceId" = :targetId', { targetId: target.serviceId });
    } else {
      qb.where('rule."addOnId" = :targetId', { targetId: target.addOnId });
    }
    return qb
      .andWhere('rule."effectiveFrom" <= :asOf', { asOf })
      .andWhere('(rule."effectiveTo" IS NULL OR rule."effectiveTo" > :asOf)', {
        asOf,
      })
      .getOne();
  }

  // Mutual exclusivity is this decision itself, not a separate earlier check
  // (spec §4.7): `hasServiceId === hasAddOnId` is true for exactly the two
  // rejection cases (both provided, or neither) — `!= null` (not `!==
  // undefined`), so an explicitly-passed empty string is still "provided,"
  // but an explicit GraphQL `null` on the unused field is correctly treated
  // as "not provided," matching `@IsOptional()`'s own null-or-undefined
  // semantics (confirmed against class-validator's source — it skips
  // validation for either) — a client sending `{ serviceId, addOnId: null
  // }` must resolve to `serviceId`, not be rejected as "both provided."
  // Same idiom as `BookingsService.update`'s `command.teamId != null`.
  private resolveTarget(
    command: Pick<CreatePricingRuleCommand, 'serviceId' | 'addOnId'>,
  ): PricingRuleTarget {
    const hasServiceId = command.serviceId != null;
    const hasAddOnId = command.addOnId != null;
    if (hasServiceId === hasAddOnId) {
      throw new BadRequestException(
        'Exactly one of serviceId or addOnId is required',
      );
    }
    return hasServiceId
      ? { column: 'serviceId', id: command.serviceId as string }
      : { column: 'addOnId', id: command.addOnId as string };
  }

  private assertValid(
    command: Pick<
      CreatePricingRuleCommand,
      'priceMinorUnits' | 'minimumChargeMinorUnits'
    >,
  ): void {
    if (
      !Number.isInteger(command.priceMinorUnits) ||
      command.priceMinorUnits <= 0
    ) {
      throw new BadRequestException(
        'priceMinorUnits must be a positive integer',
      );
    }
    if (
      command.minimumChargeMinorUnits != null &&
      (!Number.isInteger(command.minimumChargeMinorUnits) ||
        command.minimumChargeMinorUnits < 0)
    ) {
      throw new BadRequestException(
        'minimumChargeMinorUnits must be a non-negative integer',
      );
    }
  }
}
