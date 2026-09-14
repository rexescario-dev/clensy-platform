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
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';
import { CustomerType, VIEW_ROLES } from './customer.type';

@Resolver(() => CustomerType)
export class CustomerReadResolver extends Relatable(CustomerType, {
  enableAggregate: false,
  enableTotalCount: false,
})(
  ReadResolver(CustomerType, {
    decorators: [Roles(...VIEW_ROLES)],
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    defaultSort: [
      { direction: SortDirection.DESC, field: 'createdAt' },
      { direction: SortDirection.ASC, field: 'id' },
    ],
    enableTotalCount: true,
    guards: [AuthGuard],
    many: { name: 'customers' },
    maxResultsSize: PLATFORM_PAGE_MAX,
    one: { disabled: true },
    pagingStrategy: PagingStrategies.OFFSET,
  }),
) {
  constructor(
    @InjectQueryService(CustomerEntity)
    readonly service: QueryService<CustomerType>,
  ) {
    super(service);
  }
}
