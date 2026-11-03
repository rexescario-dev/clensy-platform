import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

// Constraint-scoped unique-violation check shared across modules (billing
// and payments use it; `catalog` and `jobs` still carry their own copies).
// Accepts a `{ code, constraint }` driver shape so unit tests do not
// reconstruct a TypeORM `QueryFailedError`; also unwraps
// `QueryFailedError.driverError` for the real Postgres path.
//
// Callers match one named constraint, so only an expected race becomes a
// business conflict (for example `uq_invoice_laundry_order`); any other
// unique violation, such as `uq_invoice_number`, is an integrity failure and
// is rethrown as-is.
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
