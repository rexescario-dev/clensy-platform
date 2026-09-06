import { PricingUnit } from '../../catalog/domain/pricing-unit';

// One priced item on an invoice (spec §4.2, §4.4). A self-contained
// historical snapshot: `description` is the catalog `Service` / `AddOn`
// name frozen at generation, and `quantity` / `unit` / `rateMinorUnits` /
// `amountMinorUnits` are copied verbatim from the source
// `LaundryOrderLine.pricingSnapshot` — no recomputation, and NO foreign
// key or id pointer to `service_entity` / `add_on_entity` /
// `pricing_rule_entity` / `laundry_order_line_entity`. A later catalog
// rename or price change never alters an existing invoice line.
//
// `id`, `invoiceId`, and `createdAt` are billing-owned persistence fields,
// not copies of anything.
//
// The source snapshot's `minimumChargeMinorUnits` / `minimumChargeApplied`
// are NOT copied — `amountMinorUnits` is already the fully-resolved figure
// and #38 has no operation that would re-derive it.
export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unit: PricingUnit;
  rateMinorUnits: number;
  amountMinorUnits: number;
  createdAt: Date;
}
