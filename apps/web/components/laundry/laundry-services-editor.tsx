'use client';

import type { PricingUnit } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { LaundrySearchCombobox, useClensyTranslations } from '@clensy/web';
import { useEffect, useRef, useState } from 'react';
import {
  laundryRowDuplicate,
  laundryUnitKey,
  parseItemCount,
  type LaundryAddOnRow,
  type LaundryCatalogChoice,
} from '../../lib/laundry-service-selection';
import { useLaundryAddOnSearch, useLaundryServiceSearch } from '../../lib/use-laundry-catalog-search';
import type { LaundryServiceSelectionState } from '../../lib/use-laundry-service-selection';

type Translate = (key: string) => string;

const BASE_SEARCH_ID = 'laundry-base-service';
const BASE_COUNT_ID = 'laundry-base-count';

function addOnSearchId(key: number): string {
  return `laundry-add-on-${String(key)}`;
}

function addOnCountId(key: number): string {
  return `laundry-add-on-count-${String(key)}`;
}

export interface LaundryServicesEditorProps {
  // Every control is disabled while a price is confirmed (#162 owner
  // decision 6.3).
  disabled?: boolean;
  // From `useLaundryServiceSelection`, owned by the page (#158).
  state: LaundryServiceSelectionState;
}

// Base service and add-ons for a WEIGHED order (lifecycle spec §8.4.4,
// #158). It chooses services and takes counts only: the count input shows
// for a remembered PER_ITEM unit, and the Price card shows every unit, rate
// and amount (#162 owner decision 2). It never prices and computes no amount.
export function LaundryServicesEditor({ disabled = false, state }: LaundryServicesEditorProps) {
  const t = useClensyTranslations('laundry');
  const { previewError, selection, units } = state;
  const addRef = useRef<HTMLButtonElement>(null);
  // A row to focus once it has rendered; a new object per request.
  const [focusRow, setFocusRow] = useState<{ key: number } | null>(null);
  const [focusAdd, setFocusAdd] = useState<object | null>(null);

  useEffect(() => {
    if (focusRow) document.getElementById(addOnSearchId(focusRow.key))?.focus();
  }, [focusRow]);
  useEffect(() => {
    if (focusAdd) addRef.current?.focus();
  }, [focusAdd]);

  const target = previewError?.target ?? null;
  let alert: string | null = null;
  if (previewError) {
    const name =
      target?.kind === 'service'
        ? selection.base?.name
        : target?.kind === 'addOn'
          ? selection.addOns.find((row) => row.key === target.key)?.choice?.name
          : undefined;
    alert =
      name !== undefined
        ? t('order.services.noPrice').replace('{name}', name)
        : (previewError.message ?? t('order.services.previewFailure'));
  }

  const baseError = (() => {
    if (selection.baseTouched && !selection.base) return t('order.services.error.base');
    if (target?.kind === 'service') return t('order.services.noPriceRow');
    return undefined;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('order.services.base')} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <CatalogPicker
            id={BASE_SEARCH_ID}
            kind="service"
            label={t('order.services.base')}
            error={baseError}
            query={selection.baseQuery}
            onBlur={state.touchBase}
            onQueryChange={state.changeBaseQuery}
            onSelect={state.chooseBase}
            disabled={disabled}
            t={t}
          />
        </div>
        <LineDetail
          countId={BASE_COUNT_ID}
          count={selection.baseQuantity}
          countTouched={selection.baseQuantityTouched}
          disabled={disabled}
          rememberedUnit={selection.base ? units[laundryUnitKey('service', selection.base.id)] : undefined}
          onCountBlur={state.touchBaseQuantity}
          onCountChange={state.changeBaseQuantity}
          t={t}
        />
      </div>

      {selection.addOns.map((row, index) => (
        <AddOnRowEditor
          key={row.key}
          n={index + 1}
          noPrice={target?.kind === 'addOn' && target.key === row.key}
          disabled={disabled}
          row={row}
          rememberedUnit={row.choice ? units[laundryUnitKey('addOn', row.choice.id)] : undefined}
          state={state}
          onRemove={() => {
            state.removeAddOn(row.key);
            setFocusAdd({});
          }}
          t={t}
        />
      ))}

      <Button
        ref={addRef}
        type="button"
        variant="secondary"
        className="self-start"
        disabled={disabled}
        onClick={() => setFocusRow({ key: state.addAddOn() })}
      >
        {t('order.services.addAddOn')}
      </Button>

      {alert ? (
        <p role="alert" className="text-red-600">
          {alert}
        </p>
      ) : null}
    </div>
  );
}

