import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Booking } from '../../../bookings/domain/booking';
import { BookingsService } from '../../../bookings/application/services/bookings.service';
import { Team } from '../../../cleaners/domain/team';
import { TeamsService } from '../../../cleaners/application/services/teams.service';
import { Checklist } from '../../domain/checklist';
import { ChecklistItem } from '../../domain/checklist-item';
import { JobsService } from '../../application/services/jobs.service';

export function createBookingBatchFn(
  bookingsService: Pick<BookingsService, 'getBookingsByIds'>,
): DataLoader.BatchLoadFn<string, Booking | null> {
  return async (ids) => {
    const bookings = await bookingsService.getBookingsByIds([...ids]);
    const byId = new Map(bookings.map((booking) => [booking.id, booking]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createJobTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    const teams = await teamsService.getTeamsByIds([...ids]);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createChecklistBatchFn(
  jobsService: Pick<JobsService, 'getChecklistsByJobIds'>,
): DataLoader.BatchLoadFn<string, Checklist | null> {
  return async (jobIds) => {
    const checklists = await jobsService.getChecklistsByJobIds([...jobIds]);
    const byJobId = new Map(
      checklists.map((checklist) => [checklist.jobId, checklist]),
    );
    return jobIds.map((id) => byJobId.get(id) ?? null);
  };
}

export function createChecklistItemsBatchFn(
  jobsService: Pick<JobsService, 'getChecklistItemsByChecklistIds'>,
): DataLoader.BatchLoadFn<string, ChecklistItem[]> {
  return async (checklistIds) => {
    const items = await jobsService.getChecklistItemsByChecklistIds([
      ...checklistIds,
    ]);
    const byChecklistId = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const existing = byChecklistId.get(item.checklistId);
      if (existing) {
        existing.push(item);
      } else {
        byChecklistId.set(item.checklistId, [item]);
      }
    }
    return checklistIds.map((id) =>
      [...(byChecklistId.get(id) ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
    );
  };
}

@Injectable({ scope: Scope.REQUEST })
export class JobRelationLoaders {
  readonly bookingLoader: DataLoader<string, Booking | null>;
  readonly teamLoader: DataLoader<string, Team | null>;
  readonly checklistLoader: DataLoader<string, Checklist | null>;
  readonly itemsLoader: DataLoader<string, ChecklistItem[]>;

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly teamsService: TeamsService,
    private readonly jobsService: JobsService,
  ) {
    this.bookingLoader = new DataLoader(
      createBookingBatchFn(this.bookingsService),
    );
    this.teamLoader = new DataLoader(createJobTeamBatchFn(this.teamsService));
    this.checklistLoader = new DataLoader(
      createChecklistBatchFn(this.jobsService),
    );
    this.itemsLoader = new DataLoader(
      createChecklistItemsBatchFn(this.jobsService),
    );
  }
}
