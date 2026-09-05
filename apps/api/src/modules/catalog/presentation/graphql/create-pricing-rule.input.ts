import { Field, ID, InputType, Int, registerEnumType } from '@nestjs/graphql';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PricingUnit } from '../../domain/pricing-unit';

// Registered here — the first (and, in this ticket, only) file that
// declares a `@Field(() => PricingUnit)` — matching `BookingStatus`'s/
// `JobStatus`'s "register where first used as a GraphQL type" precedent.
registerEnumType(PricingUnit, { name: 'PricingUnit' });

// Single `input` object argument (spec §4.5's M3-round-1 change) — NOT
// positional `serviceId`/`priceMinorUnits` mutation arguments, matching the
// shape of every other mutation in this module. `serviceId`/`addOnId` are
// both optional here — exactly one is required, validated at the
// application layer (`PricingRulesService#createPricingRule`), not by a
// class-validator cross-field decorator (Laundry Architecture & Catalog
// Foundation spec §4.6, §4.7). `effectiveTo` is deliberately absent — it is
// never a creation-time value (spec §4.2, §4.4, §4.6).
@InputType()
export class CreatePricingRuleInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  addOnId?: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  priceMinorUnits!: number;

  @Field(() => PricingUnit, { nullable: true })
  @IsOptional()
  @IsEnum(PricingUnit)
  unit?: PricingUnit;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  effectiveFrom?: Date;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumChargeMinorUnits?: number;
}
