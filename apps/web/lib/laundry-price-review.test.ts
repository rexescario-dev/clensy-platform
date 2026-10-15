import type { LaundryOrderQuery } from '@clensy/client';
import {
  ADMIN_ROLES,
  LAUNDRY_ORDER_STATUSES,
  laundryOrderActions,
  type AdminRole,
  type LaundryOrderStatus,
} from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  laundryEstimateState,
  laundryPreviewRows,
  laundryPriceView,
  laundrySnapshotRows,
  type LaundryEstimateState,
} from './laundry-price-review';
import type { LaundryPreviewLine } from './laundry-service-selection';

type SnapshotLine = NonNullable<LaundryOrderQuery['laundryOrder']>['lines']['nodes'][number];

// The roles that may price (spec §4.4).
const OPERATIONAL: ReadonlySet<AdminRole> = new Set<AdminRole>(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER']);

describe('laundryPriceView', () => {
  // Owner decision 5, in precedence order. Exhaustive over the real status
  // and role lists, both fulfillment types, total yes/no and role loading.
  function expected(status: LaundryOrderStatus, role: AdminRole | undefined, hasTotal: boolean) {
    if (hasTotal) return 'final';
    if (status !== 'RECEIVED' && status !== 'WEIGHED') return 'notPriced';
    if (role === undefined) return 'hidden';
    if (status === 'WEIGHED' && OPERATIONAL.has(role)) return 'estimate';
    return 'beforePricing';
  }

  it('covers all 15 statuses and all 7 roles', () => {
    expect(LAUNDRY_ORDER_STATUSES).toHaveLength(15);
    expect(ADMIN_ROLES).toHaveLength(7);
  });

  for (const status of LAUNDRY_ORDER_STATUSES) {
    for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
      for (const hasTotal of [false, true]) {
        for (const role of [undefined, ...ADMIN_ROLES]) {
          it(`${status}, ${fulfillment}, total ${String(hasTotal)}: ${role ?? 'role loading'}`, () => {
            const verbs = laundryOrderActions(status, fulfillment, role);
            expect(laundryPriceView({ hasTotal, roleResolved: role !== undefined, status, verbs })).toBe(
              expected(status, role, hasTotal),
            );
          });
        }
      }
    }
  }

  // M5 Section 2 correction 3: the precedence rules most likely to regress,
  // pinned by literals rather than by `expected`.
  it.each(['CANCELLED', 'REJECTED'] as const)('%s without a total is notPriced, even with a forced price verb', (status) => {
    expect(laundryPriceView({ hasTotal: false, roleResolved: true, status, verbs: ['price'] })).toBe('notPriced');
    expect(laundryPriceView({ hasTotal: false, roleResolved: false, status, verbs: [] })).toBe('notPriced');
  });

  it('any status with a total is final, even while the role loads', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      expect(laundryPriceView({ hasTotal: true, roleResolved: false, status, verbs: [] })).toBe('final');
      expect(laundryPriceView({ hasTotal: true, roleResolved: true, status, verbs: ['price'] })).toBe('final');
    }
  });

  it('a status that implies pricing but has no total is notPriced, never estimate', () => {
    for (const status of ['PRICED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'COMPLETED', 'REFUNDED'] as const) {
      expect(laundryPriceView({ hasTotal: false, roleResolved: true, status, verbs: ['price'] })).toBe('notPriced');
    }
  });

  it('WEIGHED without the price verb is beforePricing', () => {
    expect(laundryPriceView({ hasTotal: false, roleResolved: true, status: 'WEIGHED', verbs: [] })).toBe('beforePricing');
  });

  it('WEIGHED with the role unresolved and no total is hidden', () => {
    expect(laundryPriceView({ hasTotal: false, roleResolved: false, status: 'WEIGHED', verbs: [] })).toBe('hidden');
  });

  it('shows the estimate for exactly WEIGHED × TENANT_OWNER, OPS_MANAGER, SCHEDULER', () => {
    const estimates = new Set<string>();
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const role of ADMIN_ROLES) {
        for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
          const verbs = laundryOrderActions(status, fulfillment, role);
          if (laundryPriceView({ hasTotal: false, roleResolved: true, status, verbs }) === 'estimate') {
            estimates.add(`${status}:${role}`);
          }
        }
      }
    }
    expect([...estimates].sort()).toEqual(['WEIGHED:OPS_MANAGER', 'WEIGHED:SCHEDULER', 'WEIGHED:TENANT_OWNER']);
  });
});

