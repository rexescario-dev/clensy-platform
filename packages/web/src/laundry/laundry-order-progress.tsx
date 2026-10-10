'use client';

import { StatusBadge } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { LAUNDRY_STATUS_TONE, type LaundryFulfillmentType, type LaundryOrderStatus } from './laundry-order-status';
import { isLaundryTerminalStatus, laundryHappyPathSteps, type LaundryProgressState } from './laundry-progress-steps';

export interface LaundryOrderProgressProps {
  fulfillmentType: LaundryFulfillmentType;
  status: LaundryOrderStatus;
}

const MARKER_CLASSES: Record<LaundryProgressState, string> = {
  complete: 'bg-slate-900',
  current: 'bg-white ring-2 ring-slate-900',
  upcoming: 'bg-slate-200',
};

export function LaundryOrderProgress({ fulfillmentType, status }: LaundryOrderProgressProps) {
  const t = useClensyTranslations('laundry');

  if (isLaundryTerminalStatus(status)) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <StatusBadge label={t(`status.${status}`)} tone={LAUNDRY_STATUS_TONE[status]} />
        <p className="text-slate-700">{t(`progress.terminal.${status}`)}</p>
      </div>
    );
  }

  return (
    <ol aria-label={t('progress.label')} className="flex flex-col gap-2 text-sm">
      {laundryHappyPathSteps(status, fulfillmentType).map((step) => (
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
