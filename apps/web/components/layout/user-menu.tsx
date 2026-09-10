'use client';

import { useApolloClient } from '@apollo/client';
import { useCurrentAdminQuery, useLogoutMutation } from '@clensy/client';
import { Check, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { presentRole } from '../../lib/role-presentation';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { useShellTheme } from './shell-chrome';

const THEME_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
] as const;

export function UserMenu() {
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { data, loading: adminLoading } = useCurrentAdminQuery();
  const [logout, { loading: logoutLoading }] = useLogoutMutation();
  const [logoutError, setLogoutError] = useState<string | undefined>(undefined);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { preference, setPreference } = useShellTheme();

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

  const role = presentRole(data?.currentAdmin?.role);

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-9 gap-2 px-2 text-foreground"
            aria-label="Open user menu"
          >
            {adminLoading ? (
              <Skeleton className="h-8 w-24" aria-label="Loading user identity" />
            ) : role ? (
              <>
                <Avatar>
                  <AvatarFallback>{role.initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{role.label}</span>
              </>
            ) : null}
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" portalContainer={portalContainer}>
          {role ? (
            <>
              <DropdownMenuLabel>{role.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setPreference(option.value)}
            >
              <Check
                className={preference === option.value ? 'opacity-100' : 'opacity-0'}
                aria-hidden="true"
              />
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={logoutLoading}
            onSelect={() => void handleLogout()}
          >
            {logoutLoading ? 'Logging out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {logoutError ? (
        <p className="text-xs text-destructive">{logoutError}</p>
      ) : null}
      <div ref={setPortalContainer} data-shell-portal-root="" className="contents" />
    </div>
  );
}
