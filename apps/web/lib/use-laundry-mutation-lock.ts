'use client';
import { useRef, useState } from 'react';

// The four places on the order page that send a mutation (#165 plan,
// "Entry points traced"). Payment and lifecycle verbs share `transition`.
export type LaundryMutationOwner = 'generateInvoice' | 'price' | 'transition' | 'weigh';

// A new object per successful acquire. `owner` is for debugging and tests;
// release compares the object, never the owner.
export interface LaundryMutationLease {
  readonly owner: LaundryMutationOwner;
}

export interface LaundryMutationLock {
  // Synchronous. When no lease is held, takes the lock and returns a new,
  // unique lease; otherwise returns null and changes nothing.
  tryAcquire: (owner: LaundryMutationOwner) => LaundryMutationLease | null;
  // Releases only when `lease` is the current holder (identity check); a
  // stale, foreign or repeated release is a no-op.
  release: (lease: LaundryMutationLease) => void;
  // Synchronous read, for event handlers that must refuse before changing
  // any state. Never read during render.
  isHeld: () => boolean;
  // Render state: true from a successful `tryAcquire` until its `release`.
  // For disabling controls only; the ref above is the exclusion.
  held: boolean;
}

// The order page's one mutation lock (#165, U5). The workspace is keyed by
// order id, so each order gets its own. Owners take it before their first
// `await` and release it in `finally`, so two mutations never overlap, even
// when a second click lands before React re-renders.
export function useLaundryMutationLock(): LaundryMutationLock {
  const holder = useRef<LaundryMutationLease | null>(null);
  const [held, setHeld] = useState(false);

  function tryAcquire(owner: LaundryMutationOwner): LaundryMutationLease | null {
    if (holder.current !== null) return null;
    const lease: LaundryMutationLease = { owner };
    holder.current = lease;
    setHeld(true);
    return lease;
  }

  function release(lease: LaundryMutationLease) {
    if (holder.current !== lease) return;
    holder.current = null;
    setHeld(false);
  }

  function isHeld(): boolean {
    return holder.current !== null;
  }

  return { held, isHeld, release, tryAcquire };
}
