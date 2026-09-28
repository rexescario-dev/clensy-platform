import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';

interface RequestWithPrincipal {
  user?: AuthenticatedPrincipal;
}

interface GqlContext {
  req: RequestWithPrincipal;
}

// Returns the `AuthenticatedPrincipal` that `AuthGuard` attached to
// `req.user` (via Passport's `JwtStrategy.validate()` return value) —
// never `modules/admins`' full `AdminUser` domain object (spec §4.7). Only
// meaningful on operations already behind `AuthGuard`; using it on a public
// resolver is a bug in that resolver, not something this decorator guards
// against — `req.user` is guaranteed present there.
//
// #85 Slice decision 4: branches explicitly on `context.getType()`, the
// same two transports (and the same explicit rejection of anything else)
// as `AuthGuard.getRequest`/`getResponse` — deliberately duplicated rather
// than shared, per that decision.
export function principalFromContext(
  context: ExecutionContext,
): AuthenticatedPrincipal {
  const type = context.getType<GqlContextType>();
  if (type === 'graphql') {
    return GqlExecutionContext.create(context).getContext<GqlContext>().req
      .user!;
  }
  if (type === 'http') {
    return context.switchToHttp().getRequest<RequestWithPrincipal>().user!;
  }
  throw new Error(`CurrentUser: unsupported execution context type "${type}"`);
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal =>
    principalFromContext(context),
);
