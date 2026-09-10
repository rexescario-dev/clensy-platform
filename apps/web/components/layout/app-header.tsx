import type { ReactNode } from 'react';

import { UserMenu } from './user-menu';

export interface AppHeaderProps {
  children?: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="flex items-center gap-4 border-b border-border bg-background px-4 py-3 text-foreground">
      <div className="flex items-center gap-2 md:hidden">{children}</div>
      <div className="flex-1" />
      <UserMenu />
    </header>
  );
}
