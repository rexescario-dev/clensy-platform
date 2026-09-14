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
    booking: null,
    checklist: null,
    createdAt: job.createdAt,
    scheduledAt: job.scheduledAt,
    status: job.status,
    team: null,
    updatedAt: job.updatedAt,
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
    completed: item.completed,
    completedAt: item.completedAt,
    label: item.label,
    position: item.position,
  };
}

export { toBookingDto };
