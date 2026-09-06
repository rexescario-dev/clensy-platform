import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
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
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const relationReadOpts = {
  update: { enabled: false },
  remove: { enabled: false },
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
};

@ObjectType('LaundryOrder')
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
@FilterableRelation('customer', () => CustomerType, {
  nullable: false,
  ...relationReadOpts,
})
@OffsetConnection('lines', () => LaundryOrderLineType, {
  nullable: false,
  enableTotalCount: false,
  relationName: 'lines',
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'createdAt', direction: SortDirection.ASC },
    { field: 'id', direction: SortDirection.ASC },
  ],
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
  update: { enabled: false },
  remove: { enabled: false },
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
