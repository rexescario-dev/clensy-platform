import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './application/services/bookings.service';
import { BookingEntity } from './infrastructure/persistence/booking.entity';
import { BookingsResolver } from './presentation/graphql/bookings.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity])],
  providers: [BookingsResolver, BookingsService],
})
export class BookingsModule {}
