import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from '../application/services/bookings.service';
import { BookingsResolver } from '../presentation/graphql/bookings.resolver';

describe('BookingsResolver', () => {
  let resolver: BookingsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingsResolver, BookingsService],
    }).compile();

    resolver = module.get<BookingsResolver>(BookingsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
