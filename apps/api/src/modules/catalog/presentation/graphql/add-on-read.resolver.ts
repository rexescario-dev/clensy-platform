import {
  InjectQueryService,
  QueryService,
  SortDirection,
} from '@ptc-org/nestjs-query-core';
import { PagingStrategies, ReadResolver } from '@ptc-org/nestjs-query-graphql';
import { Resolver } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { AddOnEntity } from '../../infrastructure/persistence/add-on.entity';
import { VIEW_ROLES } from './service.type';
import { AddOnType } from './add-on.type';

@Resolver(() => AddOnType)
export class AddOnReadResolver extends ReadResolver(AddOnType, {
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
  one: { disabled: true },
  many: { name: 'addOns' },
  pagingStrategy: PagingStrategies.OFFSET,
  enableTotalCount: true,
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'createdAt', direction: SortDirection.DESC },
    { field: 'id', direction: SortDirection.ASC },
  ],
}) {
  constructor(
    @InjectQueryService(AddOnEntity)
    readonly service: QueryService<AddOnType>,
  ) {
    super(service);
  }
}
