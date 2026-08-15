import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
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
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<GqlContext>().req.user!;
  },
);
