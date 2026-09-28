import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreateBookingCommand } from '../../application/commands/create-booking.command';
import { UpdateBookingCommand } from '../../application/commands/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { VIEW_ROLES, WRITE_ROLES } from '../graphql/booking.dto';
import { CreateBookingDto } from './create-booking.dto';
import { toBookingResponse } from './mappers';
import { UpdateBookingDto } from './update-booking.dto';

// The REST/GraphQL comparison surface, kept deliberately (README), now uses
// the same cookie session, roles, tenant source and audit as GraphQL (RFC
// §4.5; #85 Slice decisions 3–4): `AuthGuard` at the class level covers
// every route, `@Roles()` reuses GraphQL's exact `VIEW_ROLES`/`WRITE_ROLES`
// sets, the tenant comes only from `requireTenantId(currentUser)` (never
// client input, I-2), and the actor from `currentUser.id`. The response
// shape stays unchanged: `toBookingResponse` omits the domain `Booking`'s
// `tenantId` before it reaches the wire.
@ApiTags('bookings')
@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ) {
    const command: CreateBookingCommand = {
      ...dto,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const booking = await this.bookingsService.create(command);
    return toBookingResponse(booking);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  async findAll(@CurrentUser() currentUser: AuthenticatedPrincipal) {
    const bookings = await this.bookingsService.findAll(
      requireTenantId(currentUser),
    );
    return bookings.map(toBookingResponse);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ) {
    const booking = await this.bookingsService.findOne(
      id,
      requireTenantId(currentUser),
    );
    return toBookingResponse(booking);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ) {
    const booking = await this.bookingsService.remove(
      id,
      currentUser.id,
      requireTenantId(currentUser),
    );
    return toBookingResponse(booking);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ) {
    const command: UpdateBookingCommand = {
      ...dto,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const booking = await this.bookingsService.update(id, command);
    return toBookingResponse(booking);
  }
}
