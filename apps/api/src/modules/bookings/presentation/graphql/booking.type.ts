import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { ServiceType } from '../../../catalog/presentation/graphql/service.type';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { BookingStatus } from '../../domain/booking-status';
import { BookingPricingSnapshotType } from './booking-pricing-snapshot.type';

registerEnumType(BookingStatus, { name: 'BookingStatus' });

// Explicit, hand-defined presentation type — never `Booking` (the domain
// interface) or `BookingEntity` (the TypeORM entity) returned directly.
// Deliberately no `customerId`/`propertyId`/`serviceId`/`teamId` fields —
// mirrors `CleanerType`'s precedent exactly (no `@Field()` for `teamId`):
// GraphQL schema exposure is controlled entirely by `@Field()` decorators,
// so a client reads `booking.customer.id`, never a separate
// `booking.customerId` (plan §3). `customer`/`property`/`service`/`team`
// are presentation-layer-only computed data, populated exclusively by
// `BookingResolver`'s `@ResolveField()` methods — the base
// `booking`/`bookings`/`createBooking`/`updateBooking`/`removeBooking`
// methods return an object typed `Omit<BookingType, 'customer' |
// 'property' | 'service' | 'team'>` cast to `BookingType`.
@ObjectType('Booking')
export class BookingType {
  @Field(() => ID)
  id!: string;

  @Field()
  scheduledAt!: Date;

  @Field(() => BookingStatus)
  status!: BookingStatus;

  @Field(() => BookingPricingSnapshotType)
  pricingSnapshot!: BookingPricingSnapshotType;

  @Field(() => CustomerType)
  customer!: CustomerType;

  @Field(() => PropertyType)
  property!: PropertyType;

  @Field(() => ServiceType)
  service!: ServiceType;

  @Field(() => TeamType, { nullable: true })
  team!: TeamType | null;

  @Field()
  createdAt!: Date;
}
