export interface UpdateServiceCommand {
  actorId: string;
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  active?: boolean;
}
