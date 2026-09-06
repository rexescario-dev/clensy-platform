import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { LaundryOrdersService } from './application/services/laundry-orders.service';
import { LaundryOrderStatusTransitionPolicy } from './domain/laundry-order-status-transition-policy';
import { LaundryOrderEntity } from './infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from './infrastructure/persistence/laundry-order-line.entity';

// Application-layer wiring only — the GraphQL surface (nestjs-query
// registrations, resolvers, loaders) is added in Slice D. `CustomerEntity`/
// `ServiceEntity`/`AddOnEntity` are deliberately NOT registered on
// `forFeature` — their owning modules stay their sole registrants (spec
// §4.1); this module consumes only `CustomersService` and
// `PricingRulesService`.
@Module({
  imports: [
    TypeOrmModule.forFeature([LaundryOrderEntity, LaundryOrderLineEntity]),
    AuditModule,
    CustomersModule,
    CatalogModule,
  ],
  providers: [LaundryOrdersService, LaundryOrderStatusTransitionPolicy],
  exports: [LaundryOrdersService],
})
export class LaundryModule {}
