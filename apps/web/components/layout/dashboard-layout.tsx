'use client';

import { ToastProvider } from '@clensy/ui';
import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '../ui/button';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { ShellChrome } from './shell-chrome';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)]">
        <ShellChrome className="contents [&>nav]:md:row-span-2">
          <AppSidebar
            mobileNavOpen={mobileNavOpen}
            onMobileNavClose={() => setMobileNavOpen(false)}
          />
          <AppHeader>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label="Toggle navigation menu"
            >
              <Menu />
            </Button>
          </AppHeader>
        </ShellChrome>
        <main className="row-start-2 min-w-0 overflow-y-auto bg-white p-6 text-slate-950 md:col-start-2">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
