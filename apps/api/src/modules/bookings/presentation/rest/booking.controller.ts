import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateBookingCommand } from '../../application/commands/create-booking.command';
import { UpdateBookingCommand } from '../../application/commands/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { CreateBookingDto } from './create-booking.dto';
import { UpdateBookingDto } from './update-booking.dto';

// class-validator/class-transformer decorated DTOs are REST-only. Scoping the
// ValidationPipe here (rather than app.useGlobalPipes in main.ts) keeps it off
// GraphQL resolver arguments, which have no class-validator decorators and would
// otherwise get their fields stripped/rejected by whitelist/forbidNonWhitelisted.
@UsePipes(
  new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
)
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    const command: CreateBookingCommand = {
      customerName: dto.customerName,
      serviceType: dto.serviceType,
      scheduledAt: dto.scheduledAt,
    };
    return this.bookingsService.create(command);
  }

  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    const command: UpdateBookingCommand = {
      customerName: dto.customerName,
      serviceType: dto.serviceType,
      scheduledAt: dto.scheduledAt,
      status: dto.status,
    };
    return this.bookingsService.update(id, command);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
