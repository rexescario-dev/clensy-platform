import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';
import { Role } from '../domain/role';

interface RequestWithPrincipal {
  user?: AuthenticatedPrincipal;
}

interface GqlContext {
  req: RequestWithPrincipal;
  res: unknown;
}

// Wraps Passport's generic `AuthGuard('jwt')` mixin (which drives
// `JwtStrategy`, registered under passport-jwt's default 'jwt' strategy
// name) and adapts its request/response access to GraphQL's execution
// context via `GqlExecutionContext.create(context).getContext()` — the
// standard NestJS GraphQL/Apollo convention for reaching `req`/`res` from a
// resolver's `ExecutionContext`, since `context.switchToHttp()` doesn't
// carry them for a GraphQL request.
//
// Also folds `@Roles()` role-checking into this same guard rather than a
// separate `RolesGuard` (brief allows either) — one guard covers both
// "must be authenticated" (bare `@UseGuards(AuthGuard)`, no `@Roles()`) and
// "must be authenticated AND hold one of these roles" (`@Roles(...)`, OR
// semantics — spec §4.2).
@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  getRequest(context: ExecutionContext): RequestWithPrincipal {
    return GqlExecutionContext.create(context).getContext<GqlContext>().req;
  }

  getResponse(context: ExecutionContext): unknown {
    return GqlExecutionContext.create(context).getContext<GqlContext>().res;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Delegates to Passport's mixin, which runs `JwtStrategy` against
    // `getRequest(context)`'s cookie. No cookie, an invalid/expired
    // signature, or `JwtStrategy.validate()` throwing (the disabled/unknown
    // -account case, spec §4.1) all surface as Passport's default
    // `handleRequest` throwing `UnauthorizedException` — "unauthenticated"
    // is a rejection here, not a `false` return.
    const authenticated = await super.canActivate(context);
    if (!authenticated) {
      return false;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      // No `@Roles()` declared: authenticated-only, any role (spec §4.2).
      return true;
    }

    const principal = this.getRequest(context).user;
    if (!principal || !requiredRoles.includes(principal.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
