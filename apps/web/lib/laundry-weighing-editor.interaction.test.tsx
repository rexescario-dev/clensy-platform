// @vitest-environment jsdom
import type { FetchResult } from '@apollo/client';
import type { WeighLaundryOrderMutation, WeighLaundryOrderMutationVariables } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Drives the real weighing editor (#155) in jsdom with a controllable
// `weighLaundryOrder`. Typing uses the native value setter plus an
// `input` event; leaving a row dispatches `focusout`, which React's
// `onBlur` listens to. Two clicks inside one `act` both land before React
// re-renders, which is how a fast double click reaches the handler.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER_ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

// What `mutate` resolves with, typed by the generated operation: Apollo
// 3.14's `FetchResult<WeighLaundryOrderMutation>` (`data` may be `null`,
// `errors` is `GraphQLFormattedError[]`). The fixtures below must satisfy
// it, so they cannot drift from the real result shape.
type WeighResult = FetchResult<WeighLaundryOrderMutation>;

// A successful weigh: the order as the `LaundryOrderDetail` fragment.
const RECORDED: WeighResult = {
  data: {
    weighLaundryOrder: {
      id: ORDER_ID,
      createdAt: '2026-10-14T09:00:00.000Z',
      customer: { id: 'c1', fullName: 'Ana Reyes' },
      fulfillmentType: 'PICKUP',
      lines: { nodes: [], pageInfo: { hasNextPage: false } },
      status: 'WEIGHED',
      totalMinorUnits: null,
      updatedAt: '2026-10-14T09:05:00.000Z',
      weightGrams: 2500,
    },
  },
};

const weigh = vi.hoisted(() => ({
  calls: [] as unknown[],
  reject: (() => {}) as (error: unknown) => void,
  resolve: (() => {}) as (result?: FetchResult<WeighLaundryOrderMutation>) => void,
}));

vi.mock('@clensy/client', () => ({
  useWeighLaundryOrderMutation: () => [
    (options: { variables: WeighLaundryOrderMutationVariables }) => {
      weigh.calls.push(options.variables);
      return new Promise<WeighResult>((resolve, reject) => {
        // Defaults to RECORDED (read at call time, after module init). A
        // test may resolve with GraphQL errors instead, the shape
        // `errorPolicy: 'all'` would deliver.
        weigh.resolve = (result: WeighResult = RECORDED) => resolve(result);
        weigh.reject = reject;
      });
    },
    { loading: false },
  ],
}));

let container: HTMLDivElement;
let root: Root;
let onRecorded: Mock<() => Promise<unknown>>;

async function mount(weightGrams: number | null, disabled = false, onPendingChange?: (pending: boolean) => void) {
  const { LaundryWeighingEditor } = await import('../components/laundry/laundry-weighing-editor');
  act(() =>
    root.render(
      <ToastProvider>
        <LaundryWeighingEditor
          disabled={disabled}
          onPendingChange={onPendingChange}
          onRecorded={onRecorded}
          orderId={ORDER_ID}
          weightGrams={weightGrams}
        />
      </ToastProvider>,
    ),
  );
}


function inputs(): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input')];
}

function labels(): string[] {
  return [...container.querySelectorAll('label')].map((label) => label.textContent ?? '');
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === name);
  expect(found, `button "${name}"`).toBeDefined();
  return found!;
}

function total(): string {
  return container.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? '';
}

