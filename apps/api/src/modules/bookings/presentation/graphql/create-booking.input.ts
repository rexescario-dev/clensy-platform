import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class CreateBookingInput {
  @Field(() => ID)
  @IsUUID()
  customerId!: string;

  @Field(() => ID)
  @IsUUID()
  propertyId!: string;

  @Field(() => ID)
  @IsUUID()
  serviceId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @Field()
  @IsDate()
  scheduledAt!: Date;
}
