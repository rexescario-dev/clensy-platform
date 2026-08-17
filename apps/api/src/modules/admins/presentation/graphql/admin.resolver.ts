import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Response } from 'express';
import ms from 'ms';
import { CreateAdminCommand } from '../../application/commands/create-admin.command';
import { DisableAdminCommand } from '../../application/commands/disable-admin.command';
import { AdminsService } from '../../application/services/admins.service';
import { LoginService } from '../../application/services/login.service';
import { AdminUser } from '../../domain/admin-user';
import { SESSION_COOKIE_NAME } from '../../../../platform/auth/auth.constants';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { TokenService } from '../../../../platform/auth/infrastructure/token.service';
import { AdminType } from './admin.type';
import { CreateAdminInput } from './create-admin.input';
import { CurrentAdminType } from './current-admin.type';
import { LoginInput } from './login.input';
import { LoginResultType } from './login-result.type';

// Never expose `AdminUser` (the `modules/admins` domain interface) or the
// TypeORM entity as a GraphQL value — every `AdminsService` result is
// mapped through this before leaving the resolver.
function toAdminType(admin: AdminUser): AdminType {
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
  };
}

interface GqlContext {
  res: Response;
}

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

// Exactly the 5 operations of spec §4.9 — no others. This is also the only
// class in the codebase that depends on both `modules/admins`' application
// services (`AdminsService`, `LoginService`) AND `platform/auth`'s
// infrastructure (`TokenService`, `AuthGuard`) at once — the ordinary
// "presentation depends on application services" direction, not the
// platform -> modules direction spec §5.2 forbids. `LoginService` itself
// has no dependency on `TokenService`; only `login()` below composes them.
@Resolver(() => AdminType)
export class AdminResolver {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly loginService: LoginService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  // Public: no `AuthGuard`, no `@Roles()`. Orchestration order (brief,
  // spec §4.8): verify credentials via `LoginService` -> on a non-null
  // result, issue the JWT via `TokenService` -> set the HttpOnly session
  // cookie on the response -> return a result that never carries the raw
  // token itself (the cookie is the only place it ever appears).
  @Mutation(() => LoginResultType)
  async login(
    @Args('loginInput') input: LoginInput,
    @Context() context: GqlContext,
  ): Promise<LoginResultType> {
    const principal = await this.loginService.login(
      input.email,
      input.password,
    );
    if (!principal) {
      // Generic, non-discriminating message (spec §4.3) — mirrors
      // `LoginService`'s uniform `null` for unknown email / wrong password
      // / disabled account; nothing here reveals which case occurred.
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.tokenService.issue(principal.id);
    this.setSessionCookie(context.res, token);

    return {
      success: true,
      admin: { id: principal.id, role: principal.role },
    };
  }

  // Public: no `AuthGuard`, no `@Roles()`. Callable without a session —
  // idempotent, safe to call even if already logged out.
  @Mutation(() => Boolean)
  async logout(@Context() context: GqlContext): Promise<boolean> {
    this.clearSessionCookie(context.res);
    return true;
  }

  @Mutation(() => AdminType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER)
  async createAdmin(
    @Args('createAdminInput') input: CreateAdminInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<AdminType> {
    const command: CreateAdminCommand = {
      actorId: currentUser.id,
      email: input.email,
      password: input.password,
      role: input.role,
    };
    const admin = await this.adminsService.create(command);
    return toAdminType(admin);
  }

  @Mutation(() => AdminType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER)
  async disableAdmin(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<AdminType> {
    const command: DisableAdminCommand = {
      actorId: currentUser.id,
      targetId: id,
    };
    const admin = await this.adminsService.disable(command);
    return toAdminType(admin);
  }

  @Query(() => [AdminType], { name: 'admins' })
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER)
  async admins(): Promise<AdminType[]> {
    const list = await this.adminsService.list();
    return list.map(toAdminType);
  }

  // Any authenticated role — no `@Roles()`.
  @Query(() => CurrentAdminType, { name: 'currentAdmin' })
  @UseGuards(AuthGuard)
  currentAdmin(
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): CurrentAdminType {
    return { id: currentUser.id, role: currentUser.role };
  }

  // `Max-Age` is derived from the exact same `JWT_EXPIRES_IN` config value
  // `TokenService.issue()` used to sign the token's own `exp` claim — read
  // fresh here via `ConfigService` (with the identical `'8h'` fallback)
  // since `TokenService.expiresIn` is a private field, and converted with
  // the `ms` package rather than a separate hardcoded
  // `8 * 60 * 60 * 1000` literal, so the cookie's lifetime can never
  // silently drift from what the JWT itself actually claims.
  private setSessionCookie(res: Response, token: string): void {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    res.cookie(SESSION_COOKIE_NAME, token, {
      ...SESSION_COOKIE_OPTIONS,
      // Always true, never conditioned on `NODE_ENV` (brief) — a dev-only
      // plain-HTTP exception would be a second, environment-dependent
      // security posture to reason about.
      maxAge: ms(expiresIn as Parameters<typeof ms>[0]),
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
  }
}
