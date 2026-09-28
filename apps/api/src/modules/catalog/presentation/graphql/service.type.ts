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
import { Role } from '../../../../platform/auth/domain/role';
import { PricingRuleType } from './pricing-rule.type';

export const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

@ObjectType('Service')
// Security invariant (multi-tenant spec §4.5): every nestjs-query read of
// this type — the root list/count and every relation that targets it
// (`Booking.service`) — is ANDed with the principal's tenant. `tenantId` is
// deliberately not a GraphQL field; the filter applies to the entity column.
@Authorize(tenantReadAuthorizer<ServiceType>())
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
export class ServiceType {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int)
  durationMinutes!: number;

  @FilterableField()
  active!: boolean;

  @Field(() => PricingRuleType, { nullable: true })
  activePricing!: PricingRuleType | null;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
