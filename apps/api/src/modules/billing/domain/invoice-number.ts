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
