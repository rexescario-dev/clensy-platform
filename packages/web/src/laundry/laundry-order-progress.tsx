'use client';

import { StatusBadge } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { LAUNDRY_STATUS_TONE, type LaundryFulfillmentType, type LaundryOrderStatus } from './laundry-order-status';

export type LaundryProgressState = 'complete' | 'current' | 'upcoming';

export interface LaundryProgressStep {
  state: LaundryProgressState;
  status: LaundryOrderStatus;
}

export interface LaundryOrderProgressProps {
  fulfillmentType: LaundryFulfillmentType;
  status: LaundryOrderStatus;
}

type TerminalStatus = 'CANCELLED' | 'DAMAGED' | 'LOST' | 'REFUNDED' | 'REJECTED';

// Every status, mapped once (exhaustive, so a new status fails to compile).
// A terminal exception replaces the steps. `COMPLETED` marks every step done
// and none current (no `aria-current`). Any other status is the single
// current step at that slot of the §4.3 happy path: `AWAITING_PAYMENT`
// shares the Paid slot with `PAID`, and `AWAITING_PICKUP` /
// `AWAITING_DELIVERY` share the return slot.
const PROGRESS_SLOT: Readonly<Record<LaundryOrderStatus, number | 'terminal'>> = {
  AWAITING_DELIVERY: 6,
  AWAITING_PAYMENT: 3,
  AWAITING_PICKUP: 6,
  CANCELLED: 'terminal',
  COMPLETED: 7,
  DAMAGED: 'terminal',
  LOST: 'terminal',
  PAID: 3,
  PRICED: 2,
  PROCESSING: 4,
  READY: 5,
  RECEIVED: 0,
  REFUNDED: 'terminal',
  REJECTED: 'terminal',
  WEIGHED: 1,
};

const MARKER_CLASSES: Record<LaundryProgressState, string> = {
  complete: 'bg-slate-900',
  current: 'bg-white ring-2 ring-slate-900',
  upcoming: 'bg-slate-200',
};

export function LaundryOrderProgress({ fulfillmentType, status }: LaundryOrderProgressProps) {
  const t = useClensyTranslations('laundry');
  const steps = laundryProgressSteps(status, fulfillmentType);

  if (steps === null) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <StatusBadge label={t(`status.${status}`)} tone={LAUNDRY_STATUS_TONE[status]} />
        <p className="text-slate-700">{t(`progress.terminal.${status as TerminalStatus}`)}</p>
      </div>
    );
  }

  return (
    <ol aria-label={t('progress.label')} className="flex flex-col gap-2 text-sm">
      {steps.map((step) => (
        <li
          key={step.status}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="flex items-center gap-2"
        >
          <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${MARKER_CLASSES[step.state]}`} />
          <span className={step.state === 'upcoming' ? 'text-slate-500' : 'font-medium text-slate-900'}>
            {t(`status.${step.status}`)}
          </span>
          <span className="sr-only">{t(`progress.state.${step.state}`)}</span>
        </li>
      ))}
    </ol>
  );
}

// The §4.3 happy path for this order, or `null` for a terminal exception.
// The Paid slot reads "Awaiting payment" only while that is the status: it
// is a branch, never shown as a completed step. The return slot follows the
// status when the status is one of its two values, so a status and a
// `fulfillmentType` that disagree (the server never writes that) still
// render the recorded status as current; otherwise it follows
// `fulfillmentType`.
export function laundryProgressSteps(
  status: LaundryOrderStatus,
  fulfillmentType: LaundryFulfillmentType,
): LaundryProgressStep[] | null {
  const slot = PROGRESS_SLOT[status];
  if (slot === 'terminal') return null;
  const returnStep: LaundryOrderStatus =
    status === 'AWAITING_DELIVERY' || status === 'AWAITING_PICKUP'
      ? status
      : fulfillmentType === 'PICKUP'
        ? 'AWAITING_PICKUP'
        : 'AWAITING_DELIVERY';
  const path: LaundryOrderStatus[] = [
    'RECEIVED',
    'WEIGHED',
    'PRICED',
    status === 'AWAITING_PAYMENT' ? 'AWAITING_PAYMENT' : 'PAID',
    'PROCESSING',
    'READY',
    returnStep,
    'COMPLETED',
  ];
  return path.map((step, index) => ({
    state: index < slot || status === 'COMPLETED' ? 'complete' : index === slot ? 'current' : 'upcoming',
    status: step,
  }));
}
