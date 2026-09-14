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
import { CleanerEntity } from '../../infrastructure/persistence/cleaner.entity';
import { CleanerType, VIEW_ROLES } from './cleaner.type';

@Resolver(() => CleanerType)
export class CleanerReadResolver extends Relatable(CleanerType, {
  enableAggregate: false,
  enableTotalCount: false,
})(
  ReadResolver(CleanerType, {
    decorators: [Roles(...VIEW_ROLES)],
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    defaultSort: [
      { direction: SortDirection.DESC, field: 'createdAt' },
      { direction: SortDirection.ASC, field: 'id' },
    ],
    enableTotalCount: true,
    guards: [AuthGuard],
    many: { name: 'cleaners' },
    maxResultsSize: PLATFORM_PAGE_MAX,
    one: { disabled: true },
    pagingStrategy: PagingStrategies.OFFSET,
  }),
) {
  constructor(
    @InjectQueryService(CleanerEntity)
    readonly service: QueryService<CleanerType>,
  ) {
    super(service);
  }
}
