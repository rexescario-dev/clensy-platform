export interface CreateServiceCommand {
  actorId: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
}
