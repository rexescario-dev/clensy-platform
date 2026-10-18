// @vitest-environment jsdom
import { act, startTransition, StrictMode, useLayoutEffect } from 'react';
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

// Presses Escape from a layout effect: after the DOM commit that turns
// `fire` true, before that commit's passive effects. Rendered before the
// dialog, so it also runs before any layout effect inside the dialog.
function EscapeInCommit({ fire }: { fire: boolean }) {
  useLayoutEffect(() => {
    if (!fire) return;
    (document.activeElement ?? document).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  }, [fire]);
  return null;
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
    // The `Modal` mounts already open: Strict Mode re-runs effect setup and
    // cleanup only on mount, so only an open mount exercises that sequence
    // while the dialog is open. Closing keeps it mounted with `open={false}`.
    let mounted = false;
    let open = false;
    const onClose = vi.fn(() => {
      open = false;
      root!.render(tree());
    });
    const tree = () => (
      <StrictMode>
        <button type="button">Trigger</button>
        {mounted ? (
          <Modal open={open} onClose={onClose} title="Focus">
            <button type="button">First</button>
          </Modal>
        ) : null}
      </StrictMode>
    );
    mount(tree());
    focusTrigger();
    const active = trackActiveKeydownListeners();
    mounted = true;
    open = true;
    rerender(tree());
    expect.soft(active.size).toBe(1);
    pressEscape();
    expect.soft(onClose).toHaveBeenCalledTimes(1);
    expect.soft(dialogTitled('Focus')).toBeNull();
    expect.soft(active.size).toBe(0);
    expect.soft(document.activeElement).toBe(button('Trigger'));
    // The delta isolates what this Escape did: the cumulative count above
    // cannot, once an earlier Escape has already raised the total.
    const callsBeforeClosedEscape = onClose.mock.calls.length;
    pressEscape();
    expect.soft(onClose).toHaveBeenCalledTimes(1);
    expect.soft(onClose.mock.calls.length).toBe(callsBeforeClosedEscape);
    open = true;
    rerender(tree());
    expect.soft(active.size).toBe(1);
    pressEscape();
    expect.soft(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next', () => {
    // Each dialog mounts already open, so Strict Mode's mount-time setup,
    // cleanup and setup run while it is open. Closing keeps it mounted.
    const view = { edit: false, editMounted: false, submitting: true, under: false, underMounted: false };
    const closes: string[] = [];
    const tree = () => (
      <StrictMode>
        <button type="button">Trigger</button>
        {view.underMounted ? (
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
        ) : null}
        {view.editMounted ? (
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
        ) : null}
      </StrictMode>
    );
    mount(tree());
    focusTrigger();
    view.underMounted = true;
    view.under = true;
    rerender(tree());
    view.editMounted = true;
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

describe('Escape uses the latest close callback (#193)', () => {
  // A `FormDialog` whose `onClose` really closes it, so "refused" and
  // "closed" are both observable in the DOM.
  function editTree(view: { fire: boolean; open: boolean; submitting: boolean }, onClose: () => void) {
    return (
      <>
        <EscapeInCommit fire={view.fire} />
        <FormDialog
          open={view.open}
          onClose={onClose}
          title="Edit"
          onSubmit={() => {}}
          submitLabel="Save"
          submitting={view.submitting}
        >
          <input aria-label="Name" />
        </FormDialog>
      </>
    );
  }

  it('calls the onClose from the commit the Escape lands in, not an earlier one', () => {
    const a = vi.fn();
    const b = vi.fn();
    const tree = (fire: boolean, onClose: () => void) => (
      <>
        <EscapeInCommit fire={fire} />
        <Modal open onClose={onClose} title="Plain">
          <button type="button">Inside</button>
        </Modal>
      </>
    );
    mount(tree(false, a));
    rerender(tree(true, b));
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it('refuses an Escape pressed in the commit that starts a submit', () => {
    const view = { fire: false, open: true, submitting: false };
    let closes = 0;
    const onClose = () => {
      closes += 1;
      view.open = false;
      root!.render(editTree(view, onClose));
    };
    mount(editTree(view, onClose));
    view.submitting = true;
    view.fire = true;
    rerender(editTree(view, onClose));
    expect(closes).toBe(0);
    expect(dialogTitled('Edit')).not.toBeNull();
  });

  it('refuses an Escape pressed in the commit that starts a submit scheduled as a transition', () => {
    const view = { fire: false, open: true, submitting: false };
    let closes = 0;
    const onClose = () => {
      closes += 1;
      view.open = false;
      root!.render(editTree(view, onClose));
    };
    mount(editTree(view, onClose));
    view.submitting = true;
    view.fire = true;
    act(() => startTransition(() => root!.render(editTree(view, onClose))));
    expect(closes).toBe(0);
    expect(dialogTitled('Edit')).not.toBeNull();
  });

  it('closes on an Escape pressed in the commit that ends a submit', () => {
    const view = { fire: false, open: true, submitting: true };
    let closes = 0;
    const onClose = () => {
      closes += 1;
      view.open = false;
      root!.render(editTree(view, onClose));
    };
    mount(editTree(view, onClose));
    view.submitting = false;
    view.fire = true;
    rerender(editTree(view, onClose));
    expect(closes).toBe(1);
    expect(dialogTitled('Edit')).toBeNull();
  });

  it('refuses an Escape in the commit that starts a submit when the FormDialog is stacked on top', () => {
    const view = { edit: true, fire: false, submitting: false, under: true };
    const closes: string[] = [];
    const tree = () => (
      <>
        <EscapeInCommit fire={view.fire} />
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
      </>
    );
    mount(tree());
    view.submitting = true;
    view.fire = true;
    rerender(tree());
    expect(closes).toEqual([]);
    expect(dialogTitled('Edit')).not.toBeNull();
    expect(dialogTitled('Under')).not.toBeNull();
  });

  it('refuses the start-of-submit Escape under Strict Mode too', () => {
    const view = { fire: false, open: true, submitting: false };
    let closes = 0;
    const tree = () => <StrictMode>{editTree(view, onClose)}</StrictMode>;
    const onClose = () => {
      closes += 1;
      view.open = false;
      root!.render(tree());
    };
    mount(tree());
    view.submitting = true;
    view.fire = true;
    rerender(tree());
    expect(closes).toBe(0);
    expect(dialogTitled('Edit')).not.toBeNull();
  });

  // Not under Strict Mode: these exact call counts describe a normal render
  // only. Strict Mode's lifecycle is covered by the active-set test above.
  it('registers one keydown listener per open and removes it on close', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    restoreSpies = () => {
      add.mockRestore();
      remove.mockRestore();
    };
    const keydown = (spy: typeof add | typeof remove) => spy.mock.calls.filter(([type]) => type === 'keydown');
    const onClose = vi.fn();
    const tree = (open: boolean, close: () => void) => (
      <Modal open={open} onClose={close} title="Plain">
        <button type="button">Inside</button>
      </Modal>
    );
    mount(tree(true, () => onClose()));
    rerender(tree(true, () => onClose()));
    rerender(tree(true, () => onClose()));
    rerender(tree(true, () => onClose()));
    expect(keydown(add)).toHaveLength(1);
    expect(keydown(remove)).toHaveLength(0);
    rerender(tree(false, () => onClose()));
    expect(keydown(remove)).toHaveLength(1);
    expect(keydown(remove)[0][1]).toBe(keydown(add)[0][1]);
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
    rerender(tree(true, () => onClose()));
    expect(keydown(add)).toHaveLength(2);
  });
});

