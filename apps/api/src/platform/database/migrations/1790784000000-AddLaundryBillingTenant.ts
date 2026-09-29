import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for LaundryOrder, LaundryOrderLine and Invoice (#87; RFC
// §4.4, §4.5, §4.7). InvoiceLine is owned via its Invoice and is not touched
// (#87 slice decision 2). Step order is load-bearing and the whole migration
// runs in one transaction (TypeORM CLI default `migrationsTransactionMode:
// 'all'`):
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on the three tables.
//   2. Backfill: orders and invoices to the bootstrap tenant; lines from
//      their order.
//   3. Validate backfill completeness, tenant-consistent references and
//      invoice numbers (slice decisions 10, 12). Fails closed; the
//      transaction rolls back.
//   4. NOT NULL + FK to `tenant_entity` (ON DELETE RESTRICT) on the three.
//   5. `UNIQUE (id, "tenantId")` on laundry orders — target of the line and
//      invoice composite FKs (slice decision 13).
//   6. Replace each id-only parent FK with its composite `(refId,
//      "tenantId")` FK in the same step, keeping its ON DELETE action (slice
//      decision 4). MATCH SIMPLE: the null side of a line's service/add-on
//      pair is not checked; `ck_laundry_order_line_target` keeps exactly one
//      side non-null.
//   7. Per-tenant invoice numbering (slice decisions 9, 10): per-tenant
//      unique, counter table seeded from the max existing suffix, global
//      sequence dropped.
//   8. Tenant-leading indexes matching the root default sorts.
const PARENT_FKS = [
  [
    'laundry_order_entity',
    'fk_laundry_order_customer',
    'fk_laundry_order_customer_tenant',
    'customerId',
    'customer_entity',
    'RESTRICT',
  ],
  [
    'laundry_order_line_entity',
    'fk_laundry_order_line_order',
    'fk_laundry_order_line_order_tenant',
    'laundryOrderId',
    'laundry_order_entity',
    'CASCADE',
  ],
  [
    'laundry_order_line_entity',
    'fk_laundry_order_line_service',
    'fk_laundry_order_line_service_tenant',
    'serviceId',
    'service_entity',
    'RESTRICT',
  ],
  [
    'laundry_order_line_entity',
    'fk_laundry_order_line_add_on',
    'fk_laundry_order_line_add_on_tenant',
    'addOnId',
    'add_on_entity',
    'RESTRICT',
  ],
  [
    'invoice_entity',
    'fk_invoice_laundry_order',
    'fk_invoice_laundry_order_tenant',
    'laundryOrderId',
    'laundry_order_entity',
    'RESTRICT',
  ],
  [
    'invoice_entity',
    'fk_invoice_customer',
    'fk_invoice_customer_tenant',
    'customerId',
    'customer_entity',
    'RESTRICT',
  ],
] as const;

const TENANT_FKS = [
  ['laundry_order_entity', 'fk_laundry_order_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_tenant'],
  ['invoice_entity', 'fk_invoice_tenant'],
] as const;

const INVOICE_NUMBER_PATTERN = '^INV-[0-9]{4}-[0-9]{6,}$';
// The allocator's contract (slice decisions 9, 10): JavaScript safe integers.
const MAX_INVOICE_SUFFIX = '9007199254740991';
const SUFFIX = `split_part("invoiceNumber", '-', 3)`;

// The class MUST stay this module's first export: `test/helpers/migration-db.ts`
// loads each migration as `Object.values(require(file))[0]`.
export class AddLaundryBillingTenant1790784000000 implements MigrationInterface {
  name = 'AddLaundryBillingTenant1790784000000';

  // Step 3 checks that need the post-backfill state (slice decision 12, F3,
  // F5). Static so the migration e2e can exercise the branches no pre-`up`
  // data can reach. Tenant mismatch only: the id-only parent FKs are still in
  // place here and already guarantee every non-null reference exists.
  static async validateBackfill(queryRunner: QueryRunner): Promise<string[]> {
    const problems: string[] = [];
    for (const [table] of TENANT_FKS) {
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "${table}" WHERE "tenantId" IS NULL`,
      )) as { count: number }[];
      if (count > 0) {
        problems.push(
          `${table}: ${count} row(s) without a tenant after backfill`,
        );
      }
    }
    for (const [table, column, parent, label] of [
      [
        'laundry_order_entity',
        'customerId',
        'customer_entity',
        'laundry order(s) reference a customer',
      ],
      [
        'laundry_order_line_entity',
        'laundryOrderId',
        'laundry_order_entity',
        'laundry line(s) reference an order',
      ],
      [
        'laundry_order_line_entity',
        'serviceId',
        'service_entity',
        'laundry line(s) reference a service',
      ],
      [
        'laundry_order_line_entity',
        'addOnId',
        'add_on_entity',
        'laundry line(s) reference an add-on',
      ],
      [
        'invoice_entity',
        'laundryOrderId',
        'laundry_order_entity',
        'invoice(s) reference a laundry order',
      ],
      [
        'invoice_entity',
        'customerId',
        'customer_entity',
        'invoice(s) reference a customer',
      ],
    ] as const) {
      // An inner join skips NULL references (the unused side of a line).
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "${table}" c JOIN "${parent}" p ON p."id" = c."${column}" WHERE p."tenantId" <> c."tenantId"`,
      )) as { count: number }[];
      if (count > 0) {
        problems.push(`${count} ${label} in another tenant`);
      }
    }
    return problems;
  }

  // Slice decision 10 (F7): every number parses, every suffix fits the
  // allocator's range (compared as `numeric` — an oversized digit string
  // would overflow a `bigint` cast), and no suffix (the allocation value;
  // the year is presentation only) repeats within a tenant.
  private static async validateInvoiceNumbers(
    queryRunner: QueryRunner,
  ): Promise<string[]> {
    const [{ malformed }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS "malformed" FROM "invoice_entity" WHERE "invoiceNumber" !~ $1`,
      [INVOICE_NUMBER_PATTERN],
    )) as { malformed: number }[];
    if (malformed > 0) {
      return [`${malformed} invoice(s) do not match the invoice number format`];
    }
    const [{ outOfRange }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS "outOfRange" FROM "invoice_entity" WHERE ${SUFFIX}::numeric NOT BETWEEN 1 AND ${MAX_INVOICE_SUFFIX}`,
    )) as { outOfRange: number }[];
    if (outOfRange > 0) {
      return [
        `${outOfRange} invoice number suffix out of range (1..${MAX_INVOICE_SUFFIX})`,
      ];
    }
    const [{ duplicates }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS "duplicates" FROM (SELECT 1 FROM "invoice_entity" GROUP BY "tenantId", ${SUFFIX}::bigint HAVING COUNT(*) > 1) d`,
    )) as { duplicates: number }[];
    return duplicates > 0
      ? [`${duplicates} duplicate invoice number suffix(es) within a tenant`]
      : [];
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddLaundryBillingTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    for (const [table] of TENANT_FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "tenantId" uuid`);
    }
    await queryRunner.query(
      `UPDATE "laundry_order_entity" SET "tenantId" = $1`,
      [BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(
      `UPDATE "laundry_order_line_entity" l SET "tenantId" = o."tenantId" FROM "laundry_order_entity" o WHERE o."id" = l."laundryOrderId"`,
    );
    await queryRunner.query(`UPDATE "invoice_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);

    const problems = [
      ...(await AddLaundryBillingTenant1790784000000.validateBackfill(
        queryRunner,
      )),
      ...(await AddLaundryBillingTenant1790784000000.validateInvoiceNumbers(
        queryRunner,
      )),
    ];
    if (problems.length > 0) {
      throw new Error(`AddLaundryBillingTenant: ${problems.join('; ')}`);
    }

    for (const [table, fk] of TENANT_FKS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "laundry_order_entity" ADD CONSTRAINT "uq_laundry_order_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    for (const [
      table,
      oldName,
      newName,
      column,
      parent,
      onDelete,
    ] of PARENT_FKS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${oldName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${newName}" FOREIGN KEY ("${column}", "tenantId") REFERENCES "${parent}"("id", "tenantId") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "invoice_entity" DROP CONSTRAINT "uq_invoice_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "uq_invoice_tenant_number" UNIQUE ("tenantId", "invoiceNumber")`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_number_counter" ("tenantId" uuid NOT NULL, "lastValue" bigint NOT NULL DEFAULT 0, CONSTRAINT "pk_invoice_number_counter" PRIMARY KEY ("tenantId"), CONSTRAINT "ck_invoice_number_counter_range" CHECK ("lastValue" BETWEEN 0 AND ${MAX_INVOICE_SUFFIX}), CONSTRAINT "fk_invoice_number_counter_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") SELECT "tenantId", MAX(${SUFFIX}::bigint) FROM "invoice_entity" GROUP BY "tenantId"`,
    );
    await queryRunner.query(`DROP SEQUENCE "billing_invoice_number_seq"`);

    await queryRunner.query(
      `CREATE INDEX "idx_laundry_order_tenant_created" ON "laundry_order_entity" ("tenantId", "createdAt" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_tenant_issue" ON "invoice_entity" ("tenantId", "issueDate" DESC, "createdAt" DESC, "id")`,
    );
  }

  // Reverses 8 → 1 (slice decision 15). Restores the original id-only FKs
  // and the global `uq_invoice_number`, and recreates a *usable*
  // `billing_invoice_number_seq` positioned after the highest remaining
  // suffix — not the exact pre-`up` sequence state, which `up` discards.
  // Re-adding the global unique fails, rolling the revert back, if two
  // tenants hold the same number string; it never renumbers.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_invoice_tenant_issue"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_laundry_order_tenant_created"`,
    );

    await queryRunner.query(`CREATE SEQUENCE "billing_invoice_number_seq"`);
    await queryRunner.query(
      `SELECT setval('billing_invoice_number_seq', m, true) FROM (SELECT MAX(${SUFFIX}::bigint) AS m FROM "invoice_entity") s WHERE m IS NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "invoice_number_counter"`);
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" DROP CONSTRAINT "uq_invoice_tenant_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_entity" ADD CONSTRAINT "uq_invoice_number" UNIQUE ("invoiceNumber")`,
    );

    for (const [table, oldName, newName, column, parent, onDelete] of [
      ...PARENT_FKS,
    ].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${newName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${oldName}" FOREIGN KEY ("${column}") REFERENCES "${parent}"("id") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "laundry_order_entity" DROP CONSTRAINT "uq_laundry_order_id_tenant"`,
    );
    for (const [table, fk] of [...TENANT_FKS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "tenantId"`);
    }
  }
}
