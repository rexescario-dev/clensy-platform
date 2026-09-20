import { auth } from './messages/en/auth';
import { bookings } from './messages/en/bookings';

// Mirrors apps/web/i18n/messages.ts's own getMessages() convention (a flat
// object keyed by namespace, assembled from per-namespace files) — the same
// pattern, applied to @clensy/web's own reusable-component messages rather
// than apps/web's page-level ones. Add a line here per namespace as more
// @clensy/web components need translation.
export function getDefaultMessages() {
  return { auth, bookings };
}

export type ClensyMessages = ReturnType<typeof getDefaultMessages>;
