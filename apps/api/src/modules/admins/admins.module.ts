import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { AdminsService } from './application/services/admins.service';
import { LoginService } from './application/services/login.service';
import { AdminIdentityLookupService } from './infrastructure/admin-identity-lookup.service';
import { AdminUserEntity } from './infrastructure/persistence/admin-user.entity';

// Imports `AuditModule` (for the `AUDIT_LOGGER` token `AdminsService`/
// `LoginService` inject) but deliberately does NOT import `AuthModule`
// (Task 4) — the dependency direction is `platform/auth` -> this module's
// `AdminIdentityLookupService` (spec §5.2), never the reverse.
// `AdminIdentityLookupService` is exported as a plain provider, not bound to
// the `ADMIN_IDENTITY_LOOKUP` token here — Task 6's composition root does
// that binding.
//
// `AdminResolver` (Task 5) is registered in `AppModule`'s own `providers`,
// NOT here, despite `BookingResolver`'s same-module convention in
// `modules/bookings/bookings.module.ts` — verified by an actual `nest
// start` boot attempt during Task 6 (not just reasoned about): unlike
// `BookingResolver`, `AdminResolver` depends on both this module's exports
// (`AdminsService`, `LoginService`) AND `AuthModule`'s exports
// (`TokenService`, `AuthGuard`). Registering it here would require this
// module to import `AuthModule.forRootAsync({ imports: [AdminsModule], ...
// })` — a call that needs `AdminsModule` (this very class, mid-declaration)
// as one of its own inputs, which NestJS cannot resolve (confirmed via
// `UnknownDependenciesException` at boot: "Nest can't resolve dependencies
// of AdminResolver ... TokenService at index [2] is available in
// AdminsModule"). `AppModule`, which imports both this module and
// `AuthModule.forRootAsync(...)` side by side, is the only place both
// export sets are simultaneously visible without duplicating `AuthModule`'s
// dynamic module (and re-registering the `'jwt'` passport strategy a
// second time). See `app/app.module.ts`.
@Module({
  imports: [TypeOrmModule.forFeature([AdminUserEntity]), AuditModule],
  providers: [AdminsService, LoginService, AdminIdentityLookupService],
  exports: [AdminsService, LoginService, AdminIdentityLookupService],
})
export class AdminsModule {}
