import { getQueryServiceToken } from '@ptc-org/nestjs-query-core';
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { CleanersModule } from '../cleaners.module';
import { CleanersService } from '../application/services/cleaners.service';
import { TeamsService } from '../application/services/teams.service';
import { CleanerEntity } from '../infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../infrastructure/persistence/team.entity';

// Proves `CleanersModule` can construct its own providers in isolation —
// a fake global `DataSource` + repository-token overrides, no real
// Postgres, no `AppModule` — which is a distinct concern from Task 4's
// proof that `AppModule` actually imports `CleanersModule` ("composition
// root" more precisely names that concern; this file's name reflects what
// it actually proves: module-internal DI wiring). Mirrors
// `customers.module.composition-root.spec.ts`'s technique exactly, renamed
// per the M5 review.
//
// Regression-proofs the same class of mistake `customers.module.ts`
// originally made: omitting `AuditModule` from `imports` and assuming
// `AUDIT_LOGGER` would be "globally available" once `AppModule` imported
// both `AuditModule` and `CleanersModule` side by side — Nest module
// encapsulation does not work that way (sibling modules imported into a
// shared parent do not share DI visibility with each other unless the
// exporting module is `@Global()`, which `AuditModule` is not).
//
// Task 1 covers `TeamsService`/`AUDIT_LOGGER` only. Task 2 extends this file
// with `CleanersService`.
@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

describe('CleanersModule — module-internal DI wiring (real AuditModule)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, CleanersModule],
    })
      .overrideProvider(getRepositoryToken(TeamEntity))
      .useValue({
        find: jest.fn(),
        findOneBy: jest.fn(),
        findBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getRepositoryToken(CleanerEntity))
      .useValue({
        find: jest.fn(),
        findOneBy: jest.fn(),
        findBy: jest.fn(),
        metadata: { columns: [] },
      })
      .overrideProvider(getQueryServiceToken(TeamEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getQueryServiceToken(CleanerEntity))
      .useValue({ query: jest.fn(), queryRelations: jest.fn() })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves TeamsService (its AUDIT_LOGGER dependency resolves without error)', () => {
    expect(moduleRef.get(TeamsService)).toBeInstanceOf(TeamsService);
  });

  it('resolves CleanersService (its AUDIT_LOGGER dependency resolves without error)', () => {
    expect(moduleRef.get(CleanersService)).toBeInstanceOf(CleanersService);
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });
});
