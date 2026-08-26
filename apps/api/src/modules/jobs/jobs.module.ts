import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CleanersModule } from '../cleaners/cleaners.module';
import { JobsService } from './application/services/jobs.service';
import { ChecklistEntity } from './infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from './infrastructure/persistence/checklist-item.entity';
import { CleaningJobEntity } from './infrastructure/persistence/cleaning-job.entity';
import { ChecklistResolver } from './presentation/graphql/checklist.resolver';
import { JobRelationLoaders } from './presentation/graphql/job-relation.loaders';
import { JobResolver } from './presentation/graphql/job.resolver';

// Imports `AuditModule` so `AUDIT_LOGGER` is DI-visible. Imports
// `BookingsModule`/`CleanersModule` for `BookingsService`/`TeamsService`
// only — never Catalog/Customers (nested Booking.customer/property/service
// are resolved by the already-registered BookingResolver). No exports:
// nothing in this slice consumes JobsService (plan §3).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CleaningJobEntity,
      ChecklistEntity,
      ChecklistItemEntity,
    ]),
    AuditModule,
    BookingsModule,
    CleanersModule,
  ],
  providers: [JobsService, JobResolver, ChecklistResolver, JobRelationLoaders],
})
export class JobsModule {}
