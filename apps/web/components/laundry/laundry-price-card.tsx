'use client';

import { Button } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { formatMinorUnits } from '../../lib/format-price';
import type { LaundryEstimateState, LaundryPriceRow } from '../../lib/laundry-price-review';

type Translate = (key: string) => string;

const CAPTION_ID = 'laundry-price-caption';

export type LaundryPriceCardProps =
  {
      kind: 'estimate';
      confirming: boolean;
      // Another mutation on the order page holds the page lock (#165):
      // Confirm is disabled, with the estimate unchanged.
      disabled?: boolean;
      // The confirm failure to show, already limited to the current
      // selection by the page (planning decision e).
      failure: string | undefined;
      onConfirm: () => void;
      onRetry: () => void;
      // Shown only in the `ready` state (owner decision 3).
      rows: readonly LaundryPriceRow[];
      state: LaundryEstimateState;
      totalMinorUnits: number | null;
    } | { kind: 'final'; more: boolean; rows: readonly LaundryPriceRow[]; totalMinorUnits: number };

// The Price section's card (#162). An estimate is built from the current
// preview, a final price from the frozen snapshot (§8.4.4). Every figure is
// the server's; this only formats (owner decision 1).
export function LaundryPriceCard(props: LaundryPriceCardProps) {
  const t = useClensyTranslations('laundry');
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {t(props.kind === 'final' ? 'order.price.final' : 'order.price.estimate')}
      </p>
      {props.kind === 'final' ? (
        <>
          <Rows rows={props.rows} t={t} />
          {props.more ? <p className="mt-3 text-slate-600">{t('order.price.more')}</p> : null}
          <Footer label={t('order.price.total')} totalMinorUnits={props.totalMinorUnits} />
        </>
      ) : (
        <EstimateBody {...props} t={t} />
      )}
    </div>
  );
}

const STATE_SENTENCE: Partial<Record<LaundryEstimateState, string>> = {
  failed: 'order.price.failed',
  incomplete: 'order.price.incomplete',
  loading: 'order.price.loading',
  noBase: 'order.price.noBase',
};

function EstimateBody({
  confirming,
  disabled = false,
  failure,
  onConfirm,
  onRetry,
  rows,
  state,
  t,
  totalMinorUnits,
}: Extract<LaundryPriceCardProps, { kind: 'estimate' }> & { t: Translate }) {
  // `ready` without a server total is inconsistent (M5 round 1). It shows as
  // `failed`, with Try again, never as a blank estimate and never with an
  // invented total.
  const shown: LaundryEstimateState = state === 'ready' && totalMinorUnits === null ? 'failed' : state;
  const sentence = STATE_SENTENCE[shown];
  const ready = shown === 'ready' && totalMinorUnits !== null;
  return (
    <>
      <div aria-live="polite">{sentence ? <p className="mt-3 text-slate-600">{t(sentence)}</p> : null}</div>
      {shown === 'failed' ? (
        <Button type="button" variant="secondary" className="mt-2" onClick={onRetry}>
          {t('order.price.retry')}
        </Button>
      ) : null}
      {ready ? (
        <>
          <Rows rows={rows} t={t} />
          <Footer label={t('order.price.estimatedTotal')} totalMinorUnits={totalMinorUnits} />
        </>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-3 text-red-600">
          {failure}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4 w-full sm:w-auto"
        disabled={!ready || confirming || disabled}
        aria-describedby={CAPTION_ID}
        onClick={onConfirm}
      >
        {t(confirming ? 'order.price.confirming' : 'order.price.confirm')}
      </Button>
      <p id={CAPTION_ID} className="mt-2 text-slate-600">
        {t('order.price.caption')}
      </p>
    </>
  );
}

function Rows({ rows, t }: { rows: readonly LaundryPriceRow[]; t: Translate }) {
  if (rows.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{row.name}</p>
            {row.quantity ? <p className="text-slate-600 tabular-nums">{quantityText(row.quantity, t)}</p> : null}
            <p className="text-slate-600 tabular-nums">
              {t(`order.price.rate.${row.rateKey}`).replace('{price}', formatMinorUnits(row.rateMinorUnits))}
            </p>
          </div>
          <p className="text-right font-medium text-slate-900 tabular-nums">{formatMinorUnits(row.amountMinorUnits)}</p>
          {row.minimumCharge ? (
            <p className="col-span-2 text-slate-600">
              {row.minimumCharge.minorUnits === null
                ? t('order.price.minimumApplied')
                : t('order.price.minimumAppliedAmount').replace('{amount}', formatMinorUnits(row.minimumCharge.minorUnits))}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function quantityText(quantity: NonNullable<LaundryPriceRow['quantity']>, t: Translate): string {
  if (quantity.kind === 'weight') return quantity.value;
  return quantity.value === '1' ? t('order.price.itemsOne') : t('order.price.items').replace('{n}', quantity.value);
}

function Footer({ label, totalMinorUnits }: { label: string; totalMinorUnits: number }) {
  return (
    <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-slate-200 pt-3">
      <p className="text-slate-700">{label}</p>
      <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMinorUnits(totalMinorUnits)}</p>
    </div>
  );
}
