import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import {
  toCustomerType,
  toPropertyType,
} from '../../../customers/presentation/graphql/mappers';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { ServiceType } from '../../../catalog/presentation/graphql/service.type';
import { toServiceType } from '../../../catalog/presentation/graphql/mappers';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { toTeamType } from '../../../cleaners/presentation/graphql/mappers';
import { CreateBookingCommand } from '../../application/commands/create-booking.command';
import { UpdateBookingCommand } from '../../application/commands/update-booking.command';
import { BookingsService } from '../../application/services/bookings.service';
import { Booking } from '../../domain/booking';
import { BookingRelationLoaders } from './booking-relation.loaders';
import { BookingType } from './booking.type';
import { CreateBookingInput } from './create-booking.input';
import { toBookingType } from './mappers';
import { UpdateBookingInput } from './update-booking.input';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];
const WRITE_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];

// Exactly the 5 operations spec §4.5 authorizes — no others.
@Resolver(() => BookingType)
export class BookingResolver {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly loaders: BookingRelationLoaders,
  ) {}

  @Query(() => BookingType, { name: 'booking', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async booking(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BookingType> {
    const booking = await this.bookingsService.findOne(id);
    return toBookingType(booking);
  }

  @Query(() => [BookingType], { name: 'bookings' })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async bookings(): Promise<BookingType[]> {
    const bookings = await this.bookingsService.findAll();
    return bookings.map(toBookingType);
  }

  @Mutation(() => BookingType)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async createBooking(
    @Args('createBookingInput') input: CreateBookingInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingType> {
    const command: CreateBookingCommand = { ...input, actorId: currentUser.id };
    const booking = await this.bookingsService.create(command);
    return toBookingType(booking);
  }

  @Mutation(() => BookingType)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async updateBooking(
    @Args('updateBookingInput') input: UpdateBookingInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingType> {
    const { id, ...changes } = input;
    const command: UpdateBookingCommand = {
      ...changes,
      actorId: currentUser.id,
    };
    const booking = await this.bookingsService.update(id, command);
    return toBookingType(booking);
  }

  @Mutation(() => BookingType)
  @UseGuards(AuthGuard)
  @Roles(...WRITE_ROLES)
  async removeBooking(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<BookingType> {
    const booking = await this.bookingsService.remove(id, currentUser.id);
    return toBookingType(booking);
  }

  // Non-nullable: none of `Customer`/`Property`/`Service` has a delete
  // operation in Phase 1 (spec §4.1), so a booking's references, once
  // validated at creation, are guaranteed resolvable for its lifetime.
  @ResolveField(() => CustomerType)
  async customer(
    @Parent() booking: Pick<Booking, 'customerId'>,
  ): Promise<CustomerType> {
    const customer = await this.loaders.customerLoader.load(booking.customerId);
    return toCustomerType(customer!);
  }

  @ResolveField(() => PropertyType)
  async property(
    @Parent() booking: Pick<Booking, 'propertyId'>,
  ): Promise<PropertyType> {
    const property = await this.loaders.propertyLoader.load(booking.propertyId);
    return toPropertyType(property!);
  }

  @ResolveField(() => ServiceType)
  async service(
    @Parent() booking: Pick<Booking, 'serviceId'>,
  ): Promise<ServiceType> {
    const service = await this.loaders.serviceLoader.load(booking.serviceId);
    return toServiceType(service!);
  }

  @ResolveField(() => TeamType, { nullable: true })
  async team(
    @Parent() booking: Pick<Booking, 'teamId'>,
  ): Promise<TeamType | null> {
    if (booking.teamId === null) {
      return null;
    }
    const team = await this.loaders.teamLoader.load(booking.teamId);
    return team ? toTeamType(team) : null;
  }
}
