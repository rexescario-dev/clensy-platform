import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export interface BrandMarkProps {
  mark?: ReactNode;
  name: string;
  tagline?: string;
  compact?: boolean;
}

function DefaultMark() {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent"
    >
      <span className="absolute inset-x-1.5 top-1.5 h-1.5 rounded-sm bg-sidebar-primary" />
      <span className="absolute inset-x-2 bottom-2 h-2 rounded-sm bg-sidebar-primary/70" />
    </span>
  );
}

export function BrandMark({ mark, name, tagline, compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {mark ?? <DefaultMark />}
      <div className={cn('flex min-w-0 flex-col', compact && 'sr-only')}>
        <span className="truncate text-sm font-semibold text-sidebar-foreground">{name}</span>
        {tagline ? <span className="truncate text-xs text-muted-foreground">{tagline}</span> : null}
      </div>
    </div>
  );
}
