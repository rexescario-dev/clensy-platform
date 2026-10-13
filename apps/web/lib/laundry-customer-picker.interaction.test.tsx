// @vitest-environment jsdom
import {
  LaundryCustomerPicker,
  type LaundryCustomerOption,
  type LaundryCustomerSearchStatus,
} from '@clensy/web';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real @clensy/web picker in jsdom: keyboard, mouse, blur,
// result changes, and Escape against a `document` listener standing in for
// Modal's (the real Modal is covered by the page test). The harness keeps a
// selected id the way the intake dialog does: set on select, cleared on
// every `onQueryChange`. Typing uses the native value setter plus an
// `input` event, the helper the merged list interaction test uses.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const C1 = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const C2 = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };
const C3 = { id: 'c3', email: 'ben@example.com', fullName: 'Ben Cruz', phone: '555-0103' };
const OPTIONS: LaundryCustomerOption[] = [C1, C2, C3];

let container: HTMLDivElement;
let root: Root;
let selected: string[];
const submits = vi.fn();
const documentEscapes = vi.fn();

function Harness({ options, status }: { options: LaundryCustomerOption[]; status: LaundryCustomerSearchStatus }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submits();
      }}
    >
      <LaundryCustomerPicker
        id="customer"
        query={query}
        options={options}
        status={query.trim() === '' ? 'idle' : status}
        onQueryChange={(text) => {
          setQuery(text);
          setSelectedId('');
        }}
        onSelect={(option) => {
          selected.push(option.id);
          setSelectedId(option.id);
          setQuery(option.fullName);
        }}
      />
      <output id="selected-id">{selectedId}</output>
      <button type="button" id="elsewhere">
        Elsewhere
      </button>
    </form>
  );
}

// Stands in for Modal's `document`-level Escape listener.
function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') documentEscapes();
}

function field(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#customer')!;
}

function activeDescendant(): string | null {
  return field().getAttribute('aria-activedescendant');
}

function selectedId(): string {
  return container.querySelector('#selected-id')!.textContent ?? '';
}

function type(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Returns whether the event was not cancelled, as dispatchEvent does.
function press(key: string): boolean {
  let notCancelled = true;
  act(() => {
    notCancelled = field().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
  return notCancelled;
}

// Renders, or re-renders with new props (state is kept: same component).
function render(status: LaundryCustomerSearchStatus = 'ready', options: LaundryCustomerOption[] = OPTIONS) {
  act(() => root.render(<Harness options={options} status={status} />));
}

beforeAll(() => document.addEventListener('keydown', onDocumentKeyDown));
afterAll(() => document.removeEventListener('keydown', onDocumentKeyDown));

beforeEach(() => {
  selected = [];
  submits.mockReset();
  documentEscapes.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('LaundryCustomerPicker interactions', () => {
  it('opens the list as the user types and closes it when focus moves elsewhere', () => {
    render();
    act(() => field().focus());
    expect(field().getAttribute('aria-expanded')).toBe('false');
    type('an');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector<HTMLElement>('#customer-listbox')!.parentElement!.hidden).toBe(false);
    // A real focus move: jsdom fires blur/focusout on the input.
    act(() => container.querySelector<HTMLButtonElement>('#elsewhere')!.focus());
    expect(document.activeElement!.id).toBe('elsewhere');
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves the active option with ArrowDown and ArrowUp, wrapping at both ends', () => {
    render();
    type('a');
    expect(activeDescendant()).toBeNull();
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
    expect(container.querySelector('#customer-option-c1')!.getAttribute('aria-selected')).toBe('true');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c2');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c3');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
    press('ArrowUp');
    expect(activeDescendant()).toBe('customer-option-c3');
  });

  it('selects the active option with Enter, and Enter does not reach the form', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(press('Enter')).toBe(false); // cancelled
    expect(selected).toEqual(['c2']);
    expect(selectedId()).toBe('c2');
    expect(field().value).toBe('Ana Reyes');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(submits).not.toHaveBeenCalled();
  });

  it('clears the selected id when the text is edited after choosing', () => {
    render();
    type('a');
    press('ArrowDown');
    press('Enter');
    expect(selectedId()).toBe('c1');
    type('Ana Reyesx');
    expect(selectedId()).toBe('');
    press('ArrowDown');
    press('Enter');
    expect(selectedId()).toBe('c1');
    type('');
    expect(selectedId()).toBe('');
  });

  it('closes the list with Escape without letting the dialog see it, then lets the next Escape through', () => {
    render();
    type('a');
    press('Escape');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().value).toBe('a');
    expect(documentEscapes).not.toHaveBeenCalled();
    press('Escape');
    expect(documentEscapes).toHaveBeenCalledTimes(1);
  });

  it('selects an option by click, keeping focus in the input', () => {
    render();
    type('b');
    const option = container.querySelector<HTMLElement>('#customer-option-c3')!;
    let notCancelled = true;
    act(() => {
      notCancelled = option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(notCancelled).toBe(false);
    act(() => option.click());
    expect(selected).toEqual(['c3']);
    expect(field().value).toBe('Ben Cruz');
  });

  it('keeps the active option on the same customer when results change, and drops it when that customer leaves', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c2');
    render('ready', [C3, C2]); // reordered: c2 is now second, still the same customer
    expect(activeDescendant()).toBe('customer-option-c2');
    expect(container.querySelector('#customer-option-c2')!.getAttribute('aria-selected')).toBe('true');
    render('ready', [C1, C3]); // c2 left the results
    expect(activeDescendant()).toBeNull();
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
  });

  it('offers nothing while a newer search loads, even after an option was active', () => {
    render();
    type('a');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
    render('loading');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(activeDescendant()).toBeNull();
    expect(container.textContent).toContain('Searching…');
    press('ArrowDown');
    expect(activeDescendant()).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
  });

  it('does not bring back an active customer that left the results, until the user moves again', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c2');
    render('loading');
    expect(activeDescendant()).toBeNull();
    render('ready', [C1, C3]); // results without c2
    expect(activeDescendant()).toBeNull();
    render('ready', OPTIONS); // c2 is back
    expect(activeDescendant()).toBeNull();
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
  });

  it('collapses with nothing active when the text is cleared', () => {
    render();
    type('a');
    press('ArrowDown');
    type('');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(activeDescendant()).toBeNull();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });
});
