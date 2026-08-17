import { Field, InputType, PartialType } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateServiceInput } from './create-service.input';

// `id` is a separate mutation argument (`updateService(id: ID!, input:
// UpdateServiceInput!)`), never embedded in this input. `active` is added on
// top of `PartialType(CreateServiceInput)` rather than inherited from it —
// it is not settable at creation (a `Service` always starts `active: true`)
// but IS settable via update (task brief).
@InputType()
export class UpdateServiceInput extends PartialType(CreateServiceInput) {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
