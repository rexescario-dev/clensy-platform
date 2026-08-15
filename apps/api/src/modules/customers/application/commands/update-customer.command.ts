// Partial-update semantics (spec §4.2): all fields except `actorId` are
// optional. An omitted key retains the customer's current value; a provided
// key (including `notes: null`) is applied. `CustomersService.update` uses
// `Object.assign(entity, command)`, which is safe only because this command
// is built by the resolver via spread — it never carries keys the caller
// didn't actually provide.
export interface UpdateCustomerCommand {
  actorId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  notes?: string | null;
}
