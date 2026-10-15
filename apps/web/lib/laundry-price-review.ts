import type { LaundryOrderQuery, PricingUnit } from '@clensy/client';
import type { LaundryOrderStatus, LaundryOrderVerb } from '@clensy/web';
import { laundryLineQuantity, type LaundryLineQuantity } from './laundry-order-page';
import { laundryRateKey, type LaundryPreviewLine, type LaundryRateKey } from './laundry-service-selection';

// What the Price section shows (#162 owner decision 5), in precedence
// order. A persisted total wins over status and role, so an order cancelled
// after pricing (§4.3 note 5) still shows its final price. Any status other
// than RECEIVED or WEIGHED without a total was never priced, and never falls
// through to the estimate. The estimate needs the `price` verb, which
// `laundryOrderActions` gives only to the operational roles on WEIGHED
// (§4.4); the status is checked as well, as in `laundryServicesView`.
export type LaundryPriceView = 'beforePricing' | 'estimate' | 'final' | 'hidden' | 'notPriced';

export interface LaundryPriceViewInput {
  // `order.totalMinorUnits !== null`, read from a finished, successful order
  // query (the page renders no order otherwise).
  hasTotal: boolean;
  // `currentAdmin.role` has loaded.
  roleResolved: boolean;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

export function laundryPriceView({ hasTotal, roleResolved, status, verbs }: LaundryPriceViewInput): LaundryPriceView {
  if (hasTotal) return 'final';
  if (status !== 'RECEIVED' && status !== 'WEIGHED') return 'notPriced';
  if (!roleResolved) return 'hidden';
  if (status === 'WEIGHED' && verbs.includes('price')) return 'estimate';
  return 'beforePricing';
}

// The Estimate card's state (#162 owner decision 3), most blocking first.
// Only the hook's `ready` makes it `ready`: that already requires a complete
// selection and a preview for the current key and newest request, with
// nothing loading and no error. A complete selection that is neither
// loading, failed nor ready cannot happen today; it shows `failed`, so Try
// again is a way out (planning decision f).
export type LaundryEstimateState = 'failed' | 'incomplete' | 'loading' | 'noBase' | 'ready';

export interface LaundryEstimateStateInput {
  // `useLaundryServiceSelection().complete`.
  complete: boolean;
  // A base service is chosen.
  hasBase: boolean;
  // `previewError !== null`.
  previewError: boolean;
  previewLoading: boolean;
  // `useLaundryServiceSelection().ready`.
  ready: boolean;
}

export function laundryEstimateState({
  complete,
  hasBase,
  previewError,
  previewLoading,
  ready,
}: LaundryEstimateStateInput): LaundryEstimateState {
  if (!hasBase) return 'noBase';
  if (!complete) return 'incomplete';
  if (previewLoading) return 'loading';
  if (previewError) return 'failed';
  return ready ? 'ready' : 'failed';
}

// One line of the breakdown, from the server only (§8.4.4: the client does
// not compute the amount). Formatting is left to the card.
export interface LaundryPriceRow {
  amountMinorUnits: number;
  key: string;
  // `null` unless the server applied a minimum charge; then the server's
  // minimum, which the type allows to be `null` (planning decision c).
  minimumCharge: { minorUnits: number | null } | null;
  name: string;
  quantity: LaundryLineQuantity;
  rateKey: LaundryRateKey;
  rateMinorUnits: number;
}

export type LaundrySnapshotLine = NonNullable<LaundryOrderQuery['laundryOrder']>['lines']['nodes'][number];

interface PricedLine {
  amountMinorUnits: number;
  description: string;
  minimumChargeApplied: boolean;
  minimumChargeMinorUnits: number | null;
  quantity: number;
  rateMinorUnits: number;
  unit: PricingUnit;
}

function priceRow(key: string, line: PricedLine): LaundryPriceRow {
  return {
    amountMinorUnits: line.amountMinorUnits,
    key,
    minimumCharge: line.minimumChargeApplied ? { minorUnits: line.minimumChargeMinorUnits } : null,
    name: line.description,
    quantity: laundryLineQuantity(line.unit, line.quantity),
    rateKey: laundryRateKey(line.unit),
    rateMinorUnits: line.rateMinorUnits,
  };
}

// Preview lines, in server order. Keyed by position: the server allows a
// repeated add-on (§8.4.3), so an id is not unique.
export function laundryPreviewRows(lines: readonly LaundryPreviewLine[]): LaundryPriceRow[] {
  return lines.map((line, index) => priceRow(`preview-${String(index)}`, line));
}

// Saved lines, by their frozen snapshot (§8.4.2), never re-read from the
// catalog.
export function laundrySnapshotRows(lines: readonly LaundrySnapshotLine[]): LaundryPriceRow[] {
  return lines.map((line) => priceRow(line.id, line.pricingSnapshot));
}
