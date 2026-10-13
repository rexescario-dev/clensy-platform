import type { PricingUnit } from '@clensy/client';
import { formatWeightGrams, type LaundryOrderStatus, type LaundryOrderVerb } from '@clensy/web';
import { isUuid } from './laundry-order-list-query';

// The order page's sections, in page and nav order (#156). Later issues
// fill Weighing (#155), Services (#158), Price (#162), Invoice (#166) and
// Actions (#165).
export const LAUNDRY_ORDER_SECTIONS = ['overview', 'weighing', 'services', 'price', 'invoice', 'actions'] as const;

export type LaundryOrderSection = (typeof LAUNDRY_ORDER_SECTIONS)[number];

export function laundryOrderSectionId(section: LaundryOrderSection): string {
  return `laundry-order-${section}`;
}

export function laundryOrderHref(id: string): string {
  return `/app/laundry/${encodeURIComponent(id)}`;
}

// Where `/app/laundry?<search>` should go (lifecycle spec §8.4.4): `null`
// with no `detail` param; the order page for a UUID-shaped `detail`; and
// otherwise the list without `detail`, keeping every other list param.
// Not wired in yet: #161 replaces the drawer with this at cutover.
export function laundryDetailRedirectHref(search: string | URLSearchParams): string | null {
  const params = new URLSearchParams(search);
  if (!params.has('detail')) return null;
  const id = params.get('detail') ?? '';
  if (isUuid(id)) return laundryOrderHref(id);
  params.delete('detail');
  const rest = params.toString();
  return rest === '' ? '/app/laundry' : `/app/laundry?${rest}`;
}

// A query's data only once it has finished without an error. Apollo can
// keep earlier `data` while a query reloads or after it fails; that data is
// never the answer (M5 review 1), so the nav and the section it describes
// read the same value.
export function resolvedQueryData<T>(query: { data?: T; error?: unknown; loading: boolean }): T | undefined {
  return query.loading || query.error ? undefined : query.data;
}

// The invoice query's nodes, only from a finished, error-free result that
// carries the `invoices` connection with a `nodes` array. Anything else,
// including a result with no data or no connection, is unresolved
// (`undefined`), never "no invoice" (M5 review 3). The parameter type is
// looser than the generated result on purpose, so the checks below are
// real runtime checks and not flagged as unnecessary.
export function resolvedInvoiceNodes<T>(query: {
  data?: { invoices?: { nodes?: readonly T[] | null } | null } | null;
  error?: unknown;
  loading: boolean;
}): readonly T[] | undefined {
  const nodes = resolvedQueryData(query)?.invoices?.nodes;
  return Array.isArray(nodes) ? nodes : undefined;
}

// Verbs that the Weighing, Services and Invoice sections own. The Actions
// section names the rest.
const SECTION_VERBS: ReadonlySet<LaundryOrderVerb> = new Set<LaundryOrderVerb>(['weigh', 'price', 'generateInvoice']);

export function laundryLifecycleVerbs(verbs: readonly LaundryOrderVerb[]): LaundryOrderVerb[] {
  return verbs.filter((verb) => !SECTION_VERBS.has(verb));
}

export interface CurrentLaundryOrderSectionInput {
  // `undefined` unless `resolvedInvoiceNodes` returned a node list:
  // while loading (even with retained data), after an error, and for a
  // finished result without the invoice connection.
  invoiceExists: boolean | undefined;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

// The section the nav marks current: the next step forward the actor may
// take (owner decision, #156 M4). Re-weighing a WEIGHED order is a
// correction, so Weighing is current only while RECEIVED. Pricing starts
// with choosing services, so `price` marks Services. Overview and Price are
// never current. `null` when the actor has nothing to do.
export function currentLaundryOrderSection({
  invoiceExists,
  status,
  verbs,
}: CurrentLaundryOrderSectionInput): LaundryOrderSection | null {
  if (status === 'RECEIVED' && verbs.includes('weigh')) return 'weighing';
  if (verbs.includes('price')) return 'services';
  if (invoiceExists === false && verbs.includes('generateInvoice')) return 'invoice';
  if (laundryLifecycleVerbs(verbs).length > 0) return 'actions';
  return null;
}

export type LaundryLineQuantity = { kind: 'items' | 'weight'; value: string } | null;

// Lifecycle spec §8.4.4: a PER_KG line shows weight, a PER_ITEM line an
// item count, FLAT and PER_SERVICE no quantity. A PER_KG snapshot stores
// grams (§3).
export function laundryLineQuantity(unit: PricingUnit, quantity: number): LaundryLineQuantity {
  if (unit === 'PER_KG') return { kind: 'weight', value: formatWeightGrams(quantity) };
  if (unit === 'PER_ITEM') return { kind: 'items', value: String(quantity) };
  return null;
}
