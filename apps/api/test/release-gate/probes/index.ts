import type { Probe } from '../probe';
import { CUSTOMER_PROBES } from './customers';
import { CATALOG_PROBES } from './catalog';
import { CLEANER_PROBES } from './cleaners';

// Exactly one probe per tenant GraphQL operation and REST route (Phase 1b).
export const PROBES: readonly Probe[] = [
  ...CUSTOMER_PROBES,
  ...CATALOG_PROBES,
  ...CLEANER_PROBES,
];
