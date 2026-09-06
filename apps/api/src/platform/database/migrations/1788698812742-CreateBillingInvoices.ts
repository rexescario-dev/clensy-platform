import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates only billing-owned objects (#38 spec §4.9). It does NOT create,
// alter, or drop anything belonging to modules/laundry, modules/catalog, or
// modules/customers.
//
// `migration:generate` additionally proposed dropping/recreating
// `fk_cleaning_job_team`, `fk_checklist_job`, `fk_pricing_rule_service`,
// `fk_pricing_rule_addon`, `uq_pricing_rule_active_service`,
// `uq_pricing_rule_open_service`, `uq_pricing_rule_open_addon`,
// `ck_pricing_rule_target`, `ck_laundry_order_line_target`,
// `ck_laundry_order_weight_non_negative`, `fk_cleaning_job_booking`,
// `UQ_cleaning_job_booking_id`, `UQ_checklist_job_id`, and
// `pricing_rule_entity."effectiveFrom"`'s DEFAULT — the identical spurious
// cross-table drift from earlier hand-added constraints that `AddCleaningJob`,
// `ExtendPricingRuleEffectiveDating`, and `CreateLaundryOrders` already
// document. All removed by hand, not executed (plan §3, Task 11 safety gate).
//
// The only object `migration:generate` cannot express is the
// `billing_invoice_number_seq` sequence — nothing in the entity metadata
// references it; `InvoicesService.generateFromOrder` calls `nextval()`
// directly (spec §4.5, §4.6). Hand-added here, dropped in `down()`.
//
// `uq_invoice_number` and `uq_invoice_laundry_order` are real PostgreSQL
// UNIQUE constraints (from `@Unique(...)` class decorators), not unique
// indexes — `uq_invoice_laundry_order` is the one-invoice-per-order
// correctness mechanism (spec §4.3, §4.6).
export class CreateBillingInvoices1788698812742 implements MigrationInterface {
  name = 'CreateBillingInvoices1788698812742';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE "billing_invoice_number_seq"`);

    await queryRunner.query(
      `CREATE TYPE "public"."invoice_payment_status_enum" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_payment_terms_enum" AS ENUM('PAY_NOW', 'PAY_ON_COMPLETION', 'PAY_ON_DELIVERY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_line_unit_enum" AS ENUM('PER_KG', 'PER_ITEM', 'FLAT', 'PER_SERVICE')`,
    );

    await queryRunner.query(
      `CREATE TABLE "invoice_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceNumber" character varying NOT NULL, "laundryOrderId" uuid NOT NULL, "customerId" uuid NOT NULL, "subtotalMinorUnits" integer NOT NULL, "discountMinorUnits" integer NOT NULL, "totalMinorUnits" integer NOT NULL, "amountPaidMinorUnits" integer NOT NULL, "paymentStatus" "public"."invoice_payment_status_enum" NOT NULL, "paymentTerms" "public"."invoice_payment_terms_enum" NOT NULL, "issueDate" TIMESTAMP WITH TIME ZONE NOT NULL, "dueDate" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_invoice_laundry_order" UNIQUE ("laundryOrderId"), CONSTRAINT "uq_invoice_number" UNIQUE ("invoiceNumber"), CONSTRAINT "PK_276fe1a123e3f68d3f7951cf075" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_customer_id" ON "invoice_entity" ("customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_payment_status" ON "invoice_entity" ("paymentStatus")`,
    );

    await queryRunner.query(
      `CREATE TABLE "invoice_line_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceId" uuid NOT NULL, "description" character varying NOT NULL, "quantity" integer NOT NULL, "unit" "public"."invoice_line_unit_enum" NOT NULL, "rateMinorUnits" integer NOT NULL, "amountMinorUnits" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1efc2bf513bd612c970f25d43f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_line_invoice_id" ON "invoice_line_entity" ("invoiceId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "invoice_line_entity" ADD CONSTRAINT "fk_invoice_line_invoice" FOREIGN KEY ("invoiceId") REFERENCES "invoice_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "fk_invoice_laundry_order" FOREIGN KEY ("laundryOrderId") REFERENCES "laundry_order_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "fk_invoice_customer" FOREIGN KEY ("customerId") REFERENCES "customer_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" DROP CONSTRAINT "fk_invoice_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" DROP CONSTRAINT "fk_invoice_laundry_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_line_entity" DROP CONSTRAINT "fk_invoice_line_invoice"`,
    );

    await queryRunner.query(`DROP TABLE "invoice_line_entity"`);
    await queryRunner.query(`DROP TABLE "invoice_entity"`);

    await queryRunner.query(`DROP TYPE "public"."invoice_line_unit_enum"`);
    await queryRunner.query(`DROP TYPE "public"."invoice_payment_terms_enum"`);
    await queryRunner.query(`DROP TYPE "public"."invoice_payment_status_enum"`);

    await queryRunner.query(`DROP SEQUENCE "billing_invoice_number_seq"`);
  }
}
