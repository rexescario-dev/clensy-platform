import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BookingStatus } from '../../domain/booking-status';

// Its own explicit shape, not `PartialType(CreateBookingInput)` — that
// would make `customerId`/`propertyId`/`serviceId` merely optional rather
// than absent (spec §4.2); they are immutable after creation.
@InputType()
export class UpdateBookingInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  scheduledAt?: Date;

  @Field(() => BookingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}
