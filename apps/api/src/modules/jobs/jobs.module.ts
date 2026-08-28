import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CleanersModule } from '../cleaners/cleaners.module';
import { JobsService } from './application/services/jobs.service';
import { ChecklistEntity } from './infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from './infrastructure/persistence/checklist-item.entity';
import { CleaningJobEntity } from './infrastructure/persistence/cleaning-job.entity';
import { ChecklistReadResolver } from './presentation/graphql/checklist-read.resolver';
import { CleaningJobType } from './presentation/graphql/cleaning-job.type';
import { ChecklistType } from './presentation/graphql/checklist.type';
import { ChecklistItemType } from './presentation/graphql/checklist-item.type';
import { JobReadResolver } from './presentation/graphql/job-read.resolver';
import { JobRelationLoaders } from './presentation/graphql/job-relation.loaders';
import { JobResolver } from './presentation/graphql/job.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CleaningJobEntity,
      ChecklistEntity,
      ChecklistItemEntity,
    ]),
    NestjsQueryTypeOrmModule.forFeature([
      CleaningJobEntity,
      ChecklistEntity,
      ChecklistItemEntity,
    ]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [
        { DTOClass: CleaningJobType },
        { DTOClass: ChecklistType },
        { DTOClass: ChecklistItemType },
      ],
    }),
    AuditModule,
    BookingsModule,
    CleanersModule,
  ],
  providers: [
    JobsService,
    JobResolver,
    JobReadResolver,
    ChecklistReadResolver,
    JobRelationLoaders,
  ],
})
export class JobsModule {}
