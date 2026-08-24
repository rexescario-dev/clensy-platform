import { BookingPricingSnapshot } from './booking-pricing-snapshot';
import { BookingStatus } from './booking-status';

// `customerId`/`propertyId`/`serviceId`/`teamId` are reference-only ids
// (spec §2.6) — never `Customer`/`Property`/`Service`/`Team` domain objects
// or entities. `customerId`/`propertyId`/`serviceId` are immutable after
// creation; `teamId` is nullable and mutable (spec §4.1).
export interface Booking {
  id: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  teamId: string | null;
  scheduledAt: Date;
  status: BookingStatus;
  pricingSnapshot: BookingPricingSnapshot;
  createdAt: Date;
}
