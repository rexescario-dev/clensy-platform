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
import { LaundryOrdersService } from '../application/services/laundry-orders.service';
import { LaundryModule } from '../laundry.module';
import { LaundryOrderEntity } from '../infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../infrastructure/persistence/laundry-order-line.entity';

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

@Module({
  providers: [
    { provide: CustomersService, useValue: { getCustomer: jest.fn() } },
    { provide: PropertiesService, useValue: {} },
  ],
  exports: [CustomersService, PropertiesService],
})
class FakeCustomersModule {}

@Module({
  providers: [
    {
      provide: PricingRulesService,
      useValue: { resolveEffectivePricing: jest.fn() },
    },
    { provide: ServicesService, useValue: {} },
    { provide: AddOnsService, useValue: {} },
  ],
  exports: [PricingRulesService, ServicesService, AddOnsService],
})
class FakeCatalogModule {}

// LaundryModule imports Customers/Catalog for their application SERVICES
// only — never their entities (spec §4.1). This proves the module resolves
// `LaundryOrdersService` with those modules faked out.
describe('LaundryModule — module-internal DI wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, LaundryModule],
    })
      .overrideModule(CustomersModule)
      .useModule(FakeCustomersModule)
      .overrideModule(CatalogModule)
      .useModule(FakeCatalogModule)
      .overrideProvider(getRepositoryToken(LaundryOrderEntity))
      .useValue({ findOneBy: jest.fn(), metadata: { columns: [] } })
      .overrideProvider(getRepositoryToken(LaundryOrderLineEntity))
      .useValue({ findOneBy: jest.fn(), metadata: { columns: [] } })
      .overrideProvider(getQueryServiceToken(LaundryOrderEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getQueryServiceToken(LaundryOrderLineEntity))
      .useValue({ query: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves LaundryOrdersService without registering Customers/Catalog entities', () => {
    expect(moduleRef.get(LaundryOrdersService)).toBeInstanceOf(
      LaundryOrdersService,
    );
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });
});
