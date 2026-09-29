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
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { BookingsService } from '../../../bookings/application/services/bookings.service';
import { BookingStatus } from '../../../bookings/domain/booking-status';
import { TeamsService } from '../../../cleaners/application/services/teams.service';
import { Checklist } from '../../domain/checklist';
import { ChecklistItem } from '../../domain/checklist-item';
import { CleaningJob } from '../../domain/cleaning-job';
import { DEFAULT_CHECKLIST_ITEMS } from '../../domain/default-checklist-items';
import { JobStatus } from '../../domain/job-status';
import { ChecklistEntity } from '../../infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from '../../infrastructure/persistence/checklist-item.entity';
import { CleaningJobEntity } from '../../infrastructure/persistence/cleaning-job.entity';
import { CreateJobFromBookingCommand } from '../commands/create-job-from-booking.command';
import { AssignTeamToJobCommand } from '../commands/assign-team-to-job.command';
import { CompleteChecklistItemCommand } from '../commands/complete-checklist-item.command';
import { CompleteJobCommand } from '../commands/complete-job.command';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const JOB_BOOKING_UNIQUE_CONSTRAINT = 'UQ_cleaning_job_booking_id';

// Constraint-scoped unique-violation check (spec §4.2 / §4.7). Accepts a
// `{ code, constraint }` driver shape so unit tests do not reconstruct
// TypeORM `QueryFailedError`; also unwraps `QueryFailedError.driverError`
// for the real Postgres path (Task 2 e2e).
export function isPostgresUniqueViolation(
  error: unknown,
  constraint: string,
): boolean {
  const driver =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string; constraint?: string })
      : (error as { code?: string; constraint?: string });
  return (
    driver?.code === POSTGRES_UNIQUE_VIOLATION &&
    driver?.constraint === constraint
  );
}

// Job audit events carry the caller's tenant (#86 Slice decision 10; RFC
// §4.6). `tenantId` is always the command's, i.e. `requireTenantId`'s.
function jobAuditTags(tenantId: string) {
  return { tenantId, scope: AdminScope.TENANT };
}

