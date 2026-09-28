import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
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
//
// #85 Slice decision 4: `getRequest`/`getResponse` branch explicitly on
// `context.getType()` so this same guard also authenticates HTTP
// controllers (REST `/bookings`), not just GraphQL resolvers — cookie
// extraction itself (`JwtStrategy` reading `req.cookies`) was already
// transport-neutral, only the request/response lookup was GraphQL-only.
// `@Roles()` and the role check below are unchanged and shared across both
// transports. Any other execution type (`rpc`, `ws`, …) is out of scope for
// this slice and throws rather than being silently treated as HTTP.
@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
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

  getRequest(context: ExecutionContext): RequestWithPrincipal {
    const type = context.getType<GqlContextType>();
    if (type === 'graphql') {
      return GqlExecutionContext.create(context).getContext<GqlContext>().req;
    }
    if (type === 'http') {
      return context.switchToHttp().getRequest<RequestWithPrincipal>();
    }
    throw new Error(`AuthGuard: unsupported execution context type "${type}"`);
  }

  getResponse(context: ExecutionContext): unknown {
    const type = context.getType<GqlContextType>();
    if (type === 'graphql') {
      return GqlExecutionContext.create(context).getContext<GqlContext>().res;
    }
    if (type === 'http') {
      return context.switchToHttp().getResponse<unknown>();
    }
    throw new Error(`AuthGuard: unsupported execution context type "${type}"`);
  }
}
