// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DetailDrawer } from '../detail-drawer';
import { Modal } from '../modal';
import { ConfirmDialog } from './confirm-dialog';

// #194 (Dashboard UX Foundation, Amendment #194 §9.3): while a
// `ConfirmDialog` is confirming it refuses every user-initiated dismissal,
// with no feedback and no replay; a topmost confirming `ConfirmDialog`
// consumes Escape, so a `DetailDrawer` under it stays open. The guard reads
// only the caller-owned `confirming`, so `confirmMode` models a caller that
// clears it after a rejection, one that has not cleared it yet, and one that
// never sets it. The fixture's `onClose` handlers really close their dialog,
// so "stays open" is observable in the DOM, and `closes` records every
// `onClose` call. Tests marked [C] are characterization tests: they pin
// behavior that was already correct before #194.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ConfirmMode = 'clears' | 'keeps' | 'none' | 'pending';

const state = {
  confirming: false,
  confirmMode: 'none' as ConfirmMode,
  confirmOpen: false,
  drawerOpen: false,
  modalOpen: false,
};
let closes: string[] = [];
let rejectConfirm: ((error: Error) => void) | undefined;
let container: HTMLDivElement;
let root: Root;

function button(text: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === text,
  )!;
}

function cancel(): HTMLButtonElement {
  return [...confirmDialog()!.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === 'Cancel',
  )!;
}

function clickBackdrop(dialog: HTMLElement) {
  act(() => dialog.parentElement!.click());
}

function confirmButton(): HTMLButtonElement {
  return [...confirmDialog()!.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === 'Delete',
  )!;
}

function confirmDialog(): HTMLElement | null {
  return dialogTitled('Delete');
}

function dialogTitled(title: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
      (dialog) => document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent === title,
    ) ?? null
  );
}

function drawer(): HTMLElement | null {
  return dialogTitled('Booking');
}

function Fixture() {
  return (
    <>
      <button type="button">Trigger</button>
      <DetailDrawer
        open={state.drawerOpen}
        onClose={() => {
          closes.push('drawer');
          state.drawerOpen = false;
          root.render(<Fixture />);
        }}
        title="Booking"
      >
        <button type="button">Drawer action</button>
      </DetailDrawer>
      <ConfirmDialog
        open={state.confirmOpen}
        onClose={() => {
          closes.push('confirm');
          state.confirmOpen = false;
          root.render(<Fixture />);
        }}
        onConfirm={onConfirm}
        title="Delete"
        description="Sure?"
        confirmLabel="Delete"
        confirming={state.confirming}
      />
      <Modal
        open={state.modalOpen}
        onClose={() => {
          closes.push('modal');
          state.modalOpen = false;
          root.render(<Fixture />);
        }}
        title="Over"
      >
        <button type="button">Over action</button>
      </Modal>
    </>
  );
}

// Models a caller's confirmation operation (plan decision (d)). 'clears' and
// 'keeps' set `confirming` and await a promise the test rejects; only
// 'clears' then reports settlement, as a mutation's loading flag does. The
// rejection reaches `ConfirmDialog`, which swallows it. 'pending' never sets
// `confirming` and never settles.
async function onConfirm() {
  if (state.confirmMode === 'none') return;
  if (state.confirmMode === 'pending') {
    await new Promise<void>(() => {});
    return;
  }
  state.confirming = true;
  root.render(<Fixture />);
  try {
    await new Promise<void>((_resolve, reject) => {
      rejectConfirm = reject;
    });
  } finally {
    if (state.confirmMode === 'clears') {
      state.confirming = false;
      root.render(<Fixture />);
    }
  }
}

