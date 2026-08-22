// `actorId` is nullable: `null` means "do not audit this call," supplied
// only by the unauthenticated REST controller (spec §4.4). GraphQL's
// resolver always supplies a real, non-null `currentUser.id`.
export interface CreateBookingCommand {
  actorId: string | null;
  customerId: string;
  propertyId: string;
  serviceId: string;
  teamId?: string | null;
  scheduledAt: Date;
}
