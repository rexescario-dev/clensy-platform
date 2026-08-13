import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './application/services/bookings.service';
import { BookingEntity } from './infrastructure/persistence/booking.entity';
import { BookingResolver } from './presentation/graphql/booking.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity])],
  providers: [BookingResolver, BookingsService],
})
export class BookingsModule {}
