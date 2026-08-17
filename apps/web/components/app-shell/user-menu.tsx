'use client';
import { useApolloClient } from '@apollo/client';
import { useLogoutMutation, useCurrentAdminQuery } from '@clensy/client';
import { Button } from '@clensy/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Step 4 of the Task 5 brief. Spec §4.3's failure message is "an inline
// message on the user menu," not a toast — deliberately not routed through
// `ToastProvider`/`useToast` (Task 2); `logoutError` is local component
// state rendered directly in this menu instead.
export function UserMenu() {
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { data } = useCurrentAdminQuery();
  const [logout, { loading }] = useLogoutMutation();
  const [logoutError, setLogoutError] = useState<string | undefined>(undefined);

  async function handleLogout() {
    setLogoutError(undefined);
    try {
      const result = await logout();
      if (!result.data?.logout) throw new Error('logout returned false');
      await apolloClient.clearStore();
      router.replace('/login');
    } catch {
      setLogoutError('Unable to log out. Please try again.');
    }
  }

  const admin = data?.currentAdmin;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {admin ? (
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{admin.role}</p>
            <p className="text-xs text-slate-500">{admin.id}</p>
          </div>
        ) : null}
        <Button variant="secondary" onClick={() => void handleLogout()} disabled={loading}>
          {loading ? 'Logging out…' : 'Log out'}
        </Button>
      </div>
      {logoutError ? <p className="text-xs text-red-600">{logoutError}</p> : null}
    </div>
  );
}