function AddOnRowEditor({
  disabled,
  n,
  noPrice,
  onRemove,
  rememberedUnit,
  row,
  state,
  t,
}: {
  disabled: boolean;
  n: number;
  noPrice: boolean;
  onRemove: () => void;
  rememberedUnit: PricingUnit | undefined;
  row: LaundryAddOnRow;
  state: LaundryServiceSelectionState;
  t: Translate;
}) {
  const label = t('order.services.addOn').replace('{n}', String(n));
  // One message per row, most specific first.
  const error = laundryRowDuplicate(row, state.selection)
    ? t('order.services.duplicate')
    : row.touched && !row.choice
      ? t('order.services.error.emptyRow')
      : noPrice
        ? t('order.services.noPriceRow')
        : undefined;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <CatalogPicker
            id={addOnSearchId(row.key)}
            kind="addOn"
            label={label}
            error={error}
            query={row.query}
            onBlur={() => state.touchAddOn(row.key)}
            onQueryChange={(text) => state.changeAddOnQuery(row.key, text)}
            onSelect={(choice) => state.chooseAddOn(row.key, choice)}
            disabled={disabled}
            t={t}
          />
        </div>
        <LineDetail
          countId={addOnCountId(row.key)}
          count={row.quantity}
          countTouched={row.quantityTouched}
          disabled={disabled}
          rememberedUnit={rememberedUnit}
          onCountBlur={() => state.touchAddOnQuantity(row.key)}
          onCountChange={(text) => state.changeAddOnQuantity(row.key, text)}
          t={t}
        />
      </div>
      <Button type="button" variant="secondary" className="self-start" disabled={disabled} onClick={onRemove}>
        {t('order.services.removeAddOn').replace('{n}', String(n))}
      </Button>
    </div>
  );
}

// The count input for a remembered PER_ITEM unit (owner decision 6). The
// unit display and the rate are in the Price card (#162 owner decision 2).
function LineDetail({
  count,
  countId,
  countTouched,
  disabled,
  onCountBlur,
  onCountChange,
  rememberedUnit,
  t,
}: {
  count: string;
  countId: string;
  countTouched: boolean;
  disabled: boolean;
  onCountBlur: () => void;
  onCountChange: (text: string) => void;
  rememberedUnit: PricingUnit | undefined;
  t: Translate;
}) {
  if (rememberedUnit !== 'PER_ITEM') return null;
  const countError = countTouched && parseItemCount(count) === null ? t('order.services.error.count') : undefined;
  return (
    <div className="flex flex-col gap-2 sm:w-56">
      <FormField
        label={t('order.services.count')}
        name={countId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={count}
        error={countError}
        disabled={disabled}
        onChange={(event) => onCountChange(event.currentTarget.value)}
        onBlur={onCountBlur}
      />
    </div>
  );
}

// A catalog search on the shared combobox. It browses on focus (owner
// decision 3); the server does every filter.
function CatalogPicker({
  disabled,
  error,
  id,
  kind,
  label,
  onBlur,
  onQueryChange,
  onSelect,
  query,
  t,
}: {
  disabled: boolean;
  error: string | undefined;
  id: string;
  kind: 'addOn' | 'service';
  label: string;
  onBlur: () => void;
  onQueryChange: (text: string) => void;
  onSelect: (choice: LaundryCatalogChoice) => void;
  query: string;
  t: Translate;
}) {
  const [active, setActive] = useState(false);
  const serviceSearch = useLaundryServiceSearch(query, active && kind === 'service');
  const addOnSearch = useLaundryAddOnSearch(query, active && kind === 'addOn');
  const search = kind === 'service' ? serviceSearch : addOnSearch;
  return (
    <LaundrySearchCombobox
      id={id}
      disabled={disabled}
      copy={{
        empty: t(`order.services.search.${kind}.empty`),
        error: t(`order.services.search.${kind}.error`),
        label,
        more: t('order.services.search.more'),
        searching: t('order.services.search.searching'),
      }}
      error={error}
      openOnFocus
      options={search.options}
      query={query}
      status={search.status}
      truncated={search.truncated}
      renderOption={(option) => <span className="block text-sm text-slate-900">{option.name}</span>}
      onBlur={onBlur}
      onFocus={() => setActive(true)}
      onQueryChange={onQueryChange}
      onSelect={onSelect}
    />
  );
}
