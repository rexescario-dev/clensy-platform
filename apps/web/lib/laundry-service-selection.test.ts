import type { PreviewLaundryOrderPriceQuery } from '@clensy/client';
import {
  ADMIN_ROLES,
  LAUNDRY_ORDER_STATUSES,
  laundryOrderActions,
  type AdminRole,
  type LaundryOrderStatus,
} from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_LAUNDRY_SERVICE_SELECTION,
  laundryRateKey,
  laundryServicesView,
  laundryUnitKey,
  matchPreview,
  missingPriceTarget,
  parseItemCount,
  previewCorresponds,
  previewInputFromSelection,
  type LaundryAddOnRow,
  type LaundryServiceSelection,
} from './laundry-service-selection';
import { LAUNDRY_PRICED_STATUSES } from './laundry-order-page';

type Line = PreviewLaundryOrderPriceQuery['previewLaundryOrderPrice']['lines'][number];

const ORDER = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';
const WASH = { id: '11111111-1111-4111-8111-111111111111', name: 'Wash & fold' };
const IRON = { id: '22222222-2222-4222-8222-222222222222', name: 'Ironing' };
const SOFT = { id: '33333333-3333-4333-8333-333333333333', name: 'Softener' };

function row(key: number, choice: LaundryAddOnRow['choice'], quantity = '1'): LaundryAddOnRow {
  return { choice, duplicate: false, key, quantity, quantityTouched: false, query: choice?.name ?? '', touched: false };
}

function selection(overrides: Partial<LaundryServiceSelection> = {}): LaundryServiceSelection {
  return { ...EMPTY_LAUNDRY_SERVICE_SELECTION, base: WASH, baseQuery: WASH.name, baseQuantity: '1', ...overrides };
}

function line(overrides: Partial<Line>): Line {
  return {
    addOnId: null,
    serviceId: null,
    amountMinorUnits: 0,
    description: '',
    minimumChargeApplied: false,
    minimumChargeMinorUnits: null,
    quantity: 1,
    rateMinorUnits: 0,
    unit: 'FLAT',
    ...overrides,
  };
}

// The roles that may price (spec §4.4). Every other `ADMIN_ROLES` entry,
// including the platform SUPER_ADMIN, is ineligible.
const OPERATIONAL: ReadonlySet<AdminRole> = new Set<AdminRole>(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER']);

describe('laundryServicesView', () => {
  // Owner decision 4 (M5 part 1 suggestion: exhaustive against the real
  // types). `LAUNDRY_ORDER_STATUSES` is the keys of a
  // `Record<LaundryOrderStatus, …>`, and `ADMIN_ROLES` is every
  // `AdminRole`, so a new status or role joins this matrix without an edit
  // here. Every status × both fulfillment types × role loading and each
  // role × saved lines yes/no.
  function expected(status: LaundryOrderStatus, role: AdminRole | undefined, hasLines: boolean) {
    if (status === 'WEIGHED') {
      if (role === undefined) return 'hidden';
      return OPERATIONAL.has(role) ? 'editor' : 'none';
    }
    if (status === 'RECEIVED') return 'beforeWeigh';
    if (LAUNDRY_PRICED_STATUSES.has(status)) return 'locked';
    return hasLines ? 'lines' : 'none';
  }

  it('covers all 15 statuses and all 7 roles', () => {
    expect(LAUNDRY_ORDER_STATUSES).toHaveLength(15);
    expect(ADMIN_ROLES).toHaveLength(7);
  });

  for (const status of LAUNDRY_ORDER_STATUSES) {
    for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
      for (const hasLines of [false, true]) {
        for (const role of [undefined, ...ADMIN_ROLES]) {
          it(`${status}, ${fulfillment}, lines ${String(hasLines)}: ${role ?? 'role loading'}`, () => {
            const verbs = laundryOrderActions(status, fulfillment, role);
            expect(laundryServicesView({ hasLines, roleResolved: role !== undefined, status, verbs })).toBe(
              expected(status, role, hasLines),
            );
          });
        }
      }
    }
  }

  // M5 part 2 suggestion 1: pinned by literal roles and statuses, not by the
  // `expected` helper, so a change to `laundryOrderActions` or to the view
  // cannot widen or narrow who edits without failing here.
  it.each(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'] as const)('shows the editor to %s on a WEIGHED order', (role) => {
    for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
      const verbs = laundryOrderActions('WEIGHED', fulfillment, role);
      expect(laundryServicesView({ hasLines: false, roleResolved: true, status: 'WEIGHED', verbs })).toBe('editor');
    }
  });

  it('shows the editor for exactly WEIGHED × TENANT_OWNER, OPS_MANAGER, SCHEDULER and nothing else', () => {
    const editors = new Set<string>();
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const role of ADMIN_ROLES) {
        for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
          const verbs = laundryOrderActions(status, fulfillment, role);
          for (const hasLines of [false, true]) {
            if (laundryServicesView({ hasLines, roleResolved: true, status, verbs }) === 'editor') editors.add(`${status}:${role}`);
          }
        }
      }
    }
    expect([...editors].sort()).toEqual(['WEIGHED:OPS_MANAGER', 'WEIGHED:SCHEDULER', 'WEIGHED:TENANT_OWNER']);
  });

  it('never shows the editor outside WEIGHED, whatever the verbs claim', () => {
    for (const status of LAUNDRY_ORDER_STATUSES.filter((s) => s !== 'WEIGHED')) {
      // A forced `price` verb: the view checks the status itself, not only the verbs.
      expect(laundryServicesView({ hasLines: false, roleResolved: true, status, verbs: ['price'] })).not.toBe('editor');
    }
  });

  it('shows the locked sentence for CANCELLED and REJECTED never, with or without lines', () => {
    for (const status of ['CANCELLED', 'REJECTED'] as const) {
      expect(laundryServicesView({ hasLines: true, roleResolved: true, status, verbs: [] })).toBe('lines');
      expect(laundryServicesView({ hasLines: false, roleResolved: true, status, verbs: [] })).toBe('none');
    }
  });
});

