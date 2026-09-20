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
  unassigned: 'Unassigned',
  empty: 'No bookings.',
};
