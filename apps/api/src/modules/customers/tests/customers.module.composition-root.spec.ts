import { getQueryServiceToken } from '@ptc-org/nestjs-query-core';
import { Authorizer } from '@ptc-org/nestjs-query-graphql';
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getAuthorizerToken
// from the package root, so this deep import is required.
import { getAuthorizerToken } from '@ptc-org/nestjs-query-graphql/src/auth';
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { CustomersModule } from '../customers.module';
import { CustomersService } from '../application/services/customers.service';
import { PropertiesService } from '../application/services/properties.service';
import { CustomerEntity } from '../infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../infrastructure/persistence/property.entity';
import { CustomerType } from '../presentation/graphql/customer.type';
import { PropertyType } from '../presentation/graphql/property.type';

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
  exports: [DataSource],
  providers: [{ provide: DataSource, useValue: {} }],
})
class FakeGlobalDataSourceModule {}

describe('CustomersModule — composition-root wiring (real AuditModule)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, CustomersModule],
    })
      .overrideProvider(getRepositoryToken(CustomerEntity))
      .useValue({
        find: jest.fn(),
        findOneBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getRepositoryToken(PropertyEntity))
      .useValue({
        findBy: jest.fn(),
        findOneBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getQueryServiceToken(CustomerEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getQueryServiceToken(PropertyEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves CustomersService (its AUDIT_LOGGER dependency resolves without error)', () => {
    expect(moduleRef.get(CustomersService)).toBeInstanceOf(CustomersService);
  });

  // `PropertiesService` depends on `AUDIT_LOGGER` too, plus two
  // repositories (`PropertyEntity` and `CustomerEntity` — the latter for
  // `listCustomerProperties`'s existence check). Proves it resolves now
  // that it's part of `CustomersModule`'s `providers`.
  it('resolves PropertiesService (its AUDIT_LOGGER and repository dependencies resolve without error)', () => {
    expect(moduleRef.get(PropertiesService)).toBeInstanceOf(PropertiesService);
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });

  // The DI-registered authorizer is what nestjs-query's interceptor and
  // every parent's `authorizeRelation` resolve (`getAuthorizerToken(DTO)`),
  // so prove the tenant authorizer — not the library's allow-all default —
  // is the one wired for both types (#82).
  it.each([
    ['CustomerType', CustomerType],
    ['PropertyType', PropertyType],
  ] as const)(
    'registers the tenant read authorizer for %s',
    async (_name, DTOClass) => {
      const authorizer = moduleRef.get<Authorizer<unknown>>(
        getAuthorizerToken(DTOClass as never),
        { strict: false },
      );
      await expect(
        authorizer.authorize({ req: { user: { tenantId: 't-a' } } }, {
          operationGroup: 'read',
        } as never),
      ).resolves.toEqual({ tenantId: { eq: 't-a' } });
    },
  );
});
