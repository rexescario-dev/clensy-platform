import { JobStatus } from './job-status';

// `bookingId`/`teamId` are reference-only ids (spec §2.6 / §4.1) — never
// `Booking`/`Team` domain objects or entities. `bookingId` and `scheduledAt`
// are immutable after creation; `teamId` is a creation-time snapshot until
// `AssignTeamToJob` (Task 3). No `booking`/`team`/`checklist` fields —
// those are GraphQL presentation-layer computed data.
//
// `tenantId` (#86): the owning tenant, always the booking's tenant. It is
// authoritative for `bookingId` and `teamId` (#86 I-1; enforced by
// `fk_cleaning_job_booking_tenant` / `fk_cleaning_job_team_tenant`).
export interface CleaningJob {
  id: string;
  tenantId: string;
  bookingId: string;
  teamId: string | null;
  scheduledAt: Date;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}
