'use client';

import { useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';

export type LaundrySearchStatus = 'error' | 'idle' | 'loading' | 'ready';

export interface LaundrySearchComboboxCopy {
  empty: string;
  error: string;
  label: string;
  more: string;
  searching: string;
}

export interface LaundrySearchComboboxProps<T extends { id: string }> {
  id: string;
  copy: LaundrySearchComboboxCopy;
  disabled?: boolean;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  onFocus?: () => void;
  onQueryChange: (text: string) => void;
  onSelect: (option: T) => void;
  // Opens on focus and stays open for an empty text: the catalog pickers
  // browse the first page (#158 owner decision 3). The customer picker
  // leaves it off and opens only for a non-empty text (#160).
  openOnFocus?: boolean;
  options: readonly T[];
  query: string;
  renderOption: (option: T) => ReactNode;
  status: LaundrySearchStatus;
  truncated?: boolean;
}

const INPUT_CLASSES =
  'rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

// The laundry search combobox, extracted from the intake customer search
// (#160) for reuse (#158). @clensy/ui has no Combobox and
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
// The active option is an option id, not a position: when the results
// change, it stays on the same option or, if that option is gone, it is
// cleared and stays cleared until the user moves again. Options render only
// for a `ready` search, so nothing from an older search can be active or
// chosen while a newer one loads.
//
// Escape closes an open list and stops there, so the surrounding Modal,
// which listens for Escape on `document`, stays open. With the list closed,
// Escape reaches the Modal as usual.
export function LaundrySearchCombobox<T extends { id: string }>({
  id,
  copy,
  disabled,
  error,
  inputRef,
  onBlur,
  onFocus,
  onQueryChange,
  onSelect,
  openOnFocus,
  options,
  query,
  renderOption,
  status,
  truncated = false,
}: LaundrySearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const expanded = open && status !== 'idle';
  const rendered = status === 'ready' ? options : [];
  // A stored active id that no longer names a rendered option (the search
  // left `ready`, or that option left the results) is dropped here, so it
  // cannot come back by itself when a later result set includes it again.
  // Guarded, so it settles in one extra render (React's pattern for
  // adjusting state to props during render).
  if (activeId !== null && !rendered.some((option) => option.id === activeId)) setActiveId(null);
  const active = expanded ? rendered.findIndex((option) => option.id === activeId) : -1;

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  function select(option: T) {
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
        {copy.label}
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
        disabled={disabled}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(openOnFocus || event.target.value.trim() !== '');
          setActiveId(null);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          onFocus?.();
          if (openOnFocus) setOpen(true);
        }}
        onBlur={() => {
          close();
          onBlur?.();
        }}
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
        <ul id={listboxId} role="listbox" aria-label={copy.label} className="max-h-60 overflow-y-auto">
          {rendered.map((option, index) => {
            return (
              <li
                key={option.id}
                id={`${id}-option-${option.id}`}
                role="option"
                aria-selected={index === active}
                onClick={() => select(option)}
                className={`cursor-pointer px-3 py-2 ${index === active ? 'bg-slate-100' : ''}`}
              >
                {renderOption(option)}
              </li>
            );
          })}
        </ul>
        {status === 'loading' ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {copy.searching}
          </p>
        ) : null}
        {status === 'ready' && options.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {copy.empty}
          </p>
        ) : null}
        {status === 'ready' && truncated ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {copy.more}
          </p>
        ) : null}
        {status === 'error' ? (
          <p role="alert" className="px-3 py-2 text-sm text-red-600">
            {copy.error}
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