describe('parseItemCount', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['007', 7],
    ['2147483647', 2147483647],
  ])('accepts %j', (text, value) => {
    expect(parseItemCount(text)).toBe(value);
  });

  it.each(['', ' ', '0', '00', '-1', '1.5', '1.0', ' 2', '2 ', '+2', '1e3', 'two', '2147483648', '99999999999999999999'])(
    'rejects %j',
    (text) => {
      expect(parseItemCount(text)).toBeNull();
    },
  );
});

describe('previewInputFromSelection', () => {
  it('is null without a base service', () => {
    expect(previewInputFromSelection(ORDER, EMPTY_LAUNDRY_SERVICE_SELECTION, {})).toBeNull();
  });

  it('sends no count for a unit that is unknown or not PER_ITEM', () => {
    for (const unit of [undefined, 'PER_KG', 'FLAT', 'PER_SERVICE'] as const) {
      const units = unit ? { [laundryUnitKey('service', WASH.id)]: unit, [laundryUnitKey('addOn', IRON.id)]: unit } : {};
      expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, IRON, '5')], baseQuantity: '5' }), units)).toEqual({
        addOns: [{ addOnId: IRON.id }],
        baseServiceId: WASH.id,
        orderId: ORDER,
      });
    }
  });

  it('sends the count for a remembered PER_ITEM base service and add-on', () => {
    const units = { [laundryUnitKey('service', WASH.id)]: 'PER_ITEM', [laundryUnitKey('addOn', IRON.id)]: 'PER_ITEM' } as const;
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, IRON, '4')], baseQuantity: '3' }), units)).toEqual({
      baseServiceId: WASH.id,
      orderId: ORDER,
      addOns: [{ addOnId: IRON.id, quantity: 4 }],
      baseQuantity: 3,
    });
  });

  it('keys remembered units by kind: a service unit never applies to an add-on with the same id', () => {
    const shared = { id: WASH.id, name: 'Same id' };
    const units = { [laundryUnitKey('service', WASH.id)]: 'PER_ITEM' } as const;
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, shared, '9')] }), units)?.addOns).toEqual([{ addOnId: WASH.id }]);
  });

  it('is null for an invalid remembered PER_ITEM count, base or add-on', () => {
    const units = { [laundryUnitKey('service', WASH.id)]: 'PER_ITEM', [laundryUnitKey('addOn', IRON.id)]: 'PER_ITEM' } as const;
    expect(previewInputFromSelection(ORDER, selection({ baseQuantity: '0' }), units)).toBeNull();
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, IRON, '')] }), units)).toBeNull();
  });

  it('leaves out a row with no choice, keeping the others in row order', () => {
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, SOFT), row(1, null), row(2, IRON)] }), {})?.addOns).toEqual([
      { addOnId: SOFT.id },
      { addOnId: IRON.id },
    ]);
  });
});

