import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CustomersService } from './application/services/customers.service';
import { PropertiesService } from './application/services/properties.service';
import { CustomerEntity } from './infrastructure/persistence/customer.entity';
import { PropertyEntity } from './infrastructure/persistence/property.entity';
import { CustomerReadResolver } from './presentation/graphql/customer-read.resolver';
import { CustomerResolver } from './presentation/graphql/customer.resolver';
import { CustomerType } from './presentation/graphql/customer.type';
import { PropertyReadResolver } from './presentation/graphql/property-read.resolver';
import { PropertyResolver } from './presentation/graphql/property.resolver';
import { PropertyType } from './presentation/graphql/property.type';

// Imports `AuditModule` directly (mirroring `admins.module.ts:35` exactly)
// so `AUDIT_LOGGER` is DI-visible to `CustomersService`/`PropertiesService`:
// Nest module encapsulation means a token exported by `AuditModule` is only
// visible to a module that itself imports `AuditModule` — sibling modules
// imported side-by-side into a shared parent (e.g. `AppModule` importing
// both `AuditModule` and `CustomersModule`) do NOT share DI visibility with
// each other. `AuditModule` is not `@Global()`, so there is no ambient
// mechanism that makes this import optional.
@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerEntity, PropertyEntity]),
    NestjsQueryTypeOrmModule.forFeature([CustomerEntity, PropertyEntity]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [{ DTOClass: CustomerType }, { DTOClass: PropertyType }],
    }),
    AuditModule,
  ],
  providers: [
    CustomersService,
    PropertiesService,
    CustomerResolver,
    CustomerReadResolver,
    PropertyResolver,
    PropertyReadResolver,
  ],
  exports: [CustomersService, PropertiesService],
})
export class CustomersModule {}
