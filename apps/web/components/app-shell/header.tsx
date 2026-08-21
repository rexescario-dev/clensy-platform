import type { ReactNode } from 'react';
import { UserMenu } from './user-menu';

// Step 3 of the Task 5 brief: `Header` renders whatever `children` it is
// given — in practice, always the mobile nav-toggle button that `AppShell`
// (Step 5) builds and wires to its `mobileNavOpen` state/setter — and mounts
// `UserMenu`. `Header` intentionally does NOT render `PageHeader`; each
// migrated page renders its own `PageHeader` as the first element of its own
// content (see `apps/web/app/app/layout.tsx`'s comment for why).
export interface HeaderProps {
  children?: ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 md:hidden">{children}</div>
      <div className="flex-1" />
      <UserMenu />
    </header>
  );
}
