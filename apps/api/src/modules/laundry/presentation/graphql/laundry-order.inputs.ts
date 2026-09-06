import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';

// `@IsString()` (not `@IsUUID()`) on id fields — the `CreateBookingInput`
// convention: existence is the server-side `NotFoundException` check's job,
// not this DTO's, and `@IsUUID()` rejects this project's deterministic
// non-v4 seed ids.

@InputType()
export class ReceiveLaundryOrderInput {
  @Field(() => ID)
  @IsString()
  customerId!: string;

  @Field(() => LaundryFulfillmentType)
  fulfillmentType!: LaundryFulfillmentType;
}

@InputType()
export class WeighLaundryOrderInput {
  @Field(() => ID)
  @IsString()
  orderId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  weightGrams!: number;
}

@InputType()
export class LaundryOrderAddOnInput {
  @Field(() => ID)
  @IsString()
  addOnId!: string;

  // Honoured only when the resolved rule's unit is PER_ITEM (spec §4.5 3a).
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

@InputType()
export class PriceLaundryOrderInput {
  @Field(() => ID)
  @IsString()
  orderId!: string;

  @Field(() => ID)
  @IsString()
  baseServiceId!: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseQuantity?: number;

  @Field(() => [LaundryOrderAddOnInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LaundryOrderAddOnInput)
  addOns!: LaundryOrderAddOnInput[];
}

@InputType()
export class LaundryOrderRefInput {
  @Field(() => ID)
  @IsString()
  orderId!: string;
}
