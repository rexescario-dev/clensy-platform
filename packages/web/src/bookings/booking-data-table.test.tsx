import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookingDataTable, type Booking } from './booking-data-table';

const booking: Booking = {
  id: 'b1',
  customer: { id: 'c1', fullName: 'Jane Doe' },
  pricingSnapshot: { priceMinorUnits: 12345 },
  property: { id: 'p1', addressLine1: '123 Main St' },
  scheduledAt: '2026-09-19T10:00:00.000Z',
  service: { id: 's1', name: 'Deep Clean' },
  status: 'CONFIRMED',
  team: { id: 't1', name: 'Team A' },
};

const pagination = { onPageChange: () => {}, page: 1, pageSize: 20, totalCount: 1 };

describe('BookingDataTable', () => {
  it('renders every column value, formatting price via the injected callback', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={(minorUnits) => `₱${(minorUnits / 100).toFixed(2)}`}
        pagination={pagination}
      />,
    );
    expect(html).toContain('Jane Doe');
    expect(html).toContain('123 Main St');
    expect(html).toContain('Deep Clean');
    expect(html).toContain('CONFIRMED');
    expect(html).toContain('Team A');
    expect(html).toContain('₱123.45');
  });

  it('renders "Unassigned" when team is null', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[{ ...booking, team: null }]} formatPrice={() => '₱0.00'} pagination={pagination} />,
    );
    expect(html).toContain('Unassigned');
  });

  it('passes pagination through to the underlying DataTable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={{ onPageChange: () => {}, page: 2, pageSize: 20, totalCount: 40 }}
      />,
    );
    expect(html).toContain('Page 2 of 2');
  });
});
