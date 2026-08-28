import { getQueryServiceToken } from '@ptc-org/nestjs-query-core';
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { BookingsModule } from '../../bookings/bookings.module';
import { BookingsService } from '../../bookings/application/services/bookings.service';
import { CleanersModule } from '../../cleaners/cleaners.module';
import { TeamsService } from '../../cleaners/application/services/teams.service';
import { JobsModule } from '../jobs.module';
import { JobsService } from '../application/services/jobs.service';
import { CleaningJobEntity } from '../infrastructure/persistence/cleaning-job.entity';
import { ChecklistEntity } from '../infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from '../infrastructure/persistence/checklist-item.entity';

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

@Module({
  providers: [
    {
      provide: BookingsService,
      useValue: { findOne: jest.fn(), getBookingsByIds: jest.fn() },
    },
  ],
  exports: [BookingsService],
})
class FakeBookingsModule {}

@Module({
  providers: [
    {
      provide: TeamsService,
      useValue: { getTeam: jest.fn(), getTeamsByIds: jest.fn() },
    },
  ],
  exports: [TeamsService],
})
class FakeCleanersModule {}

describe('JobsModule — module-internal DI wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, JobsModule],
    })
      .overrideModule(BookingsModule)
      .useModule(FakeBookingsModule)
      .overrideModule(CleanersModule)
      .useModule(FakeCleanersModule)
      .overrideProvider(getRepositoryToken(CleaningJobEntity))
      .useValue({
        find: jest.fn(),
        findOneBy: jest.fn(),
        findBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getRepositoryToken(ChecklistEntity))
      .useValue({
        findBy: jest.fn(),
        findOneBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getRepositoryToken(ChecklistItemEntity))
      .useValue({
        findBy: jest.fn(),
        findOneBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getQueryServiceToken(CleaningJobEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getQueryServiceToken(ChecklistEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getQueryServiceToken(ChecklistItemEntity))
      .useValue({ query: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves JobsService without registering Catalog/Customers entities', () => {
    expect(moduleRef.get(JobsService)).toBeInstanceOf(JobsService);
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });
});
