// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

// Characterization tests (#180, Amendment #180 §8.5): the `FormDialog`
// submit guard must not change `ConfirmDialog` dismissal. They pin today's
// behavior, which is that it still closes while `confirming`; they do not
// endorse it. A future issue that changes it updates these tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

beforeEach(() => {
  onClose.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={() => {}}
        title="Delete"
        description="Sure?"
        confirmLabel="Delete"
        confirming
      />,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ConfirmDialog dismissal while confirming (#180) [C]', () => {
  // Both buttons are disabled while `confirming`, so focus sits on the dialog
  // container and there is no field to press Escape from.
  it('still closes on Escape while confirming', () => {
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on a backdrop click while confirming', () => {
    act(() => document.querySelector<HTMLElement>('[role="dialog"]')!.parentElement!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
