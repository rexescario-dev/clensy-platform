import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';

// `tenantId` (#82 Slice decision 4): the principal's tenant, passed straight
// through to `CustomersService.getCustomer` so cross-tenant intake fails
// closed exactly like a missing customer (RFC §4.5). `receiveLaundryOrder`
// is GraphQL-only and `@UseGuards(AuthGuard)` — unlike Bookings' REST
// controller, there is no unauthenticated caller here, but the type stays
// `string | null` to match `AuthenticatedPrincipal.tenantId` without a
// non-null assertion at the resolver.
export interface ReceiveLaundryOrderCommand {
  actorId: string;
  tenantId: string | null;
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
}
