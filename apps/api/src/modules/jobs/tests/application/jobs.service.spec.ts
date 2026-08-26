import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { BookingsService } from '../../../bookings/application/services/bookings.service';
import { BookingStatus } from '../../../bookings/domain/booking-status';
import { TeamsService } from '../../../cleaners/application/services/teams.service';
import { JobsService } from '../../application/services/jobs.service';
import { DEFAULT_CHECKLIST_ITEMS } from '../../domain/default-checklist-items';
import { JobStatus } from '../../domain/job-status';
import { CleaningJobEntity } from '../../infrastructure/persistence/cleaning-job.entity';
import { ChecklistEntity } from '../../infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from '../../infrastructure/persistence/checklist-item.entity';

/* Jest asymmetric matchers (`expect.any(Date)`) are typed `any`; this
 * spec's objectContaining assertions trip no-unsafe-assignment on every
 * timestamp check. Scoped here rather than weakening src unit tests. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// Mocked `Repository`/`DataSource` unit tests (test level 1, Jobs plan §7).
// `JobsService.createFromBooking` opens its own transaction via
// `DataSource.transaction`; the mock `manager` stands in for the
// transaction's `EntityManager`. `BookingsService.findOne` is a plain
// mocked service call, never routed through the mocked transaction
// manager — matching spec §4.2's pre-transaction snapshot read. This
// level proves branching (cancelled / missing booking / uniqueness
// pre-check / constraint-scoped 23505 / getJob null / empty batch);
// real rollback, concurrent unique, and FK 23503 are level 2.
describe('JobsService', () => {
  let service: JobsService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    findBy: jest.Mock;
    update: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let jobRepository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
  };
  let checklistRepository: { findBy: jest.Mock };
  let checklistItemRepository: { findBy: jest.Mock };
  let bookingsService: { findOne: jest.Mock };
  let teamsService: { getTeam: jest.Mock };
  let auditLogger: { log: jest.Mock };

  const pendingBooking = {
    id: 'booking-1',
    status: BookingStatus.PENDING,
    scheduledAt: new Date('2026-09-01T09:00:00Z'),
    teamId: 'team-1',
  };

  beforeEach(async () => {
    let created = 0;
    manager = {
      create: jest.fn(
        (_entityClass: unknown, data: Record<string, unknown>) => ({
          id: `generated-${++created}`,
          ...data,
        }),
      ),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      findBy: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((fn: (manager: unknown) => unknown) => fn(manager)),
    };
    jobRepository = {
      find: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    checklistRepository = { findBy: jest.fn() };
    checklistItemRepository = { findBy: jest.fn() };
    bookingsService = { findOne: jest.fn().mockResolvedValue(pendingBooking) };
    teamsService = { getTeam: jest.fn().mockResolvedValue({ id: 'team-2' }) };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(CleaningJobEntity),
          useValue: jobRepository,
        },
        {
          provide: getRepositoryToken(ChecklistEntity),
          useValue: checklistRepository,
        },
        {
          provide: getRepositoryToken(ChecklistItemEntity),
          useValue: checklistItemRepository,
        },
        { provide: BookingsService, useValue: bookingsService },
        { provide: TeamsService, useValue: teamsService },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  describe('createFromBooking', () => {
    const command = { actorId: 'actor-1', bookingId: 'booking-1' };

    it('propagates BookingsService.findOne NotFoundException when the booking is missing', async () => {
      const missing = new NotFoundException('Booking booking-1 not found');
      bookingsService.findOne.mockRejectedValue(missing);

      await expect(service.createFromBooking(command)).rejects.toBe(missing);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a cancelled booking, before opening a transaction', async () => {
      bookingsService.findOne.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(service.createFromBooking(command)).rejects.toThrow(
        new BadRequestException('Cannot create a job from a cancelled booking'),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a job already exists for the booking, before opening a transaction', async () => {
      jobRepository.findOneBy.mockResolvedValue({ id: 'existing-job' });

      await expect(service.createFromBooking(command)).rejects.toThrow(
        new ConflictException('A job already exists for this booking'),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('maps 23505 on UQ_cleaning_job_booking_id to ConflictException', async () => {
      manager.save.mockRejectedValue({
        code: '23505',
        constraint: 'UQ_cleaning_job_booking_id',
      });

      await expect(service.createFromBooking(command)).rejects.toThrow(
        new ConflictException('A job already exists for this booking'),
      );
    });

    it('rethrows a 23505 for any other constraint unchanged', async () => {
      const other = { code: '23505', constraint: 'UQ_something_else' };
      manager.save.mockRejectedValue(other);

      await expect(service.createFromBooking(command)).rejects.toBe(other);
    });

    it('inserts a PENDING job, checklist, the default three items, and job.create audit', async () => {
      const job = await service.createFromBooking(command);

      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.bookingId).toBe('booking-1');
      expect(job.scheduledAt).toEqual(pendingBooking.scheduledAt);
      expect(job.teamId).toBe('team-1');
      expect(job.createdAt).toEqual(job.updatedAt);

      expect(manager.save).toHaveBeenCalledTimes(
        2 + DEFAULT_CHECKLIST_ITEMS.length,
      );
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        action: 'job.create',
        entityType: 'job',
        entityId: job.id,
      });

      const itemPayloads = manager.create.mock.calls
        .map(([, data]: [unknown, Record<string, unknown>]) => data)
        .filter((data) => typeof data.position === 'number');
      expect(itemPayloads).toEqual(
        DEFAULT_CHECKLIST_ITEMS.map((item) => ({
          checklistId: expect.any(String),
          label: item.label,
          position: item.position,
          completed: false,
          completedAt: null,
        })),
      );
    });
  });

  describe('getJob', () => {
    it('returns null when the job is missing', async () => {
      jobRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getJob('missing-id')).resolves.toBeNull();
    });
  });

  describe('listJobs', () => {
    it('returns the full set from find() with no filter or order', async () => {
      const rows = [{ id: 'j1' }];
      jobRepository.find.mockResolvedValue(rows);

      await expect(service.listJobs()).resolves.toBe(rows);
      expect(jobRepository.find).toHaveBeenCalledWith();
    });
  });

  describe('getChecklistsByJobIds', () => {
    it('returns an empty array without querying when ids is empty', async () => {
      await expect(service.getChecklistsByJobIds([])).resolves.toEqual([]);
      expect(checklistRepository.findBy).not.toHaveBeenCalled();
    });

    it('returns exactly the rows found, with no synthetic entries for missing ids', async () => {
      const found = [{ id: 'c1', jobId: 'a' }];
      checklistRepository.findBy.mockResolvedValue(found);

      await expect(service.getChecklistsByJobIds(['a', 'b'])).resolves.toBe(
        found,
      );
    });
  });

  describe('getChecklistItemsByChecklistIds', () => {
    it('returns an empty array without querying when ids is empty', async () => {
      await expect(
        service.getChecklistItemsByChecklistIds([]),
      ).resolves.toEqual([]);
      expect(checklistItemRepository.findBy).not.toHaveBeenCalled();
    });

    it('returns exactly the rows found, with no synthetic entries for missing ids', async () => {
      const found = [{ id: 'i1', checklistId: 'a' }];
      checklistItemRepository.findBy.mockResolvedValue(found);

      await expect(
        service.getChecklistItemsByChecklistIds(['a', 'b']),
      ).resolves.toBe(found);
    });
  });

  const pendingJob = {
    id: 'job-1',
    bookingId: 'booking-1',
    teamId: 'team-1',
    status: JobStatus.PENDING,
    scheduledAt: new Date('2026-09-01T09:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };
  const checklist = { id: 'checklist-1', jobId: 'job-1' };
  const incompleteItem = {
    id: 'item-1',
    checklistId: 'checklist-1',
    completed: false,
    completedAt: null,
    position: 0,
    label: 'Arrive on site',
  };

  describe('assignTeam', () => {
    const command = {
      actorId: 'actor-1',
      jobId: 'job-1',
      teamId: 'team-2',
    };

    it('throws NotFoundException when TeamsService.getTeam returns null, before opening a transaction', async () => {
      teamsService.getTeam.mockResolvedValue(null);

      await expect(service.assignTeam(command)).rejects.toThrow(
        new NotFoundException('Team team-2 not found'),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the job is missing', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(service.assignTeam(command)).rejects.toThrow(
        new NotFoundException('Job job-1 not found'),
      );
    });

    it('throws BadRequestException when the job is COMPLETED', async () => {
      manager.findOneBy.mockResolvedValue({
        ...pendingJob,
        status: JobStatus.COMPLETED,
      });

      await expect(service.assignTeam(command)).rejects.toThrow(
        new BadRequestException('Cannot assign a team to a completed job'),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('same-state assign still updates updatedAt and audits job.assign_team', async () => {
      manager.findOneBy.mockResolvedValue({
        ...pendingJob,
        teamId: 'team-2',
      });
      manager.findOneByOrFail.mockResolvedValue({
        ...pendingJob,
        teamId: 'team-2',
      });

      await service.assignTeam(command);

      expect(manager.update).toHaveBeenCalledWith(
        CleaningJobEntity,
        { id: 'job-1' },
        expect.objectContaining({
          teamId: 'team-2',
          updatedAt: expect.any(Date),
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        action: 'job.assign_team',
        entityType: 'job',
        entityId: 'job-1',
      });
      expect(teamsService.getTeam).toHaveBeenCalledWith('team-2');
    });
  });

  describe('completeChecklistItem', () => {
    const command = {
      actorId: 'actor-1',
      jobId: 'job-1',
      itemId: 'item-1',
    };

    function mockAggregate(opts?: {
      jobStatus?: JobStatus;
      itemCompleted?: boolean;
    }) {
      const job = {
        ...pendingJob,
        status: opts?.jobStatus ?? JobStatus.PENDING,
      };
      const item = {
        ...incompleteItem,
        completed: opts?.itemCompleted ?? false,
      };
      manager.findOneBy.mockImplementation(
        (entityClass: unknown, where: { id?: string; jobId?: string }) => {
          if (entityClass === CleaningJobEntity && where.id === 'job-1') {
            return Promise.resolve(job);
          }
          if (entityClass === ChecklistEntity && where.jobId === 'job-1') {
            return Promise.resolve(checklist);
          }
          if (entityClass === ChecklistItemEntity && where.id === 'item-1') {
            return Promise.resolve(item);
          }
          return Promise.resolve(null);
        },
      );
      manager.findOneByOrFail.mockResolvedValue(job);
      return { job, item };
    }

    it('throws NotFoundException when the job is missing', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(service.completeChecklistItem(command)).rejects.toThrow(
        new NotFoundException('Job job-1 not found'),
      );
    });

    it('throws NotFoundException when the item belongs to a different job', async () => {
      manager.findOneBy.mockImplementation((entityClass: unknown) => {
        if (entityClass === CleaningJobEntity) {
          return Promise.resolve(pendingJob);
        }
        if (entityClass === ChecklistEntity) {
          return Promise.resolve(checklist);
        }
        if (entityClass === ChecklistItemEntity) {
          return Promise.resolve({
            ...incompleteItem,
            checklistId: 'other-checklist',
          });
        }
        return Promise.resolve(null);
      });

      await expect(service.completeChecklistItem(command)).rejects.toThrow(
        new NotFoundException('Checklist item item-1 not found'),
      );
    });

    it('throws BadRequestException on a COMPLETED job', async () => {
      mockAggregate({ jobStatus: JobStatus.COMPLETED });

      await expect(service.completeChecklistItem(command)).rejects.toThrow(
        new BadRequestException(
          'Cannot complete a checklist item on a completed job',
        ),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('first incomplete→complete on PENDING sets IN_PROGRESS, updates the item, bumps updatedAt, and audits', async () => {
      mockAggregate({ jobStatus: JobStatus.PENDING, itemCompleted: false });

      await service.completeChecklistItem(command);

      expect(manager.update).toHaveBeenCalledWith(
        ChecklistItemEntity,
        { id: 'item-1' },
        expect.objectContaining({
          completed: true,
          completedAt: expect.any(Date),
        }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        CleaningJobEntity,
        { id: 'job-1' },
        expect.objectContaining({
          status: JobStatus.IN_PROGRESS,
          updatedAt: expect.any(Date),
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        action: 'job.checklist_item.complete',
        entityType: 'job',
        entityId: 'job-1',
      });
    });

    it('same-state complete on PENDING does not change status, still bumps updatedAt and audits', async () => {
      mockAggregate({ jobStatus: JobStatus.PENDING, itemCompleted: true });

      await service.completeChecklistItem(command);

      expect(manager.update).not.toHaveBeenCalledWith(
        ChecklistItemEntity,
        expect.anything(),
        expect.anything(),
      );
      expect(manager.update).toHaveBeenCalledWith(
        CleaningJobEntity,
        { id: 'job-1' },
        expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      );
      expect(
        manager.update.mock.calls.some(
          (call: [unknown, unknown, { status?: JobStatus }]) => call[2].status,
        ),
      ).toBe(false);
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'job.checklist_item.complete' }),
      );
    });

    it('completing a further item including the last leaves IN_PROGRESS', async () => {
      mockAggregate({
        jobStatus: JobStatus.IN_PROGRESS,
        itemCompleted: false,
      });

      await service.completeChecklistItem(command);

      expect(manager.update).toHaveBeenCalledWith(
        CleaningJobEntity,
        { id: 'job-1' },
        expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      );
      expect(
        manager.update.mock.calls.some(
          (call: [unknown, unknown, { status?: JobStatus }]) =>
            call[2].status === JobStatus.COMPLETED,
        ),
      ).toBe(false);
      expect(
        manager.update.mock.calls.some(
          (call: [unknown, unknown, { status?: JobStatus }]) =>
            call[2].status === JobStatus.IN_PROGRESS,
        ),
      ).toBe(false);
    });
  });

  describe('completeJob', () => {
    const command = { actorId: 'actor-1', jobId: 'job-1' };

    it('throws NotFoundException when the job is missing', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(service.completeJob(command)).rejects.toThrow(
        new NotFoundException('Job job-1 not found'),
      );
    });

    it('throws BadRequestException when any item is incomplete', async () => {
      manager.findOneBy.mockImplementation((entityClass: unknown) => {
        if (entityClass === CleaningJobEntity) {
          return Promise.resolve({
            ...pendingJob,
            status: JobStatus.IN_PROGRESS,
          });
        }
        if (entityClass === ChecklistEntity) {
          return Promise.resolve(checklist);
        }
        return Promise.resolve(null);
      });
      manager.findBy.mockResolvedValue([
        { ...incompleteItem, completed: true },
        { ...incompleteItem, id: 'item-2', completed: false },
      ]);

      await expect(service.completeJob(command)).rejects.toThrow(
        new BadRequestException(
          'Cannot complete a job with incomplete checklist items',
        ),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('sets COMPLETED, bumps updatedAt, and audits when all items are complete', async () => {
      const job = { ...pendingJob, status: JobStatus.IN_PROGRESS };
      manager.findOneBy.mockImplementation((entityClass: unknown) => {
        if (entityClass === CleaningJobEntity) {
          return Promise.resolve(job);
        }
        if (entityClass === ChecklistEntity) {
          return Promise.resolve(checklist);
        }
        return Promise.resolve(null);
      });
      manager.findBy.mockResolvedValue([
        { ...incompleteItem, completed: true },
        { ...incompleteItem, id: 'item-2', completed: true },
        { ...incompleteItem, id: 'item-3', completed: true },
      ]);
      manager.findOneByOrFail.mockResolvedValue({
        ...job,
        status: JobStatus.COMPLETED,
      });

      await service.completeJob(command);

      expect(manager.update).toHaveBeenCalledWith(
        CleaningJobEntity,
        { id: 'job-1' },
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          updatedAt: expect.any(Date),
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        action: 'job.complete',
        entityType: 'job',
        entityId: 'job-1',
      });
    });

    it('same-state completeJob on COMPLETED still bumps updatedAt and audits', async () => {
      const job = { ...pendingJob, status: JobStatus.COMPLETED };
      manager.findOneBy.mockImplementation((entityClass: unknown) => {
        if (entityClass === CleaningJobEntity) {
          return Promise.resolve(job);
        }
        if (entityClass === ChecklistEntity) {
          return Promise.resolve(checklist);
        }
        return Promise.resolve(null);
      });
      manager.findBy.mockResolvedValue([
        { ...incompleteItem, completed: true },
      ]);
      manager.findOneByOrFail.mockResolvedValue(job);

      await service.completeJob(command);

      expect(manager.update).toHaveBeenCalledWith(
        CleaningJobEntity,
        { id: 'job-1' },
        expect.objectContaining({
          status: JobStatus.COMPLETED,
          updatedAt: expect.any(Date),
        }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'job.complete' }),
      );
    });
  });
});
