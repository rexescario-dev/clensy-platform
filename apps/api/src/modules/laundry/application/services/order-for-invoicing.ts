import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';

// Read-only projection of a `LaundryOrder` + its lines, shaped for the
// Billing module's `generateInvoiceFromOrder` (#38 spec §4.1). Returned by
// `LaundryOrdersService.getOrderForInvoicing`. This is `modules/laundry`'s
// read contract for billing — `modules/billing` imports this type and the
// service, never a laundry entity or repository.
//
// Only the four snapshot fields Billing copies verbatim are projected;
// `minimumChargeMinorUnits` / `minimumChargeApplied` / `pricingRuleId` are
// intentionally omitted (Billing does not copy them).
export interface OrderForInvoicingLine {
  serviceId: string | null;
  addOnId: string | null;
  pricingSnapshot: {
    quantity: number;
    unit: PricingUnit;
    rateMinorUnits: number;
    amountMinorUnits: number;
  };
}

export interface OrderForInvoicing {
  id: string;
  customerId: string;
  status: LaundryOrderStatus;
  totalMinorUnits: number | null;
  lines: OrderForInvoicingLine[];
}
