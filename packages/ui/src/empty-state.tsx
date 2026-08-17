import type { ReactNode } from 'react';

export interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-3 py-10 text-center text-slate-500">
      <p className="text-sm">{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
