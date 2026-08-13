import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateBookingCommand } from '../../application/inputs/create-booking.command';
import { UpdateBookingCommand } from '../../application/inputs/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { BookingType } from './booking.type';
import { CreateBookingInput } from './create-booking.input';
import { UpdateBookingInput } from './update-booking.input';

@Resolver(() => BookingType)
export class BookingResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @Mutation(() => BookingType)
  createBooking(@Args('createBookingInput') input: CreateBookingInput) {
    const command: CreateBookingCommand = {
      customerName: input.customerName,
      serviceType: input.serviceType,
      scheduledAt: input.scheduledAt,
    };
    return this.bookingsService.create(command);
  }

  @Query(() => [BookingType], { name: 'bookings' })
  findAll() {
    return this.bookingsService.findAll();
  }

  @Query(() => BookingType, { name: 'booking' })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.bookingsService.findOne(id);
  }

  @Mutation(() => BookingType)
  updateBooking(@Args('updateBookingInput') input: UpdateBookingInput) {
    const command: UpdateBookingCommand = {
      customerName: input.customerName,
      serviceType: input.serviceType,
      scheduledAt: input.scheduledAt,
      status: input.status,
    };
    return this.bookingsService.update(input.id, command);
  }

  @Mutation(() => BookingType)
  removeBooking(@Args('id', { type: () => ID }) id: string) {
    return this.bookingsService.remove(id);
  }
}
