import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLInputObjectType } from 'graphql';
import { CustomerResolver } from '../../../customers/presentation/graphql/customer.resolver';
import { PropertyReadResolver } from '../../../customers/presentation/graphql/property-read.resolver';
import { PropertyResolver } from '../../../customers/presentation/graphql/property.resolver';
import { ServiceReadResolver } from '../../../catalog/presentation/graphql/service-read.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { TeamReadResolver } from '../../../cleaners/presentation/graphql/team-read.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingReadResolver } from '../../../bookings/presentation/graphql/booking-read.resolver';
import { BookingMutationResolver } from '../../../bookings/presentation/graphql/booking.resolver';
import { ChecklistReadResolver } from '../../presentation/graphql/checklist-read.resolver';
import { JobReadResolver } from '../../presentation/graphql/job-read.resolver';
import { JobResolver } from '../../presentation/graphql/job.resolver';

describe('Job GraphQL collections (§3.6 mechanism 1)', () => {
  it('exposes jobs filter.booking.id so existence can be expressed without jobByBookingId', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    const schema = await schemaFactory.create([
      JobReadResolver,
      JobResolver,
      ChecklistReadResolver,
      BookingReadResolver,
      BookingMutationResolver,
      CustomerResolver,
      PropertyReadResolver,
      PropertyResolver,
      ServiceReadResolver,
      ServiceResolver,
      TeamReadResolver,
      TeamResolver,
    ]);

    const filterType = schema.getType(
      'CleaningJobFilter',
    ) as GraphQLInputObjectType;
    expect(filterType).toBeDefined();
    expect(Object.keys(filterType.getFields())).toEqual(
      expect.arrayContaining(['booking']),
    );
    expect(schema.getQueryType()!.getFields().jobByBookingId).toBeUndefined();
  });
});
