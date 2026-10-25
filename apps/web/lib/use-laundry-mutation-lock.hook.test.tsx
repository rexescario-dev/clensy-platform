// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLaundryMutationLock, type LaundryMutationLease, type LaundryMutationLock } from './use-laundry-mutation-lock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
// The lock each Probe returned on its latest render, by probe name.
const latest: Record<string, LaundryMutationLock> = {};

function Probe({ name }: { name: string }) {
  latest[name] = useLaundryMutationLock();
  return null;
}

function mount(...names: string[]) {
  act(() =>
    root.render(
      <>
        {names.map((name) => (
          <Probe key={name} name={name} />
        ))}
      </>,
    ),
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  mount('a');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useLaundryMutationLock', () => {
  it('starts unheld', () => {
    expect(latest.a!.held).toBe(false);
    expect(latest.a!.isHeld()).toBe(false);
  });

  it('acquires synchronously and shows it as held after the re-render', () => {
    let lease: LaundryMutationLease | null = null;
    act(() => {
      lease = latest.a!.tryAcquire('weigh');
      // Same tick, before React re-renders.
      expect(latest.a!.isHeld()).toBe(true);
    });
    expect(lease).toEqual({ owner: 'weigh' });
    expect(latest.a!.held).toBe(true);
  });

  it('refuses every owner, including the holder, while held', () => {
    act(() => {
      const first = latest.a!.tryAcquire('weigh');
      expect(first).not.toBeNull();
      for (const owner of ['weigh', 'price', 'generateInvoice', 'transition'] as const) {
        expect(latest.a!.tryAcquire(owner)).toBeNull();
      }
      expect(latest.a!.isHeld()).toBe(true);
    });
  });

  it('ignores a release with a lease it never issued', () => {
    act(() => {
      latest.a!.tryAcquire('weigh');
      latest.a!.release({ owner: 'weigh' });
    });
    expect(latest.a!.isHeld()).toBe(true);
    expect(latest.a!.held).toBe(true);
  });

  it('frees the lock on the holder’s release', () => {
    let lease: LaundryMutationLease | null = null;
    act(() => {
      lease = latest.a!.tryAcquire('price');
    });
    act(() => {
      latest.a!.release(lease!);
      expect(latest.a!.isHeld()).toBe(false);
    });
    expect(latest.a!.held).toBe(false);
  });

  it('ignores a stale or repeated release once another lease holds the lock', () => {
    act(() => {
      const a = latest.a!.tryAcquire('weigh')!;
      latest.a!.release(a);
      const b = latest.a!.tryAcquire('transition');
      expect(b).not.toBeNull();
      latest.a!.release(a);
      latest.a!.release(a);
      expect(latest.a!.isHeld()).toBe(true);
    });
    expect(latest.a!.held).toBe(true);
  });

  it('issues a distinct lease on every acquire, even for the same owner', () => {
    act(() => {
      const a = latest.a!.tryAcquire('transition')!;
      latest.a!.release(a);
      const b = latest.a!.tryAcquire('transition')!;
      expect(b).not.toBe(a);
    });
  });

  it('gives each component its own lock', () => {
    mount('a', 'b');
    act(() => {
      expect(latest.a!.tryAcquire('weigh')).not.toBeNull();
      expect(latest.b!.isHeld()).toBe(false);
      expect(latest.b!.tryAcquire('weigh')).not.toBeNull();
    });
    expect(latest.a!.held).toBe(true);
    expect(latest.b!.held).toBe(true);
  });
});
