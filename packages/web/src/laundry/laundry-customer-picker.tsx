'use client';

import { useState, type KeyboardEvent, type Ref } from 'react';
import { useClensyTranslations } from '../i18n/use-clensy-translations';

export interface LaundryCustomerOption {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

export type LaundryCustomerSearchStatus = 'error' | 'idle' | 'loading' | 'ready';

export interface LaundryCustomerPickerProps {
  id: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange: (text: string) => void;
  onSelect: (option: LaundryCustomerOption) => void;
  options: readonly LaundryCustomerOption[];
  query: string;
  status: LaundryCustomerSearchStatus;
  truncated?: boolean;
}

const INPUT_CLASSES =
  'rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

// The laundry intake customer search (#160). @clensy/ui has no Combobox and
// this slice adds no dependency, so this is the WAI-ARIA editable combobox
// with a listbox popup, built from a native input. It owns only whether the
// list is open and which option is active; the caller owns the text, the
// server search, the options and the selection. The label, input and error
// follow FormField's markup and classes.
//
// `onQueryChange` fires only for a user edit; the caller clears its
// selection there. On `onSelect` the caller sets the text to the chosen
// name itself, so a selection is never cleared by its own display text.
//
// The active option is a customer id, not a position: when the results
// change, it stays on the same customer or, if that customer is gone, it is
// cleared and stays cleared until the user moves again. Options render only
// for a `ready` search, so nothing from an older search can be active or
// chosen while a newer one loads.
//
// Escape closes an open list and stops there, so the surrounding Modal,
// which listens for Escape on `document`, stays open. With the list closed,
// Escape reaches the Modal as usual.
export function LaundryCustomerPicker({
  id,
  error,
  inputRef,
  onQueryChange,
  onSelect,
  options,
  query,
  status,
  truncated = false,
}: LaundryCustomerPickerProps) {
  const t = useClensyTranslations('laundry');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const expanded = open && status !== 'idle';
  const rendered = status === 'ready' ? options : [];
  // A stored active id that no longer names a rendered option (the search
  // left `ready`, or that customer left the results) is dropped here, so it
  // cannot come back by itself when a later result set includes it again.
  // Guarded, so it settles in one extra render (React's pattern for
  // adjusting state to props during render).
  if (activeId !== null && !rendered.some((option) => option.id === activeId)) setActiveId(null);
  const active = expanded ? rendered.findIndex((option) => option.id === activeId) : -1;

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  function select(option: LaundryCustomerOption) {
    onSelect(option);
    close();
  }

  function move(step: -1 | 1) {
    const count = rendered.length;
    if (count === 0) {
      setActiveId(null);
      return;
    }
    const next = active === -1 ? (step === 1 ? 0 : count - 1) : (active + step + count) % count;
    setActiveId(rendered[next].id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) setOpen(true);
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && expanded) {
      // Enter belongs to the list while it is open; it never submits the form.
      event.preventDefault();
      if (active >= 0) select(rendered[active]);
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      // Next.js hydrates React on `document`, the node Modal also listens on,
      // and React's listener was registered first, so it runs first. A
      // synthetic stopPropagation does not stop other listeners on that same
      // node; the native stopImmediatePropagation does.
      event.nativeEvent.stopImmediatePropagation();
      close();
    }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {t('create.customer.label')}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={expanded}
        aria-activedescendant={active >= 0 ? `${id}-option-${rendered[active].id}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(event.target.value.trim() !== '');
          setActiveId(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
        className={`${INPUT_CLASSES} ${error ? 'border-red-500' : 'border-slate-300'}`}
      />
      <div
        hidden={!expanded}
        // Keeps focus in the input, so blur does not close the list before a
        // click selects, or when the popup's padding, scrollbar or status
        // lines are pressed.
        onMouseDown={(event) => event.preventDefault()}
        className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
      >
        <ul id={listboxId} role="listbox" aria-label={t('create.customer.label')} className="max-h-60 overflow-y-auto">
          {rendered.map((option, index) => {
            const secondary = option.phone !== '' ? option.phone : option.email;
            return (
              <li
                key={option.id}
                id={`${id}-option-${option.id}`}
                role="option"
                aria-selected={index === active}
                onClick={() => select(option)}
                className={`cursor-pointer px-3 py-2 ${index === active ? 'bg-slate-100' : ''}`}
              >
                <span className="block text-sm text-slate-900">{option.fullName}</span>
                <span className="block text-sm text-slate-500">{secondary}</span>
              </li>
            );
          })}
        </ul>
        {status === 'loading' ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.searching')}
          </p>
        ) : null}
        {status === 'ready' && options.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.empty')}
          </p>
        ) : null}
        {status === 'ready' && truncated ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.more')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p role="alert" className="px-3 py-2 text-sm text-red-600">
            {t('create.customer.error')}
          </p>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
