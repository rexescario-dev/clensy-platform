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
    decorators: [Roles(...VIEW_ROLES)],
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    defaultSort: [
      { direction: SortDirection.DESC, field: 'scheduledAt' },
      { direction: SortDirection.ASC, field: 'id' },
    ],
    enableTotalCount: true,
    guards: [AuthGuard],
    many: { name: 'jobs' },
    maxResultsSize: PLATFORM_PAGE_MAX,
    one: { disabled: true },
    pagingStrategy: PagingStrategies.OFFSET,
  }),
) {
  constructor(
    @InjectQueryService(CleaningJobEntity)
    readonly service: QueryService<CleaningJobType>,
  ) {
    super(service);
  }
}
