import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString } from 'class-validator';

// `@IsString()`, not `@IsUUID()`, on the id fields — matching
// `CreatePropertyInput`'s convention for plain string fields; `whitelist:
// true`/`forbidNonWhitelisted: true` (main.ts) require at least one
// decorator per property, but `@IsUUID()`'s default (all RFC4122
// versions) rejects this project's deterministic, non-v4 seed/fixture ids
// (`00000000-0000-0000-0001-...`) — verified directly by testing the
// create flow against the seeded fixtures. Existence is the server-side
// `NotFoundException` check's job (spec §4.2), not this DTO's format
// validation — no other module in this codebase validates id format
// client-side either.
@InputType()
export class CreateBookingInput {
  @Field(() => ID)
  @IsString()
  customerId!: string;

  @Field(() => ID)
  @IsString()
  propertyId!: string;

  @Field(() => ID)
  @IsString()
  serviceId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  teamId?: string | null;

  @Field()
  @IsDate()
  scheduledAt!: Date;
}
