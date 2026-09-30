import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
  FilterableField,
  FilterableRelation,
  IDField,
  OffsetConnection,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderLineType } from './laundry-order-line.type';

registerEnumType(LaundryOrderStatus, { name: 'LaundryOrderStatus' });
registerEnumType(LaundryFulfillmentType, { name: 'LaundryFulfillmentType' });

export const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const relationReadOpts = {
  decorators: [Roles(...VIEW_ROLES)],
  guards: [AuthGuard],
  remove: { enabled: false },
  update: { enabled: false },
};

// Security invariant (#87 multi-tenant spec §4.5; slice decision 5): every
// nestjs-query read of this type — the root `laundryOrders` list/count, its
// relation filters (e.g. `laundryOrders(filter: { customer: … })`) and the
// `Invoice.laundryOrder` relation — is ANDed with the principal's tenant.
// `tenantId` is deliberately not a GraphQL field; the filter applies to the
// entity column. `laundryOrder(id)` is a custom query scoped in
// `LaundryOrdersService.getOrder`.
@Authorize(tenantReadAuthorizer<LaundryOrderType>())
@ObjectType('LaundryOrder')
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
@FilterableRelation('customer', () => CustomerType, {
  nullable: false,
  ...relationReadOpts,
})
@OffsetConnection('lines', () => LaundryOrderLineType, {
  decorators: [Roles(...VIEW_ROLES)],
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.ASC, field: 'createdAt' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: false,
  guards: [AuthGuard],
  maxResultsSize: PLATFORM_PAGE_MAX,
  nullable: false,
  relationName: 'lines',
  remove: { enabled: false },
  update: { enabled: false },
})
export class LaundryOrderType {
  @IDField(() => ID)
  id!: string;

  @FilterableField(() => ID)
  customerId!: string;

  @FilterableField(() => LaundryFulfillmentType)
  fulfillmentType!: LaundryFulfillmentType;

  @FilterableField(() => LaundryOrderStatus)
  status!: LaundryOrderStatus;

  @Field(() => Int, { nullable: true })
  weightGrams!: number | null;

  @Field(() => Int, { nullable: true })
  totalMinorUnits!: number | null;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
