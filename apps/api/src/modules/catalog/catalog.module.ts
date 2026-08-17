import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { AddOnsService } from './application/services/add-ons.service';
import { ServicesService } from './application/services/services.service';
import { AddOnEntity } from './infrastructure/persistence/add-on.entity';
import { ServiceEntity } from './infrastructure/persistence/service.entity';

// Imports `AuditModule` directly (mirroring `cleaners.module.ts`'s precedent
// exactly) so `AUDIT_LOGGER` is DI-visible to `ServicesService`: Nest module
// encapsulation means a token exported by `AuditModule` is only visible to a
// module that itself imports `AuditModule`. `AuditModule` is not `@Global()`,
// so there is no ambient mechanism that makes this import optional.
//
// Task 1 registered `ServiceEntity`/`ServicesService`. Task 2 adds
// `AddOnEntity`/`AddOnsService` alongside it — `AddOn` has no relationship to
// `Service` (fully independent, global add-ons). Task 3 extends this module
// further with `PricingRule` and its service/resolvers.
@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceEntity, AddOnEntity]),
    AuditModule,
  ],
  providers: [ServicesService, AddOnsService],
  exports: [ServicesService, AddOnsService],
})
export class CatalogModule {}
