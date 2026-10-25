'use client';

import { Button, ConfirmDialog, Separator } from '@clensy/ui';
import { useClensyTranslations, type LaundryOrderVerb } from '@clensy/web';
import {
  laundryActionGroups,
  type LaundryActionFailure,
  type LaundryActionVerb,
} from '../../lib/laundry-order-lifecycle-actions';

export interface LaundryOrderActionsProps {
  // `laundryOrderActions(status, fulfillmentType, role)` for the order.
  verbs: readonly LaundryOrderVerb[];
  // The page lock is held: another mutation on the page is running.
  disabled: boolean;
  // `laundryActionFailure(transition.failure, transition.message)`.
  failure: LaundryActionFailure | null;
  // A destructive verb awaiting confirmation, still in the helper's list.
  confirmVerb: LaundryActionVerb | null;
  // This dialog's own submission is running (#165 rule 6), never the page
  // lock: an unrelated mutation leaves an unsubmitted dialog cancellable.
  confirming: boolean;
  onRun: (verb: LaundryActionVerb) => void;
  onRequestConfirm: (verb: LaundryActionVerb) => void;
  onConfirm: (verb: LaundryActionVerb) => Promise<void>;
  onCloseConfirm: () => void;
}

// The order's lifecycle actions (#165, lifecycle spec §8.4.4): one button
// per verb the helper allows, forward actions first, then the destructive
// ones, which run only after their confirmation. The server re-checks every
// verb; there is no disabled button for an illegal one.
export function LaundryOrderActions({
  confirmVerb,
  confirming,
  disabled,
  failure,
  onCloseConfirm,
  onConfirm,
  onRequestConfirm,
  onRun,
  verbs,
}: LaundryOrderActionsProps) {
  const t = useClensyTranslations('laundry');
  const { destructive, forward } = laundryActionGroups(verbs);
  return (
    <div className="flex flex-col gap-3">
      {forward.length === 0 && destructive.length === 0 ? <p>{t('noActions')}</p> : null}
      {forward.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {forward.map((verb) => (
            <Button key={verb} type="button" disabled={disabled} onClick={() => onRun(verb)}>
              {t(`actions.${verb}`)}
            </Button>
          ))}
        </div>
      ) : null}
      {forward.length > 0 && destructive.length > 0 ? <Separator /> : null}
      {destructive.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {destructive.map((verb) => (
            <Button key={verb} type="button" variant="secondary" disabled={disabled} onClick={() => onRequestConfirm(verb)}>
              {t(`actions.${verb}`)}
            </Button>
          ))}
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="text-red-600">
          {failure.message ?? t(`failure.${failure.verb}`)}
        </p>
      ) : null}
      {confirmVerb === null ? null : (
        <ConfirmDialog
          open
          title={t(`actions.${confirmVerb}`)}
          description={t(`confirm.${confirmVerb}`)}
          confirmLabel={t(`actions.${confirmVerb}`)}
          confirming={confirming}
          onClose={onCloseConfirm}
          onConfirm={() => onConfirm(confirmVerb)}
        />
      )}
    </div>
  );
}
