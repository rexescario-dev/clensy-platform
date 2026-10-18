// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailDrawer } from '../base/detail-drawer';
import { FormDialog } from '../base/dialogs/form-dialog';
import { Modal } from '../base/modal';

// #193: `useDialogBehavior`'s shared Escape handler. The first block pins
// existing focus, cleanup and Strict Mode behavior [C] before the hook
// changes (Dashboard UX Foundation §4.4, §4.6, §8.3.2, §8.5). It asserts only
// through the DOM, `document.activeElement` and `onClose` calls, never the
// hook's refs or its dialog stack.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let restoreSpies: (() => void) | null = null;

function button(text: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === text,
  )!;
}

function dialogTitled(title: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
      (dialog) => document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent === title,
    ) ?? null
  );
}

function focusTrigger() {
  act(() => button('Trigger').focus());
  expect(document.activeElement).toBe(button('Trigger'));
}

function mount(ui: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(ui));
}

function pressEscape() {
  act(() => {
    (document.activeElement ?? document).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
}

function rerender(ui: ReactNode) {
  act(() => root!.render(ui));
}

// The `keydown` handlers currently registered on `document`: added on add,
// deleted on remove. Strict Mode's extra development setup and cleanup are
// not the contract, so tests assert this set, never raw call counts.
function trackActiveKeydownListeners(): Set<EventListenerOrEventListenerObject> {
  const active = new Set<EventListenerOrEventListenerObject>();
  const add = document.addEventListener;
  const remove = document.removeEventListener;
  const addSpy = vi
    .spyOn(document, 'addEventListener')
    .mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
      if (type === 'keydown') active.add(listener);
      add.call(document, type, listener, options);
    });
  const removeSpy = vi
    .spyOn(document, 'removeEventListener')
    .mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean) => {
      if (type === 'keydown') active.delete(listener);
      remove.call(document, type, listener, options);
    });
  restoreSpies = () => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  };
  return active;
}

afterEach(() => {
  restoreSpies?.();
  restoreSpies = null;
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useDialogBehavior focus and Strict Mode (#193) [C]', () => {
  function FocusTree({ open, onClose = () => {} }: { open: boolean; onClose?: () => void }) {
    return (
      <>
        <button type="button">Trigger</button>
        <Modal open={open} onClose={onClose} title="Focus">
          <button type="button">First</button>
        </Modal>
      </>
    );
  }

  it('moves focus into the dialog on open and restores it to the trigger on close', () => {
    mount(<FocusTree open={false} />);
    focusTrigger();
    rerender(<FocusTree open />);
    // jsdom has no layout (`offsetParent` is always null), so the hook finds
    // nothing focusable and focuses the dialog container, its fallback. The
    // contract checked here is only that focus moved into the dialog.
    expect(dialogTitled('Focus')!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(button('Trigger'));
    rerender(<FocusTree open={false} />);
    expect(document.activeElement).toBe(button('Trigger'));
  });

  it('restores focus to the trigger and stops handling Escape when the dialog unmounts while open', () => {
    const spy = vi.fn();
    function DrawerTree({ drawer }: { drawer: boolean }) {
      return (
        <>
          <button type="button">Trigger</button>
          {drawer ? (
            <DetailDrawer open onClose={spy} title="Details">
              <p>Body</p>
            </DetailDrawer>
          ) : null}
        </>
      );
    }
    mount(<DrawerTree drawer={false} />);
    focusTrigger();
    const active = trackActiveKeydownListeners();
    const before = active.size;
    rerender(<DrawerTree drawer />);
    expect.soft(dialogTitled('Details')?.contains(document.activeElement)).toBe(true);
    expect.soft(active.size).toBe(before + 1);
    rerender(<DrawerTree drawer={false} />);
    // The size check is what proves cleanup: the Escape check alone would
    // pass with a leaked listener, because the unmounted drawer is no longer
    // topmost.
    expect.soft(active.size).toBe(before);
    expect.soft(document.activeElement).toBe(button('Trigger'));
    expect.soft(dialogTitled('Details')).toBeNull();
    pressEscape();
    expect.soft(spy).not.toHaveBeenCalled();
  });

  it('closes once per Escape under Strict Mode, cleans up on close and restores focus', () => {
    let open = false;
    const onClose = vi.fn(() => {
      open = false;
      root!.render(tree());
    });
    const tree = () => (
      <StrictMode>
        <FocusTree open={open} onClose={onClose} />
      </StrictMode>
    );
    mount(tree());
    focusTrigger();
    const active = trackActiveKeydownListeners();
    open = true;
    rerender(tree());
    expect.soft(active.size).toBe(1);
    pressEscape();
    expect.soft(onClose).toHaveBeenCalledTimes(1);
    expect.soft(dialogTitled('Focus')).toBeNull();
    expect.soft(active.size).toBe(0);
    expect.soft(document.activeElement).toBe(button('Trigger'));
    pressEscape();
    expect.soft(onClose).toHaveBeenCalledTimes(1);
    open = true;
    rerender(tree());
    expect.soft(active.size).toBe(1);
    pressEscape();
    expect.soft(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next', () => {
    const view = { edit: false, submitting: true, under: false };
    const closes: string[] = [];
    const tree = () => (
      <StrictMode>
        <button type="button">Trigger</button>
        <Modal
          open={view.under}
          onClose={() => {
            closes.push('under');
            view.under = false;
            root!.render(tree());
          }}
          title="Under"
        >
          <button type="button">Under action</button>
        </Modal>
        <FormDialog
          open={view.edit}
          onClose={() => {
            closes.push('edit');
            view.edit = false;
            root!.render(tree());
          }}
          title="Edit"
          onSubmit={() => {}}
          submitLabel="Save"
          submitting={view.submitting}
        >
          <input aria-label="Name" />
        </FormDialog>
      </StrictMode>
    );
    mount(tree());
    focusTrigger();
    view.under = true;
    rerender(tree());
    view.edit = true;
    rerender(tree());
    pressEscape();
    expect(closes).toEqual([]);
    expect(dialogTitled('Edit')).not.toBeNull();
    expect(dialogTitled('Under')).not.toBeNull();
    view.submitting = false;
    rerender(tree());
    pressEscape();
    expect(closes).toEqual(['edit']);
    expect(dialogTitled('Edit')).toBeNull();
    expect(dialogTitled('Under')).not.toBeNull();
    // A stale topmost entry for the closed `Edit` would keep `Under` from
    // closing here. This does not prove `Under` has no duplicate entries.
    pressEscape();
    expect(closes).toEqual(['edit', 'under']);
    expect(dialogTitled('Under')).toBeNull();
  });
});
