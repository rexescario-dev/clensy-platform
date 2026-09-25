import { Filter } from '@ptc-org/nestjs-query-core';
import { AuthorizerOptions } from '@ptc-org/nestjs-query-graphql';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';

interface TenantOwned {
  id: string;
  tenantId: string;
}

// Multi-tenant spec §4.5: the only tenant source is the DB-loaded principal
// `AuthGuard` put on `req.user`. nestjs-query ANDs this filter with the
// client's, so a client filter can narrow rows but never widen them. A
// principal without a tenant (platform scope, or none) matches no row —
// `id` is the primary key and is never null.
export function tenantFilterFor(tenantId: string | null): Filter<TenantOwned> {
  return tenantId === null
    ? { id: { is: null } }
    : { tenantId: { eq: tenantId } };
}

export function tenantReadAuthorizer<
  DTO extends { id: string },
>(): AuthorizerOptions<DTO> {
  return {
    authorize: (context: { req?: { user?: AuthenticatedPrincipal } }) =>
      tenantFilterFor(context.req?.user?.tenantId ?? null) as Filter<DTO>,
  };
}