function openConfirm(confirming: boolean) {
  state.confirmOpen = true;
  state.confirming = confirming;
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

async function rejectAndSettle() {
  await act(async () => rejectConfirm!(new Error('Network down')));
}

beforeEach(() => {
  state.confirming = false;
  state.confirmMode = 'none';
  state.confirmOpen = false;
  state.drawerOpen = false;
  state.modalOpen = false;
  closes = [];
  rejectConfirm = undefined;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  paint();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ConfirmDialog dismissal (#194)', () => {
  it('closes on Escape when idle [C]', () => {
    openConfirm(false);
    pressEscapeIn(cancel());
    expect(closes).toEqual(['confirm']);
    expect(confirmDialog()).toBeNull();
  });

  it('closes on a backdrop click when idle [C]', () => {
    openConfirm(false);
    clickBackdrop(confirmDialog()!);
    expect(closes).toEqual(['confirm']);
  });

  it('closes on Cancel when idle [C]', () => {
    openConfirm(false);
    act(() => cancel().click());
    expect(closes).toEqual(['confirm']);
  });

  // Both buttons are disabled while confirming, so Escape is pressed on the
  // dialog container, where the hook puts focus when nothing else can take it.
  it('ignores Escape while confirming', () => {
    openConfirm(true);
    pressEscapeIn(confirmDialog()!);
    expect(closes).toEqual([]);
    expect(confirmDialog()).not.toBeNull();
  });

  it('ignores a backdrop click while confirming', () => {
    openConfirm(true);
    clickBackdrop(confirmDialog()!);
    expect(closes).toEqual([]);
    expect(confirmDialog()).not.toBeNull();
  });

  it('keeps Cancel and Confirm disabled while confirming [C]', () => {
    openConfirm(true);
    expect(cancel().disabled).toBe(true);
    expect(confirmButton().disabled).toBe(true);
    act(() => cancel().click());
    expect(closes).toEqual([]);
  });

  it('changes nothing visible when it refuses a dismissal', () => {
    openConfirm(true);
    const before = document.body.innerHTML;
    pressEscapeIn(confirmDialog()!);
    clickBackdrop(confirmDialog()!);
    expect(document.body.innerHTML).toBe(before);
    expect(closes).toEqual([]);
  });

  it('still closes when the caller sets open to false while confirming, and restores focus [C]', () => {
    act(() => button('Trigger').focus());
    openConfirm(true);
    state.confirmOpen = false;
    paint();
    expect(confirmDialog()).toBeNull();
    expect(document.activeElement).toBe(button('Trigger'));
    expect(closes).toEqual([]);
  });

  it('does not replay a refused Escape when confirming ends', () => {
    openConfirm(true);
    pressEscapeIn(confirmDialog()!);
    state.confirming = false;
    paint();
    expect(closes).toEqual([]);
    expect(confirmDialog()).not.toBeNull();
  });

  it('recovers once the caller clears confirming after a rejected onConfirm', async () => {
    state.confirmMode = 'clears';
    openConfirm(false);
    act(() => confirmButton().click());
    expect(confirmButton().disabled).toBe(true);
    pressEscapeIn(confirmDialog()!);
    expect(closes).toEqual([]);
    expect(confirmDialog()).not.toBeNull();
    await rejectAndSettle();
    expect(state.confirming).toBe(false);
    expect(confirmButton().disabled).toBe(false);
    expect(confirmDialog()).not.toBeNull();
    expect(closes).toEqual([]);
    pressEscapeIn(cancel());
    expect(closes).toEqual(['confirm']);
  });

  it('keeps refusing after onConfirm rejects while the caller still reports confirming', async () => {
    state.confirmMode = 'keeps';
    openConfirm(false);
    act(() => confirmButton().click());
    await rejectAndSettle();
    pressEscapeIn(confirmDialog()!);
    expect(closes).toEqual([]);
    expect(confirmDialog()).not.toBeNull();
    clickBackdrop(confirmDialog()!);
    expect(closes).toEqual([]);
  });

  it('does not lock itself while onConfirm is pending if confirming is false [C]', () => {
    state.confirmMode = 'pending';
    openConfirm(false);
    act(() => confirmButton().click());
    pressEscapeIn(cancel());
    expect(closes).toEqual(['confirm']);
  });

  it('consumes Escape when the confirming ConfirmDialog is on top of a DetailDrawer', () => {
    state.drawerOpen = true;
    paint();
    openConfirm(true);
    pressEscapeIn(confirmDialog()!);
    expect(closes).toEqual([]);
    expect(confirmDialog()).not.toBeNull();
    expect(drawer()).not.toBeNull();
  });

  it('lets Escape close a dialog on top of a confirming ConfirmDialog [C]', () => {
    openConfirm(true);
    state.modalOpen = true;
    paint();
    pressEscapeIn(button('Over action'));
    expect(closes).toEqual(['modal']);
    expect(confirmDialog()).not.toBeNull();
  });
});
