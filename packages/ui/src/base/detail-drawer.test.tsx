// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from './dialogs/confirm-dialog';
import { DetailDrawer } from './detail-drawer';

// #193 characterization tests [C] (Dashboard UX Foundation §8.5): moving the
// Escape handler to an effect event must not change `DetailDrawer`
// dismissal. They pin today's behavior. Each fixture `onClose` really closes
// its dialog, so "closed" is observable in the DOM, and `closes` records
// every `onClose` call in order.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = { confirm: false, drawer: false };
let closes: string[] = [];
let container: HTMLDivElement;
let root: Root;

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

function Fixture() {
  return (
    <>
      <button type="button">Trigger</button>
      <DetailDrawer
        open={state.drawer}
        onClose={() => {
          closes.push('drawer');
          state.drawer = false;
          root.render(<Fixture />);
        }}
        title="Details"
      >
        <button type="button">Inside</button>
      </DetailDrawer>
      <ConfirmDialog
        open={state.confirm}
        onClose={() => {
          closes.push('confirm');
          state.confirm = false;
          root.render(<Fixture />);
        }}
        onConfirm={() => {}}
        title="Delete"
        description="Sure?"
        confirmLabel="Delete"
      />
    </>
  );
}

function paint() {
  act(() => root.render(<Fixture />));
}

function pressEscape() {
  act(() => {
    (document.activeElement ?? document).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
}

beforeEach(() => {
  state.confirm = false;
  state.drawer = false;
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

describe('DetailDrawer dismissal (#193) [C]', () => {
  it('closes on Escape', () => {
    state.drawer = true;
    paint();
    pressEscape();
    expect(closes).toEqual(['drawer']);
    expect(dialogTitled('Details')).toBeNull();
  });

  it('closes on a backdrop click', () => {
    state.drawer = true;
    paint();
    act(() => dialogTitled('Details')!.parentElement!.click());
    expect(closes).toEqual(['drawer']);
    expect(dialogTitled('Details')).toBeNull();
  });

  it('closes on ×', () => {
    state.drawer = true;
    paint();
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(closes).toEqual(['drawer']);
    expect(dialogTitled('Details')).toBeNull();
  });

  it('does not close on a click inside the panel', () => {
    state.drawer = true;
    paint();
    act(() => button('Inside').click());
    expect(closes).toEqual([]);
    expect(dialogTitled('Details')).not.toBeNull();
  });

  it('closes only a ConfirmDialog opened on top of it, then itself on the next Escape', () => {
    state.drawer = true;
    paint();
    state.confirm = true;
    paint();
    pressEscape();
    expect(closes).toEqual(['confirm']);
    expect(dialogTitled('Details')).not.toBeNull();
    pressEscape();
    expect(closes).toEqual(['confirm', 'drawer']);
    expect(dialogTitled('Details')).toBeNull();
  });
});
