import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
  FilterableField,
  IDField,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';

@ObjectType('AddOn')
// Security invariant (multi-tenant spec §4.5): every nestjs-query read of
// this type — the root list/count; no relation currently targets `AddOn` —
// is ANDed with the principal's tenant. `tenantId` is deliberately not a
// GraphQL field; the filter applies to the entity column.
@Authorize(tenantReadAuthorizer<AddOnType>())
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
export class AddOnType {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int)
  priceMinorUnits!: number;

  @FilterableField()
  active!: boolean;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
