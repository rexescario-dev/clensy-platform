import { MigrationInterface } from 'typeorm';

// Dual `@Column bookingId` + `@ManyToOne` on CleaningJobEntity, plus
// checklist item inverse. Generate is expected to emit unrelated FK noise;
// keep `fk_cleaning_job_booking`, `fk_checklist_item_checklist`, unique
// `UQ_cleaning_job_booking_id`, and ON DELETE as shipped.
export class AddJobBookingAndChecklistItemInverse1787936000000
  implements MigrationInterface
{
  name = 'AddJobBookingAndChecklistItemInverse1787936000000';

  public async up(): Promise<void> {
    // no schema diff
  }

  public async down(): Promise<void> {
    // no schema diff
  }
}
