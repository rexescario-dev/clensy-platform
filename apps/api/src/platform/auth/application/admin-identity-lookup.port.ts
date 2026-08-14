import { AuthenticatedPrincipal } from '../domain/authenticated-principal';

// Application-facing port: callers depend on this interface/token, never on
// a concrete auth implementation. `findActiveAdminById()` is the entire public
// surface — it locates and returns an authenticated principal (id + role) or
// null if no active admin is found (spec §4.7, §5.2).
export interface AdminIdentityLookupPort {
  findActiveAdminById(id: string): Promise<AuthenticatedPrincipal | null>;
}

export const ADMIN_IDENTITY_LOOKUP = Symbol('ADMIN_IDENTITY_LOOKUP');
