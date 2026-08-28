import { JobStatus } from './job-status';

// `bookingId`/`teamId` are reference-only ids (spec §2.6 / §4.1) — never
// `Booking`/`Team` domain objects or entities. `bookingId` and `scheduledAt`
// are immutable after creation; `teamId` is a creation-time snapshot until
// `AssignTeamToJob` (Task 3). No `booking`/`team`/`checklist` fields —
// those are GraphQL presentation-layer computed data.
export interface CleaningJob {
  id: string;
  bookingId: string;
  teamId: string | null;
  scheduledAt: Date;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}
