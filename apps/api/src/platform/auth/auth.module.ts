import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ADMIN_IDENTITY_LOOKUP } from './application/admin-identity-lookup.port';
import type { AdminIdentityLookupPort } from './application/admin-identity-lookup.port';
import { AuthGuard } from './guards/auth.guard';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { TokenService } from './infrastructure/token.service';

export interface AuthModuleAsyncOptions {
  // Modules the composition root needs imported into AuthModule's dynamic
  // module graph so `inject` below can actually be resolved (e.g.
  // `[AdminsModule]`, to make `AdminIdentityLookupService` available to
  // `useFactory`). Supplied by the caller (Task 6's `AppModule`) at
  // `forRootAsync()` call time — this never appears in `AuthModule`'s own
  // static `@Module()` decorator below, so the plain `AuthModule` class
  // still never unconditionally imports `AdminsModule`.
  imports?: Array<Type<unknown> | DynamicModule>;
  inject?: Array<Type<unknown> | string | symbol>;
  useFactory: (
    ...args: any[]
  ) => AdminIdentityLookupPort | Promise<AdminIdentityLookupPort>;
}

// Composition-root-avoidance mechanism (spec §5.2 / plan §3's explicit
// prohibition on `platform/auth` importing `AdminsModule`):
//
// `JwtStrategy` declares `@Inject(ADMIN_IDENTITY_LOOKUP)` in its own
// constructor (see `infrastructure/jwt.strategy.ts`). Under standard NestJS
// module encapsulation, a provider is only visible to a consumer if it is
// registered in that SAME module's own `providers` array, or exported by a
// module the consumer's own `imports` array lists — a provider sitting in a
// *parent* module's `providers` (e.g. added directly to `AppModule`) is
// NOT automatically visible to a module `AppModule` imports, even though
// the reverse (parent -> child visibility of exports) is. So the
// `ADMIN_IDENTITY_LOOKUP` binding cannot live as a bare provider on
// `AppModule`; it has to be added into `AuthModule`'s OWN provider list,
// alongside `JwtStrategy`, so ordinary same-module DI resolution applies.
//
// `forRootAsync()` does exactly that: it returns a `DynamicModule` whose
// `imports`/`providers` arrays are assembled at call time from
// caller-supplied config, not hardcoded into this file's static `@Module()`
// decorator (which stays empty). Task 6's composition root calls this once,
// e.g.:
//
//   AuthModule.forRootAsync({
//     imports: [AdminsModule],
//     inject: [AdminIdentityLookupService],
//     useFactory: (service: AdminIdentityLookupService) => service,
//   })
//
// `AdminsModule` only ever appears inside the dynamic module this call
// returns — supplied by `AppModule`, the composition root — never inside
// `AuthModule`'s own static metadata, so nothing in this file unconditionally
// depends on `modules/admins`. See
// `tests/auth.module.composition-root.spec.ts` for a test that actually
// wires `AuthModule.forRootAsync(...)` together with the real `AdminsModule`
// and resolves `JwtStrategy`/`AuthGuard` through Nest's DI container,
// proving this mechanism (rather than just asserting it in a comment).
@Module({})
export class AuthModule {
  static forRootAsync(options: AuthModuleAsyncOptions): DynamicModule {
    const adminIdentityLookupProvider: Provider = {
      provide: ADMIN_IDENTITY_LOOKUP,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: AuthModule,
      imports: [
        PassportModule,
        JwtModule.register({}),
        ...(options.imports ?? []),
      ],
      providers: [
        TokenService,
        JwtStrategy,
        AuthGuard,
        adminIdentityLookupProvider,
      ],
      exports: [TokenService, AuthGuard],
    };
  }
}
