// Persistence-agnostic — no TypeORM here. Deterministic ids so re-seeding
// is safe (upsert on id). `BookingSeeder` has no other module's seeder to
// depend on (no other module has one yet), so `platform/database/seed.ts`
// upserts these fixtures directly via the plain CLI `DataSource` (plan §3)
// before `BookingSeeder.seed()` runs — `bookingSeedData` (booking.seed-data
// .ts) references these same ids for its own `customerId`/`propertyId`/
// `serviceId`/`teamId` fields.

export const bookingFixtureCustomer = {
  id: '00000000-0000-0000-0001-000000000001',
  fullName: 'Amara Chidi',
  email: 'amara.chidi@example.com',
  phone: '555-0110',
  notes: null,
};

export const bookingFixtureProperty = {
  id: '00000000-0000-0000-0001-000000000002',
  customerId: bookingFixtureCustomer.id,
  label: 'Home',
  addressLine1: '12 Palm Street',
  addressLine2: null,
  city: 'Cebu City',
  region: 'Cebu',
  postalCode: '6000',
  accessNotes: null,
};

export const bookingFixtureService = {
  id: '00000000-0000-0000-0001-000000000003',
  name: 'Standard Cleaning',
  description: null,
  durationMinutes: 120,
  active: true,
};

export const bookingFixtureTeam = {
  id: '00000000-0000-0000-0001-000000000004',
  name: 'Seed Team A',
};
