import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreateBookingCommand } from '../../application/commands/create-booking.command';
import { UpdateBookingCommand } from '../../application/commands/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { BookingDTO, WRITE_ROLES } from './booking.dto';
import { CreateBookingInput } from './create-booking.input';
import { toBookingDto } from './mappers';
import { UpdateBookingInput } from './update-booking.input';

// The tenant comes only from the DB-loaded principal (#85 Slice decisions 3,
// 7), never from GraphQL input: `requireTenantId(currentUser)` throws
// `ForbiddenException` before `BookingsService` is called for the
// unreachable-in-practice null-tenant case (every `@Roles(...WRITE_ROLES)`
// caller excludes SUPER_ADMIN, the only role that can carry it).
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
    const command: CreateBookingCommand = {
      ...input,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const booking = await this.bookingsService.create(command);
    return toBookingDto(booking);
  }

  @Mutation(() => BookingDTO)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async removeBooking(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingDTO> {
    const booking = await this.bookingsService.remove(
      id,
      currentUser.id,
      requireTenantId(currentUser),
    );
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
      tenantId: requireTenantId(currentUser),
    };
    const booking = await this.bookingsService.update(id, command);
    return toBookingDto(booking);
  }
}
