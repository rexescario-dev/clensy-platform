import { LaundryOrderLinePricingSnapshot } from '../../domain/laundry-order-line-pricing-snapshot';

// An estimate, not a price (Amendment #164 §8.4.5): the committed price is
// the snapshot `priceLaundryOrder` freezes. Computed by the same quote path,
// with the current catalog name, and never persisted.
export interface LaundryPricePreview {
  // Sum of the lines' `amountMinorUnits`, the same sum `price` would store.
  estimatedTotalMinorUnits: number;
  lines: LaundryPricePreviewLine[];
}

// Same field names as a priced line and its snapshot (M4 owner decision 1),
// without `pricingRuleId`. Exactly one of `serviceId` / `addOnId` is set.
export interface LaundryPricePreviewLine extends Omit<
  LaundryOrderLinePricingSnapshot,
  'pricingRuleId'
> {
  addOnId: string | null;
  serviceId: string | null;
}
