import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
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
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';

const BOOKING_VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

function bookingDto() {
  // Lazy thunk: BookingDTO already imports PropertyType.
  return require('../../../bookings/presentation/graphql/booking.dto')
    .BookingDTO;
}

// Explicit, hand-defined presentation type — never `Property` (the domain
// interface) or `PropertyEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5). Nested `bookings` is Relatable-owned; do not add
// a Clensy `@ResolveField` for it.
@ObjectType('Property')
@QueryOptions({
  pagingStrategy: PagingStrategies.OFFSET,
  enableTotalCount: false,
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'createdAt', direction: SortDirection.DESC },
    { field: 'id', direction: SortDirection.ASC },
  ],
})
@OffsetConnection('bookings', bookingDto, {
  nullable: false,
  enableTotalCount: false,
  relationName: 'bookings',
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: [
    { field: 'scheduledAt', direction: SortDirection.DESC },
    { field: 'id', direction: SortDirection.ASC },
  ],
  guards: [AuthGuard],
  decorators: [Roles(...BOOKING_VIEW_ROLES)],
  update: { enabled: false },
  remove: { enabled: false },
})
export class PropertyType {
  @IDField(() => ID)
  id!: string;

  @Field(() => ID)
  customerId!: string;

  @Field()
  label!: string;

  @FilterableField()
  addressLine1!: string;

  @Field(() => String, { nullable: true })
  addressLine2!: string | null;

  @Field()
  city!: string;

  @Field()
  region!: string;

  @Field()
  postalCode!: string;

  @Field(() => String, { nullable: true })
  accessNotes!: string | null;

  @FilterableField()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
