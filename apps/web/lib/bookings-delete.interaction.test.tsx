// @vitest-environment jsdom
import { ToastProvider } from '@clensy/ui';
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real `/app/bookings` page with the booking drawer open
// (`?detail=<id>`), to pin how "Delete booking" behaves (#205). The
// `removeBooking` mock models Apollo's `useMutation`: calling it sets
// `loading` and returns a promise the test settles. The promise and the
// `loading` flag are released separately, so a test can hold the moment
// after `handleConfirmDelete`'s `finally` has run but before `loading`
// clears. Apollo 3.14 clears `loading` only for its latest mutation;
// `settleRemove` always clears it, which no assertion here depends on.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BOOKING_ID = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

const bookings = vi.hoisted(() => ({
  listeners: new Set<() => void>(),
  listRefetchCalls: 0,
  // Settlers of each pending `removeBooking` promise, oldest first.
  pending: [] as Array<{ resolve: (value: unknown) => void; reject: (error: unknown) => void }>,
  removeCalls: [] as unknown[],
  removeLoading: false,
  routerCalls: [] as string[],
  searchParams: new URLSearchParams(),
}));

function notifyRemove() {
  for (const listener of bookings.listeners) listener();
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/bookings',
  useRouter: () => ({
    back: () => bookings.routerCalls.push('back'),
    push: (url: string) => bookings.routerCalls.push(`push ${url}`),
    replace: (url: string) => bookings.routerCalls.push(`replace ${url}`),
  }),
  useSearchParams: () => bookings.searchParams,
}));

vi.mock('@clensy/web', () => ({ BookingDataTable: () => null }));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const empty = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  const booking = {
    id: '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
    customer: { id: 'c1', fullName: 'Ana Reyes' },
    pricingSnapshot: { priceMinorUnits: 250000 },
    property: { id: 'p1', addressLine1: '12 Mabini St' },
    scheduledAt: '2026-11-05T09:00:00.000Z',
    service: { id: 's1', name: 'Deep clean' },
    status: 'CONFIRMED',
    team: null,
  };
  return {
    useBookingQuery: () => ({ data: { booking }, error: undefined, loading: false, refetch: vi.fn() }),
    useBookingsQuery: () => ({
      data: { bookings: { nodes: [], totalCount: 0 } },
      error: undefined,
      loading: false,
      previousData: undefined,
      refetch: () => {
        bookings.listRefetchCalls += 1;
        return Promise.resolve();
      },
    }),
    useCreateBookingMutation: idle,
    useCreateJobFromBookingMutation: idle,
    useCustomerPropertiesQuery: empty,
    useCustomersQuery: empty,
    useJobsQuery: () => ({ data: { jobs: { nodes: [] } }, error: undefined, loading: false, refetch: vi.fn() }),
    useRemoveBookingMutation: () => {
      const loading = useSyncExternalStore(
        (listener) => {
          bookings.listeners.add(listener);
          return () => bookings.listeners.delete(listener);
        },
        () => bookings.removeLoading,
      );
      const removeBooking = (options: unknown) => {
        bookings.removeCalls.push(options);
        bookings.removeLoading = true;
        for (const listener of bookings.listeners) listener();
        return new Promise((resolve, reject) => {
          bookings.pending.push({ resolve, reject });
        });
      };
      return [removeBooking, { loading }];
    },
    useServicesQuery: empty,
    useTeamsQuery: () => ({ data: { teams: { nodes: [] } }, error: undefined, loading: false, refetch: vi.fn() }),
    useUpdateBookingMutation: idle,
  };
});

const { default: BookingsPage } = await import('../app/app/bookings/page');

let container: HTMLDivElement;
let root: Root;

// Settles the oldest pending `removeBooking`. Apollo clears `loading`
// before the awaited promise resumes; `clearLoading: false` holds it.
async function settleRemove(outcome: 'reject' | 'resolve', options: { clearLoading?: boolean } = {}) {
  const settler = bookings.pending.shift()!;
  await act(async () => {
    if (options.clearLoading ?? true) {
      bookings.removeLoading = false;
      notifyRemove();
    }
    if (outcome === 'resolve') settler.resolve({ data: { removeBooking: { id: BOOKING_ID } } });
    else settler.reject(new Error('Network error'));
  });
}

function clearRemoveLoading() {
  act(() => {
    bookings.removeLoading = false;
    notifyRemove();
  });
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button')];
}

// The drawer's delete trigger, idle or in progress.
function trigger(): HTMLButtonElement {
  return buttons().find(
    (b) => b.dataset.variant === 'destructive' && (b.textContent === 'Delete booking' || b.textContent === 'Deleting…'),
  )!;
}

