import { BookingPricingSnapshot } from './booking-pricing-snapshot';
import { BookingStatus } from './booking-status';

// `customerId`/`propertyId`/`serviceId`/`teamId` are reference-only ids
// (spec §2.6) — never `Customer`/`Property`/`Service`/`Team` domain objects
// or entities. `customerId`/`propertyId`/`serviceId` are immutable after
// creation; `teamId` is nullable and mutable (spec §4.1).
export interface Booking {
  id: string;
  // Authoritative for every related foreign key (#85 slice decision I-1): a
  // booking cannot reference a Customer, Property, Service, or Team
  // belonging to another tenant.
  tenantId: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  teamId: string | null;
  scheduledAt: Date;
  status: BookingStatus;
  pricingSnapshot: BookingPricingSnapshot;
  createdAt: Date;
}
