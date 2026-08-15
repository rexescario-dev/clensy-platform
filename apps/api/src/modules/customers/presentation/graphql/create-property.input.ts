import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

// No `customerId` field — it is a separate mutation argument
// (`createProperty(customerId: ID!, input: CreatePropertyInput!)`, spec
// §4.5), not part of this input.
@InputType()
export class CreatePropertyInput {
  @Field()
  @IsString()
  label!: string;

  @Field()
  @IsString()
  addressLine1!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  addressLine2?: string | null;

  @Field()
  @IsString()
  city!: string;

  @Field()
  @IsString()
  region!: string;

  @Field()
  @IsString()
  postalCode!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  accessNotes?: string | null;
}
