import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminsModule } from '../../../modules/admins/admins.module';
import { AdminIdentityLookupService } from '../../../modules/admins/infrastructure/admin-identity-lookup.service';
import { AdminUserEntity } from '../../../modules/admins/infrastructure/persistence/admin-user.entity';
import { AuditEventEntity } from '../../audit/infrastructure/persistence/audit-event.entity';
import { AuthModule } from '../auth.module';
import { Role } from '../domain/role';
import { AuthGuard } from '../guards/auth.guard';
import { JwtStrategy } from '../infrastructure/jwt.strategy';

// `AdminsModule`'s own providers array also eagerly instantiates
// `AdminsService` (a sibling of `AdminIdentityLookupService`, unrelated to
// anything this test exercises), which injects the raw TypeORM
// `DataSource` class directly. That token is never provided anywhere in
// this test's module graph (no real `TypeOrmModule.forRoot()` here), and
// `overrideProvider()` can only override a token that already exists in the
// graph — it can't conjure one. A `@Global()` stand-in module, exactly like
// `ConfigModule.forRoot({ isGlobal: true })` below, makes a mock
// `DataSource` visible everywhere in the graph, including inside
// `AdminsModule`, without needing a real Postgres connection.
@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class FakeGlobalDataSourceModule {}

// Proves the composition-root-avoidance mechanism documented in
// `auth.module.ts` actually resolves under real NestJS DI, not just that it
// looks plausible in a comment. Wires `AuthModule.forRootAsync(...)`
// together with the REAL `AdminsModule` — the same two modules Task 6's
// `AppModule` will combine — exactly the way Task 6 is expected to call it,
// and resolves `JwtStrategy`/`AuthGuard` (and, transitively, the bound
// `ADMIN_IDENTITY_LOOKUP` provider) out the other side.
//
// `AuthModule`'s own source file still never imports `AdminsModule` — that
// import only ever appears here, at this test's (composition-root-standin)
// call site, and inside `AppModule` once Task 6 exists.
//
// `AdminUserEntity`/`AuditEventEntity` repositories are overridden with
// plain mocks (same technique as
// `modules/admins/tests/infrastructure/admin-identity-lookup.service.spec.ts`)
// so this test needs no real database — it is exercising DI wiring, not
// persistence.
describe('AuthModule.forRootAsync — composition-root wiring (real AdminsModule)', () => {
  let moduleRef: TestingModule;
  let adminUserRepository: { findOneBy: jest.Mock };

  beforeAll(async () => {
    adminUserRepository = { findOneBy: jest.fn() };

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        FakeGlobalDataSourceModule,
        AuthModule.forRootAsync({
          imports: [AdminsModule],
          inject: [AdminIdentityLookupService],
          useFactory: (service: AdminIdentityLookupService) => service,
        }),
      ],
    })
      .overrideProvider(getRepositoryToken(AdminUserEntity))
      .useValue(adminUserRepository)
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves JwtStrategy (its ADMIN_IDENTITY_LOOKUP dependency resolves without error)', () => {
    expect(moduleRef.get(JwtStrategy)).toBeInstanceOf(JwtStrategy);
  });

  it('resolves AuthGuard from the same dynamic module', () => {
    expect(moduleRef.get(AuthGuard)).toBeInstanceOf(AuthGuard);
  });

  it('binds ADMIN_IDENTITY_LOOKUP to the real AdminIdentityLookupService (not a stub) — validate() reaches the actual repository', async () => {
    adminUserRepository.findOneBy.mockResolvedValue({
      id: 'admin-1',
      role: Role.OWNER,
      isActive: true,
    });

    const strategy = moduleRef.get(JwtStrategy);
    const principal = await strategy.validate({ sub: 'admin-1' });

    expect(principal).toEqual({ id: 'admin-1', role: Role.OWNER });
    expect(adminUserRepository.findOneBy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1', isActive: true }),
    );
  });
});
