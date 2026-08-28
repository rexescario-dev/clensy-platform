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
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { disabled: true },
    many: { name: 'cleaners' },
    pagingStrategy: PagingStrategies.OFFSET,
    enableTotalCount: true,
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    maxResultsSize: PLATFORM_PAGE_MAX,
    defaultSort: [
      { field: 'createdAt', direction: SortDirection.DESC },
      { field: 'id', direction: SortDirection.ASC },
    ],
  }),
) {
  constructor(
    @InjectQueryService(CleanerEntity)
    readonly service: QueryService<CleanerType>,
  ) {
    super(service);
  }
}
