import { MigrationInterface } from 'typeorm';

// Dual `@Column customerId` + `@ManyToOne` on PropertyEntity plus inverse
// `@OneToMany` on CustomerEntity.properties is legal on TypeORM 1.1.x:
// generate succeeded and did **not** rename `customerId` or change
// `ON DELETE RESTRICT`. It did **not** emit DROP/ADD of
// `fk_property_customer`.
//
// The generator did emit DROP (up) / ADD (down) of other modules'
// hand-added constraints. Untouched by this task; those statements were
// removed by hand — same precedent as `AddPropertyBookingInverse`.
export class AddCustomerPropertyInverse1787934320223 implements MigrationInterface {
  name = 'AddCustomerPropertyInverse1787934320223';

  public async up(): Promise<void> {
    // no schema diff — property FK name, column, and ON DELETE already match
  }

  public async down(): Promise<void> {
    // no schema diff
  }
}
