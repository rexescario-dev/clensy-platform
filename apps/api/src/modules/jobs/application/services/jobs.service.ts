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

  // `BookingsService.findOne` + cancelled check + existing-job pre-check
  // run BEFORE `dataSource.transaction` (spec §4.2). Snapshot of
  // `scheduledAt`/`teamId` is the booking observed by that `findOne`.
  // Create does not call `TeamsService.getTeam`.
  async createFromBooking(
    command: CreateJobFromBookingCommand,
  ): Promise<CleaningJob> {
    const booking = await this.bookingsService.findOne(command.bookingId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot create a job from a cancelled booking',
      );
    }

    const existing = await this.jobRepository.findOneBy({
      bookingId: command.bookingId,
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
            scheduledAt: booking.scheduledAt,
            status: JobStatus.PENDING,
            createdAt: now,
            updatedAt: now,
          });
          await manager.save(job);

          const checklist = manager.create(ChecklistEntity, {
            jobId: job.id,
          });
          await manager.save(checklist);

          for (const item of DEFAULT_CHECKLIST_ITEMS) {
            const row = manager.create(ChecklistItemEntity, {
              checklistId: checklist.id,
              label: item.label,
              position: item.position,
              completed: false,
              completedAt: null,
            });
            await manager.save(row);
          }

          await this.auditLogger.log({
            actorId: command.actorId,
            action: 'job.create',
            entityType: 'job',
            entityId: job.id,
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

  async getJob(id: string): Promise<CleaningJob | null> {
    return this.jobRepository.findOneBy({ id });
  }

  listJobs(): Promise<CleaningJob[]> {
    return this.jobRepository.find();
  }

  getChecklistsByJobIds(ids: string[]): Promise<Checklist[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.checklistRepository.findBy({ jobId: In(ids) });
  }

  getChecklistItemsByChecklistIds(ids: string[]): Promise<ChecklistItem[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.checklistItemRepository.findBy({ checklistId: In(ids) });
  }

  // `TeamsService.getTeam` runs BEFORE the Jobs transaction (spec §4.2 /
  // plan Task 3). Same-state assignment still `manager.update()`s so
  // `updatedAt` bumps and `job.assign_team` fires.
  async assignTeam(command: AssignTeamToJobCommand): Promise<CleaningJob> {
    const team = await this.teamsService.getTeam(command.teamId);
    if (!team) {
      throw new NotFoundException(`Team ${command.teamId} not found`);
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const job = await manager.findOneBy(CleaningJobEntity, {
          id: command.jobId,
        });
        if (!job) {
          throw new NotFoundException(`Job ${command.jobId} not found`);
        }
        if (job.status === JobStatus.COMPLETED) {
          throw new BadRequestException(
            'Cannot assign a team to a completed job',
          );
        }

        await manager.update(
          CleaningJobEntity,
          { id: command.jobId },
          { teamId: command.teamId, updatedAt: new Date() },
        );

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'job.assign_team',
          entityType: 'job',
          entityId: command.jobId,
        });

        return manager.findOneByOrFail(CleaningJobEntity, {
          id: command.jobId,
        });
      }),
    );
  }

  // All job/item/audit reads and writes stay inside one transaction
  // (plan Task 3). Last-item complete does not set COMPLETED.
  async completeChecklistItem(
    command: CompleteChecklistItemCommand,
  ): Promise<CleaningJob> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const job = await manager.findOneBy(CleaningJobEntity, {
          id: command.jobId,
        });
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
        });
        const item = await manager.findOneBy(ChecklistItemEntity, {
          id: command.itemId,
        });
        if (!item || !checklist || item.checklistId !== checklist.id) {
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
        await manager.update(CleaningJobEntity, { id: job.id }, jobPatch);

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'job.checklist_item.complete',
          entityType: 'job',
          entityId: job.id,
        });

        return manager.findOneByOrFail(CleaningJobEntity, { id: job.id });
      }),
    );
  }

  async completeJob(command: CompleteJobCommand): Promise<CleaningJob> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const job = await manager.findOneBy(CleaningJobEntity, {
          id: command.jobId,
        });
        if (!job) {
          throw new NotFoundException(`Job ${command.jobId} not found`);
        }

        const checklist = await manager.findOneBy(ChecklistEntity, {
          jobId: job.id,
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

        await manager.update(
          CleaningJobEntity,
          { id: job.id },
          { status: JobStatus.COMPLETED, updatedAt: new Date() },
        );

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'job.complete',
          entityType: 'job',
          entityId: job.id,
        });

        return manager.findOneByOrFail(CleaningJobEntity, { id: job.id });
      }),
    );
  }
}
