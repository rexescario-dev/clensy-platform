import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLInputObjectType, GraphQLObjectType } from 'graphql';
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getAuthorizer from
// the package root, so this deep import is required.
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
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
import { ChecklistType } from '../../presentation/graphql/checklist.type';
import { CleaningJobType } from '../../presentation/graphql/cleaning-job.type';
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

    // #86 I-2: the tenant is never a GraphQL field, filter or input.
    for (const typeName of [
      'CleaningJob',
      'CleaningJobFilter',
      'Checklist',
      'ChecklistItem',
      'CreateJobFromBookingInput',
      'AssignTeamToJobInput',
      'CompleteJobInput',
      'CompleteChecklistItemInput',
    ]) {
      const type = schema.getType(typeName) as
        GraphQLInputObjectType | GraphQLObjectType | undefined;
      expect(type).toBeDefined();
      expect(Object.keys(type!.getFields())).not.toContain('tenantId');
    }
  });
});

// @Authorize metadata (#86 Slice decision 5; mirrors #82–#85). Security
// invariant: every nestjs-query read of a job or checklist is ANDed with
// the principal's tenant; no principal tenant matches no row.
describe.each([
  ['CleaningJobType', CleaningJobType],
  ['ChecklistType', ChecklistType],
])('%s tenant authorizer', (_name, DTO) => {
  async function filterFor(context: object) {
    const Authorizer = getAuthorizer(DTO as never);
    expect(Authorizer).toBeDefined();
    const authorizer = new Authorizer!({}, undefined);
    return authorizer.authorize(context, { operationGroup: 'read' } as never);
  }

  it('constrains reads to the principal tenant', async () => {
    await expect(
      filterFor({
        req: {
          user: {
            id: 'u',
            tenantId: 't-a',
            role: Role.OPS_MANAGER,
            scope: AdminScope.TENANT,
          },
        },
      }),
    ).resolves.toEqual({ tenantId: { eq: 't-a' } });
  });

  it('matches no row without a principal', async () => {
    await expect(filterFor({})).resolves.toEqual({ id: { is: null } });
  });
});
