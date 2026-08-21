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

// No `AuthGuard`/`@Roles()`/audit on any route, reads or mutations alike
// (spec §4.4, §5) — this is the project's original REST-vs-GraphQL
// comparison artifact, retained as-is, not a production-safe surface.
@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    // `actorId: null` — REST has no `AuthGuard`/`@CurrentUser()`, and
    // spec §4.4 requires this surface stay unaudited; `null` is the
    // explicit signal `BookingsService` uses to skip its audit call.
    const command: CreateBookingCommand = { ...dto, actorId: null };
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
    const command: UpdateBookingCommand = { ...dto, actorId: null };
    return this.bookingsService.update(id, command);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id, null);
  }
}
