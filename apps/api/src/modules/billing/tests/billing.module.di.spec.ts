import { getQueryServiceToken } from '@ptc-org/nestjs-query-core';
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { AddOnsService } from '../../catalog/application/services/add-ons.service';
import { PricingRulesService } from '../../catalog/application/services/pricing-rules.service';
import { ServicesService } from '../../catalog/application/services/services.service';
import { CatalogModule } from '../../catalog/catalog.module';
import { CustomersModule } from '../../customers/customers.module';
import { CustomersService } from '../../customers/application/services/customers.service';
import { PropertiesService } from '../../customers/application/services/properties.service';
import { LaundryModule } from '../../laundry/laundry.module';
import { LaundryOrdersService } from '../../laundry/application/services/laundry-orders.service';
import { InvoicesService } from '../application/services/invoices.service';
import { BillingModule } from '../billing.module';
import { InvoiceEntity } from '../infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from '../infrastructure/persistence/invoice-line.entity';

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

@Module({
  providers: [
    { provide: CustomersService, useValue: {} },
    { provide: PropertiesService, useValue: {} },
  ],
  exports: [CustomersService, PropertiesService],
})
class FakeCustomersModule {}

@Module({
  providers: [
    { provide: PricingRulesService, useValue: {} },
    { provide: ServicesService, useValue: { getServicesByIds: jest.fn() } },
    { provide: AddOnsService, useValue: { getAddOnsByIds: jest.fn() } },
  ],
  exports: [PricingRulesService, ServicesService, AddOnsService],
})
class FakeCatalogModule {}

@Module({
  providers: [
    {
      provide: LaundryOrdersService,
      useValue: { getOrderForInvoicing: jest.fn() },
    },
  ],
  exports: [LaundryOrdersService],
})
class FakeLaundryModule {}

// BillingModule imports Laundry/Catalog/Customers for their application
// SERVICES only — never their entities (#38 spec §4.1). This proves the
// module resolves `InvoicesService` with those modules faked out.
describe('BillingModule — module-internal DI wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, BillingModule],
    })
      .overrideModule(LaundryModule)
      .useModule(FakeLaundryModule)
      .overrideModule(CustomersModule)
      .useModule(FakeCustomersModule)
      .overrideModule(CatalogModule)
      .useModule(FakeCatalogModule)
      .overrideProvider(getRepositoryToken(InvoiceEntity))
      .useValue({ findOneBy: jest.fn(), metadata: { columns: [] } })
      .overrideProvider(getRepositoryToken(InvoiceLineEntity))
      .useValue({ findOneBy: jest.fn(), metadata: { columns: [] } })
      .overrideProvider(getQueryServiceToken(InvoiceEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getQueryServiceToken(InvoiceLineEntity))
      .useValue({ query: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves InvoicesService without registering Laundry/Catalog/Customers entities', () => {
    expect(moduleRef.get(InvoicesService)).toBeInstanceOf(InvoicesService);
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });
});
