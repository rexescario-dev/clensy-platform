import { BadRequestException } from '@nestjs/common';
import { LaundryOrderStatus } from './laundry-order-status';

const S = LaundryOrderStatus;

// The single authoritative encoding of the spec §4.3 transition matrix.
// Every legal status edge is listed here and nowhere else; any edge not
// listed is illegal. No `LaundryOrder.status` write anywhere in the
// codebase happens without `assertTransition` first (spec §4.3
// load-bearing invariant).
//
// `CANCELLED`/`REJECTED`/`REFUNDED` are fully terminal (empty set);
// `COMPLETED`/`LOST`/`DAMAGED` are semi/success-terminal with a single
// `-> REFUNDED` edge. The matrix contains no self-edges.
const MATRIX: Readonly<
  Record<LaundryOrderStatus, ReadonlyArray<LaundryOrderStatus>>
> = {
  [S.RECEIVED]: [S.WEIGHED, S.REJECTED, S.CANCELLED],
  [S.WEIGHED]: [S.PRICED, S.REJECTED, S.CANCELLED],
  [S.PRICED]: [S.AWAITING_PAYMENT, S.PAID, S.CANCELLED],
  [S.AWAITING_PAYMENT]: [S.PAID, S.CANCELLED],
  [S.PAID]: [S.PROCESSING, S.REFUNDED],
  [S.PROCESSING]: [S.READY, S.LOST, S.DAMAGED, S.REFUNDED],
  [S.READY]: [
    S.AWAITING_PICKUP,
    S.AWAITING_DELIVERY,
    S.LOST,
    S.DAMAGED,
    S.REFUNDED,
  ],
  [S.AWAITING_PICKUP]: [S.COMPLETED, S.LOST, S.DAMAGED, S.REFUNDED],
  [S.AWAITING_DELIVERY]: [S.COMPLETED, S.LOST, S.DAMAGED, S.REFUNDED],
  [S.COMPLETED]: [S.REFUNDED],
  [S.LOST]: [S.REFUNDED],
  [S.DAMAGED]: [S.REFUNDED],
  [S.CANCELLED]: [],
  [S.REJECTED]: [],
  [S.REFUNDED]: [],
};

export class LaundryOrderStatusTransitionPolicy {
  canTransition(from: LaundryOrderStatus, to: LaundryOrderStatus): boolean {
    return MATRIX[from].includes(to);
  }

  assertTransition(from: LaundryOrderStatus, to: LaundryOrderStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Laundry order cannot transition from ${from} to ${to}`,
      );
    }
  }
}
