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
  decorators: [Roles(...VIEW_ROLES)],
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.DESC, field: 'createdAt' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: true,
  guards: [AuthGuard],
  many: { name: 'addOns' },
  maxResultsSize: PLATFORM_PAGE_MAX,
  one: { disabled: true },
  pagingStrategy: PagingStrategies.OFFSET,
}) {
  constructor(
    @InjectQueryService(AddOnEntity)
    readonly service: QueryService<AddOnType>,
  ) {
    super(service);
  }
}
