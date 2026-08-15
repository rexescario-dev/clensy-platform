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
@Module({
  imports: [TypeOrmModule.forFeature([AdminUserEntity]), AuditModule],
  providers: [AdminsService, LoginService, AdminIdentityLookupService],
  exports: [AdminsService, LoginService, AdminIdentityLookupService],
})
export class AdminsModule {}
