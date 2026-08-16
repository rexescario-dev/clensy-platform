import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { ServicesService } from './application/services/services.service';
import { ServiceEntity } from './infrastructure/persistence/service.entity';

// Imports `AuditModule` directly (mirroring `cleaners.module.ts`'s precedent
// exactly) so `AUDIT_LOGGER` is DI-visible to `ServicesService`: Nest module
// encapsulation means a token exported by `AuditModule` is only visible to a
// module that itself imports `AuditModule`. `AuditModule` is not `@Global()`,
// so there is no ambient mechanism that makes this import optional.
//
// Task 1 registers `ServiceEntity`/`ServicesService` only. Tasks 2-4 extend
// this module with `AddOn`/`PricingRule` and their services/resolvers.
@Module({
  imports: [TypeOrmModule.forFeature([ServiceEntity]), AuditModule],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class CatalogModule {}
