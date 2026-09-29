import { EntityManager } from 'typeorm';

// Per-tenant, concurrency-safe invoice-number allocation (#87 slice
// decision 9; RFC §4.4, invariant 5). MUST run on the generate
// transaction's manager: the upsert's row lock on the tenant's counter is
// held until commit, so concurrent generates in one tenant serialize and
// get distinct values, and a rolled-back generate rolls its increment back.
// Not read-then-increment. `invoice_number_counter` is hand-written in
// `AddLaundryBillingTenant` and has no entity.
const ALLOCATE_SQL =
  'INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1) ON CONFLICT ("tenantId") DO UPDATE SET "lastValue" = "invoice_number_counter"."lastValue" + 1 RETURNING "lastValue"';

export async function allocateInvoiceNumber(
  manager: EntityManager,
  tenantId: string,
): Promise<number> {
  const rows = await manager.query<Array<{ lastValue: string }>>(ALLOCATE_SQL, [
    tenantId,
  ]);
  if (rows.length !== 1) {
    throw new Error(
      `Invoice number counter returned ${rows.length} rows for tenant ${tenantId}`,
    );
  }
  // `bigint` arrives as a string. The contract is a positive JavaScript
  // safe integer (slice decisions 9, 10); the table CHECK bounds it too.
  const value = Number(rows[0].lastValue);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      `Invoice number counter out of range for tenant ${tenantId}: ${rows[0].lastValue}`,
    );
  }
  return value;
}
