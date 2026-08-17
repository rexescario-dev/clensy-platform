import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Min } from 'class-validator';

// Single `input` object argument (spec §4.5's M3-round-1 change) — NOT
// positional `serviceId`/`priceMinorUnits` mutation arguments, matching the
// shape of every other mutation in this module.
@InputType()
export class CreatePricingRuleInput {
  @Field(() => ID)
  @IsString()
  serviceId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  priceMinorUnits!: number;
}
