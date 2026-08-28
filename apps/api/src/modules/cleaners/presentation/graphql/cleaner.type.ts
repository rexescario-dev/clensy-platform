import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
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
import { Role } from '../../../../platform/auth/domain/role';
import { TeamType } from './team.type';

export const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.ANALYST,
];

// Explicit, hand-defined presentation type — never `Cleaner` or
// `CleanerEntity` returned directly as a GraphQL type. Deliberately no
// `@Field()` for `teamId`. `team` stays a Clensy `@ResolveField` object
// (not a FilterableRelation and not a collection).
@ObjectType('Cleaner')
@QueryOptions({
  pagingStrategy: PagingStrategies.OFFSET,
  enableTotalCount: true,
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'createdAt', direction: SortDirection.DESC },
    { field: 'id', direction: SortDirection.ASC },
  ],
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
