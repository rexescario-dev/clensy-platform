import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { LaundryModule } from '../laundry/laundry.module';
import { InvoicesService } from './application/services/invoices.service';
import { InvoiceEntity } from './infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from './infrastructure/persistence/invoice-line.entity';

// `modules/billing` (#38 spec §4.1). Depends on `LaundryModule` /
// `CatalogModule` / `CustomersModule` for their exported application
// services only — it never registers `LaundryOrderEntity` / `CustomerEntity`
// / any catalog entity on any `forFeature`; their owning modules stay their
// sole registrants.
//
// The GraphQL surface (nestjs-query feature registrations + resolvers) is
// added in Slice E.
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceEntity, InvoiceLineEntity]),
    AuditModule,
    LaundryModule,
    CatalogModule,
    CustomersModule,
  ],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class BillingModule {}
