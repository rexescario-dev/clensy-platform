'use client';

import { useApolloClient } from '@apollo/client';
import { useCurrentAdminQuery, useLogoutMutation } from '@clensy/client';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { accountIdentity } from '../../lib/account-identity';
import { useShellTheme } from './shell-chrome';

const THEME_OPTIONS = ['light', 'dark', 'system'] as const;

// Role labels come from @clensy/web's shared `roles` namespace (the same
// labels as the staff console), resolved through the app i18n boundary that
// app/app/layout.tsx mounts; the menu's own copy from apps/web's
// `nav.userMenu`.
export function UserMenu() {
  const t = useTranslations('nav');
  const tRoles = useClensyTranslations('roles');
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { data, loading: adminLoading } = useCurrentAdminQuery();
  const [logout, { loading: logoutLoading }] = useLogoutMutation();
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { preference, setPreference } = useShellTheme();

  async function handleLogout() {
    setLogoutFailed(false);
    try {
      const result = await logout();
      if (!result.data?.logout) throw new Error('logout returned false');
      await apolloClient.clearStore();
      router.replace('/login');
    } catch {
      setLogoutFailed(true);
    }
  }

  const identity = accountIdentity(data?.currentAdmin);
  const roleLabel = identity ? tRoles(identity.role) : undefined;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-9 gap-2 px-2 text-foreground"
            aria-label={t('userMenu.open')}
          >
            {adminLoading ? (
              <Skeleton className="h-8 w-24" aria-label={t('userMenu.loadingIdentity')} />
            ) : identity ? (
              <>
                <Avatar>
                  <AvatarFallback>{identity.initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{roleLabel}</span>
              </>
            ) : null}
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" portalContainer={portalContainer}>
          {identity ? (
            <>
              <DropdownMenuLabel>
                <span className="block">{roleLabel}</span>
                {identity.scopeKey ? (
                  <span className="block text-xs font-normal text-muted-foreground">{t(identity.scopeKey)}</span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel>{t('userMenu.theme')}</DropdownMenuLabel>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuItem key={option} onSelect={() => setPreference(option)}>
              <Check className={preference === option ? 'opacity-100' : 'opacity-0'} aria-hidden="true" />
              {t(`userMenu.themes.${option}`)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={logoutLoading} onSelect={() => void handleLogout()}>
            {logoutLoading ? t('userMenu.signingOut') : t('userMenu.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {logoutFailed ? <p className="text-xs text-destructive">{t('userMenu.signOutError')}</p> : null}
      <div ref={setPortalContainer} data-shell-portal-root="" className="contents" />
    </div>
  );
}
