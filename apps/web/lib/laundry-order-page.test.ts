import { LAUNDRY_ORDER_STATUSES, laundryOrderActions, type AdminRole, type LaundryOrderStatus } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import { isUuid } from './laundry-order-list-query';
import {
  LAUNDRY_ORDER_SECTIONS,
  LAUNDRY_PRICED_STATUSES,
  currentLaundryOrderSection,
  laundryDetailRedirectHref,
  laundryLifecycleVerbs,
  laundryLineQuantity,
  laundryOrderHref,
  laundryOrderSectionId,
  laundryWeighingView,
  resolvedInvoiceNodes,
  resolvedQueryData,
} from './laundry-order-page';

const ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

describe('isUuid', () => {
  it.each([
    [ID, true],
    [ID.toUpperCase(), true],
    ['abc', false],
    ['', false],
    [`${ID} `, false],
    [`${ID}0`, false],
  ])('%j → %s', (text, expected) => {
    expect(isUuid(text)).toBe(expected);
  });
});

describe('laundry order sections', () => {
  it('lists the six sections in page order', () => {
    expect(LAUNDRY_ORDER_SECTIONS).toEqual(['overview', 'weighing', 'services', 'price', 'invoice', 'actions']);
  });

  it('gives each section a stable element id', () => {
    expect(laundryOrderSectionId('weighing')).toBe('laundry-order-weighing');
  });
});

describe('laundryOrderHref', () => {
  it('puts the id in the path', () => {
    expect(laundryOrderHref(ID)).toBe(`/app/laundry/${ID}`);
  });

  it('encodes the id as one path segment', () => {
    expect(laundryOrderHref('a/b?c')).toBe('/app/laundry/a%2Fb%3Fc');
  });
});

describe('laundryDetailRedirectHref', () => {
  it.each([
    ['', null],
    ['status=PAID', null],
    [`detail=${ID}`, `/app/laundry/${ID}`],
    [`?detail=${ID}`, `/app/laundry/${ID}`],
    [`status=PAID&detail=${ID}&sortBy=CREATED_AT`, `/app/laundry/${ID}`],
    ['detail=', '/app/laundry'],
    ['detail=not-an-id', '/app/laundry'],
    ['status=PAID&detail=not-an-id&search=ana', '/app/laundry?status=PAID&search=ana'],
  ])('%j → %j', (search, expected) => {
    expect(laundryDetailRedirectHref(search)).toBe(expected);
  });

  it('accepts URLSearchParams', () => {
    expect(laundryDetailRedirectHref(new URLSearchParams({ detail: ID }))).toBe(`/app/laundry/${ID}`);
  });
});

describe('currentLaundryOrderSection', () => {
  function current(
    status: LaundryOrderStatus,
    role: AdminRole | undefined,
    // No default: a default would turn the `undefined` rows into `false`.
    invoiceExists: boolean | undefined,
  ) {
    return currentLaundryOrderSection({
      invoiceExists,
      status,
      verbs: laundryOrderActions(status, 'PICKUP', role),
    });
  }

  it.each<[LaundryOrderStatus, AdminRole | undefined, boolean | undefined, string | null]>([
    ['RECEIVED', 'OPS_MANAGER', false, 'weighing'],
    ['RECEIVED', 'CUSTOMER_SUPPORT', false, 'actions'],
    ['RECEIVED', 'ANALYST', false, null],
    ['RECEIVED', undefined, false, null],
    // Re-weighing a WEIGHED order is a correction; the next step is services.
    ['WEIGHED', 'OPS_MANAGER', false, 'services'],
    ['WEIGHED', 'FINANCE', false, null],
    ['PRICED', 'TENANT_OWNER', false, 'invoice'],
    // #166: the payment verbs live in Invoice and payment, so it stays
    // current while either is offered, whether or not an invoice exists.
    ['PRICED', 'TENANT_OWNER', true, 'invoice'],
    ['PRICED', 'TENANT_OWNER', undefined, 'invoice'],
    ['PRICED', 'OPS_MANAGER', true, 'invoice'],
    ['AWAITING_PAYMENT', 'CUSTOMER_SUPPORT', true, 'invoice'],
    ['PRICED', 'SCHEDULER', false, null],
    ['PAID', 'SCHEDULER', true, 'actions'],
    ['COMPLETED', 'FINANCE', false, 'invoice'],
    ['COMPLETED', 'ANALYST', false, null],
    ['CANCELLED', 'TENANT_OWNER', false, null],
  ])('%s as %s, invoice exists %s → %s', (status, role, invoiceExists, expected) => {
    expect(current(status, role, invoiceExists)).toBe(expected);
  });
});

