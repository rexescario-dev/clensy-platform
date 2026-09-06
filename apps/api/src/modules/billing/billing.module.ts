import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { LaundryModule } from '../laundry/laundry.module';
import { InvoicesService } from './application/services/invoices.service';
import { InvoiceEntity } from './infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from './infrastructure/persistence/invoice-line.entity';
import { InvoiceReadResolver } from './presentation/graphql/invoice-read.resolver';
import { InvoiceResolver } from './presentation/graphql/invoice.resolver';
import { InvoiceType } from './presentation/graphql/invoice.type';
import { InvoiceLineType } from './presentation/graphql/invoice-line.type';

// `modules/billing` (#38 spec §4.1). Depends on `LaundryModule` /
// `CatalogModule` / `CustomersModule` for their exported application
// services only — it never registers `LaundryOrderEntity` / `CustomerEntity`
// / any catalog entity on any `forFeature`; their owning modules stay their
// sole registrants (the `laundry.module.ts` precedent).
//
// `InvoiceLineEntity` / `InvoiceLineType` ARE registered so the nested
// `Invoice.lines` offset connection resolves (the `LaundryOrderLine` /
// `Checklist.items` precedent).
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceEntity, InvoiceLineEntity]),
    NestjsQueryTypeOrmModule.forFeature([InvoiceEntity, InvoiceLineEntity]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [{ DTOClass: InvoiceType }, { DTOClass: InvoiceLineType }],
    }),
    AuditModule,
    LaundryModule,
    CatalogModule,
    CustomersModule,
  ],
  providers: [InvoicesService, InvoiceReadResolver, InvoiceResolver],
  exports: [InvoicesService],
})
export class BillingModule {}
