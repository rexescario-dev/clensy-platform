'use client';

import type { Ref } from 'react';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import type { LaundryFulfillmentType } from './laundry-order-status';

export interface LaundryFulfillmentFieldsetProps {
  name: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: LaundryFulfillmentType) => void;
  value: LaundryFulfillmentType;
}

const OPTIONS: readonly LaundryFulfillmentType[] = ['PICKUP', 'DELIVERY'];

// How the finished laundry comes back, chosen once at intake (lifecycle spec
// §8.4.4: immutable after create; delivery does not schedule a route). Two
// native radios in a fieldset; each whole row is the radio's label, but the
// radio is named by its title alone and described by its description, so
// the description is read once (#181).
//
// A field error (in practice only a server one: a radio is always checked)
// shows under the rows. It marks both radios invalid and describes each,
// after its description. The fieldset keeps only the helper, so a screen
// reader that reads the group's description does not read the error twice.
// `inputRef` goes on the checked radio, so the form can focus it.
export function LaundryFulfillmentFieldset({ name, error, inputRef, onChange, value }: LaundryFulfillmentFieldsetProps) {
  const t = useClensyTranslations('laundry');
  const helperId = `${name}-fixed`;
  const errorId = `${name}-error`;

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={helperId}>
      <legend className="text-sm font-medium text-slate-700">{t('create.fulfillment.legend')}</legend>
      <p id={helperId} className="text-sm text-slate-500">
        {t('create.fulfillment.fixed')}
      </p>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
        {OPTIONS.map((option) => {
          const inputId = `${name}-${option}`;
          const titleId = `${inputId}-title`;
          const descriptionId = `${inputId}-description`;
          const checked = value === option;
          return (
            <label
              key={option}
              htmlFor={inputId}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${checked ? 'border-slate-900' : 'border-slate-300'}`}
            >
              <input
                ref={checked ? inputRef : undefined}
                id={inputId}
                type="radio"
                name={name}
                value={option}
                checked={checked}
                required
                aria-labelledby={titleId}
                aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
                aria-invalid={error ? true : undefined}
                onChange={() => onChange(option)}
                className="mt-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="flex flex-col">
                <span id={titleId} className="text-sm font-medium text-slate-900">
                  {t(`fulfillment.${option}`)}
                </span>
                <span id={descriptionId} className="text-sm text-slate-500">
                  {t(`create.fulfillment.description.${option}`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
