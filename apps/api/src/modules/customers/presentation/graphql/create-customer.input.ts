import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateCustomerInput {
  @Field()
  @IsString()
  fullName!: string;

  // Syntax validation (spec §4.7) — a presentation-layer concern owned by
  // this input type, not the domain (whose invariant is non-empty only).
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  phone!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
