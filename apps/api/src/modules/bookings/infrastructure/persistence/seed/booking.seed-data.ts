import { BookingStatus } from '../../../domain/booking-status';

// Persistence-agnostic — no TypeORM here. Deterministic ids so re-seeding is
// safe (upsert on id) and a given fixture is always recognizable by its id.
export interface BookingSeedData {
  id: string;
  customerName: string;
  serviceType: string;
  scheduledAt: Date;
  status: BookingStatus;
}

export const bookingSeedData: readonly BookingSeedData[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    customerName: 'Amara Chidi',
    serviceType: 'Standard Cleaning',
    scheduledAt: new Date('2026-08-18T09:00:00Z'),
    status: BookingStatus.CONFIRMED,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    customerName: 'Liam Novak',
    serviceType: 'Deep Cleaning',
    scheduledAt: new Date('2026-08-20T13:30:00Z'),
    status: BookingStatus.PENDING,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    customerName: 'Priya Raman',
    serviceType: 'Move-Out Cleaning',
    scheduledAt: new Date('2026-08-15T11:00:00Z'),
    status: BookingStatus.COMPLETED,
  },
];
