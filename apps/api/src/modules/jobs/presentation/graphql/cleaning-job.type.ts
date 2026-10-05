import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
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
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { Role } from '../../../../platform/auth/domain/role';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { JobStatus } from '../../domain/job-status';
import { ChecklistType } from './checklist.type';

registerEnumType(JobStatus, { name: 'JobStatus' });

export const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

// No relation-level guards or `@Roles()`: a relation field is authorized
// by the root operation that reaches it, and its target's authorizer
// re-applies the tenant predicate (multi-tenant RFC §4.2 relation-field
// rules, #106).
const relationReadOpts = {
  remove: { enabled: false },
  update: { enabled: false },
};

@ObjectType('CleaningJob')
// Security invariant (#86 multi-tenant spec §4.5): every nestjs-query read
// of this type — the root `jobs` list/count and its relation filters (e.g.
// `jobs(filter: { booking: … })`) — is ANDed with the principal's tenant.
// `tenantId` is deliberately not a GraphQL field; the filter applies to the
// entity column. `job(id)` is a custom query scoped in `JobsService.getJob`.
@Authorize(tenantReadAuthorizer<CleaningJobType>())
@QueryOptions({
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.DESC, field: 'scheduledAt' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: true,
  maxResultsSize: PLATFORM_PAGE_MAX,
  pagingStrategy: PagingStrategies.OFFSET,
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
