import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';

// `tenantId` (#82 Slice decision 4; #87 slice decision 8): the principal's
// tenant via `requireTenantId`, passed through to
// `CustomersService.getCustomer` so cross-tenant intake fails closed exactly
// like a missing customer (RFC §4.5), and stamped on the new order.
export interface ReceiveLaundryOrderCommand {
  actorId: string;
  tenantId: string;
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
}
