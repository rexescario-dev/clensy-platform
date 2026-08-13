import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { BookingStatus } from '../../domain/booking-status';
import { CreateBookingInput } from './create-booking.input';

@InputType()
export class UpdateBookingInput extends PartialType(CreateBookingInput) {
  @Field(() => ID)
  id!: string;

  @Field(() => BookingStatus, { nullable: true })
  status?: BookingStatus;
}
