import { MigrationInterface, QueryRunner } from 'typeorm';

// Laundry invoice payments (#39; payments spec §4.2, §4.9; Amendment #39
// §9.1 items 1, 5; planning decision b). One transaction (TypeORM's
// migration transaction), in this order:
//
//   1. `OVERPAID` / `REFUNDED` on `invoice_payment_status_enum`. `ADD VALUE`
//      inside a transaction is allowed on PostgreSQL 12+ as long as nothing
//      uses the new values in that same transaction — nothing here does. A
//      later migration MUST NOT use them in the same `migration:run`
//      transaction as this one.
//   2. `uq_invoice_id_tenant` — target of `fk_payment_invoice_tenant`.
//   3. `uq_admin_user_id_tenant` — target of
//      `fk_payment_recorded_by_staff_tenant` (decision b). `id` is the PK and
//      NULL `tenantId` rows (platform admins) are distinct under UNIQUE, so
//      existing data cannot violate it.
//   4. The three module-local enums and `payment_entity`.
//
// Entity metadata on `PaymentEntity` (what `migration:generate` models): the
// columns, enums, PK, `fk_payment_tenant`, `uq_payment_tenant_idempotency_key`,
// `idx_payment_tenant_invoice_paid`, `idx_payment_refunded_payment`.
// Hand-written: `ck_payment_amount_positive`, `ck_payment_refund_reference`,
// `uq_payment_id_invoice_tenant`, the composite FKs
// `fk_payment_invoice_tenant`, `fk_payment_refunded_payment`,
// `fk_payment_recorded_by_staff_tenant`, and steps 2–3.
//
// `down()` refuses, before any DDL and without rewriting data, while any
// invoice holds `OVERPAID` / `REFUNDED`.
//
// The class MUST stay this module's first export: `test/helpers/migration-db.ts`
// loads each migration as `Object.values(require(file))[0]`.
export class CreatePayments1791043200000 implements MigrationInterface {
  name = 'CreatePayments1791043200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."invoice_payment_status_enum" ADD VALUE IF NOT EXISTS 'OVERPAID'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."invoice_payment_status_enum" ADD VALUE IF NOT EXISTS 'REFUNDED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "uq_invoice_id_tenant" UNIQUE ("id", "tenantId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" ADD CONSTRAINT "uq_admin_user_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."payment_type_enum" AS ENUM('PAYMENT', 'REFUND')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_method_enum" AS ENUM('CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'CARD', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_record_status_enum" AS ENUM('COMPLETED', 'PENDING', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "invoiceId" uuid NOT NULL, "type" "public"."payment_type_enum" NOT NULL, "method" "public"."payment_method_enum" NOT NULL, "amountMinorUnits" integer NOT NULL, "reference" character varying(120), "status" "public"."payment_record_status_enum" NOT NULL, "paidAt" TIMESTAMP WITH TIME ZONE NOT NULL, "refundedPaymentId" uuid, "recordedByStaffId" uuid, "idempotencyKey" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_payment_tenant_idempotency_key" UNIQUE ("tenantId", "idempotencyKey"), CONSTRAINT "uq_payment_id_invoice_tenant" UNIQUE ("id", "invoiceId", "tenantId"), CONSTRAINT "ck_payment_amount_positive" CHECK ("amountMinorUnits" > 0), CONSTRAINT "ck_payment_refund_reference" CHECK (("type" = 'REFUND') = ("refundedPaymentId" IS NOT NULL)), CONSTRAINT "PK_6c397c81035bd5b42d16ef3bc70" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_tenant_invoice_paid" ON "payment_entity" ("tenantId", "invoiceId", "paidAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_refunded_payment" ON "payment_entity" ("refundedPaymentId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_entity" ADD CONSTRAINT "fk_payment_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_entity" ADD CONSTRAINT "fk_payment_invoice_tenant" FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "invoice_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_entity" ADD CONSTRAINT "fk_payment_refunded_payment" FOREIGN KEY ("refundedPaymentId", "invoiceId", "tenantId") REFERENCES "payment_entity"("id", "invoiceId", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_entity" ADD CONSTRAINT "fk_payment_recorded_by_staff_tenant" FOREIGN KEY ("recordedByStaffId", "tenantId") REFERENCES "admin_user_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  // Behaviour note: besides the refusal above, `down()` drops `payment_entity`
  // even when payment rows exist. All payment rows are lost, and invoices keep
  // their `amountPaidMinorUnits` / `paymentStatus` (`PARTIALLY_PAID` / `PAID`)
  // unchanged, with no ledger behind them.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS "count" FROM "invoice_entity" WHERE "paymentStatus" IN ('OVERPAID', 'REFUNDED')`,
    )) as { count: number }[];
    if (count > 0) {
      throw new Error(
        `CreatePayments down() refused: ${count} invoice(s) hold paymentStatus OVERPAID or REFUNDED, which the previous invoice_payment_status_enum cannot represent. No data is rewritten; change those invoices by hand first.`,
      );
    }

    await queryRunner.query(`DROP TABLE "payment_entity"`);
    await queryRunner.query(`DROP TYPE "public"."payment_record_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "admin_user_entity" DROP CONSTRAINT "uq_admin_user_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" DROP CONSTRAINT "uq_invoice_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."invoice_payment_status_enum" RENAME TO "invoice_payment_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_payment_status_enum" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID')`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ALTER COLUMN "paymentStatus" TYPE "public"."invoice_payment_status_enum" USING "paymentStatus"::text::"public"."invoice_payment_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."invoice_payment_status_enum_old"`,
    );
  }
}
