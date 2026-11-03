import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PaymentsService } from '../../application/services/payments.service';

// Batch function for `Payment.refundableMinorUnits` (planning decision d),
// exported standalone so unit tests call it directly (the
// `ActivePricingLoader` precedent). One `refundableByPaymentIds` call — one
// grouped query over the payments and their completed refunds, both
// filtered by `tenantId` — per tenant per tick. An id absent from the
// service's map (not a COMPLETED PAYMENT of this tenant) resolves to null.
//
// `tenantId` comes from the resolver (`@CurrentUser()`), never from ambient
// request state. `null` — no tenant scope — resolves every key to null
// without touching the service.
export function createRefundableBatchFn(
  paymentsService: Pick<PaymentsService, 'refundableByPaymentIds'>,
  tenantId: string | null,
): DataLoader.BatchLoadFn<string, number | null> {
  return async (paymentIds) => {
    if (tenantId === null) {
      return paymentIds.map(() => null);
    }
    const refundable = await paymentsService.refundableByPaymentIds(
      [...paymentIds],
      tenantId,
    );
    return paymentIds.map((id) => refundable.get(id) ?? null);
  };
}

// Request-scoped: fresh DataLoader caches per GraphQL request, so a value
// never outlives the request (a refund in a later request is always seen).
// One DataLoader per tenant id, so a cached value is only ever served back
// to a caller of the tenant it was loaded for.
@Injectable({ scope: Scope.REQUEST })
export class RefundableAmountLoader {
  private readonly loaders = new Map<
    string | null,
    DataLoader<string, number | null>
  >();

  constructor(private readonly paymentsService: PaymentsService) {}

  loaderFor(tenantId: string | null): DataLoader<string, number | null> {
    let loader = this.loaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(
        createRefundableBatchFn(this.paymentsService, tenantId),
      );
      this.loaders.set(tenantId, loader);
    }
    return loader;
  }
}
