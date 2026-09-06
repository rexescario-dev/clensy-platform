import { LaundryOrderLinePricingSnapshot } from './laundry-order-line-pricing-snapshot';

// One priced item on a `LaundryOrder` (spec §4.2). Exactly one of
// `serviceId`/`addOnId` is set — the base-service line has `serviceId`,
// each add-on line has `addOnId`. Created only by `priceLaundryOrder`,
// together with its frozen snapshot; never mutated afterward.
//
// `serviceId`/`addOnId` are reference-only ids (never `Service`/`AddOn`
// domain objects or entities).
export interface LaundryOrderLine {
  id: string;
  laundryOrderId: string;
  serviceId: string | null;
  addOnId: string | null;
  pricingSnapshot: LaundryOrderLinePricingSnapshot;
  createdAt: Date;
}
