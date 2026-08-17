import { Module } from '@nestjs/common';
import { BookingsModule } from '../modules/bookings/bookings.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { CleanersModule } from '../modules/cleaners/cleaners.module';
import { CustomersModule } from '../modules/customers/customers.module';
import { AdminIdentityLookupService } from '../modules/admins/infrastructure/admin-identity-lookup.service';
import { AdminsModule } from '../modules/admins/admins.module';
import { AdminResolver } from '../modules/admins/presentation/graphql/admin.resolver';
import { AppConfigModule } from '../platform/config/config.module';
import { AuditModule } from '../platform/audit/audit.module';
import { AuthModule } from '../platform/auth/auth.module';
import { DatabaseModule } from '../platform/database/database.module';
import { GraphqlModule } from '../platform/graphql/graphql.module';

// Composition root (spec §3 / plan §3): the only place `AuthModule` and
// `AdminsModule` are wired together. `AuthModule` itself never imports
// `AdminsModule` in its own static metadata (see `auth.module.ts`'s own
// comment) — `forRootAsync()` takes `AdminsModule` and
// `AdminIdentityLookupService` as caller-supplied config instead, exactly
// as proven by Task 4's own composition-root proof test
// (`platform/auth/tests/auth.module.composition-root.spec.ts`).
//
// `AdminResolver` (Task 5) is registered in THIS module's own `providers`
// rather than `AdminsModule`'s — confirmed necessary by an actual `nest
// start` boot attempt (see `modules/admins/admins.module.ts`'s comment for
// the full explanation): it depends on both `AdminsModule`'s exports
// (`AdminsService`, `LoginService`) and `AuthModule`'s exports
// (`TokenService`, `AuthGuard`), and `AppModule` is the only module that
// imports both side by side, so it's the only place all four are
// simultaneously visible to a single provider's constructor.
@Module({
  imports: [
    AppConfigModule,
    GraphqlModule,
    DatabaseModule,
    AuditModule,
    AdminsModule,
    AuthModule.forRootAsync({
      imports: [AdminsModule],
      inject: [AdminIdentityLookupService],
      useFactory: (service: AdminIdentityLookupService) => service,
    }),
    BookingsModule,
    CatalogModule,
    CleanersModule,
    CustomersModule,
  ],
  providers: [AdminResolver],
})
export class AppModule {}
