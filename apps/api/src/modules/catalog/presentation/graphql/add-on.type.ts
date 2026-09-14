import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
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

@ObjectType('AddOn')
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
