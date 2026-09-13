import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  FilterableField,
  IDField,
  OffsetConnection,
  PagingStrategies,
  QueryArgsType,
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
import type { BookingDTO as BookingDTOClass } from '../../../bookings/presentation/graphql/booking.dto';

const BOOKING_VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

/* eslint-disable @typescript-eslint/no-require-imports -- Lazy thunk below:
   BookingDTO already imports PropertyType, so this must stay a runtime
   require() (not a static import) to avoid a circular import; the `type`
   import above gives it a real type without pulling in a runtime cycle. */
function bookingDto(): typeof BookingDTOClass {
  const bookingModule =
    require('../../../bookings/presentation/graphql/booking.dto') as {
      BookingDTO: typeof BookingDTOClass;
    };
  return bookingModule.BookingDTO;
}
/* eslint-enable @typescript-eslint/no-require-imports */

const PROPERTY_SORT = [
  { field: 'createdAt' as const, direction: SortDirection.DESC },
  { field: 'id' as const, direction: SortDirection.ASC },
];

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
  defaultSort: PROPERTY_SORT,
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

  @FilterableField(() => ID)
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

/**
 * Root `customerProperties` page args — 9.5.0 QueryArgsType + ConnectionType.
 * `customerId` is a sibling GraphQL argument (not a QueryArgs field): a
 * subclass extra field is rejected by the global whitelist ValidationPipe
 * because Nest validates the generated parent QueryArgs class.
 */
export const CustomerPropertiesQueryArgs = QueryArgsType(PropertyType, {
  connectionName: 'PropertyConnection',
  pagingStrategy: PagingStrategies.OFFSET,
  enableTotalCount: true,
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  maxResultsSize: PLATFORM_PAGE_MAX,
  defaultSort: PROPERTY_SORT,
});
