import type { InvoicePaymentStatus, Role } from '@clensy/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  amountDueView,
  canRecordPayment,
  canRefundPayment,
  mergePaymentPages,
  newIdempotencyKey,
  parsePaymentAmount,
  recordAmountPrefill,
  recordedByLabel,
} from './invoice-payments';

// Pure rules for the invoice payments panel (#39 Task 8).
const TENANT_ROLES: readonly Role[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT', 'SCHEDULER', 'ANALYST'];
const RECORDERS = new Set<Role>(['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT']);
const REFUNDERS = new Set<Role>(['TENANT_OWNER', 'FINANCE']);
const STATUSES: readonly InvoicePaymentStatus[] = ['UNPAID', 'VOID'];
const REFUNDABLE = { refundableMinorUnits: 500, type: 'PAYMENT' } as const;
// The API's A1 check (apps/api/src/modules/payments/domain/idempotency-key.ts).
const API_A1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canRecordPayment', () => {
  for (const role of TENANT_ROLES) {
    for (const status of STATUSES) {
      const expected = RECORDERS.has(role) && status !== 'VOID';
      it(`${role} on ${status} → ${expected}`, () => {
        expect(canRecordPayment(role, status)).toBe(expected);
      });
    }
  }

  it('is false without a role', () => {
    expect(canRecordPayment(undefined, 'UNPAID')).toBe(false);
  });
});

describe('canRefundPayment', () => {
  for (const role of TENANT_ROLES) {
    for (const status of STATUSES) {
      const expected = REFUNDERS.has(role) && status !== 'VOID';
      it(`${role} on ${status} → ${expected}`, () => {
        expect(canRefundPayment(role, status, REFUNDABLE)).toBe(expected);
      });
    }
  }

  it('is false for a REFUND row', () => {
    expect(canRefundPayment('FINANCE', 'PAID', { refundableMinorUnits: 500, type: 'REFUND' })).toBe(false);
  });

  it.each([0, null])('is false when the refundable amount is %s', (refundableMinorUnits) => {
    expect(canRefundPayment('FINANCE', 'PAID', { refundableMinorUnits, type: 'PAYMENT' })).toBe(false);
  });

  it('is false without a role', () => {
    expect(canRefundPayment(undefined, 'PAID', REFUNDABLE)).toBe(false);
  });
});

describe('recordedByLabel', () => {
  const emails = new Map([['s2', 'staff@example.com']]);

  it.each(TENANT_ROLES)('own id → you (%s)', (role) => {
    expect(recordedByLabel({ recordedByStaffId: 's1', viewerId: 's1', staffEmails: emails, viewerRole: role })).toEqual({
      kind: 'you',
    });
  });

  it('other staff, TENANT_OWNER, email known → email', () => {
    expect(
      recordedByLabel({ recordedByStaffId: 's2', viewerId: 's1', staffEmails: emails, viewerRole: 'TENANT_OWNER' }),
    ).toEqual({ email: 'staff@example.com', kind: 'email' });
  });

  it('other staff, FINANCE with a map → staff (map ignored)', () => {
    expect(recordedByLabel({ recordedByStaffId: 's2', viewerId: 's1', staffEmails: emails, viewerRole: 'FINANCE' })).toEqual(
      { kind: 'staff' },
    );
  });

  it('TENANT_OWNER with the id missing from the map → staff', () => {
    expect(
      recordedByLabel({ recordedByStaffId: 's3', viewerId: 's1', staffEmails: emails, viewerRole: 'TENANT_OWNER' }),
    ).toEqual({ kind: 'staff' });
  });

  it('null id → staff', () => {
    expect(
      recordedByLabel({ recordedByStaffId: null, viewerId: undefined, staffEmails: emails, viewerRole: 'TENANT_OWNER' }),
    ).toEqual({ kind: 'staff' });
  });
});

describe('amountDueView', () => {
  it('a negative due is overpaid by its absolute value', () => {
    expect(amountDueView(-200)).toEqual({ kind: 'overpaid', minorUnits: 200 });
  });

  it.each([0, 700])('%s is due', (minorUnits) => {
    expect(amountDueView(minorUnits)).toEqual({ kind: 'due', minorUnits });
  });
});

describe('recordAmountPrefill', () => {
  it('pre-fills a positive due', () => {
    expect(recordAmountPrefill(700)).toBe('7.00');
  });

  it.each([0, -5])('is empty for %s', (minorUnits) => {
    expect(recordAmountPrefill(minorUnits)).toBe('');
  });
});

describe('parsePaymentAmount', () => {
  const MAX = 2147483647;

  it.each(['abc', '', '1.234', '-1'])('%j → invalid', (input) => {
    expect(parsePaymentAmount(input, MAX)).toEqual({ error: 'invalid', ok: false });
  });

  it.each(['0', '0.00'])('%j → zero', (input) => {
    expect(parsePaymentAmount(input, MAX)).toEqual({ error: 'zero', ok: false });
  });

  it('the largest amount is ok', () => {
    expect(parsePaymentAmount('21474836.47', MAX)).toEqual({ minorUnits: 2147483647, ok: true });
  });

  it('one centavo more is too large', () => {
    expect(parsePaymentAmount('21474836.48', MAX)).toEqual({ error: 'tooLarge', ok: false });
  });

  it('a digit string beyond MAX_SAFE_INTEGER is too large, without precision loss', () => {
    expect(parsePaymentAmount('99999999999999999999', MAX)).toEqual({ error: 'tooLarge', ok: false });
    expect(parsePaymentAmount('0000000000000000000000001.00', MAX)).toEqual({ minorUnits: 100, ok: true });
  });

  it('a refund above its refundable amount is overRefundable', () => {
    expect(parsePaymentAmount('5.01', 500)).toEqual({ error: 'overRefundable', ok: false });
    expect(parsePaymentAmount('5.00', 500)).toEqual({ minorUnits: 500, ok: true });
  });
});

describe('mergePaymentPages', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };

  it('keeps the first occurrence of each id, in page order', () => {
    expect(mergePaymentPages([[a, b], [b, c]])).toEqual([a, b, c]);
    expect(mergePaymentPages([[c, a], [a, b, c]])).toEqual([c, a, b]);
  });

  it('ignores an empty page', () => {
    expect(mergePaymentPages([[a], []])).toEqual([a]);
  });
});

describe('newIdempotencyKey', () => {
  it('uses crypto.randomUUID when present', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto), randomUUID });
    expect(newIdempotencyKey()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('builds a v4 UUID from getRandomValues when randomUUID is missing', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(array: T) => real.getRandomValues(array) });
    const first = newIdempotencyKey();
    const second = newIdempotencyKey();
    expect(first).toMatch(V4);
    expect(first).toMatch(API_A1);
    expect(second).toMatch(V4);
    expect(second).not.toBe(first);
  });
});
