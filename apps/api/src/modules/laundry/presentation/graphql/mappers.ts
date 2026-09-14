import { LaundryOrder } from '../../domain/laundry-order';
import { LaundryOrderType } from './laundry-order.type';

// Scalar-only mapping. `customer` and the `lines` connection are resolved by
// nestjs-query's generated relation resolvers from the entity relations
// (the `BookingMutationResolver` -> `@FilterableRelation` precedent) — the
// mutation return only needs `id` plus the scalars.
export function toLaundryOrderType(order: LaundryOrder): LaundryOrderType {
  return {
    id: order.id,
    customerId: order.customerId,
    createdAt: order.createdAt,
    fulfillmentType: order.fulfillmentType,
    status: order.status,
    totalMinorUnits: order.totalMinorUnits,
    updatedAt: order.updatedAt,
    weightGrams: order.weightGrams,
  };
}
