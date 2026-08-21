'use client';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { useDialogBehavior } from './internal/use-dialog-behavior';

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
}

export function DetailDrawer({
  open,
  onClose,
  title,
  children,
  widthClassName = 'w-[420px]',
}: DetailDrawerProps) {
  const titleId = useId();
  const { containerRef, backdropProps } = useDialogBehavior(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" {...backdropProps()}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`h-full max-w-full overflow-y-auto bg-white p-6 shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 ${widthClassName}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
