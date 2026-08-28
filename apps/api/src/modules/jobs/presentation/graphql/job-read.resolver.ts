import {
  InjectQueryService,
  QueryService,
  SortDirection,
} from '@ptc-org/nestjs-query-core';
import {
  PagingStrategies,
  ReadResolver,
  Relatable,
} from '@ptc-org/nestjs-query-graphql';
import { Resolver } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CleaningJobEntity } from '../../infrastructure/persistence/cleaning-job.entity';
import { CleaningJobType, VIEW_ROLES } from './cleaning-job.type';

@Resolver(() => CleaningJobType)
export class JobReadResolver extends Relatable(CleaningJobType, {
  enableAggregate: false,
  enableTotalCount: true,
})(
  ReadResolver(CleaningJobType, {
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { disabled: true },
    many: { name: 'jobs' },
    pagingStrategy: PagingStrategies.OFFSET,
    enableTotalCount: true,
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    maxResultsSize: PLATFORM_PAGE_MAX,
    defaultSort: [
      { field: 'scheduledAt', direction: SortDirection.DESC },
      { field: 'id', direction: SortDirection.ASC },
    ],
  }),
) {
  constructor(
    @InjectQueryService(CleaningJobEntity)
    readonly service: QueryService<CleaningJobType>,
  ) {
    super(service);
  }
}
