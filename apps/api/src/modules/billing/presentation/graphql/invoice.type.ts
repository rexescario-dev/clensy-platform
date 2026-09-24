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
import { LaundryOrderType } from '../../../laundry/presentation/graphql/laundry-order.type';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';
import { InvoiceLineType } from './invoice-line.type';

registerEnumType(InvoicePaymentStatus, { name: 'InvoicePaymentStatus' });
registerEnumType(InvoicePaymentTerms, { name: 'InvoicePaymentTerms' });

// All six roles read invoices, matching every other module.
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

// The billing document (spec §4.2, §4.7). Its commercial fields are frozen
// at generation; `amountPaidMinorUnits` / `paymentStatus` are the #39
// mutation surface. `amountDueMinorUnits` is a computed `@ResolveField` on
// `InvoiceResolver` (`total - amountPaid`) — never a stored column.
@ObjectType('Invoice')
@QueryOptions({
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.DESC, field: 'issueDate' },
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
@FilterableRelation('laundryOrder', () => LaundryOrderType, {
  nullable: false,
  ...relationReadOpts,
})
@OffsetConnection('lines', () => InvoiceLineType, {
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
export class InvoiceType {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  invoiceNumber!: string;

  @FilterableField(() => ID)
  laundryOrderId!: string;

  @FilterableField(() => ID)
  customerId!: string;

  @Field(() => Int)
  subtotalMinorUnits!: number;

  @Field(() => Int)
  discountMinorUnits!: number;

  @Field(() => Int)
  totalMinorUnits!: number;

  @Field(() => Int)
  amountPaidMinorUnits!: number;

  @FilterableField(() => InvoicePaymentStatus)
  paymentStatus!: InvoicePaymentStatus;

  @Field(() => InvoicePaymentTerms)
  paymentTerms!: InvoicePaymentTerms;

  @FilterableField()
  issueDate!: Date;

  @Field(() => Date, { nullable: true })
  dueDate!: Date | null;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
