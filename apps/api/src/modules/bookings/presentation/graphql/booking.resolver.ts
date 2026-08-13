import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BookingsService } from '../../application/services/bookings.service';
import { BookingType } from './booking.type';
import { CreateBookingInput } from './create-booking.input';
import { UpdateBookingInput } from './update-booking.input';

@Resolver(() => BookingType)
export class BookingResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @Mutation(() => BookingType)
  createBooking(@Args('createBookingInput') input: CreateBookingInput) {
    return this.bookingsService.create(input);
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
    const { id, ...command } = input;
    return this.bookingsService.update(id, command);
  }

  @Mutation(() => BookingType)
  removeBooking(@Args('id', { type: () => ID }) id: string) {
    return this.bookingsService.remove(id);
  }
}
