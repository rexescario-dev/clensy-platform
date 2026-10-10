import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LaundryOrderDataTable,
  type LaundryOrderDataTableProps,
  type LaundryOrderRow,
} from './laundry-order-data-table';
import type { LaundryOrderSortState } from './laundry-order-sort';

// Static markup, as in the other @clensy/web table tests. Assertions are on
// text, labels, attributes and the issue's own card classes, not on
// DataTable's wrapper markup. Clicks are covered by apps/web's jsdom test.
const order: LaundryOrderRow = {
  id: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
  createdAt: '2026-10-01T09:00:00.000Z',
  customer: { id: 'c1', fullName: 'Ana Reyes' },
  fulfillmentType: 'DELIVERY',
  status: 'AWAITING_PAYMENT',
  totalMinorUnits: 45000,
  weightGrams: 2500,
};

const noop = () => {};
const CARD_CLASSES = 'rounded-md border border-slate-200 p-3';

// The header's `aria-sort` value, or undefined when it is not sortable.
function headerSort(html: string, header: string): string | undefined {
  const match = new RegExp(`<th([^>]*)>(?:<button[^>]*>)?${header}<`).exec(html);
  expect(match).not.toBeNull();
  return /aria-sort="([a-z]+)"/.exec(match![1])?.[1];
}

// The mobile card element: the `<div>` carrying the issue's card classes,
// up to its matching `</div>`. Static markup has no DOM, so this walks the
// string's div tags.
function mobileCard(html: string): string {
  const start = html.lastIndexOf('<div', html.indexOf(CARD_CLASSES));
  expect(html.indexOf(CARD_CLASSES)).toBeGreaterThan(-1);
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  throw new Error('unbalanced card markup');
}

function render(overrides: Partial<LaundryOrderDataTableProps> = {}): string {
  return renderToStaticMarkup(
    <LaundryOrderDataTable
      filters={{ fulfillment: null, search: '', status: null }}
      filtersActive={false}
      formatPrice={(minorUnits) => `₱${(minorUnits / 100).toFixed(2)}`}
      onClearFilters={noop}
      onFulfillmentChange={noop}
      onRowClick={noop}
      onSearchChange={noop}
      onSortChange={noop}
      onStatusChange={noop}
      orders={[order]}
      pagination={{ onPageChange: noop, page: 1, pageSize: 20, totalCount: 1 }}
      sort={{ direction: 'desc', key: 'createdAt' }}
      {...overrides}
    />,
  );
}

describe('LaundryOrderDataTable', () => {
  it('renders the human status and fulfillment, formatted weight and total, and a short order id', () => {
    const html = render();
    expect(html).toContain('Ana Reyes');
    expect(html).toContain('Awaiting payment');
    expect(html).not.toContain('>AWAITING_PAYMENT<');
    expect(html).toContain('Delivery');
    expect(html).toContain('2.50 kg');
    expect(html).toContain('₱450.00');
    expect(html).toContain('<span aria-hidden="true">3f2a9c1e</span>');
    expect(html).toContain(`title="${order.id}"`);
    expect(html).toContain(`<span class="sr-only">${order.id}</span>`);
  });

  it('renders an em dash for an unweighed, unpriced order', () => {
    const html = render({ orders: [{ ...order, status: 'RECEIVED', totalMinorUnits: null, weightGrams: null }] });
    expect(html).toContain('Received');
    expect(mobileCard(html)).toContain('Weight: —');
    expect(mobileCard(html)).toContain('Total: —');
  });

  it('renders Created with toLocaleString, and an unparseable value as given', () => {
    expect(render()).toContain(new Date(order.createdAt as string).toLocaleString());
    expect(render({ orders: [{ ...order, createdAt: 'not-a-date' }] })).toContain('not-a-date');
  });

  it('offers sort on Order, Fulfillment, Status and Created only', () => {
    const html = render();
    expect(html.match(/aria-sort="/g)).toHaveLength(4);
    for (const header of ['Order', 'Fulfillment', 'Status', 'Created']) expect(headerSort(html, header)).toBeDefined();
    for (const header of ['Customer', 'Weight', 'Total']) expect(headerSort(html, header)).toBeUndefined();
  });

  it.each([
    [{ direction: 'desc', key: 'createdAt' }, 'Created', 'descending'],
    [{ direction: 'asc', key: 'createdAt' }, 'Created', 'ascending'],
    [{ direction: 'asc', key: 'status' }, 'Status', 'ascending'],
    [{ direction: 'desc', key: 'fulfillmentType' }, 'Fulfillment', 'descending'],
    [{ direction: 'asc', key: 'id' }, 'Order', 'ascending'],
  ] as [LaundryOrderSortState, string, string][])('shows %j on the %s header as %s', (sort, header, ariaSort) => {
    const html = render({ sort });
    expect(headerSort(html, header)).toBe(ariaSort);
    expect(html.match(/aria-sort="(ascending|descending)"/g)).toHaveLength(1);
  });

  it('labels the search field and both filters, with All plus human options', () => {
    const html = render();
    expect(html).toContain('for="laundry-order-search">Search by customer or order id</label>');
    expect(html).toContain('id="laundry-order-search"');
    expect(html).toContain('for="laundry-order-status-filter">Status</label>');
    expect(html).toContain('id="laundry-order-status-filter"');
    expect(html).toContain('for="laundry-order-fulfillment-filter">Fulfillment</label>');
    expect(html).toContain('id="laundry-order-fulfillment-filter"');
    expect(html).toContain('<option value="AWAITING_PICKUP">Awaiting pickup</option>');
    expect(html).toContain('<option value="PICKUP">Customer pickup</option>');
    // A controlled select marks its current option `selected` in static markup.
    expect(html.match(/<option value="" selected="">All<\/option>/g)).toHaveLength(2);
  });

  it('reflects the current filter values in the controls', () => {
    const html = render({ filters: { fulfillment: 'PICKUP', search: 'ana', status: 'READY' }, filtersActive: true });
    expect(html).toContain('value="ana"');
    expect(html).toContain('<option value="READY" selected="">Ready</option>');
    expect(html).toContain('<option value="PICKUP" selected="">Customer pickup</option>');
  });

  it('shows the plain empty copy without filters, and the filtered copy plus a clear control with them', () => {
    const plain = render({ orders: [] });
    expect(plain).toContain('No laundry orders.');
    expect(plain).not.toContain('Clear search and filters');

    const filtered = render({ filtersActive: true, orders: [] });
    expect(filtered).toContain('No laundry orders match these filters.');
    expect(filtered).not.toContain('No laundry orders.');
    expect(filtered).toContain('Clear search and filters');
  });

  it('shows the list error copy', () => {
    expect(render({ hasError: true, orders: [] })).toContain('Unable to load laundry orders.');
  });

  it('renders a mobile card with the customer, status, fulfillment, weight and total, and no control of its own', () => {
    const card = mobileCard(render());
    expect(card).toContain('<span class="min-w-0 break-words font-medium text-slate-900">Ana Reyes</span>');
    expect(card).toContain('Awaiting payment');
    expect(card).toContain('Delivery');
    expect(card).toContain('Weight: 2.50 kg');
    expect(card).toContain('Total: ₱450.00');
    expect(card).not.toContain('<a ');
    expect(card).not.toContain('<button');
    expect(card).not.toContain('role="button"');
  });
});
