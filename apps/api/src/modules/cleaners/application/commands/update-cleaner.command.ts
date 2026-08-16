export interface UpdateCleanerCommand {
  actorId: string;
  fullName?: string;
  phone?: string;
  email?: string;
  notes?: string | null;
}
