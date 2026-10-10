import type { LaundryFulfillmentType, LaundryOrderStatus } from './laundry-order-status';

// Pure progress logic, kept out of the `'use client'` component module so a
// Server Component can call it too.

export type LaundryProgressState = 'complete' | 'current' | 'upcoming';

export interface LaundryProgressStep {
  state: LaundryProgressState;
  status: LaundryOrderStatus;
}

// Terminal exceptions replace the steps with a badge and one sentence; their
// sentences live under `laundry.progress.terminal`.
export const LAUNDRY_TERMINAL_STATUSES = [
  'CANCELLED',
  'DAMAGED',
  'LOST',
  'REFUNDED',
  'REJECTED',
] as const satisfies readonly LaundryOrderStatus[];

export type LaundryTerminalStatus = (typeof LAUNDRY_TERMINAL_STATUSES)[number];

export type LaundryHappyPathStatus = Exclude<LaundryOrderStatus, LaundryTerminalStatus>;

// Every non-terminal status, mapped once. With `LAUNDRY_TERMINAL_STATUSES`
// this covers the whole union: a new status fails to compile until it is
// added to one or the other. `COMPLETED` marks every step done and none
// current (no `aria-current`). Any other status is the single current step
// at that slot of the §4.3 happy path: `AWAITING_PAYMENT` shares the Paid
// slot with `PAID`, and `AWAITING_PICKUP` / `AWAITING_DELIVERY` share the
// return slot.
const PROGRESS_SLOT: Readonly<Record<LaundryHappyPathStatus, number>> = {
  AWAITING_DELIVERY: 6,
  AWAITING_PAYMENT: 3,
  AWAITING_PICKUP: 6,
  COMPLETED: 7,
  PAID: 3,
  PRICED: 2,
  PROCESSING: 4,
  READY: 5,
  RECEIVED: 0,
  WEIGHED: 1,
};

export function isLaundryTerminalStatus(status: LaundryOrderStatus): status is LaundryTerminalStatus {
  return (LAUNDRY_TERMINAL_STATUSES as readonly LaundryOrderStatus[]).includes(status);
}

// The §4.3 happy path for a non-terminal order. The Paid slot reads
// "Awaiting payment" only while that is the status: it is a branch, never
// shown as a completed step. The return slot follows the status when the
// status is one of its two values, so a status and a `fulfillmentType` that
// disagree (the server never writes that) still render the recorded status
// as current; otherwise it follows `fulfillmentType`.
export function laundryHappyPathSteps(
  status: LaundryHappyPathStatus,
  fulfillmentType: LaundryFulfillmentType,
): LaundryProgressStep[] {
  const slot = PROGRESS_SLOT[status];
  const returnStep: LaundryOrderStatus =
    status === 'AWAITING_DELIVERY' || status === 'AWAITING_PICKUP'
      ? status
      : fulfillmentType === 'PICKUP'
        ? 'AWAITING_PICKUP'
        : 'AWAITING_DELIVERY';
  const path: LaundryOrderStatus[] = [
    'RECEIVED',
    'WEIGHED',
    'PRICED',
    status === 'AWAITING_PAYMENT' ? 'AWAITING_PAYMENT' : 'PAID',
    'PROCESSING',
    'READY',
    returnStep,
    'COMPLETED',
  ];
  return path.map((step, index) => ({
    state: index < slot || status === 'COMPLETED' ? 'complete' : index === slot ? 'current' : 'upcoming',
    status: step,
  }));
}

// The steps for any order, or `null` for a terminal exception.
export function laundryProgressSteps(
  status: LaundryOrderStatus,
  fulfillmentType: LaundryFulfillmentType,
): LaundryProgressStep[] | null {
  return isLaundryTerminalStatus(status) ? null : laundryHappyPathSteps(status, fulfillmentType);
}
