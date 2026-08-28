import { toBookingDto } from '../../../bookings/presentation/graphql/mappers';
import { Checklist } from '../../domain/checklist';
import { ChecklistItem } from '../../domain/checklist-item';
import { CleaningJob } from '../../domain/cleaning-job';
import { ChecklistItemType } from './checklist-item.type';
import { ChecklistType } from './checklist.type';
import { CleaningJobType } from './cleaning-job.type';

export function toCleaningJobType(job: CleaningJob): CleaningJobType {
  return {
    id: job.id,
    bookingId: job.bookingId,
    teamId: job.teamId,
    scheduledAt: job.scheduledAt,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    booking: null,
    team: null,
    checklist: null,
  } as unknown as CleaningJobType;
}

export function toChecklistType(checklist: Checklist): ChecklistType {
  return {
    id: checklist.id,
  };
}

export function toChecklistItemType(item: ChecklistItem): ChecklistItemType {
  return {
    id: item.id,
    label: item.label,
    position: item.position,
    completed: item.completed,
    completedAt: item.completedAt,
  };
}

export { toBookingDto };
