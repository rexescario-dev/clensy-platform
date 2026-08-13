import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BookingStatus } from '../../domain/booking-status';

registerEnumType(BookingStatus, { name: 'BookingStatus' });

@ObjectType('Booking')
export class BookingType {
  @Field(() => ID)
  id!: string;

  @Field()
  customerName!: string;

  @Field()
  serviceType!: string;

  @Field()
  scheduledAt!: Date;

  @Field(() => BookingStatus)
  status!: BookingStatus;

  @Field()
  createdAt!: Date;
}
