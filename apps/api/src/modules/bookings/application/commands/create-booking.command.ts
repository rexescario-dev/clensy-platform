// `actorId` is nullable: `null` means "do not audit this call," supplied
// only by the unauthenticated REST controller (spec §4.4). GraphQL's
// resolver always supplies a real, non-null `currentUser.id`.
//
// `tenantId` is nullable too, and for the analogous reason (#82 Slice
// decision 4): GraphQL passes the principal's tenant; the unauthenticated
// REST controller passes `null`, which `CustomersService.getCustomer` /
// `PropertiesService.getProperty` treat as "no tenant scope" and never
// resolve a row for — REST `POST /bookings` therefore fails closed with
// the existing `NotFoundException`, not a new error shape.
export interface CreateBookingCommand {
  actorId: string | null;
  tenantId: string | null;
  customerId: string;
  propertyId: string;
  serviceId: string;
  teamId?: string | null;
  scheduledAt: Date;
}
