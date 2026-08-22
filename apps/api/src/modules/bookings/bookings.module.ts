import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CleanersModule } from '../cleaners/cleaners.module';
import { CustomersModule } from '../customers/customers.module';
import { BookingsService } from './application/services/bookings.service';
import { BookingEntity } from './infrastructure/persistence/booking.entity';
import { BookingSeeder } from './infrastructure/persistence/seed/booking.seeder';
import { BookingRelationLoaders } from './presentation/graphql/booking-relation.loaders';
import { BookingResolver } from './presentation/graphql/booking.resolver';
import { BookingController } from './presentation/rest/booking.controller';

// Imports `AuditModule` directly (mirroring every other module's precedent)
// so `AUDIT_LOGGER` is DI-visible to `BookingsService`. Imports
// `CustomersModule`/`CatalogModule`/`CleanersModule` so `BookingsService`
// can inject their exported application services
// (`CustomersService`/`PropertiesService`, `ServicesService`/
// `PricingRulesService`, `TeamsService`) for its cross-module validation
// chain (spec §4.2) — never those modules' entities/repositories directly
// (spec §2.6). No new entity/repository token is registered here; the
// seeder's own cross-module fixture data lives in
// `platform/database/seed.ts` instead (plan §3, Task 5).
@Module({
  imports: [
    TypeOrmModule.forFeature([BookingEntity]),
    AuditModule,
    CustomersModule,
    CatalogModule,
    CleanersModule,
  ],
  controllers: [BookingController],
  providers: [
    BookingResolver,
    BookingsService,
    BookingSeeder,
    BookingRelationLoaders,
  ],
})
export class BookingsModule {}
