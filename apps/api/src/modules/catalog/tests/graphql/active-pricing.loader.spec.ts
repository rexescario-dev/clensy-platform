import {
  ActivePricingLoader,
  createActivePricingBatchFn,
} from '../../presentation/graphql/active-pricing.loader';
import { PricingRule } from '../../domain/pricing-rule';
import { PricingUnit } from '../../domain/pricing-unit';

// Unit test for the loader's batch function in isolation (task brief).
// `DataLoader` normally dedupes/coalesces calls within a tick, so this test
// calls the standalone `createActivePricingBatchFn` factory directly (the
// same standalone-exported-batch-function technique the Cleaners plan's M8
// refactor established for `createTeamBatchFn`/`createTeamCleanersBatchFn`)
// to assert ordering/gap-filling precisely and deterministically, without
// reaching into `DataLoader`'s private `_batchLoadFn` property.

function makeRule(serviceId: string): PricingRule {
  return {
    id: `rule-${serviceId}`,
    addOnId: null,
    serviceId,
    tenantId: 't-a',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: null,
    minimumChargeMinorUnits: null,
    priceMinorUnits: 1000,
    unit: PricingUnit.FLAT,
  };
}

// `tenantId` comes from the resolver (`@CurrentUser()`), never from ambient
// request state (#84 slice decision 7). `null` — no tenant scope — resolves
// every key to null without touching the service.
describe('createActivePricingBatchFn (#84 tenant scope)', () => {
  it('asks the service for the ids within the given tenant and maps misses to null', async () => {
    const rule = makeRule('s-a');
    const pricingRulesService = {
      getActivePricingForServiceIds: jest.fn().mockResolvedValue([rule]),
    };
    const batchFn = createActivePricingBatchFn(pricingRulesService, 't-a');
    await expect(batchFn(['s-a', 'foreign'])).resolves.toEqual([rule, null]);
    expect(
      pricingRulesService.getActivePricingForServiceIds,
    ).toHaveBeenCalledWith(['s-a', 'foreign'], 't-a');
  });

  it('null tenant resolves every key to null without calling the service', async () => {
    const pricingRulesService = { getActivePricingForServiceIds: jest.fn() };
    const batchFn = createActivePricingBatchFn(pricingRulesService, null);
    await expect(batchFn(['a', 'b'])).resolves.toEqual([null, null]);
    expect(
      pricingRulesService.getActivePricingForServiceIds,
    ).not.toHaveBeenCalled();
  });
});

describe('ActivePricingLoader.loaderFor', () => {
  it('returns one DataLoader per tenant id, memoized for the request', () => {
    const loaders = new ActivePricingLoader({
      getActivePricingForServiceIds: jest.fn(),
    } as never);
    expect(loaders.loaderFor('t-a')).toBe(loaders.loaderFor('t-a'));
    expect(loaders.loaderFor('t-a')).not.toBe(loaders.loaderFor('t-b'));
    expect(loaders.loaderFor(null)).toBe(loaders.loaderFor(null));
  });

  it('batches loads within one tenant into one tenant-scoped call', async () => {
    const getActivePricingForServiceIds = jest.fn().mockResolvedValue([]);
    const loaders = new ActivePricingLoader({
      getActivePricingForServiceIds,
    } as never);
    const loader = loaders.loaderFor('t-a');
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(getActivePricingForServiceIds).toHaveBeenCalledTimes(1);
    expect(getActivePricingForServiceIds).toHaveBeenCalledWith(
      ['a', 'b'],
      't-a',
    );
  });
});
