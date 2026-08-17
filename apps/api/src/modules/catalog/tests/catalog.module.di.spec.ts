import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { CatalogModule } from '../catalog.module';
import { AddOnsService } from '../application/services/add-ons.service';
import { ServicesService } from '../application/services/services.service';
import { AddOnEntity } from '../infrastructure/persistence/add-on.entity';
import { ServiceEntity } from '../infrastructure/persistence/service.entity';

// Proves `CatalogModule` can construct its own providers in isolation — a
// fake global `DataSource` + repository-token overrides, no real Postgres,
// no `AppModule` — mirroring `cleaners.module.di.spec.ts`'s technique
// exactly (per the task-1 brief).
//
// Regression-proofs the same class of mistake `customers.module.ts`
// originally made: omitting `AuditModule` from `imports` and assuming
// `AUDIT_LOGGER` would be "globally available" once `AppModule` imported
// both `AuditModule` and `CatalogModule` side by side — Nest module
// encapsulation does not work that way (sibling modules imported into a
// shared parent do not share DI visibility with each other unless the
// exporting module is `@Global()`, which `AuditModule` is not).
//
// Task 1 covers `ServicesService`/`AUDIT_LOGGER`. Task 2 extends this file
// with `AddOnsService`. Tasks 3-4 extend it further with
// `PricingRulesService`.
@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

describe('CatalogModule — module-internal DI wiring (real AuditModule)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, CatalogModule],
    })
      .overrideProvider(getRepositoryToken(ServiceEntity))
      .useValue({ find: jest.fn(), findOneBy: jest.fn() })
      .overrideProvider(getRepositoryToken(AddOnEntity))
      .useValue({ find: jest.fn(), findOneBy: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves ServicesService (its AUDIT_LOGGER dependency resolves without error)', () => {
    expect(moduleRef.get(ServicesService)).toBeInstanceOf(ServicesService);
  });

  it('resolves AddOnsService (its AUDIT_LOGGER dependency resolves without error)', () => {
    expect(moduleRef.get(AddOnsService)).toBeInstanceOf(AddOnsService);
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });
});
