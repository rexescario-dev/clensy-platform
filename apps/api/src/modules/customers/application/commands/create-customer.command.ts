export interface CreateCustomerCommand {
  actorId: string;
  fullName: string;
  email: string;
  phone: string;
  notes?: string | null;
}
