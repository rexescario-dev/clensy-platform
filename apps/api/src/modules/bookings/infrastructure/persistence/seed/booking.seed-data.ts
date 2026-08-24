import { BookingStatus } from '../../../domain/booking-status';
import {
  bookingFixtureCustomer,
  bookingFixtureProperty,
  bookingFixtureService,
  bookingFixtureTeam,
} from './booking-fixtures.seed-data';

// Persistence-agnostic — no TypeORM here. Deterministic ids so re-seeding is
// safe (upsert on id) and a given fixture is always recognizable by its id.
// References `booking-fixtures.seed-data.ts`'s ids — those rows are
// upserted by `platform/database/seed.ts` before `BookingSeeder.seed()`
// runs (plan §3), so this file no longer needs its own customerName/
// serviceType fake strings.
export interface BookingSeedData {
  id: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  teamId: string | null;
  scheduledAt: Date;
  status: BookingStatus;
  pricingSnapshot: { priceMinorUnits: number };
}

export const bookingSeedData: readonly BookingSeedData[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    customerId: bookingFixtureCustomer.id,
    propertyId: bookingFixtureProperty.id,
    serviceId: bookingFixtureService.id,
    teamId: bookingFixtureTeam.id,
    scheduledAt: new Date('2026-08-18T09:00:00Z'),
    status: BookingStatus.CONFIRMED,
    pricingSnapshot: { priceMinorUnits: 250000 },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    customerId: bookingFixtureCustomer.id,
    propertyId: bookingFixtureProperty.id,
    serviceId: bookingFixtureService.id,
    teamId: null,
    scheduledAt: new Date('2026-08-20T13:30:00Z'),
    status: BookingStatus.PENDING,
    pricingSnapshot: { priceMinorUnits: 250000 },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    customerId: bookingFixtureCustomer.id,
    propertyId: bookingFixtureProperty.id,
    serviceId: bookingFixtureService.id,
    teamId: bookingFixtureTeam.id,
    scheduledAt: new Date('2026-08-15T11:00:00Z'),
    status: BookingStatus.COMPLETED,
    pricingSnapshot: { priceMinorUnits: 250000 },
  },
];
