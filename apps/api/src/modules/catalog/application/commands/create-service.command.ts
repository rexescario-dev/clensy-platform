export interface CreateServiceCommand {
  actorId: string;
  tenantId: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
}
