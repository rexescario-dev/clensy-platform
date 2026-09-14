// Persistence-agnostic — no TypeORM here. Deterministic ids so re-seeding
// is safe (upsert on id). `BookingSeeder` has no other module's seeder to
// depend on (no other module has one yet), so `platform/database/seed.ts`
// upserts these fixtures directly via the plain CLI `DataSource` (plan §3)
// before `BookingSeeder.seed()` runs — `bookingSeedData` (booking.seed-data
// .ts) references these same ids for its own `customerId`/`propertyId`/
// `serviceId`/`teamId` fields.

export const bookingFixtureCustomer = {
  id: '00000000-0000-0000-0001-000000000001',
  email: 'amara.chidi@example.com',
  fullName: 'Amara Chidi',
  notes: null,
  phone: '555-0110',
};

export const bookingFixtureProperty = {
  id: '00000000-0000-0000-0001-000000000002',
  customerId: bookingFixtureCustomer.id,
  accessNotes: null,
  addressLine1: '12 Palm Street',
  addressLine2: null,
  city: 'Cebu City',
  label: 'Home',
  postalCode: '6000',
  region: 'Cebu',
};

export const bookingFixtureService = {
  id: '00000000-0000-0000-0001-000000000003',
  active: true,
  description: null,
  durationMinutes: 120,
  name: 'Standard Cleaning',
};

export const bookingFixtureTeam = {
  id: '00000000-0000-0000-0001-000000000004',
  name: 'Seed Team A',
};
