import type { PreviewLaundryOrderPriceQuery, PriceLaundryOrderInput, PricingUnit } from '@clensy/client';
import type { LaundryOrderStatus, LaundryOrderVerb } from '@clensy/web';
import { isUuid } from './laundry-order-list-query';
import { LAUNDRY_PRICED_STATUSES } from './laundry-order-page';

// What the Services section shows (owner decision 4, #158). The editor
// only when the actor may price (`laundryOrderActions` already intersects
// WEIGHED with the operational roles, spec §4.4). Nothing on a WEIGHED
// order until the role is known, so read-only copy never flashes before
// the editor. CANCELLED and REJECTED never show the locked sentence: the
// status alone does not prove pricing (#155 decision a).
export type LaundryServicesView = 'beforeWeigh' | 'editor' | 'hidden' | 'lines' | 'locked' | 'none';

export interface LaundryServicesViewInput {
  // The order has saved (priced) lines.
  hasLines: boolean;
  // `currentAdmin.role` has loaded.
  roleResolved: boolean;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

export function laundryServicesView({ hasLines, roleResolved, status, verbs }: LaundryServicesViewInput): LaundryServicesView {
  // The status is checked as well as the verb (M5 part 2): the editor can
  // never appear outside WEIGHED, even if the client verb table changes.
  if (status === 'WEIGHED' && verbs.includes('price')) return 'editor';
  if (status === 'WEIGHED' && !roleResolved) return 'hidden';
  if (status === 'WEIGHED') return 'none';
  if (status === 'RECEIVED') return 'beforeWeigh';
  if (LAUNDRY_PRICED_STATUSES.has(status)) return 'locked';
  return hasLines ? 'lines' : 'none';
}

export interface LaundryCatalogChoice {
  id: string;
  name: string;
}

// One add-on row. `key` is stable for the row's life, so removing a row
// never moves another row's text, choice or errors (owner decision 5).
export interface LaundryAddOnRow {
  choice: LaundryCatalogChoice | null;
  // The last choice was already on another row (§8.4.3: presentation only).
  duplicate: boolean;
  key: number;
  // Item-count text; shown only for a remembered PER_ITEM unit.
  quantity: string;
  quantityTouched: boolean;
  // The search text.
  query: string;
  // The search was left at least once.
  touched: boolean;
}

export interface LaundryServiceSelection {
  addOns: readonly LaundryAddOnRow[];
  base: LaundryCatalogChoice | null;
  baseQuantity: string;
  baseQuantityTouched: boolean;
  baseQuery: string;
  baseTouched: boolean;
}

export const EMPTY_LAUNDRY_SERVICE_SELECTION: LaundryServiceSelection = {
  addOns: [],
  base: null,
  baseQuantity: '1',
  baseQuantityTouched: false,
  baseQuery: '',
  baseTouched: false,
};

export type LaundryLineKind = 'addOn' | 'service';

// The unit the server last reported for a line, by kind and id (owner
// decision 6). A presentation hint for which input to show, never
// evidence of a current price.
export type LaundryRememberedUnits = Readonly<Record<string, PricingUnit>>;

export function laundryUnitKey(kind: LaundryLineKind, id: string): string {
  return `${kind}:${id}`;
}

// The GraphQL `Int` maximum; a larger count cannot be sent (planning decision a).
const MAX_ITEM_COUNT = 2_147_483_647;

// A whole number of items, at least 1: ASCII digits only, no trim
// (#155 decision d). `null` for anything else.
export function parseItemCount(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_ITEM_COUNT ? value : null;
}

// The preview input for the current selection, or `null` when it must not
// be sent: no base service, or an invalid count on a line remembered as
// PER_ITEM. A count goes only with a remembered PER_ITEM unit (§4.5 step
// 3a; issue Fields). A row with no choice is left out; it blocks `ready`
// in the hook instead (owner decision 6).
export function previewInputFromSelection(
  orderId: string,
  selection: LaundryServiceSelection,
  units: LaundryRememberedUnits,
): PriceLaundryOrderInput | null {
  const { base } = selection;
  if (!base) return null;
  let baseQuantity: number | undefined;
  if (units[laundryUnitKey('service', base.id)] === 'PER_ITEM') {
    const count = parseItemCount(selection.baseQuantity);
    if (count === null) return null;
    baseQuantity = count;
  }
  const addOns: PriceLaundryOrderInput['addOns'] = [];
  for (const row of selection.addOns) {
    if (!row.choice) continue;
    if (units[laundryUnitKey('addOn', row.choice.id)] === 'PER_ITEM') {
      const count = parseItemCount(row.quantity);
      if (count === null) return null;
      addOns.push({ addOnId: row.choice.id, quantity: count });
    } else {
      addOns.push({ addOnId: row.choice.id });
    }
  }
  return baseQuantity === undefined
    ? { baseServiceId: base.id, orderId, addOns }
    : { baseServiceId: base.id, orderId, addOns, baseQuantity };
}

export type LaundryPreview = PreviewLaundryOrderPriceQuery['previewLaundryOrderPrice'];
export type LaundryPreviewLine = LaundryPreview['lines'][number];

export interface LaundryMatchedPreview {
  // Add-on lines by row key, for rows with a choice.
  addOns: ReadonlyMap<number, LaundryPreviewLine>;
  base: LaundryPreviewLine;
  estimatedTotalMinorUnits: number;
  // In server order, for the price review (#162).
  lines: readonly LaundryPreviewLine[];
}

// Line correspondence only (M5 part 2): the server returns the base line,
// then one line per `addOns` entry in input order (spec §8.4.5; the shared
// quote path). Each line is matched by position and by kind and id to
// `input`, and each chosen row (in row order) must carry that same id, so
// the result can be keyed by row. Any mismatch rejects the whole preview
// (owner decision 6).
//
// It does NOT decide that `input` is the current input: it compares no
// quantity, order id or weight. The caller must pass only a preview whose
// request input and order weight are exactly the current ones.
// `useLaundryServiceSelection` does this with its `[weightGrams, input]`
// key (Task 4 cases 13, 14 and 19).
//
// `previewCorresponds` needs only the submitted input, so the hook checks
// it when the response arrives, before the response can change any state
// (M5 part 4 P1). `matchPreview` re-checks it, then keys the lines by row.
export function previewCorresponds(input: PriceLaundryOrderInput, preview: LaundryPreview): boolean {
  if (preview.lines.length !== 1 + input.addOns.length) return false;
  const [base, ...rest] = preview.lines;
  if (!base || base.serviceId !== String(input.baseServiceId) || base.addOnId !== null) return false;
  return input.addOns.every((sent, index) => {
    const line = rest[index];
    return line !== undefined && line.serviceId === null && line.addOnId === String(sent.addOnId);
  });
}

export function matchPreview(
  input: PriceLaundryOrderInput,
  selection: LaundryServiceSelection,
  preview: LaundryPreview,
): LaundryMatchedPreview | null {
  if (!previewCorresponds(input, preview)) return null;
  const chosen = selection.addOns.filter((row) => row.choice !== null);
  if (chosen.length !== input.addOns.length) return null;
  const [base, ...rest] = preview.lines;
  if (!base) return null;
  const addOns = new Map<number, LaundryPreviewLine>();
  for (const [index, row] of chosen.entries()) {
    const line = rest[index];
    if (!line || row.choice?.id !== line.addOnId) return null;
    addOns.set(row.key, line);
  }
  return { addOns, base, estimatedTotalMinorUnits: preview.estimatedTotalMinorUnits, lines: preview.lines };
}

export type LaundryMissingPriceTarget = { key: number; kind: 'addOn' } | { kind: 'service' };

// The quote path's missing-price message (laundry-orders.service.ts,
// `No effective price for ${column} ${id}`). Matched only exactly, with a
// UUID that equals the selected line of that kind; otherwise `null`, and
// the caller shows the raw text (owner decision 2). Never a guess.
const MISSING_PRICE = /^No effective price for (serviceId|addOnId) (\S+)$/;

// More than one row holding the id cannot happen through the editor
// (duplicates are blocked), but the server allows repeats (§8.4.3) and this
// module is pure. With no unique row, it declines rather than marking the
// first one (M5 part 2 suggestion 2).
export function missingPriceTarget(message: string, selection: LaundryServiceSelection): LaundryMissingPriceTarget | null {
  const match = MISSING_PRICE.exec(message);
  if (!match) return null;
  const [, column, id] = match;
  if (!isUuid(id)) return null;
  if (column === 'serviceId') return selection.base?.id === id ? { kind: 'service' } : null;
  const rows = selection.addOns.filter((candidate) => candidate.choice?.id === id);
  return rows.length === 1 ? { key: rows[0].key, kind: 'addOn' } : null;
}

export type LaundryRateKey = 'flat' | 'perItem' | 'perKg';

// The rate phrase's copy key (issue Fields: "{price} per kg", "{price} per
// item", "{price} flat").
export function laundryRateKey(unit: PricingUnit): LaundryRateKey {
  if (unit === 'PER_KG') return 'perKg';
  if (unit === 'PER_ITEM') return 'perItem';
  return 'flat';
}
