'use client';
import type { FormEvent, ReactNode } from 'react';
import { Modal } from '../modal';
import { Button } from '../button';

export interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => Promise<void> | void;
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

  // The single user-dismissal guard (#180, Dashboard UX Foundation §8.3):
  // Escape and the backdrop (through `Modal`'s `onClose`) and Cancel all
  // come through here, and none of them closes the dialog while a submit is
  // in flight. The request is dropped, not queued. `open` stays caller-owned,
  // so a caller can still close the dialog itself at any time.
  function requestClose() {
    if (submitting) return;
    onClose();
  }

  return (
    <Modal open={open} onClose={requestClose} title={title}>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={requestClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
