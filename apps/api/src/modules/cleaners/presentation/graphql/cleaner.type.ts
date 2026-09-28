import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
  FilterableField,
  IDField,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { Role } from '../../../../platform/auth/domain/role';
import { TeamType } from './team.type';

export const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.ANALYST,
];

// Explicit, hand-defined presentation type — never `Cleaner` or
// `CleanerEntity` returned directly as a GraphQL type. Deliberately no
// `@Field()` for `teamId`. `team` stays a Clensy `@ResolveField` object
// (not a FilterableRelation and not a collection).
@ObjectType('Cleaner')
// Security invariant (multi-tenant spec §4.5): every nestjs-query read of
// this type — the root list/count and every relation that targets it — is
// ANDed with the principal's tenant. `tenantId` is deliberately not a
// GraphQL field; the filter applies to the entity column.
@Authorize(tenantReadAuthorizer<CleanerType>())
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
export class CleanerType {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  fullName!: string;

  @Field()
  phone!: string;

  @FilterableField()
  email!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => TeamType, { nullable: true })
  team!: TeamType | null;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
