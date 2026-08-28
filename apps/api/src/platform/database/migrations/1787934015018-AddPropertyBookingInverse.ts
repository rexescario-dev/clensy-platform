import { MigrationInterface } from 'typeorm';

// Dual `@Column` + `@ManyToOne` on BookingEntity.property plus inverse
// `@OneToMany` on PropertyEntity.bookings is legal on the installed
// TypeORM 1.1.x: generate succeeded and did **not** rename `propertyId` or
// change `ON DELETE RESTRICT`. It did **not** emit DROP/ADD of
// `fk_booking_property` — that already matches `MigrateBookingReferences`
// / `AddBookingRelations`.
//
// The generator did emit DROP (up) / ADD (down) of other modules'
// hand-added constraints (`fk_property_customer`, `fk_cleaning_job_*`,
// `fk_checklist_*`, `fk_cleaner_team`, `fk_pricing_rule_service`,
// `uq_pricing_rule_active_service`, `UQ_cleaning_job_booking_id`,
// `UQ_checklist_job_id`). Untouched by this task; those statements were
// removed by hand rather than executed — same precedent as
// `AddBookingRelations`. No schema diff remains, so this migration is a
// recorded no-op.
export class AddPropertyBookingInverse1787934015018 implements MigrationInterface {
  name = 'AddPropertyBookingInverse1787934015018';

  public async up(): Promise<void> {
    // no schema diff — booking FK name, column, and ON DELETE already match
  }

  public async down(): Promise<void> {
    // no schema diff
  }
}
