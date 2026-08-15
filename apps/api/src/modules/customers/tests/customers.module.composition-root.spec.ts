import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { CustomersModule } from '../customers.module';
import { CustomersService } from '../application/services/customers.service';
import { CustomerEntity } from '../infrastructure/persistence/customer.entity';

// Proves `AUDIT_LOGGER` actually resolves through real NestJS DI when only
// `CustomersModule` (not `AppModule`) is imported — not just that
// `customers.module.ts`'s `imports` array *looks* right in a comment.
// Regression test for a review finding: `customers.module.ts` originally
// omitted `AuditModule` from its `imports`, reasoning (incorrectly) that
// `AUDIT_LOGGER` would be "globally available" once `AppModule` imported
// both `AuditModule` and `CustomersModule` side by side — Nest module
// encapsulation does not work that way (sibling modules imported into a
// shared parent do not share DI visibility with each other unless the
// exporting module is `@Global()`, which `AuditModule` is not). Mirrors
// `platform/auth/tests/auth.module.composition-root.spec.ts`'s technique
// exactly: a `@Global()` fake `DataSource` stand-in (so `CustomersService`'s
// raw `DataSource` constructor injection resolves without a real Postgres
// connection), plus repository-token overrides for `CustomerEntity` and
// `AuditEventEntity` so this test needs no real database — it exercises DI
// wiring, not persistence.
@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

describe('CustomersModule — composition-root wiring (real AuditModule)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, CustomersModule],
    })
      .overrideProvider(getRepositoryToken(CustomerEntity))
      .useValue({ find: jest.fn(), findOneBy: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves CustomersService (its AUDIT_LOGGER dependency resolves without error)', () => {
    expect(moduleRef.get(CustomersService)).toBeInstanceOf(CustomersService);
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });
});
