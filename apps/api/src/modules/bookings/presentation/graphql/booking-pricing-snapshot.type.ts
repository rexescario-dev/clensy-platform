import { Field, Int, ObjectType } from '@nestjs/graphql';

// A direct (non-computed) nested field of `BookingType` (spec §4.5) — the
// service's active price at booking-creation time, never re-resolved.
@ObjectType('BookingPricingSnapshot')
export class BookingPricingSnapshotType {
  @Field(() => Int)
  priceMinorUnits!: number;
}
