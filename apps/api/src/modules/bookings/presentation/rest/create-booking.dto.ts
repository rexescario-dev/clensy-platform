import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

// `@IsString()`, not `@IsUUID()`, on the id fields — see
// create-booking.input.ts's comment (GraphQL counterpart) for the full
// rationale: whitelist mode requires a decorator, `@IsUUID()`'s default
// rejects this project's non-v4 seed/fixture ids, and no other module
// validates id format client-side either.
export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty()
  @IsString()
  serviceId!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  teamId?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;
}
