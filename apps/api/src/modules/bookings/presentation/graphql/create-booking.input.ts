import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateBookingInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @Field()
  @IsDate()
  scheduledAt!: Date;
}
