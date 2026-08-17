import { Field, InputType, PartialType } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAddOnInput } from './create-add-on.input';

// Same reasoning as `UpdateServiceInput`: `id` stays a separate mutation
// argument, and `active` is added on top of `PartialType(CreateAddOnInput)`
// since it is not settable at creation (an `AddOn` always starts
// `active: true`) but IS settable via update (task brief).
@InputType()
export class UpdateAddOnInput extends PartialType(CreateAddOnInput) {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
