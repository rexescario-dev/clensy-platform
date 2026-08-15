import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CustomersService } from './application/services/customers.service';
import { CustomerEntity } from './infrastructure/persistence/customer.entity';

// Task 2 extends this with `PropertyEntity`/`PropertiesService`. Imports
// `AuditModule` directly (mirroring `admins.module.ts:35` exactly) so
// `AUDIT_LOGGER` is DI-visible to `CustomersService`: Nest module
// encapsulation means a token exported by `AuditModule` is only visible to
// a module that itself imports `AuditModule` — sibling modules imported
// side-by-side into a shared parent (e.g. `AppModule` importing both
// `AuditModule` and `CustomersModule`) do NOT share DI visibility with each
// other. `AuditModule` is not `@Global()`, so there is no ambient
// mechanism that makes this import optional.
@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity]), AuditModule],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
