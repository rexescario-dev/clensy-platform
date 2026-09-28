export interface UpdateServiceCommand {
  actorId: string;
  tenantId: string;
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  active?: boolean;
}