function type(index: number, text: string) {
  act(() => {
    const input = inputs()[index]!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function leave(index: number) {
  act(() => {
    inputs()[index]!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function click(name: string) {
  act(() => button(name).click());
}

function alertText(): string | null {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

// Submits from Record weight the way a keyboard user does. A browser
// moves focus to <body> when the focused button becomes disabled. jsdom
// does neither that nor `blur()` on a disabled button, so focus is parked
// on a throwaway input that is then removed, which jsdom does reset.
function submitFromRecordWeight() {
  act(() => {
    button('Record weight').focus();
    button('Record weight').click();
  });
  expect(button('Record weight').disabled).toBe(true);
  act(() => {
    const parking = document.createElement('input');
    document.body.append(parking);
    parking.focus();
    parking.remove();
  });
  expect(document.activeElement).toBe(document.body);
}

async function enterThreeBags() {
  await mount(null);
  type(0, '1.25');
  click('Add bag');
  type(1, '0.80');
  click('Add bag');
  type(2, '0.45');
}

beforeEach(() => {
  weigh.calls.length = 0;
  // A test that settles a weigh it never started fails here, instead of
  // settling an earlier test's promise.
  const notInFlight = () => {
    throw new Error('No weighLaundryOrder call is in flight.');
  };
  weigh.resolve = notInFlight;
  weigh.reject = notInFlight;
  onRecorded = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('laundry weighing editor', () => {
  it('starts an unweighed order with one empty, unflagged Bag 1 row and a 0.00 kg total', async () => {
    await mount(null);
    expect(labels()).toEqual(['Bag 1']);
    expect(inputs()[0]!.value).toBe('');
    expect(inputs()[0]!.getAttribute('inputmode')).toBe('decimal');
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBeNull();
    expect(total()).toBe('0.00 kg');
    expect(container.textContent).toContain('Add each bag, basket, or batch. The order weight is the total.');
    expect(container.textContent).toContain('Combined weight');
  });

  it('shows the combined kilograms for three bags and records their gram sum once', async () => {
    await enterThreeBags();
    expect(labels()).toEqual(['Bag 1', 'Bag 2', 'Bag 3']);
    expect(total()).toBe('2.50 kg');
    click('Record weight');
    expect(weigh.calls).toEqual([{ input: { orderId: ORDER_ID, weightGrams: 2500 } }]);
  });

  it('updates the total at once when a row is edited or removed, and renumbers the rows', async () => {
    await enterThreeBags();
    type(1, '1');
    expect(total()).toBe('2.70 kg');
    click('Remove bag 1');
    expect(total()).toBe('1.45 kg');
    expect(labels()).toEqual(['Bag 1', 'Bag 2']);
    expect(inputs().map((input) => input.value)).toEqual(['1', '0.45']);
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toContain('Remove bag 2');
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Remove bag 3');
  });

  it.each([
    ['blank', '', 'Enter a weight.'],
    ['junk', 'abc', 'Enter a weight in kilograms, up to 3 decimal places.'],
    ['four decimals', '1.2345', 'Enter a weight in kilograms, up to 3 decimal places.'],
    ['zero', '0', 'Weight must be greater than zero.'],
    ['negative', '-1', 'Weight must be greater than zero.'],
  ])('does not submit a %s row and explains why under the input', async (_label, text, message) => {
    await mount(null);
    type(0, text);
    click('Record weight');
    expect(weigh.calls).toEqual([]);
    const input = inputs()[0]!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(container.querySelector(`#${describedBy!}`)?.textContent).toBe(message);
  });

  it('flags a row once it is left, before any submit', async () => {
    await mount(null);
    type(0, 'abc');
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBeNull();
    leave(0);
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('Enter a weight in kilograms, up to 3 decimal places.');
  });

  it('totals the valid rows while an invalid row blocks submit', async () => {
    await mount(null);
    type(0, '1.25');
    click('Add bag');
    type(1, 'abc');
    expect(total()).toBe('1.25 kg');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
  });

  it('asks for at least one weight when every row is removed', async () => {
    await mount(null);
    click('Remove bag 1');
    expect(inputs()).toEqual([]);
    expect(total()).toBe('0.00 kg');
    expect(container.querySelector('#laundry-weighing-form-error')?.textContent).toBe('Add at least one weight.');
    expect(button('Record weight').getAttribute('aria-describedby')).toBe('laundry-weighing-form-error');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
  });

  it('blocks a combined weight above the GraphQL Int maximum without crashing', async () => {
    await mount(null);
    type(0, '2000000');
    click('Add bag');
    type(1, '2000000');
    expect(total()).toBe('4000000.00 kg');
    // Both rows are valid, so the total-level error is what explains the
    // block: Record weight is described by it.
    expect(inputs().every((input) => input.getAttribute('aria-invalid') === null)).toBe(true);
    const describedBy = button('Record weight').getAttribute('aria-describedby');
    expect(describedBy).toBe('laundry-weighing-form-error');
    expect(container.querySelector(`#${describedBy!}`)?.textContent).toBe('The combined weight is too large to record.');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
  });

  it('flags one absurdly long row as too large instead of crashing', async () => {
    await mount(null);
    type(0, '99999999999999999999');
    leave(0);
    expect(container.textContent).toContain('Enter a smaller weight.');
    expect(total()).toBe('0.00 kg');
  });

  it('sends one mutation for a double click and disables every control while it is in flight', async () => {
    await enterThreeBags();
    act(() => {
      button('Record weight').click();
      button('Record weight').click();
    });
    expect(weigh.calls).toHaveLength(1);
    expect(inputs().every((input) => input.disabled)).toBe(true);
    expect([...container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    await act(async () => weigh.resolve());
    expect(inputs().every((input) => !input.disabled)).toBe(true);
    expect(weigh.calls).toHaveLength(1);
  });

  it('on success toasts, refetches the order, and leaves one row with the saved total', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve());
    expect(container.textContent).toContain('Weight recorded.');
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(labels()).toEqual(['Bag 1']);
    expect(inputs().map((input) => input.value)).toEqual(['2.50']);
    expect(total()).toBe('2.50 kg');
    expect(alertText()).toBeNull();
  });

  it('on failure shows the server message and keeps the rows', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () =>
      weigh.reject({
        graphQLErrors: [
          {
            extensions: { originalError: { message: 'Cannot weigh a laundry order in status PRICED' } },
            message: 'Cannot weigh a laundry order in status PRICED',
          },
        ],
      }),
    );
    expect(alertText()).toBe('Cannot weigh a laundry order in status PRICED');
    expect(inputs().map((input) => input.value)).toEqual(['1.25', '0.80', '0.45']);
    expect(onRecorded).not.toHaveBeenCalled();
    expect(inputs().every((input) => !input.disabled)).toBe(true);
  });

  it('falls back to "Unable to record weight." without a server message', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.reject(new Error('Failed to fetch')));
    expect(alertText()).toBe('Unable to record weight.');
  });

  // Defense in depth: the app's effective policy is Apollo's default
  // `errorPolicy: 'none'`, which rejects (planning spike). A resolved result
  // that still carries errors, or no order, is never a success.
  it('treats a resolved result with GraphQL errors as a failure', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () =>
      weigh.resolve({
        data: null,
        errors: [
          {
            extensions: { originalError: { message: 'Cannot weigh a laundry order in status PRICED' } },
            message: 'Cannot weigh a laundry order in status PRICED',
          },
        ],
      }),
    );
    expect(alertText()).toBe('Cannot weigh a laundry order in status PRICED');
    expect(container.textContent).not.toContain('Weight recorded.');
    expect(onRecorded).not.toHaveBeenCalled();
    expect(inputs().map((input) => input.value)).toEqual(['1.25', '0.80', '0.45']);
    expect(inputs().every((input) => !input.disabled)).toBe(true);
  });

  it('treats a resolved result without the order as a failure', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve({ data: null }));
    expect(alertText()).toBe('Unable to record weight.');
    expect(container.textContent).not.toContain('Weight recorded.');
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it.each([
    ['editing a row', () => type(0, '1.3')],
    ['removing a row', () => click('Remove bag 3')],
    ['adding a row', () => click('Add bag')],
    // The rows are unchanged, so only the submit itself can clear it.
    ['a new submit', () => click('Record weight')],
  ])('clears a stale server error on %s', async (_label, action) => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.reject(new Error('Failed to fetch')));
    expect(alertText()).toBe('Unable to record weight.');
    action();
    expect(alertText()).toBeNull();
  });

  it('keeps every control disabled until the post-save refetch settles', async () => {
    let finishRefetch: () => void = () => {};
    onRecorded = vi.fn<() => Promise<unknown>>(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = resolve;
        }),
    );
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve());
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(inputs().every((input) => input.disabled)).toBe(true);
    expect([...container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    await act(async () => finishRefetch());
    expect(inputs().every((input) => !input.disabled)).toBe(true);
    expect([...container.querySelectorAll('button')].every((b) => !b.disabled)).toBe(true);
  });

  it('shows no weighing error and re-enables the form when the refetch after a save fails', async () => {
    onRecorded = vi.fn<() => Promise<unknown>>(() => Promise.reject(new Error('network')));
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve());
    expect(container.textContent).toContain('Weight recorded.');
    expect(alertText()).toBeNull();
    expect(inputs().every((input) => !input.disabled)).toBe(true);
  });

  it('returns focus to Record weight once a save and its refetch settle', async () => {
    await enterThreeBags();
    submitFromRecordWeight();
    await act(async () => weigh.resolve());
    expect(document.activeElement).toBe(button('Record weight'));
  });

  it('returns focus to Record weight after a failed save', async () => {
    await enterThreeBags();
    submitFromRecordWeight();
    await act(async () => weigh.reject(new Error('Failed to fetch')));
    expect(alertText()).toBe('Unable to record weight.');
    expect(document.activeElement).toBe(button('Record weight'));
  });

  it('leaves focus where the user moved it during the save', async () => {
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    try {
      await enterThreeBags();
      submitFromRecordWeight();
      act(() => elsewhere.focus());
      await act(async () => weigh.resolve());
      expect(document.activeElement).toBe(elsewhere);
    } finally {
      elsewhere.remove();
    }
  });

  it.each([null, 2500])('leaves focus on <body> when the editor first appears (weight %s)', async (grams) => {
    expect(document.activeElement).toBe(document.body);
    await mount(grams);
    expect(document.activeElement).toBe(document.body);
  });

  it.each([null, 2500])('leaves focus elsewhere when the editor first appears (weight %s)', async (grams) => {
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    try {
      act(() => elsewhere.focus());
      await mount(grams);
      expect(document.activeElement).toBe(elsewhere);
    } finally {
      elsewhere.remove();
    }
  });

  it('moves focus to the first invalid row when a submit is blocked', async () => {
    await mount(null);
    type(0, '1.25');
    click('Add bag');
    type(1, 'abc');
    click('Add bag');
    type(2, '0');
    act(() => {
      button('Record weight').focus();
      button('Record weight').click();
    });
    expect(weigh.calls).toEqual([]);
    expect(document.activeElement).toBe(inputs()[1]);
    expect(inputs()[1]!.getAttribute('aria-invalid')).toBe('true');
    // Submitting again from the same row focuses it again.
    act(() => {
      button('Record weight').focus();
      button('Record weight').click();
    });
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('keeps focus on Record weight when only the form-level error blocks a submit', async () => {
    await mount(null);
    click('Remove bag 1');
    act(() => {
      button('Record weight').focus();
      button('Record weight').click();
    });
    expect(weigh.calls).toEqual([]);
    expect(document.activeElement).toBe(button('Record weight'));
  });

  it.each([
    [1250, '1.25'],
    [1005, '1.005'],
    [2000, '2.00'],
  ])('prefills a re-weigh of %i g with %j', async (grams, text) => {
    await mount(grams);
    expect(labels()).toEqual(['Bag 1']);
    expect(inputs()[0]!.value).toBe(text);
  });

  it('refuses to re-record a legacy 0-gram weight', async () => {
    await mount(0);
    expect(inputs()[0]!.value).toBe('0.00');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
    expect(container.textContent).toContain('Weight must be greater than zero.');
  });

  // #162 owner decision 6.3: frozen while a price is confirmed.
  it('disables every input and button, and drops a submit, while disabled', async () => {
    await mount(2500, true);
    const controls = [...container.querySelectorAll<HTMLButtonElement | HTMLInputElement>('input, button')];
    expect(controls.length).toBeGreaterThanOrEqual(3);
    expect(controls.every((control) => control.disabled)).toBe(true);
    // The handler calls preventDefault() before the guard, so the dropped
    // submit is also cancelled (M5 round 1).
    let notCancelled = true;
    act(() => {
      notCancelled = container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(notCancelled).toBe(false);
    expect(weigh.calls).toEqual([]);
    await mount(2500, false);
    expect(button('Record weight').disabled).toBe(false);
  });

  // #162 M7 follow-up: the page blocks Confirm while a weight is being saved,
  // through the save and the reload that follows it.
  describe('onPendingChange', () => {
    it('reports a save in flight until the reload settles', async () => {
      const changes: boolean[] = [];
      let reload = () => {};
      onRecorded.mockImplementation(
        () =>
          new Promise((resolve) => {
            reload = () => resolve(undefined);
          }),
      );
      await mount(2500, false, (pending) => changes.push(pending));
      click('Record weight');
      expect(changes).toEqual([true]);
      await act(async () => {
        weigh.resolve();
      });
      expect(onRecorded).toHaveBeenCalledTimes(1);
      expect(changes).toEqual([true]);
      await act(async () => {
        reload();
      });
      expect(changes).toEqual([true, false]);
    });

    it('reports the end of a failed save', async () => {
      const changes: boolean[] = [];
      await mount(2500, false, (pending) => changes.push(pending));
      click('Record weight');
      await act(async () => {
        weigh.reject(new Error('network down'));
      });
      expect(changes).toEqual([true, false]);
    });

    it('reports nothing for a submit that sends no request', async () => {
      const changes: boolean[] = [];
      await mount(null, false, (pending) => changes.push(pending));
      click('Record weight');
      expect(weigh.calls).toEqual([]);
      expect(changes).toEqual([]);
    });
  });
});
