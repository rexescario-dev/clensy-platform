import { MigrationInterface } from 'typeorm';

// Dual `@Column` + `@ManyToOne` on the same camelCase FK is legal on the
// installed TypeORM 1.1.x: generate succeeded and did **not** rename
// `customerId`/`propertyId`/`serviceId`/`teamId` or change
// `ON DELETE RESTRICT`. It also did not emit DROP/ADD of
// `fk_booking_customer` / `fk_booking_property` / `fk_booking_service` /
// `fk_booking_team` — those already match `MigrateBookingReferences`.
//
// The generator did emit DROP (up) / ADD (down) of other modules'
// hand-added constraints (`fk_property_customer`, `fk_cleaning_job_*`,
// `fk_checklist_*`, `fk_cleaner_team`, `fk_pricing_rule_service`,
// `uq_pricing_rule_active_service`, `UQ_cleaning_job_booking_id`,
// `UQ_checklist_job_id`). Untouched by this task; those statements were
// removed by hand rather than executed — same precedent as
// `AddCleaningJob` / `AddPricingRule`. No schema diff remains, so this
// migration is a recorded no-op.
export class AddBookingRelations1787894029231 implements MigrationInterface {
  name = 'AddBookingRelations1787894029231';

  public async up(): Promise<void> {
    // no schema diff — booking FK names, columns, and ON DELETE already match
  }

  public async down(): Promise<void> {
    // no schema diff
  }
}
