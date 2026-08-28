import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  IDField,
  OffsetConnection,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { ID, ObjectType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { ChecklistItemType } from './checklist-item.type';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

@ObjectType('Checklist')
@QueryOptions({
  pagingStrategy: PagingStrategies.OFFSET,
  enableTotalCount: false,
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
})
@OffsetConnection('items', () => ChecklistItemType, {
  nullable: false,
  enableTotalCount: false,
  relationName: 'items',
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'position', direction: SortDirection.ASC },
    { field: 'id', direction: SortDirection.ASC },
  ],
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
  update: { enabled: false },
  remove: { enabled: false },
})
export class ChecklistType {
  @IDField(() => ID)
  id!: string;
}
