import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
  FilterableField,
  IDField,
  OffsetConnection,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import type { CleanerType as CleanerTypeClass } from './cleaner.type';

/* eslint-disable @typescript-eslint/no-require-imports -- Lazy thunk below:
   CleanerType imports TeamType, so this must stay a runtime require() (not
   a static import) to avoid a circular import; the `type` import above
   gives it a real type without pulling in a runtime cycle. */
function cleanerDto(): typeof CleanerTypeClass {
  const cleanerModule = require('./cleaner.type') as {
    CleanerType: typeof CleanerTypeClass;
  };
  return cleanerModule.CleanerType;
}
/* eslint-enable @typescript-eslint/no-require-imports */

// Nested `cleaners` is Relatable-owned; do not add a Clensy `@ResolveField`.
@ObjectType('Team')
// Security invariant (multi-tenant spec §4.5): every nestjs-query read of
// this type — the root list/count and every relation that targets it — is
// ANDed with the principal's tenant. `tenantId` is deliberately not a
// GraphQL field; the filter applies to the entity column.
@Authorize(tenantReadAuthorizer<TeamType>())
@QueryOptions({
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.DESC, field: 'createdAt' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: true,
  maxResultsSize: PLATFORM_PAGE_MAX,
  pagingStrategy: PagingStrategies.OFFSET,
})
@OffsetConnection('cleaners', cleanerDto, {
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.DESC, field: 'createdAt' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: false,
  maxResultsSize: PLATFORM_PAGE_MAX,
  nullable: false,
  relationName: 'cleaners',
  remove: { enabled: false },
  update: { enabled: false },
})
export class TeamType {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  name!: string;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
