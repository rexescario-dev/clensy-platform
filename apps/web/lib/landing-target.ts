import { landingHref, type NavPrincipal } from './nav-groups';

export interface LandingState {
  currentAdmin: NavPrincipal | null | undefined;
  error: unknown;
  loading: boolean;
}

// The /app landing decision (plan decision 5): wait while loading; an errored
// or missing session goes to /login (middleware only checks the cookie
// exists); otherwise the shared landingHref rule. Undefined after loading
// means a principal with nothing visible. UX only (multi-tenant spec §5.13).
export function landingTarget({ currentAdmin, error, loading }: LandingState): string | undefined {
  if (loading) return undefined;
  if (error || !currentAdmin) return '/login';
  return landingHref(currentAdmin);
}
