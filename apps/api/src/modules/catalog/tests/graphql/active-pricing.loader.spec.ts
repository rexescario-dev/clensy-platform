import { createActivePricingBatchFn } from '../../presentation/graphql/active-pricing.loader';
import { PricingRule } from '../../domain/pricing-rule';

// Unit test for the loader's batch function in isolation (task brief).
// `DataLoader` normally dedupes/coalesces calls within a tick, so this test
// calls the standalone `createActivePricingBatchFn` factory directly (the
// same standalone-exported-batch-function technique the Cleaners plan's M8
// refactor established for `createTeamBatchFn`/`createTeamCleanersBatchFn`)
// to assert ordering/gap-filling precisely and deterministically, without
// reaching into `DataLoader`'s private `_batchLoadFn` property.

function makeRule(id: string, serviceId: string): PricingRule {
  return {
    id,
    serviceId,
    priceMinorUnits: 1000,
    active: true,
    createdAt: new Date(),
  };
}

describe('ActivePricingLoader', () => {
  describe('createActivePricingBatchFn', () => {
    it('returns [rule_a, null, rule_c] in input-key order when the bulk result covers only a and c', async () => {
      const ruleA = makeRule('rule-a', 'a');
      const ruleC = makeRule('rule-c', 'c');
      const pricingRulesService = {
        getActivePricingForServiceIds: jest
          .fn()
          .mockResolvedValue([ruleA, ruleC]),
      };

      const batchFn = createActivePricingBatchFn(pricingRulesService);

      const result = await batchFn(['a', 'b', 'c']);

      expect(
        pricingRulesService.getActivePricingForServiceIds,
      ).toHaveBeenCalledWith(['a', 'b', 'c']);
      expect(result).toEqual([ruleA, null, ruleC]);
    });
  });
});
