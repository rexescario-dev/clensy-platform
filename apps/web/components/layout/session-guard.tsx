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
  const redirector = useRef<SessionRedirector | null>(null);

  // Declared first so the latch exists before the mount check below starts.
  useEffect(() => {
    const current = createSessionRedirector({
      clearStore: () => client.clearStore(),
      navigateToLogin: () => router.replace('/login'),
    });
    redirector.current = current;
    const unsubscribe = onSessionInvalid(() => void current.report());
    return () => {
      unsubscribe();
      current.dispose();
    };
  }, [client, router]);

  // Each check is bound to the redirector current when it starts, never read
  // from the ref when it settles (spec §4.2, §4.3 item 4).
  useEffect(() => {
    const current = redirector.current;
    if (!current) return;
    void runSessionCheck(() => client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' }), current);
  }, [client, pathname]);

  return null;
}
