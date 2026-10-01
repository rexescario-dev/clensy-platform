import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
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
import { tenantAuditTags } from '../../../../platform/audit/application/audit-tags';

const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';

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
          tenantId: command.tenantId,
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

        await this.logAudit(
          command.actorId,
          command.tenantId,
          'booking.create',
          entity.id,
        );

        return entity;
      }),
    );
  }

  findAll(tenantId: string): Promise<Booking[]> {
    return this.bookingRepository.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string): Promise<Booking> {
    return this.findEntity(id, tenantId);
  }

  // Bulk lookup for Jobs' GraphQL relation-batching loader (Jobs spec §2 /
  // §4.5). Empty-array short-circuit and "return only the rows found"
  // match `getCustomersByIds` / `getTeamsByIds`. Not exposed over GraphQL.
  getBookingsByIds(ids: string[], tenantId: string): Promise<Booking[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.bookingRepository.findBy({ id: In(ids), tenantId });
  }

  async remove(
    id: string,
    actorId: string,
    tenantId: string,
  ): Promise<Booking> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const existing = await manager.findOneBy(BookingEntity, {
          id,
          tenantId,
        });
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
        try {
          await manager.remove(BookingEntity, existing);
        } catch (error) {
          this.conflictIfForeignKeyRestricted(error);
          throw error;
        }

        await this.logAudit(actorId, tenantId, 'booking.remove', id);

        return removed;
      }),
    );
  }

  async update(id: string, command: UpdateBookingCommand): Promise<Booking> {
    // `teamId`'s lookup is never transactional (structurally, like every
    // cross-module read in this service); it is validated ahead of the
    // transaction below. Atomic together, inside the transaction: the
    // booking's existence check, mutation, and audit event. Sound on the
    // same no-Phase-1-team-deletion invariant `create` relies on.
    if (command.teamId !== undefined && command.teamId !== null) {
      // Tenant-scoped lookup (#83 Slice decision 6): `command.tenantId` is
      // always the caller's own tenant (#85 Slice decision 7 — every
      // `BookingsService` caller has a principal). A `teamId` belonging to
      // another tenant fails closed with the `NotFoundException` below,
      // same as `create`.
      const team = await this.teamsService.getTeam(
        command.teamId,
        command.tenantId,
      );
      if (!team) {
        throw new NotFoundException(`Team ${command.teamId} not found`);
      }
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const existing = await manager.findOneBy(BookingEntity, {
          id,
          tenantId: command.tenantId,
        });
        if (!existing) {
          throw new NotFoundException(`Booking ${id} not found`);
        }

        // `tenantId` is consumed by the `teamId` lookup above and by the
        // WHERE predicates in this method; it MUST NOT reach the SET list
        // below — `tenantId` is the row's owner, never a change.
        // Destructured out here, alongside `actorId`, before `rawChanges`
        // is spread into `changes`.
        const { actorId, tenantId, ...rawChanges } = command;
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
          await manager.update(BookingEntity, { id, tenantId }, changes);
        }

        await this.logAudit(actorId, tenantId, 'booking.update', id);

        return manager.findOneByOrFail(BookingEntity, { id, tenantId });
      }),
    );
  }

  // Additive error-contract (Jobs spec §2 / §4.1): any Postgres FK
  // restriction (`23503`), regardless of constraint name, becomes this
  // generic ConflictException. Inspects `QueryFailedError.driverError.code`
  // and falls back to `error.code` so unit tests can use a `{ code }`
  // shape without reconstructing TypeORM internals (real driver path is
  // Task 2). Non-23503 errors are left for the caller to rethrow.
  private conflictIfForeignKeyRestricted(error: unknown): void {
    const code =
      (error instanceof QueryFailedError
        ? (error.driverError as { code?: string } | undefined)?.code
        : undefined) ?? (error as { code?: string }).code;
    if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      throw new ConflictException(
        'Booking cannot be deleted because other records reference it',
      );
    }
  }

  private async findEntity(
    id: string,
    tenantId: string,
  ): Promise<BookingEntity> {
    const booking = await this.bookingRepository.findOneBy({ id, tenantId });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }

  // Every caller has a principal after #85 Slice decision 3: `actorId` is
  // always a real actor, and every successful call emits its audit event
  // unconditionally. #90 decision 6: tagged with the same principal tenant
  // the caller's `{ id, tenantId }` lookup used. Single enforcement point
  // for that rule, shared by `create`/`update`/`remove`.
  private async logAudit(
    actorId: string,
    tenantId: string,
    action: string,
    entityId: string,
  ): Promise<void> {
    await this.auditLogger.log({
      actorId,
      entityId,
      action,
      entityType: 'booking',
      ...tenantAuditTags(tenantId),
    });
  }

  // Application half of I-1 (#85 Slice decision 2): every related
  // reference is looked up within `command.tenantId` before the booking is
  // written, so a booking can never be created against another tenant's
  // Customer, Property, Service, or Team. The database half is the
  // composite `fk_booking_*_tenant` constraints (Decision 5).
  private async resolveAndValidate(
    command: CreateBookingCommand,
  ): Promise<{ pricingSnapshot: BookingPricingSnapshot }> {
    const customer = await this.customersService.getCustomer(
      command.customerId,
      command.tenantId,
    );
    if (!customer) {
      throw new NotFoundException(`Customer ${command.customerId} not found`);
    }

    const property = await this.propertiesService.getProperty(
      command.propertyId,
      command.tenantId,
    );
    if (!property) {
      throw new NotFoundException(`Property ${command.propertyId} not found`);
    }
    if (property.customerId !== command.customerId) {
      throw new BadRequestException(
        'Property does not belong to the given customer',
      );
    }

    // Application-level same-tenant check (#84 spec §4.4/§4.5, slice
    // decision 9): `command.tenantId` is the caller's own tenant.
    const service = await this.servicesService.getService(
      command.serviceId,
      command.tenantId,
    );
    if (!service) {
      throw new NotFoundException(`Service ${command.serviceId} not found`);
    }
    if (!service.active) {
      throw new BadRequestException('Service is not active');
    }

    const pricing = await this.pricingRulesService.getActivePricing(
      command.serviceId,
      command.tenantId,
    );
    if (!pricing) {
      throw new BadRequestException('Service has no active price');
    }

    if (command.teamId != null) {
      const team = await this.teamsService.getTeam(
        command.teamId,
        command.tenantId,
      );
      if (!team) {
        throw new NotFoundException(`Team ${command.teamId} not found`);
      }
    }

    return { pricingSnapshot: { priceMinorUnits: pricing.priceMinorUnits } };
  }
}
