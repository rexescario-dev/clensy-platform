export interface CreatePropertyCommand {
  actorId: string;
  customerId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  accessNotes?: string | null;
}
