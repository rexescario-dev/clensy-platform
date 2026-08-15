import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthGuard } from './guards/auth.guard';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { TokenService } from './infrastructure/token.service';

// Composition-root-avoidance mechanism (spec §5.2 / plan §3's explicit
// prohibition on `platform/auth` importing `AdminsModule`):
//
// `JwtStrategy` declares `@Inject(ADMIN_IDENTITY_LOOKUP)` in its own
// constructor (see `infrastructure/jwt.strategy.ts`) but this module's
// `imports` array does NOT include `AdminsModule`, and nothing here
// provides a binding for the `ADMIN_IDENTITY_LOOKUP` token. That token is
// left as an unresolved dependency as far as `AuthModule` alone is
// concerned — Nest's DI container only resolves it once this module (or a
// module that imports it) sits inside an application graph that ALSO
// provides that token somewhere `AuthModule` can see it.
//
// Task 6's composition root (`AppModule`) is expected to do exactly that:
// import both `AuthModule` and `AdminsModule`, and add a module-level
// provider such as
//   { provide: ADMIN_IDENTITY_LOOKUP, useExisting: AdminIdentityLookupService }
// A `forRoot()`-style factory on this module was considered and rejected:
// there is exactly one lookup implementation for the whole app (not a
// pluggable, per-caller concern), so a single `AppModule`-level provider
// is simpler and is standard, idiomatic NestJS practice for "shared
// abstraction owned by module A, concrete implementation supplied by
// module B, bound together only at the composition root" — the same shape
// `AuditModule` already uses for `AUDIT_LOGGER` (see `audit.module.ts`),
// except that binding happens to live inside `AuditModule` itself since
// `AuditModule` owns both the port and its only implementation; here the
// implementation lives in a different module (`modules/admins`) that
// `platform/auth` is forbidden from importing, so the binding has to live
// one level up, at `AppModule`.
@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [TokenService, JwtStrategy, AuthGuard],
  exports: [TokenService, AuthGuard],
})
export class AuthModule {}