describe('matchPreview', () => {
  const current = selection({ addOns: [row(4, IRON), row(7, null), row(9, SOFT)] });
  const input = previewInputFromSelection(ORDER, current, {})!;
  const base = line({ serviceId: WASH.id, unit: 'PER_KG' });
  const iron = line({ addOnId: IRON.id, unit: 'PER_ITEM' });
  const soft = line({ addOnId: SOFT.id });

  it('maps the base line and each chosen row, by row key', () => {
    const matched = matchPreview(input, current, { estimatedTotalMinorUnits: 0, lines: [base, iron, soft] })!;
    expect(matched.base).toBe(base);
    expect(matched.addOns.get(4)).toBe(iron);
    expect(matched.addOns.get(9)).toBe(soft);
    expect(matched.addOns.has(7)).toBe(false);
  });

  it.each([
    ['a missing line', [base, iron]],
    ['an extra line', [base, iron, soft, soft]],
    ['add-ons out of order', [base, soft, iron]],
    ['a base line that is an add-on', [iron, iron, soft]],
    ['an add-on line that names a service', [base, line({ serviceId: IRON.id }), soft]],
    ['a base line for another service', [line({ serviceId: IRON.id }), iron, soft]],
  ])('rejects the whole preview for %s', (_name, lines) => {
    expect(previewCorresponds(input, { estimatedTotalMinorUnits: 0, lines })).toBe(false);
    expect(matchPreview(input, current, { estimatedTotalMinorUnits: 0, lines })).toBeNull();
  });

  it('corresponds for the matching lines, using the input alone', () => {
    expect(previewCorresponds(input, { estimatedTotalMinorUnits: 0, lines: [base, iron, soft] })).toBe(true);
  });

  it('rejects in matchPreview when the chosen rows no longer carry the input ids', () => {
    const moved = selection({ addOns: [row(4, SOFT), row(9, IRON)] });
    expect(matchPreview(input, moved, { estimatedTotalMinorUnits: 0, lines: [base, iron, soft] })).toBeNull();
  });

  // M5 part 2 P2: the contract is line correspondence only. Quantities,
  // order id and weight are the caller's to check (Task 4's exact
  // `[weightGrams, input]` key; cases 13, 14 and 19), so a line whose
  // quantity differs from the input still corresponds.
  it('compares no quantity: whether the input is current is the caller\'s contract', () => {
    const counted = { ...input, addOns: [{ addOnId: IRON.id, quantity: 4 }, { addOnId: SOFT.id }], baseQuantity: 2 };
    const lines = [line({ quantity: 9, serviceId: WASH.id }), line({ addOnId: IRON.id, quantity: 7 }), soft];
    expect(matchPreview(counted, current, { estimatedTotalMinorUnits: 0, lines })).not.toBeNull();
  });
});

describe('missingPriceTarget', () => {
  const current = selection({ addOns: [row(3, IRON), row(5, null)] });

  it('names the base service for its exact serviceId message', () => {
    expect(missingPriceTarget(`No effective price for serviceId ${WASH.id}`, current)).toEqual({ kind: 'service' });
  });

  it('names the add-on row for its exact addOnId message', () => {
    expect(missingPriceTarget(`No effective price for addOnId ${IRON.id}`, current)).toEqual({ key: 3, kind: 'addOn' });
  });

  it('declines when two selected rows hold the named add-on, rather than marking the first', () => {
    const repeated = selection({ addOns: [row(3, IRON), row(8, IRON)] });
    expect(missingPriceTarget(`No effective price for addOnId ${IRON.id}`, repeated)).toBeNull();
  });

  it.each([
    ['the wrong kind for the base id', `No effective price for addOnId ${WASH.id}`],
    ['the wrong kind for the add-on id', `No effective price for serviceId ${IRON.id}`],
    ['an id that is not selected', `No effective price for addOnId ${SOFT.id}`],
    ['a malformed id', 'No effective price for addOnId not-a-uuid'],
    ['a trailing period', `No effective price for addOnId ${IRON.id}.`],
    ['a prefix', `Error: No effective price for addOnId ${IRON.id}`],
    ['another message', 'Cannot price a laundry order in status PRICED'],
    ['an empty message', ''],
  ])('returns null for %s', (_name, message) => {
    expect(missingPriceTarget(message, current)).toBeNull();
  });
});

describe('laundryRateKey', () => {
  it.each([
    ['PER_KG', 'perKg'],
    ['PER_ITEM', 'perItem'],
    ['FLAT', 'flat'],
    ['PER_SERVICE', 'flat'],
  ] as const)('%s → %s', (unit, key) => {
    expect(laundryRateKey(unit)).toBe(key);
  });
});
