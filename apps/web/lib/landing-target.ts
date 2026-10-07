import { landingHref, type NavPrincipal } from './nav-groups';

export interface LandingState {
  currentAdmin: NavPrincipal | null | undefined;
  error: unknown;
  loading: boolean;
}

// The /app landing decision (plan decision 5): wait while loading; no target
// on an error or a missing principal; otherwise the shared landingHref rule.
// An invalid session is the layout SessionGuard's to route (session routing
// spec §4.4), so this never targets the sign-in page. UX only (multi-tenant
// spec §5.13).
export function landingTarget({ currentAdmin, error, loading }: LandingState): string | undefined {
  if (loading || error || !currentAdmin) return undefined;
  return landingHref(currentAdmin);
}
