import type { Probe } from '../probe';
import { CUSTOMER_PROBES } from './customers';
import { CATALOG_PROBES } from './catalog';
import { CLEANER_PROBES } from './cleaners';
import { BOOKING_PROBES } from './bookings';
import { BOOKING_REST_PROBES } from './bookings-rest';
import { JOB_PROBES } from './jobs';

// Exactly one probe per tenant GraphQL operation and REST route (Phase 1b).
export const PROBES: readonly Probe[] = [
  ...CUSTOMER_PROBES,
  ...CATALOG_PROBES,
  ...CLEANER_PROBES,
  ...BOOKING_PROBES,
  ...BOOKING_REST_PROBES,
  ...JOB_PROBES,
];