describe('resolvedQueryData', () => {
  const data = { invoices: { nodes: [] } };

  it('returns the data of a finished, successful query', () => {
    expect(resolvedQueryData({ data, error: undefined, loading: false })).toBe(data);
  });

  // Apollo can keep earlier data while a query reloads or after it fails
  // (M5 review 1). That data is never treated as the answer.
  it('ignores data retained while the query loads', () => {
    expect(resolvedQueryData({ data, error: undefined, loading: true })).toBeUndefined();
  });

  it('ignores data retained after the query fails', () => {
    expect(resolvedQueryData({ data, error: new Error('network down'), loading: false })).toBeUndefined();
  });

  it('returns undefined before any data', () => {
    expect(resolvedQueryData({ data: undefined, error: undefined, loading: false })).toBeUndefined();
  });
});

describe('resolvedInvoiceNodes', () => {
  const done = { error: undefined, loading: false };

  it('returns the nodes of a finished result, empty or not', () => {
    expect(resolvedInvoiceNodes({ ...done, data: { invoices: { nodes: [] } } })).toEqual([]);
    expect(resolvedInvoiceNodes({ ...done, data: { invoices: { nodes: [{ id: 'i1' }] } } })).toEqual([{ id: 'i1' }]);
  });

  // Only a confirmed node list says whether an invoice exists (M5 review 3).
  it.each<[string, unknown]>([
    ['no data', undefined],
    ['null data', null],
    ['no invoices connection', {}],
    ['a null invoices connection', { invoices: null }],
    ['no nodes array', { invoices: {} }],
    ['null nodes', { invoices: { nodes: null } }],
  ])('treats a finished result with %s as unresolved', (_label, data) => {
    expect(resolvedInvoiceNodes({ ...done, data: data as never })).toBeUndefined();
  });

  it('treats a loading or failed query as unresolved, whatever data it retains', () => {
    const data = { invoices: { nodes: [] } };
    expect(resolvedInvoiceNodes({ data, error: undefined, loading: true })).toBeUndefined();
    expect(resolvedInvoiceNodes({ data, error: new Error('network down'), loading: false })).toBeUndefined();
  });
});

describe('laundryLifecycleVerbs', () => {
  it('drops the verbs that the weighing, services and invoice and payment sections own', () => {
    expect(
      laundryLifecycleVerbs(['weigh', 'price', 'generateInvoice', 'markPaid', 'markAwaitingPayment', 'cancel']),
    ).toEqual(['cancel']);
  });
});

describe('laundryLineQuantity', () => {
  it('shows a per-kg line as its weight', () => {
    expect(laundryLineQuantity('PER_KG', 2505)).toEqual({ kind: 'weight', value: '2.505 kg' });
  });

  it('shows a per-item line as its item count', () => {
    expect(laundryLineQuantity('PER_ITEM', 3)).toEqual({ kind: 'items', value: '3' });
  });

  it.each(['FLAT', 'PER_SERVICE'] as const)('shows no quantity for %s', (unit) => {
    expect(laundryLineQuantity(unit, 1)).toBeNull();
  });
});

// Owner decision 1 (#155 M4): the locked copy is only for an order that
// was priced; CANCELLED and REJECTED never inherit it.
describe('LAUNDRY_PRICED_STATUSES', () => {
  it('is every status except the two before pricing and the two pre-payment exits', () => {
    const notPriced: LaundryOrderStatus[] = ['CANCELLED', 'RECEIVED', 'REJECTED', 'WEIGHED'];
    expect([...LAUNDRY_PRICED_STATUSES].sort()).toEqual(
      LAUNDRY_ORDER_STATUSES.filter((status) => !notPriced.includes(status)).sort(),
    );
    expect(LAUNDRY_PRICED_STATUSES.size).toBe(11);
  });
});

describe('laundryWeighingView', () => {
  const view = (status: LaundryOrderStatus, role: AdminRole | undefined) =>
    laundryWeighingView(status, laundryOrderActions(status, 'PICKUP', role));

  it.each(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'] as const)('offers the editor to %s on RECEIVED and WEIGHED', (role) => {
    expect(view('RECEIVED', role)).toBe('editor');
    expect(view('WEIGHED', role)).toBe('editor');
  });

  it.each(['CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'] as const)('shows %s the read-only weight on RECEIVED and WEIGHED', (role) => {
    expect(view('RECEIVED', role)).toBe('readOnly');
    expect(view('WEIGHED', role)).toBe('readOnly');
  });

  it('shows the read-only weight while the role loads', () => {
    expect(view('RECEIVED', undefined)).toBe('readOnly');
    expect(view('WEIGHED', undefined)).toBe('readOnly');
  });

  it.each([...LAUNDRY_PRICED_STATUSES])('locks %s for every role, including a loading one', (status) => {
    for (const role of ['TENANT_OWNER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'ANALYST', undefined] as const) {
      expect(view(status, role)).toBe('locked');
    }
  });

  it.each(['CANCELLED', 'REJECTED'] as const)('never locks %s', (status) => {
    expect(view(status, 'TENANT_OWNER')).toBe('readOnly');
    expect(view(status, 'ANALYST')).toBe('readOnly');
  });
});
