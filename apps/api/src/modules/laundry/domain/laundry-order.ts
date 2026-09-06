import { LaundryFulfillmentType } from './laundry-fulfillment-type';
import { LaundryOrderStatus } from './laundry-order-status';

// The central laundry operational aggregate (spec §4.2). Customer-only —
// `customerId` is a reference-only id (never a `Customer` domain object or
// entity), required and immutable after creation. No `propertyId`. No
// structural reference to Invoice/Payment/Promotion/Delivery/Loyalty.
//
// `status` only ever changes through a transition validated by
// `LaundryOrderStatusTransitionPolicy`. `weightGrams` is `null` until the
// order is weighed and is locked once `PRICED`. `totalMinorUnits` is `null`
// until `PRICED`, then the frozen sum of every line's `amountMinorUnits`.
export interface LaundryOrder {
  id: string;
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
  status: LaundryOrderStatus;
  weightGrams: number | null;
  totalMinorUnits: number | null;
  createdAt: Date;
  updatedAt: Date;
}
