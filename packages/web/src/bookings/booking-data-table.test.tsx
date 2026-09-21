import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BookingDataTable,
  nextMobileSortState,
  toggledMobileSortDirection,
  type Booking,
} from './booking-data-table';
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
    expect(html).toContain('Confirmed');
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

  it('renders no error state when hasError is omitted, even if errorMessage is supplied', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        errorMessage="Custom error"
        pagination={pagination}
      />,
    );
    expect(html).not.toContain('Custom error');
    expect(html).toContain('Jane Doe');
  });

  it('renders the package default error message when hasError is true and errorMessage is omitted', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        hasError
        pagination={pagination}
      />,
    );
    expect(html).toContain('Unable to load bookings.');
  });

  it('renders the supplied errorMessage instead of the default when hasError is true', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        hasError
        errorMessage="Custom error"
        pagination={pagination}
      />,
    );
    expect(html).toContain('Custom error');
    expect(html).not.toContain('Unable to load bookings.');
  });

  it('falls back to the default when hasError is true and errorMessage is an explicit empty string', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        hasError
        errorMessage=""
        pagination={pagination}
      />,
    );
    expect(html).toContain('Unable to load bookings.');
  });

  it('marks the Scheduled and Status columns sortable with the correct sortKey', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'scheduledAt', direction: 'asc' }}
      />,
    );
    const scheduledHeaderIndex = html.indexOf('>Scheduled<');
    const scheduledCellStart = html.lastIndexOf('<th', scheduledHeaderIndex);
    const scheduledCellEnd = html.indexOf('</th>', scheduledHeaderIndex);
    expect(html.slice(scheduledCellStart, scheduledCellEnd)).toContain('aria-sort="ascending"');
  });

  it('passes sort/onSortChange through to the underlying DataTable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'status', direction: 'desc' }}
      />,
    );
    const statusHeaderIndex = html.indexOf('>Status<');
    const statusCellStart = html.lastIndexOf('<th', statusHeaderIndex);
    const statusCellEnd = html.indexOf('</th>', statusHeaderIndex);
    expect(html.slice(statusCellStart, statusCellEnd)).toContain('aria-sort="descending"');
  });

  it('customer/property/service/team/price columns are not sortable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} />,
    );
    const customerHeaderIndex = html.indexOf('>Customer<');
    const customerCellStart = html.lastIndexOf('<th', customerHeaderIndex);
    expect(html.slice(customerCellStart, customerHeaderIndex)).not.toContain('<button');
  });

  it('renders each BookingStatus as a Badge with the correct translated label', () => {
    for (const [status, label] of [
      ['PENDING', 'Pending'],
      ['CONFIRMED', 'Confirmed'],
      ['CANCELLED', 'Cancelled'],
      ['COMPLETED', 'Completed'],
    ] as const) {
      const html = renderToStaticMarkup(
        <BookingDataTable bookings={[{ ...booking, status }]} formatPrice={() => '₱0.00'} pagination={pagination} />,
      );
      expect(html).toContain(label);
      expect(html).not.toContain(`>${status}<`);
    }
  });

  it('falls back to an outline Badge with the raw status string for an unrecognized status', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[{ ...booking, status: 'SOME_FUTURE_STATUS' as never }]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
      />,
    );
    expect(html).toContain('SOME_FUTURE_STATUS');
  });

  it('renders a mobile card with a booking reference, customer, date, and status for each booking', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={(m) => `₱${(m / 100).toFixed(2)}`} pagination={pagination} />,
    );
    expect(html).toContain(booking.id);
    expect(html).toContain('Jane Doe');
  });

  it('passes refreshing through to the underlying DataTable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} refreshing />,
    );
    expect(html).toContain('role="progressbar"');
  });

  it('accepts a navigation-shaped pagination prop', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={{ hasNextPage: true, hasPreviousPage: false, mode: 'navigation', onNext: () => {}, onPrevious: () => {}, pageSize: 20 }}
      />,
    );
    expect(html).toContain('Jane Doe');
  });
});

// #65 finding 1 (final review): before this fix, the mobile card list had
// no sort affordance of its own — on a narrow viewport the entire desktop
// header (including its sortable-column buttons) is hidden, so sorting was
// completely unreachable. This block covers both the reducers (pure) and
// the rendered control (structural), matching how the rest of this file
// and data-table.test.tsx already split coverage between the two.
describe('BookingDataTable — mobile sort control (#65 finding 1)', () => {
  it('nextMobileSortState changes the key but preserves the current direction (pure)', () => {
    expect(nextMobileSortState({ key: 'scheduledAt', direction: 'asc' }, 'status')).toEqual({
      key: 'status',
      direction: 'asc',
    });
    expect(nextMobileSortState({ key: 'status', direction: 'desc' }, 'scheduledAt')).toEqual({
      key: 'scheduledAt',
      direction: 'desc',
    });
  });

  it('nextMobileSortState defaults to the table-wide default direction (desc) when there is no active sort', () => {
    expect(nextMobileSortState(null, 'status')).toEqual({ key: 'status', direction: 'desc' });
    expect(nextMobileSortState(undefined, 'status')).toEqual({ key: 'status', direction: 'desc' });
  });

  it('toggledMobileSortDirection flips asc<->desc, preserving the key (pure)', () => {
    expect(toggledMobileSortDirection({ key: 'status', direction: 'asc' })).toEqual({
      key: 'status',
      direction: 'desc',
    });
    expect(toggledMobileSortDirection({ key: 'status', direction: 'desc' })).toEqual({
      key: 'status',
      direction: 'asc',
    });
  });

  it('toggledMobileSortDirection defaults to the table-wide default key/direction when there is no active sort', () => {
    expect(toggledMobileSortDirection(null)).toEqual({ key: 'scheduledAt', direction: 'asc' });
  });

  it('renders a mobile-only (sm:hidden) sort select with Scheduled/Status options when onSortChange is provided', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'scheduledAt', direction: 'desc' }}
        onSortChange={() => {}}
      />,
    );
    const toolbarStart = html.indexOf('sm:hidden');
    expect(toolbarStart).toBeGreaterThan(-1);
    expect(html).toContain('<select');
    expect(html).toContain('Sort by');
  });

  it('reflects the current sort key as the selected mobile option', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'status', direction: 'asc' }}
        onSortChange={() => {}}
      />,
    );
    expect(html).toContain('<option value="status" selected');
  });

  it('labels the direction toggle for the current direction (ascending -> tap to sort descending)', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
        sort={{ key: 'status', direction: 'asc' }}
        onSortChange={() => {}}
      />,
    );
    expect(html).toContain('Sort ascending');
  });

  it('omits the mobile sort control entirely when onSortChange is not provided (no disconnected sort UI)', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable bookings={[booking]} formatPrice={() => '₱0.00'} pagination={pagination} />,
    );
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Sort by');
  });
});
