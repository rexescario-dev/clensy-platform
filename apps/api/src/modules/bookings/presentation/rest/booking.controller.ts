import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateBookingCommand } from '../../application/commands/create-booking.command';
import { UpdateBookingCommand } from '../../application/commands/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { CreateBookingDto } from './create-booking.dto';
import { UpdateBookingDto } from './update-booking.dto';

@ApiTags('bookings')
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
