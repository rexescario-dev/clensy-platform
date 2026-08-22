import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { CustomersService } from '../../../customers/application/services/customers.service';
import { PropertiesService } from '../../../customers/application/services/properties.service';
import { ServicesService } from '../../../catalog/application/services/services.service';
import { PricingRulesService } from '../../../catalog/application/services/pricing-rules.service';
import { TeamsService } from '../../../cleaners/application/services/teams.service';
import { Booking } from '../../domain/booking';
import { BookingPricingSnapshot } from '../../domain/booking-pricing-snapshot';
import { BookingPricingSnapshotEmbeddable } from '../../infrastructure/persistence/booking-pricing-snapshot.embeddable';
import { BookingStatus } from '../../domain/booking-status';
import { BookingEntity } from '../../infrastructure/persistence/booking.entity';
import { CreateBookingCommand } from '../commands/create-booking.command';
import { UpdateBookingCommand } from '../commands/update-booking.command';

@Injectable()
export class BookingsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    private readonly customersService: CustomersService,
    private readonly propertiesService: PropertiesService,
    private readonly servicesService: ServicesService,
    private readonly pricingRulesService: PricingRulesService,
    private readonly teamsService: TeamsService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Cross-module validation reads run entirely before the transaction opens
  // (plan §3): none of `getCustomer`/`getProperty`/`getService`/
  // `getActivePricing`/`getTeam` accepts an `EntityManager`, so they cannot
  // structurally join `BookingsService`'s own transaction — and spec §2.6
  // forbids reaching into another module's entity/repository directly to
  // make them do so. Sound because none of Customer/Property/Service/Team
  // has a delete operation in Phase 1 — nothing can invalidate a validated
  // reference between this read and the subsequent write.
  async create(command: CreateBookingCommand): Promise<Booking> {
    const { pricingSnapshot } = await this.resolveAndValidate(command);

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(BookingEntity, {
          customerId: command.customerId,
          propertyId: command.propertyId,
          serviceId: command.serviceId,
          teamId: command.teamId ?? null,
          scheduledAt: command.scheduledAt,
          status: BookingStatus.PENDING,
        });
        // `manager.create()` does not populate an embedded-column
        // property from a plain object passed under its key — verified
        // directly against this codebase's installed TypeORM version, not
        // assumed from the embedded-column API in general. Assigning it
        // on the built entity afterward is required, not stylistic.
        entity.pricingSnapshot = Object.assign(
          new BookingPricingSnapshotEmbeddable(),
          pricingSnapshot,
        );
        await manager.save(entity);

        // `actorId === null` means "emit no audit event for this call" —
        // not "emit one with a null/anonymous actor." Only the
        // unauthenticated REST surface ever passes null (spec §4.4).
        if (command.actorId !== null) {
          await this.auditLogger.log({
            actorId: command.actorId,
            action: 'booking.create',
            entityType: 'booking',
            entityId: entity.id,
          });
        }

        return entity;
      }),
    );
  }

  private async resolveAndValidate(
    command: CreateBookingCommand,
  ): Promise<{ pricingSnapshot: BookingPricingSnapshot }> {
    const customer = await this.customersService.getCustomer(
      command.customerId,
    );
    if (!customer) {
      throw new NotFoundException(`Customer ${command.customerId} not found`);
    }

    const property = await this.propertiesService.getProperty(
      command.propertyId,
    );
    if (!property) {
      throw new NotFoundException(`Property ${command.propertyId} not found`);
    }
    if (property.customerId !== command.customerId) {
      throw new BadRequestException(
        'Property does not belong to the given customer',
      );
    }

    const service = await this.servicesService.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException(`Service ${command.serviceId} not found`);
    }
    if (!service.active) {
      throw new BadRequestException('Service is not active');
    }

    const pricing = await this.pricingRulesService.getActivePricing(
      command.serviceId,
    );
    if (!pricing) {
      throw new BadRequestException('Service has no active price');
    }

    if (command.teamId != null) {
      const team = await this.teamsService.getTeam(command.teamId);
      if (!team) {
        throw new NotFoundException(`Team ${command.teamId} not found`);
      }
    }

    return { pricingSnapshot: { priceMinorUnits: pricing.priceMinorUnits } };
  }

  findAll(): Promise<Booking[]> {
    return this.bookingRepository.find();
  }

  private async findEntity(id: string): Promise<BookingEntity> {
    const booking = await this.bookingRepository.findOneBy({ id });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }

  async findOne(id: string): Promise<Booking> {
    return this.findEntity(id);
  }

  async update(id: string, command: UpdateBookingCommand): Promise<Booking> {
    // `teamId`'s lookup is never transactional (structurally, like every
    // cross-module read in this service); it is validated ahead of the
    // transaction below. Atomic together, inside the transaction: the
    // booking's existence check, mutation, and audit event. Sound on the
    // same no-Phase-1-team-deletion invariant `create` relies on.
    if (command.teamId !== undefined && command.teamId !== null) {
      const team = await this.teamsService.getTeam(command.teamId);
      if (!team) {
        throw new NotFoundException(`Team ${command.teamId} not found`);
      }
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const existing = await manager.findOneBy(BookingEntity, { id });
        if (!existing) {
          throw new NotFoundException(`Booking ${id} not found`);
        }

        const { actorId, ...rawChanges } = command;
        // `manager.update()` throws ("update values are not defined") when
        // every key it's given resolves to `undefined` — reachable
        // whenever a caller submits `UpdateBookingInput`/`UpdateBookingDto`
        // with only `id` (every other field is optional). This is not
        // merely "changes is an empty object": `input`/`dto` here are real
        // `class-transformer`-hydrated instances, and `plainToInstance`
        // gives every *declared* class field its own property — present
        // with value `undefined` — even when the caller never sent it, so
        // `{ ...changes }` still carries `scheduledAt`/`status`/`teamId`
        // as keys after destructuring `actorId` out. `Object.keys(changes)
        // .length > 0` alone is therefore always true and does not detect
        // this case — confirmed directly with `plainToInstance`, not
        // assumed; a plain object literal (what this file's own tests used
        // before this fix) does not reproduce that shape. Filtering to
        // keys with a defined value is what both TypeORM needs (verified:
        // it tolerates a *mix* of defined and undefined-valued keys fine,
        // just not all-undefined) and what correctly detects "nothing to
        // change" either way. Found by testing directly against real
        // Postgres via an actual GraphQL request, not a hand-built object.
        // The pre-migration implementation (`Object.assign` + `save()`)
        // tolerated an empty command as a harmless no-op; this
        // `manager.update()`-based rewrite (§3's audit-unconditionality
        // reason) does not, unless guarded explicitly. Skipping the call
        // entirely when nothing is defined still satisfies spec §4.4's
        // "every successful call... emits its audit event unconditionally"
        // — the call is still successful, it just has nothing to persist.
        const changes = Object.fromEntries(
          Object.entries(rawChanges).filter(([, value]) => value !== undefined),
        );
        if (Object.keys(changes).length > 0) {
          await manager.update(BookingEntity, { id }, changes);
        }

        if (actorId !== null) {
          await this.auditLogger.log({
            actorId,
            action: 'booking.update',
            entityType: 'booking',
            entityId: id,
          });
        }

        return manager.findOneByOrFail(BookingEntity, { id });
      }),
    );
  }

  async remove(id: string, actorId: string | null): Promise<Booking> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const existing = await manager.findOneBy(BookingEntity, { id });
        if (!existing) {
          throw new NotFoundException(`Booking ${id} not found`);
        }

        // `manager.remove()` strips the id (and other fields) from the
        // passed entity after deletion — snapshot it first so the caller
        // still gets back what was deleted. The exact same rule the
        // pre-migration `BookingsService.remove()` already documented;
        // reconfirmed the hard way (a mocked `manager.remove()` doesn't
        // replicate this side effect, so it only surfaced against real
        // Postgres/GraphQL, not the level-1 unit tests).
        const removed: Booking = { ...existing };
        await manager.remove(BookingEntity, existing);

        if (actorId !== null) {
          await this.auditLogger.log({
            actorId,
            action: 'booking.remove',
            entityType: 'booking',
            entityId: id,
          });
        }

        return removed;
      }),
    );
  }
}
