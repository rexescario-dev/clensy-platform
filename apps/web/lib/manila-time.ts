// Manila-time helpers for the payment `paidAt` field (planning decision g).
// `Asia/Manila` is a fixed UTC+8 with no DST, so a `datetime-local` value
// (`YYYY-MM-DDTHH:mm`) maps to an instant by appending `:00+08:00`. No date
// library is used.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// 'YYYY-MM-DDTHH:mm' wall-clock value in Asia/Manila for the given instant.
export function toManilaDateTimeLocal(instant: Date | string): string {
  const shifted = new Date(new Date(instant).getTime() + MANILA_OFFSET_MS);
  return shifted.toISOString().slice(0, 16);
}

// '…T…:00+08:00' for a 'YYYY-MM-DDTHH:mm' value, or null for any other shape.
export function manilaDateTimeLocalToIso(value: string): string | null {
  if (!DATETIME_LOCAL.test(value)) {
    return null;
  }
  return `${value}:00+08:00`;
}

const manilaFormatter = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  hour: 'numeric',
  hour12: true,
  minute: '2-digit',
  month: 'short',
  timeZone: 'Asia/Manila',
  year: 'numeric',
});

export function formatManilaDateTime(instant: Date | string): string {
  return manilaFormatter.format(new Date(instant));
}
