'use client';
import { Modal } from './modal';
import { Button } from './button';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  confirming?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirming = false,
}: ConfirmDialogProps) {
  // Deliberately not `onClick={() => void onConfirm()}` — `void` discards
  // the promise entirely, so a rejected `onConfirm()` becomes an unhandled
  // promise rejection for every `ConfirmDialog` consumer, not just ones that
  // happen to await it themselves. Awaiting inside a try/catch here consumes
  // the rejection instead. `ConfirmDialog` has no error-display slot in its
  // contract, so there is nothing further to do on catch — displaying the
  // failure is the caller's responsibility via whatever it passed as
  // `onConfirm` (e.g. it can set its own local error state before rejecting/
  // after catching internally).
  async function handleConfirmClick() {
    try {
      await onConfirm();
    } catch {
      // Intentionally swallowed — see comment above.
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => void handleConfirmClick()}
          disabled={confirming}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
