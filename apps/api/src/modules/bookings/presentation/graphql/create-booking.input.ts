import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateBookingInput {
  @Field()
  customerName!: string;

  @Field()
  serviceType!: string;

  @Field()
  scheduledAt!: Date;
}
