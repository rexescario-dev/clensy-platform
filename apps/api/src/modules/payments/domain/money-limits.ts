// The PostgreSQL `integer` maximum (spec §3): the column type of
// `Invoice.amountPaidMinorUnits` and `Payment.amountMinorUnits`. The largest
// supported value for any single amount and for net paid.
export const MAX_MINOR_UNITS = 2_147_483_647;
