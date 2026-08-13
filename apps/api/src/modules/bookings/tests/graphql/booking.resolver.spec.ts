import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from '../../application/services/bookings.service';
import { BookingResolver } from '../../presentation/graphql/booking.resolver';

describe('BookingResolver', () => {
  let resolver: BookingResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingResolver, BookingsService],
    }).compile();

    resolver = module.get<BookingResolver>(BookingResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
