// @vitest-environment jsdom
import {
  LaundryCustomerPicker,
  LaundrySearchCombobox,
  type LaundrySearchComboboxCopy,
  type LaundrySearchStatus,
} from '@clensy/web';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real @clensy/web generic combobox in jsdom, the same harness as
// laundry-customer-picker.interaction.test.tsx: openOnFocus, onFocus, onBlur,
// keyboard, mouse, and the customer picker's focus default.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Option {
  id: string;
  name: string;
}

const COPY: LaundrySearchComboboxCopy = {
  empty: 'Nothing found.',
  error: 'Search failed.',
  label: 'Service',
  more: 'More.',
  searching: 'Looking…',
};
const OPTIONS: Option[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

let container: HTMLDivElement;
let root: Root;
let selected: string[];
const onFocus = vi.fn();
const onBlur = vi.fn();

function Harness({ openOnFocus, status = 'ready' }: { openOnFocus?: boolean; status?: LaundrySearchStatus }) {
  const [query, setQuery] = useState('');
  return (
    <div>
      <LaundrySearchCombobox<Option>
        id="svc"
        copy={COPY}
        query={query}
        options={OPTIONS}
        status={status}
        openOnFocus={openOnFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        onQueryChange={setQuery}
        onSelect={(option) => {
          selected.push(option.id);
          setQuery(option.name);
        }}
        renderOption={(option) => <span>{option.name}</span>}
      />
      <button type="button" id="elsewhere">
        Elsewhere
      </button>
    </div>
  );
}

function field(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#svc')!;
}

function expanded(): string | null {
  return field().getAttribute('aria-expanded');
}

function type(text: string, target: () => HTMLInputElement = field) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target(), text);
    target().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function press(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key });
  act(() => {
    field().dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  selected = [];
  onFocus.mockReset();
  onBlur.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('LaundrySearchCombobox interactions', () => {
  it('with openOnFocus, focus calls onFocus once and opens the list once the status is not idle', () => {
    act(() => root.render(<Harness openOnFocus />));
    act(() => field().focus());
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(expanded()).toBe('true');
    act(() => root.render(<Harness openOnFocus status="idle" />));
    expect(expanded()).toBe('false');
    act(() => root.render(<Harness openOnFocus status="loading" />));
    expect(expanded()).toBe('true');
  });

  it('with openOnFocus, clearing the text keeps the list open; without it, clearing closes', () => {
    act(() => root.render(<Harness openOnFocus />));
    act(() => field().focus());
    type('al');
    type('');
    expect(expanded()).toBe('true');
    act(() => root.render(<Harness />));
    type('al');
    expect(expanded()).toBe('true');
    type('');
    expect(expanded()).toBe('false');
  });

  it('wraps ArrowDown and ArrowUp, selects with Enter, and Escape closes without bubbling', () => {
    act(() => root.render(<Harness />));
    type('a');
    press('ArrowUp');
    expect(field().getAttribute('aria-activedescendant')).toBe('svc-option-c');
    press('ArrowDown');
    expect(field().getAttribute('aria-activedescendant')).toBe('svc-option-a');
    press('ArrowDown');
    expect(field().getAttribute('aria-activedescendant')).toBe('svc-option-b');
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(selected).toEqual(['b']);
    expect(expanded()).toBe('false');

    type('a');
    const stop = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    try {
      press('Escape');
      expect(stop).toHaveBeenCalled();
    } finally {
      stop.mockRestore();
    }
    expect(expanded()).toBe('false');
  });

  it('closes on blur and calls onBlur', () => {
    act(() => root.render(<Harness />));
    act(() => field().focus());
    type('a');
    expect(expanded()).toBe('true');
    act(() => container.querySelector<HTMLButtonElement>('#elsewhere')!.focus());
    expect(expanded()).toBe('false');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('selects an option on click, and a popup mousedown is cancelled', () => {
    act(() => root.render(<Harness />));
    type('a');
    const option = container.querySelector<HTMLElement>('#svc-option-c')!;
    const popup = option.closest('ul')!.parentElement!;
    let notCancelled = true;
    act(() => {
      notCancelled = popup.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(notCancelled).toBe(false);
    act(() => option.click());
    expect(selected).toEqual(['c']);
  });

  it('keeps the customer picker closed on focus, opening only when the user types', () => {
    function CustomerHarness({ initial }: { initial: string }) {
      const [query, setQuery] = useState(initial);
      return (
        <LaundryCustomerPicker
          id="customer"
          query={query}
          options={[{ id: 'c1', email: 'a@example.com', fullName: 'Ana', phone: '' }]}
          status="ready"
          onQueryChange={setQuery}
          onSelect={() => {}}
        />
      );
    }
    for (const initial of ['', 'an']) {
      act(() => root.render(<CustomerHarness initial={initial} />));
      const customer = () => container.querySelector<HTMLInputElement>('#customer')!;
      act(() => customer().focus());
      expect(customer().getAttribute('aria-expanded')).toBe('false');
      type('ana', customer);
      expect(customer().getAttribute('aria-expanded')).toBe('true');
      act(() => root.render(<div />));
    }
  });
});