@Injectable()
export class JobsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CleaningJobEntity)
    private readonly jobRepository: Repository<CleaningJobEntity>,
    @InjectRepository(ChecklistEntity)
    private readonly checklistRepository: Repository<ChecklistEntity>,
    @InjectRepository(ChecklistItemEntity)
    private readonly checklistItemRepository: Repository<ChecklistItemEntity>,
    private readonly bookingsService: BookingsService,
    private readonly teamsService: TeamsService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // `TeamsService.getTeam` runs BEFORE the Jobs transaction (spec §4.2 /
  // plan Task 3). Same-state assignment still `manager.update()`s so
  // `updatedAt` bumps and `job.assign_team` fires. Every job lookup and
  // update carries `tenantId` in the same query (#86 Slice decision 6); a
  // job in another tenant is the existing 404.
  async assignTeam(command: AssignTeamToJobCommand): Promise<CleaningJob> {
    // Application half of I-1 (#83 Slice decision 6);
    // `fk_cleaning_job_team_tenant` is the database half (#86).
    const team = await this.teamsService.getTeam(
      command.teamId,
      command.tenantId,
    );
    if (!team) {
      throw new NotFoundException(`Team ${command.teamId} not found`);
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const where = { id: command.jobId, tenantId: command.tenantId };
        const job = await manager.findOneBy(CleaningJobEntity, where);
        if (!job) {
          throw new NotFoundException(`Job ${command.jobId} not found`);
        }
        if (job.status === JobStatus.COMPLETED) {
          throw new BadRequestException(
            'Cannot assign a team to a completed job',
          );
        }

        await manager.update(CleaningJobEntity, where, {
          teamId: command.teamId,
          updatedAt: new Date(),
        });

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: command.jobId,
          action: 'job.assign_team',
          entityType: 'job',
          ...jobAuditTags(command.tenantId),
        });

        return manager.findOneByOrFail(CleaningJobEntity, where);
      }),
    );
  }

  // All job/item/audit reads and writes stay inside one transaction
  // (plan Task 3). Last-item complete does not set COMPLETED.
  //
  // #86 Slice decision 7: the item is resolved only through the
  // tenant-scoped job → checklist chain, in one query keyed on both its id
  // and the scoped checklist's id. Items have no tenant of their own
  // (Slice decision 2), so an item of another job or tenant is simply not
  // found. The item UPDATE keys on the id resolved that way.
  async completeChecklistItem(
    command: CompleteChecklistItemCommand,
  ): Promise<CleaningJob> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const where = { id: command.jobId, tenantId: command.tenantId };
        const job = await manager.findOneBy(CleaningJobEntity, where);
        if (!job) {
          throw new NotFoundException(`Job ${command.jobId} not found`);
        }
        if (job.status === JobStatus.COMPLETED) {
          throw new BadRequestException(
            'Cannot complete a checklist item on a completed job',
          );
        }

        const checklist = await manager.findOneBy(ChecklistEntity, {
          jobId: job.id,
          tenantId: command.tenantId,
        });
        const item = checklist
          ? await manager.findOneBy(ChecklistItemEntity, {
              id: command.itemId,
              checklistId: checklist.id,
            })
          : null;
        if (!item) {
          throw new NotFoundException(
            `Checklist item ${command.itemId} not found`,
          );
        }

        const flipping = item.completed === false;
        if (flipping) {
          await manager.update(
            ChecklistItemEntity,
            { id: item.id },
            { completed: true, completedAt: new Date() },
          );
        }

        const jobPatch: { updatedAt: Date; status?: JobStatus } = {
          updatedAt: new Date(),
        };
        if (flipping && job.status === JobStatus.PENDING) {
          jobPatch.status = JobStatus.IN_PROGRESS;
        }
        await manager.update(CleaningJobEntity, where, jobPatch);

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: job.id,
          action: 'job.checklist_item.complete',
          entityType: 'job',
          ...jobAuditTags(command.tenantId),
        });

        return manager.findOneByOrFail(CleaningJobEntity, where);
      }),
    );
  }

  // Job and checklist lookups, the update and the re-read all carry
  // `tenantId` (#86 Slice decision 6). Items are read through the scoped
  // checklist (Slice decision 2).
  async completeJob(command: CompleteJobCommand): Promise<CleaningJob> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const where = { id: command.jobId, tenantId: command.tenantId };
        const job = await manager.findOneBy(CleaningJobEntity, where);
        if (!job) {
          throw new NotFoundException(`Job ${command.jobId} not found`);
        }

        const checklist = await manager.findOneBy(ChecklistEntity, {
          jobId: job.id,
          tenantId: command.tenantId,
        });
        const items = checklist
          ? await manager.findBy(ChecklistItemEntity, {
              checklistId: checklist.id,
            })
          : [];
        if (items.some((row) => row.completed === false)) {
          throw new BadRequestException(
            'Cannot complete a job with incomplete checklist items',
          );
        }

        await manager.update(CleaningJobEntity, where, {
          status: JobStatus.COMPLETED,
          updatedAt: new Date(),
        });

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: job.id,
          action: 'job.complete',
          entityType: 'job',
          ...jobAuditTags(command.tenantId),
        });

        return manager.findOneByOrFail(CleaningJobEntity, where);
      }),
    );
  }

  // `BookingsService.findOne` + cancelled check + existing-job pre-check
  // run BEFORE `dataSource.transaction` (spec §4.2). Snapshot of
  // `scheduledAt`/`teamId` is the booking observed by that `findOne`.
  // Create does not call `TeamsService.getTeam`.
  // `command.tenantId` (#85 Slice decision 11) is passed straight through
  // to `BookingsService.findOne`: a cross-tenant booking is the existing
  // `NotFoundException` (#85 Slice decision 9), same as a nonexistent
  // booking id. The job and its checklist are created in that tenant, the
  // booking's own (#86 Slice decision 6).
  async createFromBooking(
    command: CreateJobFromBookingCommand,
  ): Promise<CleaningJob> {
    const booking = await this.bookingsService.findOne(
      command.bookingId,
      command.tenantId,
    );

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot create a job from a cancelled booking',
      );
    }

    const existing = await this.jobRepository.findOneBy({
      bookingId: command.bookingId,
      tenantId: command.tenantId,
    });
    if (existing) {
      throw new ConflictException('A job already exists for this booking');
    }

    try {
      return await this.dataSource.transaction((manager) =>
        runAuditInTransaction(manager, async () => {
          const now = new Date();
          const job = manager.create(CleaningJobEntity, {
            bookingId: booking.id,
            teamId: booking.teamId,
            tenantId: command.tenantId,
            createdAt: now,
            scheduledAt: booking.scheduledAt,
            status: JobStatus.PENDING,
            updatedAt: now,
          });
          await manager.save(job);

          const checklist = manager.create(ChecklistEntity, {
            jobId: job.id,
            tenantId: command.tenantId,
          });
          await manager.save(checklist);

          for (const item of DEFAULT_CHECKLIST_ITEMS) {
            const row = manager.create(ChecklistItemEntity, {
              checklistId: checklist.id,
              completed: false,
              completedAt: null,
              label: item.label,
              position: item.position,
            });
            await manager.save(row);
          }

          await this.auditLogger.log({
            actorId: command.actorId,
            entityId: job.id,
            action: 'job.create',
            entityType: 'job',
            ...jobAuditTags(command.tenantId),
          });

          return job;
        }),
      );
    } catch (error) {
      if (isPostgresUniqueViolation(error, JOB_BOOKING_UNIQUE_CONSTRAINT)) {
        throw new ConflictException('A job already exists for this booking');
      }
      throw error;
    }
  }

  // Items have no tenant of their own (#86 Slice decision 2): the parent
  // checklist's `tenantId` is joined in the same query (Slice decision 6),
  // so the service boundary enforces it whatever ids a caller passes.
  getChecklistItemsByChecklistIds(
    ids: string[],
    tenantId: string,
  ): Promise<ChecklistItem[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.checklistItemRepository.findBy({
      checklistId: In(ids),
      checklist: { tenantId },
    });
  }

  getChecklistsByJobIds(ids: string[], tenantId: string): Promise<Checklist[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.checklistRepository.findBy({ jobId: In(ids), tenantId });
  }

  // Nullable read (#86 Slice decision 5, #83 `getTeam` precedent): a null
  // tenant (no tenant principal) and another tenant's job both return
  // `null`, the existing missing-row contract of `job(id)`.
  async getJob(
    id: string,
    tenantId: string | null,
  ): Promise<CleaningJob | null> {
    if (tenantId === null) {
      return null;
    }
    return this.jobRepository.findOneBy({ id, tenantId });
  }

  listJobs(tenantId: string): Promise<CleaningJob[]> {
    return this.jobRepository.find({ where: { tenantId } });
  }
}
