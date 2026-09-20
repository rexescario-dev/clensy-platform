import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookingDataTable, type Booking } from './booking-data-table';
import { ClensyI18nProvider } from '../i18n/i18n-context';

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

  it('renders default @clensy/web column headers with zero application-level i18n integration', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} />,
    );
    for (const header of ['Customer', 'Property', 'Service', 'Scheduled', 'Status', 'Team', 'Price']) {
      expect(html).toContain(header);
    }
  });

  it('applies a partial application override to only the intended header, leaving the rest at package defaults', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ bookings: { columns: { customer: 'Client' } } }}>
        <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('Client');
    expect(html).not.toContain('>Customer<');
    for (const header of ['Property', 'Service', 'Scheduled', 'Status', 'Team', 'Price']) {
      expect(html).toContain(header);
    }
  });
});
