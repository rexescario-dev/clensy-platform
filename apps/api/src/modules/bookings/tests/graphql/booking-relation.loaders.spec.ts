import {
  createCustomerBatchFn,
  createPropertyBatchFn,
  createServiceBatchFn,
  createTeamBatchFn,
} from '../../presentation/graphql/booking-relation.loaders';

// Unit tests for each batch function in isolation — same standalone-
// exported-function technique as `active-pricing.loader.spec.ts`/
// `cleaner-team.loaders.spec.ts`: ordering/gap-filling asserted precisely
// and deterministically, without reaching into `DataLoader`'s private
// `_batchLoadFn` property.
describe('BookingRelationLoaders batch functions', () => {
  it('createCustomerBatchFn returns [a, null, c] in input-key order when the bulk result covers only a and c', async () => {
    const customerA = { id: 'a' };
    const customerC = { id: 'c' };
    const customersService = {
      getCustomersByIds: jest.fn().mockResolvedValue([customerA, customerC]),
    };

    const result = await createCustomerBatchFn(customersService)([
      'a',
      'b',
      'c',
    ]);

    expect(customersService.getCustomersByIds).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([customerA, null, customerC]);
  });

  it('createPropertyBatchFn returns [a, null, c] in input-key order when the bulk result covers only a and c', async () => {
    const propertyA = { id: 'a' };
    const propertyC = { id: 'c' };
    const propertiesService = {
      getPropertiesByIds: jest.fn().mockResolvedValue([propertyA, propertyC]),
    };

    const result = await createPropertyBatchFn(propertiesService)([
      'a',
      'b',
      'c',
    ]);

    expect(propertiesService.getPropertiesByIds).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([propertyA, null, propertyC]);
  });

  it('createServiceBatchFn returns [a, null, c] in input-key order when the bulk result covers only a and c', async () => {
    const serviceA = { id: 'a' };
    const serviceC = { id: 'c' };
    const servicesService = {
      getServicesByIds: jest.fn().mockResolvedValue([serviceA, serviceC]),
    };

    const result = await createServiceBatchFn(servicesService)(['a', 'b', 'c']);

    expect(servicesService.getServicesByIds).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([serviceA, null, serviceC]);
  });

  it('createTeamBatchFn returns [a, null, c] in input-key order when the bulk result covers only a and c', async () => {
    const teamA = { id: 'a' };
    const teamC = { id: 'c' };
    const teamsService = {
      getTeamsByIds: jest.fn().mockResolvedValue([teamA, teamC]),
    };

    const result = await createTeamBatchFn(teamsService)(['a', 'b', 'c']);

    expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(result).toEqual([teamA, null, teamC]);
  });
});
