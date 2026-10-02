import type { Probe } from '../probe';
import { CUSTOMER_PROBES } from './customers';

// Exactly one probe per tenant GraphQL operation and REST route (Phase 1b).
export const PROBES: readonly Probe[] = [...CUSTOMER_PROBES];
