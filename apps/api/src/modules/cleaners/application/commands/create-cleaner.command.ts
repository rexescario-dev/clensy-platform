export interface CreateCleanerCommand {
  actorId: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email: string;
  notes?: string | null;
}
