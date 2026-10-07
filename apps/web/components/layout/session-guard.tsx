'use client';

import { useApolloClient } from '@apollo/client';
import { CurrentAdminDocument, onSessionInvalid } from '@clensy/client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { createSessionRedirector, runSessionCheck, type SessionRedirector } from '../../lib/session-redirect';

// The one /app session rule (session routing spec §4.2), mounted once by
// app/app/layout.tsx beside PageVisibilityGate. It renders nothing and never
// blocks the page. It redirects to /login only on session evidence (spec §3):
// an UNAUTHENTICATED operation (the packages/client session signal), or a
// network-only currentAdmin check, run on mount and on each pathname change,
// that settles with no principal. A failed check is not evidence and is
// ignored; an UNAUTHENTICATED check has already raised the signal. It decides
// only whether a session exists — page visibility stays with the gate. UX
// only: the API remains the authentication and authorization authority.
export function SessionGuard() {
  const client = useApolloClient();
  const router = useRouter();
  const pathname = usePathname();
  const latest = useRef({ client, router });
  const redirector = useRef<SessionRedirector | null>(null);

  // Keeps the redirect calling the current client and router (spec §4.3
  // item 1) without re-creating the latch when their identity changes.
  useEffect(() => {
    latest.current = { client, router };
  }, [client, router]);

  // One redirector per mount: never replaced while the guard stays mounted
  // (spec §4.3 item 1, invariant 3). Declared before the check below so the
  // latch exists before the mount check starts.
  useEffect(() => {
    const current = createSessionRedirector({
      clearStore: () => latest.current.client.clearStore(),
      navigateToLogin: () => latest.current.router.replace('/login'),
    });
    redirector.current = current;
    const unsubscribe = onSessionInvalid(() => void current.report());
    return () => {
      unsubscribe();
      current.dispose();
    };
  }, []);

  // Each check is bound to the redirector current when it starts, never read
  // from the ref when it settles (spec §4.2, §4.3 item 4).
  useEffect(() => {
    const current = redirector.current;
    if (!current) return;
    void runSessionCheck(() => client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' }), current);
  }, [client, pathname]);

  return null;
}
