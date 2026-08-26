import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CreateJobFromBookingInput {
  @Field(() => ID)
  @IsString()
  bookingId!: string;
}
