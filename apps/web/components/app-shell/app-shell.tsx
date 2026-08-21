'use client';

import { ToastProvider } from '@clensy/ui';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

// Step 5 of the Task 5 brief. `AppShell` is the one composition point for
// every `/app/*` page (mounted from the single `apps/web/app/app/layout.tsx`
// — Tasks 6-8 add pages under it, not new layouts). It owns the
// `mobileNavOpen` boolean and hands it (plus the ability to close/toggle it)
// to both `Sidebar` (to render/hide the off-canvas drawer) and, via the
// button passed as `Header`'s children, to the mobile nav toggle. `Sidebar`
// additionally closes the drawer on its own via a `usePathname` effect, so
// navigating a link closes it even without an explicit toggle click.
// `ToastProvider` is mounted once here, for every `/app/*` page.
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar mobileNavOpen={mobileNavOpen} onMobileNavClose={() => setMobileNavOpen(false)} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              className="rounded-md border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ☰
            </button>
          </Header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
