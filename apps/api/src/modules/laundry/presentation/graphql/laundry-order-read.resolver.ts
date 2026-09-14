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
import { LaundryOrderEntity } from '../../infrastructure/persistence/laundry-order.entity';
import { LaundryOrderType, VIEW_ROLES } from './laundry-order.type';

// Root offset connection `laundryOrders` + the `customer` relation and the
// nested `lines` connection (both declared on `LaundryOrderType`, wired by
// `Relatable`). `one` is disabled — the nullable single-order query is a
// hand-written `@Query` on `LaundryOrderResolver` (the `JobResolver.job`
// precedent; nestjs-query's generated `one` is non-nullable / throws).
@Resolver(() => LaundryOrderType)
export class LaundryOrderReadResolver extends Relatable(LaundryOrderType, {
  enableAggregate: false,
  enableTotalCount: true,
})(
  ReadResolver(LaundryOrderType, {
    decorators: [Roles(...VIEW_ROLES)],
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    defaultSort: [
      { direction: SortDirection.DESC, field: 'createdAt' },
      { direction: SortDirection.ASC, field: 'id' },
    ],
    enableTotalCount: true,
    guards: [AuthGuard],
    many: { name: 'laundryOrders' },
    maxResultsSize: PLATFORM_PAGE_MAX,
    one: { disabled: true },
    pagingStrategy: PagingStrategies.OFFSET,
  }),
) {
  constructor(
    @InjectQueryService(LaundryOrderEntity)
    readonly service: QueryService<LaundryOrderType>,
  ) {
    super(service);
  }
}
