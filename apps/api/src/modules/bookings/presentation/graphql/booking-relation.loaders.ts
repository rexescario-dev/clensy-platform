import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Customer } from '../../../customers/domain/customer';
import { Property } from '../../../customers/domain/property';
import { CustomersService } from '../../../customers/application/services/customers.service';
import { PropertiesService } from '../../../customers/application/services/properties.service';
import { Service } from '../../../catalog/domain/service';
import { ServicesService } from '../../../catalog/application/services/services.service';
import { Team } from '../../../cleaners/domain/team';
import { TeamsService } from '../../../cleaners/application/services/teams.service';

// Extracted as standalone functions (mirroring `active-pricing.loader.ts`/
// `cleaner-team.loaders.ts`) so unit tests can call them directly instead
// of reaching into `DataLoader`'s private `_batchLoadFn` property.
export function createCustomerBatchFn(
  customersService: Pick<CustomersService, 'getCustomersByIds'>,
): DataLoader.BatchLoadFn<string, Customer | null> {
  return async (ids) => {
    const customers = await customersService.getCustomersByIds([...ids]);
    const byId = new Map(customers.map((customer) => [customer.id, customer]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createPropertyBatchFn(
  propertiesService: Pick<PropertiesService, 'getPropertiesByIds'>,
): DataLoader.BatchLoadFn<string, Property | null> {
  return async (ids) => {
    const properties = await propertiesService.getPropertiesByIds([...ids]);
    const byId = new Map(properties.map((property) => [property.id, property]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createServiceBatchFn(
  servicesService: Pick<ServicesService, 'getServicesByIds'>,
): DataLoader.BatchLoadFn<string, Service | null> {
  return async (ids) => {
    const services = await servicesService.getServicesByIds([...ids]);
    const byId = new Map(services.map((service) => [service.id, service]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    const teams = await teamsService.getTeamsByIds([...ids]);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

// Request-scoped (Scope.REQUEST): a fresh instance — and fresh DataLoader
// caches — per GraphQL request, so results never leak across requests.
// Satisfies spec §4.5's N+1 batching invariant for all four of `Booking`'s
// computed relations. Owned by `modules/bookings`, not a reuse of
// `CleanerTeamLoaders` — that class is not exported from `CleanersModule`
// and batches `Cleaner`/`Team`'s own relation, not `Booking`'s (plan §3).
@Injectable({ scope: Scope.REQUEST })
export class BookingRelationLoaders {
  readonly customerLoader: DataLoader<string, Customer | null>;
  readonly propertyLoader: DataLoader<string, Property | null>;
  readonly serviceLoader: DataLoader<string, Service | null>;
  readonly teamLoader: DataLoader<string, Team | null>;

  constructor(
    private readonly customersService: CustomersService,
    private readonly propertiesService: PropertiesService,
    private readonly servicesService: ServicesService,
    private readonly teamsService: TeamsService,
  ) {
    this.customerLoader = new DataLoader(
      createCustomerBatchFn(this.customersService),
    );
    this.propertyLoader = new DataLoader(
      createPropertyBatchFn(this.propertiesService),
    );
    this.serviceLoader = new DataLoader(
      createServiceBatchFn(this.servicesService),
    );
    this.teamLoader = new DataLoader(createTeamBatchFn(this.teamsService));
  }
}
