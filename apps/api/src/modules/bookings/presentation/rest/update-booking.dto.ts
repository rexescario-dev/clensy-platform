import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BookingStatus } from '../../domain/booking-status';

// Its own explicit shape, not `PartialType(CreateBookingDto)` — that would
// make `customerId`/`propertyId`/`serviceId` merely optional rather than
// absent (spec §4.2); they are immutable after creation and are not fields
// of this DTO at all.
export class UpdateBookingDto {
  @ApiProperty({ type: String, format: 'date-time', required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiProperty({ enum: BookingStatus, required: false })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}
