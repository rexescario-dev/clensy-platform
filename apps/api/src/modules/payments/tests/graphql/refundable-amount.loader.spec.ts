import {
  createRefundableBatchFn,
  RefundableAmountLoader,
} from '../../presentation/graphql/refundable-amount.loader';

// The batch function is exported standalone (the `ActivePricingLoader`
// precedent) so ordering and gap-filling are asserted without reaching into
// `DataLoader` internals.
describe('createRefundableBatchFn (#39 decision d)', () => {
  it('returns values in key order and maps ids absent from the service map to null', async () => {
    const service = {
      refundableByPaymentIds: jest.fn().mockResolvedValue(
        new Map([
          ['p-2', 0],
          ['p-1', 700],
        ]),
      ),
    };
    const batchFn = createRefundableBatchFn(service, 't-a');
    await expect(batchFn(['p-1', 'missing', 'p-2'])).resolves.toEqual([
      700,
      null,
      0,
    ]);
    expect(service.refundableByPaymentIds).toHaveBeenCalledWith(
      ['p-1', 'missing', 'p-2'],
      't-a',
    );
  });

  it('null tenant resolves every key to null without calling the service', async () => {
    const service = { refundableByPaymentIds: jest.fn() };
    const batchFn = createRefundableBatchFn(service, null);
    await expect(batchFn(['a', 'b'])).resolves.toEqual([null, null]);
    expect(service.refundableByPaymentIds).not.toHaveBeenCalled();
  });
});

describe('RefundableAmountLoader.loaderFor', () => {
  it('returns one DataLoader per tenant id, memoized for the request', () => {
    const loaders = new RefundableAmountLoader({
      refundableByPaymentIds: jest.fn(),
    } as never);
    expect(loaders.loaderFor('t-a')).toBe(loaders.loaderFor('t-a'));
    expect(loaders.loaderFor('t-a')).not.toBe(loaders.loaderFor('t-b'));
    expect(loaders.loaderFor(null)).toBe(loaders.loaderFor(null));
  });

  it('batches loads within one tenant into one tenant-scoped call', async () => {
    const refundableByPaymentIds = jest.fn().mockResolvedValue(new Map());
    const loaders = new RefundableAmountLoader({
      refundableByPaymentIds,
    } as never);
    const loader = loaders.loaderFor('t-a');
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(refundableByPaymentIds).toHaveBeenCalledTimes(1);
    expect(refundableByPaymentIds).toHaveBeenCalledWith(['a', 'b'], 't-a');
  });
});