function confirmDialog(): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
      (d) => d.querySelector('h2')?.textContent === 'Delete this booking?',
    ) ?? null
  );
}

// The `Delete` button inside the confirmation dialog.
function confirmButton(): HTMLButtonElement | null {
  const dialog = confirmDialog();
  if (!dialog) return null;
  return [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Delete') ?? null;
}

function deleteError(): string | null {
  const next = trigger().nextElementSibling;
  return next instanceof HTMLParagraphElement && next.classList.contains('text-red-600') ? next.textContent : null;
}

function openConfirm() {
  act(() => trigger().click());
}

// Copied from packages/ui/src/base/dialogs/confirm-dialog.test.tsx.
function pressEscapeIn(element: HTMLElement) {
  act(() => element.focus());
  expect(document.activeElement).toBe(element);
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  bookings.listRefetchCalls = 0;
  bookings.listeners.clear();
  bookings.pending = [];
  bookings.removeCalls = [];
  bookings.removeLoading = false;
  bookings.routerCalls = [];
  bookings.searchParams = new URLSearchParams(`detail=${BOOKING_ID}`);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <ToastProvider>
        <BookingsPage />
      </ToastProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Bookings delete (characterization)', () => {
  it('S: on success, refreshes the list, closes the drawer and closes the dialog', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('resolve');
    expect(bookings.removeCalls).toEqual([{ variables: { id: BOOKING_ID } }]);
    expect(bookings.listRefetchCalls).toBe(1);
    expect(bookings.routerCalls).toEqual(['replace /app/bookings']);
    expect(confirmDialog()).toBeNull();
    expect(deleteError()).toBeNull();
  });

  it('F: on failure, shows the error under the trigger, closes the dialog and keeps the drawer', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('reject');
    expect(bookings.removeCalls).toHaveLength(1);
    expect(deleteError()).toBe('Unable to delete booking.');
    expect(confirmDialog()).toBeNull();
    expect(bookings.routerCalls).toEqual([]);
    expect(bookings.listRefetchCalls).toBe(0);
    expect(trigger().disabled).toBe(false);
  });

  it('R: one retry after a failure starts exactly one new delete', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('reject');
    openConfirm();
    expect(deleteError()).toBe('Unable to delete booking.'); // still shown until the retry is confirmed
    act(() => confirmButton()!.click());
    expect(bookings.removeCalls).toHaveLength(2);
    expect(deleteError()).toBeNull(); // cleared when the retry starts, as today
  });
});

describe('Bookings delete (one at a time)', () => {
  it('A: while a delete runs, the trigger is disabled and reads "Deleting…"; clicking it starts nothing', () => {
    openConfirm();
    act(() => confirmButton()!.click());
    expect(trigger().disabled).toBe(true);
    expect(trigger().textContent).toBe('Deleting…');
    act(() => {
      trigger().click();
      trigger().click();
    });
    act(() => confirmButton()?.click());
    expect(bookings.removeCalls).toHaveLength(1);
  });

  it('B: two activations before React re-renders start one delete', () => {
    openConfirm();
    act(() => {
      const confirm = confirmButton()!;
      confirm.click();
      confirm.click(); // still enabled in the DOM: only the handler guard stops it
      trigger().click();
    });
    expect(bookings.removeCalls).toHaveLength(1);
  });

  it('C: after the dialog closes but before loading clears, the trigger stays disabled and nothing reopens', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('reject', { clearLoading: false });
    expect(confirmDialog()).toBeNull();
    expect(trigger().disabled).toBe(true);
    expect(trigger().textContent).toBe('Deleting…');
    act(() => trigger().click());
    expect(confirmDialog()).toBeNull();
    expect(deleteError()).toBe('Unable to delete booking.');
    clearRemoveLoading();
    expect(trigger().disabled).toBe(false);
    expect(trigger().textContent).toBe('Delete booking');
  });

  it('D: after a failure, the trigger works again and one retry starts exactly one new delete', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('reject');
    expect(trigger().disabled).toBe(false);
    expect(trigger().textContent).toBe('Delete booking');
    openConfirm();
    act(() => {
      const confirm = confirmButton()!;
      confirm.click();
      confirm.click();
    });
    expect(bookings.removeCalls).toHaveLength(2);
  });

  it('E: the confirmation stays confirming while a delete runs', () => {
    openConfirm();
    act(() => confirmButton()!.click());
    expect(confirmButton()!.disabled).toBe(true);
    pressEscapeIn(confirmDialog()!); // the tabIndex={-1} dialog container; Cancel is disabled and cannot take focus
    expect(confirmDialog()).not.toBeNull();
    expect(bookings.routerCalls).toEqual([]); // the drawer underneath did not close
  });
});
