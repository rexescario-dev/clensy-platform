import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CleanersModule } from '../cleaners/cleaners.module';
import { CustomersModule } from '../customers/customers.module';
import { BookingsService } from './application/services/bookings.service';
import { BookingEntity } from './infrastructure/persistence/booking.entity';
import { BookingSeeder } from './infrastructure/persistence/seed/booking.seeder';
import { BookingDTO } from './presentation/graphql/booking.dto';
import { BookingReadResolver } from './presentation/graphql/booking-read.resolver';
import { BookingMutationResolver } from './presentation/graphql/booking.resolver';
import { BookingController } from './presentation/rest/booking.controller';

// NestjsQueryTypeOrmModule.forFeature registers BookingEntity only — owning
// modules remain the only registrants of Customer/Property/Service/Team
// QueryServices (spec §4.1, §4.9#10). TypeOrmModule.forFeature stays
// because BookingsService injects @InjectRepository(BookingEntity).
@Module({
  imports: [
    TypeOrmModule.forFeature([BookingEntity]),
    NestjsQueryTypeOrmModule.forFeature([BookingEntity]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [{ DTOClass: BookingDTO }],
    }),
    AuditModule,
    CustomersModule,
    CatalogModule,
    CleanersModule,
  ],
  controllers: [BookingController],
  providers: [
    BookingReadResolver,
    BookingMutationResolver,
    BookingsService,
    BookingSeeder,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
