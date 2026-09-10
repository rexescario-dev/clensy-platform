'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { NAV_GROUPS, findActiveHref } from '../../lib/nav-groups';
import { useSidebarCollapsed } from '../../lib/use-sidebar-collapsed';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { BrandMark } from './brand-mark';

export interface AppSidebarProps {
  mobileNavOpen: boolean;
  onMobileNavClose: () => void;
}

export function AppSidebar({ mobileNavOpen, onMobileNavClose }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const onMobileNavCloseRef = useRef(onMobileNavClose);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLElement | null>(null);
  const mobileWasOpenRef = useRef(false);
  const activeHref = findActiveHref(pathname ?? '');

  useEffect(() => {
    onMobileNavCloseRef.current = onMobileNavClose;
  }, [onMobileNavClose]);

  useEffect(() => {
    onMobileNavCloseRef.current();
  }, [pathname]);

  useEffect(() => {
    if (mobileNavOpen) {
      if (
        document.activeElement instanceof HTMLElement &&
        !mobileSheetRef.current?.contains(document.activeElement)
      ) {
        mobileTriggerRef.current = document.activeElement;
      }
      mobileSheetRef.current?.focus();
    } else if (mobileWasOpenRef.current) {
      mobileTriggerRef.current?.focus();
    }

    mobileWasOpenRef.current = mobileNavOpen;
  }, [mobileNavOpen]);

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] md:flex',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        <div className={cn('p-4', collapsed && 'px-3')}>
          <BrandMark name="Clensy" tagline="Laundry" compact={collapsed} />
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNavigation
            activeHref={activeHref}
            collapsed={collapsed}
            portalContainer={portalContainer}
          />
        </div>
        <Separator />
        <div className="p-2">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed ? 'px-0' : 'justify-start',
            )}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            {!collapsed ? <span>Collapse</span> : null}
          </Button>
        </div>
      </nav>

      <Sheet
        open={mobileNavOpen}
        modal={mobileNavOpen}
        onOpenChange={(open) => {
          if (!open) onMobileNavClose();
        }}
      >
        <SheetContent
          key={mobileNavOpen ? 'open' : 'closed'}
          ref={mobileSheetRef}
          side="left"
          portalContainer={portalContainer}
          forceMount
          inert={!mobileNavOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
          className="w-64 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-64 md:hidden"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Primary navigation</SheetTitle>
          <nav aria-label="Primary" className="flex h-full flex-col">
            <div className="p-4">
              <BrandMark name="Clensy" tagline="Laundry" />
            </div>
            <Separator />
            <div className="flex-1 overflow-y-auto py-4">
              <SidebarNavigation
                activeHref={activeHref}
                collapsed={false}
                portalContainer={portalContainer}
              />
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <div
        ref={setPortalContainer}
        data-shell-portal-root=""
        className="contents"
      />
    </>
  );
}

function SidebarNavigation({
  activeHref,
  collapsed,
  portalContainer,
}: {
  activeHref?: string;
  collapsed: boolean;
  portalContainer: HTMLElement | null;
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed ? (
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => (
              <NavigationLink
                key={item.href}
                active={item.href === activeHref}
                collapsed={collapsed}
                href={item.href}
                label={item.label}
                portalContainer={portalContainer}
              />
            ))}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

function NavigationLink({
  active,
  collapsed,
  href,
  label,
  portalContainer,
}: {
  active: boolean;
  collapsed: boolean;
  href: string;
  label: string;
  portalContainer: HTMLElement | null;
}) {
  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold',
          active
            ? 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground'
            : 'bg-sidebar-accent text-muted-foreground',
        )}
      >
        {label.charAt(0)}
      </span>
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} portalContainer={portalContainer}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
