import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreateBookingCommand } from '../../application/commands/create-booking.command';
import { UpdateBookingCommand } from '../../application/commands/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { BookingDTO } from './booking.dto';
import { CreateBookingInput } from './create-booking.input';
import { toBookingDto } from './mappers';
import { UpdateBookingInput } from './update-booking.input';

const WRITE_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];

@Resolver(() => BookingDTO)
export class BookingMutationResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @Mutation(() => BookingDTO)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async createBooking(
    @Args('createBookingInput') input: CreateBookingInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingDTO> {
    const command: CreateBookingCommand = { ...input, actorId: currentUser.id };
    const booking = await this.bookingsService.create(command);
    return toBookingDto(booking);
  }

  @Mutation(() => BookingDTO)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async updateBooking(
    @Args('updateBookingInput') input: UpdateBookingInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingDTO> {
    const { id, ...changes } = input;
    const command: UpdateBookingCommand = {
      ...changes,
      actorId: currentUser.id,
    };
    const booking = await this.bookingsService.update(id, command);
    return toBookingDto(booking);
  }

  @Mutation(() => BookingDTO)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async removeBooking(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingDTO> {
    const booking = await this.bookingsService.remove(id, currentUser.id);
    return toBookingDto(booking);
  }
}
