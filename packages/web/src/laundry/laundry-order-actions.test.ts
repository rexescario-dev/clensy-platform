import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES } from '../roles/admin-roles';
import { getDefaultMessages } from '../i18n/messages';
import {
  LAUNDRY_DESTRUCTIVE_VERBS,
  LAUNDRY_ORDER_VERBS,
  canReceiveLaundryOrder,
  laundryOrderActions,
} from './laundry-order-actions';
import { LAUNDRY_ORDER_STATUSES, type LaundryOrderStatus } from './laundry-order-status';
import type { LaundryOrderVerb } from './laundry-order-actions';
import type { AdminRole } from '../roles/admin-roles';

// Reconciliation oracle (#157 M5). An independent transcription of the API,
// in the API's own shapes, so a slip in the helper's verb-keyed tables shows
// up as a disagreement. Sources, at 7c59b82:
// - SERVER_MATRIX: `MATRIX` in
//   apps/api/src/modules/laundry/domain/laundry-order-status-transition-policy.ts
// - MUTATIONS: each mutation's `@Roles(...)` in
//   apps/api/src/modules/laundry/presentation/graphql/laundry-order.resolver.ts
//   (OPERATIONAL, INTAKE, PAYMENT, CANCEL, EXCEPTION, REFUND constants), and
//   `generateInvoiceFromOrder`'s in
//   apps/api/src/modules/billing/presentation/graphql/invoice.resolver.ts
// - legal: the transition target via SERVER_MATRIX; `weighLaundryOrder` and
//   `priceLaundryOrder` status checks in LaundryOrdersService.weigh / .price;
//   `assertEligible` + `EXCLUDED_STATUSES` in InvoicesService.
const SERVER_MATRIX: Record<LaundryOrderStatus, LaundryOrderStatus[]> = {
  AWAITING_DELIVERY: ['COMPLETED', 'LOST', 'DAMAGED', 'REFUNDED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  AWAITING_PICKUP: ['COMPLETED', 'LOST', 'DAMAGED', 'REFUNDED'],
  CANCELLED: [],
  COMPLETED: ['REFUNDED'],
  DAMAGED: ['REFUNDED'],
  LOST: ['REFUNDED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PRICED: ['AWAITING_PAYMENT', 'PAID', 'CANCELLED'],
  PROCESSING: ['READY', 'LOST', 'DAMAGED', 'REFUNDED'],
  READY: ['AWAITING_PICKUP', 'AWAITING_DELIVERY', 'LOST', 'DAMAGED', 'REFUNDED'],
  RECEIVED: ['WEIGHED', 'REJECTED', 'CANCELLED'],
  REFUNDED: [],
  REJECTED: [],
  WEIGHED: ['PRICED', 'REJECTED', 'CANCELLED'],
};
const OPERATIONAL: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'];
const INTAKE: AdminRole[] = [...OPERATIONAL, 'CUSTOMER_SUPPORT'];
const PAYMENT: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT'];
const CANCEL: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'CUSTOMER_SUPPORT'];
const EXCEPTION: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER'];
const REFUND: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE'];
const PRICED_ONWARD: LaundryOrderStatus[] = [
  'PRICED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'AWAITING_DELIVERY', 'COMPLETED',
  'CANCELLED', 'LOST', 'DAMAGED', 'REFUNDED',
];
const INVOICE_EXCLUDED: LaundryOrderStatus[] = ['CANCELLED', 'REJECTED', 'LOST', 'DAMAGED', 'REFUNDED'];
const byTarget = (target: LaundryOrderStatus) => (s: LaundryOrderStatus) => SERVER_MATRIX[s].includes(target);
const MUTATIONS: Record<string, { legal: (s: LaundryOrderStatus) => boolean; roles: AdminRole[]; verb: LaundryOrderVerb }> = {
  cancelLaundryOrder: { legal: byTarget('CANCELLED'), roles: CANCEL, verb: 'cancel' },
  completeLaundryOrder: { legal: byTarget('COMPLETED'), roles: INTAKE, verb: 'complete' },
  generateInvoiceFromOrder: {
    legal: (s) => PRICED_ONWARD.includes(s) && !INVOICE_EXCLUDED.includes(s),
    roles: ['FINANCE', 'TENANT_OWNER'],
    verb: 'generateInvoice',
  },
  markLaundryOrderAwaitingDelivery: { legal: byTarget('AWAITING_DELIVERY'), roles: OPERATIONAL, verb: 'markAwaitingDelivery' },
  markLaundryOrderAwaitingPayment: { legal: byTarget('AWAITING_PAYMENT'), roles: PAYMENT, verb: 'markAwaitingPayment' },
  markLaundryOrderAwaitingPickup: { legal: byTarget('AWAITING_PICKUP'), roles: OPERATIONAL, verb: 'markAwaitingPickup' },
  markLaundryOrderDamaged: { legal: byTarget('DAMAGED'), roles: EXCEPTION, verb: 'markDamaged' },
  markLaundryOrderLost: { legal: byTarget('LOST'), roles: EXCEPTION, verb: 'markLost' },
  markLaundryOrderPaid: { legal: byTarget('PAID'), roles: PAYMENT, verb: 'markPaid' },
  markLaundryOrderReady: { legal: byTarget('READY'), roles: OPERATIONAL, verb: 'markReady' },
  priceLaundryOrder: { legal: (s) => s === 'WEIGHED', roles: OPERATIONAL, verb: 'price' },
  refundLaundryOrder: { legal: byTarget('REFUNDED'), roles: REFUND, verb: 'refund' },
  rejectLaundryOrder: { legal: byTarget('REJECTED'), roles: EXCEPTION, verb: 'reject' },
  startLaundryProcessing: { legal: byTarget('PROCESSING'), roles: OPERATIONAL, verb: 'startProcessing' },
  weighLaundryOrder: { legal: (s) => s === 'RECEIVED' || s === 'WEIGHED', roles: OPERATIONAL, verb: 'weigh' },
};
// The fulfillment branch: the server picks the READY target from
// `fulfillmentType` (lifecycle spec §4.3); the UI offers only that one.
const BRANCH_ONLY: Partial<Record<LaundryOrderVerb, 'DELIVERY' | 'PICKUP'>> = {
  markAwaitingDelivery: 'DELIVERY',
  markAwaitingPickup: 'PICKUP',
};

describe('laundryOrderActions', () => {
  it('covers every order-scoped mutation the API has, and no other verb', () => {
    expect(Object.values(MUTATIONS).map((m) => m.verb).sort()).toEqual([...LAUNDRY_ORDER_VERBS].sort());
  });

  const combos = LAUNDRY_ORDER_STATUSES.flatMap((status) =>
    (['DELIVERY', 'PICKUP'] as const).flatMap((fulfillment) =>
      [...ADMIN_ROLES].map((role) => [status, fulfillment, role] as const),
    ),
  );

  it.each(combos)('%s + %s + %s matches the API oracle, in presentation order', (status, fulfillment, role) => {
    const expected = LAUNDRY_ORDER_VERBS.filter((verb) => {
      const mutation = Object.values(MUTATIONS).find((m) => m.verb === verb);
      if (!mutation || !mutation.legal(status) || !mutation.roles.includes(role)) return false;
      const branch = BRANCH_ONLY[verb];
      return branch === undefined || branch === fulfillment;
    });
    expect(laundryOrderActions(status, fulfillment, role)).toEqual(expected);
  });

  it.each([
    // #157 issue table and #165 role examples.
    ['RECEIVED', 'PICKUP', 'OPS_MANAGER', ['weigh', 'cancel', 'reject']],
    ['RECEIVED', 'PICKUP', 'CUSTOMER_SUPPORT', ['cancel']],
    ['WEIGHED', 'PICKUP', 'SCHEDULER', ['weigh', 'price']],
    ['PRICED', 'PICKUP', 'FINANCE', ['markAwaitingPayment', 'markPaid', 'generateInvoice']],
    ['PRICED', 'PICKUP', 'SCHEDULER', []],
    ['PAID', 'PICKUP', 'SCHEDULER', ['startProcessing']],
    ['PAID', 'PICKUP', 'FINANCE', ['generateInvoice', 'refund']],
    ['READY', 'PICKUP', 'OPS_MANAGER', ['markAwaitingPickup', 'markLost', 'markDamaged', 'refund']],
    ['READY', 'DELIVERY', 'OPS_MANAGER', ['markAwaitingDelivery', 'markLost', 'markDamaged', 'refund']],
    ['AWAITING_PICKUP', 'PICKUP', 'CUSTOMER_SUPPORT', ['complete']],
    ['COMPLETED', 'DELIVERY', 'TENANT_OWNER', ['generateInvoice', 'refund']],
  ] as const)('%s + %s + %s → %j', (status, fulfillment, role, expected) => {
    expect(laundryOrderActions(status, fulfillment, role)).toEqual(expected);
  });

  it('gives ANALYST and SUPER_ADMIN no verbs on any status', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const fulfillment of ['DELIVERY', 'PICKUP'] as const) {
        expect(laundryOrderActions(status, fulfillment, 'ANALYST')).toEqual([]);
        expect(laundryOrderActions(status, fulfillment, 'SUPER_ADMIN')).toEqual([]);
      }
    }
  });

  it('gives nobody a verb on CANCELLED, REJECTED or REFUNDED, and nothing while the role is loading', () => {
    for (const role of [...ADMIN_ROLES, undefined]) {
      for (const status of ['CANCELLED', 'REJECTED', 'REFUNDED'] as const) {
        expect(laundryOrderActions(status, 'PICKUP', role)).toEqual([]);
      }
    }
    expect(laundryOrderActions('PAID', 'PICKUP', undefined)).toEqual([]);
  });

  it('never shows SCHEDULER cancel, refund or paid; CUSTOMER_SUPPORT weigh or price; FINANCE receive', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      const scheduler = laundryOrderActions(status, 'PICKUP', 'SCHEDULER');
      expect(scheduler).not.toContain('cancel');
      expect(scheduler).not.toContain('refund');
      expect(scheduler).not.toContain('markPaid');
      const support = laundryOrderActions(status, 'PICKUP', 'CUSTOMER_SUPPORT');
      expect(support).not.toContain('weigh');
      expect(support).not.toContain('price');
    }
    expect(canReceiveLaundryOrder('FINANCE')).toBe(false);
    expect(canReceiveLaundryOrder('ANALYST')).toBe(false);
    expect(canReceiveLaundryOrder('CUSTOMER_SUPPORT')).toBe(true);
    expect(canReceiveLaundryOrder(undefined)).toBe(false);
  });

  it('never offers both pickup and delivery', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const fulfillment of ['DELIVERY', 'PICKUP'] as const) {
        const verbs = laundryOrderActions(status, fulfillment, 'TENANT_OWNER');
        expect(verbs.includes('markAwaitingPickup') && verbs.includes('markAwaitingDelivery')).toBe(false);
      }
    }
  });
});

describe('laundry verb copy', () => {
  const { laundry } = getDefaultMessages();

  it('has a label, success and failure string for every verb', () => {
    for (const verb of LAUNDRY_ORDER_VERBS) {
      expect(laundry.actions[verb]).toEqual(expect.any(String));
      expect(laundry.success[verb]).toEqual(expect.any(String));
      expect(laundry.failure[verb]).toEqual(expect.any(String));
    }
  });

  it('has confirmation copy for exactly the destructive verbs', () => {
    expect(Object.keys(laundry.confirm).sort()).toEqual([...LAUNDRY_DESTRUCTIVE_VERBS].sort());
  });
});
