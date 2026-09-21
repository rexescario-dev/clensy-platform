// Default `en` messages for BookingDataTable. This is the ONLY copy of
// these strings' original English text — apps/web is not expected to (and
// today does not) hold a parallel copy; it may layer partial overrides on
// top via ClensyI18nProvider, deep-merged with this catalog.
export const bookings = {
  columns: {
    customer: 'Customer',
    price: 'Price',
    property: 'Property',
    scheduled: 'Scheduled',
    service: 'Service',
    status: 'Status',
    team: 'Team',
  },
  empty: 'No bookings.',
  error: 'Unable to load bookings.',
  sort: {
    ascending: 'Sort ascending (tap to sort descending)',
    descending: 'Sort descending (tap to sort ascending)',
    label: 'Sort by',
  },
  status: {
    cancelled: 'Cancelled',
    completed: 'Completed',
    confirmed: 'Confirmed',
    pending: 'Pending',
  },
  unassigned: 'Unassigned',
};
