// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal } from '../modal';
import { FormDialog } from './form-dialog';

// #180 (Dashboard UX Foundation, Amendment #180 §8.3): while a `FormDialog`
// is submitting it refuses every user-initiated dismissal, with no feedback
// and no replay; a topmost submitting `FormDialog` consumes Escape. The
// fixture's `onClose` handlers really close their dialog, so "stays open" is
// observable in the DOM, and `closes` records every `onClose` call. Tests
// marked [C] are characterization tests: they pin behavior that was already
// correct before #180.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = { formOpen: false, modalOpen: false, submitting: false };
let closes: string[] = [];
let container: HTMLDivElement;
let root: Root;

function cancel(): HTMLButtonElement {
  return [...formDialog()!.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === 'Cancel',
  )!;
}

function clickBackdrop(dialog: HTMLElement) {
  act(() => dialog.parentElement!.click());
}

function dialogs(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
}

function Fixture() {
  return (
    <>
      <button type="button">Trigger</button>
      <Modal
        open={state.modalOpen}
        onClose={() => {
          closes.push('modal');
          state.modalOpen = false;
          root.render(<Fixture />);
        }}
        title="Under"
      >
        <button type="button">Under action</button>
      </Modal>
      <FormDialog
        open={state.formOpen}
        onClose={() => {
          closes.push('form');
          state.formOpen = false;
          root.render(<Fixture />);
        }}
        title="Edit"
        onSubmit={() => {}}
        submitLabel="Save"
        submitting={state.submitting}
      >
        <input aria-label="Name" />
      </FormDialog>
    </>
  );
}

function formDialog(): HTMLElement | null {
  return dialogs().find((dialog) => dialog.querySelector('form')) ?? null;
}

function nameField(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[aria-label="Name"]')!;
}

function openForm(submitting: boolean) {
  state.formOpen = true;
  state.submitting = submitting;
  paint();
}

function paint() {
  act(() => root.render(<Fixture />));
}

function pressEscapeIn(element: HTMLElement) {
  act(() => element.focus());
  expect(document.activeElement).toBe(element);
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
}

function trigger(): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === 'Trigger',
  )!;
}

function underAction(): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === 'Under action',
  )!;
}

function underDialog(): HTMLElement | null {
  return dialogs().find((dialog) => !dialog.querySelector('form')) ?? null;
}

beforeEach(() => {
  state.formOpen = false;
  state.modalOpen = false;
  state.submitting = false;
  closes = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  paint();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('FormDialog dismissal (#180)', () => {
  it('closes on Escape when idle [C]', () => {
    openForm(false);
    pressEscapeIn(nameField());
    expect(closes).toEqual(['form']);
    expect(formDialog()).toBeNull();
  });

  it('closes on a backdrop click when idle [C]', () => {
    openForm(false);
    clickBackdrop(formDialog()!);
    expect(closes).toEqual(['form']);
    expect(formDialog()).toBeNull();
  });

  it('closes on Cancel when idle [C]', () => {
    openForm(false);
    act(() => cancel().click());
    expect(closes).toEqual(['form']);
    expect(formDialog()).toBeNull();
  });

  it('ignores Escape while submitting', () => {
    openForm(true);
    pressEscapeIn(nameField());
    expect(closes).toEqual([]);
    expect(formDialog()).not.toBeNull();
  });

  it('ignores a backdrop click while submitting', () => {
    openForm(true);
    clickBackdrop(formDialog()!);
    expect(closes).toEqual([]);
    expect(formDialog()).not.toBeNull();
  });

  it('keeps Cancel disabled while submitting [C]', () => {
    openForm(true);
    expect(cancel().disabled).toBe(true);
    act(() => cancel().click());
    expect(closes).toEqual([]);
    expect(formDialog()).not.toBeNull();
  });

  it('changes nothing visible when it refuses a dismissal', () => {
    openForm(true);
    act(() => nameField().focus());
    const before = document.body.innerHTML;
    pressEscapeIn(nameField());
    clickBackdrop(formDialog()!);
    expect(document.body.innerHTML).toBe(before);
    expect(closes).toEqual([]);
  });

  it('still closes when the caller sets open to false while submitting, and restores focus [C]', () => {
    act(() => trigger().focus());
    openForm(true);
    state.formOpen = false;
    paint();
    expect(formDialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(closes).toEqual([]);
  });

  it('does not replay a refused Escape when submitting ends', () => {
    openForm(true);
    pressEscapeIn(nameField());
    state.submitting = false;
    paint();
    expect(closes).toEqual([]);
    expect(formDialog()).not.toBeNull();
  });

  it('closes on Escape and the backdrop again once submitting is false [C]', () => {
    openForm(true);
    state.submitting = false;
    paint();
    pressEscapeIn(nameField());
    expect(closes).toEqual(['form']);
    openForm(false);
    clickBackdrop(formDialog()!);
    expect(closes).toEqual(['form', 'form']);
  });

  it('consumes Escape when the submitting FormDialog is on top', () => {
    state.modalOpen = true;
    paint();
    openForm(true);
    pressEscapeIn(nameField());
    expect(closes).toEqual([]);
    expect(formDialog()).not.toBeNull();
    expect(underDialog()).not.toBeNull();
  });

  it('lets Escape close a dialog on top of a submitting FormDialog [C]', () => {
    openForm(true);
    state.modalOpen = true;
    paint();
    pressEscapeIn(underAction());
    expect(closes).toEqual(['modal']);
    expect(formDialog()).not.toBeNull();
  });

  it('closes only the top FormDialog when idle and stacked [C]', () => {
    state.modalOpen = true;
    paint();
    openForm(false);
    pressEscapeIn(nameField());
    expect(closes).toEqual(['form']);
    expect(underDialog()).not.toBeNull();
  });
});
