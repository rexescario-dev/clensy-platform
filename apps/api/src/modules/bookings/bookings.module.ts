import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './application/services/bookings.service';
import { BookingEntity } from './infrastructure/persistence/booking.entity';
import { BookingResolver } from './presentation/graphql/booking.resolver';
import { BookingController } from './presentation/rest/booking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity])],
  controllers: [BookingController],
  providers: [BookingResolver, BookingsService],
})
export class BookingsModule {}
