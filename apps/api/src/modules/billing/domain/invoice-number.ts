// Renders the human-readable invoice number `INV-{issueYear}-{NNNNNN}`
// (spec §3, §4.5). `issueYear` is presentation only — the caller resolves
// it as the `Asia/Manila` calendar year of `issueDate` (see
// `InvoicesService.resolveIssueYear`); the backing PostgreSQL sequence is
// global and never resets, so `INV-2027-000101` legitimately follows
// `INV-2026-000100`. Padding is to six digits; a value above 999999 simply
// renders more digits.
export function formatInvoiceNumber(
  sequenceValue: number,
  issueYear: number,
): string {
  return `INV-${issueYear}-${String(sequenceValue).padStart(6, '0')}`;
}

// The `Asia/Manila` calendar year of a UTC instant (spec §3, §4.5). The
// platform operates in one locale; an invoice issued at 00:30 Manila on
// 1 January belongs to the new year in the books even though its UTC
// instant is still 31 December. `Asia/Manila` is a fixed UTC+8 with no DST,
// so `Intl` with the IANA zone is exact.
export function resolveManilaYear(issueDate: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
    }).format(issueDate),
  );
}