describe('laundryEstimateState', () => {
  const READY = { complete: true, hasBase: true, previewError: false, previewLoading: false, ready: true };

  it.each<[string, Partial<typeof READY>, LaundryEstimateState]>([
    ['ready', {}, 'ready'],
    // noBase wins over everything, including leftover rows and a loading preview.
    ['no base', { complete: false, hasBase: false, previewLoading: true, ready: false }, 'noBase'],
    ['no base, with an error', { hasBase: false, previewError: true, ready: false }, 'noBase'],
    // incomplete wins over loading and over a preview for the valid part.
    ['incomplete while loading', { complete: false, previewLoading: true, ready: false }, 'incomplete'],
    ['incomplete with a failure', { complete: false, previewError: true, ready: false }, 'incomplete'],
    ['incomplete, hook not ready', { complete: false, ready: false }, 'incomplete'],
    ['loading', { previewLoading: true, ready: false }, 'loading'],
    ['failed', { previewError: true, ready: false }, 'failed'],
    // Planning decision (f): unreachable today; offers Try again.
    ['complete, idle, not ready', { ready: false }, 'failed'],
  ])('%s', (_label, change, state) => {
    expect(laundryEstimateState({ ...READY, ...change })).toBe(state);
  });

  it('is never ready unless the hook says ready', () => {
    for (const complete of [false, true]) {
      for (const hasBase of [false, true]) {
        for (const previewError of [false, true]) {
          for (const previewLoading of [false, true]) {
            expect(laundryEstimateState({ complete, hasBase, previewError, previewLoading, ready: false })).not.toBe('ready');
          }
        }
      }
    }
  });
});

describe('price rows', () => {
  function previewLine(overrides: Partial<LaundryPreviewLine>): LaundryPreviewLine {
    return {
      addOnId: null,
      serviceId: null,
      amountMinorUnits: 0,
      description: 'Line',
      minimumChargeApplied: false,
      minimumChargeMinorUnits: null,
      quantity: 1,
      rateMinorUnits: 0,
      unit: 'FLAT',
      ...overrides,
    };
  }

  it('case 1: maps each unit to its quantity and rate key, keyed by position', () => {
    const rows = laundryPreviewRows([
      previewLine({ serviceId: 's1', description: 'Wash', quantity: 2505, rateMinorUnits: 5000, unit: 'PER_KG' }),
      previewLine({ addOnId: 'a1', description: 'Ironing (add-on)', quantity: 3, rateMinorUnits: 2500, unit: 'PER_ITEM' }),
      previewLine({ addOnId: 'a2', description: 'Softener (add-on)', rateMinorUnits: 15000, unit: 'FLAT' }),
      previewLine({ addOnId: 'a3', description: 'Duvet (add-on)', rateMinorUnits: 20000, unit: 'PER_SERVICE' }),
    ]);
    expect(rows.map((row) => row.key)).toEqual(['preview-0', 'preview-1', 'preview-2', 'preview-3']);
    expect(rows.map((row) => row.name)).toEqual(['Wash', 'Ironing (add-on)', 'Softener (add-on)', 'Duvet (add-on)']);
    expect(rows.map((row) => row.quantity)).toEqual([
      { kind: 'weight', value: '2.505 kg' },
      { kind: 'items', value: '3' },
      null,
      null,
    ]);
    expect(rows.map((row) => row.rateKey)).toEqual(['perKg', 'perItem', 'flat', 'flat']);
    expect(rows.map((row) => row.rateMinorUnits)).toEqual([5000, 2500, 15000, 20000]);
  });

  it('case 2: copies the server amount, even when it is not rate × quantity', () => {
    const [row] = laundryPreviewRows([
      previewLine({ amountMinorUnits: 12345, quantity: 2505, rateMinorUnits: 5000, unit: 'PER_KG' }),
    ]);
    expect(row?.amountMinorUnits).toBe(12345);
  });

  it('case 3: carries the minimum charge only when applied, with the server minimum or null', () => {
    const rows = laundryPreviewRows([
      previewLine({ minimumChargeApplied: true, minimumChargeMinorUnits: 15000 }),
      previewLine({ minimumChargeApplied: true, minimumChargeMinorUnits: null }),
      previewLine({ minimumChargeApplied: false, minimumChargeMinorUnits: 15000 }),
    ]);
    expect(rows.map((row) => row.minimumCharge)).toEqual([{ minorUnits: 15000 }, { minorUnits: null }, null]);
  });

  it('case 4: snapshot rows use the frozen description and the line id', () => {
    const line: SnapshotLine = {
      id: 'line-1',
      addOnId: null,
      serviceId: 's1',
      createdAt: '2026-10-15T09:00:00.000Z',
      pricingSnapshot: {
        pricingRuleId: null,
        amountMinorUnits: 30000,
        description: 'Wash & fold',
        minimumChargeApplied: true,
        minimumChargeMinorUnits: 30000,
        quantity: 2505,
        rateMinorUnits: 5000,
        unit: 'PER_KG',
      },
    };
    expect(laundrySnapshotRows([line])).toEqual([
      {
        amountMinorUnits: 30000,
        key: 'line-1',
        minimumCharge: { minorUnits: 30000 },
        name: 'Wash & fold',
        quantity: { kind: 'weight', value: '2.505 kg' },
        rateKey: 'perKg',
        rateMinorUnits: 5000,
      },
    ]);
  });
});
