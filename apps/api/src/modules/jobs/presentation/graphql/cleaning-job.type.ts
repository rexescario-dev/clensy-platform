import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  FilterableField,
  FilterableRelation,
  IDField,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { JobStatus } from '../../domain/job-status';
import { ChecklistType } from './checklist.type';

registerEnumType(JobStatus, { name: 'JobStatus' });

export const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const relationReadOpts = {
  update: { enabled: false },
  remove: { enabled: false },
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
};

@ObjectType('CleaningJob')
@QueryOptions({
  pagingStrategy: PagingStrategies.OFFSET,
  enableTotalCount: true,
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'scheduledAt', direction: SortDirection.DESC },
    { field: 'id', direction: SortDirection.ASC },
  ],
})
@FilterableRelation('booking', () => BookingDTO, {
  nullable: false,
  ...relationReadOpts,
})
export class CleaningJobType {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  scheduledAt!: Date;

  @FilterableField(() => JobStatus)
  status!: JobStatus;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => TeamType, { nullable: true })
  team!: TeamType | null;

  @Field(() => ChecklistType)
  checklist!: ChecklistType;
}
