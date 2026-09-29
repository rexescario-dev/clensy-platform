import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
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
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { ChecklistItemType } from './checklist-item.type';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

@ObjectType('Checklist')
// Security invariant (#86 Slice decision 5): fail-closed insurance. No
// nestjs-query path reads checklists today (`ChecklistReadResolver`'s roots
// are disabled and no relation targets this type; `CleaningJob.checklist`
// is the tenant-scoped loader), but a root or relation enabled later is
// ANDed with the principal's tenant. It does not filter `items`: a
// relation's filter comes from the target DTO's authorizer, and
// `ChecklistItemType` has none (items are owned via their checklist, #86
// Slice decision 2).
@Authorize(tenantReadAuthorizer<ChecklistType>())
@QueryOptions({
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  enableTotalCount: false,
  maxResultsSize: PLATFORM_PAGE_MAX,
  pagingStrategy: PagingStrategies.OFFSET,
})
@OffsetConnection('items', () => ChecklistItemType, {
  decorators: [Roles(...VIEW_ROLES)],
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.ASC, field: 'position' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: false,
  guards: [AuthGuard],
  maxResultsSize: PLATFORM_PAGE_MAX,
  nullable: false,
  relationName: 'items',
  remove: { enabled: false },
  update: { enabled: false },
})
export class ChecklistType {
  @IDField(() => ID)
  id!: string;
}
