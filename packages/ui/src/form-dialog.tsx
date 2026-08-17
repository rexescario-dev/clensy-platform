'use client';
import type { FormEvent, ReactNode } from 'react';
import { Modal } from './modal';
import { Button } from './button';

export interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  submitting?: boolean;
  children: ReactNode;
}

export function FormDialog({
  open,
  onClose,
  title,
  onSubmit,
  submitLabel,
  submitting = false,
  children,
}: FormDialogProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
