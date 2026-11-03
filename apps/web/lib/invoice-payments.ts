import type { InvoicePaymentStatus, PaymentType, Role } from '@clensy/client';
import { toEditableAmount } from './format-price';

// Pure rules for the invoice payments panel (#39, spec §4.10). The server is
// authoritative for roles and amounts; these mirror it for the UI only.

export const MAX_MINOR_UNITS = 2147483647;

// Spec §4.7.
export const RECORD_PAYMENT_ROLES: readonly Role[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT'];
export const REFUND_PAYMENT_ROLES: readonly Role[] = ['TENANT_OWNER', 'FINANCE'];

export type RecordedBy = { email: string; kind: 'email' } | { kind: 'staff' } | { kind: 'you' };

export type AmountDueView = { kind: 'due'; minorUnits: number } | { kind: 'overpaid'; minorUnits: number };

export type ParsedPaymentAmount =
  | { error: 'invalid' | 'overRefundable' | 'tooLarge' | 'zero'; ok: false }
  | { minorUnits: number; ok: true };

const PESOS = /^(\d+)(?:\.(\d{1,2}))?$/;
// More digits than MAX_SAFE_INTEGER has can never be an amount in range, and
// must not reach `parseInt`, which would round them.
const SAFE_DIGITS = String(Number.MAX_SAFE_INTEGER).length - 1;

export function amountDueView(amountDueMinorUnits: number): AmountDueView {
  return amountDueMinorUnits < 0
    ? { kind: 'overpaid', minorUnits: -amountDueMinorUnits }
    : { kind: 'due', minorUnits: amountDueMinorUnits };
}

export function canRecordPayment(role: Role | undefined, status: InvoicePaymentStatus): boolean {
  return role !== undefined && status !== 'VOID' && RECORD_PAYMENT_ROLES.includes(role);
}

export function canRefundPayment(
  role: Role | undefined,
  status: InvoicePaymentStatus,
  payment: { refundableMinorUnits: number | null; type: PaymentType },
): boolean {
  return (
    role !== undefined &&
    status !== 'VOID' &&
    REFUND_PAYMENT_ROLES.includes(role) &&
    payment.type === 'PAYMENT' &&
    (payment.refundableMinorUnits ?? 0) > 0
  );
}

// Concatenates pages in order and keeps the first occurrence of each id
// (planning decision h): a concurrent insert can repeat a row on a later
// page, never skip one.
export function mergePaymentPages<T extends { id: string }>(pages: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  }
  return merged;
}

// A client-invented idempotency key (spec §4.5, planning decision q).
// `randomUUID` exists only in secure contexts; `getRandomValues` everywhere.
export function newIdempotencyKey(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// `maxMinorUnits` is MAX_MINOR_UNITS for a payment and the refundable amount
// for a refund. Above MAX_MINOR_UNITS is `tooLarge`; above a lower cap is
// `overRefundable`.
export function parsePaymentAmount(input: string, maxMinorUnits: number): ParsedPaymentAmount {
  const match = PESOS.exec(input.trim());
  if (!match) return { error: 'invalid', ok: false };
  const [, whole = '', fraction = ''] = match;
  const digits = (whole + fraction.padEnd(2, '0')).replace(/^0+/, '');
  if (digits === '') return { error: 'zero', ok: false };
  if (digits.length > SAFE_DIGITS) return { error: 'tooLarge', ok: false };
  const minorUnits = parseInt(digits, 10);
  if (minorUnits > MAX_MINOR_UNITS) return { error: 'tooLarge', ok: false };
  // Only a refund's cap is below MAX_MINOR_UNITS.
  if (minorUnits > maxMinorUnits) return { error: 'overRefundable', ok: false };
  return { minorUnits, ok: true };
}

// The record dialog's amount: the due when positive, otherwise blank (a
// negative would format as an unparseable `−…`).
export function recordAmountPrefill(amountDueMinorUnits: number): string {
  return amountDueMinorUnits > 0 ? toEditableAmount(amountDueMinorUnits) : '';
}

// Spec §4.10 "Recorded by": the viewer's own rows, then a staff email for a
// TENANT_OWNER (the only role that can read `admins`), else a generic label.
export function recordedByLabel(input: {
  recordedByStaffId: string | null;
  staffEmails: ReadonlyMap<string, string> | undefined;
  viewerId: string | undefined;
  viewerRole: Role | undefined;
}): RecordedBy {
  const { recordedByStaffId, staffEmails, viewerId, viewerRole } = input;
  if (recordedByStaffId === null) return { kind: 'staff' };
  if (viewerId !== undefined && recordedByStaffId === viewerId) return { kind: 'you' };
  const email = viewerRole === 'TENANT_OWNER' ? staffEmails?.get(recordedByStaffId) : undefined;
  return email === undefined ? { kind: 'staff' } : { email, kind: 'email' };
}
