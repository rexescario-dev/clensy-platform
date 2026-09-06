import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

// Constraint-scoped unique-violation check — copied verbatim from
// `modules/jobs`'s local helper (it is not exported from a shared location;
// `catalog` and `jobs` each carry their own). Accepts a `{ code, constraint }`
// driver shape so unit tests do not reconstruct a TypeORM `QueryFailedError`;
// also unwraps `QueryFailedError.driverError` for the real Postgres path.
//
// `generateInvoiceFromOrder` uses this ONLY for `uq_invoice_laundry_order`
// (an expected race -> `ConflictException`). A `uq_invoice_number` violation
// is an integrity failure, never a business conflict, and is rethrown as-is.
export function isPostgresUniqueViolation(
  error: unknown,
  constraint: string,
): boolean {
  const driver =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string; constraint?: string })
      : (error as { code?: string; constraint?: string });
  return (
    driver?.code === POSTGRES_UNIQUE_VIOLATION &&
    driver?.constraint === constraint
  );
}
