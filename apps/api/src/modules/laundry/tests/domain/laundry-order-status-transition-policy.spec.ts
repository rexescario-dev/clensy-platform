import { BadRequestException } from '@nestjs/common';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderStatusTransitionPolicy } from '../../domain/laundry-order-status-transition-policy';

const S = LaundryOrderStatus;

// An independently hand-written copy of the spec §4.3 matrix. A typo in the
// production matrix (`laundry-order-status-transition-policy.ts`) cannot
// silently pass the 15x15 sweep below unless the same typo is made here
// too.
const EXPECTED: Record<LaundryOrderStatus, LaundryOrderStatus[]> = {
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

const ALL = Object.values(S);

describe('LaundryOrderStatusTransitionPolicy', () => {
  const policy = new LaundryOrderStatusTransitionPolicy();

  describe('canTransition — exhaustive 15x15 sweep vs the independent matrix', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const legal = EXPECTED[from].includes(to);
        it(`${from} -> ${to} is ${legal ? 'legal' : 'illegal'}`, () => {
          expect(policy.canTransition(from, to)).toBe(legal);
        });
      }
    }
  });

  describe('assertTransition', () => {
    it('does not throw for any legal edge', () => {
      for (const from of ALL) {
        for (const to of EXPECTED[from]) {
          expect(() => policy.assertTransition(from, to)).not.toThrow();
        }
      }
    });

    it('throws BadRequestException for every illegal edge, naming both states', () => {
      for (const from of ALL) {
        for (const to of ALL) {
          if (EXPECTED[from].includes(to)) {
            continue;
          }
          let thrown: unknown;
          try {
            policy.assertTransition(from, to);
          } catch (error) {
            thrown = error;
          }
          expect(thrown).toBeInstanceOf(BadRequestException);
          expect((thrown as Error).message).toContain(from);
          expect((thrown as Error).message).toContain(to);
        }
      }
    });

    it('rejects every self-edge (no X -> X in the matrix)', () => {
      for (const status of ALL) {
        expect(() => policy.assertTransition(status, status)).toThrow(
          BadRequestException,
        );
      }
    });
  });

  describe('terminal / semi-terminal classification', () => {
    it('CANCELLED, REJECTED, REFUNDED are fully terminal (empty out-set)', () => {
      for (const status of [S.CANCELLED, S.REJECTED, S.REFUNDED]) {
        for (const to of ALL) {
          expect(policy.canTransition(status, to)).toBe(false);
        }
      }
    });

    it('COMPLETED, LOST, DAMAGED have exactly {REFUNDED} as their out-set', () => {
      for (const status of [S.COMPLETED, S.LOST, S.DAMAGED]) {
        for (const to of ALL) {
          expect(policy.canTransition(status, to)).toBe(to === S.REFUNDED);
        }
      }
    });
  });

  it('is a total function — every one of the 15 statuses is a known source', () => {
    for (const status of ALL) {
      expect(() => policy.canTransition(status, S.REFUNDED)).not.toThrow();
    }
    expect(ALL).toHaveLength(15);
  });
});
