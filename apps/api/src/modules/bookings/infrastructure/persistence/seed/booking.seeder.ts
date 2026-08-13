import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingEntity } from '../booking.entity';
import { bookingSeedData } from './booking.seed-data';

@Injectable()
export class BookingSeeder {
  private readonly logger = new Logger(BookingSeeder.name);

  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
  ) {}

  // Explicit operation only — invoked via `pnpm db:seed`, never automatically
  // on application boot. Upsert-based, so re-running it is safe.
  async seed(): Promise<void> {
    await this.bookingRepository.upsert([...bookingSeedData], ['id']);
    this.logger.log(`Seeded ${bookingSeedData.length} fake bookings`);
  }
}
